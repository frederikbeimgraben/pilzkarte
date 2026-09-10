"""Die Endpunkte ohne Fachbezug und die Fehlerform der App."""

import httpx
import pytest
from fastapi import FastAPI

from app.core.version import VERSION
from app.main import build_app, lifespan
from tests.conftest import CLIENT_ID, ISSUER, FakeIdp, auth_header


def client(app: FastAPI, *, fehler_durchreichen: bool = True) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=fehler_durchreichen)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_health_reports_ok() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_config_returns_the_four_fields() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/config")

    assert response.status_code == 200
    assert response.json() == {
        "oidcIssuer": ISSUER,
        "oidcClientId": CLIENT_ID,
        "origin": "http://localhost:4200",
        "version": VERSION,
    }


async def test_the_version_comes_from_the_pyproject() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/config")

    assert response.json()["version"].count(".") >= 1


async def test_me_returns_the_person_from_the_token(idp: FakeIdp) -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/ich", headers=auth_header(idp.token()))

    assert response.status_code == 200
    assert response.json() == {
        "sub": "nutzer-1",
        "email": "pilz@example.test",
        "name": "Pilzsammlerin",
    }


async def test_me_without_a_token_is_401() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/ich")

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "unauthorized"


async def test_an_unknown_path_is_problem_json() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/gibt-es-nicht")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "not_found"


async def test_the_lifespan_releases_the_connections() -> None:
    app = build_app()

    async with lifespan(app):
        pass


@pytest.mark.parametrize("path", ["/api/health", "/api/config"])
async def test_endpoints_allow_the_own_origin(path: str) -> None:
    async with client(build_app()) as call:
        response = await call.get(path, headers={"Origin": "http://localhost:4200"})

    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
