"""Fehler als problem+json nach RFC 9457.

Jeder Fehlerpfad der App endet hier. Die Antwort traegt den Medientyp
``application/problem+json`` und immer dieselben Felder. Das FastAPI-eigene
``detail``-Objekt verlaesst die App nie.
"""

import logging
from collections.abc import Mapping, Sequence
from typing import ClassVar, Final, cast

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

_log: Final = logging.getLogger("pilze.fehler")

MEDIA_TYPE: Final = "application/problem+json"

TITLES: Final[Mapping[int, str]] = {
    400: "Fehlerhafte Anfrage",
    401: "Nicht angemeldet",
    403: "Nicht erlaubt",
    404: "Nicht gefunden",
    409: "Konflikt",
    413: "Anfrage zu gross",
    415: "Medientyp nicht unterstuetzt",
    422: "Eingabe ungueltig",
    500: "Interner Fehler",
}

CODE: Final[Mapping[int, str]] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    500: "internal_error",
}


class FieldError(BaseModel):
    """Ein einzelner Verstoss in der Eingabe."""

    field: str
    message: str


class Problem(BaseModel):
    """Der Antwortkoerper eines Fehlers."""

    type: str
    title: str
    status: int
    code: str
    detail: str | None = None
    errors: list[FieldError] | None = None


def code_for(status: int) -> str:
    """Liefert den stabilen Fehlercode zu einem Status."""
    return CODE.get(status, "error")


def title_for(status: int) -> str:
    """Liefert den lesbaren Titel zu einem Status."""
    return TITLES.get(status, "Fehler")


class AppError(Exception):
    """Ein Fehler, den die App selbst wirft."""

    status: ClassVar[int] = 500
    headers: ClassVar[Mapping[str, str]] = {}

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail
        super().__init__(detail or title_for(type(self).status))


class NotAuthenticated(AppError):
    """Das Token fehlt, ist abgelaufen oder traegt nicht."""

    status: ClassVar[int] = 401
    # Ohne diese Kopfzeile weiss ein Client nicht, welches Verfahren er braucht.
    headers: ClassVar[Mapping[str, str]] = {"WWW-Authenticate": "Bearer"}


class NotFound(AppError):
    """Das angefragte Objekt gibt es nicht, oder es gehoert einem anderen."""

    status: ClassVar[int] = 404


class Invalid(AppError):
    """Die Eingabe passt zum Vertrag, aber nicht zu den Regeln der App."""

    status: ClassVar[int] = 422


class UnsupportedMediaType(AppError):
    """Der Dienst nimmt diesen Medientyp nicht an."""

    status: ClassVar[int] = 415


class Conflict(AppError):
    """Der Zustand des Objekts laesst diesen Schritt nicht zu."""

    status: ClassVar[int] = 409


def problem_response(
    status: int,
    *,
    detail: str | None = None,
    errors: Sequence[FieldError] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """Baut die problem+json-Antwort zu einem Status."""
    code = code_for(status)
    problem = Problem(
        type=f"urn:pilzkarte:fehler:{code}",
        title=title_for(status),
        status=status,
        code=code,
        detail=detail,
        errors=list(errors) if errors else None,
    )
    return JSONResponse(
        status_code=status,
        content=problem.model_dump(exclude_none=True),
        media_type=MEDIA_TYPE,
        headers=dict(headers) if headers else None,
    )


def _field_errors(raw_errors: Sequence[Mapping[str, object]]) -> list[FieldError]:
    error: list[FieldError] = []
    for entry in raw_errors:
        place = cast("Sequence[object]", entry.get("loc", ()))
        # Das erste Glied nennt nur die Quelle (body, query, path). Der Rest ist
        # der Weg zum Feld und das, was das Frontend anzeigen kann.
        field = ".".join(str(part) for part in list(place)[1:]) or str(entry.get("type", "eingabe"))
        error.append(FieldError(field=field, message=str(entry.get("msg", ""))))
    return error


async def _app_error(_: Request, exc: Exception) -> Response:
    error = cast("AppError", exc)
    return problem_response(
        type(error).status,
        detail=error.detail,
        headers=type(error).headers,
    )


async def _validation_error(_: Request, exc: Exception) -> Response:
    error = cast("RequestValidationError", exc)
    raw_errors = cast("Sequence[Mapping[str, object]]", error.errors())
    return problem_response(
        422,
        detail="Die Anfrage passt nicht zum Vertrag.",
        errors=_field_errors(raw_errors),
    )


async def _http_error(_: Request, exc: Exception) -> Response:
    error = cast("StarletteHTTPException", exc)
    return problem_response(error.status_code, detail=error.detail, headers=error.headers)


async def _unhandled(_: Request, exc: Exception) -> Response:
    # Die Ursache gehoert ins Journal, nicht in die Antwort.
    _log.exception("Unbehandelter Fehler", exc_info=exc)
    return problem_response(500, detail="Der Dienst konnte die Anfrage nicht bearbeiten.")


def register_error_handlers(app: FastAPI) -> None:
    """Haengt die Handler in die App. Danach ist jede Fehlerantwort problem+json."""
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unhandled)
