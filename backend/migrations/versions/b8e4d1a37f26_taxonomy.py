"""Die Einordnung der Arten und ihr Anfangsbestand.

Revision ID: b8e4d1a37f26
Revises: e7c3b58a10d2
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base, new_identifier
from app.modules.taxonomy.seed import seed_taxa

revision: str = "b8e4d1a37f26"
down_revision: str | None = "e7c3b58a10d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "taxon"


def upgrade() -> None:
    """Legt die Tabelle an und schreibt die Vorgabe aus ``daten/taxonomie.json``.

    Der Start gleicht denselben Bestand noch einmal ab. Die Migration nimmt ihn
    vorweg, damit eine frisch hochgezogene Datenbank vollständig ist, bevor der
    Dienst zum ersten Mal läuft.
    """
    connection = op.get_bind()
    table = Base.metadata.tables[TABLE]
    connection.execute(CreateTable(table, if_not_exists=True))
    for index in table.indexes:
        connection.execute(CreateIndex(index, if_not_exists=True))

    known: dict[str, str] = {
        str(row[0]): str(row[1])
        for row in connection.execute(sa.select(table.c.slug, table.c.id)).all()
    }
    rows: list[dict[str, str | None]] = []
    for seed in seed_taxa():
        if seed.slug in known:
            continue
        known[seed.slug] = new_identifier()
        rows.append(
            {
                "id": known[seed.slug],
                "rank": seed.rank.value,
                "slug": seed.slug,
                "name": seed.name,
                "latin_name": seed.latin_name,
                "parent_id": known[seed.parent] if seed.parent else None,
                "description": None,
            }
        )
    if rows:
        connection.execute(sa.insert(table), rows)


def downgrade() -> None:
    """Räumt die Tabelle wieder ab."""
    op.get_bind().execute(DropTable(Base.metadata.tables[TABLE], if_exists=True))
