"""Was als Quelle eines Faktors taugt.

Zwei Dinge liegen unter ``PILZE_MAPS`` und tragen Wertkacheln: die
Eingabe-Ebenen aus ``layers.json`` und die Vorhersagekarten der Arten. Beide
darf ein Faktor nennen, sonst nichts. Ein Tippfehler in einer gespeicherten
Kombination faellt so beim Speichern auf und nicht erst als leere Karte.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict

FILE = "layers.json"


class LayerEntry(BaseModel):
    """Eine Ebene in ``layers.json``. Hier zaehlt nur, dass es sie gibt."""

    model_config = ConfigDict(extra="ignore")

    label: str
    unit: str


class LayerIndex(BaseModel):
    """Das Dokument ``layers.json``, das die Kette neben die Kacheln legt."""

    model_config = ConfigDict(extra="ignore")

    layers: dict[str, LayerEntry]


@lru_cache(maxsize=4)
def layer_names(maps: Path) -> frozenset[str]:
    """Die Namen der Eingabe-Ebenen unter ``PILZE_MAPS``.

    Ohne ``layers.json`` kennt der Dienst keine Ebene. Dann bleiben nur die
    Vorhersagekarten des Katalogs, und die Antwort sagt genau das.
    """
    file = maps / FILE
    if not file.is_file():
        return frozenset()
    document = LayerIndex.model_validate_json(file.read_text(encoding="utf-8"))
    return frozenset(document.layers)
