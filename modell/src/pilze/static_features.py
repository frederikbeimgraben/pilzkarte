#!/usr/bin/env python3
"""Build one row of site properties for each model cell.

The model needs to know the place, not only the weather. The first run used the
raw cell coordinates for this, and they failed across regions: a model cannot
read a coordinate it never saw. Site properties travel much better. Two cells
on the same soil under the same trees behave alike, wherever they are.

The script uses GDAL to put every source on the model grid directly. A warp to
5 km with the average resampler gives the cell mean in one step, which is
faster and simpler than reading each source at full resolution.

  elevation   Copernicus DEM GLO-90. Mean, minimum and maximum per cell. The
              difference between maximum and minimum measures the relief.
  terrain     Slope, and the direction that the slope faces. A north slope
              gets less sun, stays cooler and holds water longer than a south
              slope at the same height. The script turns the aspect into
              northness and eastness before it takes a mean, because a mean of
              angles is wrong: 359 degrees and 1 degree average to 180.
  position    The topographic position index. It is the height of a cell minus
              the mean height around it. A negative value marks a hollow, which
              collects water. A positive value marks a ridge, which sheds it.
  soil        SoilGrids 250 m. Clay, sand, silt, pH, organic carbon, bulk
              density, coarse fragments and nitrogen, for three depths.

Run this in the geo shell, which holds GDAL and rasterio:

    nix develop .#geo --command python src/pilze/static_features.py
"""

from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio

# The cell size in meters. Set PILZE_CELL_SIZE to sweep the resolution.
CELL_SIZE = int(os.environ.get("PILZE_CELL_SIZE", 5000))
MODEL_CRS = "EPSG:3035"


def run(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"{command[0]} failed:\n{result.stderr[-2000:]}")


def grid_bounds(cells: pd.DataFrame) -> tuple[int, int, int, int]:
    """Return the model grid extent, aligned to the cell size."""
    x0 = int(cells["cell_x"].min()) * CELL_SIZE
    y0 = int(cells["cell_y"].min()) * CELL_SIZE
    x1 = (int(cells["cell_x"].max()) + 1) * CELL_SIZE
    y1 = (int(cells["cell_y"].max()) + 1) * CELL_SIZE
    return x0, y0, x1, y1


def warp(source: str, target: Path, bounds, resampler: str,
         src_nodata: str | None = None) -> Path:
    """Put a raster on the model grid.

    Give src_nodata when the source marks missing data with a value but does
    not declare it. Without that, an average pulls the missing value into the
    result. The SoilGrids layers write 0 over water and outside the land mask.
    """
    if target.exists():
        return target
    x0, y0, x1, y1 = bounds
    command = ["gdalwarp", "-q", "-overwrite",
               "-t_srs", MODEL_CRS,
               "-te", str(x0), str(y0), str(x1), str(y1),
               "-tr", str(CELL_SIZE), str(CELL_SIZE),
               "-r", resampler, "-of", "GTiff"]
    if src_nodata is not None:
        command += ["-srcnodata", src_nodata, "-dstnodata", "nan", "-ot", "Float32"]
    command += [source, str(target)]
    run(command)
    return target


def sample(path: Path, cells: pd.DataFrame, bounds) -> np.ndarray:
    """Read a warped raster and return one value per cell."""
    x0, y0, x1, y1 = bounds
    with rasterio.open(path) as src:
        band = src.read(1, masked=True).filled(np.nan).astype("float32")
        nodata = src.nodata
    columns = (cells["cell_x"].to_numpy() * CELL_SIZE - x0) // CELL_SIZE
    # The raster rows run from the top, the cell rows run from the bottom.
    rows = (y1 - (cells["cell_y"].to_numpy() + 1) * CELL_SIZE) // CELL_SIZE
    inside = ((rows >= 0) & (rows < band.shape[0])
              & (columns >= 0) & (columns < band.shape[1]))
    out = np.full(len(cells), np.nan, dtype="float32")
    out[inside] = band[rows[inside].astype(int), columns[inside].astype(int)]
    if nodata is not None:
        out[out == nodata] = np.nan
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occurrences", type=Path,
                        default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--cells", type=Path, default=None,
                        help="parquet with a complete cell grid, instead of the records")
    parser.add_argument("--work", type=Path, default=Path("data/interim/static"))
    parser.add_argument("--out", type=Path, default=Path("data/interim/site.parquet"))
    args = parser.parse_args()

    # The cell list may come from an occurrence table, which only covers the
    # places that hold a record, or from a complete grid. For the map the grid
    # is the right source: a layer with holes where nobody walked would look
    # like missing terrain rather than missing data.
    if args.cells is not None:
        grid = pd.read_parquet(args.cells)
        if "cell_x" not in grid.columns:
            grid["cell_x"] = (grid["x"] // CELL_SIZE).astype(int)
            grid["cell_y"] = (grid["y"] // CELL_SIZE).astype(int)
        cells = grid.drop_duplicates("cell")[["cell", "cell_x", "cell_y"]].reset_index(drop=True)
    else:
        occ = pd.read_parquet(args.occurrences, columns=["cell", "cell_x", "cell_y"])
        cells = occ.drop_duplicates("cell").reset_index(drop=True)
    bounds = grid_bounds(cells)
    print(f"cells: {len(cells)}   grid extent: {bounds}")
    args.work.mkdir(parents=True, exist_ok=True)

    table = cells[["cell", "cell_x", "cell_y"]].copy()

    # Elevation. One virtual raster over the tiles, then three warps.
    tiles = sorted(Path("data/raw/dem").glob("*.tif"))
    print(f"dem tiles: {len(tiles)}")
    vrt = args.work / "dem.vrt"
    if not vrt.exists():
        run(["gdalbuildvrt", "-q", str(vrt), *[str(t) for t in tiles]])
    for how, name in (("average", "dem_mean"), ("min", "dem_min"), ("max", "dem_max")):
        path = warp(str(vrt), args.work / f"{name}.tif", bounds, how)
        table[name] = sample(path, cells, bounds)
        print(f"  {name}: {np.isfinite(table[name]).sum()} cells with data")
    for column in ("dem_mean", "dem_min", "dem_max"):
        table.loc[table[column] < -20, column] = np.nan
    table["dem_relief"] = table["dem_max"] - table["dem_min"]

    # Terrain. Work at 90 m in the model projection, then reduce to the cells.
    dem90 = args.work / "dem90_3035.tif"
    if not dem90.exists():
        x0, y0, x1, y1 = bounds
        run(["gdalwarp", "-q", "-overwrite", "-t_srs", MODEL_CRS,
             "-te", str(x0), str(y0), str(x1), str(y1),
             "-tr", "90", "90", "-r", "bilinear", str(vrt), str(dem90)])
    slope90 = args.work / "slope90.tif"
    if not slope90.exists():
        run(["gdaldem", "slope", "-q", "-compute_edges", str(dem90), str(slope90)])
    aspect90 = args.work / "aspect90.tif"
    if not aspect90.exists():
        run(["gdaldem", "aspect", "-q", "-compute_edges", "-zero_for_flat",
             str(dem90), str(aspect90)])

    # An angle cannot be averaged directly. Split it into two components first.
    for name, function in (("northness", np.cos), ("eastness", np.sin)):
        target = args.work / f"{name}90.tif"
        if not target.exists():
            with rasterio.open(aspect90) as src:
                profile = src.profile
                profile.update(dtype="float32", count=1, compress="deflate")
                with rasterio.open(target, "w", **profile) as dst:
                    for _, window in src.block_windows(1):
                        angle = src.read(1, window=window, masked=True)
                        value = function(np.deg2rad(angle.filled(np.nan)))
                        dst.write(value.astype("float32"), 1, window=window)
        path = warp(str(target), args.work / f"{name}.tif", bounds, "average")
        table[name] = sample(path, cells, bounds)

    path = warp(str(slope90), args.work / "slope.tif", bounds, "average")
    table["slope_mean"] = sample(path, cells, bounds)
    path = warp(str(slope90), args.work / "slope_max.tif", bounds, "max")
    table["slope_max"] = sample(path, cells, bounds)
    print(f"  terrain: slope, northness, eastness")

    # Topographic position: the height of a cell against its surroundings.
    # A hollow collects water and stays damp, a ridge dries out.
    from scipy.ndimage import uniform_filter
    with rasterio.open(args.work / "dem_mean.tif") as src:
        field = src.read(1, masked=True).filled(np.nan).astype("float32")
    filled = np.where(np.isfinite(field), field, np.nanmean(field))
    for cells_wide, label in ((5, "tpi_25km"), (11, "tpi_55km")):
        smooth = uniform_filter(filled, size=cells_wide, mode="nearest")
        tpi = np.where(np.isfinite(field), field - smooth, np.nan).astype("float32")
        target = args.work / f"{label}.tif"
        with rasterio.open(args.work / "dem_mean.tif") as src:
            profile = src.profile
            profile.update(dtype="float32", count=1, nodata=None)
        with rasterio.open(target, "w", **profile) as dst:
            dst.write(tpi, 1)
        table[label] = sample(target, cells, bounds)
    print(f"  position: tpi_25km, tpi_55km")

    # Soil.
    soils = sorted(Path("data/raw/soil").glob("*.tif"))
    print(f"soil rasters: {len(soils)}")
    for source in soils:
        name = f"soil_{source.stem.replace('_mean', '').replace('-', '_')}"
        path = warp(str(source), args.work / f"{name}.tif", bounds,
                    "average", src_nodata="0")
        table[name] = sample(path, cells, bounds)
    print(f"  soil columns: {sum(c.startswith('soil_') for c in table.columns)}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    table.to_parquet(args.out, index=False)
    print(f"\nwrote {len(table)} cells, {len(table.columns)} columns, to {args.out}")
    print(table.describe().T[["mean", "min", "max"]].to_string())


if __name__ == "__main__":
    main()
