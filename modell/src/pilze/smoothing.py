"""Glätten innerhalb einer Maske, abschneiden an ihrem Rand.

Die Vorhersage lag bis hierher auf der Ostsee. Zwei Dinge kamen zusammen.

Die Glättung wichtet jede Zelle mit dem Anteil gültiger Nachbarn und trägt
einen Küstenwert damit über die Küste hinaus: bei Sigma 1,2 Zellen auf
einem 500-m-Raster rund anderthalb Kilometer weit. Und danach schnitt
niemand mehr ab, was dort hinausgetragen worden war.

Die Reihenfolge ist die ganze Sache. Erst glätten, dann maskieren — und
nicht umgekehrt: wer erst maskiert und dann glättet, lässt die Nullen des
Meeres in die Rechnung und gibt dem Wald an der Küste eine Vorhersage, die
zu niedrig ist.
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np

# Wie viel Kerngewicht aus gültigen Zellen kommen muss, damit eine Zelle
# einen Wert bekommt. Darunter stünden Werte, die aus fast nichts stammen.
NORM_MIN = 0.08


def smoothed_field(field: np.ndarray, sigma: float, land: np.ndarray,
                   blur: Callable[[np.ndarray, float], np.ndarray] | None = None
                   ) -> np.ndarray:
    """Glättet das Feld innerhalb der gültigen Zellen und schneidet es an ``land`` ab.

    ``field`` trägt NaN, wo nichts vorhergesagt wird. ``land`` ist wahr, wo
    überhaupt gezeichnet werden darf. Beide haben dieselbe Form.

    ``blur`` faltet ein Feld mit einer Breite. Die Vorgabe ist der Gauß aus
    scipy; die Tests setzen einen Kern, dessen Reichweite sie genau kennen,
    und müssen scipy dafür nicht laden.
    """
    if land.shape != field.shape:
        raise ValueError(f"Maske {land.shape} passt nicht zum Feld {field.shape}")
    if sigma > 0:
        if blur is None:
            from scipy.ndimage import gaussian_filter

            blur = gaussian_filter
        valid = np.isfinite(field)
        filled = np.where(valid, field, 0.0)
        weight = blur(valid.astype("float32"), sigma)
        with np.errstate(invalid="ignore", divide="ignore"):
            field = np.where(weight > NORM_MIN,
                             blur(filled, sigma) / np.maximum(weight, 1e-6),
                             np.nan)
    return np.where(land, field, np.nan)
