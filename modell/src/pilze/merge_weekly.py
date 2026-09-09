#!/usr/bin/env python3
"""Join the per-variable weekly files into one table.

Every file in the checkpoint directory holds the same cell-weeks in the same
order after a sort. The script therefore sorts each file, checks that the keys
agree, and then puts the value columns side by side as plain arrays.

This avoids an index join. A join on ten million rows with a text index needs
several gigabytes, and the machine ran out of memory during the first attempt.

Usage:
    python merge_weekly.py --dir data/interim/weekly --out data/interim/weather_weekly.parquet
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

KEYS = ["iso_year", "iso_week", "cell"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", type=Path, default=Path("data/interim/weekly"))
    parser.add_argument("--out", type=Path, default=Path("data/interim/weather_weekly.parquet"))
    args = parser.parse_args()

    files = sorted(args.dir.glob("*.parquet"))
    if not files:
        raise SystemExit(f"no checkpoint files in {args.dir}")

    result: pd.DataFrame | None = None
    for path in files:
        name = path.stem
        frame = pd.read_parquet(path).sort_values(KEYS, kind="stable").reset_index(drop=True)
        if result is None:
            result = frame[KEYS].copy()
            result["iso_year"] = result["iso_year"].astype("int16")
            result["iso_week"] = result["iso_week"].astype("int8")
        elif not result["cell"].equals(frame["cell"]):
            raise SystemExit(f"{name}: the cell-weeks do not match the first file")
        result[name] = frame[name].astype("float32").to_numpy()
        print(f"  {name}: {len(frame)} rows", flush=True)

    result["cell"] = result["cell"].astype("category")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    result.to_parquet(args.out, index=False)
    size = args.out.stat().st_size / 1e6
    print(f"\nwrote {len(result)} rows, {len(result.columns)} columns, "
          f"{size:.0f} MB to {args.out}")
    print(result.head().to_string())


if __name__ == "__main__":
    main()
