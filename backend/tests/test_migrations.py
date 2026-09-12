"""Die Migrationskette. Der Dienst faehrt sie bei jedem Start hoch."""

import re
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core import db
from app.core.settings import get_settings
from app.modules.access.permissions import Permission
from app.modules.access.service import BUILT_IN_ROLES

ROOT = Path(__file__).resolve().parents[1]

# Der letzte Schritt vor den Fremdschluesseln aus R4a.
BEFORE_PERSON_KEYS = "e7c3b58a10d2"

# Der letzte Schritt vor den neuen Plakettentexten.
BEFORE_BADGE_LABELS = "a8f2c50d7b31"


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

    expected = {
        "nutzer",
        "fund",
        "foto",
        "marker",
        "zone",
        "kombination",
        "role",
        "permission",
        "role_permission",
        "user_role",
        "text",
        "species_image",
    }

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

    assert {
        "nutzer",
        "fund",
        "foto",
        "marker",
        "zone",
        "kombination",
        "role",
        "permission",
        "role_permission",
        "user_role",
        "text",
        "species_image",
    } <= tables(file)


def rows(file: Path, query: str) -> list[tuple[str, ...]]:
    """Die Zeilen einer Abfrage, jede Spalte als Zeichenkette."""
    with closing(sqlite3.connect(file)) as connection:
        return [tuple(str(value) for value in row) for row in connection.execute(query)]


def test_the_upgrade_seeds_the_catalogue_and_the_built_in_roles(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Eine frisch hochgezogene Datenbank ist vollständig, auch bevor der
    # Dienst zum ersten Mal startet.
    file = tmp_path / "gefuellt.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")

    keys = {key for (key,) in rows(file, "SELECT key FROM permission")}
    built_in = rows(file, "SELECT slug, name FROM role WHERE built_in")
    assert keys == {right.value for right in Permission}
    assert set(built_in) == {(role.slug, role.name) for role in BUILT_IN_ROLES}


def test_a_second_upgrade_seeds_nothing_twice(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "zweimal_gefuellt.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")
    db.engine.cache_clear()
    command.upgrade(configuration(), "head")

    assert len(rows(file, "SELECT slug FROM role")) == len(BUILT_IN_ROLES)
    assert len(rows(file, "SELECT key FROM permission")) == len(Permission)


# Der Verweis auf ``nutzer``, so wie SQLite ihn in der Tabellendefinition fuehrt.
PERSON_KEY = re.compile(
    r",\s*CONSTRAINT fk_\w+_nutzer FOREIGN KEY\([^)]*\)"
    r" REFERENCES nutzer \(sub\)(?: ON DELETE [A-Z ]+)?"
)

# Die Tabellen, die nach R4a auf ein Konto zeigen.
POINTING_AT_A_PERSON = (
    "fund",
    "marker",
    "zone",
    "kombination",
    "species_image",
    "text",
    "user_role",
)


def as_before_the_keys(file: Path, table: str) -> None:
    """Baut eine Tabelle ohne ihren Verweis auf ``nutzer`` nach.

    Die Baseline legt das Schema aus den Modellen an, darum traegt schon eine
    frische Datenbank den Fremdschluessel. Der Bestand im Betrieb ist aelter
    und traegt ihn nicht. Nur an diesem aelteren Stand laesst sich pruefen, was
    die Wanderung tut.
    """
    with closing(sqlite3.connect(file)) as connection:
        query = "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
        (definition,) = connection.execute(query, (table,)).fetchone()
        # Ohne ``legacy_alter_table`` zieht SQLite jeden Verweis auf diese
        # Tabelle auf den neuen Namen um. ``foto`` zeigte danach auf
        # ``fund_alt``, und die Vorrichtung baute einen Fehler nach, den es
        # nicht gibt. Alembic schaltet die Pragma aus demselben Grund.
        connection.executescript(
            "PRAGMA legacy_alter_table=ON;"  # noqa: S608 - Name aus POINTING_AT_A_PERSON
            f"ALTER TABLE {table} RENAME TO {table}_alt;"
            f"{PERSON_KEY.sub('', definition)};"
            f"INSERT INTO {table} SELECT * FROM {table}_alt;"
            f"DROP TABLE {table}_alt;"
            "PRAGMA legacy_alter_table=OFF;"
        )
        connection.commit()


def grown_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str) -> Path:
    """Eine Datenbank auf dem Stand vor R4a, so wie sie im Betrieb steht."""
    file = tmp_path / name
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(configuration(), BEFORE_PERSON_KEYS)
    for table in POINTING_AT_A_PERSON:
        as_before_the_keys(file, table)
    db.engine.cache_clear()
    return file


def add_find(file: Path, sub: str) -> None:
    """Legt einen Fund an, ohne den Weg ueber die Modelle."""
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "INSERT INTO fund (id, besitzer_sub, erstellt_am, geaendert_am, art_slug,"
            " lat, lon, datum, fuer_training, sichtbarkeit)"
            " VALUES (?, ?, '2026-09-01 00:00:00', '2026-09-01 00:00:00', 'steinpilz',"
            " 48.5, 9.2, '2026-09-01', 0, 'privat')",
            (f"fund-{sub}", sub),
        )
        connection.commit()


def add_person(file: Path, sub: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "INSERT INTO nutzer (sub, erstellt_am) VALUES (?, '2026-09-01 00:00:00')",
            (sub,),
        )
        connection.commit()


def points_at(file: Path, table: str) -> set[str]:
    """Die Tabellen, auf die eine Tabelle verweist."""
    with closing(sqlite3.connect(file)) as connection:
        return {row[2] for row in connection.execute(f"PRAGMA foreign_key_list({table})")}


def test_a_grown_database_starts_without_the_keys(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Haelt die Vorrichtung selbst fest: ohne diesen Ausgangsstand pruefen die
    # beiden Tests darunter nichts.
    file = grown_database(tmp_path, monkeypatch, "vorher.sqlite")

    assert points_at(file, "fund") == set()
    assert points_at(file, "user_role") == {"role"}
    assert points_at(file, "foto") == {"fund"}


def test_a_find_without_an_account_stops_the_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Ohne die Zaehlung braeche die Wanderung erst an der Bedingung ab und
    # nennte eine einzelne Zeile. Die Meldung soll sagen, wo und wie viele.
    file = grown_database(tmp_path, monkeypatch, "waise.sqlite")
    add_find(file, "niemand")

    with pytest.raises(RuntimeError) as stopped:
        command.upgrade(configuration(), "head")

    assert "fund.besitzer_sub: 1" in str(stopped.value)
    assert points_at(file, "fund") == set()


def test_the_upgrade_adds_the_keys_to_a_grown_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = grown_database(tmp_path, monkeypatch, "gewachsen.sqlite")
    add_person(file, "nutzer-1")
    add_find(file, "nutzer-1")

    command.upgrade(configuration(), "head")

    for table in POINTING_AT_A_PERSON:
        assert "nutzer" in points_at(file, table), table


def test_the_downgrade_takes_the_keys_away_again(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = grown_database(tmp_path, monkeypatch, "zurueck.sqlite")
    command.upgrade(configuration(), "head")
    db.engine.cache_clear()

    command.downgrade(configuration(), BEFORE_PERSON_KEYS)

    assert points_at(file, "fund") == set()
    assert points_at(file, "user_role") == {"role"}


def add_photo(file: Path, find_id: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "INSERT INTO foto (id, fund_id, dateiname, breite, hoehe, erstellt_am)"
            " VALUES ('foto-1', ?, 'bild.jpg', 1600, 1200, '2026-09-01 00:00:00')",
            (find_id,),
        )
        connection.commit()


def test_the_upgrade_keeps_the_photos_of_a_find(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Die Wanderung baut ``fund`` neu, und ``foto.fund_id`` loescht mit dem
    # Fund. Baute sie die Tabelle bei eingeschalteten Fremdschluesseln ab,
    # naehme sie die Fotos still mit. Dieser Test haelt fest, dass sie bleiben.
    file = grown_database(tmp_path, monkeypatch, "mit_foto.sqlite")
    add_person(file, "nutzer-1")
    add_find(file, "nutzer-1")
    add_photo(file, "fund-nutzer-1")

    command.upgrade(configuration(), "head")

    assert rows(file, "SELECT id FROM foto") == [("foto-1",)]
    assert points_at(file, "foto") == {"fund"}


def text_of(file: Path, key: str, locale: str) -> str | None:
    """Der Wert eines Oberflaechentextes, am Modell vorbei gelesen."""
    with closing(sqlite3.connect(file)) as connection:
        found = connection.execute(
            "SELECT value FROM text WHERE key = ? AND locale = ?", (key, locale)
        ).fetchone()
    return None if found is None else str(found[0])


def set_text(file: Path, key: str, locale: str, value: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "UPDATE text SET value = ? WHERE key = ? AND locale = ?", (value, key, locale)
        )
        connection.commit()


def before_the_labels(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str) -> Path:
    """Eine Datenbank auf dem Stand vor den neuen Plakettentexten."""
    file = tmp_path / name
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(configuration(), BEFORE_BADGE_LABELS)
    db.engine.cache_clear()
    return file


def test_the_upgrade_moves_a_label_that_still_holds_the_default(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Der Anfangsbestand der Wanderung traegt schon den neuen Text; ein
    # gewachsener Bestand traegt den alten, und ``sync_texts`` fasst einen
    # vorhandenen Wert nie an. Ohne diesen Schritt stuende dort ewig der alte.
    file = before_the_labels(tmp_path, monkeypatch, "plaketten.sqlite")
    set_text(file, "art.handel.ja", "de", "auf der Positivliste")

    command.upgrade(configuration(), "head")

    assert text_of(file, "art.handel.ja", "de") == "DGfM-Positivliste"
    assert text_of(file, "art.essbar.essbar", "de") == "essbar"


def test_the_upgrade_keeps_a_label_someone_wrote_themselves(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Wer den Text in der Oberflaeche geaendert hat, behaelt seine Fassung.
    file = before_the_labels(tmp_path, monkeypatch, "eigener-text.sqlite")
    set_text(file, "art.handel.ja", "de", "steht auf der Liste des Vereins")

    command.upgrade(configuration(), "head")

    assert text_of(file, "art.handel.ja", "de") == "steht auf der Liste des Vereins"


def test_the_downgrade_puts_the_old_labels_back(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = before_the_labels(tmp_path, monkeypatch, "zurueck-plaketten.sqlite")
    command.upgrade(configuration(), "head")
    db.engine.cache_clear()

    command.downgrade(configuration(), BEFORE_BADGE_LABELS)

    assert text_of(file, "art.handel.ja", "de") == "auf der Positivliste"
