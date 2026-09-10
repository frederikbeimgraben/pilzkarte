"""Die Migrationskette. Der Dienst faehrt sie bei jedem Start hoch."""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core import db
from app.core.settings import einstellungen

WURZEL = Path(__file__).resolve().parents[1]


def konfiguration() -> Config:
    """Liest die alembic.ini, so wie der Dienst sie im Arbeitsverzeichnis liest."""
    return Config(WURZEL / "alembic.ini")


def tabellen(datei: Path) -> set[str]:
    frage = "SELECT name FROM sqlite_master WHERE type='table'"
    with closing(sqlite3.connect(datei)) as verbindung:
        return {name for (name,) in verbindung.execute(frage)}


def test_es_gibt_genau_einen_head() -> None:
    skripte = ScriptDirectory.from_config(konfiguration())

    assert len(skripte.get_heads()) == 1


def test_upgrade_legt_das_schema_auf_leerer_datei_an(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    datei = tmp_path / "leer.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{datei}")
    einstellungen.cache_clear()
    db.motor.cache_clear()

    command.upgrade(konfiguration(), "head")

    erwartet = {"nutzer", "fund", "foto", "marker", "zone", "kombination"}

    assert erwartet | {"alembic_version"} <= tabellen(datei)


def test_upgrade_laeuft_auch_auf_einer_bestehenden_datenbank(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    datei = tmp_path / "zweimal.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{datei}")
    einstellungen.cache_clear()
    db.motor.cache_clear()

    # Die Baseline legt die Tabellen mit IF NOT EXISTS an. Ein zweiter Lauf nach
    # einem Downgrade darf darum nicht scheitern.
    command.upgrade(konfiguration(), "head")
    db.motor.cache_clear()
    command.downgrade(konfiguration(), "base")
    db.motor.cache_clear()
    command.upgrade(konfiguration(), "head")

    assert {"nutzer", "fund", "foto", "marker", "zone", "kombination"} <= tabellen(datei)
