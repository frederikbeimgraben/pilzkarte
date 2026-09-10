"""Cut a probability field into XYZ value tiles.

A tile carries the value, not the colour. One byte per point instead of four,
and the browser applies the colour ramp. That is the smaller half of the
saving. The larger half is that a viewport asks for the tiles it shows, not
for the whole country: an overview of Germany costs six tiles instead of a
1.4 MB image, and a close view costs eight.

Byte 0 means no data. Bytes 1 to 255 carry the value relative to the highest
cell of this species, so the full range stays in use even for a species whose
best cell reaches 0.20. The absolute value comes back as (byte - 1) / 254 *
top, with top in the manifest.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

import numpy as np

# Half the width of the web mercator world, in metres.
RAND = 20037508.342789244
KACHEL = 256


def kachelraster(west: float, south: float, east: float, north: float,
                 zoom: int) -> tuple[int, int, int, int]:
    """Tile indices that cover a box given in EPSG:3857."""
    weite = 2 * RAND / 2 ** zoom
    tx0 = int(math.floor((west + RAND) / weite))
    tx1 = int(math.floor((east + RAND) / weite))
    ty0 = int(math.floor((RAND - north) / weite))
    ty1 = int(math.floor((RAND - south) / weite))
    return tx0, ty0, tx1, ty1


def kachelbox(tx0: int, ty0: int, tx1: int, ty1: int,
              zoom: int) -> tuple[float, float, float, float]:
    """The exact EPSG:3857 extent of a block of tiles."""
    weite = 2 * RAND / 2 ** zoom
    return (-RAND + tx0 * weite, RAND - (ty1 + 1) * weite,
            -RAND + (tx1 + 1) * weite, RAND - ty0 * weite)


def schreibe_kacheln(quelle: Path, ziel: Path, top: float, zooms: range,
                     arbeit: Path, wgs_box: tuple[float, float, float, float]
                     ) -> tuple[list[tuple[int, int, int]], int]:
    """Warp a one band field to every zoom level and write it below ``ziel``."""
    return write_tile_sets(quelle, [ziel], [top], zooms, arbeit, wgs_box)[0]


def write_tile_sets(quelle: Path, targets: list[Path], tops: list[float],
                    zooms: range, arbeit: Path,
                    wgs_box: tuple[float, float, float, float]
                    ) -> list[tuple[list[tuple[int, int, int]], int]]:
    """Cut every band of a source into its own tile tree.

    ``quelle`` is a GeoTIFF in any CRS with one band per tile tree, ``wgs_box``
    its extent as (west, south, east, north) in degrees. Empty tiles are
    skipped. The returned list names, per band, the tiles that carry data, so
    the page can leave the empty ones alone instead of asking for them and
    getting a 404.

    One gdalwarp per zoom level covers every band. A call per band would pay
    the start of the process again for each of them, and that start is most of
    its cost: measured on the weekly layers, a further band adds 0.04 s where a
    further call adds 0.3 s. The result is the same to the byte.
    """
    import rasterio
    from PIL import Image
    from pyproj import Transformer

    nach_merc = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    west, south = nach_merc.transform(wgs_box[0], wgs_box[1])
    east, north = nach_merc.transform(wgs_box[2], wgs_box[3])

    filled: list[list[tuple[int, int, int]]] = [[] for _ in targets]
    written = [0 for _ in targets]
    for zoom in zooms:
        tx0, ty0, tx1, ty1 = kachelraster(west, south, east, north, zoom)
        box = kachelbox(tx0, ty0, tx1, ty1, zoom)
        breite, hoehe = (tx1 - tx0 + 1) * KACHEL, (ty1 - ty0 + 1) * KACHEL
        gewarpt = arbeit / f"z{zoom}.tif"
        # gdalwarp trifft das Kachelraster genau, wenn Ausschnitt und
        # Punktzahl vorgegeben sind. Selbst skaliert saesse es daneben.
        subprocess.run(
            ["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857",
             "-te", *[f"{v:.6f}" for v in box],
             "-ts", str(breite), str(hoehe),
             "-r", "average", "-dstnodata", "nan",
             # Jedes Band traegt seine eigene Maske: der Regen der letzten
             # acht Wochen fehlt am Anfang der Reihe, wo der der Woche schon
             # dasteht. Die Option haelt gdalwarp daran fest, statt die
             # Gueltigkeit ueber alle Baender zusammenzufassen.
             "-wo", "UNIFIED_SRC_NODATA=NO",
             str(quelle), str(gewarpt)],
            check=True, capture_output=True)

        with rasterio.open(gewarpt) as src:
            for band, (target, top) in enumerate(zip(targets, tops), start=1):
                feld = src.read(band)
                gueltig = np.isfinite(feld)
                stufe = np.where(gueltig,
                                 np.clip(feld / max(top, 1e-6), 0, 1) * 254 + 1, 0)
                stufe = stufe.astype(np.uint8)

                for j in range(ty1 - ty0 + 1):
                    for i in range(tx1 - tx0 + 1):
                        k = stufe[j * KACHEL:(j + 1) * KACHEL,
                                  i * KACHEL:(i + 1) * KACHEL]
                        if not k.any():
                            continue
                        ordner = target / str(zoom) / str(tx0 + i)
                        ordner.mkdir(parents=True, exist_ok=True)
                        datei = ordner / f"{ty0 + j}.png"
                        Image.fromarray(k, mode="L").save(datei, optimize=True)
                        filled[band - 1].append((zoom, tx0 + i, ty0 + j))
                        written[band - 1] += datei.stat().st_size
    return list(zip(filled, written))
