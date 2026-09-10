"""Day measures that a weekly reduction cannot express.

The weekly table holds the sum, the mean, the minimum and the maximum of a
week. How many days in that week had frost is in none of them, and neither is
how long ago it last rained. Both are day questions, so they are answered on
the daily grid and only then reduced to a week.

Every test runs on the cell mean of the day, not on a single 1 km pixel: a
frost day of a 5 km cell is a day whose mean minimum was below zero.
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np

Tagesmass = Callable[[np.ndarray], np.ndarray]


def schwellentage(schwelle: float, *, ueber: bool) -> Tagesmass:
    """Mark every day that passes the threshold, so a week can sum them."""
    def tagesmass(taeglich: np.ndarray) -> np.ndarray:
        trifft = taeglich > schwelle if ueber else taeglich < schwelle
        return np.where(np.isfinite(taeglich), trifft, np.nan).astype("float32")
    return tagesmass


def tage_seit(schwelle: float, kappung: int) -> Tagesmass:
    """Count the days since the last day above the threshold, per cell.

    The counter runs over the whole record, so the returned function keeps it
    between the year files it is called with. It starts at the cap: before the
    first day of the record nobody knows when it last rained.
    """
    zaehler: np.ndarray | None = None

    def tagesmass(taeglich: np.ndarray) -> np.ndarray:
        nonlocal zaehler
        if zaehler is None or zaehler.size != taeglich.shape[1]:
            zaehler = np.full(taeglich.shape[1], float(kappung), dtype="float32")
        out = np.empty_like(taeglich)
        for tag in range(taeglich.shape[0]):
            # Ein Tag ohne Wert darf den Zaehler nicht vergiften, sonst bliebe
            # die Zelle fuer immer NaN. Er zaehlt als trockener Tag und faellt
            # nur aus der Ausgabe.
            zaehler = np.minimum(np.where(taeglich[tag] > schwelle, 0.0, zaehler + 1.0),
                                 kappung)
            out[tag] = np.where(np.isfinite(taeglich[tag]), zaehler, np.nan)
        return out
    return tagesmass
