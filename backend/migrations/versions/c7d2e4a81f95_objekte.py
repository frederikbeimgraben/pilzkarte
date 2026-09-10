"""Funde, Fotos, Marker und Zonen.

Revision ID: c7d2e4a81f95
Revises: b3f1a9c47e02
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base

revision: str = "c7d2e4a81f95"
down_revision: str | None = "b3f1a9c47e02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Die Reihenfolge folgt den Fremdschluesseln: foto haengt an fund.
TABELLEN: tuple[str, ...] = ("fund", "foto", "marker", "zone")


def upgrade() -> None:
    """Legt die vier Tabellen an, falls sie fehlen."""
    verbindung = op.get_bind()
    for name in TABELLEN:
        tabelle = Base.metadata.tables[name]
        verbindung.execute(CreateTable(tabelle, if_not_exists=True))
        for index in tabelle.indexes:
            verbindung.execute(CreateIndex(index, if_not_exists=True))


def downgrade() -> None:
    """Raeumt die vier Tabellen wieder ab."""
    verbindung = op.get_bind()
    for name in reversed(TABELLEN):
        verbindung.execute(DropTable(Base.metadata.tables[name], if_exists=True))
