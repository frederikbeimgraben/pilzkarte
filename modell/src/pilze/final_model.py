#!/usr/bin/env python3
"""Prune the features, tune, calibrate, and save one model per horizon.

For each horizon the script runs four steps.

  prior       Two features that no other column carries: the rate of the
              target among the visits of the same 5 km cell, and of the same
              25 km block, in the training years. They are built inside each
              fold from the training rows only, so a held-out year or a
              held-out band never leaks into them. Measured on Steinpilz and
              Parasol they add about 0.005 AUC and 0.013 AP.

  prune       1,800 positive visits cannot carry 80 columns. The script ranks
              the features by gain and keeps the smallest list that scores
              within a tolerance of the best one. A feature that does not earn
              its place goes.

  tune        A small grid of LightGBM settings on the chosen list. The
              default settings were never questioned; two hand tries on the
              Steinpilz gained as much as a new feature.

  calibrate   A gradient boosting score orders the rows well but is not a
              probability. Isotonic regression fixes the scale without
              changing the order. Its top bin saturates when a handful of
              points are all positive, so the output is capped at the rate
              seen in the top two percent of the calibration set. The cap is
              a number in the bundle, applied by every consumer, and the
              report below shows the capped values.

Two horizons come out of one run. Horizon 0 serves the weeks that already
happened and the running week. Horizon 2 serves the two forecast weeks: it
drops every weather column that reaches into the target week and the week
before it, including the temperature drop, and it reads the activity
features with their window shifted back two weeks.

The calibration never sees the rows it is judged on. Inside each fold the
training part is split again: the model learns on one part, the isotonic
curve learns on the other, and the test part stays untouched. The out-of-fold
predictions go to a parquet file, which validate_map.py reads.

Usage:
    python final_model.py --data data/processed/visits_boletus_edulis.parquet --name boletus_edulis
"""

from __future__ import annotations

import argparse
import json
import pickle
import re
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).parent))
from visit_model import BLOCK_M, HORIZONS, PARAMS, ROUNDS, activity_names

GRID = [
    ("standard", PARAMS, ROUNDS),
    ("small trees", dict(PARAMS, num_leaves=15, min_data_in_leaf=80, learning_rate=0.03), 600),
    ("smoothed", dict(PARAMS, lambda_l2=10.0, min_data_in_leaf=100, feature_fraction=0.5), 400),
    ("large trees", dict(PARAMS, num_leaves=63, min_data_in_leaf=20), 300),
]
SIZES = (10, 15, 20, 25, 30, 40, 50, 60, 80)
# A feature below this share of the total gain has not earned a column.
MIN_GAIN = 0.005
# The smallest feature list within this distance of the best score, measured
# as year AP plus space AP, wins.
TOLERANCE = 0.005
PRIOR = ["prior_rate_cell", "prior_n_cell", "prior_rate_block", "prior_n_block"]


def block_key(frame: pd.DataFrame) -> pd.Series:
    return ((frame["x"] // BLOCK_M).astype(int).astype(str) + "_"
            + (frame["y"] // BLOCK_M).astype(int).astype(str))


def knowable(name: str, horizon: int) -> bool:
    """Is a weather column known when the target week is `horizon` weeks away?

    Weather at lag k is known only when k >= horizon. A rolling window, an
    anomaly or a temperature drop ends at the target week and reaches into
    the unknown.
    """
    if horizon == 0:
        return True
    lag = re.search(r"_lag(\d+)$", name)
    if lag:
        return int(lag.group(1)) >= horizon
    if re.search(r"_(sum|mean)\d+$", name) or name.endswith(("_anom", "_ratio")):
        return False
    return not name.startswith("tas_drop")


def feature_list(blocks: dict, frame: pd.DataFrame, horizon: int) -> list[str]:
    names = [c for b in ("detection", "season", "weather", "trees")
             for c in blocks[b] if c in frame.columns and knowable(c, horizon)]
    activity = [c for c in activity_names(horizon) if c in frame.columns]
    if len(activity) != len(activity_names(horizon)):
        raise SystemExit(f"the table lacks the activity columns for horizon {horizon}; "
                         "rebuild it with visit_model.py")
    return names + activity + PRIOR


def prior_tables(frame: pd.DataFrame, rows: np.ndarray) -> dict[str, pd.DataFrame]:
    """Target rate and visit count per cell and per block, from `rows` only."""
    out = {}
    for key in ("cell", "block"):
        table = (frame.iloc[rows].groupby(key, observed=True)["label"]
                 .agg(n="size", positive="sum").reset_index())
        table["rate"] = table["positive"] / table["n"]
        out[key] = table[[key, "rate", "n"]]
    return out


def prior_columns(frame: pd.DataFrame, train: np.ndarray, test: np.ndarray) -> pd.DataFrame:
    """The prior for the training rows and for the test rows of one fold.

    A test row reads the totals of the training rows. A training row would
    read its own label in those totals, and with one visit per cell and year
    that is the label itself. So a training row reads the totals without its
    own year: leave-year-out inside the training set.
    """
    columns = {name: np.full(len(frame), np.nan, dtype="float32") for name in PRIOR}
    sub = frame.iloc[train]
    y = sub["label"].to_numpy()
    years = sub["iso_year"].to_numpy()
    for key in ("cell", "block"):
        keys = sub[key].to_numpy()
        total = pd.DataFrame({"k": keys, "y": y}).groupby("k")["y"].agg(["size", "sum"])
        own = (pd.DataFrame({"k": keys, "yr": years, "y": y})
               .groupby(["k", "yr"])["y"].agg(["size", "sum"]))
        t = total.loc[keys].to_numpy()
        o = own.loc[list(zip(keys, years))].to_numpy()
        n = t[:, 0] - o[:, 0]
        columns[f"prior_rate_{key}"][train] = np.where(
            n > 0, (t[:, 1] - o[:, 1]) / np.maximum(n, 1), np.nan)
        columns[f"prior_n_{key}"][train] = n
        if len(test):
            hit = total.reindex(frame.iloc[test][key].to_numpy())
            n_test = hit["size"].fillna(0).to_numpy()
            columns[f"prior_rate_{key}"][test] = np.where(
                n_test > 0, hit["sum"].to_numpy() / np.maximum(n_test, 1), np.nan)
            columns[f"prior_n_{key}"][test] = n_test
    return pd.DataFrame(columns, index=frame.index)


def design(frame: pd.DataFrame, features: list[str], prior: pd.DataFrame) -> pd.DataFrame:
    """The feature matrix, with the prior columns of this fold.

    The columns keep the order of `features`. LightGBM reads a frame by
    position, not by name, so the map must hand the model the same order it
    was trained with; the map reads that order from the model itself.
    """
    plain = [f for f in features if f not in PRIOR]
    x = frame[plain]
    wanted = [f for f in features if f in PRIOR]
    if wanted:
        x = pd.concat([x, prior[wanted]], axis=1)
    return x[features]


def blocked_folds(frame: pd.DataFrame, scheme: str):
    key = (frame["iso_year"].to_numpy() if scheme == "year"
           else (frame["x"].to_numpy() // 100_000).astype(int))
    y = frame["label"].to_numpy()
    return [(np.flatnonzero(key != g), np.flatnonzero(key == g))
            for g in sorted(pd.unique(key))
            if (key == g).sum() >= 100 and y[key == g].sum() >= 10]


def evaluate(frame, features, splits, params=PARAMS, rounds=ROUNDS):
    y = frame["label"].to_numpy()
    aucs, aps = [], []
    for train, test in splits:
        x = design(frame, features, prior_columns(frame, train, test))
        model = lgb.train(params, lgb.Dataset(x.iloc[train], label=y[train]),
                          num_boost_round=rounds)
        p = model.predict(x.iloc[test])
        if 0 < y[test].sum() < len(test):
            aucs.append(roc_auc_score(y[test], p))
            aps.append(average_precision_score(y[test], p))
    return float(np.mean(aucs)), float(np.mean(aps))


def fit_calibrated(frame, features, fit, cal, params, rounds):
    """Train on `fit`, calibrate on `cal`. Returns model, curve, cap."""
    y = frame["label"].to_numpy()
    x = design(frame, features, prior_columns(frame, fit, cal))
    model = lgb.train(params, lgb.Dataset(x.iloc[fit], label=y[fit]), num_boost_round=rounds)
    raw = model.predict(x.iloc[cal])
    iso = IsotonicRegression(out_of_bounds="clip").fit(raw, y[cal])
    # Isotonic regression saturates. If the top bin holds a handful of
    # points and all of them are positive, it returns exactly 1.0, and the map
    # then claims certainty it cannot have. The cap is the rate actually seen
    # in the top slice of the calibration set, which does have support.
    order = np.argsort(raw)[::-1]
    support = max(30, int(0.02 * len(order)))
    ceiling = float(y[cal][order[:support]].mean())
    return model, iso, ceiling


def calibrated(model, iso, ceiling, x) -> np.ndarray:
    return np.minimum(iso.predict(model.predict(x)), ceiling)


def write_finds(frame: pd.DataFrame, target: Path) -> None:
    """The positive training visits, on the centre of their 5 km cell.

    Points for the map. The exact coordinates stay out: two of the species
    are protected, and the project rule for anything public is a grid of
    5 km or coarser.
    """
    from pyproj import Transformer
    pos = frame[frame["label"] == 1]
    table = (pos.groupby(["cell", "iso_week"], observed=True)
             .agg(n=("label", "size"), years=("iso_year", "nunique")).reset_index())
    parts = table["cell"].str.split("_", expand=True).astype(int)
    x = (parts[0] + 0.5) * 5000
    y = (parts[1] + 0.5) * 5000
    lon, lat = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True).transform(
        x.to_numpy(), y.to_numpy())
    rows = [[round(float(a), 3), round(float(o), 3), int(w), int(n), int(k)]
            for a, o, w, n, k in zip(lat, lon, table["iso_week"], table["n"], table["years"])]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"cell_km": 5, "columns": ["lat", "lon", "week", "n", "years"],
                                  "rows": rows}, separators=(",", ":")))
    print(f"finds layer: {len(rows)} cell-weeks from {len(pos)} positive visits -> {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path,
                        default=Path("data/processed/visits_boletus_edulis.parquet"))
    parser.add_argument("--out", type=Path, default=Path("models"))
    parser.add_argument("--name", default="boletus_edulis")
    parser.add_argument("--species", default="Boletus edulis",
                        help="comma separated, stored with the model")
    parser.add_argument("--horizons", default=",".join(str(h) for h in HORIZONS))
    parser.add_argument("--oof", type=Path, default=Path("data/processed"),
                        help="folder for the out-of-fold predictions")
    parser.add_argument("--finds", type=Path, default=Path("reports/maps/funde"),
                        help="folder for the finds layer of the map")
    args = parser.parse_args()

    frame = pd.read_parquet(args.data)
    frame["block"] = block_key(frame)
    blocks = json.loads(args.data.with_suffix(".blocks.json").read_text())
    y = frame["label"].to_numpy()
    print(f"visits {len(frame)}   positive {int(y.sum())} ({y.mean():.2%})")
    splits = blocked_folds(frame, "year")
    space = blocked_folds(frame, "space")
    everything = np.arange(len(frame))
    write_finds(frame, args.finds / f"{args.name}.json")

    bundle = {"label": args.name, "species": [n.strip() for n in args.species.split(",")],
              "prior": prior_tables(frame, everything), "horizons": {}}
    chosen_lists = {}
    for horizon in (int(h) for h in args.horizons.split(",")):
        features = feature_list(blocks, frame, horizon)
        print(f"\n================ horizon {horizon} weeks: {len(features)} candidate features")

        # Rank the features once, on everything, then try shorter lists.
        x_all = design(frame, features, prior_columns(frame, everything, np.array([], int)))
        ranker = lgb.train(PARAMS, lgb.Dataset(x_all, label=y), num_boost_round=ROUNDS)
        gains = sorted(zip(ranker.feature_name(), ranker.feature_importance("gain")),
                       key=lambda kv: -kv[1])
        order = [name for name, _ in gains]
        total_gain = sum(g for _, g in gains)
        earned = [name for name, g in gains if g >= MIN_GAIN * total_gain]

        print(f"{'features':>9s} {'year AUC':>9s} {'year AP':>8s} {'space AUC':>10s} {'space AP':>9s}")
        scores = []
        candidates = [order[:s] for s in SIZES if s < len(features)]
        # The list of features that earn a share of the gain, wherever its
        # length falls, and the full list as the reference.
        candidates.append(earned)
        candidates.append(order)
        for chosen in sorted(candidates, key=len):
            auc, ap = evaluate(frame, chosen, splits)
            sauc, sap = evaluate(frame, chosen, space)
            scores.append((len(chosen), chosen, ap + sap))
            mark = f"  (gain >= {MIN_GAIN:.1%})" if chosen is earned else ""
            print(f"{len(chosen):9d} {auc:9.4f} {ap:8.4f} {sauc:10.4f} {sap:9.4f}{mark}", flush=True)
        top = max(s for _, _, s in scores)
        size, best, _ = next(s for s in scores if s[2] >= top - TOLERANCE)
        print(f"chosen: {size} features (best {top:.4f}, tolerance {TOLERANCE})")
        for name in best[:15]:
            print(f"  {name}")

        print(f"\n{'settings':12s} {'year AUC':>9s} {'year AP':>8s} {'space AUC':>10s} {'space AP':>9s}")
        params, rounds, best_score = PARAMS, ROUNDS, -1.0
        for label, candidate, n_rounds in GRID:
            auc, ap = evaluate(frame, best, splits, candidate, n_rounds)
            sauc, sap = evaluate(frame, best, space, candidate, n_rounds)
            mark = ""
            if ap + sap > best_score:
                params, rounds, best_score, mark = candidate, n_rounds, ap + sap, "  <-- chosen"
            print(f"{label:12s} {auc:9.4f} {ap:8.4f} {sauc:10.4f} {sap:9.4f}{mark}", flush=True)

        # Calibrate inside each year fold and keep the out-of-fold values.
        raw_all = np.full(len(frame), np.nan)
        cal_all = np.full(len(frame), np.nan)
        for train, test in splits:
            fit, cal = train_test_split(train, test_size=0.25, random_state=0,
                                        stratify=y[train])
            model, iso, ceiling = fit_calibrated(frame, best, fit, cal, params, rounds)
            x = design(frame, best, prior_columns(frame, fit, test))
            raw_all[test] = model.predict(x.iloc[test])
            cal_all[test] = np.minimum(iso.predict(raw_all[test]), ceiling)
        good = np.isfinite(cal_all)
        print(f"\nBrier score   raw {brier_score_loss(y[good], raw_all[good]):.5f}"
              f"   calibrated {brier_score_loss(y[good], cal_all[good]):.5f}")
        print(f"AUC of the calibrated out-of-fold scores: {roc_auc_score(y[good], cal_all[good]):.4f}")
        print("\ncalibration, by decile of the calibrated score")
        table = pd.DataFrame({"p": cal_all[good], "y": y[good]})
        table["bucket"] = pd.qcut(table["p"], 10, labels=False, duplicates="drop")
        summary = table.groupby("bucket").agg(predicted=("p", "mean"),
                                              observed=("y", "mean"), n=("y", "size"))
        print(f"  {'decile':>6s} {'predicted':>10s} {'observed':>9s} {'n':>7s}")
        for bucket, row in summary.iterrows():
            print(f"  {int(bucket):6d} {row['predicted']:10.3f} {row['observed']:9.3f} "
                  f"{int(row['n']):7d}")
        args.oof.mkdir(parents=True, exist_ok=True)
        oof = frame.loc[good, ["lon", "lat", "x", "y", "cell", "date", "iso_year",
                               "iso_week", "label", "n_species"]].copy()
        oof["p_raw"], oof["p"] = raw_all[good], cal_all[good]
        oof_path = args.oof / f"oof_{args.name}_h{horizon}.parquet"
        oof.to_parquet(oof_path, index=False)
        print(f"out-of-fold predictions: {len(oof)} rows -> {oof_path}")

        # Refit on everything and save, for the map.
        fit, cal = train_test_split(everything, test_size=0.25, random_state=0, stratify=y)
        model, iso, ceiling = fit_calibrated(frame, best, fit, cal, params, rounds)
        print(f"calibration ceiling from the top calibration visits: {ceiling:.3f}")
        bundle["horizons"][horizon] = {
            "model": model, "isotonic": iso, "ceiling": ceiling, "features": best,
            "params": params, "rounds": rounds}
        chosen_lists[f"h{horizon}"] = best

    args.out.mkdir(parents=True, exist_ok=True)
    with (args.out / f"{args.name}.pkl").open("wb") as handle:
        pickle.dump(bundle, handle)
    (args.out / f"{args.name}.features.json").write_text(json.dumps(chosen_lists, indent=1))
    print(f"\nsaved {len(bundle['horizons'])} models and calibrators to {args.out}/{args.name}.pkl")


if __name__ == "__main__":
    main()
