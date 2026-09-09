#!/usr/bin/env python3
"""Render the model inputs as their own map layers.

The map shows what the model concluded. These layers show what it was told:
the weather of the week, the soil, the terrain and the forest. Anyone who
wants to judge a bright patch can then look at why it is bright.

Two kinds of layer exist. A static layer describes the place and is drawn
once. A weekly layer describes the weather and is drawn for every week the
prediction covers, so the week slider moves it along with the prediction.
The weekly layers keep one colour range across all weeks, or a dry week
would look like a wet one.

Every layer uses the same grid, the same projection and the same tiling as the
prediction, so they line up pixel for pixel. Each carries its own range, since
a pH and a slope share no scale. The weather sits on 5 km cells, so its tiles
stop at zoom 7; the page scales them up from there.

Usage:
    nix develop .#geo --command python src/pilze/input_layers.py --tiles --no-image
    nix develop .#geo --command python src/pilze/input_layers.py --tiles --no-image --only-weekly
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import from_origin
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).parent))
from build_dataset import week_number
from manifest import histogramm, schreibe
from region_map import (COLORS, MODEL_CRS, REGION, TRAIN_CELL,
                        raster_ausrichten, render)
from tiles import schreibe_kacheln

# name -> (source, column, label, unit)
STATIC = {
    "wald":      ("trees", "forest_fraction_500m", "Waldanteil", ""),
    "fichte":    ("trees", "tree_spruce_1km", "Fichte im Umkreis 1 km", ""),
    "buche":     ("trees", "tree_beech_1km", "Buche im Umkreis 1 km", ""),
    "eiche":     ("trees", "tree_oak_1km", "Eiche im Umkreis 1 km", ""),
    "birke":     ("trees", "tree_birch_1km", "Birke im Umkreis 1 km", ""),
    "kiefer":    ("trees", "tree_pine_1km", "Kiefer im Umkreis 1 km", ""),
    "nadelholz": ("trees", "tree_conifer_1km", "Nadelholz im Umkreis 1 km", ""),
    "hoehe":     ("site", "dem_mean", "Höhe", "m"),
    "hangneigung": ("site", "slope_mean", "Hangneigung", "Grad"),
    "nordexposition": ("site", "northness", "Nordexposition", ""),
    "relief":    ("site", "dem_relief", "Höhenunterschied in der Zelle", "m"),
    "gelaendeposition": ("site", "tpi_25km", "Geländeposition, Mulde bis Rücken", "m"),
    "boden_ph":  ("site", "soil_phh2o_0_5cm", "Boden-pH", ""),
    "boden_sand": ("site", "soil_sand_0_5cm", "Sandanteil", "%"),
    "boden_kohlenstoff": ("site", "soil_soc_0_5cm", "organischer Kohlenstoff", "g/kg"),
}
# SoilGrids speichert ganze Zahlen: pH mal 10, Sand in g/kg, Kohlenstoff in
# dg/kg. Fuer die Anzeige durch 10 teilen, sonst steht dort pH 49.
SKALA = {"boden_ph": 0.1, "boden_sand": 0.1, "boden_kohlenstoff": 0.1}
# name -> (column, label, unit). The columns come from the weekly table and
# the rolling sums below. The order is the order in the page's chooser.
WEEKLY = {
    "regen":       ("pr", "Niederschlag der Woche", "mm"),
    "regen_2w":    ("pr_sum2", "Niederschlag der letzten 2 Wochen", "mm"),
    "regen_4w":    ("pr_sum4", "Niederschlag der letzten 4 Wochen", "mm"),
    "regen_8w":    ("pr_sum8", "Niederschlag der letzten 8 Wochen", "mm"),
    "regen_anomalie": ("pr_sum4_anom", "Regen der letzten 4 Wochen gegen normal", "mm"),
    "temperatur":  ("tas", "Mitteltemperatur der Woche", "Grad"),
    "temperatur_min": ("tasmin", "Tiefsttemperatur der Woche", "Grad"),
}


def schreibe_feld(field, work: Path, bounds, step, low, high) -> Path:
    """Scale a field into 0..1 and write it as a GeoTIFF in the model CRS."""
    scaled = np.clip((field - low) / max(high - low, 1e-9), 0, 1)
    scaled = np.where(np.isfinite(field), scaled, np.nan)
    source = work / "layer.tif"
    transform = from_origin(bounds[0], bounds[3], step, step)
    with rasterio.open(source, "w", driver="GTiff", height=field.shape[0],
                       width=field.shape[1], count=1, dtype="float32",
                       crs=MODEL_CRS, transform=transform, nodata=np.nan) as dst:
        dst.write(scaled.astype("float32"), 1)
    return source


def schreibe_bild(source: Path, target: Path, work: Path) -> None:
    merc = work / "layer3857.tif"
    subprocess.run(["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857",
                    "-r", "bilinear", "-dstnodata", "nan", str(source), str(merc)],
                   check=True, capture_output=True)
    with rasterio.open(merc) as src:
        render(src.read(1), target, 1.0, vary_alpha=False)


def belegung(gefuellt) -> dict[str, list[str]]:
    belegt: dict[str, list[str]] = {}
    for z, x, y in sorted(gefuellt):
        belegt.setdefault(str(z), []).append(f"{x}/{y}")
    return belegt


def wochenwetter(path: Path, cells: set[str], weeks: int) -> tuple[pd.DataFrame, list]:
    """The weekly weather columns of the last `weeks` weeks, per 5 km cell.

    The rolling sums need the weeks before, and the anomaly needs every year
    of the record for the normal value, so the whole table is read and only
    the end is returned.
    """
    w = pd.read_parquet(path, columns=["cell", "iso_year", "iso_week", "pr", "tas", "tasmin"])
    w["cell"] = w["cell"].astype(str)
    w = w[w["cell"].isin(cells)].copy()
    w["cell"] = w["cell"].astype("category")
    w["week_id"] = week_number(w)
    w = w.sort_values(["cell", "week_id"]).reset_index(drop=True)
    regen = w.groupby("cell", sort=False, observed=True)["pr"]
    for fenster in (2, 4, 8):
        w[f"pr_sum{fenster}"] = (regen.rolling(fenster, min_periods=fenster).sum()
                                 .reset_index(level=0, drop=True))
    normal = w.groupby(["cell", "iso_week"], observed=True)["pr_sum4"].transform("mean")
    w["pr_sum4_anom"] = w["pr_sum4"] - normal
    letzte = sorted(w["week_id"].unique())[-weeks:]
    w = w[w["week_id"].isin(letzte)].copy()
    w["cell"] = w["cell"].astype(str)
    wochen = (w[["iso_year", "iso_week"]].drop_duplicates()
              .sort_values(["iso_year", "iso_week"]).to_records(index=False))
    return w, [(int(y), int(k)) for y, k in wochen]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--step", type=int, default=500)
    parser.add_argument("--weeks", type=int, default=90)
    parser.add_argument("--out", type=Path, default=Path("reports/maps"))
    parser.add_argument("--grid", type=Path,
                        default=Path("data/interim/trees_de_500m.parquet"))
    parser.add_argument("--weather", type=Path,
                        default=Path("data/interim/weather_weekly.parquet"))
    parser.add_argument("--tiles", action="store_true",
                        help="Wertkacheln statt eines Vollbildes schreiben")
    parser.add_argument("--tile-zooms", default="5-8")
    parser.add_argument("--weekly-zooms", default="5-7",
                        help="das Wetter liegt auf 5 km, mehr als z7 zeigt nichts Neues")
    parser.add_argument("--no-image", action="store_true")
    parser.add_argument("--only-weekly", action="store_true",
                        help="nur die Wochenebenen neu, die festen bleiben")
    parser.add_argument("--no-weekly", action="store_true")
    args = parser.parse_args()

    trees = pd.read_parquet("data/interim/tree_scales.parquet")
    fein = Path("data/interim/site_500m.parquet")
    site = pd.read_parquet(fein if fein.exists() else Path("data/interim/site.parquet"))
    grid = pd.read_parquet(args.grid)
    grid["cell_fine"] = ((grid["x"] // args.step).astype(int).astype(str) + "_"
                         + (grid["y"] // args.step).astype(int).astype(str))
    grid["cell"] = ((grid["x"] // TRAIN_CELL).astype(int).astype(str) + "_"
                    + (grid["y"] // TRAIN_CELL).astype(int).astype(str))
    grid = grid.merge(trees.drop(columns=["x", "y"]).rename(columns={"cell": "cell_fine"}),
                      on="cell_fine", how="left")
    schluessel = "cell_fine" if fein.exists() else "cell"
    site = site.drop(columns=[c for c in ("cell_x", "cell_y") if c in site])
    if schluessel == "cell_fine":
        site = site.rename(columns={"cell": "cell_fine"})
    grid = grid.merge(site, on=schluessel, how="left")
    # Erst den Ausschnitt aus den Koordinaten, dann das Raster daraus. Die
    # gespeicherten gx und gy sind nicht durchgaengig verlaesslich.
    bounds = (int(grid["x"].min() - args.step / 2),
              int(grid["y"].min() - args.step / 2),
              int(grid["x"].max() + args.step / 2),
              int(grid["y"].max() + args.step / 2))
    grid, shape = raster_ausrichten(grid, bounds, args.step)
    work = args.out / "_work_layers"; work.mkdir(parents=True, exist_ok=True)
    print(f"grid {shape}, {len(grid):,} cells")

    # Dieselbe Maske wie bei der Vorhersage: kein Wetterraster heisst Ausland,
    # kein Boden-pH heisst Wasser. Sonst tuscht eine Eingabe-Ebene ueber dem
    # Bodensee einen Wert vor, den es dort nicht gibt.
    wetterzellen = set(pd.read_parquet(args.weather, columns=["cell"])["cell"].astype(str))
    maske = (grid["cell"].isin(wetterzellen).to_numpy()
             & grid["soil_phh2o_0_5cm"].notna().to_numpy())
    print(f"  ausgespart: {int((~maske).sum()):,} von {len(grid):,} Zellen")
    gy, gx = grid["gy"].to_numpy(), grid["gx"].to_numpy()

    def to_field(values):
        field = np.full(shape, np.nan, dtype="float32")
        field[gy, gx] = np.where(maske, values, np.nan)
        return field

    folder = args.out / "layers"; folder.mkdir(parents=True, exist_ok=True)
    aus_modell = Transformer.from_crs(MODEL_CRS, "EPSG:4326", always_xy=True)
    ecken = [aus_modell.transform(x, y)
             for x in (bounds[0], bounds[2]) for y in (bounds[1], bounds[3])]
    wgs_box = (min(e[0] for e in ecken), min(e[1] for e in ecken),
               max(e[0] for e in ecken), max(e[1] for e in ecken))

    manifest_path = args.out / "layers.json"
    alt = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    layers = {} if not args.only_weekly else {
        k: v for k, v in alt.get("layers", {}).items() if v.get("static")}

    if not args.only_weekly:
        z0, z1 = (int(v) for v in args.tile_zooms.split("-"))
        for name, (_, column, label, unit) in STATIC.items():
            if column not in grid.columns:
                print(f"  {name}: {column} fehlt, uebersprungen")
                continue
            values = grid[column].to_numpy(dtype="float32")
            low, high = np.nanpercentile(values, [2, 98])
            feld = to_field(values)
            source = schreibe_feld(feld, work, bounds, args.step, low, high)
            k = SKALA.get(name, 1.0)
            unten, oben = round(float(low) * k, 3), round(float(high) * k, 3)
            eintrag = {"label": label, "unit": unit, "static": True,
                       "low": unten, "high": oben}
            # Ueber die Skala der Ebene, in ihrer Einheit. Die Griffe im
            # Faktor-Screen zeigen damit auf Meter oder pH, nicht auf 0 bis 1.
            verteilung = histogramm(feld * k, unten, oben)
            if verteilung is not None:
                eintrag["histogramm"] = verteilung
            if not args.no_image:
                schreibe_bild(source, folder / f"{name}.png", work)
                eintrag["file"] = f"layers/{name}.png"
            if args.tiles:
                gefuellt, _ = schreibe_kacheln(source, args.out / "layers_kacheln" / name,
                                               1.0, range(z0, z1 + 1), work, wgs_box)
                eintrag.update(tiles=f"layers_kacheln/{name}", zooms=[z0, z1],
                               have=belegung(gefuellt))
            layers[name] = eintrag
            print(f"  {name:20s} {low*k:8.2f} bis {high*k:8.2f} {unit}", flush=True)
    else:
        print(f"  {len(layers)} feste Ebenen aus dem alten Manifest uebernommen")

    if not args.no_weekly:
        z0, z1 = (int(v) for v in args.weekly_zooms.split("-"))
        wetter, wochen = wochenwetter(args.weather, set(grid["cell"]), args.weeks)
        print(f"\n{len(wochen)} Wochen Wetter, {wochen[0][0]}-W{wochen[0][1]:02d} bis "
              f"{wochen[-1][0]}-W{wochen[-1][1]:02d}")
        zellen = grid["cell"].to_numpy()
        for name, (column, label, unit) in WEEKLY.items():
            # Eine Farbskala fuer alle Wochen, sonst saehe jede Woche gleich aus.
            low, high = (float(v) for v in np.nanpercentile(wetter[column], [1, 99]))
            if name == "regen_anomalie":
                # Symmetrisch, damit die Mitte der Skala "normal" heisst.
                high = max(abs(low), abs(high)); low = -high
            elif column.startswith("pr"):
                low = 0.0
            low, high = round(low, 1), round(high, 1)
            wurzel = args.out / "layers_kacheln" / name
            eintrag = {"label": label, "unit": unit, "static": False,
                       "low": low, "high": high, "weeks": []}
            # Je Woche ein Histogramm, aber nicht in `weeks`: dort stehen
            # Wochenschluessel, und `update.sh` raeumt die Kachelordner nach
            # dieser Liste auf. Eine Zuordnung daneben laesst beides heil.
            verteilungen: dict[str, dict] = {}
            gefuellt_erste = None
            for year, week in wochen:
                zeile = wetter[(wetter["iso_year"] == year) & (wetter["iso_week"] == week)]
                werte = pd.Series(zeile[column].to_numpy(), index=zeile["cell"].to_numpy())
                values = werte.reindex(zellen).to_numpy(dtype="float32")
                feld = to_field(values)
                source = schreibe_feld(feld, work, bounds, args.step, low, high)
                schluessel = f"{year}W{week:02d}"
                verteilung = histogramm(feld, low, high)
                if verteilung is not None:
                    verteilungen[schluessel] = verteilung
                if not args.no_image:
                    schreibe_bild(source, folder / f"{name}_{schluessel}.png", work)
                if args.tiles:
                    gefuellt, _ = schreibe_kacheln(source, wurzel / schluessel, 1.0,
                                                   range(z0, z1 + 1), work, wgs_box)
                    if gefuellt_erste is None:
                        gefuellt_erste = gefuellt
                eintrag["weeks"].append(schluessel)
            eintrag["histogramme"] = verteilungen
            if args.tiles:
                eintrag.update(tiles=f"layers_kacheln/{name}", zooms=[z0, z1],
                               have=belegung(gefuellt_erste or []))
            if not args.no_image:
                eintrag["files"] = f"layers/{name}_"
            layers[name] = eintrag
            print(f"  {name:20s} {low:8.1f} bis {high:8.1f} {unit}   {len(wochen)} Wochen",
                  flush=True)

    meta = {"bounds": [[wgs_box[1], wgs_box[0]], [wgs_box[3], wgs_box[2]]],
            "layers": layers}
    schreibe(manifest_path, meta)
    print(f"\nwrote {len(layers)} layers and {manifest_path}")


if __name__ == "__main__":
    main()
