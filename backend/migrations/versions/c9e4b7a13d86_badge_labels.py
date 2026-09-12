"""Plaketten sind Beschriftungen, keine Saetze.

Revision ID: c9e4b7a13d86
Revises: a8f2c50d7b31
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Final

import sqlalchemy as sa
from alembic import op

from app.models import Base

revision: str = "c9e4b7a13d86"
down_revision: str | None = "a8f2c50d7b31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE: Final = "text"

# Schluessel, Sprache, alter Wert, neuer Wert.
#
# Der alte Wert steht mit dabei, weil nur er sagt, ob die Zeile noch die
# Vorgabe traegt. Wer den Text in der Oberflaeche geaendert hat, behaelt seine
# Fassung: eine Wanderung, die eine Aenderung ueberschreibt, nimmt jemandem die
# Arbeit weg.
CHANGES: Final[tuple[tuple[str, str, str, str], ...]] = (
    ("art.schutz.besonders", "de", "für den Eigenbedarf", "Eigenbedarf"),
    ("art.schutz.besonders", "en", "for personal use", "personal use"),
    ("art.handel.ja", "de", "auf der Positivliste", "DGfM-Positivliste"),
    ("art.handel.ja", "en", "on the positive list", "DGfM positive list"),
    ("art.handel.nein", "de", "nicht im Handel", "nicht gelistet"),
    ("art.handel.nein", "en", "not traded", "not listed"),
    ("art.handel.schweiz", "de", "in der Schweiz zugelassen", "Schweizer Markt"),
    ("art.handel.schweiz", "en", "allowed in Switzerland", "Swiss market"),
    ("art.essbar.essbar", "de", "Essbar", "essbar"),
    ("art.essbar.essbar", "en", "Edible", "edible"),
    ("art.essbar.bedingtEssbar", "de", "Bedingt essbar", "bedingt essbar"),
    ("art.essbar.bedingtEssbar", "en", "Edible when cooked", "edible when cooked"),
    ("art.essbar.ungeniessbar", "de", "Ungenießbar", "ungenießbar"),
    ("art.essbar.ungeniessbar", "en", "Inedible", "inedible"),
    ("art.essbar.giftig", "de", "Giftig", "giftig"),
    ("art.essbar.giftig", "en", "Poisonous", "poisonous"),
    ("art.essbar.toedlichGiftig", "de", "Tödlich giftig", "tödlich giftig"),
    ("art.essbar.toedlichGiftig", "en", "Deadly poisonous", "deadly poisonous"),
)


def _move(pairs: tuple[tuple[str, str, str, str], ...]) -> None:
    """Setzt jede Zeile um, die noch den alten Wert traegt."""
    # ``sync_texts`` legt beim Start nur fehlende Schluessel an und raeumt
    # unbekannte ab. Einen vorhandenen Wert fasst es nie an, und ohne diese
    # Wanderung stuende auf einem gewachsenen Bestand ewig der alte Text.
    #
    # Ueber die Tabelle aus den Modellen und nicht ueber rohes SQL: nur so
    # legt die Spalte ``updated_at`` ihren Zeitpunkt selbst ab. Roh gebunden
    # ginge er durch den veralteten Adapter von sqlite3.
    table = Base.metadata.tables[TABLE]
    now = datetime.now(UTC)
    connection = op.get_bind()
    for key, locale, old, new in pairs:
        connection.execute(
            sa.update(table)
            .where(table.c.key == key, table.c.locale == locale, table.c.value == old)
            .values(value=new, updated_at=now)
        )


def upgrade() -> None:
    """Zieht die Beschriftungen nach."""
    _move(CHANGES)


def downgrade() -> None:
    """Setzt sie zurueck."""
    _move(tuple((key, locale, new, old) for key, locale, old, new in CHANGES))
