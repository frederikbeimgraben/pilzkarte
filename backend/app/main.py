"""Die FastAPI-App. Der Dienst startet sie als ``uvicorn app.main:app``."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import engine, session_factory
from app.core.errors import register_error_handlers
from app.core.settings import get_settings
from app.core.version import VERSION
from app.modules import (
    access,
    combinations,
    finds,
    internal,
    marker,
    species,
    species_images,
    system,
    terms,
    texts,
    zones,
)
from app.modules.access.service import ensure_built_in_roles, sync_permissions
from app.modules.texts.service import sync_texts


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    """Gleicht Rechte, Rollen und Texte ab, gibt die Verbindungen frei, wenn der Dienst endet.

    Alles drei steht im Code. Der Abgleich beim Start erspart jedem neuen Recht
    und jedem neuen Textschlüssel eine eigene Migration; die Migration legt
    dasselbe an, damit eine frisch hochgezogene Datenbank auch vor dem ersten
    Start vollständig ist.
    """
    async with session_factory()() as session:
        await sync_permissions(session)
        await ensure_built_in_roles(session)
        await sync_texts(session)
    yield
    await engine().dispose()


def build_app() -> FastAPI:
    """Baut die App: Router, Fehlerbehandlung, CORS."""
    settings = get_settings()
    built = FastAPI(
        title="Pilzkarte",
        version=VERSION,
        lifespan=lifespan,
    )
    # In der Entwicklung laeuft das Frontend auf einem eigenen Ursprung. Im
    # Betrieb liegt beides hinter derselben Domain, dann greift die Regel nicht.
    built.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    built.include_router(system.router, prefix="/api")
    built.include_router(access.router, prefix="/api")
    built.include_router(species.router, prefix="/api")
    built.include_router(species_images.router, prefix="/api")
    built.include_router(terms.router, prefix="/api")
    built.include_router(texts.router, prefix="/api")
    built.include_router(finds.router, prefix="/api")
    built.include_router(internal.router, prefix="/api")
    built.include_router(combinations.router, prefix="/api")
    built.include_router(marker.router, prefix="/api")
    built.include_router(zones.router, prefix="/api")
    register_error_handlers(built)
    return built


app = build_app()
