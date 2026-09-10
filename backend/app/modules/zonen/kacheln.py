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

from app.core.errors import NichtGefunden
from app.shared.geometrie import Punkt, punkt_in_polygon, ring_rechteck, schwerpunkt

# Kantenlaenge einer Kachel in Punkten, so wie ``modell/src/pilze/tiles.py`` sie schreibt.
KACHEL: Final = 256
# Byte 1 steht fuer den Wert 0, Byte 255 fuer ``top``.
STUFEN: Final = 254
PROZENT: Final = 100


class Kachelstand(BaseModel):
    """Welche Kacheln die Kette gerendert hat, je Zoomstufe."""

    model_config = ConfigDict(extra="ignore")

    have: dict[int, list[str]]


class Wochenkachel(BaseModel):
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
    weeks: list[Wochenkachel]
    tiles: Kachelstand


@dataclass(frozen=True, slots=True)
class Zelle:
    """Ein Punkt einer Kachel: welche Kachel, und wo darin."""

    kachel_x: int
    kachel_y: int
    x: int
    y: int


def manifest_lesen(maps: Path, karte: str) -> Manifest:
    """Liest das Manifest einer Art. Ohne Manifest gibt es keinen Zonenwert."""
    datei = maps / f"{karte}.json"
    if not datei.is_file():
        raise NichtGefunden(f"Fuer {karte} liegt keine Karte unter PILZE_MAPS.")
    return Manifest.model_validate_json(datei.read_text(encoding="utf-8"))


def woche_suchen(manifest: Manifest, jahr: int, woche: int) -> Wochenkachel:
    """Sucht die Woche im Manifest."""
    for eintrag in manifest.weeks:
        if eintrag.year == jahr and eintrag.week == woche:
            return eintrag
    raise NichtGefunden(f"Die Karte {manifest.name} hat keine Woche {jahr}-{woche:02d}.")


def zu_weltpunkt(punkt: Punkt, zoom: int) -> tuple[float, float]:
    """Rechnet Grad in Kachelpunkte der Weltkarte um (Web Mercator)."""
    laenge, breite = punkt
    bogen = math.radians(breite)
    kante = KACHEL * 2**zoom
    x = (laenge + 180.0) / 360.0 * kante
    y = (1 - math.log(math.tan(bogen) + 1 / math.cos(bogen)) / math.pi) / 2 * kante
    return x, y


def zu_grad(x: float, y: float, zoom: int) -> Punkt:
    """Rechnet Kachelpunkte der Weltkarte zurueck in Grad."""
    kante = KACHEL * 2**zoom
    laenge = x / kante * 360.0 - 180.0
    breite = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / kante))))
    return laenge, breite


def _zelle(welt_x: int, welt_y: int) -> Zelle:
    return Zelle(
        kachel_x=welt_x // KACHEL,
        kachel_y=welt_y // KACHEL,
        x=welt_x % KACHEL,
        y=welt_y % KACHEL,
    )


def zellen_unter(ring: list[Punkt], zoom: int) -> list[Zelle]:
    """Die Kachelpunkte, deren Mitte in der Flaeche liegt.

    Eine Zone kann kleiner sein als ein Kachelpunkt. Auf Zoom 8 ist ein Punkt in
    Deutschland gut 600 Meter breit, ein Revier von 40 Hektar also schmaler.
    Dann zaehlt der Punkt unter dem Schwerpunkt der Zone, sonst haette sie
    keinen Wert.
    """
    west, sueden, osten, norden = ring_rechteck(ring)
    links, oben = zu_weltpunkt((west, norden), zoom)
    rechts, unten = zu_weltpunkt((osten, sueden), zoom)
    gefunden = [
        _zelle(welt_x, welt_y)
        for welt_y in range(int(oben), int(unten) + 1)
        for welt_x in range(int(links), int(rechts) + 1)
        if punkt_in_polygon(zu_grad(welt_x + 0.5, welt_y + 0.5, zoom), ring)
    ]
    if not gefunden:
        mitte_x, mitte_y = zu_weltpunkt(schwerpunkt(ring), zoom)
        gefunden.append(_zelle(int(mitte_x), int(mitte_y)))
    return gefunden


def _nach_kachel(zellen: list[Zelle]) -> dict[tuple[int, int], list[Zelle]]:
    gruppen: dict[tuple[int, int], list[Zelle]] = defaultdict(list)
    for zelle in zellen:
        gruppen[(zelle.kachel_x, zelle.kachel_y)].append(zelle)
    return gruppen


def flaechenmittel(
    maps: Path,
    manifest: Manifest,
    kachelpfad: str,
    ring: list[Punkt],
) -> tuple[float, int]:
    """Mittelt die Wertkacheln unter einer Flaeche.

    Zurueck kommen der Mittelwert in Prozent und die Zahl der Kachelpunkte mit
    Daten. Ein Punkt mit Byte 0 traegt nichts bei: dort hat die Kette nichts
    gerechnet, und eine Null waere eine Aussage, die es nicht gibt.
    """
    zoom = max(manifest.tiles.have)
    vorhanden = set(manifest.tiles.have[zoom])
    summe = 0.0
    punkte = 0
    for (kachel_x, kachel_y), gruppe in _nach_kachel(zellen_unter(ring, zoom)).items():
        if f"{kachel_x}/{kachel_y}" not in vorhanden:
            continue
        datei = maps / kachelpfad / str(zoom) / str(kachel_x) / f"{kachel_y}.png"
        with Image.open(datei) as bild:
            grau = bild.convert("L")
        for zelle in gruppe:
            stufe = int(grau.getpixel((zelle.x, zelle.y)))  # pyright: ignore[reportArgumentType]
            if stufe > 0:
                summe += (stufe - 1) / STUFEN
                punkte += 1
    if punkte == 0:
        return 0.0, 0
    return summe / punkte * manifest.top * PROZENT, punkte
