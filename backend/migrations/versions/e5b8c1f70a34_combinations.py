"""Gespeicherte Kombinationen.

Revision ID: e5b8c1f70a34
Revises: c7d2e4a81f95
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base

revision: str = "e5b8c1f70a34"
down_revision: str | None = "c7d2e4a81f95"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES: tuple[str, ...] = ("kombination",)


def upgrade() -> None:
    """Legt die Tabelle an, falls sie fehlt."""
    connection = op.get_bind()
    for name in TABLES:
        table = Base.metadata.tables[name]
        connection.execute(CreateTable(table, if_not_exists=True))
        for index in table.indexes:
            connection.execute(CreateIndex(index, if_not_exists=True))


def downgrade() -> None:
    """Raeumt die Tabelle wieder ab."""
    connection = op.get_bind()
    for name in reversed(TABLES):
        connection.execute(DropTable(Base.metadata.tables[name], if_exists=True))
