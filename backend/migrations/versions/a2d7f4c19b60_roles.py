"""Rollen, Rechte und die Zuordnungen.

Revision ID: a2d7f4c19b60
Revises: f1c6b30d9e57
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import Base
from app.modules.access.permissions import AREA_OF, Permission
from app.modules.access.service import BUILT_IN_ROLES

revision: str = "a2d7f4c19b60"
down_revision: str | None = "f1c6b30d9e57"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Die Reihenfolge folgt den Fremdschlüsseln: role_permission hängt an beiden.
TABLES: tuple[str, ...] = ("role", "permission", "role_permission", "user_role")

PERSON_COLUMNS: tuple[tuple[str, sa.String], ...] = (
    ("email", sa.String(255)),
    ("name", sa.String(255)),
)


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    """Legt die vier Tabellen an, füllt den Rechtekatalog und die festen Rollen."""
    connection = op.get_bind()
    for name in TABLES:
        table = Base.metadata.tables[name]
        connection.execute(CreateTable(table, if_not_exists=True))
        for index in table.indexes:
            connection.execute(CreateIndex(index, if_not_exists=True))

    # SQLite kennt kein ``ADD COLUMN IF NOT EXISTS``. Auf einer leeren
    # Datenbank hat die Baseline die Spalten schon aus den Modellen gebaut.
    present = _columns("nutzer")
    for column, kind in PERSON_COLUMNS:
        if column not in present:
            with op.batch_alter_table("nutzer") as batch:
                batch.add_column(sa.Column(column, kind, nullable=True))

    permission = Base.metadata.tables["permission"]
    known = set(connection.scalars(sa.select(permission.c.key)))
    for right in Permission:
        if right.value not in known:
            connection.execute(
                sa.insert(permission).values(key=right.value, area=AREA_OF[right].value),
            )

    role = Base.metadata.tables["role"]
    taken = set(connection.scalars(sa.select(role.c.slug)))
    for built_in in BUILT_IN_ROLES:
        if built_in.slug not in taken:
            connection.execute(
                sa.insert(role).values(
                    id=built_in.id,
                    slug=built_in.slug,
                    name=built_in.name,
                    description=built_in.description,
                    built_in=True,
                ),
            )


def downgrade() -> None:
    """Räumt die vier Tabellen und die beiden Spalten wieder ab."""
    connection = op.get_bind()
    for name in reversed(TABLES):
        connection.execute(DropTable(Base.metadata.tables[name], if_exists=True))
    present = _columns("nutzer")
    for column, _ in PERSON_COLUMNS:
        if column in present:
            with op.batch_alter_table("nutzer") as batch:
                batch.drop_column(column)
