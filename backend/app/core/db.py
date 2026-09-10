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

from app.core.settings import get_settings

FILE_PREFIX: Final = "sqlite+aiosqlite:///"


def create_folder(url: str) -> None:
    """Legt den Ordner der SQLite-Datei an, falls er fehlt."""
    if not url.startswith(FILE_PREFIX):
        return
    # Ohne den Ordner scheitert schon die Migration beim ersten Start.
    Path(url.removeprefix(FILE_PREFIX)).parent.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def engine() -> AsyncEngine:
    """Liefert die Engine des Prozesses."""
    url = get_settings().db
    create_folder(url)
    return create_async_engine(url)


@lru_cache(maxsize=1)
def session_factory() -> async_sessionmaker[AsyncSession]:
    """Liefert die Sitzungsfabrik des Prozesses."""
    return async_sessionmaker(engine(), expire_on_commit=False)


async def db_session() -> AsyncGenerator[AsyncSession]:
    """Dependency: eine Sitzung je Anfrage."""
    async with session_factory()() as open_ring:
        yield open_ring
