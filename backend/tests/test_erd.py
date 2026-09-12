"""Das Entitätendiagramm: was der Generator aus den Modellen macht."""

from pathlib import Path

import pytest
from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, Table

from app.models import Base
from tools import erd


def one_table() -> MetaData:
    metadata = MetaData()
    Table(
        "parent",
        metadata,
        Column("id", String(36), primary_key=True),
        Column("slug", String(64), unique=True),
        Column("name", String(80)),
        Column("note", String(200), nullable=True),
    )
    return metadata


def two_tables(*, nullable: bool = False, unique: bool = False) -> MetaData:
    metadata = one_table()
    Table(
        "child",
        metadata,
        Column("id", String(36), primary_key=True),
        Column(
            "parent_id",
            String(36),
            ForeignKey("parent.id", ondelete="CASCADE"),
            nullable=nullable,
            unique=unique,
        ),
        Column("count", Integer),
    )
    return metadata


def test_the_diagram_starts_with_the_mermaid_keyword() -> None:
    assert erd.diagram(one_table()).startswith("erDiagram\n")


def test_a_table_becomes_an_entity_with_its_columns_and_types() -> None:
    text = erd.diagram(one_table())

    assert "    parent {" in text
    assert "        VARCHAR(80) name" in text


def test_a_column_carries_its_keys() -> None:
    text = erd.diagram(one_table())

    assert "        VARCHAR(36) id PK" in text
    assert "        VARCHAR(64) slug UK" in text


def test_a_foreign_key_is_marked_on_the_column() -> None:
    text = erd.diagram(two_tables())

    assert "        VARCHAR(36) parent_id FK" in text


def test_two_keys_on_one_column_stand_next_to_each_other() -> None:
    metadata = one_table()
    Table(
        "link",
        metadata,
        Column("parent_id", String(36), ForeignKey("parent.id"), primary_key=True),
    )

    assert "        VARCHAR(36) parent_id PK, FK" in erd.diagram(metadata)


def test_the_primary_key_stands_at_the_top_of_the_entity() -> None:
    # Ein Mixin hängt seine Spalten hinten an. Im Kasten gehört der
    # Schlüssel trotzdem nach oben.
    metadata = MetaData()
    Table(
        "late",
        metadata,
        Column("name", String(80), nullable=False),
        Column("id", String(36), primary_key=True),
    )
    lines = erd.diagram(metadata).splitlines()

    assert lines[1:4] == ["    late {", "        VARCHAR(36) id PK", "        VARCHAR(80) name"]


def test_a_column_that_may_stay_empty_says_so() -> None:
    text = erd.diagram(one_table())

    assert '        VARCHAR(200) note "optional"' in text


def test_a_foreign_key_becomes_a_relationship() -> None:
    text = erd.diagram(two_tables())

    assert '    parent ||--o{ child : "parent_id"' in text


def test_a_foreign_key_that_may_stay_empty_makes_the_parent_optional() -> None:
    text = erd.diagram(two_tables(nullable=True))

    assert '    parent |o--o{ child : "parent_id"' in text


def test_a_unique_foreign_key_allows_only_one_child() -> None:
    text = erd.diagram(two_tables(unique=True))

    assert '    parent ||--|| child : "parent_id"' in text


def test_entities_come_before_relationships() -> None:
    lines = erd.diagram(two_tables()).splitlines()

    assert lines.index("    child {") < lines.index('    parent ||--o{ child : "parent_id"')


def test_the_same_models_always_give_the_same_text() -> None:
    # Der Test auf Aktualität vergleicht Zeichen für Zeichen. Eine Reihenfolge
    # aus einer Menge würde ihn zufällig anschlagen lassen.
    assert erd.diagram(two_tables()) == erd.diagram(two_tables())


def test_writing_puts_the_diagram_next_to_the_board(tmp_path: Path) -> None:
    target = tmp_path / "erd.mmd"

    erd.write(target)

    assert target.read_text(encoding="utf-8") == erd.diagram(Base.metadata)


def test_the_command_writes_the_file_of_the_repository(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target = tmp_path / "erd.mmd"
    monkeypatch.setattr(erd, "DIAGRAM", target)

    erd.main()

    assert target.read_text(encoding="utf-8") == erd.diagram(Base.metadata)


def test_the_checked_in_diagram_matches_the_models() -> None:
    # Dieser Test ist der Zweck des Pakets: ein neues Modell ohne neues
    # Diagramm fällt hier auf, nicht erst beim Ansehen der Seite.
    checked_in = erd.DIAGRAM.read_text(encoding="utf-8")

    assert checked_in == erd.diagram(Base.metadata), (
        "Das Diagramm passt nicht mehr zu den Modellen. "
        "Neu bauen mit: cd backend && uv run python -m tools.erd"
    )


def test_every_table_of_the_models_is_in_the_diagram() -> None:
    text = erd.diagram(Base.metadata)

    for name in Base.metadata.tables:
        assert f"    {name} {{" in text
