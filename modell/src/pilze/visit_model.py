#!/usr/bin/env python3
"""Model a visit, not a cell-week.

A visit is one observer, on one day, inside one square kilometre. This unit
solves three problems at once.

  A real absence. If somebody recorded twenty species in a square kilometre on
  one day and the target was not among them, the target was probably not
  fruiting there. A cell-week with no record says only that nobody looked.

  Effort becomes a control, not a leak. The number of species in the visit
  measures how hard the person looked. The model holds it constant, and a
  forecast sets it to a reference value: what a careful walk would find.

  Fine space. A visit sits in one square kilometre, not in twenty-five.

The rate of the target among visits rises from 1.4 percent for a visit of one
record to 30 percent for a visit of twenty species. Almost all of that is
detection, not habitat. A model that ignores it learns the wrong thing.

The table carries four kinds of input: detection, season, weather with lags,
tree shares at four radii, and the recent fungal activity around the visit.
Terrain, soil and geology were measured on three species and gave nothing
(Steinpilz 0.8627 to 0.8635 AUC, Nebelkappe 0.8981 to 0.8979, Birkenpilz
0.8342 to 0.8346), so this script no longer reads them.

The activity around a visit is computed here, in `ActivityFields`, and the
map scripts call the same class. Two definitions of the same feature in two
files gave the map values 40 to 60 percent above the ones the model had
learned on.

Usage:
    python visit_model.py --species "Boletus edulis" --min-species 2
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.ndimage import convolve, map_coordinates
from sklearn.metrics import average_precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).parent))
from build_dataset import add_anomalies, add_lags, week_number
from build_occurrences import APP, GBIF, visit_gate

PARAMS = dict(objective="binary", learning_rate=0.05, num_leaves=31,
              min_data_in_leaf=40, feature_fraction=0.8, bagging_fraction=0.8,
              bagging_freq=1, verbosity=-1, num_threads=8)
ROUNDS = 300

DETECTION = ["n_records", "n_species"]
SEASON = ["iso_week", "week_sin", "week_cos"]
WINDOWS = (7, 14, 21)
BLOCK_M = 25_000
# The horizons the final model is built for, in weeks. Zero serves the weeks
# that already happened, two serves the forecast.
HORIZONS = (0, 2)


def activity_names(horizon: int = 0) -> list[str]:
    """Column names of the activity features for one horizon."""
    suffix = f"_h{horizon}" if horizon else ""
    return [f"activity_rate_{w}d{suffix}" for w in WINDOWS]


def build_visits(occ: pd.DataFrame, species: str, min_species: int) -> pd.DataFrame:
    """Reduce the records to one row per visit.

    The min-species gate keeps a visit only if the person named at least
    `min_species` species. That is what turns a visit without the target into
    a real absence: somebody looked hard and did not find it.

    A find from the app is the one exception. `visit_gate` in
    `build_occurrences.py` holds the rule and says why.
    """
    occ = occ[occ["recordedByHash"].notna()].copy()
    # An occurrence table written before the app existed has no basis column.
    if "basis" not in occ.columns:
        occ["basis"] = GBIF
    occ["km_x"] = (occ["x"] // 1000).astype(int)
    occ["km_y"] = (occ["y"] // 1000).astype(int)
    occ["visit"] = (occ["recordedByHash"].astype(str) + "|" + occ["date"].astype(str)
                    + "|" + occ["km_x"].astype(str) + "_" + occ["km_y"].astype(str))
    wanted = [n.strip() for n in species.split(",")]
    occ["is_target"] = occ["species"].isin(wanted).astype("int8")
    occ["from_app"] = (occ["basis"] == APP).astype("int8")
    visits = occ.groupby("visit").agg(
        n_records=("gbifID", "size"),
        n_species=("species", "nunique"),
        label=("is_target", "max"),
        from_app=("from_app", "max"),
        lon=("decimalLongitude", "mean"),
        lat=("decimalLatitude", "mean"),
        x=("x", "mean"), y=("y", "mean"),
        cell=("cell", "first"),
        date=("date", "first"),
        iso_year=("iso_year", "first"),
        iso_week=("iso_week", "first"),
    ).reset_index()
    print(f"visits: {len(visits)}   rate: {visits['label'].mean():.2%}")
    visits = visits[visit_gate(visits, min_species)].reset_index(drop=True)
    print(f"visits with at least {min_species} species: {len(visits)}   "
          f"rate: {visits['label'].mean():.2%}   positive: {int(visits['label'].sum())}   "
          f"from the app: {int(visits['from_app'].sum())}")
    return visits


class ActivityFields:
    """How much fungus is being found near a point, just before a date.

    Weather only stands in for fruiting. This measures fruiting itself. If
    many people found the target around here in the last weeks, the flush is
    on. Only the rate survives: the share of observer-days that found the
    target. The count of observer-days is survey effort, and a model that saw
    it painted a bright square over a well-visited part of the Black Forest
    where no chanterelle had been reported for three weeks.

    The fields live on 25 km blocks and days. A block borrows from its eight
    neighbours, and a point between two blocks reads a value between the two,
    so the map shows no 25 km squares.

    A window ends the day before the target date, shifted back by the
    horizon: a model that predicts two weeks ahead may only read what was
    known two weeks before the target week.
    """

    def __init__(self, occ: pd.DataFrame, species_names: list[str],
                 block_m: int = BLOCK_M):
        self.size = block_m
        occ = occ[occ["recordedByHash"].notna()]
        day = pd.to_datetime(occ["date"]).dt.normalize()
        frame = pd.DataFrame({
            "bx": (occ["x"].to_numpy() // block_m).astype(int),
            "by": (occ["y"].to_numpy() // block_m).astype(int),
            "day": day.to_numpy(),
            "who": occ["recordedByHash"].to_numpy(),
            "target": occ["species"].isin(species_names).to_numpy().astype("int8")})
        per_visit = frame.groupby(["bx", "by", "day", "who"], observed=True).agg(
            target=("target", "max")).reset_index()
        daily = per_visit.groupby(["bx", "by", "day"], observed=True).agg(
            visits=("target", "size"), targets=("target", "sum")).reset_index()

        self.day0 = daily["day"].min()
        days = pd.date_range(self.day0, daily["day"].max(), freq="D")
        self.n_days = len(days)
        # A full range of blocks, not only the ones that hold a record. A gap
        # in the list would put the neighbours of a block at the wrong index.
        self.x0, self.y0 = int(daily["bx"].min()), int(daily["by"].min())
        shape = (int(daily["bx"].max()) - self.x0 + 1,
                 int(daily["by"].max()) - self.y0 + 1, self.n_days)
        counts = np.zeros(shape, dtype="float32")
        hits = np.zeros(shape, dtype="float32")
        ix = daily["bx"].to_numpy() - self.x0
        iy = daily["by"].to_numpy() - self.y0
        it = ((daily["day"] - self.day0).dt.days).to_numpy()
        counts[ix, iy, it] = daily["visits"].to_numpy()
        hits[ix, iy, it] = daily["targets"].to_numpy()
        kernel = np.ones((3, 3, 1), dtype="float32")
        counts = convolve(counts, kernel, mode="constant")
        hits = convolve(hits, kernel, mode="constant")

        pad = np.zeros(shape[:2] + (1,), dtype="float32")
        c = np.concatenate([pad, np.cumsum(counts, axis=2)], axis=2)
        h = np.concatenate([pad, np.cumsum(hits, axis=2)], axis=2)
        idx = np.arange(self.n_days)
        self.rate: dict[int, np.ndarray] = {}
        for window in WINDOWS:
            lo = np.clip(idx - window, 0, None)
            # c[:, :, i] sums the days before day i, so day i itself and every
            # record of that day stay out of the window.
            window_counts = c[:, :, idx] - c[:, :, lo]
            window_hits = h[:, :, idx] - h[:, :, lo]
            self.rate[window] = (window_hits / np.maximum(window_counts, 1)).astype("float32")

    def sample(self, x: np.ndarray, y: np.ndarray, dates, horizon: int = 0) -> pd.DataFrame:
        """Read the rates at points, for dates, with a horizon in weeks.

        `dates` is one date per point or a single date for all points.
        """
        x = np.asarray(x, dtype="float64")
        y = np.asarray(y, dtype="float64")
        n = len(x)
        # A block covers [i, i + 1) in block units, so its centre must map to
        # index i, not to i + 0.5.
        fx = x / self.size - self.x0 - 0.5
        fy = y / self.size - self.y0 - 0.5
        stamp = pd.to_datetime(pd.Series(dates if np.ndim(dates) else [dates] * n))
        day = ((stamp.dt.normalize() - self.day0).dt.days.to_numpy(dtype="float64")
               - 7 * horizon)
        good = np.isfinite(day) & (day >= 0)
        # A date past the record reads the last known day. That happens for a
        # forecast week, and the window then ends where the data ends.
        day = np.clip(day, 0, self.n_days - 1)
        out = {}
        for window in WINDOWS:
            values = np.full(n, np.nan, dtype="float32")
            if good.any():
                coords = np.vstack([fx[good], fy[good], day[good]])
                values[good] = map_coordinates(self.rate[window], coords, order=1,
                                               mode="nearest")
            out[f"activity_rate_{window}d"] = values
        frame = pd.DataFrame(out)
        if horizon:
            frame.columns = [f"{c}_h{horizon}" for c in frame.columns]
        return frame


def folds(frame: pd.DataFrame, scheme: str):
    key = (frame["iso_year"].to_numpy() if scheme == "year"
           else (frame["x"].to_numpy() // 100_000).astype(int))
    out = []
    for group in sorted(pd.unique(key)):
        test = np.flatnonzero(key == group)
        train = np.flatnonzero(key != group)
        if len(test) < 100 or frame["label"].to_numpy()[test].sum() < 10:
            continue
        out.append((train, test))
    return out


def run(frame, features, splits):
    x, y = frame[features], frame["label"].to_numpy()
    aucs, aps, models = [], [], []
    for train, test in splits:
        model = lgb.train(PARAMS, lgb.Dataset(x.iloc[train], label=y[train]),
                          num_boost_round=ROUNDS)
        p = model.predict(x.iloc[test])
        if 0 < y[test].sum() < len(test):
            aucs.append(roc_auc_score(y[test], p))
            aps.append(average_precision_score(y[test], p))
        models.append(model)
    return float(np.mean(aucs)), float(np.std(aucs)), float(np.mean(aps)), models


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occurrences", type=Path,
                        default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--weather", type=Path,
                        default=Path("data/interim/weather_weekly.parquet"))
    parser.add_argument("--species", default="Boletus edulis")
    parser.add_argument("--min-species", type=int, default=2)
    parser.add_argument("--min-year", type=int, default=2015)
    parser.add_argument("--max-uncertainty", type=float, default=500.0)
    parser.add_argument("--tree-scales", type=Path,
                        default=Path("data/interim/tree_scales.parquet"))
    parser.add_argument("--save-prepared", type=Path, default=None,
                        help="write the prepared visit table, for other scripts")
    parser.add_argument("--quick", action="store_true",
                        help="build the table and skip the comparison of feature sets")
    args = parser.parse_args()

    occ = pd.read_parquet(args.occurrences)
    occ = occ[occ["iso_year"] >= args.min_year]
    error = occ["coordinateUncertaintyInMeters"]
    occ = occ[error.isna() | (error <= args.max_uncertainty)]
    visits = build_visits(occ, args.species, args.min_species)
    if visits["label"].sum() < 100:
        raise SystemExit("too few positive visits")

    print("measuring recent fungal activity around each visit ...")
    species_names = [n.strip() for n in args.species.split(",")]
    fields = ActivityFields(occ, species_names)
    activity: dict[int, list[str]] = {}
    for horizon in HORIZONS:
        sampled = fields.sample(visits["x"].to_numpy(), visits["y"].to_numpy(),
                                visits["date"], horizon)
        visits = pd.concat([visits, sampled], axis=1)
        activity[horizon] = list(sampled.columns)
    print(f"  {sum(len(v) for v in activity.values())} activity columns")

    # The tree map is joined at two scales. Measured on Baden-Wuerttemberg,
    # the fine scale alone beat the coarse one by 0.6 AUC and both together
    # beat either alone by 0.8. The fine scale says which stand the visit was
    # in, the coarse one says what forest surrounds it, and a mycorrhizal
    # fungus depends on both.
    visits["cell_fine"] = ((visits["x"] // 500).astype(int).astype(str) + "_"
                           + (visits["y"] // 500).astype(int).astype(str))
    if not args.tree_scales.exists():
        raise SystemExit(f"{args.tree_scales} fehlt — erst tree_scales.py laufen lassen")
    extra = pd.read_parquet(args.tree_scales)
    extra = extra.drop(columns=[c for c in ("x", "y", "cell_x", "cell_y") if c in extra])
    extra = extra.rename(columns={"cell": "cell_fine"})
    visits = visits.merge(extra, on="cell_fine", how="left")
    trees = [c for c in extra.columns if c != "cell_fine"]
    print(f"  tree scales: {len(trees)} columns joined")

    weather = pd.read_parquet(args.weather)
    weather["cell"] = weather["cell"].astype(str)
    weather = weather[weather["cell"].isin(set(visits["cell"]))].copy()
    weather["week_id"] = week_number(weather)
    weather = add_anomalies(add_lags(weather))
    weather_names = [c for c in weather.columns
                     if "_lag" in c or "_sum" in c or "_mean" in c
                     or c.startswith("tas_drop") or c.endswith(("_anom", "_ratio"))]
    visits["week_id"] = week_number(visits)
    visits = visits.merge(weather.drop(columns=["iso_year", "iso_week"]),
                          on=["cell", "week_id"], how="inner")
    visits = visits.dropna(subset=[c for c in weather_names if "_lag" in c])
    visits["week_sin"] = np.sin(2 * np.pi * visits["iso_week"] / 52.0)
    visits["week_cos"] = np.cos(2 * np.pi * visits["iso_week"] / 52.0)
    print(f"visits with weather: {len(visits)}   "
          f"positive: {int(visits['label'].sum())} ({visits['label'].mean():.2%})")

    print(f"\nfeature blocks: trees={len(trees)} weather={len(weather_names)} "
          f"activity={len(activity[0])}")
    if args.save_prepared:
        args.save_prepared.parent.mkdir(parents=True, exist_ok=True)
        keep = dict(detection=DETECTION, season=SEASON, weather=weather_names,
                    trees=trees, activity=activity[0],
                    **{f"activity_h{h}": activity[h] for h in HORIZONS if h})
        visits.to_parquet(args.save_prepared, index=False)
        args.save_prepared.with_suffix(".blocks.json").write_text(json.dumps(keep, indent=1))
        print(f"saved prepared visits to {args.save_prepared}")
    if args.quick:
        return

    sets = {
        "activity_only": activity[0],
        "detection_only": DETECTION,
        "season": DETECTION + SEASON,
        "season_weather": DETECTION + SEASON + weather_names,
        "w_trees": DETECTION + SEASON + weather_names + trees,
        "w_activity": DETECTION + SEASON + weather_names + activity[0],
        "best": DETECTION + SEASON + weather_names + trees + activity[0],
    }
    for scheme in ("year", "space"):
        splits = folds(visits, scheme)
        print(f"\n=== blocked by {scheme}: {len(splits)} folds ===")
        for label, features in sets.items():
            auc, std, ap, _ = run(visits, features, splits)
            print(f"  {label:16s} AUC {auc:.4f} (+/- {std:.4f})   AP {ap:.4f}   "
                  f"base {visits['label'].mean():.4f}")


if __name__ == "__main__":
    main()
