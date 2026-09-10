"""Funde fuer das Training freigeben.

Revision ID: f1c6b30d9e57
Revises: e5b8c1f70a34
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1c6b30d9e57"
down_revision: str | None = "e5b8c1f70a34"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABELLE = "fund"
SPALTE = "fuer_training"


def _spalten(name: str) -> set[str]:
    return {spalte["name"] for spalte in sa.inspect(op.get_bind()).get_columns(name)}


def upgrade() -> None:
    """Haengt die Spalte an, falls sie fehlt.

    SQLite kennt kein ``ADD COLUMN IF NOT EXISTS``. Auf einer leeren Datenbank
    hat die Baseline die Spalte schon aus den Modellen gebaut, darum fragt
    dieser Schritt zuerst nach.
    """
    if SPALTE in _spalten(TABELLE):
        return
    with op.batch_alter_table(TABELLE) as stapel:
        stapel.add_column(
            # Die bestehenden Funde hat niemand freigegeben. Ohne Vorgabe
            # bliebe die Spalte fuer sie leer und die Bedingung waere NULL.
            sa.Column(SPALTE, sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    """Nimmt die Spalte wieder weg."""
    if SPALTE not in _spalten(TABELLE):
        return
    with op.batch_alter_table(TABELLE) as stapel:
        stapel.drop_column(SPALTE)
