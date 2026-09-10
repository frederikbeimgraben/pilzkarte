"""Jede Fehlerantwort traegt problem+json."""

import httpx
from fastapi import FastAPI

from app.core.errors import (
    AppError,
    FieldError,
    NotAuthenticated,
    code_for,
    problem_response,
    register_error_handlers,
    title_for,
)


async def _number(value: int) -> dict[str, int]:
    return {"wert": value}


async def _broken() -> None:
    raise RuntimeError("etwas ging schief")


async def _app_error() -> None:
    raise AppError("aus der App heraus")


async def _needs_auth() -> None:
    raise NotAuthenticated("kein Token")


def app_with_errors() -> FastAPI:
    app = FastAPI()
    app.add_api_route("/zahl", _number, methods=["GET"])
    app.add_api_route("/kaputt", _broken, methods=["GET"])
    app.add_api_route("/eigen", _app_error, methods=["GET"])
    app.add_api_route("/anmeldung", _needs_auth, methods=["GET"])
    register_error_handlers(app)
    return app


def client(*, fehler_durchreichen: bool = True) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app_with_errors(), raise_app_exceptions=fehler_durchreichen)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_a_validation_error_names_the_field() -> None:
    async with client() as call:
        response = await call.get("/zahl", params={"wert": "keine-zahl"})

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["errors"][0]["field"] == "value"
    assert body["errors"][0]["message"]


async def test_an_unhandled_error_reveals_nothing() -> None:
    async with client(fehler_durchreichen=False) as call:
        response = await call.get("/kaputt")

    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "internal_error"
    assert "schief" not in body["detail"]


async def test_app_error_becomes_problem_json() -> None:
    async with client() as call:
        response = await call.get("/eigen")

    assert response.status_code == 500
    assert response.json()["detail"] == "aus der App heraus"


async def test_missing_auth_sets_the_header() -> None:
    async with client() as call:
        response = await call.get("/anmeldung")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["type"] == "urn:pilzkarte:fehler:unauthorized"


def test_an_unknown_status_gets_defaults() -> None:
    assert code_for(418) == "error"
    assert title_for(418) == "Fehler"


def test_the_problem_response_omits_empty_fields() -> None:
    response = problem_response(400)

    assert response.status_code == 400
    assert b"detail" not in response.body


def test_the_problem_response_takes_field_errors() -> None:
    response = problem_response(422, errors=[FieldError(field="woche", message="zu gross")])

    assert b"woche" in response.body


def test_app_error_without_detail_reports_the_title() -> None:
    assert str(NotAuthenticated()) == "Nicht angemeldet"
