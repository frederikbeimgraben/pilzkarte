"""The finds that app users released for training.

Two records are enough to check every rule by hand: one find of the target
species and one of another. The first must reach the model as a visit with a
find, the second must not reach it at all.

Run them from `modell/` with `nix develop ./modell#test -c pytest tests`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "pilze"))

from build_occurrences import (  # noqa: E402
    APP,
    COLUMNS,
    TARGET_CLASS,
    add_time,
    observer_hash,
    read_app,
    visit_gate,
)

FUNDE = [
    {
        "id": "3f2b-0001",
        "artSlug": "steinpilz",
        "lateinisch": "Boletus edulis",
        "lat": 48.5203,
        "lon": 9.0511,
        "datum": "2026-09-01",
        "anzahl": 3,
    },
    {
        "id": "3f2b-0002",
        "artSlug": "parasol",
        "lateinisch": "Macrolepiota procera",
        "lat": 48.6,
        "lon": 9.2,
        "datum": "2026-09-02",
        "anzahl": None,
    },
]


def _datei(tmp_path: Path, funde: list[dict[str, object]] | None = None) -> Path:
    ziel = tmp_path / "funde.json"
    ziel.write_text(json.dumps(funde if funde is not None else FUNDE), encoding="utf-8")
    return ziel


# ------------------------------------------------------------------ reading


def test_a_missing_file_is_no_error(tmp_path: Path) -> None:
    # The chain also runs on a machine without the backend.
    leer = read_app(tmp_path / "gibt-es-nicht.json")

    assert leer.empty
    assert "basis" in leer.columns


def test_the_file_becomes_a_frame_shaped_like_gbif(tmp_path: Path) -> None:
    frame = read_app(_datei(tmp_path))

    assert list(frame.columns) == [*COLUMNS, "basis"]
    assert len(frame) == 2
    erste = frame.iloc[0]
    assert erste["species"] == "Boletus edulis"
    assert erste["class"] == TARGET_CLASS
    # Exact, not rounded: that is the point of releasing a find.
    assert (erste["decimalLatitude"], erste["decimalLongitude"]) == (48.5203, 9.0511)
    assert (erste["year"], erste["month"], erste["day"]) == (2026, 9, 1)
    assert erste["basis"] == APP
    # A phone GPS gives no estimate, so the row must not claim one.
    assert erste["coordinateUncertaintyInMeters"] is None


def test_every_find_is_its_own_observer(tmp_path: Path) -> None:
    frame = read_app(_datei(tmp_path))
    hashes = list(frame["recordedByHash"])

    assert hashes[0] != hashes[1]
    assert all(wert.startswith("app:") for wert in hashes)
    # Stable across runs: the same find keeps its visit from week to week.
    assert hashes[0] == observer_hash("3f2b-0001")


def test_app_rows_pass_the_date_step(tmp_path: Path) -> None:
    frame = add_time(read_app(_datei(tmp_path)))

    assert len(frame) == 2
    assert list(frame["iso_year"]) == [2026, 2026]
    assert list(frame["iso_week"]) == [36, 36]


# ------------------------------------------------------------------ the gate


def _visits() -> pd.DataFrame:
    """Four visits: one careful walk, one lonely GBIF record, two app finds."""
    return pd.DataFrame(
        [
            {"visit": "gbif-viele", "n_species": 12, "label": 0, "from_app": 0},
            {"visit": "gbif-einsam", "n_species": 1, "label": 0, "from_app": 0},
            {"visit": "app-treffer", "n_species": 1, "label": 1, "from_app": 1},
            {"visit": "app-andere-art", "n_species": 1, "label": 0, "from_app": 1},
        ]
    )


def test_the_gate_keeps_a_careful_walk_and_drops_a_lonely_record() -> None:
    behalten = _visits()[visit_gate(_visits(), min_species=2)]

    assert "gbif-viele" in set(behalten["visit"])
    assert "gbif-einsam" not in set(behalten["visit"])


def test_an_app_find_of_the_target_becomes_a_visit_with_a_find() -> None:
    behalten = _visits()[visit_gate(_visits(), min_species=2)]

    assert "app-treffer" in set(behalten["visit"])


def test_an_app_find_of_another_species_is_no_absence() -> None:
    # The person reported what they found, not what they did not find. Such a
    # visit must not tell the model that the target was missing.
    behalten = _visits()[visit_gate(_visits(), min_species=2)]

    assert "app-andere-art" not in set(behalten["visit"])
