#!/usr/bin/env python3
"""Aggregate the DWD daily grids to the model cells and to ISO weeks.

The model works on 5 km cells in EPSG:3035 and on ISO weeks. The DWD grids
have a step of 1 km and a step of one day. This script reduces them.

Two source grids exist, and they do not share a projection.

  HYRAS         EPSG:3035, the same projection as the model cells. The script
                reads the pixel coordinates and uses them directly.
  soil moisture EPSG:31467, Gauss-Krueger zone 3. The file names a grid
                mapping variable that the file does not contain, so the script
                sets the projection from the coordinate range. The corners give
                55.008N 5.574E and 47.138N 14.720E, which is Germany.

For each day the script takes the mean of every 1 km pixel whose center falls
in a cell. It then reduces the days to ISO weeks. Rainfall gets a sum. The
minimum and maximum temperature keep the minimum and the maximum. Everything
else gets a mean.

Usage:
    python extract_grids.py --start 2014 --end 2026 --out data/interim/weather_weekly.parquet
"""

from __future__ import annotations

import argparse
import os
import glob
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).parent))
from tagesmasse import schwellentage, tage_seit

# The cell size in meters. Set PILZE_CELL_SIZE to sweep the resolution.
CELL_SIZE = int(os.environ.get("PILZE_CELL_SIZE", 5000))
MODEL_CRS = "EPSG:3035"
SOIL_CRS = "EPSG:31467"

# folder, variable name, how to reduce a week
HYRAS_VARS = [
    ("precipitation", "pr", "sum"),
    ("air_temperature_mean", "tas", "mean"),
    ("air_temperature_min", "tasmin", "min"),
    ("air_temperature_max", "tasmax", "max"),
    ("humidity", "hurs", "mean"),
    # radiation_global is left out on purpose. It uses a 5 km grid, not the
    # 1 km grid of the other HYRAS variables, and it stops in 2020.
]
TREE_SPECIES = ("spruce", "beech", "oak", "pine")

BLOCK = 31  # days read at once


# Ein Tagesmass, das keine Wochenreduktion ausdruecken kann, siehe
# tagesmasse.py.
# folder, variable, how to reduce a week, column, the day measure
HYRAS_TAGE = [
    ("precipitation", "pr", "last", "regen_tage_seit", lambda: tage_seit(5.0, 60)),
    ("air_temperature_min", "tasmin", "sum", "frosttage",
     lambda: schwellentage(0.0, ueber=False)),
    ("air_temperature_max", "tasmax", "sum", "hitzetage",
     lambda: schwellentage(25.0, ueber=True)),
]


def pixel_cells(x: np.ndarray, y: np.ndarray, transformer: Transformer | None):
    """Return the cell index of every pixel, as a flat array of (cell_x, cell_y)."""
    grid_x, grid_y = np.meshgrid(x, y)
    if transformer is not None:
        grid_x, grid_y = transformer.transform(grid_x, grid_y)
    cell_x = np.floor(grid_x / CELL_SIZE).astype(np.int32).ravel()
    cell_y = np.floor(grid_y / CELL_SIZE).astype(np.int32).ravel()
    return cell_x, cell_y


def build_cell_index(start: int, only: Path | None = None) -> tuple[pd.DataFrame, dict]:
    """Define the model cells from the HYRAS land mask.

    A cell with no record is of no use to the model, and at a small cell size
    the full land grid grows large. Give an occurrence file to keep only the
    cells that hold a record.
    """
    path = sorted(glob.glob(f"data/raw/dwd/hyras/precipitation/*_{start}_*.nc"))[-1]
    ds = xr.open_dataset(path)
    cell_x, cell_y = pixel_cells(ds.x.values, ds.y.values, None)
    land = np.isfinite(ds["pr"].isel(time=0).values).ravel()
    keys = np.unique(np.stack([cell_x[land], cell_y[land]], axis=1), axis=0)
    if only is not None:
        wanted = set(map(tuple, pd.read_parquet(
            only, columns=["cell_x", "cell_y"]).drop_duplicates().to_numpy()))
        keep = np.array([(int(a), int(b)) in wanted for a, b in keys])
        print(f"land cells {len(keys)} -> {int(keep.sum())} with records")
        keys = keys[keep]
    cells = pd.DataFrame(keys, columns=["cell_x", "cell_y"])
    cells["cell"] = cells["cell_x"].astype(str) + "_" + cells["cell_y"].astype(str)
    lookup = {(int(a), int(b)): i for i, (a, b) in enumerate(keys)}
    print(f"model cells over land: {len(cells)}")
    return cells, lookup


def flat_map(cell_x, cell_y, lookup: dict, n_cells: int) -> np.ndarray:
    """Map every pixel to a cell position. A pixel outside the cells gets -1."""
    out = np.full(cell_x.shape, -1, dtype=np.int32)
    for i in range(cell_x.size):
        out[i] = lookup.get((int(cell_x[i]), int(cell_y[i])), -1)
    return out


def daily_cell_means(path: str, var: str, mapping: np.ndarray,
                     n_cells: int, lookup: dict,
                     transformer: Transformer | None) -> tuple[np.ndarray, pd.DatetimeIndex]:
    """Read one year file and return the daily cell mean and the dates.

    The pixel map comes from the caller, but the grid of a file can differ
    from the reference grid. HYRAS radiation uses 5 km where the other HYRAS
    variables use 1 km. When the sizes disagree, build the map from the
    coordinates of this file.
    """
    ds = xr.open_dataset(path)
    if ds[var].shape[1] * ds[var].shape[2] != mapping.size:
        print(f"    grid differs, remapping {path.split('/')[-1]}", flush=True)
        mapping = flat_map(*pixel_cells(ds.x.values, ds.y.values, transformer),
                           lookup, n_cells)
    dates = pd.to_datetime(ds.time.values).normalize()
    n_days = len(dates)
    out = np.full((n_days, n_cells), np.nan, dtype=np.float32)
    keep = mapping >= 0
    index = mapping[keep]
    for begin in range(0, n_days, BLOCK):
        end = min(begin + BLOCK, n_days)
        block = ds[var].isel(time=slice(begin, end)).values
        for offset in range(end - begin):
            values = block[offset].ravel()[keep]
            good = np.isfinite(values)
            if not good.any():
                continue
            sums = np.bincount(index[good], weights=values[good], minlength=n_cells)
            counts = np.bincount(index[good], minlength=n_cells)
            with np.errstate(invalid="ignore", divide="ignore"):
                out[begin + offset] = np.where(counts > 0, sums / np.maximum(counts, 1), np.nan)
    ds.close()
    return out, dates


def weekly(daily: np.ndarray, dates: pd.DatetimeIndex, how: str,
           cells: pd.DataFrame, name: str) -> pd.DataFrame:
    """Reduce a daily cell matrix to ISO weeks, in long form."""
    iso = dates.isocalendar()
    key = pd.MultiIndex.from_arrays(
        [iso["year"].to_numpy(), iso["week"].to_numpy()], names=["iso_year", "iso_week"]
    )
    frame = pd.DataFrame(daily, index=key)
    grouped = getattr(frame.groupby(level=[0, 1]), how)()
    long = grouped.stack(future_stack=True).rename(name).reset_index()
    long = long.rename(columns={"level_2": "cell_pos"})
    long["cell"] = cells["cell"].to_numpy()[long["cell_pos"].to_numpy()]
    return long.drop(columns="cell_pos")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=2014)
    parser.add_argument("--end", type=int, default=2026)
    parser.add_argument("--out", type=Path, default=Path("data/interim/weather_weekly.parquet"))
    parser.add_argument("--refresh-from", type=int, default=None,
                        help="nur ab diesem ISO-Jahr neu rechnen, den Rest "
                             "aus dem Zwischenspeicher uebernehmen")
    parser.add_argument("--cells-from", type=Path, default=None,
                        help="keep only the cells in this occurrence file")
    args = parser.parse_args()

    cells, lookup = build_cell_index(args.start, args.cells_from)
    n_cells = len(cells)

    # HYRAS shares the model projection, so its pixels map straight to cells.
    reference = sorted(glob.glob(f"data/raw/dwd/hyras/precipitation/*_{args.start}_*.nc"))[-1]
    ref = xr.open_dataset(reference)
    hyras_map = flat_map(*pixel_cells(ref.x.values, ref.y.values, None), lookup, n_cells)
    print(f"hyras pixels inside cells: {(hyras_map >= 0).sum()}")

    # The soil grid needs a projection change first.
    soil_ref = sorted(glob.glob(f"data/raw/dwd/soil_moisture/spruce/*_{args.start}_*.nc"))[-1]
    sref = xr.open_dataset(soil_ref)
    to_model = Transformer.from_crs(SOIL_CRS, MODEL_CRS, always_xy=True)
    soil_map = flat_map(*pixel_cells(sref.x.values, sref.y.values, to_model), lookup, n_cells)
    print(f"soil pixels inside cells: {(soil_map >= 0).sum()}")

    jobs = [(f"data/raw/dwd/hyras/{folder}", var, how, hyras_map, var, None)
            for folder, var, how in HYRAS_VARS]
    jobs += [(f"data/raw/dwd/soil_moisture/{tree}", "paws", "mean", soil_map,
              f"paws_{tree}", None)
             for tree in TREE_SPECIES]
    jobs += [(f"data/raw/dwd/hyras/{folder}", var, how, hyras_map, name, bau())
             for folder, var, how, name, bau in HYRAS_TAGE]

    checkpoints = args.out.parent / "weekly"
    checkpoints.mkdir(parents=True, exist_ok=True)

    collected: list[pd.Series] = []
    for folder, var, how, mapping, name, tagesmass in jobs:
        cache = checkpoints / f"{name}.parquet"
        alt = None
        if cache.exists():
            if args.refresh_from is None:
                frame = pd.read_parquet(cache)
                print(f"{name}: {len(frame)} cell-weeks (from cache)", flush=True)
                collected.append(frame.set_index(["iso_year", "iso_week", "cell"])[name])
                continue
            # Nur das laufende Jahr neu rechnen. Der Rest steht fest, und ihn
            # jede Woche aus dreizehn Jahren Rohdaten neu zu ziehen hiesse,
            # das ganze Archiv vorhalten zu muessen.
            alt = pd.read_parquet(cache)
            alt = alt[alt["iso_year"] < args.refresh_from]
        transformer = None if mapping is hyras_map else to_model
        parts = []
        # Eine ISO-Woche kann ueber den Jahreswechsel reichen, also faengt die
        # Auffrischung ein Jahr frueher an und behaelt davon nichts.
        von = args.start if alt is None else max(args.start, args.refresh_from - 1)
        for year in range(von, args.end + 1):
            found = sorted(glob.glob(f"{folder}/*_{year}_*.nc"))
            if not found:
                continue
            daily, dates = daily_cell_means(found[-1], var, mapping, n_cells,
                                            lookup, transformer)
            if tagesmass is not None:
                daily = tagesmass(daily)
            parts.append(weekly(daily, dates, how, cells, name))
        if not parts:
            print(f"{name}: no files, skipped")
            continue
        frame = pd.concat(parts, ignore_index=True)
        # An ISO week can straddle two year files. Combine the pieces.
        frame = getattr(frame.groupby(["iso_year", "iso_week", "cell"], as_index=False)[name],
                        how if how != "sum" else "sum")()
        if alt is not None:
            neu = frame[frame["iso_year"] >= args.refresh_from]
            frame = pd.concat([alt, neu], ignore_index=True)
            print(f"{name}: {len(alt)} alte plus {len(neu)} neue Zell-Wochen",
                  flush=True)
        frame.to_parquet(cache, index=False)
        print(f"{name}: {len(frame)} cell-weeks", flush=True)
        collected.append(frame.set_index(["iso_year", "iso_week", "cell"])[name])

    # Every variable carries the same cell-week keys, so join on the index in
    # one step. Repeated outer merges on ten million rows are much slower.
    result = pd.concat(collected, axis=1).reset_index()
    for name in result.columns:
        if result[name].dtype == "float64":
            result[name] = result[name].astype("float32")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    result.to_parquet(args.out, index=False)
    print(f"\nwrote {len(result)} rows to {args.out}")
    print(result.head().to_string())


if __name__ == "__main__":
    main()
