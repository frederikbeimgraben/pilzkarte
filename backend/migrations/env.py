"""Alembic gegen die async-Engine der App."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

from app.core.db import engine
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _migrate(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite kennt kein ALTER fuer Spalten. Ohne Batch scheitert jede
        # spaetere Aenderung an einer bestehenden Tabelle.
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def online() -> None:
    """Fuehrt die Migrationen gegen die Datenbank aus PILZE_DB aus."""
    engine_of_process = engine()
    async with engine_of_process.connect() as connection:
        await connection.run_sync(_migrate)
        await connection.commit()
    await engine_of_process.dispose()


def offline() -> None:
    """Schreibt die Migrationen als SQL, ohne Datenbank."""
    context.configure(
        url=str(engine().url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    offline()
else:
    asyncio.run(online())
