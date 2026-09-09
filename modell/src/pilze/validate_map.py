#!/usr/bin/env python3
"""Judge the map with visits the model never saw.

final_model.py trains one model per held-out year and writes the calibrated
prediction of every visit in that year to a parquet file. This script reads
those out-of-fold values and asks two questions.

  rank    For every visit that found the species: where does its value sit
          among all visits of the same week? A worthless model puts a real
          find at the 50th percentile on average. The higher, the better the
          model put its colour where the mushrooms were. Only weeks with at
          least twenty visits count, so a percentile means something.

  height  Does a value of 0.3 mean a 30 percent chance? The table groups the
          visits by decile of the prediction and compares the mean prediction
          with the observed rate.

An earlier version of this script read the values from the finished map
images. That map came from the model refit on all years, so every find had
been in the training data. The numbers looked good and meant nothing.

Usage:
    python validate_map.py --name boletus_edulis
    python validate_map.py --name boletus_edulis --horizon 2
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="boletus_edulis")
    parser.add_argument("--horizon", type=int, default=0)
    parser.add_argument("--oof", type=Path, default=Path("data/processed"))
    parser.add_argument("--min-visits", type=int, default=20,
                        help="weeks with fewer visits are skipped in the rank test")
    parser.add_argument("--reference-species", type=int, default=4,
                        help="the map's reference effort; visits near it are "
                             "reported separately")
    args = parser.parse_args()

    path = args.oof / f"oof_{args.name}_h{args.horizon}.parquet"
    if not path.exists():
        raise SystemExit(f"{path} fehlt — erst final_model.py laufen lassen")
    table = pd.read_parquet(path)
    print(f"{args.name}, horizon {args.horizon}: {len(table)} held-out visits, "
          f"{int(table['label'].sum())} finds, {table['iso_year'].min()} to "
          f"{table['iso_year'].max()}")

    rows = []
    for (year, week), group in table.groupby(["iso_year", "iso_week"]):
        if len(group) < args.min_visits or group["label"].sum() == 0:
            continue
        spread = group["p"].to_numpy()
        for value in group.loc[group["label"] == 1, "p"]:
            rows.append({"year": year, "week": week, "p": float(value),
                         "percentile": float((spread < value).mean() * 100)})
    ranks = pd.DataFrame(rows)
    print(f"\nfinds in weeks with at least {args.min_visits} visits: {len(ranks)}")
    print(f"  median percentile of a real find: {ranks['percentile'].median():.1f}")
    print(f"  mean percentile:                  {ranks['percentile'].mean():.1f}")
    print("  (50 would mean the model says nothing)")
    for cut in (50, 75, 90, 95):
        share = (ranks["percentile"] >= cut).mean() * 100
        print(f"  finds among the top {100-cut:2d}% of the week's visits: {share:5.1f}%"
              f"   (chance: {100-cut}%)")

    print("\ncalibration, by decile of the prediction")
    table["bucket"] = pd.qcut(table["p"], 10, labels=False, duplicates="drop")
    summary = table.groupby("bucket").agg(predicted=("p", "mean"),
                                          observed=("label", "mean"), n=("label", "size"))
    print(f"  {'decile':>6s} {'predicted':>10s} {'observed':>9s} {'n':>7s}")
    for bucket, row in summary.iterrows():
        print(f"  {int(bucket):6d} {row['predicted']:10.3f} {row['observed']:9.3f} "
              f"{int(row['n']):7d}")

    near = table[table["n_species"].between(args.reference_species - 1,
                                            args.reference_species + 1)]
    if len(near):
        print(f"\nvisits with {args.reference_species - 1} to {args.reference_species + 1} "
              f"species, the effort the map assumes: {len(near)}")
        print(f"  mean prediction {near['p'].mean():.3f}   observed rate "
              f"{near['label'].mean():.3f}")
        season = near[near["iso_week"].between(36, 44)]
        if len(season):
            print(f"  in weeks 36 to 44: predicted {season['p'].mean():.3f}   "
                  f"observed {season['label'].mean():.3f}   n {len(season)}")


if __name__ == "__main__":
    main()
