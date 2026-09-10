"""The day measures, on fields whose answer can be counted by hand.

A field is (days, cells), as it comes from the daily grid.
"""

from __future__ import annotations

import numpy as np
import pytest
from day_measures import days_since, threshold_days


def test_frost_days_counts_the_days_below_zero():
    frost = threshold_days(0.0, above=False)
    days = np.array([[-3.0], [0.0], [1.5], [-0.1], [8.0], [-9.0], [2.0]])
    assert frost(days).ravel().tolist() == [1, 0, 0, 1, 0, 1, 0]
    # Die Woche summiert das Tagesmass, hier also drei Frosttage.
    assert frost(days).sum() == pytest.approx(3.0)


def test_heat_days_counts_the_days_above_the_threshold():
    heat = threshold_days(25.0, above=True)
    days = np.array([[25.0], [25.1], [30.0], [24.9]])
    assert heat(days).ravel().tolist() == [0, 1, 1, 0]


def test_threshold_days_leaves_a_day_without_a_value_empty():
    frost = threshold_days(0.0, above=False)
    measured = frost(np.array([[-1.0, np.nan], [5.0, np.nan]]))
    assert measured[0, 0] == 1.0
    assert np.isnan(measured[:, 1]).all()
    # Die Wochensumme ueberspringt NaN, eine Zelle ohne Wert bleibt also leer.
    assert np.nansum(measured[:, 1]) == 0.0


def test_days_since_starts_at_the_cap():
    # Vor dem ersten Tag der Aufzeichnung weiss niemand, wann es zuletzt
    # geregnet hat.
    since = days_since(5.0, 60)
    assert since(np.array([[0.0]])).ravel().tolist() == [60.0]


def test_days_since_resets_on_a_wet_day_and_then_counts_up():
    since = days_since(5.0, 60)
    days = np.array([[9.0], [0.0], [1.0], [4.9], [5.1], [0.0]])
    assert since(days).ravel().tolist() == [0.0, 1.0, 2.0, 3.0, 0.0, 1.0]


def test_days_since_caps_a_long_dry_spell():
    since = days_since(5.0, 10)
    course = since(np.zeros((30, 1))).ravel()
    assert course[9] == 10.0
    assert course[-1] == 10.0


def test_days_since_carries_the_counter_across_the_year_files():
    # Die Kette ruft das Mass je Jahresdatei einmal auf.
    since = days_since(5.0, 60)
    since(np.array([[9.0]]))
    assert since(np.array([[0.0], [0.0]])).ravel().tolist() == [1.0, 2.0]


def test_days_since_keeps_the_counter_over_a_day_without_a_value():
    since = days_since(5.0, 60)
    course = since(np.array([[9.0], [np.nan], [0.0]])).ravel()
    assert course[0] == 0.0
    assert np.isnan(course[1])
    # Der Tag ohne Wert zaehlt als trockener Tag, also steht danach die 2.
    assert course[2] == 2.0


def test_days_since_counts_every_cell_on_its_own():
    since = days_since(5.0, 60)
    course = since(np.array([[9.0, 0.0], [0.0, 9.0]]))
    assert course[1].tolist() == [1.0, 0.0]
