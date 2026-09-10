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

type Punkt = tuple[float, float]
# Ein Rechteck ist (West, Sueden, Osten, Norden), so wie ein bbox-Parameter.
type Rechteck = tuple[float, float, float, float]

# Deutschland als Rechteck. Der Rand laesst einen Fundort kurz hinter der Grenze
# zu und haelt einen Tippfehler auf einem anderen Kontinent draussen.
SUEDEN: Final = 47.27
NORDEN: Final = 55.10
WESTEN: Final = 5.87
OSTEN: Final = 15.05
RAND_GRAD: Final = 0.5

BREITE_MIN: Final = SUEDEN - RAND_GRAD
BREITE_MAX: Final = NORDEN + RAND_GRAD
LAENGE_MIN: Final = WESTEN - RAND_GRAD
LAENGE_MAX: Final = OSTEN + RAND_GRAD

# Mittlerer Erdradius nach WGS 84, in Metern.
ERDRADIUS_M: Final = 6378137.0
QUADRATMETER_JE_HEKTAR: Final = 10_000.0

# Ein Breitengrad ist ueberall etwa gleich lang. Nur so bleibt ein Raster in
# Kilometern ohne Projektion rechenbar.
KM_JE_BREITENGRAD: Final = 111.32

MINDESTECKEN: Final = 3
# west, sueden, osten, norden
RECHTECKZAHLEN: Final = 4


def ring_normieren(punkte: Sequence[Punkt]) -> list[Punkt]:
    """Schliesst einen Ring und prueft, dass er eine Flaeche aufspannen kann.

    Ein Zeichenwerkzeug schickt den Ring mal geschlossen und mal offen. Beide
    Formen enden hier als derselbe geschlossene Ring.
    """
    offen = list(punkte[:-1]) if len(punkte) > 1 and punkte[0] == punkte[-1] else list(punkte)
    if len(offen) < MINDESTECKEN:
        raise ValueError(f"Eine Flaeche braucht mindestens {MINDESTECKEN} Eckpunkte.")
    if len(set(offen)) != len(offen):
        raise ValueError("Ein Eckpunkt kommt zweimal vor.")
    return [*offen, offen[0]]


def _seite(a: Punkt, b: Punkt, p: Punkt) -> float:
    """Sagt ueber das Vorzeichen, auf welcher Seite der Geraden a-b der Punkt p liegt."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def _kreuzt(a: Punkt, b: Punkt, c: Punkt, d: Punkt) -> bool:
    """Sagt, ob sich die Strecken a-b und c-d in ihrem Inneren kreuzen.

    Ein gemeinsamer Endpunkt zaehlt nicht als Kreuzung. Zwei Kanten eines Rings
    teilen sich immer eine Ecke, und die ist erlaubt.
    """
    return _seite(a, b, c) * _seite(a, b, d) < 0 and _seite(c, d, a) * _seite(c, d, b) < 0


def ist_einfach(ring: Sequence[Punkt]) -> bool:
    """Sagt, ob sich der Ring nirgends selbst ueberschneidet."""
    kanten = list(pairwise(ring))
    for stelle, (a, b) in enumerate(kanten):
        for c, d in kanten[stelle + 2 :]:
            if _kreuzt(a, b, c, d):
                return False
    return True


def flaeche_ha(ring: Sequence[Punkt]) -> float:
    """Flaeche eines geschlossenen Rings in Hektar.

    Sphaerische Naeherung. Die Flaeche eines Kugelpolygons ist das Wegintegral
    ueber seine Kanten,

        A = R^2 / 2 * Summe ueber alle Ecken i von
            (laenge[i+1] - laenge[i-1]) * sin(breite[i])

    mit Laenge und Breite im Bogenmass und R als Erdradius. Der Betrag am Ende
    macht die Richtung des Rings gleichgueltig. Ein Hektar sind 10 000
    Quadratmeter.
    """
    offen = ring[:-1]
    anzahl = len(offen)
    summe = 0.0
    for stelle in range(anzahl):
        vor = offen[stelle - 1]
        hier = offen[stelle]
        nach = offen[(stelle + 1) % anzahl]
        summe += (radians(nach[0]) - radians(vor[0])) * sin(radians(hier[1]))
    return abs(summe) * ERDRADIUS_M**2 / 2 / QUADRATMETER_JE_HEKTAR


def punkt_in_polygon(punkt: Punkt, ring: Sequence[Punkt]) -> bool:
    """Sagt, ob der Punkt im Ring liegt. Strahlverfahren nach Osten.

    Gezaehlt wird, wie oft ein Strahl vom Punkt aus die Kanten schneidet. Eine
    ungerade Zahl heisst innen. Der Vergleich der Breiten mit ``>`` auf genau
    einer Seite zaehlt eine Ecke nur einmal.
    """
    laenge, breite = punkt
    drin = False
    for (l1, b1), (l2, b2) in pairwise(ring):
        if (b1 > breite) != (b2 > breite):
            schnitt = l1 + (breite - b1) * (l2 - l1) / (b2 - b1)
            if laenge < schnitt:
                drin = not drin
    return drin


def schwerpunkt(ring: Sequence[Punkt]) -> Punkt:
    """Der Flaechenschwerpunkt eines geschlossenen Rings.

    Der Ring hat eine Flaeche groesser null, dafuer sorgt die Pruefung der
    Eingabe. Darum teilt diese Rechnung nie durch null.
    """
    zweifach = 0.0
    laenge = 0.0
    breite = 0.0
    for (l1, b1), (l2, b2) in pairwise(ring):
        kreuz = l1 * b2 - l2 * b1
        zweifach += kreuz
        laenge += (l1 + l2) * kreuz
        breite += (b1 + b2) * kreuz
    return (laenge / (3 * zweifach), breite / (3 * zweifach))


def ring_rechteck(ring: Sequence[Punkt]) -> Rechteck:
    """Das umschliessende Rechteck eines Rings."""
    laengen = [punkt[0] for punkt in ring]
    breiten = [punkt[1] for punkt in ring]
    return (min(laengen), min(breiten), max(laengen), max(breiten))


def im_rechteck(punkt: Punkt, rechteck: Rechteck) -> bool:
    """Sagt, ob der Punkt im Rechteck liegt. Die Raender gehoeren dazu."""
    west, sueden, osten, norden = rechteck
    return west <= punkt[0] <= osten and sueden <= punkt[1] <= norden


def rechteck_erweitern(rechteck: Rechteck, grad: float) -> Rechteck:
    """Legt einen Rand um ein Rechteck."""
    west, sueden, osten, norden = rechteck
    return (west - grad, sueden - grad, osten + grad, norden + grad)


def rechteck_lesen(text: str) -> Rechteck:
    """Liest ``west,sueden,osten,norden`` aus einem bbox-Parameter."""
    teile = text.split(",")
    if len(teile) != RECHTECKZAHLEN:
        raise ValueError("Ein bbox braucht vier Zahlen: west,sueden,osten,norden.")
    try:
        west, sueden, osten, norden = (float(teil) for teil in teile)
    except ValueError as fehler:
        raise ValueError("Ein bbox besteht aus vier Zahlen.") from fehler
    if west >= osten or sueden >= norden:
        raise ValueError("Im bbox liegt die erste Ecke suedwestlich der zweiten.")
    return (west, sueden, osten, norden)


def auf_raster(punkt: Punkt, kilometer: float) -> Punkt:
    """Legt einen Punkt auf den Knoten eines Rasters mit dieser Maschenweite.

    Der Fundort einer geschuetzten Art verlaesst den Dienst nur so. Das Raster
    ist grob genug, dass die Stelle im Wald nicht mehr auffindbar ist, und fein
    genug, dass die Gegend stimmt.
    """
    laenge, breite = punkt
    schritt_breite = kilometer / KM_JE_BREITENGRAD
    grob_breite = round(breite / schritt_breite) * schritt_breite
    # Ein Laengengrad ist in Deutschland nur gut halb so lang wie am Aequator.
    # Ohne den Kosinus waere die Masche in Ost-West-Richtung fast doppelt so weit.
    schritt_laenge = schritt_breite / cos(radians(grob_breite))
    grob_laenge = round(laenge / schritt_laenge) * schritt_laenge
    return (round(grob_laenge, 5), round(grob_breite, 5))
