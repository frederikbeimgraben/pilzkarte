#!/usr/bin/env python3
"""Download GBIF fungal occurrence records for Germany.

The script uses the public occurrence/search API. It needs no account. The API
returns a maximum of 100000 records per query, so the script splits the request
into one query per year. If a year holds more than 100000 records, the script
splits that year into months.

Output is one gzipped JSON-Lines file per chunk in the target directory. Each
line is one occurrence record with a reduced set of fields.

The observer name goes through a SHA-256 hash. The model needs the identity of
an observer to correct for survey effort, but it does not need the name.

Usage:
    python gbif_fetch.py --out data/raw/gbif --start 2000 --end 2026
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.gbif.org/v1/occurrence/search"
COUNTRY = "DE"
FUNGI_TAXON_KEY = 5
PAGE_LIMIT = 300
MAX_OFFSET = 100_000
USER_AGENT = "pilze-research/0.1 (fungal fruiting phenology; +https://gbif.org)"

# Fields kept from each record. Everything else is dropped to keep the files
# small. Add a field here and run the script again if you need more.
FIELDS = (
    "gbifID datasetKey publishingOrgKey license basisOfRecord occurrenceStatus "
    "kingdom phylum class order family genus species scientificName "
    "acceptedScientificName taxonRank taxonKey acceptedTaxonKey speciesKey genusKey "
    "decimalLatitude decimalLongitude coordinateUncertaintyInMeters elevation "
    "eventDate year month day stateProvince individualCount "
    "identificationVerificationStatus issues "
    # When GBIF last processed the record. The gap to eventDate measures
    # the reporting delay, which the activity features suffer from.
    "lastInterpreted"
).split()


def hash_observer(value: object) -> str | None:
    """Return a stable pseudonymous ID for an observer, or None."""
    if not value:
        return None
    text = value if isinstance(value, str) else json.dumps(value, sort_keys=True)
    return hashlib.sha256(text.strip().lower().encode("utf-8")).hexdigest()[:16]


def slim(record: dict) -> dict:
    out = {k: record[k] for k in FIELDS if k in record}
    out["recordedByHash"] = hash_observer(record.get("recordedBy"))
    return out


def request(params: dict, attempts: int = 10) -> dict:
    """Send one API request. Retry on network and server errors.

    Status 429 means that the client asked too often. The server may send a
    Retry-After header. Wait much longer after 429 than after another error.
    Two workers with a pause of 0.4 s stay under the limit. Six workers do not.
    """
    url = f"{API}?{urllib.parse.urlencode(params, doseq=True)}"
    delay = 2.0
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as err:
            if attempt == attempts:
                raise
            if err.code == 429:
                header = err.headers.get("Retry-After") if err.headers else None
                # The server sends Retry-After: 3, but it keeps refusing after
                # three seconds. Treat the header as a floor, not as the answer.
                suggested = float(header) if header and str(header).isdigit() else 0.0
                wait = max(suggested, 30.0) * attempt
                print(f"    rate limited, wait {wait:.0f}s (attempt {attempt}/{attempts})",
                      file=sys.stderr, flush=True)
                time.sleep(wait)
                continue
            print(f"    retry {attempt}/{attempts} after {err}", file=sys.stderr, flush=True)
            time.sleep(delay)
            delay *= 2
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            if attempt == attempts:
                raise
            print(f"    retry {attempt}/{attempts} after {err}", file=sys.stderr, flush=True)
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def base_params(**extra) -> dict:
    params = {
        "country": COUNTRY,
        "taxonKey": FUNGI_TAXON_KEY,
        "hasCoordinate": "true",
        "hasGeospatialIssue": "false",
        "basisOfRecord": "HUMAN_OBSERVATION",
        "occurrenceStatus": "PRESENT",
    }
    params.update(extra)
    return params


def count(**extra) -> int:
    return request(base_params(limit=0, **extra))["count"]


def fetch_chunk(path: Path, expected: int, pause: float, **extra) -> int:
    """Page through one chunk and write it to a gzipped JSON-Lines file."""
    if path.exists():
        print(f"  {path.name}: present, skipped")
        return 0
    partial = path.with_suffix(path.suffix + ".partial")
    written = 0
    with gzip.open(partial, "wt", encoding="utf-8") as handle:
        offset = 0
        while offset < MAX_OFFSET:
            page = request(base_params(limit=PAGE_LIMIT, offset=offset, **extra))
            for record in page["results"]:
                handle.write(json.dumps(slim(record), ensure_ascii=False) + "\n")
                written += 1
            if page.get("endOfRecords") or not page["results"]:
                break
            offset += PAGE_LIMIT
            time.sleep(pause)
    partial.rename(path)
    flag = "" if written >= expected else f"  << SHORT, expected {expected}"
    print(f"  {path.name}: {written} records{flag}")
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/raw/gbif"))
    parser.add_argument("--start", type=int, default=2000)
    parser.add_argument("--end", type=int, default=2026)
    parser.add_argument("--pause", type=float, default=0.4,
                        help="seconds between requests")
    parser.add_argument("--country", default="DE",
                        help="ISO country code, for example AT or CH")
    parser.add_argument("--month-threshold", type=int, default=20_000,
                        help="split a year into months above this record count")
    args = parser.parse_args()

    global COUNTRY
    COUNTRY = args.country
    args.out.mkdir(parents=True, exist_ok=True)
    total = 0
    for year in range(args.start, args.end + 1):
        n_year = count(year=year)
        print(f"{year}: {n_year} records")
        if n_year == 0:
            continue
        year_file = args.out / f"fungi_{COUNTRY.lower()}_{year}.jsonl.gz"
        if year_file.exists():
            # An earlier run fetched the whole year in one file. Leave it alone.
            # Splitting it into months now would write the records a second time.
            print(f"  {year_file.name}: present, skipped")
            continue
        if n_year <= args.month_threshold:
            total += fetch_chunk(year_file, n_year, args.pause, year=year)
            continue
        # Split the year into months. This stays under the offset limit, and
        # it also runs faster: the API slows down as the offset grows.
        for month in range(1, 13):
            n_month = count(year=year, month=month)
            if n_month == 0:
                continue
            if n_month > MAX_OFFSET:
                print(f"  WARNING {year}-{month:02d}: {n_month} records "
                      f"exceed the API limit of {MAX_OFFSET}; split it further")
            total += fetch_chunk(args.out / f"fungi_{COUNTRY.lower()}_{year}-{month:02d}.jsonl.gz",
                                 n_month, args.pause, year=year, month=month)
    print(f"\nTotal records written: {total}")


if __name__ == "__main__":
    main()
