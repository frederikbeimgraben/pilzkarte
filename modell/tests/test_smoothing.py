"""Glätten innerhalb der Maske und Abschneiden an ihrem Rand.

Der Weichzeichner kommt von außen. Die Tests setzen einen Kern, dessen
Reichweite sie genau kennen, und prüfen dann Zelle für Zelle, wie weit ein
Wert trägt. Mit dem Kern aus scipy hänge die Antwort an dessen
Abschneidepunkt, und der Test sagte nur noch, dass es irgendwie glatt wird.
"""

from __future__ import annotations

import numpy as np
import pytest
from smoothing import smoothed_field


def box(field: np.ndarray, radius: float) -> np.ndarray:
    """Mittelt über ein Quadrat mit dieser Kantenlänge in Zellen.

    Ein Wert trägt damit genau ``radius`` Zellen weit, keine halbe weiter.
    """
    reach = int(radius)
    out = np.zeros_like(field, dtype="float64")
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            out += np.roll(np.roll(field, dy, axis=0), dx, axis=1)
    return out / (2 * reach + 1) ** 2


def coast(width: int = 9) -> tuple[np.ndarray, np.ndarray]:
    """Land in der linken Hälfte, Wasser in der rechten."""
    land = np.zeros((width, width), dtype=bool)
    land[:, : width // 2] = True
    return land, np.where(land, 1.0, np.nan)


def test_the_mask_cuts_what_the_smoothing_carried_out() -> None:
    # Der Kern trägt zwei Zellen weit. Ohne die Maske stünden danach Werte
    # zwei Spalten weit auf dem Wasser.
    land, field = coast()

    out = smoothed_field(field, 2.0, land, blur=box)

    assert np.all(np.isnan(out[:, land.shape[1] // 2 :]))


def test_the_coast_keeps_its_value_instead_of_being_thinned() -> None:
    # Die Nullen des Meeres dürfen den Wald an der Küste nicht verdünnen.
    # Eine normalisierte Faltung wichtet mit dem Anteil gültiger Nachbarn.
    land, field = coast()

    out = smoothed_field(field, 2.0, land, blur=box)

    assert np.allclose(out[np.isfinite(out)], 1.0)


def test_a_slope_on_land_is_still_smoothed() -> None:
    # Geglättet wird schon, nur eben innerhalb der Maske.
    land = np.ones((5, 5), dtype=bool)
    field = np.zeros((5, 5))
    field[2, 2] = 9.0

    out = smoothed_field(field, 1.0, land, blur=box)

    assert out[2, 2] < 9.0
    assert out[2, 1] > 0.0


def test_without_smoothing_the_mask_still_cuts() -> None:
    # ``--smooth 0`` schaltet den Weichzeichner ab, nicht die Maske.
    land, field = coast()

    out = smoothed_field(field, 0.0, land, blur=box)

    assert np.all(np.isnan(out[:, land.shape[1] // 2 :]))
    assert np.allclose(out[:, : land.shape[1] // 2], 1.0)


def test_a_cell_with_too_few_valid_neighbours_stays_empty() -> None:
    # Eine einzelne gültige Zelle weit draußen trägt ihren Wert nicht in
    # die Nachbarschaft: der Anteil gültiger Nachbarn bleibt unter der
    # Schwelle, und das Feld sagt dort weiter nichts.
    land = np.ones((11, 11), dtype=bool)
    field = np.full((11, 11), np.nan)
    field[5, 5] = 1.0

    out = smoothed_field(field, 3.0, land, blur=box)

    assert np.isnan(out[5, 0])


def test_land_without_a_value_stays_without_a_value() -> None:
    # Die Maske sagt, wo gezeichnet werden darf, nicht, dass dort etwas steht.
    land = np.ones((5, 5), dtype=bool)
    field = np.full((5, 5), np.nan)

    out = smoothed_field(field, 1.0, land, blur=box)

    assert np.all(np.isnan(out))


def test_the_shape_of_the_mask_must_match_the_field() -> None:
    land = np.ones((4, 4), dtype=bool)
    field = np.ones((5, 5))

    with pytest.raises(ValueError, match="Maske"):
        smoothed_field(field, 1.0, land, blur=box)
