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

MEDIENTYP: Final = "application/problem+json"

TITEL: Final[Mapping[int, str]] = {
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


class Feldfehler(BaseModel):
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
    errors: list[Feldfehler] | None = None


def code_fuer(status: int) -> str:
    """Liefert den stabilen Fehlercode zu einem Status."""
    return CODE.get(status, "error")


def titel_fuer(status: int) -> str:
    """Liefert den lesbaren Titel zu einem Status."""
    return TITEL.get(status, "Fehler")


class AppFehler(Exception):
    """Ein Fehler, den die App selbst wirft."""

    status: ClassVar[int] = 500
    kopfzeilen: ClassVar[Mapping[str, str]] = {}

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail
        super().__init__(detail or titel_fuer(type(self).status))


class AnmeldungFehlt(AppFehler):
    """Das Token fehlt, ist abgelaufen oder traegt nicht."""

    status: ClassVar[int] = 401
    # Ohne diese Kopfzeile weiss ein Client nicht, welches Verfahren er braucht.
    kopfzeilen: ClassVar[Mapping[str, str]] = {"WWW-Authenticate": "Bearer"}


def problem_antwort(
    status: int,
    *,
    detail: str | None = None,
    errors: Sequence[Feldfehler] | None = None,
    kopfzeilen: Mapping[str, str] | None = None,
) -> JSONResponse:
    """Baut die problem+json-Antwort zu einem Status."""
    code = code_fuer(status)
    problem = Problem(
        type=f"urn:pilzkarte:fehler:{code}",
        title=titel_fuer(status),
        status=status,
        code=code,
        detail=detail,
        errors=list(errors) if errors else None,
    )
    return JSONResponse(
        status_code=status,
        content=problem.model_dump(exclude_none=True),
        media_type=MEDIENTYP,
        headers=dict(kopfzeilen) if kopfzeilen else None,
    )


def _feldfehler(rohe: Sequence[Mapping[str, object]]) -> list[Feldfehler]:
    fehler: list[Feldfehler] = []
    for eintrag in rohe:
        ort = cast("Sequence[object]", eintrag.get("loc", ()))
        # Das erste Glied nennt nur die Quelle (body, query, path). Der Rest ist
        # der Weg zum Feld und das, was das Frontend anzeigen kann.
        feld = ".".join(str(teil) for teil in list(ort)[1:]) or str(eintrag.get("type", "eingabe"))
        fehler.append(Feldfehler(field=feld, message=str(eintrag.get("msg", ""))))
    return fehler


async def _app_fehler(_: Request, exc: Exception) -> Response:
    fehler = cast("AppFehler", exc)
    return problem_antwort(
        type(fehler).status,
        detail=fehler.detail,
        kopfzeilen=type(fehler).kopfzeilen,
    )


async def _validierungsfehler(_: Request, exc: Exception) -> Response:
    fehler = cast("RequestValidationError", exc)
    rohe = cast("Sequence[Mapping[str, object]]", fehler.errors())
    return problem_antwort(
        422,
        detail="Die Anfrage passt nicht zum Vertrag.",
        errors=_feldfehler(rohe),
    )


async def _http_fehler(_: Request, exc: Exception) -> Response:
    fehler = cast("StarletteHTTPException", exc)
    return problem_antwort(fehler.status_code, detail=fehler.detail, kopfzeilen=fehler.headers)


async def _unbehandelt(_: Request, exc: Exception) -> Response:
    # Die Ursache gehoert ins Journal, nicht in die Antwort.
    _log.exception("Unbehandelter Fehler", exc_info=exc)
    return problem_antwort(500, detail="Der Dienst konnte die Anfrage nicht bearbeiten.")


def fehlerbehandlung_registrieren(app: FastAPI) -> None:
    """Haengt die Handler in die App. Danach ist jede Fehlerantwort problem+json."""
    app.add_exception_handler(AppFehler, _app_fehler)
    app.add_exception_handler(RequestValidationError, _validierungsfehler)
    app.add_exception_handler(StarletteHTTPException, _http_fehler)
    app.add_exception_handler(Exception, _unbehandelt)
