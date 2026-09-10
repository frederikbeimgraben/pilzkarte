#!/usr/bin/env python3
"""Turn the raw GBIF files into one occurrence table.

The script does five things.

1. Reads every JSON-Lines file in the raw directory.
2. Adds the finds that app users released for training.
3. Keeps the macrofungi and drops lichens and microfungi.
4. Puts each record into a grid cell and an ISO week.
5. Writes one Parquet file.

The grid uses EPSG:3035, the European equal-area projection. A cell of 5 km
matches two facts. The 90th percentile of the coordinate error is about
3.7 km. The MTB-Quadrant grid of the German mapping scheme is about 5.6 km.

Class Agaricomycetes is the target group. It holds the mushrooms, boletes and
brackets that people look for and report. A person who reports one of these
was looking for mushrooms. That makes the class a good measure of effort.

App finds carry `basis = "app"`. Column `basis` says where a row came from;
every GBIF row carries `basis = "gbif"`.

An app find is presence-only. The person reported what they found, not what
they did not find. One find is therefore a visit with one species, and it may
add a find but never an absence. `visit_model.py` reads the `basis` column and
keeps such a visit only when it carries the target species. Without the flag
the min-species gate would drop every app find, because a visit of one species
is not a real absence for anything.

The observer hash of an app find comes from the find id, not from the account.
The endpoint does not hand out the account, and one find per observer-day is
exactly the unit the paragraph above describes.

Usage:
    python build_occurrences.py --raw data/raw/gbif --out data/interim/occurrences.parquet
"""

from __future__ import annotations

import argparse
import hashlib
import os
import gzip
import json
from pathlib import Path

import pandas as pd

# The grid cell size in meters.
# The cell size in meters. Set PILZE_CELL_SIZE to sweep the resolution.
CELL_SIZE = int(os.environ.get("PILZE_CELL_SIZE", 5000))

# The target group. Everything else becomes neither a case nor a background row.
TARGET_CLASS = "Agaricomycetes"

# Classes that form lichens. They do not fruit in a seasonal way, and a person
# who records them is doing something other than looking for mushrooms.
LICHEN_CLASSES = {
    "Lecanoromycetes", "Arthoniomycetes", "Lichinomycetes", "Coniocybomycetes",
}

COLUMNS = [
    "gbifID", "datasetKey", "license", "species", "speciesKey", "genus",
    "family", "order", "class", "phylum", "taxonRank",
    "decimalLatitude", "decimalLongitude", "coordinateUncertaintyInMeters",
    "eventDate", "year", "month", "day", "recordedByHash",
]

# Where a row came from. `visit_model.py` reads it.
GBIF = "gbif"
APP = "app"

# The file that `update.sh` fetches from the backend before this script runs.
APP_FILE = Path("data/raw/app/funde.json")


def observer_hash(find_id: str) -> str:
    """The observer of an app find.

    One find is one observer-day. The hash comes from the find id, because the
    endpoint hands out no account. The prefix keeps it apart from a GBIF hash.
    """
    return "app:" + hashlib.blake2s(find_id.encode("utf-8"), digest_size=8).hexdigest()


def read_app(path: Path) -> pd.DataFrame:
    """Read the finds that people released for training in the app.

    A missing file is normal: the chain also runs on a machine without the
    backend. The columns match the GBIF frame, so both go through the same
    grid and date steps.
    """
    if not path.is_file():
        print(f"no app finds at {path}")
        return pd.DataFrame(columns=[*COLUMNS, "basis"])
    records = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for record in records:
        day = pd.Timestamp(record["datum"])
        rows.append({
            # `size` counts rows, so this only has to be unique and present.
            "gbifID": f"app:{record['id']}",
            "species": record["lateinisch"],
            "class": TARGET_CLASS,
            "decimalLatitude": float(record["lat"]),
            "decimalLongitude": float(record["lon"]),
            # A phone GPS gives no estimate, and neither does the app.
            "coordinateUncertaintyInMeters": None,
            "eventDate": day.isoformat(),
            "year": day.year, "month": day.month, "day": day.day,
            "recordedByHash": observer_hash(record["id"]),
            "basis": APP,
        })
    print(f"read {len(rows)} app finds from {path}")
    return pd.DataFrame(rows, columns=[*COLUMNS, "basis"])


def read_raw(raw_dir: Path) -> pd.DataFrame:
    rows = []
    files = sorted(raw_dir.glob("*.jsonl.gz"))
    if not files:
        raise SystemExit(f"no files in {raw_dir}")
    for path in files:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                rows.append({key: record.get(key) for key in COLUMNS})
    print(f"read {len(rows)} records from {len(files)} files")
    return pd.DataFrame(rows)


def visit_gate(visits: pd.DataFrame, min_species: int) -> pd.Series:
    """Which visits carry a signal a model may learn from.

    The min-species gate keeps a visit only if the person named at least
    `min_species` species. That is what turns a visit without the target into
    a real absence: somebody looked hard and did not find it.

    An app find is the one exception. It is presence-only, so it is a visit of
    one species and would always fail the gate. It passes when it carries the
    target and is dropped when it does not, so it can add a find but never an
    absence.

    The rule lives here, next to the column it reads. `visit_model.py` calls it.
    """
    enough = visits["n_species"] >= min_species
    app_find = (visits["from_app"] == 1) & (visits["label"] == 1)
    return enough | app_find


def add_grid(frame: pd.DataFrame) -> pd.DataFrame:
    """Add the projected coordinate and the grid cell."""
    # Only this step needs the projection. Imported here so that a test of the
    # reading steps runs in the small test shell, which carries no pyproj.
    from pyproj import Transformer

    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    x, y = transformer.transform(
        frame["decimalLongitude"].to_numpy(), frame["decimalLatitude"].to_numpy()
    )
    frame["x"] = x
    frame["y"] = y
    frame["cell_x"] = (frame["x"] // CELL_SIZE).astype("int32")
    frame["cell_y"] = (frame["y"] // CELL_SIZE).astype("int32")
    frame["cell"] = frame["cell_x"].astype(str) + "_" + frame["cell_y"].astype(str)
    return frame


def add_time(frame: pd.DataFrame) -> pd.DataFrame:
    """Add the date and the ISO week. Drop records without a full date."""
    date = pd.to_datetime(frame["eventDate"], format="ISO8601",
                          errors="coerce", utc=True).dt.tz_localize(None)
    frame["date"] = date.dt.normalize()
    before = len(frame)
    frame = frame[frame["date"].notna() & frame["day"].notna()].copy()
    print(f"dropped {before - len(frame)} records without a day-precision date")
    iso = frame["date"].dt.isocalendar()
    frame["iso_year"] = iso["year"].astype("int16")
    frame["iso_week"] = iso["week"].astype("int8")
    frame["doy"] = frame["date"].dt.dayofyear.astype("int16")
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=Path("data/raw/gbif"))
    parser.add_argument("--out", type=Path, default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--max-uncertainty", type=float, default=5000.0,
                        help="drop a record whose coordinate error is larger, in meters")
    parser.add_argument("--app", type=Path, default=APP_FILE,
                        help="finds released for training in the app")
    args = parser.parse_args()

    frame = read_raw(args.raw)
    frame["basis"] = GBIF
    app = read_app(args.app)
    if not app.empty:
        frame = pd.concat([frame, app], ignore_index=True)

    print("\nrecords by phylum:")
    print(frame["phylum"].value_counts().head(6).to_string())

    lichens = frame["class"].isin(LICHEN_CLASSES).sum()
    frame = frame[~frame["class"].isin(LICHEN_CLASSES)]
    print(f"\ndropped {lichens} lichen records")

    before = len(frame)
    frame = frame[frame["class"] == TARGET_CLASS].copy()
    print(f"kept {len(frame)} of {before} records in class {TARGET_CLASS}")

    frame = add_time(frame)

    # A missing value means the publisher gave no estimate. Keep those records,
    # because most app records with a phone GPS carry no estimate at all.
    error = frame["coordinateUncertaintyInMeters"]
    too_coarse = (error > args.max_uncertainty).sum()
    frame = frame[error.isna() | (error <= args.max_uncertainty)].copy()
    print(f"dropped {too_coarse} records with a coordinate error over "
          f"{args.max_uncertainty:.0f} m")

    frame = add_grid(frame)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(args.out, index=False)
    print(f"\nwrote {len(frame)} records to {args.out}, "
          f"{int((frame['basis'] == APP).sum())} of them from the app")
    print(f"cells: {frame['cell'].nunique()}   "
          f"species: {frame['species'].nunique()}   "
          f"years: {frame['iso_year'].min()}-{frame['iso_year'].max()}")


if __name__ == "__main__":
    main()
