"""Die Endpunkte ohne Fachbezug und die Fehlerform der App."""

import httpx
import pytest
from fastapi import FastAPI

from app.core.version import VERSION
from app.main import app_bauen, lebenszyklus
from tests.conftest import CLIENT_ID, ISSUER


def klient(app: FastAPI, *, fehler_durchreichen: bool = True) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=fehler_durchreichen)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_health_meldet_ok() -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get("/api/health")

    assert antwort.status_code == 200
    assert antwort.json() == {"status": "ok"}


async def test_config_liefert_die_vier_felder() -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get("/api/config")

    assert antwort.status_code == 200
    assert antwort.json() == {
        "oidcIssuer": ISSUER,
        "oidcClientId": CLIENT_ID,
        "origin": "http://localhost:4200",
        "version": VERSION,
    }


async def test_version_kommt_aus_der_pyproject() -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get("/api/config")

    assert antwort.json()["version"].count(".") >= 1


async def test_unbekannter_pfad_ist_problem_json() -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get("/api/gibt-es-nicht")

    assert antwort.status_code == 404
    assert antwort.headers["content-type"].startswith("application/problem+json")
    assert antwort.json()["code"] == "not_found"


async def test_lebenszyklus_gibt_die_verbindungen_frei() -> None:
    app = app_bauen()

    async with lebenszyklus(app):
        pass


@pytest.mark.parametrize("pfad", ["/api/health", "/api/config"])
async def test_endpunkte_erlauben_den_eigenen_ursprung(pfad: str) -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get(pfad, headers={"Origin": "http://localhost:4200"})

    assert antwort.headers["access-control-allow-origin"] == "http://localhost:4200"
