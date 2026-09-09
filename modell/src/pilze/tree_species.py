#!/usr/bin/env python3
"""Measure the forest composition of every model cell.

The source is the map of dominant tree species for Germany, 2017 and 2018,
from the Thuenen Institute. It comes from Sentinel-1 and Sentinel-2 time
series together with the German National Forest Inventory. The step is 10 m
and the map holds eleven tree species classes.

This layer answers the question that broke the soil moisture features. The DWD
grids say what the soil moisture would be under spruce, beech, oak and pine,
but they do not say which tree grows in the cell. A mycorrhizal fungus needs
its host. Without the host the four soil moisture fields are four versions of
the same number.

The service holds the map in UTM zone 32. The model works in EPSG:3035. The
script therefore walks the model grid in tiles of 50 km, asks the service for
the matching area, warps the answer onto the model grid at 10 m, and counts
the classes in each block of 500 by 500 pixels. One block is one 5 km cell.

The script keeps no tile. It counts and deletes.

Run this in the geo shell:
    nix develop .#geo --command python src/pilze/tree_species.py
"""

from __future__ import annotations

import argparse
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer

CELL_SIZE = int(os.environ.get("PILZE_CELL_SIZE", 5000))
PIXEL = 10
TILE = 50_000
MODEL_CRS = "EPSG:3035"
SOURCE_CRS = "EPSG:32632"
WCS = "https://atlas.thuenen.de/geoserver/ows"
COVERAGE = "geonode__Dominant_Species_Class"
USER_AGENT = "pilze-research/0.1 (fungal fruiting phenology)"

# The class numbers of the published map, from its own legend, read with
# GetLegendGraphic in JSON form. Class 0 is everything that is not forest.
# An earlier guess at these names was wrong and produced 21 percent Douglas
# fir across Germany. The true class 3 is beech.
CLASSES = {
    2: "birch", 3: "beech", 4: "douglas_fir", 5: "oak", 6: "alder",
    8: "spruce", 9: "pine", 10: "larch", 14: "fir",
    16: "deciduous_long_lived", 17: "deciduous_short_lived",
}
CONIFERS = ("douglas_fir", "spruce", "pine", "larch", "fir")


def fetch(bounds_utm, target: Path, attempts: int = 4) -> bool:
    e0, n0, e1, n1 = bounds_utm
    query = urllib.parse.urlencode({
        "service": "WCS", "version": "2.0.1", "request": "GetCoverage",
        "coverageId": COVERAGE, "format": "image/tiff",
        "subset": [f"E({e0:.0f},{e1:.0f})", f"N({n0:.0f},{n1:.0f})"],
    }, doseq=True)
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(f"{WCS}?{query}", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=300) as response:
                body = response.read()
            if body[:4] not in (b"II*\x00", b"MM\x00*"):
                return False          # the service answered with an error report
            target.write_bytes(body)
            return True
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
            if attempt == attempts:
                return False
            time.sleep(10 * attempt)
    return False


def warp_to_model(source: Path, target: Path, bounds) -> bool:
    x0, y0, x1, y1 = bounds
    result = subprocess.run(
        ["gdalwarp", "-q", "-overwrite", "-t_srs", MODEL_CRS,
         "-te", str(x0), str(y0), str(x1), str(y1),
         "-tr", str(PIXEL), str(PIXEL), "-r", "near",
         "-dstnodata", "0", str(source), str(target)],
        capture_output=True, text=True)
    return result.returncode == 0 and target.exists()


def count_blocks(path: Path, x0: int, y1: int) -> dict:
    """Count the class of every pixel inside each 5 km cell of the tile."""
    per_cell: dict[tuple[int, int], np.ndarray] = {}
    side = CELL_SIZE // PIXEL
    with rasterio.open(path) as src:
        band = src.read(1)
    rows, cols = band.shape
    high = max(CLASSES) + 1
    for row in range(rows // side):
        for col in range(cols // side):
            block = band[row * side:(row + 1) * side, col * side:(col + 1) * side]
            counts = np.bincount(block.ravel(), minlength=high)[:high]
            if counts[1:].sum() == 0:
                continue                      # no forest in this cell
            cell_x = (x0 + col * CELL_SIZE) // CELL_SIZE
            cell_y = (y1 - (row + 1) * CELL_SIZE) // CELL_SIZE
            per_cell[(int(cell_x), int(cell_y))] = counts
    return per_cell


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occurrences", type=Path,
                        default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--out", type=Path, default=Path("data/interim/trees.parquet"))
    parser.add_argument("--work", type=Path, default=Path("data/interim/trees_work"))
    parser.add_argument("--pause", type=float, default=2.0)
    args = parser.parse_args()

    cells = pd.read_parquet(args.occurrences, columns=["cell_x", "cell_y"]).drop_duplicates()
    wanted = set(map(tuple, cells.to_numpy().astype(int)))
    x_min = int(cells["cell_x"].min()) * CELL_SIZE
    x_max = (int(cells["cell_x"].max()) + 1) * CELL_SIZE
    y_min = int(cells["cell_y"].min()) * CELL_SIZE
    y_max = (int(cells["cell_y"].max()) + 1) * CELL_SIZE
    print(f"cells: {len(wanted)}   model extent: {x_min},{y_min} .. {x_max},{y_max}")

    args.work.mkdir(parents=True, exist_ok=True)
    to_utm = Transformer.from_crs(MODEL_CRS, SOURCE_CRS, always_xy=True)

    totals: dict[tuple[int, int], np.ndarray] = {}
    tiles_x = range(x_min, x_max, TILE)
    tiles_y = range(y_min, y_max, TILE)
    total_tiles = len(tiles_x) * len(tiles_y)
    done = 0
    for tx in tiles_x:
        for ty in tiles_y:
            done += 1
            bounds = (tx, ty, tx + TILE, ty + TILE)
            # Skip a tile that holds no cell with a record.
            here = [(cx, cy) for cx in range(tx // CELL_SIZE, (tx + TILE) // CELL_SIZE)
                    for cy in range(ty // CELL_SIZE, (ty + TILE) // CELL_SIZE)
                    if (cx, cy) in wanted]
            if not here:
                continue
            # The tile is a rectangle in EPSG:3035 but not in UTM. Ask for the
            # box that covers all four corners, with a small margin.
            xs, ys = zip(*[to_utm.transform(x, y) for x in (bounds[0], bounds[2])
                           for y in (bounds[1], bounds[3])])
            utm_box = (min(xs) - 500, min(ys) - 500, max(xs) + 500, max(ys) + 500)
            raw = args.work / "tile.tif"
            warped = args.work / "tile_3035.tif"
            if not fetch(utm_box, raw):
                print(f"  [{done}/{total_tiles}] {tx},{ty}: no data", flush=True)
                continue
            if warp_to_model(raw, warped, bounds):
                for key, counts in count_blocks(warped, bounds[0], bounds[3]).items():
                    if key in wanted:
                        totals[key] = totals.get(key, 0) + counts
            raw.unlink(missing_ok=True)
            warped.unlink(missing_ok=True)
            print(f"  [{done}/{total_tiles}] {tx},{ty}: {len(totals)} cells so far", flush=True)
            time.sleep(args.pause)

    rows = []
    for (cell_x, cell_y), counts in totals.items():
        forest = int(counts[1:].sum())
        row = {"cell": f"{cell_x}_{cell_y}", "cell_x": cell_x, "cell_y": cell_y,
               "forest_pixels": forest,
               "forest_fraction": forest / (CELL_SIZE // PIXEL) ** 2}
        for value, name in CLASSES.items():
            row[f"tree_{name}"] = counts[value] / forest if forest else 0.0
        rows.append(row)
    frame = pd.DataFrame(rows)
    frame["tree_conifer"] = frame[[f"tree_{c}" for c in CONIFERS]].sum(axis=1)
    frame["tree_broadleaf"] = frame[[f"tree_{c}" for c in CLASSES.values()
                                     if c not in CONIFERS]].sum(axis=1)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(args.out, index=False)
    print(f"\nwrote {len(frame)} cells to {args.out}")
    print(frame[[c for c in frame.columns if c.startswith("tree_") or c == "forest_fraction"]]
          .describe().T[["mean", "max"]].to_string())


if __name__ == "__main__":
    main()
