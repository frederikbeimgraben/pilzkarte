"""What goes into a manifest besides the tile names: the histogram, and the
writer that keeps the file small.

The Faktor screen of the app shows the distribution of one layer over Germany
and lets the user drag two handles over it. The browser cannot count 2.3
million cells per week, and the value tiles only carry a byte per point, so
the chain counts while it still holds the field: forty classes over the scale
of the layer, and the share of the valid area in each class.

A class is an interval over the scale that the layer already declares in the
manifest (``low`` to ``high``, in the unit of the layer; ``0`` to ``top`` for
a prediction). The handles therefore point at values in that unit without any
further arithmetic. ``klassen`` holds 41 edges, not 40 lower edges: the upper
edge of the last class is a number the screen has to print, and deriving it
from the step invites a rounding error at the one place the user reads.

A point without data does not count. Points outside the scale fall into the
first or the last class, because that is where the value tiles put them too.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np

KLASSEN = 40

# Eine Zahlenliste, die json.dumps mit Einrueckung ueber eine Zeile je Zahl
# verteilt. Anfuehrungszeichen und Klammern fehlen im Zeichenvorrat, also
# faengt der Ausdruck weder Zeichenketten noch verschachtelte Listen.
_ZAHLENLISTE = re.compile(r"\[[\s\d.,eE+-]*\]")


def histogramm(werte: np.ndarray, low: float, high: float,
               klassen: int = KLASSEN) -> dict[str, list[float]] | None:
    """Count values into equal classes over ``low`` to ``high``.

    Returns the class edges and the share of the valid values in each class,
    or ``None`` if nothing is valid. Values outside the scale are clipped into
    the outer classes.
    """
    if not high > low:
        raise ValueError(f"Skala ohne Breite: {low} bis {high}")
    gueltig = np.asarray(werte, dtype="float64").ravel()
    gueltig = gueltig[np.isfinite(gueltig)]
    kanten = np.linspace(low, high, klassen + 1)
    if gueltig.size == 0:
        return None
    zahl, _ = np.histogram(np.clip(gueltig, low, high), bins=kanten)
    anteile = zahl / gueltig.size
    return {"klassen": [round(float(k), 6) for k in kanten],
            "anteile": [round(float(a), 6) for a in anteile]}


def werte_aus_kacheln(ordner: Path, kacheln: list[str], zoom: str,
                      low: float, high: float) -> np.ndarray | None:
    """Read the values back out of a set of value tiles.

    A tile carries one byte per point: 0 means no data, 1 to 255 run linearly
    over the scale of the layer. Coarse, but it is what an already rendered
    map still holds.
    """
    from PIL import Image

    stuecke = []
    for xy in kacheln:
        datei = ordner / zoom / (xy + ".png")
        if not datei.exists():
            continue
        b = np.asarray(Image.open(datei).convert("L"), dtype="float32")
        b = b[b > 0]
        if b.size:
            stuecke.append(low + (b - 1) / 254 * (high - low))
    return np.concatenate(stuecke) if stuecke else None


def schreibe(pfad: Path, meta: dict) -> None:
    """Write a manifest with every list of numbers on one line.

    ``json.dumps`` with an indent puts each number on a line of its own. Forty
    classes over ninety weeks and seven weekly layers turn a 37 kB file into
    more than a megabyte, and the app fetches it on every start.
    """
    text = _ZAHLENLISTE.sub(
        lambda t: "[" + ", ".join(t.group(0)[1:-1].replace(",", " ").split()) + "]",
        json.dumps(meta, indent=1))
    pfad.write_text(text)
