"""Der Zonenwert: die Wertkacheln der Kette unter einer Flaeche mitteln.

Die Kette in ``modell/`` legt je Art ein Manifest ``<slug>.json`` unter
``PILZE_MAPS`` ab und daneben die Kacheln. Eine Kachel traegt ein Byte je Punkt:
0 heisst keine Daten, 1 bis 255 den Wert relativ zum Hoechstwert ``top`` der
Art. Der absolute Wert ist ``(byte - 1) / 254 * top``.

Gelesen wird auf der hoechsten Zoomstufe, die das Manifest fuehrt. Dort ist ein
Punkt am kleinsten, und das Mittel trifft die Flaeche am genauesten.
"""

import math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from PIL import Image
from pydantic import BaseModel, ConfigDict

from app.core.errors import NotFound
from app.shared.geometry import Point, centroid, point_in_polygon, ring_box

# Kantenlaenge einer Kachel in Punkten, so wie ``modell/src/pilze/tiles.py`` sie schreibt.
TILE: Final = 256
# Byte 1 steht fuer den Wert 0, Byte 255 fuer ``top``.
STEPS: Final = 254
PERCENT: Final = 100


class TileIndex(BaseModel):
    """Welche Kacheln die Kette gerendert hat, je Zoomstufe."""

    model_config = ConfigDict(extra="ignore")

    have: dict[int, list[str]]


class WeekTiles(BaseModel):
    """Eine Woche im Manifest, mit dem Pfad zu ihren Kacheln."""

    model_config = ConfigDict(extra="ignore")

    year: int
    week: int
    tiles: str


class Manifest(BaseModel):
    """Das Manifest einer Art unter ``PILZE_MAPS``."""

    model_config = ConfigDict(extra="ignore")

    name: str
    top: float
    weeks: list[WeekTiles]
    tiles: TileIndex


@dataclass(frozen=True, slots=True)
class Cell:
    """Ein Punkt einer Kachel: welche Kachel, und wo darin."""

    tile_x: int
    tile_y: int
    x: int
    y: int


def read_manifest(maps: Path, map_name: str) -> Manifest:
    """Liest das Manifest einer Art. Ohne Manifest gibt es keinen Zonenwert."""
    file = maps / f"{map_name}.json"
    if not file.is_file():
        raise NotFound(f"Fuer {map_name} liegt keine Karte unter PILZE_MAPS.")
    return Manifest.model_validate_json(file.read_text(encoding="utf-8"))


def find_week(manifest: Manifest, year: int, week: int) -> WeekTiles:
    """Sucht die Woche im Manifest."""
    for entry in manifest.weeks:
        if entry.year == year and entry.week == week:
            return entry
    raise NotFound(f"Die Karte {manifest.name} hat keine Woche {year}-{week:02d}.")


def to_world_point(point: Point, zoom: int) -> tuple[float, float]:
    """Rechnet Grad in Kachelpunkte der Weltkarte um (Web Mercator)."""
    lon, width = point
    radian = math.radians(width)
    edge = TILE * 2**zoom
    x = (lon + 180.0) / 360.0 * edge
    y = (1 - math.log(math.tan(radian) + 1 / math.cos(radian)) / math.pi) / 2 * edge
    return x, y


def to_degrees(x: float, y: float, zoom: int) -> Point:
    """Rechnet Kachelpunkte der Weltkarte zurueck in Grad."""
    edge = TILE * 2**zoom
    lon = x / edge * 360.0 - 180.0
    width = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / edge))))
    return lon, width


def _cell(world_x: int, world_y: int) -> Cell:
    return Cell(
        tile_x=world_x // TILE,
        tile_y=world_y // TILE,
        x=world_x % TILE,
        y=world_y % TILE,
    )


def cells_under(ring: list[Point], zoom: int) -> list[Cell]:
    """Die Kachelpunkte, deren Mitte in der Flaeche liegt.

    Eine Zone kann kleiner sein als ein Kachelpunkt. Auf Zoom 8 ist ein Punkt in
    Deutschland gut 600 Meter breit, ein Revier von 40 Hektar also schmaler.
    Dann zaehlt der Punkt unter dem Schwerpunkt der Zone, sonst haette sie
    keinen Wert.
    """
    west, south, east, north = ring_box(ring)
    links, top = to_world_point((west, north), zoom)
    right, bottom = to_world_point((east, south), zoom)
    found = [
        _cell(world_x, world_y)
        for world_y in range(int(top), int(bottom) + 1)
        for world_x in range(int(links), int(right) + 1)
        if point_in_polygon(to_degrees(world_x + 0.5, world_y + 0.5, zoom), ring)
    ]
    if not found:
        centre_x, centre_y = to_world_point(centroid(ring), zoom)
        found.append(_cell(int(centre_x), int(centre_y)))
    return found


def _by_tile(cells: list[Cell]) -> dict[tuple[int, int], list[Cell]]:
    groups: dict[tuple[int, int], list[Cell]] = defaultdict(list)
    for cell in cells:
        groups[(cell.tile_x, cell.tile_y)].append(cell)
    return groups


def area_mean(
    maps: Path,
    manifest: Manifest,
    tile_path: str,
    ring: list[Point],
) -> tuple[float, int]:
    """Mittelt die Wertkacheln unter einer Flaeche.

    Zurueck kommen der Mittelwert in Prozent und die Zahl der Kachelpunkte mit
    Daten. Ein Punkt mit Byte 0 traegt nichts bei: dort hat die Kette nichts
    gerechnet, und eine Null waere eine Aussage, die es nicht gibt.
    """
    zoom = max(manifest.tiles.have)
    present = set(manifest.tiles.have[zoom])
    total = 0.0
    points = 0
    for (tile_x, tile_y), group in _by_tile(cells_under(ring, zoom)).items():
        if f"{tile_x}/{tile_y}" not in present:
            continue
        file = maps / tile_path / str(zoom) / str(tile_x) / f"{tile_y}.png"
        with Image.open(file) as image:
            grey = image.convert("L")
        for cell in group:
            tier = int(grey.getpixel((cell.x, cell.y)))  # pyright: ignore[reportArgumentType]
            if tier > 0:
                total += (tier - 1) / STEPS
                points += 1
    if points == 0:
        return 0.0, 0
    return total / points * manifest.top * PERCENT, points
