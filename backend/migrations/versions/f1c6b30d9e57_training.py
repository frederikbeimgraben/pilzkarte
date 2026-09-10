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

TABLE = "fund"
COLUMN = "fuer_training"


def _columns(name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(name)}


def upgrade() -> None:
    """Haengt die Spalte an, falls sie fehlt.

    SQLite kennt kein ``ADD COLUMN IF NOT EXISTS``. Auf einer leeren Datenbank
    hat die Baseline die Spalte schon aus den Modellen gebaut, darum fragt
    dieser Schritt zuerst nach.
    """
    if COLUMN in _columns(TABLE):
        return
    with op.batch_alter_table(TABLE) as batch:
        batch.add_column(
            # Die bestehenden Funde hat niemand freigegeben. Ohne Vorgabe
            # bliebe die Spalte fuer sie leer und die Bedingung waere NULL.
            sa.Column(COLUMN, sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    """Nimmt die Spalte wieder weg."""
    if COLUMN not in _columns(TABLE):
        return
    with op.batch_alter_table(TABLE) as batch:
        batch.drop_column(COLUMN)
