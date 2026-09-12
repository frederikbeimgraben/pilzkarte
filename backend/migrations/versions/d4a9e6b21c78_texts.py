"""Die Texte der Oberfläche und ihr Anfangsbestand.

Revision ID: d4a9e6b21c78
Revises: a4d8e2b91c67
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base
from app.modules.texts.seed import seed_catalogue

revision: str = "d4a9e6b21c78"
down_revision: str | None = "a4d8e2b91c67"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "text"


def upgrade() -> None:
    """Legt die Tabelle an und schreibt die Vorgabe aus ``daten/texte.json``.

    Der Start gleicht denselben Bestand noch einmal ab. Die Migration nimmt ihn
    trotzdem vorweg, damit eine frisch hochgezogene Datenbank vollständig ist,
    bevor der Dienst zum ersten Mal läuft.
    """
    connection = op.get_bind()
    table = Base.metadata.tables[TABLE]
    connection.execute(CreateTable(table, if_not_exists=True))
    for index in table.indexes:
        connection.execute(CreateIndex(index, if_not_exists=True))

    now = datetime.now(UTC)
    taken = set(connection.execute(sa.select(table.c.key, table.c.locale)))
    rows = [
        {"key": key, "locale": locale.value, "value": value, "updated_at": now}
        for locale, texts in seed_catalogue().items()
        for key, value in texts.items()
        if (key, locale.value) not in taken
    ]
    if rows:
        connection.execute(sa.insert(table), rows)


def downgrade() -> None:
    """Räumt die Tabelle wieder ab."""
    op.get_bind().execute(DropTable(Base.metadata.tables[TABLE], if_exists=True))
