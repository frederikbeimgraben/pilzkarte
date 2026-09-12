"""Geometrie ohne Fremdpaket: Rechteck, Ring, Flaeche, Punkt in Flaeche.

Ein Punkt ist ein Paar (Laenge, Breite) in Grad, in dieser Reihenfolge, so wie
GeoJSON es schreibt. Ein Ring ist geschlossen: der letzte Punkt ist der erste.

Alles hier rechnet auf der Kugel und ohne Zustand. Fuer ein Revier von einigen
hundert Hektar liegt der Fehler gegen ein Ellipsoid unter einem Promille. Der
Dienst braucht darum weder shapely noch pyproj, die beide nicht auf der
Paketliste in ``docs/betrieb.md`` stehen.
"""

from collections.abc import Sequence
from itertools import pairwise
from math import cos, radians, sin
from typing import Final

type Point = tuple[float, float]
# Ein Rechteck ist (West, Sueden, Osten, Norden), so wie ein bbox-Parameter.
type Box = tuple[float, float, float, float]

# Deutschland als Rechteck. Der Rand laesst einen Fundort kurz hinter der Grenze
# zu und haelt einen Tippfehler auf einem anderen Kontinent draussen.
SOUTH: Final = 47.27
NORTH: Final = 55.10
WEST: Final = 5.87
EAST: Final = 15.05
MARGIN_DEG: Final = 0.5

LAT_MIN: Final = SOUTH - MARGIN_DEG
LAT_MAX: Final = NORTH + MARGIN_DEG
LON_MIN: Final = WEST - MARGIN_DEG
LON_MAX: Final = EAST + MARGIN_DEG

# Mittlerer Erdradius nach WGS 84, in Metern.
EARTH_RADIUS_M: Final = 6378137.0
SQM_PER_HECTARE: Final = 10_000.0

# Ein Breitengrad ist ueberall etwa gleich lang. Nur so bleibt ein Raster in
# Kilometern ohne Projektion rechenbar.
KM_PER_LAT_DEGREE: Final = 111.32

# Maschenweite fuer einen Ort, der nur grob hinausgehen darf. Fuenf Kilometer
# nennen die Gegend und verraten die Stelle im Wald nicht. Funde und Artbilder
# runden auf dieselbe Zahl; zwei waeren zwei Versprechen.
GRID_KM: Final = 5.0

MIN_CORNERS: Final = 3
# west, sueden, osten, norden
BOX_NUMBERS: Final = 4


def close_ring(points: Sequence[Point]) -> list[Point]:
    """Schliesst einen Ring und prueft, dass er eine Flaeche aufspannen kann.

    Ein Zeichenwerkzeug schickt den Ring mal geschlossen und mal offen. Beide
    Formen enden hier als derselbe geschlossene Ring.
    """
    open_ring = list(points[:-1]) if len(points) > 1 and points[0] == points[-1] else list(points)
    if len(open_ring) < MIN_CORNERS:
        raise ValueError(f"Eine Flaeche braucht mindestens {MIN_CORNERS} Eckpunkte.")
    if len(set(open_ring)) != len(open_ring):
        raise ValueError("Ein Eckpunkt kommt zweimal vor.")
    return [*open_ring, open_ring[0]]


def _side(a: Point, b: Point, p: Point) -> float:
    """Sagt ueber das Vorzeichen, auf welcher Seite der Geraden a-b der Punkt p liegt."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def _crosses(a: Point, b: Point, c: Point, d: Point) -> bool:
    """Sagt, ob sich die Strecken a-b und c-d in ihrem Inneren kreuzen.

    Ein gemeinsamer Endpunkt zaehlt nicht als Kreuzung. Zwei Kanten eines Rings
    teilen sich immer eine Ecke, und die ist erlaubt.
    """
    return _side(a, b, c) * _side(a, b, d) < 0 and _side(c, d, a) * _side(c, d, b) < 0


def is_simple(ring: Sequence[Point]) -> bool:
    """Sagt, ob sich der Ring nirgends selbst ueberschneidet."""
    edges = list(pairwise(ring))
    for position, (a, b) in enumerate(edges):
        for c, d in edges[position + 2 :]:
            if _crosses(a, b, c, d):
                return False
    return True


def area_ha(ring: Sequence[Point]) -> float:
    """Flaeche eines geschlossenen Rings in Hektar.

    Sphaerische Naeherung. Die Flaeche eines Kugelpolygons ist das Wegintegral
    ueber seine Kanten,

        A = R^2 / 2 * Summe ueber alle Ecken i von
            (laenge[i+1] - laenge[i-1]) * sin(breite[i])

    mit Laenge und Breite im Bogenmass und R als Erdradius. Der Betrag am Ende
    macht die Richtung des Rings gleichgueltig. Ein Hektar sind 10 000
    Quadratmeter.
    """
    open_ring = ring[:-1]
    count = len(open_ring)
    total = 0.0
    for position in range(count):
        before = open_ring[position - 1]
        here = open_ring[position]
        after = open_ring[(position + 1) % count]
        total += (radians(after[0]) - radians(before[0])) * sin(radians(here[1]))
    return abs(total) * EARTH_RADIUS_M**2 / 2 / SQM_PER_HECTARE


def point_in_polygon(point: Point, ring: Sequence[Point]) -> bool:
    """Sagt, ob der Punkt im Ring liegt. Strahlverfahren nach Osten.

    Gezaehlt wird, wie oft ein Strahl vom Punkt aus die Kanten schneidet. Eine
    ungerade Zahl heisst innen. Der Vergleich der Breiten mit ``>`` auf genau
    einer Seite zaehlt eine Ecke nur einmal.
    """
    lon, width = point
    inside = False
    for (l1, b1), (l2, b2) in pairwise(ring):
        if (b1 > width) != (b2 > width):
            crossing = l1 + (width - b1) * (l2 - l1) / (b2 - b1)
            if lon < crossing:
                inside = not inside
    return inside


def centroid(ring: Sequence[Point]) -> Point:
    """Der Flaechenschwerpunkt eines geschlossenen Rings.

    Der Ring hat eine Flaeche groesser null, dafuer sorgt die Pruefung der
    Eingabe. Darum teilt diese Rechnung nie durch null.
    """
    twice_area = 0.0
    lon = 0.0
    width = 0.0
    for (l1, b1), (l2, b2) in pairwise(ring):
        cross = l1 * b2 - l2 * b1
        twice_area += cross
        lon += (l1 + l2) * cross
        width += (b1 + b2) * cross
    return (lon / (3 * twice_area), width / (3 * twice_area))


def ring_box(ring: Sequence[Point]) -> Box:
    """Das umschliessende Rechteck eines Rings."""
    longitudes = [point[0] for point in ring]
    latitudes = [point[1] for point in ring]
    return (min(longitudes), min(latitudes), max(longitudes), max(latitudes))


def in_box(point: Point, box: Box) -> bool:
    """Sagt, ob der Punkt im Rechteck liegt. Die Raender gehoeren dazu."""
    west, south, east, north = box
    return west <= point[0] <= east and south <= point[1] <= north


def grow_box(box: Box, degrees: float) -> Box:
    """Legt einen Rand um ein Rechteck."""
    west, south, east, north = box
    return (west - degrees, south - degrees, east + degrees, north + degrees)


def read_box(text: str) -> Box:
    """Liest ``west,sueden,osten,norden`` aus einem bbox-Parameter."""
    parts = text.split(",")
    if len(parts) != BOX_NUMBERS:
        raise ValueError("Ein bbox braucht vier Zahlen: west,sueden,osten,norden.")
    try:
        west, south, east, north = (float(part) for part in parts)
    except ValueError as error:
        raise ValueError("Ein bbox besteht aus vier Zahlen.") from error
    if west >= east or south >= north:
        raise ValueError("Im bbox liegt die erste Ecke suedwestlich der zweiten.")
    return (west, south, east, north)


def to_grid(point: Point, kilometres: float) -> Point:
    """Legt einen Punkt auf den Knoten eines Rasters mit dieser Maschenweite.

    Der Fundort einer geschuetzten Art verlaesst den Dienst nur so. Das Raster
    ist grob genug, dass die Stelle im Wald nicht mehr auffindbar ist, und fein
    genug, dass die Gegend stimmt.
    """
    lon, width = point
    lat_step = kilometres / KM_PER_LAT_DEGREE
    coarse_lat = round(width / lat_step) * lat_step
    # Ein Laengengrad ist in Deutschland nur gut halb so lang wie am Aequator.
    # Ohne den Kosinus waere die Masche in Ost-West-Richtung fast doppelt so weit.
    lon_step = lat_step / cos(radians(coarse_lat))
    coarse_lon = round(lon / lon_step) * lon_step
    return (round(coarse_lon, 5), round(coarse_lat, 5))
