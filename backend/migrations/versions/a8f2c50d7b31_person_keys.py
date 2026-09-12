"""Die acht Verweise auf ein Konto bekommen ihren Fremdschluessel.

Revision ID: a8f2c50d7b31
Revises: e7c3b58a10d2
"""

from collections.abc import Sequence
from typing import Final

import sqlalchemy as sa
from alembic import op

from app.models import PERSON_KEYS, person_key

revision: str = "a8f2c50d7b31"
down_revision: str | None = "e7c3b58a10d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERSON: Final = "nutzer"

# Tabelle, Spalte und Loeschregel kommen aus den Modellen, damit Schema und
# Migration nicht auseinanderlaufen. Die Begruendung je Gruppe steht dort.
KEYS: Final = PERSON_KEYS


def _has_key(table: str, name: str) -> bool:
    """Sagt, ob die Tabelle diese Bedingung schon traegt.

    Eine frische Datenbank baut die Baseline aus den Modellen, und dort steht
    der Schluessel bereits. Nur eine gewachsene Datenbank braucht diesen Schritt.
    """
    keys = sa.inspect(op.get_bind()).get_foreign_keys(table)
    return any(key["name"] == name for key in keys)


def _orphans(table: str, column: str) -> int:
    """Zaehlt die Zeilen, deren Konto es nicht gibt. Leere Werte zaehlen nicht."""
    query = sa.text(
        f"SELECT count(*) FROM {table} t"  # noqa: S608 - Tabelle und Spalte stehen in KEYS
        f" WHERE t.{column} IS NOT NULL"
        f" AND NOT EXISTS (SELECT 1 FROM {PERSON} p WHERE p.sub = t.{column})"
    )
    return int(op.get_bind().scalar(query) or 0)


def upgrade() -> None:
    """Prueft den Bestand und haengt dann die acht Bedingungen an.

    Erst zaehlen, dann bauen: eine Bedingung, die an einer Waise scheitert,
    bricht mitten in der Migration ab und sagt nur, welche Zeile es war. Die
    Zaehlung sagt vorher, wie viele es sind und wo sie stehen.
    """
    found = {
        f"{table}.{column}": _orphans(table, column)
        for table, column, _rule in KEYS
        if not _has_key(table, person_key(table, column))
    }
    broken = {place: count for place, count in found.items() if count > 0}
    if broken:
        places = ", ".join(f"{place}: {count}" for place, count in sorted(broken.items()))
        raise RuntimeError(
            "Es gibt Zeilen ohne Konto in nutzer. Erst muessen sie ein Konto"
            f" bekommen oder weg, dann greift der Fremdschluessel. Gefunden: {places}."
        )
    for table, column, rule in KEYS:
        name = person_key(table, column)
        if _has_key(table, name):
            continue
        # SQLite kennt kein ``ADD CONSTRAINT``. Alembic baut die Tabelle darum
        # neu und kopiert sie um; ohne ``batch`` liefe der Schritt ins Leere.
        with op.batch_alter_table(table) as batch:
            batch.create_foreign_key(name, PERSON, [column], ["sub"], ondelete=rule)


def downgrade() -> None:
    """Nimmt die acht Bedingungen wieder weg."""
    for table, column, _rule in KEYS:
        name = person_key(table, column)
        if not _has_key(table, name):
            continue
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(name, type_="foreignkey")
