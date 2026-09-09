#!/usr/bin/env python3
"""Read the bedrock geology of every model cell.

The source is the general geological map of Germany at 1:250,000 (GUEK250)
from the BGR. The service gives no vector download, but its map service
answers a point query with the full attributes of the polygon under the point.
One request returns all three themes at once:

  Petrographie   the rock itself, for example limestone or sandstone
  Genese         how the rock formed, for example marine or glacial
  Stratigraphie  the age of the rock

The rock controls the soil that forms on it, and the soil pH decides which
fungi can live there. A beech wood on limestone and a beech wood on acid sand
carry different species. SoilGrids measures the soil that is there now.
The geology says what made it, which travels better into a cell that holds
few records.

The script asks once for each cell center. It saves its work every few hundred
cells and starts again where it stopped.

Usage:
    python geology.py --workers 2
"""

from __future__ import annotations

import argparse
import os
import queue
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd
from pyproj import Transformer

CELL_SIZE = int(os.environ.get("PILZE_CELL_SIZE", 5000))
WMS = "https://services.bgr.de/wms/geologie/guek250/"
LAYERS = "1,4,7"
USER_AGENT = "pilze-research/0.1 (fungal fruiting phenology)"

# The attribute of each theme that the model uses.
WANTED = {
    "Petrographie": ("Petrographie - kurz", "rock"),
    "Genese": ("Petrogenese", "genesis"),
    "Stratigraphie": ("Stratigraphie - gesamt", "age"),
}


def parse(text: str) -> dict:
    """Pull the wanted attribute out of each theme block.

    A block starts with an at sign and the layer name, then the field names,
    then the values. Every field name holds letters, and the first value is the
    object number. The first block of digits therefore marks where the values
    start.
    """
    out: dict[str, str] = {}
    for block in text.split("@")[1:]:
        head, _, body = block.partition(" ")
        theme = next((t for t in WANTED if t in head), None)
        if theme is None:
            continue
        tokens = [t.strip() for t in body.replace("\n", " ").split(";")]
        start = next((i for i, t in enumerate(tokens) if re.fullmatch(r"\d+", t)), None)
        if start is None:
            continue
        names, values = tokens[:start], tokens[start:start + start]
        field, column = WANTED[theme]
        if field in names:
            index = names.index(field)
            if index < len(values):
                out[column] = values[index] or None
        if "ID der geologischen Einheit" in names:
            index = names.index("ID der geologischen Einheit")
            if index < len(values):
                out["unit_id"] = values[index]
    return out


def query(lon: float, lat: float, attempts: int = 3) -> dict:
    span = 0.004
    params = {
        "service": "WMS", "version": "1.3.0", "request": "GetFeatureInfo",
        "layers": LAYERS, "query_layers": LAYERS, "crs": "EPSG:4326",
        "bbox": f"{lat - span},{lon - span},{lat + span},{lon + span}",
        "width": 51, "height": 51, "i": 25, "j": 25,
        "info_format": "text/plain", "feature_count": 1,
    }
    url = f"{WMS}?{urllib.parse.urlencode(params)}"
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as response:
                return parse(response.read().decode("utf-8", "replace"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
            if attempt == attempts:
                return {}
            time.sleep(5 * attempt)
    return {}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occurrences", type=Path,
                        default=Path("data/interim/occurrences.parquet"))
    parser.add_argument("--out", type=Path, default=Path("data/interim/geology.parquet"))
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--pause", type=float, default=0.15)
    args = parser.parse_args()

    cells = (pd.read_parquet(args.occurrences, columns=["cell", "cell_x", "cell_y"])
               .drop_duplicates("cell").reset_index(drop=True))
    done: dict[str, dict] = {}
    if args.out.exists():
        earlier = pd.read_parquet(args.out)
        done = {r["cell"]: r for r in earlier.to_dict("records")}
        print(f"resuming: {len(done)} cells already read")
    todo = cells[~cells["cell"].isin(done)].reset_index(drop=True)
    print(f"cells to read: {len(todo)}")

    to_wgs = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)
    jobs: queue.Queue = queue.Queue()
    for row in todo.itertuples():
        x = row.cell_x * CELL_SIZE + CELL_SIZE / 2
        y = row.cell_y * CELL_SIZE + CELL_SIZE / 2
        lon, lat = to_wgs.transform(x, y)
        jobs.put((row.cell, lon, lat))

    lock = threading.Lock()
    counter = {"n": 0}

    def worker() -> None:
        while True:
            try:
                cell, lon, lat = jobs.get_nowait()
            except queue.Empty:
                return
            found = query(lon, lat)
            with lock:
                done[cell] = {"cell": cell, **found}
                counter["n"] += 1
                if counter["n"] % 250 == 0:
                    pd.DataFrame(list(done.values())).to_parquet(args.out, index=False)
                    print(f"  {counter['n']}/{len(todo)} read, saved", flush=True)
            time.sleep(args.pause)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(args.workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    frame = pd.DataFrame(list(done.values()))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(args.out, index=False)
    print(f"\nwrote {len(frame)} cells to {args.out}")
    for column in ("rock", "genesis", "age"):
        if column in frame:
            print(f"\n{column}: {frame[column].nunique()} values, "
                  f"{frame[column].isna().mean() * 100:.1f}% missing")
            print(frame[column].value_counts().head(8).to_string())


if __name__ == "__main__":
    main()
