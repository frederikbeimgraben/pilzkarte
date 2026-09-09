#!/usr/bin/env python3
"""Download the static site layers: elevation, forest composition, soil.

These layers do not change between years. They describe the place, not the
weather, and they carry most of the information about where a species can grow
at all.

  dem    Copernicus DEM GLO-90, 90 m, from the AWS open-data bucket. One
         GeoTIFF per 1 by 1 degree tile. No account is needed.
  osm    The Geofabrik extract for Germany. OpenStreetMap tags forest polygons
         with leaf_type, which gives broadleaved against needleleaved cover.
         This is a usable substitute for the Copernicus forest-type layer,
         which needs an account.
  soil   SoilGrids 250 m from ISRIC: clay, sand, pH, organic carbon and bulk
         density for the top soil layers. Open, no account.

Usage:
    python static_fetch.py dem
    python static_fetch.py osm
    python static_fetch.py soil
"""

from __future__ import annotations

import argparse
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "pilze-research/0.1 (fungal fruiting phenology)"

# A bounding box that covers Germany with a small margin.
LAT_RANGE = range(47, 56)   # N47 .. N55
LON_RANGE = range(5, 16)    # E005 .. E015

DEM_BUCKET = "https://copernicus-dem-90m.s3.amazonaws.com"
OSM_URL = "https://download.geofabrik.de/europe/germany-latest.osm.pbf"

SOILGRIDS_WCS = "https://maps.isric.org/mapserv"
SOIL_PROPERTIES = ("clay", "sand", "silt", "phh2o", "soc", "bdod", "cfvo", "nitrogen")
SOIL_DEPTHS = ("0-5cm", "5-15cm", "15-30cm")
# Germany with a small margin, in degrees.
SOIL_BBOX = (5.0, 16.0, 47.0, 55.5)  # west, east, south, north


def download(url: str, target: Path, attempts: int = 4, quiet_404: bool = False) -> bool:
    if target.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".partial")
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=600) as response:
                size = int(response.headers.get("Content-Length", 0))
                with partial.open("wb") as handle:
                    shutil.copyfileobj(response, handle, length=1 << 20)
            if size and partial.stat().st_size != size:
                raise OSError(f"size mismatch {partial.stat().st_size} != {size}")
            partial.rename(target)
            print(f"  ok    {target.name}  {target.stat().st_size / 1e6:.1f} MB", flush=True)
            return True
        except urllib.error.HTTPError as err:
            partial.unlink(missing_ok=True)
            if err.code == 404:
                if not quiet_404:
                    print(f"  none  {target.name} (404)", flush=True)
                return False
            if attempt == attempts:
                print(f"  FAIL  {target.name}: {err}", file=sys.stderr, flush=True)
                return False
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            partial.unlink(missing_ok=True)
            print(f"  retry {attempt}/{attempts} {target.name}: {err}", file=sys.stderr, flush=True)
            if attempt == attempts:
                print(f"  FAIL  {target.name}", file=sys.stderr, flush=True)
                return False
    return False


def fetch_dem(out: Path) -> None:
    """Fetch the DEM tiles that cover Germany. Sea tiles return 404, which is fine."""
    print("Copernicus DEM GLO-90")
    got = 0
    for lat in LAT_RANGE:
        for lon in LON_RANGE:
            stem = f"Copernicus_DSM_COG_30_N{lat:02d}_00_E{lon:03d}_00_DEM"
            url = f"{DEM_BUCKET}/{stem}/{stem}.tif"
            if download(url, out / "dem" / f"{stem}.tif", quiet_404=True):
                got += 1
    print(f"  {got} new tiles")


def fetch_osm(out: Path) -> None:
    print("OpenStreetMap extract for Germany (forest polygons, leaf_type)")
    download(OSM_URL, out / "osm" / "germany-latest.osm.pbf")


def fetch_soil(out: Path) -> None:
    """Fetch SoilGrids layers, cut to the German extent, as GeoTIFF.

    The ISRIC web coverage service returns the cut directly, so the result is
    a normal GeoTIFF of about 7 MB for each property and depth. This is better
    than the .vrt files, which only point at remote tiles and need a network
    connection every time you read them.
    """
    print("SoilGrids 250 m, cut to Germany")
    west, east, south, north = SOIL_BBOX
    crs = "http://www.opengis.net/def/crs/EPSG/0/4326"
    for prop in SOIL_PROPERTIES:
        for depth in SOIL_DEPTHS:
            coverage = f"{prop}_{depth}_mean"
            query = urllib.parse.urlencode({
                "map": f"/map/{prop}.map",
                "SERVICE": "WCS",
                "VERSION": "2.0.1",
                "REQUEST": "GetCoverage",
                "COVERAGEID": coverage,
                "FORMAT": "GEOTIFF_INT16",
                "SUBSET": [f"long({west},{east})", f"lat({south},{north})"],
                "SUBSETTINGCRS": crs,
                "OUTPUTCRS": crs,
            }, doseq=True)
            download(f"{SOILGRIDS_WCS}?{query}", out / "soil" / f"{coverage}.tif")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("group", choices=("dem", "osm", "soil"))
    parser.add_argument("--out", type=Path, default=Path("data/raw"))
    args = parser.parse_args()
    {"dem": fetch_dem, "osm": fetch_osm, "soil": fetch_soil}[args.group](args.out)


if __name__ == "__main__":
    main()
