"""Begriffskataloge fuer Geruch, Geschmack und Baumart.

Revision ID: a4d8e2b91c67
Revises: f1c6b30d9e57
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a4d8e2b91c67"
down_revision: str | None = "a2d7f4c19b60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "begriff"

SMELL = [
    ("pilzig", "pilzig"),
    ("angenehm", "angenehm"),
    ("unauffaellig", "unauffällig"),
    ("anisartig", "anisartig"),
    ("bittermandel", "nach Bittermandel"),
    ("mehlig", "mehlig"),
    ("gurkenartig", "nach Gurke"),
    ("rettichartig", "rettichartig"),
    ("obstartig", "obstartig"),
    ("fruchtig", "fruchtig"),
    ("suesslich", "süßlich"),
    ("honigartig", "nach Honig"),
    ("wuerzig", "würzig"),
    ("knoblauchartig", "nach Knoblauch"),
    ("fischartig", "nach Fisch"),
    ("spermatisch", "spermatisch"),
    ("laugenartig", "laugenartig"),
    ("karbolartig", "nach Karbol"),
    ("seifig", "seifig"),
    ("erdartig", "erdig"),
    ("muffig", "muffig"),
    ("unangenehm", "unangenehm"),
    ("saeuerlich", "säuerlich"),
    ("maggiartig", "nach Maggi"),
]

TASTE = [
    ("mild", "mild"),
    ("pilzig", "pilzig"),
    ("nussig", "nussig"),
    ("suesslich", "süßlich"),
    ("mehlig", "mehlig"),
    ("saeuerlich", "säuerlich"),
    ("herb", "herb"),
    ("bitter", "bitter"),
    ("scharf", "scharf"),
    ("brennend", "brennend scharf"),
    ("kratzend", "kratzend"),
    ("unangenehm", "unangenehm"),
]

TREES = [
    ("fichte", "Fichte"),
    ("kiefer", "Kiefer"),
    ("tanne", "Tanne"),
    ("laerche", "Lärche"),
    ("douglasie", "Douglasie"),
    ("eibe", "Eibe"),
    ("buche", "Buche"),
    ("eiche", "Eiche"),
    ("steineiche", "Steineiche"),
    ("hainbuche", "Hainbuche"),
    ("birke", "Birke"),
    ("erle", "Erle"),
    ("hasel", "Hasel"),
    ("pappel", "Pappel"),
    ("weide", "Weide"),
    ("linde", "Linde"),
    ("esche", "Esche"),
    ("ulme", "Ulme"),
    ("ahorn", "Ahorn"),
    ("kastanie", "Kastanie"),
    ("robinie", "Robinie"),
    ("goldregen", "Goldregen"),
    ("holunder", "Holunder"),
    ("heidelbeere", "Heidelbeere"),
    ("obstbaum", "Obstbaum"),
]


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    """Legt die Tabelle an und fuellt sie mit dem heutigen Bestand.

    Der Bestand steht hier und nicht in einer Datei: eine Migration ist der
    einzige Ort, an dem eine Zeile genau einmal entsteht.
    """
    if TABLE not in _tables():
        op.create_table(
            TABLE,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("art", sa.String(length=32), nullable=False, index=True),
            sa.Column("slug", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default="0"),
            sa.UniqueConstraint("art", "slug", name="uq_begriff_art_slug"),
        )
    terms = sa.table(
        TABLE,
        sa.column("art", sa.String),
        sa.column("slug", sa.String),
        sa.column("name", sa.String),
        sa.column("reihenfolge", sa.Integer),
    )
    known = {
        (row[0], row[1])
        for row in op.get_bind().execute(sa.select(terms.c["art"], terms.c["slug"]))
    }
    rows = [
        {"art": kind, "slug": slug, "name": name, "reihenfolge": position}
        for kind, entries in (("geruch", SMELL), ("geschmack", TASTE), ("baum", TREES))
        for position, (slug, name) in enumerate(entries)
        if (kind, slug) not in known
    ]
    if rows:
        op.bulk_insert(terms, rows)


def downgrade() -> None:
    """Nimmt die Tabelle wieder weg."""
    if TABLE in _tables():
        op.drop_table(TABLE)
