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

DayMeasure = Callable[[np.ndarray], np.ndarray]


def threshold_days(threshold: float, *, above: bool) -> DayMeasure:
    """Mark every day that passes the threshold, so a week can sum them."""
    def measure(daily: np.ndarray) -> np.ndarray:
        hits = daily > threshold if above else daily < threshold
        return np.where(np.isfinite(daily), hits, np.nan).astype("float32")
    return measure


def days_since(threshold: float, cap: int) -> DayMeasure:
    """Count the days since the last day above the threshold, per cell.

    The counter runs over the whole record, so the returned function keeps it
    between the year files it is called with. It starts at the cap: before the
    first day of the record nobody knows when it last rained.
    """
    counter: np.ndarray | None = None

    def measure(daily: np.ndarray) -> np.ndarray:
        nonlocal counter
        if counter is None or counter.size != daily.shape[1]:
            counter = np.full(daily.shape[1], float(cap), dtype="float32")
        out = np.empty_like(daily)
        for day in range(daily.shape[0]):
            # Ein Tag ohne Wert darf den Zaehler nicht vergiften, sonst bliebe
            # die Zelle fuer immer NaN. Er zaehlt als trockener Tag und faellt
            # nur aus der Ausgabe.
            counter = np.minimum(np.where(daily[day] > threshold, 0.0, counter + 1.0),
                                 cap)
            out[day] = np.where(np.isfinite(daily[day]), counter, np.nan)
        return out
    return measure
