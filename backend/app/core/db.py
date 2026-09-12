"""Zugang zur SQLite-Datenbank."""

from collections.abc import AsyncGenerator
from functools import lru_cache
from pathlib import Path
from typing import Final

from sqlalchemy import event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.settings import get_settings

FILE_PREFIX: Final = "sqlite+aiosqlite:///"


def create_folder(url: str) -> None:
    """Legt den Ordner der SQLite-Datei an, falls er fehlt."""
    if not url.startswith(FILE_PREFIX):
        return
    # Ohne den Ordner scheitert schon die Migration beim ersten Start.
    Path(url.removeprefix(FILE_PREFIX)).parent.mkdir(parents=True, exist_ok=True)


def enforce_keys(engine: AsyncEngine) -> None:
    """Schaltet die Fremdschluessel ein.

    SQLite kennt sie, prueft sie aber nur, wenn eine Verbindung es verlangt,
    und die Vorgabe ist aus. Ohne diese Zeile stuende die Zugehoerigkeit zwar
    im Schema, hielte aber nichts: ein Fund koennte auf ein Konto zeigen, das
    es nicht gibt. Die Pragma gilt je Verbindung, darum haengt sie am Ereignis.
    """

    def switch_on(connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    event.listen(engine.sync_engine, "connect", switch_on)


def build_engine() -> AsyncEngine:
    """Baut eine Engine auf die Datei aus ``PILZE_DB`` und legt ihren Ordner an."""
    url = get_settings().db
    create_folder(url)
    return create_async_engine(url)


@lru_cache(maxsize=1)
def engine() -> AsyncEngine:
    """Liefert die Engine des Prozesses. Sie prueft die Fremdschluessel."""
    made = build_engine()
    enforce_keys(made)
    return made


def migration_engine() -> AsyncEngine:
    """Eine Engine ohne Pruefung der Fremdschluessel, fuer Alembic.

    SQLite kennt kein ``ADD CONSTRAINT``. Alembic baut eine Tabelle darum um,
    indem es sie neu anlegt, umkopiert und die alte loescht. Faellt dieses
    Loeschen bei eingeschalteter Pruefung an, raeumt SQLite jedes Kind mit
    ``ON DELETE CASCADE`` gleich mit ab: der Umbau von ``fund`` naehme jedes
    Foto mit. Waehrend der Wanderung bleibt die Pruefung darum aus. Was sie
    sonst verhindert, zaehlt die Wanderung selbst, bevor sie den Schluessel
    setzt.
    """
    return build_engine()


@lru_cache(maxsize=1)
def session_factory() -> async_sessionmaker[AsyncSession]:
    """Liefert die Sitzungsfabrik des Prozesses."""
    return async_sessionmaker(engine(), expire_on_commit=False)


async def db_session() -> AsyncGenerator[AsyncSession]:
    """Dependency: eine Sitzung je Anfrage."""
    async with session_factory()() as open_ring:
        yield open_ring
