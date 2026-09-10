"""Grundgeruest: das Schema aus den Modellen.

Revision ID: b3f1a9c47e02
Revises:
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base

revision: str = "b3f1a9c47e02"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Legt jede Tabelle aus ``Base.metadata`` an, falls sie fehlt."""
    connection = op.get_bind()
    # Die Baseline folgt den Modellen, damit es eine Quelle des Schemas gibt.
    # ``IF NOT EXISTS`` haelt sie auf einer Datenbank gruen, die es schon gibt.
    for table in Base.metadata.sorted_tables:
        connection.execute(CreateTable(table, if_not_exists=True))
        for index in table.indexes:
            connection.execute(CreateIndex(index, if_not_exists=True))


def downgrade() -> None:
    """Raeumt das Schema wieder ab."""
    connection = op.get_bind()
    for table in reversed(Base.metadata.sorted_tables):
        connection.execute(DropTable(table, if_exists=True))
