#!/usr/bin/env python3
"""Turn the 500 m tree grid into continuous shares at several radii.

A mycorrhizal fungus needs its host near, not necessarily under, the point
where it fruits. The share in one 500 m cell answers a narrower question than
the fungus does, and for a tree that grows scattered rather than in stands it
answers it badly: birch is almost never dominant in southern Germany, so its
share reads near zero even where birch is present throughout.

The fix is not a presence flag but the same quantity at more scales. For every
class this writes the share of forest that is that species within 500 m, 1 km,
2 km and 5 km. The model then decides which scale matters, per species.

The share is weighted by forest, not averaged over cells. A plain mean would
let a cell holding two percent forest count as much as one holding ninety.

Usage:
    python tree_scales.py --grid data/interim/trees_de_500m.parquet
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.ndimage import uniform_filter

RADII_M = (1000, 2000, 5000)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grid", type=Path,
                        default=Path("data/interim/trees_de_500m.parquet"))
    parser.add_argument("--step", type=int, default=500)
    parser.add_argument("--out", type=Path,
                        default=Path("data/interim/tree_scales.parquet"))
    args = parser.parse_args()

    frame = pd.read_parquet(args.grid)
    classes = [c for c in frame.columns
               if c.startswith("tree_") and not c.endswith(("_5km", "_fine"))]
    print(f"{len(frame):,} cells, {len(classes)} classes")

    gx = frame["gx"].to_numpy()
    gy = frame["gy"].to_numpy()
    shape = (int(gy.max()) + 1, int(gx.max()) + 1)
    print(f"grid {shape}")

    # Work in pixel counts, so a wider radius is a sum, not a mean of means.
    forest = np.zeros(shape, dtype="float32")
    forest[gy, gx] = frame["forest_pixels"].to_numpy()
    counts = {}
    for name in classes:
        field = np.zeros(shape, dtype="float32")
        field[gy, gx] = frame[name].to_numpy() * frame["forest_pixels"].to_numpy()
        counts[name] = field

    out = frame[["cell", "x", "y"]].copy()
    out["forest_fraction_500m"] = frame["forest_fraction"].to_numpy()
    for name in classes:
        out[f"{name}_500m"] = frame[name].to_numpy()

    per_cell = (args.step // 10) ** 2       # 10 m pixels inside one cell
    for radius in RADII_M:
        size = max(3, int(round(radius * 2 / args.step)) | 1)   # odd window
        wide_forest = uniform_filter(forest, size=size, mode="constant") * size * size
        label = f"{radius // 1000}km"
        share_forest = wide_forest / (per_cell * size * size)
        out[f"forest_fraction_{label}"] = share_forest[gy, gx].astype("float32")
        for name in classes:
            wide = uniform_filter(counts[name], size=size, mode="constant") * size * size
            with np.errstate(invalid="ignore", divide="ignore"):
                share = np.where(wide_forest > 0, wide / np.maximum(wide_forest, 1), 0.0)
            out[f"{name}_{label}"] = share[gy, gx].astype("float32")
        print(f"  radius {radius} m, window {size} cells: done", flush=True)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(args.out, index=False)
    print(f"\nwrote {len(out):,} cells, {len(out.columns)} columns, "
          f"{args.out.stat().st_size/1e6:.0f} MB to {args.out}")
    birch = [c for c in out.columns if "birch" in c]
    print("\nbirch across scales, mean share of forest:")
    for c in birch:
        print(f"  {c:26s} {out[c].mean():.4f}   above 1 percent: "
              f"{(out[c] > 0.01).mean()*100:.0f}% of cells")


if __name__ == "__main__":
    main()
