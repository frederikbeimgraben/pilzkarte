"""Der Anfangsbestand der Einordnung.

``daten/taxonomie.json`` entsteht in der Kette, in
``modell/src/pilze/taxonomy_fetch.py``. Die Einordnung kommt aus dem
GBIF-Backbone, die deutschen Namen aus den Quellseiten von 123pilzsuche, durch
Zaehlen. Ein Rang ohne Beleg traegt seinen lateinischen Namen.

Die Datei ist die Vorgabe, nicht die Wahrheit: sobald die Tabelle ``taxon``
steht, liest der Dienst nur noch aus ihr. Die Migration legt den Bestand an,
der Start gleicht ihn ab.
"""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Final

from app.shared.schemas import TaxonRank

SEED_FILE: Final = Path(__file__).resolve().parents[3] / "daten" / "taxonomie.json"


@dataclass(frozen=True)
class TaxonSeed:
    """Eine Zeile der Vorgabe. ``parent`` ist der Slug, nicht die Kennung."""

    slug: str
    rank: TaxonRank
    name: str
    latin_name: str | None
    parent: str | None


@cache
def seed_taxa() -> tuple[TaxonSeed, ...]:
    """Liest die Vorgabe, Eltern vor Kindern.

    Die Reihenfolge zaehlt: eine Zeile braucht die Kennung ihrer Elternzeile,
    und die entsteht erst beim Schreiben.
    """
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    rows = {
        entry["slug"]: TaxonSeed(
            slug=entry["slug"],
            rank=TaxonRank(entry["rang"]),
            name=entry["name"],
            latin_name=entry.get("lateinisch"),
            parent=entry["elter"],
        )
        for entry in raw["taxa"]
    }
    ordered: list[TaxonSeed] = []
    placed: set[str] = set()

    def place(row: TaxonSeed) -> None:
        if row.slug in placed:
            return
        if row.parent is not None:
            place(rows[row.parent])
        placed.add(row.slug)
        ordered.append(row)

    for row in rows.values():
        place(row)
    return tuple(ordered)
