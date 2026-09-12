"""Die Texte der Oberfläche.

Lesen kann jeder, auch ohne Anmeldung. Ändern darf nur, wer das Recht
``text.edit`` trägt. Die Vorgabe steht in ``daten/texte.json`` und
bleibt als Ziel des Zurücksetzens erhalten.
"""

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select

from app.core.db import session_factory
from app.models import UiText
from app.modules.access.permissions import Permission
from app.modules.access.service import ensure_built_in_roles, sync_permissions
from app.modules.texts.seed import Locale, seed_catalogue
from app.modules.texts.service import sync_texts
from tests.conftest import FakeIdp, auth_header
from tools import export_texts
from tools.export_texts import SOURCE, TARGET, parse, rendered

ADMIN_GROUP = "pilze-admins"
SOME_KEY = "nav.karte"


def as_admin(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos mit der Admin-Gruppe im Token."""
    return dict(auth_header(idp.token(sub="nutzer-root", groups=[ADMIN_GROUP])))


def as_guest(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines angemeldeten Kontos ohne jedes Recht."""
    return dict(auth_header(idp.token(sub="nutzer-gast")))


@pytest.fixture
async def seeded(schema: None) -> None:  # noqa: ARG001
    """Legt Rechte, feste Rollen und den Anfangsbestand an, so wie der Start es tut."""
    async with session_factory()() as session:
        await sync_permissions(session)
        await ensure_built_in_roles(session)
        await sync_texts(session)


@pytest.fixture
def call(object_app: FastAPI, seeded: None) -> httpx.AsyncClient:  # noqa: ARG001
    """Ein Klient gegen die App mit fertigem Textbestand."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=object_app),
        base_url="http://test",
    )


def entry_for(body: Any, key: str) -> dict[str, Any]:  # noqa: ANN401
    """Sucht einen Eintrag im Katalog der Antwort."""
    entries: list[dict[str, Any]] = body["entries"]
    return next(entry for entry in entries if entry["key"] == key)


# ------------------------------------------------------------------ Abschrift


def test_the_copy_matches_the_catalogue_of_the_frontend() -> None:
    # Die Abschrift geht mit dem Backend auf den Server, die Quelle nicht. Wer
    # im Frontend einen Text ändert, muss `python -m tools.export_texts` laufen
    # lassen; ohne diesen Test fiele das erst im Betrieb auf.
    expected = rendered(parse(SOURCE.read_text(encoding="utf-8")))

    assert TARGET.read_text(encoding="utf-8") == expected


def test_the_reader_refuses_a_catalogue_it_cannot_read_completely() -> None:
    broken = "const de = {\n  'a': 'eins',\n  'b': fremd,\n}\nconst en: Record<x> = {\n}\n"

    with pytest.raises(ValueError, match="Einträge"):
        parse(broken)


def test_the_reader_refuses_a_key_that_only_one_language_has() -> None:
    lopsided = "const de = {\n  'a': 'eins',\n}\nconst en: Record<TranslationKey, string> = {\n}\n"

    with pytest.raises(ValueError, match="fehlen in einer Sprache"):
        parse(lopsided)


def test_the_reader_undoes_escapes() -> None:
    source = (
        "const de = {\n  'a': 'Zeile\\nZeile',\n}\n"
        "const en: Record<TranslationKey, string> = {\n  'a': \"Melzer's\",\n}\n"
    )

    catalogue = parse(source)

    assert catalogue["de"]["a"] == "Zeile\nZeile"
    assert catalogue["en"]["a"] == "Melzer's"


def test_the_export_writes_the_copy(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "texte.json"
    monkeypatch.setattr(export_texts, "TARGET", target)

    assert export_texts.main() == 0
    # Ein zweiter Lauf ohne Änderung schreibt nichts und meldet trotzdem Erfolg.
    assert export_texts.main() == 0
    assert json.loads(target.read_text(encoding="utf-8"))["de"][SOME_KEY]


# ------------------------------------------------------------------ Abgleich


async def test_the_start_seeds_every_key_in_both_languages(seeded: None) -> None:  # noqa: ARG001
    catalogue = seed_catalogue()

    async with session_factory()() as session:
        rows = list(await session.scalars(select(UiText)))

    assert len(rows) == len(catalogue[Locale.DE]) + len(catalogue[Locale.EN])
    assert {(row.key, row.locale) for row in rows} >= {(SOME_KEY, "de"), (SOME_KEY, "en")}


async def test_a_second_start_keeps_a_changed_text(seeded: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        row = await session.get(UiText, (SOME_KEY, "de"))
        assert row is not None
        row.value = "Landkarte"
        await session.commit()
        await sync_texts(session)
        again = await session.get(UiText, (SOME_KEY, "de"))

    assert again is not None
    assert again.value == "Landkarte"


async def test_the_start_drops_a_key_the_catalogue_no_longer_has(seeded: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        session.add(UiText(key="alt.weg", locale="de", value="Weg"))
        await session.commit()

        await sync_texts(session)

        assert await session.get(UiText, ("alt.weg", "de")) is None


# ------------------------------------------------------------------ Lesen


async def test_anyone_reads_the_whole_catalogue(call: httpx.AsyncClient) -> None:
    async with call as client:
        answer = await client.get("/api/texts")

    body = answer.json()
    assert answer.status_code == 200
    assert body["locales"] == ["de", "en"]
    assert len(body["entries"]) == len(seed_catalogue()[Locale.DE])
    assert entry_for(body, SOME_KEY)["values"] == {"de": "Karte", "en": "Map"}
    assert entry_for(body, SOME_KEY)["changed"] is False


async def test_the_catalogue_carries_an_etag(call: httpx.AsyncClient) -> None:
    async with call as client:
        first = await client.get("/api/texts")
        again = await client.get("/api/texts", headers={"If-None-Match": first.headers["etag"]})

    assert first.headers["etag"] == first.json()["revision"]
    assert first.headers["cache-control"] == "no-cache"
    assert again.status_code == 304
    assert again.headers["cache-control"] == "no-cache"
    assert again.content == b""


async def test_a_change_moves_the_etag(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        before = (await client.get("/api/texts")).headers["etag"]
        await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "de", "value": "Landkarte"},
            headers=as_admin(idp),
        )
        after = await client.get("/api/texts", headers={"If-None-Match": before})

    assert after.status_code == 200
    assert after.headers["etag"] != before


# ------------------------------------------------------------------ Aendern


async def test_the_right_lets_a_person_change_a_text(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call as client:
        answer = await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "de", "value": "Landkarte"},
            headers=as_admin(idp),
        )
        catalogue = await client.get("/api/texts")

    assert answer.status_code == 200
    assert answer.json()["values"]["de"] == "Landkarte"
    assert answer.json()["changed"] is True
    assert entry_for(catalogue.json(), SOME_KEY)["values"]["de"] == "Landkarte"


async def test_a_change_remembers_who_wrote_it(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "de", "value": "Landkarte"},
            headers=as_admin(idp),
        )

    async with session_factory()() as session:
        row = await session.get(UiText, (SOME_KEY, "de"))

    assert row is not None
    assert row.updated_by == "nutzer-root"


async def test_without_the_right_nobody_writes(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        answer = await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "de", "value": "Landkarte"},
            headers=as_guest(idp),
        )

    assert answer.status_code == 403
    assert answer.headers["content-type"].startswith("application/problem+json")
    assert Permission.TEXT_EDIT.value in answer.json()["detail"]


async def test_without_a_token_nobody_writes(call: httpx.AsyncClient) -> None:
    async with call as client:
        answer = await client.put(f"/api/texts/{SOME_KEY}", json={"locale": "de", "value": "x"})

    assert answer.status_code == 401
    assert answer.headers["content-type"].startswith("application/problem+json")


async def test_an_unknown_key_is_a_404(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        answer = await client.put(
            "/api/texts/gibt.es.nicht",
            json={"locale": "de", "value": "x"},
            headers=as_admin(idp),
        )

    assert answer.status_code == 404
    assert answer.headers["content-type"].startswith("application/problem+json")


async def test_an_empty_text_is_refused(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        answer = await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "de", "value": "   "},
            headers=as_admin(idp),
        )

    assert answer.status_code == 422
    assert answer.headers["content-type"].startswith("application/problem+json")


async def test_an_unknown_language_is_refused(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        answer = await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "fr", "value": "Carte"},
            headers=as_admin(idp),
        )

    assert answer.status_code == 422


# ------------------------------------------------------------------ Zuruecksetzen


async def test_a_reset_brings_the_default_back(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        await client.put(
            f"/api/texts/{SOME_KEY}",
            json={"locale": "de", "value": "Landkarte"},
            headers=as_admin(idp),
        )
        answer = await client.delete(
            f"/api/texts/{SOME_KEY}",
            params={"locale": "de"},
            headers=as_admin(idp),
        )

    assert answer.status_code == 200
    assert answer.json()["values"]["de"] == "Karte"
    assert answer.json()["changed"] is False


async def test_a_reset_needs_the_right(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        answer = await client.delete(
            f"/api/texts/{SOME_KEY}",
            params={"locale": "de"},
            headers=as_guest(idp),
        )

    assert answer.status_code == 403


async def test_a_reset_without_a_default_is_a_404(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    # Ein Schlüssel, den der Katalog nicht mehr kennt, hat kein Ziel mehr. Der
    # nächste Start räumt seine Zeile ab; bis dahin lässt er sich nicht
    # zurücksetzen.
    async with session_factory()() as session:
        session.add(UiText(key="alt.weg", locale="de", value="Weg"))
        await session.commit()

    async with call as client:
        answer = await client.delete(
            "/api/texts/alt.weg",
            params={"locale": "de"},
            headers=as_admin(idp),
        )

    assert answer.status_code == 404
    assert "Vorgabe" in answer.json()["detail"]


async def test_a_reset_of_an_unknown_key_is_a_404(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call as client:
        answer = await client.delete(
            "/api/texts/gibt.es.nicht",
            params={"locale": "de"},
            headers=as_admin(idp),
        )

    assert answer.status_code == 404
