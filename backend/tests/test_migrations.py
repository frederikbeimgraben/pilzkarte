"""Die Migrationskette. Der Dienst faehrt sie bei jedem Start hoch."""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core import db
from app.core.settings import get_settings

ROOT = Path(__file__).resolve().parents[1]


def configuration() -> Config:
    """Liest die alembic.ini, so wie der Dienst sie im Arbeitsverzeichnis liest."""
    return Config(ROOT / "alembic.ini")


def tables(file: Path) -> set[str]:
    frage = "SELECT name FROM sqlite_master WHERE type='table'"
    with closing(sqlite3.connect(file)) as connection:
        return {name for (name,) in connection.execute(frage)}


def test_there_is_exactly_one_head() -> None:
    skripte = ScriptDirectory.from_config(configuration())

    assert len(skripte.get_heads()) == 1


def test_upgrade_creates_the_schema_on_an_empty_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "leer.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")

    expected = {"nutzer", "fund", "foto", "marker", "zone", "kombination"}

    assert expected | {"alembic_version"} <= tables(file)


def test_upgrade_also_runs_on_an_existing_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "zweimal.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    # Die Baseline legt die Tabellen mit IF NOT EXISTS an. Ein zweiter Lauf nach
    # einem Downgrade darf darum nicht scheitern.
    command.upgrade(configuration(), "head")
    db.engine.cache_clear()
    command.downgrade(configuration(), "base")
    db.engine.cache_clear()
    command.upgrade(configuration(), "head")

    assert {"nutzer", "fund", "foto", "marker", "zone", "kombination"} <= tables(file)
