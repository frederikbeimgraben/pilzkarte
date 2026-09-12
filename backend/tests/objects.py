"""Vorrichtungen fuer Funde, Marker und Zonen.

Der Katalog hier haelt drei erfundene Arten: zwei geschuetzte mit Karte
(Steinpilz, Pfifferling) und eine ungeschuetzte ohne Karte (Parasol). Damit
laesst sich die Rundung geschuetzter Arten gegen ihr Gegenstueck pruefen.
"""

import io
import json
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from PIL import Image

from app.core.settings import get_settings
from app.modules.species.catalog import Catalog, build_relations
from app.modules.species.schemas import (
    WEEKS,
    Edibility,
    Group,
    Link,
    Lookalike,
    Profile,
    Season,
    SeasonTable,
    Source,
    SpeciesCounts,
    TraitKey,
    TreeSpecies,
)
from app.modules.zones.tiles import TILE

# Ein Rechteck im Schoenbuch, gut zwei Kilometer breit. Es liegt sicher in
# Deutschland und laesst sich im Kopf nachrechnen.
ZONE_RING: list[list[float]] = [
    [9.05, 48.52],
    [9.08, 48.52],
    [9.08, 48.54],
    [9.05, 48.54],
]

FIND_PLACE = {"lat": 48.5203, "lon": 9.0511}


# Die Vorrichtungen nehmen englische Schluesselwoerter und schreiben die Namen
# auf den Draht, die der Vertrag heute traegt. R3 loescht diese Tabelle.
WIRE_NAMES: dict[str, str] = {
    "species_slug": "artSlug",
    "found_on": "datum",
    "count": "anzahl",
    "note": "notiz",
    "visibility": "sichtbarkeit",
    "for_training": "fuerTraining",
    "color": "farbe",
    "rule": "regel",
    "factors": "faktoren",
    "entries": "eintraege",
}


def on_the_wire(override: dict[str, Any]) -> dict[str, Any]:
    """Uebersetzt die Schluesselwoerter einer Vorrichtung in die Namen des Vertrags."""
    return {WIRE_NAMES.get(name, name): value for name, value in override.items()}


def polygon(ring: list[list[float]] | None = None) -> dict[str, Any]:
    """Ein GeoJSON-Polygon, so wie es das Zeichenwerkzeug schickt."""
    return {"type": "Polygon", "coordinates": [ring if ring is not None else ZONE_RING]}


def _profile(name: str, scientific: str, *, protected: bool, reference: str = "parasol") -> Profile:
    return Profile(
        name=name,
        scientific=scientific,
        group=Group.BOLETE,
        edibility=Edibility.EDIBLE,
        protected=protected,
        seasons=[Season.AUTUMN],
        trees=[TreeSpecies.SPRUCE],
        source=Source(
            url="https://www.123pilzsuche.de/daten/details/Steinpilze.htm",
            checked_on="2026-09-10",
        ),
        traits={
            TraitKey.FLESH: "Weiss.",
            TraitKey.SMELL: "Pilzig.",
            TraitKey.SPORE_PRINT: "Olivbraun.",
            TraitKey.HABITAT: "Im Wald.",
            TraitKey.SEASON: "Herbst.",
        },
        lookalikes=[Lookalike(slug=reference, difference="Ohne Roehren, mit Ring.")],
        links=[Link(title="Wikipedia", url="https://de.wikipedia.org/wiki/Pilze")],
    )


def catalog_for_tests() -> Catalog:
    """Der Katalog der Tests: Steinpilz und Pfifferling geschuetzt, Parasol nicht."""
    counts = SpeciesCounts(
        visits_with_find=900,
        finds_per_week=[10] * WEEKS,
        finds_per_week_current_year=[5] * WEEKS,
    )
    table = SeasonTable(
        as_of_year=2026,
        as_of_week=36,
        from_year=2015,
        to_year=2025,
        min_species=2,
        visits_per_week=[100] * WEEKS,
        visits_per_week_current_year=[20] * WEEKS,
        species={
            "Boletus edulis": counts,
            "Cantharellus cibarius": counts,
            "Macrolepiota procera": counts,
        },
    )
    profiles = {
        "steinpilz": _profile("Steinpilz", "Boletus edulis", protected=True),
        "pfifferling": _profile("Pfifferling", "Cantharellus cibarius", protected=True),
        "parasol": _profile(
            "Parasol", "Macrolepiota procera", protected=False, reference="steinpilz"
        ),
    }
    return Catalog(
        table=table,
        profiles=profiles,
        # Nur der Steinpilz hat eine Wertkarte. Der Parasol belegt den Fall
        # "Art im Katalog, aber ohne Vorhersage".
        maps={"steinpilz": "boletus_edulis"},
        relations=build_relations(profiles),
    )


def yesterday() -> str:
    """Ein Datum, das sicher nicht in der Zukunft liegt."""
    return (datetime.now(UTC).date() - timedelta(days=1)).isoformat()


def tomorrow() -> str:
    """Ein Datum, das sicher in der Zukunft liegt."""
    return (datetime.now(UTC).date() + timedelta(days=1)).isoformat()


def find_body(**override: Any) -> dict[str, Any]:  # noqa: ANN401
    """Ein gueltiger Fund. Jedes Feld laesst sich ueberschreiben."""
    body: dict[str, Any] = {
        "artSlug": "steinpilz",
        "datum": yesterday(),
        "anzahl": 3,
        "notiz": "Unter Fichten am Weg.",
        "sichtbarkeit": "privat",
        **FIND_PLACE,
    }
    body.update(on_the_wire(override))
    return body


def marker_body(**override: Any) -> dict[str, Any]:  # noqa: ANN401
    """Ein gueltiger Marker."""
    body: dict[str, Any] = {
        "name": "Alter Fichtenhang",
        "farbe": "blau",
        "notiz": "Ab Mitte September.",
        "sichtbarkeit": "privat",
        **FIND_PLACE,
    }
    body.update(on_the_wire(override))
    return body


def zone_body(**override: Any) -> dict[str, Any]:  # noqa: ANN401
    """Eine gueltige Zone."""
    body: dict[str, Any] = {
        "name": "Schoenbuch Nord",
        "polygon": polygon(),
        "farbe": "gruen",
        "notiz": "Nordhang, alte Fichten.",
        "sichtbarkeit": "privat",
    }
    body.update(on_the_wire(override))
    return body


def combination_body(**override: Any) -> dict[str, Any]:  # noqa: ANN401
    """Eine gueltige Kombination: das Beispiel aus dem Konzept."""
    body: dict[str, Any] = {
        "name": "Nasser Buchenhang",
        "regel": "schnitt",
        "faktoren": [
            {"quelle": "regen_4w", "bedingung": "ueber", "von": 80},
            {"quelle": "temperatur", "bedingung": "zwischen", "von": 8, "bis": 16},
            {"quelle": "hangneigung", "bedingung": "unter", "bis": 15, "aktiv": False},
        ],
    }
    body.update(on_the_wire(override))
    return body


def write_layers(maps: Path, names: list[str] | None = None) -> None:
    """Legt ein layers.json an, wie die Kette es neben die Kacheln legt."""
    layers = {
        name: {"label": name.capitalize(), "unit": "mm", "low": 0.0, "high": 200.0}
        for name in (names if names is not None else ["regen_4w", "temperatur", "hangneigung"])
    }
    maps.mkdir(parents=True, exist_ok=True)
    _ = (maps / "layers.json").write_text(
        json.dumps({"bounds": [[47.1, 4.9], [55.2, 15.2]], "layers": layers}),
        encoding="utf-8",
    )


def image_with_exif(width: int = 2400, height: int = 1200) -> bytes:
    """Ein JPEG mit Kamera- und GPS-Kopfzeilen, so wie es aus einem Telefon kommt."""
    exif = Image.Exif()
    exif[0x010F] = "TestKamera"
    exif[0x0110] = "Modell X"
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = (48.0, 31.0, 12.0)
    gps[3] = "E"
    gps[4] = (9.0, 3.0, 30.0)
    image = Image.new("RGB", (width, height), (40, 90, 60))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def image(format_: str = "PNG", width: int = 40, height: int = 30) -> bytes:
    """Ein einfaches Bild in einem beliebigen Format."""
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (10, 20, 30)).save(buffer, format=format_)
    return buffer.getvalue()


def has_exif(raw_bytes: bytes) -> bool:
    """Sagt, ob die Datei einen Exif-Abschnitt traegt."""
    return b"Exif\x00\x00" in raw_bytes


def write_map(
    maps: Path,
    *,
    levels: Mapping[tuple[int, int], int],
    tile_x: int,
    tile_y: int,
    zoom: int,
    top: float = 0.5,
    year: int = 2026,
    week: int = 40,
) -> None:
    """Legt ein Manifest und eine Kachel an, wie die Kette sie schreibt.

    ``stufen`` setzt einzelne Punkte der Kachel auf ein Byte. Alles andere
    bleibt 0 und heisst damit: keine Daten.
    """
    path = f"boletus_edulis_kacheln/{year}W{week:02d}"
    manifest = {
        "name": "boletus_edulis",
        "top": top,
        "weeks": [{"year": year, "week": week, "tiles": path, "mean": 0.01, "max": 0.2}],
        "tiles": {"zooms": [zoom, zoom], "have": {str(zoom): [f"{tile_x}/{tile_y}"]}},
    }
    maps.mkdir(parents=True, exist_ok=True)
    _ = (maps / "boletus_edulis.json").write_text(json.dumps(manifest), encoding="utf-8")

    kachel = Image.new("L", (TILE, TILE), 0)
    for (x, y), tier in levels.items():
        kachel.putpixel((x, y), tier)
    folder = maps / path / str(zoom) / str(tile_x)
    folder.mkdir(parents=True, exist_ok=True)
    kachel.save(folder / f"{tile_y}.png")


def maps_folder() -> Path:
    """Der Ordner aus PILZE_MAPS, so wie der Dienst ihn sieht."""
    return get_settings().maps


def photo_folder() -> Path:
    """Der Ordner aus PILZE_FOTOS."""
    return get_settings().photos
