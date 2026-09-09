#!/usr/bin/env python3
"""Draw a whole region, one image per week.

Baden-Wuerttemberg at a step of 1 km is about 65,000 cells. Drawing that many
rectangles in a browser is slow, so the script renders each week to an image
and the page lays the images over the map. One image per week also makes a
week slider cheap: the page swaps a picture instead of restyling 65,000
shapes.

The field is smoothed before it is drawn. The inputs are blocky by nature —
the tree map is summed over 1 km, the weather sits on 5 km — but the edge of a
wood does not follow a grid line. The smoothing is honest about that. It does
not add information; it stops the picture from claiming a sharpness that the
data does not have.

The tree map arrives in tiles from the Thuenen service and is counted into the
output grid at 10 m, so the picture keeps real forest structure.

Usage:
    python region_map.py --model models/boletus_edulis.pkl --name boletus_edulis
"""

from __future__ import annotations

import argparse
import json
import pickle
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import os
import pyarrow.parquet as pq
import rasterio
from rasterio.transform import from_origin
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).parent))
from build_dataset import add_anomalies, add_lags, week_number
from tiles import schreibe_kacheln
from tree_species import CLASSES, CONIFERS
from visit_model import BLOCK_M, ActivityFields

MODEL_CRS, SOURCE_CRS = "EPSG:3035", "EPSG:32632"
WCS = "https://atlas.thuenen.de/geoserver/ows"
COVERAGE = "geonode__Dominant_Species_Class"
TRAIN_CELL, PIXEL, TILE = 5000, 10, 50_000
# Der Ausschnitt in Grad. Voreinstellung ist Deutschland; --region setzt ihn
# auf ein anderes Gebiet, etwa fuer einen schnellen Probelauf.
REGIONEN = {
    "de": (5.75, 47.15, 15.15, 55.15),
    "bw": (7.35, 47.45, 10.60, 49.85),
}
REGION = REGIONEN["de"]
COLORS = np.array([
    (13, 8, 39), (54, 17, 82), (101, 26, 104), (148, 40, 100),
    (194, 59, 84), (229, 92, 60), (248, 137, 55), (252, 187, 89),
    (252, 231, 155)], dtype="float32")


def tile_trees(bounds, step: int, work: Path) -> pd.DataFrame:
    """Fetch the tree map in tiles and count the classes per output cell."""
    side = step // PIXEL
    nx = (bounds[2] - bounds[0]) // step
    ny = (bounds[3] - bounds[1]) // step
    high = max(CLASSES) + 1
    counts = np.zeros((ny, nx, high), dtype="float32")
    to_utm = Transformer.from_crs(MODEL_CRS, SOURCE_CRS, always_xy=True)
    tiles = [(tx, ty) for tx in range(bounds[0], bounds[2], TILE)
             for ty in range(bounds[1], bounds[3], TILE)]
    for index, (tx, ty) in enumerate(tiles, 1):
        box = (tx, ty, min(tx + TILE, bounds[2]), min(ty + TILE, bounds[3]))
        xs, ys = zip(*[to_utm.transform(x, y) for x in (box[0], box[2])
                       for y in (box[1], box[3])])
        query = urllib.parse.urlencode({
            "service": "WCS", "version": "2.0.1", "request": "GetCoverage",
            "coverageId": COVERAGE, "format": "image/tiff",
            "subset": [f"E({min(xs)-500:.0f},{max(xs)+500:.0f})",
                       f"N({min(ys)-500:.0f},{max(ys)+500:.0f})"]}, doseq=True)
        raw, warped = work / "t.tif", work / "t3035.tif"
        try:
            with urllib.request.urlopen(f"{WCS}?{query}", timeout=600) as response:
                body = response.read()
            if body[:4] not in (b"II*\x00", b"MM\x00*"):
                continue
            raw.write_bytes(body)
            subprocess.run(["gdalwarp", "-q", "-overwrite", "-t_srs", MODEL_CRS,
                            "-te", *[str(b) for b in box], "-tr", str(PIXEL), str(PIXEL),
                            "-r", "near", "-dstnodata", "0", str(raw), str(warped)],
                           check=True, capture_output=True)
            with rasterio.open(warped) as src:
                band = src.read(1)
            for row in range(band.shape[0] // side):
                for col in range(band.shape[1] // side):
                    block = band[row*side:(row+1)*side, col*side:(col+1)*side]
                    gx = (box[0] - bounds[0]) // step + col
                    gy = (bounds[3] - box[3]) // step + row
                    if 0 <= gy < ny and 0 <= gx < nx:
                        counts[gy, gx] += np.bincount(block.ravel(), minlength=high)[:high]
        except Exception as err:
            print(f"    tile {tx},{ty}: {err}", flush=True)
        finally:
            raw.unlink(missing_ok=True); warped.unlink(missing_ok=True)
        if index % 10 == 0:
            print(f"    tiles {index}/{len(tiles)}", flush=True)
        time.sleep(1.0)

    forest = counts[:, :, 1:].sum(axis=2)
    gy, gx = np.mgrid[0:ny, 0:nx]
    frame = pd.DataFrame({
        "gx": gx.ravel(), "gy": gy.ravel(),
        "x": bounds[0] + (gx.ravel() + 0.5) * step,
        "y": bounds[3] - (gy.ravel() + 0.5) * step,
        "forest_fraction": (forest / side**2).ravel(),
        "forest_pixels": (forest / side**2 * (TRAIN_CELL // PIXEL)**2).ravel()})
    with np.errstate(invalid="ignore", divide="ignore"):
        for value, name in CLASSES.items():
            frame[f"tree_{name}"] = np.where(forest > 0, counts[:, :, value] / forest, 0).ravel()
    frame["tree_conifer"] = frame[[f"tree_{c}" for c in CONIFERS]].sum(axis=1)
    frame["tree_broadleaf"] = frame[[f"tree_{c}" for c in CLASSES.values()
                                     if c not in CONIFERS]].sum(axis=1)
    return frame, (ny, nx)


def normalwerte(weather: pd.DataFrame) -> pd.DataFrame:
    """Mittel je Zelle und Kalenderwoche ueber den ganzen Zeitraum.

    Die Anomalie misst gegen das Normale eines Ortes in dieser Woche, und das
    Normale braucht jedes Jahr im Datensatz. Alles andere an der Rechnung
    braucht nur die letzten Wochen. Also wird hier der eine kleine Auszug
    gezogen, der den vollen Zeitraum verlangt: drei Spalten statt der
    zweiunddreissig, die add_lags anlegen wuerde.
    """
    w = weather.sort_values(["cell", "week_id"])
    regen = w.groupby("cell", sort=False, observed=True)["pr"]
    spalten = {"tas": w["tas"].to_numpy()}
    for fenster in (4, 8):
        spalten[f"pr_sum{fenster}"] = (regen.rolling(fenster, min_periods=fenster)
                                       .sum().reset_index(level=0, drop=True).to_numpy())
    spalten["cell"] = w["cell"].to_numpy()
    spalten["iso_week"] = w["iso_week"].to_numpy()
    tabelle = pd.DataFrame(spalten)
    return (tabelle.groupby(["cell", "iso_week"], observed=True)
            [["tas", "pr_sum4", "pr_sum8"]].mean()
            .rename(columns=lambda c: c + "_normal").reset_index())


def rss(marke: str = "") -> None:
    """Aktuellen und hoechsten Speicherstand melden, wenn PILZE_RSS gesetzt ist.

    Der Lauf soll auf einen Homeserver mit 16 GB passen, neben Diensten, die
    schon acht davon halten. Ohne Messpunkte raet man, wo die Spitze sitzt.
    """
    if not os.environ.get("PILZE_RSS"):
        return
    werte = {}
    for zeile in Path("/proc/self/status").read_text().splitlines():
        if zeile.startswith(("VmRSS:", "VmHWM:")):
            werte[zeile.split(":")[0]] = int(zeile.split()[1]) / 1048576
    print(f"    [{werte.get('VmRSS', 0):5.2f} GB jetzt, "
          f"{werte.get('VmHWM', 0):5.2f} GB Spitze]  {marke}", flush=True)


def raster_ausrichten(grid, bounds, step: int):
    """Rebuild gx and gy from the coordinates, and clip to the region.

    Der Deutschland-Cache ist in Kacheln entstanden, und 58 500 seiner
    2 322 285 Zellen tragen gx und gy aus dem Ursprung ihrer Bau-Kachel statt
    aus dem des Landes. Sie landen dadurch an der falschen Stelle im Bild. Aus
    x und y ist die Lage eindeutig, also wird sie hier neu bestimmt. Derselbe
    Schritt schneidet den Cache auf das gewuenschte Gebiet zu, denn er deckt
    immer ganz Deutschland ab.
    """
    ny = int((bounds[3] - bounds[1]) // step)
    nx = int((bounds[2] - bounds[0]) // step)
    gx = ((grid["x"].to_numpy() - bounds[0]) // step).astype(int)
    gy = ((bounds[3] - grid["y"].to_numpy()) // step).astype(int)
    innen = (gx >= 0) & (gx < nx) & (gy >= 0) & (gy < ny)
    grid = grid.loc[innen].copy()
    grid["gx"], grid["gy"] = gx[innen], gy[innen]
    return grid, (ny, nx)


def render(field: np.ndarray, target: Path, top: float,
           vary_alpha: bool = True) -> None:
    """Turn a smoothed probability field into a coloured image with alpha.

    The colour runs from 0 to 1, never from 0 to the highest value on this
    map. Stretching to the maximum makes every species look equally promising:
    the brightest cell of the birch bolete map would glow the same yellow as
    the brightest cell of the porcini map, although one means 19 percent and
    the other 59. A fixed scale keeps a dim map dim, which is the honest
    answer when the chance really is low.
    """
    from PIL import Image
    valid = np.isfinite(field)
    scaled = np.clip(np.nan_to_num(field), 0, 1)
    position = scaled * (len(COLORS) - 1)
    low = np.floor(position).astype(int)
    high = np.clip(low + 1, 0, len(COLORS) - 1)
    weight = (position - low)[..., None]
    rgb = COLORS[low] * (1 - weight) + COLORS[high] * weight
    # Colour and transparency answer two different questions. The colour runs
    # from 0 to 1 and says how likely a find is, absolutely: a species whose
    # best cell reaches 0.18 stays dark, as it should. Transparency runs from
    # 0 to the best cell of this species and says where, within that species,
    # the better places are. Without it a low species is an even grey veil
    # with no structure at all, which is honest and useless at once.
    if vary_alpha:
        relative = np.clip(np.nan_to_num(field) / max(top, 1e-6), 0, 1)
        alpha = np.where(valid, np.clip(0.10 + relative * 0.85, 0, 1) * 240, 0)
    else:
        # Eine Eingabe-Ebene traegt ihren Wert allein in der Farbe. Liesse man
        # die Deckkraft mitlaufen, saehe ein niedriger pH aus wie fehlende
        # Daten statt wie ein niedriger pH. Nur maskierte Zellen sind
        # unsichtbar, alles andere gleich deckend.
        alpha = np.where(valid, 215, 0)
    image = np.dstack([rgb, alpha[..., None]]).astype("uint8")
    Image.fromarray(image, mode="RGBA").save(target)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=Path("models/boletus_edulis.pkl"))
    parser.add_argument("--name", default="boletus_edulis")
    parser.add_argument("--step", type=int, default=500)
    parser.add_argument("--weeks", type=int, default=20)
    parser.add_argument("--forecast", type=int, default=0,
                        help="how many weeks past the record to predict")
    parser.add_argument("--smooth", type=float, default=1.2,
                        help="gaussian sigma, in cells")
    parser.add_argument("--min-forest", type=float, default=0.03)
    parser.add_argument("--reference-species", type=int, default=4,
                        help="species a typical walk records; the median is 4")
    parser.add_argument("--reference-records", type=int, default=5)
    parser.add_argument("--weather", type=Path,
                        default=Path("data/interim/weather_weekly.parquet"))
    parser.add_argument("--occurrences", type=Path,
                        default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--out", type=Path, default=Path("reports/maps"))
    parser.add_argument("--cache", type=Path,
                        default=Path("data/interim/trees_de_500m.parquet"))
    parser.add_argument("--region", default="de", choices=sorted(REGIONEN))
    parser.add_argument("--tiles", action="store_true",
                        help="Wertkacheln statt eines Vollbildes schreiben")
    parser.add_argument("--tile-zooms", default="5-8",
                        help="Zoomstufen der Kachelpyramide, etwa 5-8")
    parser.add_argument("--no-image", action="store_true",
                        help="kein Vollbild schreiben, nur Kacheln")
    args = parser.parse_args()

    with args.model.open("rb") as handle:
        bundle = pickle.load(handle)
    if "horizons" not in bundle:
        raise SystemExit(f"{args.model} ist ein altes Bundle ohne Horizonte — "
                         "erst final_model.py neu laufen lassen")
    if args.forecast > 0 and 2 not in bundle["horizons"]:
        raise SystemExit(f"{args.model} hat kein Modell fuer Horizont 2")
    # Die Spaltenliste fuer das Zuschneiden der Tabellen ist die Vereinigung
    # beider Horizonte. Gerechnet wird je Woche mit dem passenden Modell.
    features = sorted({f for h in bundle["horizons"].values() for f in h["features"]})
    species_names = bundle.get("species", ["Boletus edulis"])
    print(f"{args.name}: {species_names}, Horizonte {sorted(bundle['horizons'])}, "
          f"{len(features)} Spalten")

    to_model = Transformer.from_crs("EPSG:4326", MODEL_CRS, always_xy=True)
    gebiet = REGIONEN[args.region]
    x0, y0 = to_model.transform(gebiet[0], gebiet[1])
    x1, y1 = to_model.transform(gebiet[2], gebiet[3])
    bounds = (int(x0 // args.step * args.step), int(y0 // args.step * args.step),
              int(x1 // args.step * args.step), int(y1 // args.step * args.step))
    work = args.out / "_work_region"; work.mkdir(parents=True, exist_ok=True)

    if args.cache.exists():
        # Von den 20 Spalten des Cache steht keine im Modell. Gebraucht sind
        # nur Lage und Waldanteil; die Baumanteile kommen aus tree_scales.
        vorhanden = set(pq.ParquetFile(args.cache).schema.names)
        hole = [c for c in ("x", "y", "gx", "gy", "forest_fraction") if c in vorhanden]
        grid = pd.read_parquet(args.cache, columns=hole)
        roh = len(grid)
        grid, shape = raster_ausrichten(grid, bounds, args.step)
        print(f"trees from cache: {len(grid)} of {roh} cells {shape}")
    else:
        print("fetching the tree map for the region ...")
        grid, shape = tile_trees(bounds, args.step, work)
        grid.to_parquet(args.cache, index=False)
        print(f"trees: {len(grid)} cells {shape}")
    rss("Baum-Cache gelesen")

    grid["cell"] = ((grid["x"] // TRAIN_CELL).astype(int).astype(str) + "_"
                    + (grid["y"] // TRAIN_CELL).astype(int).astype(str))

    # The model was trained on two tree scales. The grid carries the fine one
    # by construction; the coarse one is joined from the aggregate file. The
    # names must match the training exactly, or the model reads empty columns
    # and quietly falls back to season and weather.
    # The model reads the tree shares from one national table that holds all
    # four radii. The grid keeps its own counts only for the forest mask.
    grid["forest_mask"] = grid["forest_fraction"]
    grid = grid.drop(columns=[c for c in grid.columns
                              if c.startswith(("tree_", "forest_fraction", "forest_pixels"))])
    grid["cell_fine"] = ((grid["x"] // args.step).astype(int).astype(str) + "_"
                         + (grid["y"] // args.step).astype(int).astype(str))
    boden = Path("data/interim/site_500m.parquet")
    if boden.exists():
        sp = pd.read_parquet(boden, columns=["cell", "soil_phh2o_0_5cm"])
        grid = grid.merge(sp.rename(columns={"cell": "cell_fine"}), on="cell_fine", how="left")
    rss("Boden verbunden")

    scales = Path("data/interim/tree_scales.parquet")
    if not scales.exists():
        raise SystemExit("tree_scales.parquet fehlt — erst tree_scales.py laufen lassen")
    # 59 Spalten, davon liest das Modell 17. Der Rest wuerde 2,3 Millionen
    # Zeilen breiter machen, ohne je gelesen zu werden.
    da = set(pq.ParquetFile(scales).schema.names)
    hole = ["cell"] + sorted((set(features) | {"forest_fraction_500m"}) & da)
    extra = pd.read_parquet(scales, columns=hole)
    extra = extra.rename(columns={"cell": "cell_fine"})
    before = len(grid)
    grid = grid.merge(extra, on="cell_fine", how="left")
    missing = grid["forest_fraction_500m"].isna().mean()
    print(f"  tree scales joined: {len(extra.columns)-1} columns, "
          f"{missing*100:.1f}% of cells without a match")
    assert len(grid) == before
    rss("Baumanteile verbunden")

    # Aus dem Wetter liest das Modell keine Spalte direkt — alles entsteht
    # erst in add_lags. Gebraucht sind also nur die drei Grundgroessen.
    weather = pd.read_parquet(
        args.weather, columns=["cell", "iso_year", "iso_week", "pr", "tas", "tasmin"])
    weather = weather.astype({c: "float32" for c in ("pr", "tas", "tasmin")
                              if weather[c].dtype == "float64"})
    weather["cell"] = weather["cell"].astype(str)
    rss("Wetter gelesen")
    weather = weather[weather["cell"].isin(set(grid["cell"]))].copy()
    weather["week_id"] = week_number(weather)
    if args.forecast > 0:
        # Add empty rows for the coming weeks. add_lags shifts within each
        # cell, so those rows pick up the weather of the weeks that already
        # happened. Lag 0 and lag 1 stay empty, and a model built for a
        # horizon of two weeks never asks for them.
        last = weather.sort_values("week_id")["week_id"].iloc[-1]
        observed_last = int(last)
        letzte = weather[weather["week_id"] == last].iloc[0]
        montag = pd.Timestamp.fromisocalendar(int(letzte["iso_year"]),
                                              int(letzte["iso_week"]), 1)
        future = []
        for step in range(1, args.forecast + 1):
            block = weather[weather["week_id"] == last][["cell"]].copy()
            # Ueber den Kalender, nicht ueber week_id + 1: die Woche 53 gibt
            # es nur in manchen Jahren, und aus 2026*53+53 wuerde 2027 KW 0.
            kal = (montag + pd.Timedelta(weeks=step)).isocalendar()
            block["iso_year"], block["iso_week"] = int(kal[0]), int(kal[1])
            block["week_id"] = week_number(block)
            future.append(block)
        weather = pd.concat([weather, *future], ignore_index=True)
        print(f"added {args.forecast} future weeks "
              f"({len(future[0])} cells each)")
    # add_lags sortiert und gruppiert nach Zelle. Ueber 9,9 Millionen
    # Zeichenketten ist das teuer; als Kategorie gruppiert pandas ueber
    # ganze Zahlen.
    weather["cell"] = weather["cell"].astype("category")
    normale = normalwerte(weather)
    rss("Normalwerte")
    # Erst jetzt zusammenstreichen. add_lags legt 32 Spalten an und haelt sie
    # dreifach — als Dict, als DataFrame und im concat. Ueber den ganzen
    # Zeitraum sind das acht Gigabyte, ueber die gerenderten Wochen ein
    # Bruchteil. Zwanzig Wochen Vorlauf decken Lag 8 auf Fenster 8 ab.
    grenze = int(weather["week_id"].max()) - (args.weeks + 20)
    vorher = len(weather)
    weather = weather[weather["week_id"] > grenze].copy()
    print(f"  Wetter auf {len(weather):,} von {vorher:,} Zeilen beschnitten")
    weather = add_lags(weather)
    weather = weather.merge(normale, on=["cell", "iso_week"], how="left")
    for var in ("pr_sum4", "pr_sum8", "tas"):
        weather[f"{var}_anom"] = weather[var] - weather[f"{var}_normal"]
    weather = weather.drop(columns=[c for c in weather.columns
                                    if c.endswith("_normal")])
    weather["cell"] = weather["cell"].astype(str)
    # add_lags und add_anomalies verbreitern 9,9 Millionen Zeilen auf ein
    # Vielfaches. Gelesen wird davon nur, was im Modell steht, also gleich
    # wegwerfen — sonst passt der Lauf auf keinen Homeserver.
    schluessel = ["cell", "iso_year", "iso_week", "week_id"]
    weather = weather[schluessel + [c for c in weather.columns
                                    if c in features and c not in schluessel]]
    weather = weather.astype({c: "float32" for c in weather.columns
                              if weather[c].dtype == "float64"})
    # Die zwanzig Vorlaufwochen haben ihren Dienst in add_lags getan. Ueber
    # die Menge der Wochen, nicht ueber week_id minus 90: die Kennung
    # springt am Jahreswechsel um zwei, wo es keine KW 53 gibt.
    letzte = sorted(pd.unique(weather["week_id"]))[-args.weeks:]
    weather = weather[weather["week_id"].isin(letzte)].copy()
    rss("Lags und Anomalien")

    # Die Aktivitaet um jede Zelle kommt aus derselben Klasse wie im
    # Training. Zwei Definitionen in zwei Dateien gaben der Karte Werte, die
    # 40 bis 60 Prozent ueber denen lagen, die das Modell gelernt hatte.
    occ = pd.read_parquet(args.occurrences,
                          columns=["recordedByHash", "x", "y", "date", "species"])
    felder = ActivityFields(occ, species_names)
    del occ
    rss("Aktivitaetsfelder gerechnet")
    # Der Vorjahres-Prior: Trefferrate der Art unter allen Trainingsbesuchen
    # derselben 5-km-Zelle und desselben 25-km-Blocks. Eine Zelle ohne
    # Besuch bekommt n = 0 und keine Rate, genau wie im Training.
    grid["block"] = ((grid["x"] // BLOCK_M).astype(int).astype(str) + "_"
                     + (grid["y"] // BLOCK_M).astype(int).astype(str))
    for key in ("cell", "block"):
        tabelle = bundle["prior"][key].rename(
            columns={"rate": f"prior_rate_{key}", "n": f"prior_n_{key}"})
        grid = grid.merge(tabelle, on=key, how="left")
        grid[f"prior_n_{key}"] = grid[f"prior_n_{key}"].fillna(0)
    grid = grid.drop(columns=["block"])
    if args.forecast <= 0:
        observed_last = None
    weeks = (weather[["iso_year", "iso_week"]].drop_duplicates()
             .sort_values(["iso_year", "iso_week"]).tail(args.weeks))
    from scipy.ndimage import gaussian_filter
    # Ausserhalb Deutschlands gibt es kein HYRAS-Raster, ueber Wasser keinen
    # Bodenwert. Beides sind saubere Masken aus den Daten selbst: eine Zelle
    # ohne Wetterzelle liegt im Ausland, eine ohne Boden-pH liegt im See.
    # Ohne sie legt sich die Karte als Rechteck ueber Frankreich, die Schweiz
    # und den Bodensee und behauptet dort Werte.
    # Das Wetter einer Woche wird ueber einen Zellcode auf das Raster gelegt,
    # ganze Zahlen statt Zeichenketten; -1 heisst Ausland.
    zellen = pd.Index(pd.unique(weather["cell"]))
    zellcode = zellen.get_indexer(grid["cell"].to_numpy())
    ausland = zellcode < 0
    wasser = grid["soil_phh2o_0_5cm"].isna().to_numpy() if "soil_phh2o_0_5cm" in grid else np.zeros(len(grid), bool)
    bare = (grid["forest_mask"].to_numpy() < args.min_forest) | ausland | wasser
    print(f"  ausgespart: {int(ausland.sum())} Zellen Ausland, "
          f"{int(wasser.sum())} Wasser, {int(bare.sum())} gesamt von {len(grid)}")

    # Die festen Modellspalten werden einmal je Horizont als float32-Matrix
    # aus dem Raster gezogen, in der Spaltenordnung des Modells. Die
    # Wochenschleife setzt daraus, aus dem Wetter der Woche, der Aktivitaet
    # und den Konstanten die Eingabematrix per numpy zusammen. Ein
    # pandas-merge ueber 2,3 Millionen Zeilen je Woche kostete 6,7 GB Spitze,
    # mehr als der Homeserver zulaesst.
    wetter_namen = [c for c in weather.columns
                    if c not in ("cell", "iso_year", "iso_week", "week_id")]
    wetter_pos = {c: i for i, c in enumerate(wetter_namen)}
    konstanten = {"n_species": float(args.reference_species),
                  "n_records": float(args.reference_records)}
    plan = {}
    for horizont, modell in bundle["horizons"].items():
        # Die Spaltenreihenfolge kommt vom Modell selbst, nicht aus der
        # Feature-Liste: LightGBM liest nach Position, und ein vertauschter
        # Prior am Ende der Liste liess die Karte bei einem Drittel der
        # richtigen Werte landen.
        spalten = list(modell["model"].feature_name())
        fest = [c for c in spalten if c in grid.columns]
        matrix = grid[fest].to_numpy(dtype="float32")
        quellen = []
        for name in spalten:
            if name in fest:
                quellen.append(("fest", fest.index(name)))
            elif name in wetter_pos:
                quellen.append(("wetter", wetter_pos[name]))
            elif name.startswith("activity_rate_"):
                quellen.append(("aktiv", name))
            elif name in ("iso_week", "week_sin", "week_cos"):
                quellen.append(("saison", name))
            elif name in konstanten:
                quellen.append(("konst", konstanten[name]))
            else:
                print(f"  WARNUNG: Spalte {name} fehlt auf der Karte, bleibt leer")
                quellen.append(("leer", None))
        plan[horizont] = (spalten, matrix, quellen)
        print(f"  Horizont {horizont}: {len(spalten)} Spalten, davon {len(fest)} fest, "
              f"{sum(q[0] == 'wetter' for q in quellen)} Wetter")
    grid_x, grid_y = grid["x"].to_numpy(), grid["y"].to_numpy()
    del grid
    rss("Feste Modellspalten als Matrix")

    # Der Hoechstwert der Kacheln ist der Kalibrierdeckel, nicht das
    # Maximum ueber die gerenderten Wochen. Kein Feld kann darueber liegen,
    # und so muss keine Woche bis zum Ende gehalten werden: neunzig Felder
    # waren 840 MB. Ausserdem passt eine spaeter gerechnete Woche zu den
    # bestehenden Kacheln, der Massstab ist derselbe.
    top = float(max(h["ceiling"] for h in bundle["horizons"].values()))
    images = args.out / f"{args.name}_weeks"; images.mkdir(parents=True, exist_ok=True)
    z0, z1 = (int(v) for v in args.tile_zooms.split("-"))
    kachelwurzel = args.out / f"{args.name}_kacheln"
    # Die Kacheln brauchen den Ausschnitt in Grad. Er ist fuer jede Woche
    # derselbe, also einmal aus den vier Ecken des Modellrasters.
    aus_modell = Transformer.from_crs(MODEL_CRS, "EPSG:4326", always_xy=True)
    ecken = [aus_modell.transform(x, y)
             for x in (bounds[0], bounds[2]) for y in (bounds[1], bounds[3])]
    wgs_box = (min(e[0] for e in ecken), min(e[1] for e in ecken),
               max(e[0] for e in ecken), max(e[1] for e in ecken))
    kachelzahl = kachelbytes = 0
    vorhanden: set[tuple[int, int, int]] = set()
    merc_bounds = None

    def schreibe_woche(year: int, week: int, field: np.ndarray, ahead: bool) -> dict:
        """Write the field, then let gdal put it into web mercator so that
        the picture lines up with the map tiles."""
        nonlocal kachelzahl, kachelbytes, merc_bounds
        source = work / "field.tif"
        transform = from_origin(bounds[0], bounds[3], args.step, args.step)
        with rasterio.open(source, "w", driver="GTiff", height=field.shape[0],
                           width=field.shape[1], count=1, dtype="float32",
                           crs=MODEL_CRS, transform=transform, nodata=np.nan) as dst:
            dst.write(field.astype("float32"), 1)
        merc = work / "field3857.tif"
        subprocess.run(["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857",
                        "-r", "bilinear", "-dstnodata", "nan", str(source), str(merc)],
                       check=True, capture_output=True)
        with rasterio.open(merc) as src:
            merc_bounds = src.bounds
            if not args.no_image:
                render(src.read(1), images / f"{year}W{week:02d}.png", top)
        # Mittel und Maximum der Woche, fuer die Zeitleiste der Seite: ein
        # Balken je Woche, relativ zur besten Woche der Art.
        eintrag = {"year": year, "week": week, "forecast": bool(ahead),
                   "mean": round(float(np.nanmean(field)), 4),
                   "max": round(float(np.nanmax(field)), 4)}
        if not args.no_image:
            eintrag["file"] = f"{args.name}_weeks/{year}W{week:02d}.png"
        if args.tiles:
            ordner = kachelwurzel / f"{year}W{week:02d}"
            gefuellt, gross = schreibe_kacheln(source, ordner, top,
                                               range(z0, z1 + 1), work, wgs_box)
            vorhanden.update(gefuellt)
            kachelzahl += len(gefuellt); kachelbytes += gross
            eintrag["tiles"] = f"{args.name}_kacheln/{year}W{week:02d}"
            print(f"    {len(gefuellt)} Kacheln, {gross/1024:.0f} kB", flush=True)
        return eintrag

    manifest = []
    n = len(grid_x)
    # Eine Zeile NaN am Ende, auf die der Zellcode -1 zeigt.
    zellcode_ext = np.where(zellcode < 0, len(zellen), zellcode)
    for _, row in weeks.iterrows():
        year, week = int(row["iso_year"]), int(row["iso_week"])
        # Eine beobachtete Woche rechnet das Modell fuer Horizont 0, eine
        # Prognosewoche das fuer Horizont 2. Das zweite kennt weder das
        # Wetter der Zielwoche noch die Funde der letzten zwei Wochen.
        ahead = observed_last is not None and week_number(pd.DataFrame(
            {"iso_year": [year], "iso_week": [week]})).iloc[0] > observed_last
        horizont = 2 if ahead else 0
        modell = bundle["horizons"][horizont]
        spalten, matrix, quellen = plan[horizont]

        wk = weather[(weather["iso_year"] == year) & (weather["iso_week"] == week)]
        block = np.full((len(zellen) + 1, len(wetter_namen)), np.nan, dtype="float32")
        block[zellen.get_indexer(wk["cell"].to_numpy())] = wk[wetter_namen].to_numpy(dtype="float32")
        wetter_woche = block[zellcode_ext]
        del block
        # Der Donnerstag steht fuer die Woche: das Training liest die
        # Aktivitaet bis zum Vortag des Besuchs, und der mittlere Besuch
        # liegt in der Wochenmitte.
        tag = pd.Timestamp.fromisocalendar(year, week, 4)
        aktivitaet = felder.sample(grid_x, grid_y, tag, horizon=horizont)
        saison = {"iso_week": float(week), "week_sin": np.sin(2 * np.pi * week / 52.0),
                  "week_cos": np.cos(2 * np.pi * week / 52.0)}
        eingabe = np.empty((n, len(spalten)), dtype="float32")
        for j, (art, ref) in enumerate(quellen):
            if art == "fest":
                eingabe[:, j] = matrix[:, ref]
            elif art == "wetter":
                eingabe[:, j] = wetter_woche[:, ref]
            elif art == "aktiv":
                eingabe[:, j] = aktivitaet[ref].to_numpy()
            elif art == "saison":
                eingabe[:, j] = saison[ref]
            elif art == "konst":
                eingabe[:, j] = ref
            else:
                eingabe[:, j] = np.nan
        del wetter_woche
        # In Stuecken: LightGBM kopiert die Eingabe nach float64, und ueber
        # 2,3 Millionen Zeilen mal 103 Spalten waeren das 1,9 GB auf einmal.
        schritt = 200_000
        roh = np.concatenate([modell["model"].predict(eingabe[i:i + schritt])
                              for i in range(0, n, schritt)])
        probability = np.minimum(modell["isotonic"].predict(roh), modell["ceiling"])
        if os.environ.get("PILZE_DUMP"):
            # Eine Stichprobe der Eingaben dieser Woche, zum Vergleich mit den
            # Trainingsbesuchen, wenn die Karte anders aussieht als erwartet.
            probe = pd.DataFrame(eingabe, columns=spalten).assign(
                x=grid_x, y=grid_y, p=probability, bare=bare)
            probe.sample(min(30000, len(probe)), random_state=0).to_parquet(
                Path(os.environ["PILZE_DUMP"]) / f"dump_{year}W{week:02d}.parquet", index=False)
        del eingabe
        probability[bare] = np.nan
        field = probability.reshape(shape)
        if args.smooth > 0:
            filled = np.where(np.isfinite(field), field, 0.0)
            mask = np.isfinite(field).astype("float32")
            blur = gaussian_filter(filled, args.smooth)
            norm = gaussian_filter(mask, args.smooth)
            with np.errstate(invalid="ignore", divide="ignore"):
                field = np.where(norm > 0.08, blur / np.maximum(norm, 1e-6), np.nan)
        print(f"  {year}-W{week:02d}  mean {np.nanmean(field):.3f} "
              f"max {np.nanmax(field):.3f}", flush=True)
        manifest.append(schreibe_woche(year, week, field, ahead))
        del field, probability
        rss(f"Woche {year}-{week:02d} geschrieben")

    to_wgs = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    lon_w, lat_s = to_wgs.transform(merc_bounds.left, merc_bounds.bottom)
    lon_e, lat_n = to_wgs.transform(merc_bounds.right, merc_bounds.top)
    meta = {"name": args.name, "species": species_names, "top": top,
            "bounds": [[lat_s, lon_w], [lat_n, lon_e]], "weeks": manifest}
    if args.tiles:
        # Die Maske ist in jeder Woche dieselbe, also ist es auch die Menge
        # der belegten Kacheln. Einmal je Art gespeichert erspart der Seite
        # jede Anfrage nach einer leeren Kachel.
        belegt: dict[str, list[str]] = {}
        for z, x, y in sorted(vorhanden):
            belegt.setdefault(str(z), []).append(f"{x}/{y}")
        meta["tiles"] = {"zooms": [z0, z1], "have": belegt}
        print(f"  Kacheln gesamt: {kachelzahl}, {kachelbytes/1e6:.1f} MB")
    (args.out / f"{args.name}.json").write_text(json.dumps(meta, indent=1))
    print(f"\nwrote {len(manifest)} weeks and {args.out}/{args.name}.json  (top {top:.3f})")


if __name__ == "__main__":
    main()
