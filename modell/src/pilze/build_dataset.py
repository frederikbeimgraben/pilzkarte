#!/usr/bin/env python3
"""Join the occurrences and the weather into one training table.

The table has one row for each cell-week that holds at least one record of the
target group. This is the target-group background. The label says whether the
target appears in that cell-week.

The first run showed that the three effort columns beat every other feature
together. Those columns count what happened in the same week, so nobody can
know them in advance. This version therefore builds three kinds of feature.

  now      the effort in the same cell-week. Useful to measure, useless to
           forecast. Keep them so that the ablation can show the difference.
  prior    what happened in this cell in earlier years only. A forecast can
           use these, because they are known before the week starts.
  weather  lagged rain, temperature and soil moisture, plus the anomaly of
           each against the normal value for that cell in that week.

The anomaly matters because 90 percent nFK means one thing on a dry sand and
another thing on a wet loam. The difference from the normal value carries the
signal that the raw value hides.

Usage:
    python build_dataset.py --species "Boletus edulis" --out data/processed/boletus.parquet
    python build_dataset.py --genus Boletus,Imleria,Leccinum --out data/processed/boletes.parquet
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

LAGS = (0, 1, 2, 3, 4, 6, 8)
# The DWD soil moisture per tree species is left out on purpose. It was tried
# as a raw value, as an anomaly and as a ratio, and it never reached the top
# thirty features by gain. Removing its 48 columns raised the AUC from 0.8448
# to 0.8483 and the AP from 0.3439 to 0.3478, because it diluted the features
# that work. It carries signal alone (AUC 0.784) but nothing that the rainfall
# columns do not already carry.
LAG_VARS = ("pr", "tas", "tasmin")
WINDOWS = (2, 4, 8)
ANOMALY_VARS = ("pr_sum4", "pr_sum8", "tas")


def week_number(frame: pd.DataFrame) -> pd.Series:
    return frame["iso_year"].astype(int) * 53 + frame["iso_week"].astype(int)


def add_lags(weather: pd.DataFrame) -> pd.DataFrame:
    weather = weather.sort_values(["cell", "week_id"]).reset_index(drop=True)
    grouped = weather.groupby("cell", sort=False, observed=True)
    new = {}
    for var in LAG_VARS:
        if var not in weather.columns:
            continue
        for lag in LAGS:
            new[f"{var}_lag{lag}"] = grouped[var].shift(lag)
        how = "sum" if var == "pr" else "mean"
        tag = "sum" if var == "pr" else "mean"
        for window in WINDOWS:
            rolled = grouped[var].rolling(window, min_periods=window)
            new[f"{var}_{tag}{window}"] = getattr(rolled, how)().reset_index(level=0, drop=True)
    if "tas" in weather.columns:
        new["tas_drop_2w"] = grouped["tas"].shift(2) - weather["tas"]
        new["tas_drop_4w"] = grouped["tas"].shift(4) - weather["tas"]
    return pd.concat([weather, pd.DataFrame(new, index=weather.index)], axis=1)


def add_anomalies(weather: pd.DataFrame) -> pd.DataFrame:
    """Subtract the normal value of a cell in that week of the year.

    The normal value uses every year in the record. Weather climatology is not
    the label, so this does not leak the answer.
    """
    new = {}
    for var in ANOMALY_VARS:
        if var not in weather.columns:
            continue
        normal = weather.groupby(["cell", "iso_week"], observed=True)[var].transform("mean")
        new[f"{var}_anom"] = weather[var] - normal
        if var.startswith("paws"):
            # A relative change describes a dry spell better than a difference.
            new[f"{var}_ratio"] = weather[var] / normal.replace(0, np.nan)
    return pd.concat([weather, pd.DataFrame(new, index=weather.index)], axis=1)


def prior_features(occ: pd.DataFrame, target: pd.Series) -> pd.DataFrame:
    """Count what happened in a cell in earlier years only.

    A forecast may use these values, because a year is complete before the
    next one starts. The count for year y uses the years before y and never
    the year itself.
    """
    occ = occ.assign(is_target=target.astype("int8"))
    per_year = (occ.groupby(["cell", "iso_year"], observed=True)
                   .agg(records=("gbifID", "size"), targets=("is_target", "sum"))
                   .reset_index()
                   .sort_values(["cell", "iso_year"]))
    grouped = per_year.groupby("cell", observed=True)
    per_year["cell_records_prior"] = (grouped["records"].cumsum() - per_year["records"])
    per_year["cell_targets_prior"] = (grouped["targets"].cumsum() - per_year["targets"])
    per_year["cell_years_prior"] = grouped.cumcount()
    per_year["cell_target_rate_prior"] = (
        per_year["cell_targets_prior"] / per_year["cell_records_prior"].clip(lower=1))

    # The same idea, but for one week of the year in that cell.
    per_week = (occ.groupby(["cell", "iso_week", "iso_year"], observed=True)
                   .agg(records=("gbifID", "size"), targets=("is_target", "sum"))
                   .reset_index()
                   .sort_values(["cell", "iso_week", "iso_year"]))
    wgrouped = per_week.groupby(["cell", "iso_week"], observed=True)
    per_week["cellweek_records_prior"] = wgrouped["records"].cumsum() - per_week["records"]
    per_week["cellweek_targets_prior"] = wgrouped["targets"].cumsum() - per_week["targets"]
    return (per_year.drop(columns=["records", "targets"]),
            per_week.drop(columns=["records", "targets"]))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occurrences", type=Path,
                        default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--weather", type=Path,
                        default=Path("data/interim/weather_weekly.parquet"))
    parser.add_argument("--species", default=None, help="one species name")
    parser.add_argument("--genus", default=None, help="comma separated genus names")
    parser.add_argument("--out", type=Path, default=Path("data/processed/dataset.parquet"))
    parser.add_argument("--min-year", type=int, default=2015)
    parser.add_argument("--site", type=Path, default=Path("data/interim/site.parquet"))
    parser.add_argument("--trees", type=Path, default=Path("data/interim/trees.parquet"))
    parser.add_argument("--geology", type=Path, default=Path("data/interim/geology.parquet"))
    args = parser.parse_args()

    occ = pd.read_parquet(args.occurrences)
    occ = occ[(occ["iso_year"] >= args.min_year - 3) & (occ["iso_year"] <= 2026)]

    if args.species:
        is_target = occ["species"] == args.species
        label_name = args.species
    elif args.genus:
        names = [g.strip() for g in args.genus.split(",")]
        is_target = occ["genus"].isin(names)
        label_name = "+".join(names)
    else:
        raise SystemExit("give --species or --genus")
    print(f"target: {label_name}   records: {int(is_target.sum())}")

    year_prior, week_prior = prior_features(occ, is_target)

    occ = occ[occ["iso_year"] >= args.min_year]
    background = (occ.groupby(["cell", "iso_year", "iso_week"], as_index=False)
                     .agg(n_records=("gbifID", "size"),
                          n_species=("species", "nunique"),
                          n_observers=("recordedByHash", "nunique")))
    hits = (occ[is_target.loc[occ.index]]
            .groupby(["cell", "iso_year", "iso_week"], as_index=False)
            .agg(n_target=("gbifID", "size")))
    print(f"background cell-weeks: {len(background)}   with target: {len(hits)}")
    if len(hits) < 100:
        raise SystemExit("too few target records for a model")

    data = background.merge(hits, on=["cell", "iso_year", "iso_week"], how="left")
    data["label"] = data["n_target"].notna().astype("int8")
    data = data.drop(columns="n_target")
    print(f"positive rate: {data['label'].mean():.4f}")

    data = data.merge(year_prior, on=["cell", "iso_year"], how="left")
    data = data.merge(week_prior, on=["cell", "iso_week", "iso_year"], how="left")
    prior_cols = [c for c in data.columns if c.endswith("_prior")]
    data[prior_cols] = data[prior_cols].fillna(0)

    # Site properties: terrain, soil, and later the tree species and the rock.
    # These describe the place and do not change between years, so a forecast
    # may always use them. They also travel into a region the model never saw,
    # which raw coordinates cannot do.
    for name, path in (("site", args.site), ("trees", args.trees),
                       ("geology", args.geology)):
        if path is None or not Path(path).exists():
            print(f"{name}: not present, skipped")
            continue
        extra = pd.read_parquet(path)
        extra = extra.drop(columns=[c for c in ("cell_x", "cell_y") if c in extra])
        for column in extra.columns:
            if column != "cell" and extra[column].dtype == object:
                extra[column] = extra[column].astype("category")
        before = len(data)
        data = data.merge(extra, on="cell", how="left")
        print(f"{name}: joined {len(extra.columns) - 1} columns "
              f"({before} rows kept: {len(data)})")

    weather = pd.read_parquet(args.weather)
    wanted = set(background["cell"].unique())
    weather["cell"] = weather["cell"].astype(str)
    weather = weather[weather["cell"].isin(wanted)].copy()
    weather["week_id"] = week_number(weather)
    weather = add_lags(weather)
    weather = add_anomalies(weather)
    print(f"weather rows with lags and anomalies: {len(weather)}, "
          f"{len(weather.columns)} columns")

    data["week_id"] = week_number(data)
    merged = data.merge(weather.drop(columns=["iso_year", "iso_week"]),
                        on=["cell", "week_id"], how="inner")

    # Name the generated weather columns instead of guessing them from a
    # substring. "_mean" also matches dem_mean and slope_mean from the site
    # data. When the site join gives nothing, a dropna on those two columns
    # deletes the whole table, which is what happened at a cell size of 2 km.
    generated = set(weather.columns) - {"cell", "week_id", "iso_year", "iso_week"}
    lag_cols = [c for c in merged.columns if c in generated and "_lag" in c]
    before = len(merged)
    merged = merged.dropna(subset=lag_cols)
    print(f"dropped {before - len(merged)} rows without a full lag history")

    merged["week_sin"] = np.sin(2 * np.pi * merged["iso_week"] / 52.0)
    merged["week_cos"] = np.cos(2 * np.pi * merged["iso_week"] / 52.0)
    parts = merged["cell"].str.split("_", expand=True)
    merged["cell_x"] = parts[0].astype(int)
    merged["cell_y"] = parts[1].astype(int)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    merged.to_parquet(args.out, index=False)
    print(f"\nwrote {len(merged)} rows, {int(merged['label'].sum())} positive, "
          f"{len(merged.columns)} columns, to {args.out}")


if __name__ == "__main__":
    main()
