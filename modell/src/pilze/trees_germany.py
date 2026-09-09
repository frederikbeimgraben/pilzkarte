#!/usr/bin/env python3
"""Fetch the tree map for all of Germany at 500 m, without gaps.

The earlier pass only kept cells that hold an occurrence record, which is
6 percent of the country. That is enough to look up the stand a visit sat in,
but not enough to ask what stands nearby: a neighbourhood measure over a grid
with 94 percent holes measures the holes.

The gap matters for the birch bolete. Birch is almost never the dominant tree
in southern Germany, so the fraction in a cell is near zero even where birch
grows scattered. What the fungus needs is a birch within reach, and that is a
neighbourhood question.

The same complete grid is what a map of all of Germany needs later, so this
runs once and serves both.

Usage:
    nix develop .#geo --command python src/pilze/trees_germany.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).parent))
import region_map as rm

GERMANY = (5.75, 47.15, 15.15, 55.15)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--step", type=int, default=500)
    parser.add_argument("--out", type=Path,
                        default=Path("data/interim/trees_de_500m.parquet"))
    parser.add_argument("--work", type=Path,
                        default=Path("data/interim/_work_de_trees"))
    args = parser.parse_args()

    to_model = Transformer.from_crs("EPSG:4326", rm.MODEL_CRS, always_xy=True)
    x0, y0 = to_model.transform(GERMANY[0], GERMANY[1])
    x1, y1 = to_model.transform(GERMANY[2], GERMANY[3])
    bounds = (int(x0 // args.step * args.step), int(y0 // args.step * args.step),
              int(x1 // args.step * args.step), int(y1 // args.step * args.step))
    cells = ((bounds[2] - bounds[0]) // args.step) * ((bounds[3] - bounds[1]) // args.step)
    print(f"extent {bounds}   step {args.step} m   {cells:,} cells")

    args.work.mkdir(parents=True, exist_ok=True)
    grid, shape = rm.tile_trees(bounds, args.step, args.work)
    grid["cell"] = ((grid["x"] // args.step).astype(int).astype(str) + "_"
                    + (grid["y"] // args.step).astype(int).astype(str))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    grid.to_parquet(args.out, index=False)
    print(f"\nwrote {len(grid):,} cells {shape} to {args.out} "
          f"({args.out.stat().st_size/1e6:.0f} MB)")
    forest = grid["forest_fraction"] > 0
    print(f"  cells with forest: {int(forest.sum()):,} ({forest.mean()*100:.0f}%)")


if __name__ == "__main__":
    main()
