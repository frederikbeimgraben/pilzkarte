"""Schreibt das Entitätendiagramm aus den Modellen.

    cd backend && uv run python -m tools.erd

Die Quelle ist ``Base.metadata``, dieselbe Sammlung, aus der Alembic das
Schema baut. Darum sieht das Diagramm ein neues Modell sofort, ohne dass
jemand eine Liste pflegt. Das Brett liefert die Ausgabe unter ``/erd`` aus.
"""

from pathlib import Path

from sqlalchemy import Column, MetaData, Table
from sqlalchemy.dialects import sqlite

from app.models import Base

DIAGRAM = Path(__file__).resolve().parents[2] / "tools" / "board" / "erd.mmd"

# Der Dienst läuft auf SQLite. Die Typen im Diagramm sollen die sein, die in
# der Datei stehen, nicht die abstrakten von SQLAlchemy.
DIALECT = sqlite.dialect()


def _keys(column: Column[object]) -> list[str]:
    keys: list[str] = []
    if column.primary_key:
        keys.append("PK")
    if column.foreign_keys:
        keys.append("FK")
    if column.unique and not column.primary_key:
        keys.append("UK")
    return keys


def _attribute(column: Column[object]) -> str:
    keys = ", ".join(_keys(column))
    line = " ".join(part for part in (column.type.compile(DIALECT), column.name, keys) if part)
    return f'{line} "optional"' if column.nullable else line


def _columns(table: Table) -> list[Column[object]]:
    # Eine Mischung aus Mixin und Modell hängt die geerbten Spalten hinten an.
    # Der Schlüssel gehört aber nach oben, sonst sucht man ihn in jedem Kasten.
    return list(table.primary_key.columns) + [
        column for column in table.columns if not column.primary_key
    ]


def _entity(table: Table) -> list[str]:
    return [
        f"    {table.name} {{",
        *(f"        {_attribute(column)}" for column in _columns(table)),
        "    }",
    ]


def _relationships(table: Table) -> list[str]:
    lines: list[str] = []
    for constraint in table.foreign_key_constraints:
        columns = list(constraint.columns)
        label = ", ".join(column.name for column in columns)
        # Ein Fremdschlüssel, der leer bleiben darf, macht das Elternteil
        # wahlfrei. Einer, der eindeutig ist, lässt nur ein Kind zu.
        parent = "|o" if any(column.nullable for column in columns) else "||"
        child = "||" if all(column.unique for column in columns) else "o{"
        lines.append(
            f'    {constraint.referred_table.name} {parent}--{child} {table.name} : "{label}"'
        )
    return lines


def diagram(metadata: MetaData) -> str:
    """Das Mermaid-Diagramm zu einer Sammlung von Tabellen."""
    tables = sorted(metadata.tables.values(), key=lambda table: table.name)
    entities = [line for table in tables for line in _entity(table)]
    relationships = sorted(line for table in tables for line in _relationships(table))
    return "\n".join(["erDiagram", *entities, *relationships]) + "\n"


def write(target: Path) -> None:
    """Schreibt das Diagramm der Modelle in eine Datei."""
    target.write_text(diagram(Base.metadata), encoding="utf-8")


def main() -> None:
    """Baut das Diagramm neben dem Brett neu."""
    write(DIAGRAM)
    print(f"geschrieben: {DIAGRAM}")


if __name__ == "__main__":
    main()
