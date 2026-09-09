"""Die FastAPI-App. Der Dienst startet sie als ``uvicorn app.main:app``."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import motor
from app.core.errors import fehlerbehandlung_registrieren
from app.core.settings import einstellungen
from app.core.version import VERSION
from app.modules import arten, basis


@asynccontextmanager
async def lebenszyklus(_: FastAPI) -> AsyncGenerator[None]:
    """Gibt die Verbindungen frei, wenn der Dienst endet."""
    yield
    await motor().dispose()


def app_bauen() -> FastAPI:
    """Baut die App: Router, Fehlerbehandlung, CORS."""
    werte = einstellungen()
    gebaut = FastAPI(
        title="Pilzkarte",
        version=VERSION,
        lifespan=lebenszyklus,
    )
    # In der Entwicklung laeuft das Frontend auf einem eigenen Ursprung. Im
    # Betrieb liegt beides hinter derselben Domain, dann greift die Regel nicht.
    gebaut.add_middleware(
        CORSMiddleware,
        allow_origins=[werte.origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    gebaut.include_router(basis.router, prefix="/api")
    gebaut.include_router(arten.router, prefix="/api")
    fehlerbehandlung_registrieren(gebaut)
    return gebaut


app = app_bauen()
