#!/usr/bin/env python3
"""Report what the GBIF download holds.

The report gives the record count for each source dataset, which you need for
the citation, and the record count for the most frequent species.

Usage:
    python summarize.py --dir data/raw/gbif
"""

from __future__ import annotations

import argparse
import gzip
import json
import urllib.request
from collections import Counter
from pathlib import Path

USER_AGENT = "pilze-research/0.1"


def dataset_title(key: str) -> str:
    url = f"https://api.gbif.org/v1/dataset/{key}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as response:
            data = json.load(response)
        return data.get("title", key)
    except Exception:
        return key


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", type=Path, default=Path("data/raw/gbif"))
    parser.add_argument("--top", type=int, default=25)
    args = parser.parse_args()

    total = 0
    datasets: Counter[str] = Counter()
    species: Counter[str] = Counter()
    years: Counter[int] = Counter()
    licenses: Counter[str] = Counter()
    phyla: Counter[str] = Counter()

    files = sorted(args.dir.glob("*.jsonl.gz"))
    for path in files:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                total += 1
                datasets[record.get("datasetKey", "?")] += 1
                if record.get("species"):
                    species[record["species"]] += 1
                if record.get("year"):
                    years[record["year"]] += 1
                licenses[record.get("license", "?").rsplit("/licenses/", 1)[-1]] += 1
                phyla[record.get("phylum", "?")] += 1

    print(f"files: {len(files)}   records: {total}\n")

    print("Source datasets, for the citation:")
    for key, count in datasets.most_common():
        if count < total * 0.001:
            continue
        print(f"  {count:>8}  {dataset_title(key)}")
        print(f"            https://www.gbif.org/dataset/{key}")

    print("\nLicenses:")
    for name, count in licenses.most_common():
        print(f"  {count:>8}  {name}")

    print("\nPhyla:")
    for name, count in phyla.most_common(8):
        print(f"  {count:>8}  {name}")

    print(f"\nTop {args.top} species:")
    for name, count in species.most_common(args.top):
        print(f"  {count:>8}  {name}")

    print("\nRecords per year, last 20 years:")
    for year in sorted(years)[-20:]:
        print(f"  {year}  {years[year]:>7}  " + "#" * (years[year] // 3000))


if __name__ == "__main__":
    main()
