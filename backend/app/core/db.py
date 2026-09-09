"""Zugang zur SQLite-Datenbank."""

from collections.abc import AsyncGenerator
from functools import lru_cache
from pathlib import Path
from typing import Final

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.settings import einstellungen

DATEI_PRAEFIX: Final = "sqlite+aiosqlite:///"


def ordner_anlegen(url: str) -> None:
    """Legt den Ordner der SQLite-Datei an, falls er fehlt."""
    if not url.startswith(DATEI_PRAEFIX):
        return
    # Ohne den Ordner scheitert schon die Migration beim ersten Start.
    Path(url.removeprefix(DATEI_PRAEFIX)).parent.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def motor() -> AsyncEngine:
    """Liefert die Engine des Prozesses."""
    url = einstellungen().db
    ordner_anlegen(url)
    return create_async_engine(url)


@lru_cache(maxsize=1)
def sitzungsfabrik() -> async_sessionmaker[AsyncSession]:
    """Liefert die Sitzungsfabrik des Prozesses."""
    return async_sessionmaker(motor(), expire_on_commit=False)


async def sitzung() -> AsyncGenerator[AsyncSession]:
    """Dependency: eine Sitzung je Anfrage."""
    async with sitzungsfabrik()() as offen:
        yield offen
