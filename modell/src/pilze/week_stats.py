#!/usr/bin/env python3
"""Add the mean and the maximum of every rendered week to the manifests.

region_map.py writes both numbers itself since 2026-09-08. This script fills
them in for maps that were rendered before, from the zoom 5 tiles: four
tiles per week, about three kilometres per pixel, which is fine for a mean.
The page draws a bar under every week of the timeline from these numbers.

Usage:
    python week_stats.py --maps reports/maps
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def stats(ordner: Path, top: float, kacheln: list[str], zoom: str) -> tuple[float, float] | None:
    werte = []
    for xy in kacheln:
        datei = ordner / zoom / (xy + ".png")
        if not datei.exists():
            continue
        b = np.asarray(Image.open(datei).convert("L"), dtype="float32")
        b = b[b > 0]
        if b.size:
            werte.append((b - 1) / 254 * top)
    if not werte:
        return None
    alle = np.concatenate(werte)
    return float(alle.mean()), float(alle.max())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--maps", type=Path, default=Path("reports/maps"))
    parser.add_argument("--force", action="store_true", help="recompute weeks that have numbers")
    args = parser.parse_args()
    for manifest in sorted(args.maps.glob("*.json")):
        meta = json.loads(manifest.read_text())
        if "weeks" not in meta or "tiles" not in meta:
            continue
        zoom = str(meta["tiles"]["zooms"][0])
        kacheln = meta["tiles"]["have"].get(zoom, [])
        neu = 0
        for woche in meta["weeks"]:
            if "tiles" not in woche or ("mean" in woche and not args.force):
                continue
            ergebnis = stats(args.maps / woche["tiles"], meta["top"], kacheln, zoom)
            if ergebnis is None:
                continue
            woche["mean"], woche["max"] = round(ergebnis[0], 4), round(ergebnis[1], 4)
            neu += 1
        manifest.write_text(json.dumps(meta, indent=1))
        mittel = [w["mean"] for w in meta["weeks"] if "mean" in w]
        print(f"  {meta['name']:16s} {neu} Wochen gerechnet, Mittel {min(mittel):.3f} bis {max(mittel):.3f}"
              if mittel else f"  {meta['name']}: keine Kacheln")


if __name__ == "__main__":
    main()
