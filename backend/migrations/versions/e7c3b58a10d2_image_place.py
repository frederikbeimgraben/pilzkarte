"""Der grobe Ort an einem Artbild.

Revision ID: e7c3b58a10d2
Revises: d4a9e2b71c58
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7c3b58a10d2"
down_revision: str | None = "d4a9e2b71c58"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "species_image"
COLUMNS: tuple[str, ...] = ("lat", "lon")


def _columns(name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(name)}


def upgrade() -> None:
    """Haengt die beiden Spalten an, falls sie fehlen.

    SQLite kennt kein ``ADD COLUMN IF NOT EXISTS``. Auf einer leeren Datenbank
    hat die Baseline sie schon aus den Modellen gebaut, darum fragt dieser
    Schritt zuerst nach.
    """
    present = _columns(TABLE)
    for column in COLUMNS:
        if column not in present:
            with op.batch_alter_table(TABLE) as batch:
                # Die bestehenden Bilder tragen keinen Ort. Die Spalte bleibt
                # fuer sie leer; einen Ort nachzureichen waere geraten.
                batch.add_column(sa.Column(column, sa.Float(), nullable=True))


def downgrade() -> None:
    """Nimmt die beiden Spalten wieder weg."""
    present = _columns(TABLE)
    for column in COLUMNS:
        if column in present:
            with op.batch_alter_table(TABLE) as batch:
                batch.drop_column(column)
