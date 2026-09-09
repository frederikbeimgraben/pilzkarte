"""Pruefung der Bearer-Token und des JWKS-Speichers."""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import httpx
import pytest
from fastapi import Depends, FastAPI

from app.core import auth
from app.core.auth import (
    JwksSpeicher,
    Nutzer,
    aktueller_nutzer,
    nutzer_aus_token,
    nutzer_optional,
)
from app.core.errors import AnmeldungFehlt, fehlerbehandlung_registrieren
from tests.conftest import ISSUER, FalscherIdp, ec_schluessel, kopfzeile, rsa_schluessel


async def _geschuetzt(nutzer: Annotated[Nutzer, Depends(aktueller_nutzer)]) -> dict[str, str]:
    return {"sub": nutzer.sub}


async def _offen(
    nutzer: Annotated[Nutzer | None, Depends(nutzer_optional)],
) -> dict[str, str | None]:
    return {"sub": nutzer.sub if nutzer else None}


def app_mit_schutz() -> FastAPI:
    app = FastAPI()
    app.add_api_route("/geschuetzt", _geschuetzt, methods=["GET"])
    app.add_api_route("/offen", _offen, methods=["GET"])
    fehlerbehandlung_registrieren(app)
    return app


def klient(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_gueltiges_token_liefert_die_person(idp: FalscherIdp) -> None:
    nutzer = await nutzer_aus_token(idp.token())

    assert nutzer == Nutzer(sub="nutzer-1", email="pilz@example.test", name="Pilzsammlerin")


async def test_token_ohne_email_und_name(idp: FalscherIdp) -> None:
    nutzer = await nutzer_aus_token(idp.token(email=None, name=None))

    assert nutzer.email is None
    assert nutzer.name is None


async def test_es256_wird_akzeptiert(idp: FalscherIdp) -> None:
    idp.drehen(ec_schluessel(), "ec-1", "ES256")

    nutzer = await nutzer_aus_token(idp.token())

    assert nutzer.sub == "nutzer-1"


async def test_falsche_aud(idp: FalscherIdp) -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(aud="fremde-app"))


async def test_falscher_iss(idp: FalscherIdp) -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(iss="https://fremd.example.test/"))


async def test_abgelaufen(idp: FalscherIdp) -> None:
    vorbei = datetime.now(UTC) - timedelta(hours=2)
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(exp=int(vorbei.timestamp())))


async def test_falsche_signatur(idp: FalscherIdp) -> None:
    # Gleiche Kennung, anderer Schluessel: genau der Fall, den nur die Signatur faengt.
    fremd = idp.token(schluessel=rsa_schluessel())

    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(fremd)


async def test_ohne_exp(idp: FalscherIdp) -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(exp=None))


@pytest.mark.usefixtures("idp")
async def test_unlesbares_token() -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token("kein-token")


async def test_token_ohne_kid(idp: FalscherIdp) -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(ohne_kid=True))


async def test_sub_ist_kein_text(idp: FalscherIdp) -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(sub=42))


async def test_unbekannter_kid_bleibt_unbekannt(idp: FalscherIdp) -> None:
    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token(kid="gibt-es-nicht"))


async def test_jwks_wird_nur_einmal_geholt(idp: FalscherIdp) -> None:
    token = idp.token()

    await nutzer_aus_token(token)
    aufrufe_danach = len(idp.aufrufe)
    await nutzer_aus_token(token)

    assert len(idp.aufrufe) == aufrufe_danach


async def test_neuer_kid_laedt_nach(idp: FalscherIdp) -> None:
    await nutzer_aus_token(idp.token())
    vorher = len(idp.aufrufe)
    idp.drehen(rsa_schluessel(), "schluessel-2")

    nutzer = await nutzer_aus_token(idp.token())

    assert nutzer.sub == "nutzer-1"
    assert len(idp.aufrufe) > vorher


async def test_abgelaufener_speicher_laedt_neu(idp: FalscherIdp) -> None:
    speicher = JwksSpeicher(ttl=timedelta(0))

    await speicher.schluessel(idp.kid)
    await speicher.schluessel(idp.kid)

    assert len([ruf for ruf in idp.aufrufe if ruf.endswith("jwks/")]) == 2


async def test_discovery_faellt_auf_jwks_zurueck(idp: FalscherIdp) -> None:
    idp.discovery = None

    nutzer = await nutzer_aus_token(idp.token())

    assert nutzer.sub == "nutzer-1"
    assert f"{ISSUER}jwks/" in idp.aufrufe


async def test_discovery_ohne_jwks_uri(idp: FalscherIdp) -> None:
    idp.discovery = {"issuer": ISSUER}

    nutzer = await nutzer_aus_token(idp.token())

    assert nutzer.sub == "nutzer-1"


async def test_jwks_ohne_schluesselliste(idp: FalscherIdp) -> None:
    idp.jwks = ["kein", "objekt"]

    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token())


async def test_jwks_eintrag_ohne_objekt(idp: FalscherIdp) -> None:
    liste: list[Any] = ["kein-objekt"]
    idp.jwks = {"keys": liste}

    with pytest.raises(AnmeldungFehlt):
        await nutzer_aus_token(idp.token())


@pytest.mark.usefixtures("idp")
async def test_geschuetzt_ohne_kopfzeile_ist_401() -> None:
    async with klient(app_mit_schutz()) as ruf:
        antwort = await ruf.get("/geschuetzt")

    assert antwort.status_code == 401
    assert antwort.headers["content-type"].startswith("application/problem+json")
    assert antwort.headers["www-authenticate"] == "Bearer"
    assert antwort.json()["code"] == "unauthorized"


async def test_geschuetzt_mit_falschem_token_ist_401(idp: FalscherIdp) -> None:
    async with klient(app_mit_schutz()) as ruf:
        antwort = await ruf.get("/geschuetzt", headers=kopfzeile(idp.token(aud="fremde-app")))

    assert antwort.status_code == 401
    assert antwort.json()["title"] == "Nicht angemeldet"


async def test_geschuetzt_mit_gueltigem_token(idp: FalscherIdp) -> None:
    async with klient(app_mit_schutz()) as ruf:
        antwort = await ruf.get("/geschuetzt", headers=kopfzeile(idp.token()))

    assert antwort.status_code == 200
    assert antwort.json() == {"sub": "nutzer-1"}


@pytest.mark.usefixtures("idp")
async def test_offen_ohne_token_bleibt_anonym() -> None:
    async with klient(app_mit_schutz()) as ruf:
        antwort = await ruf.get("/offen")

    assert antwort.status_code == 200
    assert antwort.json() == {"sub": None}


async def test_offen_mit_token_kennt_die_person(idp: FalscherIdp) -> None:
    async with klient(app_mit_schutz()) as ruf:
        antwort = await ruf.get("/offen", headers=kopfzeile(idp.token()))

    assert antwort.json() == {"sub": "nutzer-1"}


async def test_netzklient_gilt_die_zeitgrenze() -> None:
    # Die einzige Stelle, an der das echte Netz haengt. Jeder andere Test ersetzt sie.
    async with auth.netzklient() as klient_zum_netz:
        assert klient_zum_netz.timeout.connect == auth.NETZ_ZEITGRENZE
