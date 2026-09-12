"""Bilder zu Arten.

Revision ID: d4a9e2b71c58
Revises: d4a9e6b21c78
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base

revision: str = "d4a9e2b71c58"
down_revision: str | None = "d4a9e6b21c78"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "species_image"


def upgrade() -> None:
    """Legt die Tabelle samt ihren Indizes an."""
    connection = op.get_bind()
    table = Base.metadata.tables[TABLE]
    connection.execute(CreateTable(table, if_not_exists=True))
    for index in table.indexes:
        connection.execute(CreateIndex(index, if_not_exists=True))


def downgrade() -> None:
    """Raeumt die Tabelle wieder ab. Die Dateien auf der Platte bleiben liegen."""
    op.get_bind().execute(DropTable(Base.metadata.tables[TABLE], if_exists=True))
