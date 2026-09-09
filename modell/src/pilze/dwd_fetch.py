#!/usr/bin/env python3
"""Download DWD open-data grids for Germany.

Two dataset groups are relevant for fungal fruiting:

  hyras   1 km daily grids of precipitation, air temperature, humidity and
          global radiation. One NetCDF file per variable and year.
  soil    1 km daily grids of soil moisture, modelled separately for spruce,
          beech, oak and pine stands. Host tree species controls which
          mycorrhizal fungi can fruit, so a soil moisture field per tree
          species matches the biology better than a single generic field.

The script reads the directory listing of the server, selects the newest
version of each file and downloads what is missing. A download that stops
early leaves a .partial file, and the next run starts that file again.

Usage:
    python dwd_fetch.py hyras --start 2010 --end 2026
    python dwd_fetch.py soil  --start 2010 --end 2026 --depth 0-30
    python dwd_fetch.py --list
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily"
USER_AGENT = "pilze-research/0.1 (fungal fruiting phenology)"

HYRAS_VARS = {
    "precipitation": "pr",
    "air_temperature_mean": "tas",
    "air_temperature_min": "tasmin",
    "air_temperature_max": "tasmax",
    "humidity": "hurs",
    "radiation_global": "rsds",
}
TREE_SPECIES = ("spruce", "beech", "oak", "pine")


def listing(url: str) -> list[str]:
    """Return the file and directory names in a server directory."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as response:
        html = response.read().decode("utf-8", "replace")
    names = re.findall(r'href="([^"?][^"]*)"', html)
    return [n for n in names if not n.startswith("../")]


def download(url: str, target: Path, attempts: int = 4) -> bool:
    """Download one file. Return True if the file was fetched now."""
    if target.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".partial")
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=300) as response:
                size = int(response.headers.get("Content-Length", 0))
                with partial.open("wb") as handle:
                    shutil.copyfileobj(response, handle, length=1 << 20)
            if size and partial.stat().st_size != size:
                raise OSError(f"size mismatch: got {partial.stat().st_size}, want {size}")
            partial.rename(target)
            print(f"  ok    {target.name}  {target.stat().st_size / 1e6:.0f} MB", flush=True)
            return True
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as err:
            print(f"  retry {attempt}/{attempts} {target.name}: {err}", file=sys.stderr, flush=True)
            partial.unlink(missing_ok=True)
            if attempt == attempts:
                print(f"  FAIL  {target.name}", file=sys.stderr, flush=True)
                return False
    return False


def newest_version(names: list[str], pattern: str) -> str | None:
    """Pick the file with the highest version suffix, for example v6-1 over v6-0."""
    matches = [n for n in names if re.fullmatch(pattern, n)]
    if not matches:
        return None
    def version_key(name: str) -> tuple[int, ...]:
        found = re.search(r"_v(\d+)(?:-(\d+))?_", name)
        if not found:
            return (0, 0)
        return (int(found.group(1)), int(found.group(2) or 0))
    return max(matches, key=version_key)


def fetch_hyras(out: Path, start: int, end: int, variables: list[str]) -> None:
    for folder in variables:
        short = HYRAS_VARS[folder]
        url = f"{BASE}/hyras_de/{folder}/"
        try:
            names = listing(url)
        except Exception as err:
            print(f"{folder}: cannot read listing: {err}", file=sys.stderr)
            continue
        print(f"\n{folder} ({short})")
        for year in range(start, end + 1):
            name = newest_version(names, rf"{short}_hyras_\d+_{year}_v[\d-]+_de\.nc")
            if not name:
                print(f"  none  {year}")
                continue
            download(url + name, out / "hyras" / folder / name)


def fetch_soil(out: Path, start: int, end: int, depth: str, species: list[str]) -> None:
    for tree in species:
        print(f"\nsoil moisture: {tree} {depth} cm")
        for year in range(start, end + 1):
            url = f"{BASE}/soil_moisture/{tree}/{year}/"
            try:
                names = listing(url)
            except Exception as err:
                print(f"  none  {year}: {err}", file=sys.stderr)
                continue
            name = newest_version(
                names,
                rf"grids_germany_daily_soil_moisture_{tree}_{year}_{re.escape(depth)}_v[\d-]+\.nc",
            )
            if not name:
                print(f"  none  {year} {depth}")
                continue
            download(url + name, out / "soil_moisture" / tree / name)


def show_listing() -> None:
    print("hyras_de variables:")
    for name in listing(f"{BASE}/hyras_de/"):
        print("   ", name)
    print("\nsoil_moisture stands:")
    for name in listing(f"{BASE}/soil_moisture/"):
        print("   ", name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("group", nargs="?", choices=("hyras", "soil"))
    parser.add_argument("--out", type=Path, default=Path("data/raw/dwd"))
    parser.add_argument("--start", type=int, default=2010)
    parser.add_argument("--end", type=int, default=2026)
    parser.add_argument("--depth", default="0-30", help="soil layer in cm, for example 0-10")
    parser.add_argument("--vars", default=",".join(HYRAS_VARS))
    parser.add_argument("--species", default=",".join(TREE_SPECIES))
    parser.add_argument("--list", action="store_true", help="show what the server offers")
    args = parser.parse_args()

    if args.list:
        show_listing()
        return
    if not args.group:
        parser.error("give a group: hyras or soil")
    if args.group == "hyras":
        fetch_hyras(args.out, args.start, args.end, args.vars.split(","))
    else:
        fetch_soil(args.out, args.start, args.end, args.depth, args.species.split(","))


if __name__ == "__main__":
    main()
