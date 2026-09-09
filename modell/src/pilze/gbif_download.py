#!/usr/bin/env python3
"""Ask GBIF to build one archive, instead of paging the search API.

The search API answers 300 records at a time and slows down at a high offset.
Nine million records would need about 30000 requests and most of a day. The
download API takes one request, builds the archive on the server, and returns
a citable DOI. It needs an account.

Credentials come from ~/.config/gbif/credentials, three lines:

    user=...
    password=...
    email=...

Usage:
    python gbif_download.py request --countries DE,AT,CH
    python gbif_download.py status  --key 0012345-260906123456789
    python gbif_download.py fetch   --key 0012345-260906123456789
"""

from __future__ import annotations

import argparse
import base64
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.gbif.org/v1"
UA = "pilze-research/0.1 (fungal fruiting phenology)"
FUNGI = "5"


def credentials() -> dict:
    path = Path.home() / ".config/gbif/credentials"
    if not path.exists():
        raise SystemExit(f"no credentials at {path}")
    out = {}
    for line in path.read_text().splitlines():
        if "=" in line:
            key, _, value = line.partition("=")
            out[key.strip()] = value.strip()
    for field in ("user", "password", "email"):
        if field not in out:
            raise SystemExit(f"{path} has no {field}")
    return out


def call(path: str, method: str = "GET", body: dict | None = None,
         auth: dict | None = None, timeout: int = 120):
    headers = {"User-Agent": UA}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if auth:
        token = base64.b64encode(f"{auth['user']}:{auth['password']}".encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw.decode().strip()


def request_download(countries: list[str], year_from: int, auth: dict) -> str:
    body = {
        "creator": auth["user"],
        "notificationAddresses": [auth["email"]],
        "sendNotification": True,
        "format": "SIMPLE_CSV",
        "predicate": {"type": "and", "predicates": [
            {"type": "in", "key": "COUNTRY", "values": countries},
            {"type": "equals", "key": "TAXON_KEY", "value": FUNGI},
            {"type": "equals", "key": "HAS_COORDINATE", "value": "true"},
            {"type": "equals", "key": "HAS_GEOSPATIAL_ISSUE", "value": "false"},
            {"type": "equals", "key": "BASIS_OF_RECORD", "value": "HUMAN_OBSERVATION"},
            {"type": "equals", "key": "OCCURRENCE_STATUS", "value": "PRESENT"},
            {"type": "greaterThanOrEquals", "key": "YEAR", "value": str(year_from)},
        ]},
    }
    return call("/occurrence/download/request", "POST", body, auth)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=("request", "status", "fetch", "wait"))
    parser.add_argument("--countries", default="DE,AT,CH,NL,BE,LU,DK,CZ,PL,FR")
    parser.add_argument("--year-from", type=int, default=2014)
    parser.add_argument("--key", default=None)
    parser.add_argument("--out", type=Path, default=Path("data/raw/gbif_eu"))
    args = parser.parse_args()
    auth = credentials()

    if args.action == "request":
        countries = [c.strip().upper() for c in args.countries.split(",")]
        key = request_download(countries, args.year_from, auth)
        print(f"download key: {key}")
        print(f"countries:    {', '.join(countries)}")
        print(f"watch it at:  https://www.gbif.org/occurrence/download/{key}")
        Path("data/raw/gbif_eu_key.txt").parent.mkdir(parents=True, exist_ok=True)
        Path("data/raw/gbif_eu_key.txt").write_text(key)
        return

    key = args.key or Path("data/raw/gbif_eu_key.txt").read_text().strip()

    if args.action in ("status", "wait"):
        while True:
            meta = call(f"/occurrence/download/{key}")
            status = meta.get("status")
            size = meta.get("size") or 0
            print(f"  {status}   records {meta.get('totalRecords', '?')}   "
                  f"{size / 1e6:.0f} MB   doi {meta.get('doi', '-')}", flush=True)
            if args.action == "status" or status in ("SUCCEEDED", "KILLED", "FAILED", "CANCELLED"):
                return
            time.sleep(60)

    if args.action == "fetch":
        meta = call(f"/occurrence/download/{key}")
        if meta.get("status") != "SUCCEEDED":
            raise SystemExit(f"not ready: {meta.get('status')}")
        args.out.mkdir(parents=True, exist_ok=True)
        target = args.out / f"{key}.zip"
        url = meta["downloadLink"]
        print(f"fetching {meta['totalRecords']} records, {meta['size']/1e6:.0f} MB ...")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=1800) as response, target.open("wb") as handle:
            shutil.copyfileobj(response, handle, length=1 << 20)
        print(f"wrote {target}  ({target.stat().st_size/1e6:.0f} MB)")
        print(f"cite as: {meta.get('doi')}")


if __name__ == "__main__":
    main()
