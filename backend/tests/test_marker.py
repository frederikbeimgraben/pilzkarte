"""Marker: anlegen, lesen, aendern, loeschen, und immer nur die eigenen."""

from typing import Any

import httpx
import pytest

from tests.conftest import FalscherIdp
from tests.objekte import marker_koerper
from tests.test_funde import EIGEN, FREMD, als


async def marker_anlegen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    sub: str = EIGEN,
    **abweichung: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt einen Marker an und liefert die Antwort."""
    antwort = await ruf.post(
        "/api/marker",
        json=marker_koerper(**abweichung),
        headers=als(idp, sub),
    )
    assert antwort.status_code == 201, antwort.text
    return antwort.json()


async def test_ohne_token_gibt_es_keine_marker(ruf: httpx.AsyncClient) -> None:
    async with ruf:
        antwort = await ruf.get("/api/marker")

    assert antwort.status_code == 401


async def test_ein_marker_traegt_farbe_und_notiz(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await marker_anlegen(ruf, idp)
        gelesen = await ruf.get(f"/api/marker/{angelegt['id']}", headers=als(idp))

    koerper = gelesen.json()
    assert koerper["name"] == "Alter Fichtenhang"
    assert koerper["farbe"] == "blau"
    assert koerper["sichtbarkeit"] == "privat"


async def test_eine_farbe_ausserhalb_der_sechs_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/marker",
            json=marker_koerper(farbe="magenta"),
            headers=als(idp),
        )

    assert antwort.status_code == 422


async def test_ein_marker_ausserhalb_deutschlands_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/marker",
            json=marker_koerper(lat=41.9, lon=12.5),
            headers=als(idp),
        )

    assert antwort.status_code == 422


async def test_ein_marker_ohne_namen_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.post("/api/marker", json=marker_koerper(name=""), headers=als(idp))

    assert antwort.status_code == 422


async def test_die_liste_zeigt_nur_die_eigenen_marker(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await marker_anlegen(ruf, idp)
        _ = await marker_anlegen(ruf, idp, sub=FREMD)
        meine = await ruf.get("/api/marker", headers=als(idp))

    assert meine.json()["gesamt"] == 1


async def test_die_liste_der_marker_blaettert(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        for nummer in range(3):
            _ = await marker_anlegen(ruf, idp, name=f"Stelle {nummer}")
        seite = await ruf.get("/api/marker?limit=1&offset=1", headers=als(idp))

    koerper = seite.json()
    assert koerper["gesamt"] == 3
    assert len(koerper["eintraege"]) == 1


async def test_ein_marker_laesst_sich_aendern(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await marker_anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/marker/{angelegt['id']}",
            json={"farbe": "rot", "sichtbarkeit": "geteilt"},
            headers=als(idp),
        )

    koerper = geaendert.json()
    assert koerper["farbe"] == "rot"
    assert koerper["sichtbarkeit"] == "geteilt"
    assert koerper["name"] == angelegt["name"]


async def test_ein_marker_laesst_sich_loeschen(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await marker_anlegen(ruf, idp)
        geloescht = await ruf.delete(f"/api/marker/{angelegt['id']}", headers=als(idp))
        nachher = await ruf.get(f"/api/marker/{angelegt['id']}", headers=als(idp))

    assert geloescht.status_code == 204
    assert nachher.status_code == 404


@pytest.mark.parametrize("verb", ["get", "patch", "delete"])
async def test_ein_fremder_marker_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    verb: str,
) -> None:
    async with ruf:
        angelegt = await marker_anlegen(ruf, idp)
        pfad = f"/api/marker/{angelegt['id']}"
        if verb == "patch":
            antwort = await ruf.patch(pfad, json={"farbe": "rot"}, headers=als(idp, FREMD))
        else:
            antwort = await ruf.request(verb.upper(), pfad, headers=als(idp, FREMD))

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "not_found"
