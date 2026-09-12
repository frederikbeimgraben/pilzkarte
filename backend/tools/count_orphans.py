"""Zaehlt die Zeilen, deren Konto es in ``nutzer`` nicht gibt.

Der Fremdschluessel aus R4a greift erst, wenn jede dieser Spalten auf eine
Zeile in ``nutzer`` zeigt. Dieses Werkzeug sagt vorher, ob das so ist, ohne
etwas zu aendern: es liest, es schreibt nie.

Aufruf gegen die Datenbank des Dienstes::

    uv run python -m tools.count_orphans /var/lib/pilze-app/pilze.sqlite

Ohne Pfad nimmt es die Datei aus ``PILZE_DB``.
"""

import sqlite3
import sys
from pathlib import Path
from typing import Final

from app.core.settings import get_settings
from app.models import PERSON_KEYS

FILE_PREFIX: Final = "sqlite+aiosqlite:///"


def database_path(argument: str | None) -> Path:
    """Der Pfad zur Datei: das Argument, sonst die Einstellung des Dienstes."""
    if argument is not None:
        return Path(argument)
    url = get_settings().db
    if not url.startswith(FILE_PREFIX):
        raise SystemExit(f"Keine SQLite-Datei: {url}")
    return Path(url.removeprefix(FILE_PREFIX))


def orphans(connection: sqlite3.Connection, table: str, column: str) -> int:
    """Zaehlt in einer Spalte. Leere Werte zaehlen nicht: sie zeigen auf niemanden."""
    query = (
        f"SELECT count(*) FROM {table} t"  # noqa: S608 - Namen stehen in PERSON_KEYS
        f" WHERE t.{column} IS NOT NULL"
        f" AND NOT EXISTS (SELECT 1 FROM nutzer p WHERE p.sub = t.{column})"
    )
    return int(connection.execute(query).fetchone()[0])


def report(path: Path) -> int:
    """Schreibt eine Zeile je Spalte und gibt die Zahl der Waisen zurueck."""
    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
        counts = {
            f"{table}.{column}": orphans(connection, table, column)
            for table, column, _rule in PERSON_KEYS
        }
        people = int(connection.execute("SELECT count(*) FROM nutzer").fetchone()[0])
    print(f"nutzer: {people} Konten")
    for place, count in counts.items():
        print(f"{place}: {count} ohne Konto")
    return sum(counts.values())


def main() -> None:
    """Zaehlt und endet mit 1, wenn eine Waise im Weg steht."""
    total = report(database_path(sys.argv[1] if len(sys.argv) > 1 else None))
    if total > 0:
        print(f"\n{total} Zeilen ohne Konto. Der Fremdschluessel greift erst, wenn sie weg sind.")
        raise SystemExit(1)
    print("\nKeine Waisen. Der Fremdschluessel kann gesetzt werden.")


if __name__ == "__main__":
    main()
