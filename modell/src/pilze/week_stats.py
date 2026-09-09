#!/usr/bin/env python3
"""Fill mean, maximum and histogram into manifests that already stand.

region_map.py and input_layers.py write all three while they still hold the
field. This script fills them in for maps rendered before, from the coarsest
zoom level: four tiles per week, about three kilometres per point. That is
coarse for a histogram, and it is what a rendered map still holds. The next
full render replaces the numbers with exact ones.

Usage:
    python week_stats.py --maps reports/maps
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from manifest import histogramm, schreibe, werte_aus_kacheln


def fuelle_woche(eintrag: dict, ordner: Path, kacheln: list[str], zoom: str,
                 low: float, high: float, force: bool) -> bool:
    """Add the numbers of one week to its entry. True when it wrote.

    A number that already stands stays. It came from the field itself and is
    exact; the tiles would only overwrite it with a coarser one.
    """
    if not force and "mean" in eintrag and "histogramm" in eintrag:
        return False
    werte = werte_aus_kacheln(ordner, kacheln, zoom, low, high)
    if werte is None:
        return False
    if force or "mean" not in eintrag:
        eintrag["mean"] = round(float(werte.mean()), 4)
        eintrag["max"] = round(float(werte.max()), 4)
    if force or "histogramm" not in eintrag:
        eintrag["histogramm"] = histogramm(werte, low, high)
    return True


def fuelle_arten(meta: dict, karten: Path, force: bool) -> int:
    """Fill every week of one species manifest. The scale is 0 to top."""
    zoom = str(meta["tiles"]["zooms"][0])
    kacheln = meta["tiles"]["have"].get(zoom, [])
    neu = 0
    for woche in meta["weeks"]:
        if "tiles" in woche and fuelle_woche(woche, karten / woche["tiles"],
                                             kacheln, zoom, 0.0, meta["top"], force):
            neu += 1
    return neu


def fuelle_ebenen(meta: dict, karten: Path, force: bool) -> int:
    """Fill every layer of layers.json. The scale is low to high.

    A weekly layer keeps its histograms in a map beside ``weeks``, not inside
    it: ``weeks`` carries the week keys that update.sh cleans the tile folders
    by, and a list of objects there would delete every tile.
    """
    neu = 0
    for ebene in meta.get("layers", {}).values():
        if "tiles" not in ebene:
            continue
        zoom = str(ebene["zooms"][0])
        kacheln = ebene["have"].get(zoom, [])
        low, high = float(ebene["low"]), float(ebene["high"])
        wurzel = karten / ebene["tiles"]
        if ebene.get("static"):
            if not force and "histogramm" in ebene:
                continue
            werte = werte_aus_kacheln(wurzel, kacheln, zoom, low, high)
            if werte is not None:
                ebene["histogramm"] = histogramm(werte, low, high)
                neu += 1
            continue
        verteilungen = {} if force else dict(ebene.get("histogramme", {}))
        for schluessel in ebene.get("weeks", []):
            if schluessel in verteilungen:
                continue
            werte = werte_aus_kacheln(wurzel / schluessel, kacheln, zoom, low, high)
            if werte is not None:
                verteilungen[schluessel] = histogramm(werte, low, high)
                neu += 1
        ebene["histogramme"] = verteilungen
    return neu


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--maps", type=Path, default=Path("reports/maps"))
    parser.add_argument("--force", action="store_true",
                        help="recompute entries that already carry numbers")
    args = parser.parse_args()
    for pfad in sorted(args.maps.glob("*.json")):
        meta = json.loads(pfad.read_text())
        if pfad.name == "layers.json":
            print(f"  {'ebenen':16s} {fuelle_ebenen(meta, args.maps, args.force)} "
                  "Histogramme gerechnet")
        elif "weeks" in meta and "tiles" in meta:
            neu = fuelle_arten(meta, args.maps, args.force)
            mittel = [w["mean"] for w in meta["weeks"] if "mean" in w]
            print(f"  {meta['name']:16s} {neu} Wochen gerechnet, "
                  f"Mittel {min(mittel):.3f} bis {max(mittel):.3f}"
                  if mittel else f"  {meta['name']}: keine Kacheln")
        else:
            continue
        schreibe(pfad, meta)


if __name__ == "__main__":
    main()
