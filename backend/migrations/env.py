"""Alembic gegen die async-Engine der App."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

from app.core.db import motor
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

ziel_metadaten = Base.metadata


def _migrieren(verbindung: Connection) -> None:
    context.configure(
        connection=verbindung,
        target_metadata=ziel_metadaten,
        # SQLite kennt kein ALTER fuer Spalten. Ohne Batch scheitert jede
        # spaetere Aenderung an einer bestehenden Tabelle.
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def online() -> None:
    """Fuehrt die Migrationen gegen die Datenbank aus PILZE_DB aus."""
    maschine = motor()
    async with maschine.connect() as verbindung:
        await verbindung.run_sync(_migrieren)
        await verbindung.commit()
    await maschine.dispose()


def offline() -> None:
    """Schreibt die Migrationen als SQL, ohne Datenbank."""
    context.configure(
        url=str(motor().url),
        target_metadata=ziel_metadaten,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    offline()
else:
    asyncio.run(online())
