"""Jede Fehlerantwort traegt problem+json."""

import httpx
from fastapi import FastAPI

from app.core.errors import (
    AnmeldungFehlt,
    AppFehler,
    Feldfehler,
    code_fuer,
    fehlerbehandlung_registrieren,
    problem_antwort,
    titel_fuer,
)


async def _zahl(wert: int) -> dict[str, int]:
    return {"wert": wert}


async def _kaputt() -> None:
    raise RuntimeError("etwas ging schief")


async def _eigen() -> None:
    raise AppFehler("aus der App heraus")


async def _anmeldung() -> None:
    raise AnmeldungFehlt("kein Token")


def app_mit_fehlern() -> FastAPI:
    app = FastAPI()
    app.add_api_route("/zahl", _zahl, methods=["GET"])
    app.add_api_route("/kaputt", _kaputt, methods=["GET"])
    app.add_api_route("/eigen", _eigen, methods=["GET"])
    app.add_api_route("/anmeldung", _anmeldung, methods=["GET"])
    fehlerbehandlung_registrieren(app)
    return app


def klient(*, fehler_durchreichen: bool = True) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app_mit_fehlern(), raise_app_exceptions=fehler_durchreichen)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_validierungsfehler_nennt_das_feld() -> None:
    async with klient() as ruf:
        antwort = await ruf.get("/zahl", params={"wert": "keine-zahl"})

    assert antwort.status_code == 422
    assert antwort.headers["content-type"].startswith("application/problem+json")
    koerper = antwort.json()
    assert koerper["code"] == "validation_error"
    assert koerper["errors"][0]["field"] == "wert"
    assert koerper["errors"][0]["message"]


async def test_unbehandelter_fehler_verraet_nichts() -> None:
    async with klient(fehler_durchreichen=False) as ruf:
        antwort = await ruf.get("/kaputt")

    assert antwort.status_code == 500
    koerper = antwort.json()
    assert koerper["code"] == "internal_error"
    assert "schief" not in koerper["detail"]


async def test_app_fehler_wird_zu_problem_json() -> None:
    async with klient() as ruf:
        antwort = await ruf.get("/eigen")

    assert antwort.status_code == 500
    assert antwort.json()["detail"] == "aus der App heraus"


async def test_anmeldung_fehlt_setzt_die_kopfzeile() -> None:
    async with klient() as ruf:
        antwort = await ruf.get("/anmeldung")

    assert antwort.status_code == 401
    assert antwort.headers["www-authenticate"] == "Bearer"
    assert antwort.json()["type"] == "urn:pilzkarte:fehler:unauthorized"


def test_unbekannter_status_bekommt_vorgaben() -> None:
    assert code_fuer(418) == "error"
    assert titel_fuer(418) == "Fehler"


def test_problem_antwort_laesst_leere_felder_weg() -> None:
    antwort = problem_antwort(400)

    assert antwort.status_code == 400
    assert b"detail" not in antwort.body


def test_problem_antwort_nimmt_feldfehler() -> None:
    antwort = problem_antwort(422, errors=[Feldfehler(field="woche", message="zu gross")])

    assert b"woche" in antwort.body


def test_app_fehler_ohne_detail_meldet_den_titel() -> None:
    assert str(AnmeldungFehlt()) == "Nicht angemeldet"
