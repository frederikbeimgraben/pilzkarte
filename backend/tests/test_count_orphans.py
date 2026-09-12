"""Das Werkzeug, das die Waisen vor der Wanderung zaehlt.

Es liest nur. Gegen die Datenbank des Dienstes laeuft es, bevor R4a dort
ankommt, und sagt, ob der Fremdschluessel greifen kann.
"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from app.core.settings import get_settings
from tools import count_orphans
from tools.count_orphans import database_path, orphans, report


def a_database(tmp_path: Path) -> Path:
    """Eine Datei mit ``nutzer`` und ``fund``, so weit das Zaehlen sie braucht."""
    file = tmp_path / "bestand.sqlite"
    with closing(sqlite3.connect(file)) as connection:
        connection.executescript(
            "CREATE TABLE nutzer (sub VARCHAR(255) PRIMARY KEY);"
            "CREATE TABLE fund (id VARCHAR(36) PRIMARY KEY, besitzer_sub VARCHAR(255));"
            "CREATE TABLE marker (id VARCHAR(36) PRIMARY KEY, besitzer_sub VARCHAR(255));"
            "CREATE TABLE zone (id VARCHAR(36) PRIMARY KEY, besitzer_sub VARCHAR(255));"
            "CREATE TABLE kombination (id VARCHAR(36) PRIMARY KEY, besitzer_sub VARCHAR(255));"
            "CREATE TABLE species_image (id VARCHAR(36) PRIMARY KEY,"
            " uploader_sub VARCHAR(255), reviewed_by VARCHAR(255));"
            "CREATE TABLE text (key VARCHAR(80) PRIMARY KEY, updated_by VARCHAR(255));"
            "CREATE TABLE user_role (user_sub VARCHAR(255) PRIMARY KEY);"
        )
        connection.commit()
    return file


def write(file: Path, statement: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(statement)
        connection.commit()


def test_a_row_whose_account_exists_is_no_orphan(tmp_path: Path) -> None:
    file = a_database(tmp_path)
    write(file, "INSERT INTO nutzer VALUES ('nutzer-1')")
    write(file, "INSERT INTO fund VALUES ('f1', 'nutzer-1')")

    with closing(sqlite3.connect(file)) as connection:
        assert orphans(connection, "fund", "besitzer_sub") == 0


def test_a_row_without_its_account_counts(tmp_path: Path) -> None:
    file = a_database(tmp_path)
    write(file, "INSERT INTO fund VALUES ('f1', 'niemand')")

    with closing(sqlite3.connect(file)) as connection:
        assert orphans(connection, "fund", "besitzer_sub") == 1


def test_an_empty_value_points_at_nobody_and_counts_nothing(tmp_path: Path) -> None:
    # ``reviewed_by`` bleibt leer, solange niemand geprueft hat. Leer ist kein
    # Verweis ins Leere, und der Fremdschluessel laesst es durch.
    file = a_database(tmp_path)
    write(file, "INSERT INTO species_image VALUES ('b1', 'niemand', NULL)")

    with closing(sqlite3.connect(file)) as connection:
        assert orphans(connection, "species_image", "reviewed_by") == 0
        assert orphans(connection, "species_image", "uploader_sub") == 1


def test_the_report_names_every_column_and_counts_them(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    file = a_database(tmp_path)
    write(file, "INSERT INTO nutzer VALUES ('nutzer-1')")
    write(file, "INSERT INTO fund VALUES ('f1', 'niemand')")
    write(file, "INSERT INTO zone VALUES ('z1', 'nutzer-1')")

    total = report(file)
    printed = capsys.readouterr().out

    assert total == 1
    assert "nutzer: 1 Konten" in printed
    assert "fund.besitzer_sub: 1 ohne Konto" in printed
    assert "zone.besitzer_sub: 0 ohne Konto" in printed


def test_a_clean_database_ends_without_a_complaint(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    file = a_database(tmp_path)
    monkeypatch.setattr("sys.argv", ["count_orphans", str(file)])

    count_orphans.main()

    assert "Keine Waisen" in capsys.readouterr().out


def test_an_orphan_ends_with_a_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    # Der Rueckgabewert traegt die Antwort: so laesst sich das Werkzeug vor
    # einem Deploy in ein Skript haengen.
    file = a_database(tmp_path)
    write(file, "INSERT INTO fund VALUES ('f1', 'niemand')")
    monkeypatch.setattr("sys.argv", ["count_orphans", str(file)])

    with pytest.raises(SystemExit) as ended:
        count_orphans.main()

    assert ended.value.code == 1
    assert "1 Zeilen ohne Konto" in capsys.readouterr().out


def test_without_an_argument_it_takes_the_database_of_the_service(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "dienst.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()

    assert database_path(None) == file


def test_a_database_that_is_no_file_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    # Gegen Postgres zaehlt dieses Werkzeug nicht. Dann soll es das sagen.
    monkeypatch.setenv("PILZE_DB", "postgresql+asyncpg://irgendwo/pilze")
    get_settings.cache_clear()

    with pytest.raises(SystemExit):
        database_path(None)


def test_an_argument_wins_over_the_setting(tmp_path: Path) -> None:
    assert database_path(str(tmp_path / "andere.sqlite")) == tmp_path / "andere.sqlite"
