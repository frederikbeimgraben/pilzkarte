#!/usr/bin/env python3
"""Turn the raw GBIF files into one occurrence table.

The script does four things.

1. Reads every JSON-Lines file in the raw directory.
2. Keeps the macrofungi and drops lichens and microfungi.
3. Puts each record into a grid cell and an ISO week.
4. Writes one Parquet file.

The grid uses EPSG:3035, the European equal-area projection. A cell of 5 km
matches two facts. The 90th percentile of the coordinate error is about
3.7 km. The MTB-Quadrant grid of the German mapping scheme is about 5.6 km.

Class Agaricomycetes is the target group. It holds the mushrooms, boletes and
brackets that people look for and report. A person who reports one of these
was looking for mushrooms. That makes the class a good measure of effort.

Usage:
    python build_occurrences.py --raw data/raw/gbif --out data/interim/occurrences.parquet
"""

from __future__ import annotations

import argparse
import os
import gzip
import json
from pathlib import Path

import pandas as pd
from pyproj import Transformer

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


def add_grid(frame: pd.DataFrame) -> pd.DataFrame:
    """Add the projected coordinate and the grid cell."""
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
    args = parser.parse_args()

    frame = read_raw(args.raw)

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
    print(f"\nwrote {len(frame)} records to {args.out}")
    print(f"cells: {frame['cell'].nunique()}   "
          f"species: {frame['species'].nunique()}   "
          f"years: {frame['iso_year'].min()}-{frame['iso_year'].max()}")


if __name__ == "__main__":
    main()
