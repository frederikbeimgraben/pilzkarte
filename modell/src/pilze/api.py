#!/usr/bin/env python3
"""The find server: accept finds from the people who use the map, hand them back.

The map itself is a directory of files. This is the one part that holds
state: the finds that visitors report from the forest. It keeps them in one
SQLite file and speaks a small JSON API under /api/.

  GET    /api/status           how many finds exist; whether a code is set
  POST   /api/anmelden         {"code": ...}  ->  200 if the code is right
  GET    /api/funde[?art=slug] the finds, newest first
  POST   /api/funde            one find, idempotent on its id
  DELETE /api/funde/<id>       remove one find

Every call except /api/status carries the access code in the X-Zugang
header. The code is one shared secret for the circle of people who use the
map: it is generated on the first start, written to the state directory, and
printed to the log, so the admin reads it there and hands it on. A find
carries a name typed by the reporter, nothing more; there are no accounts.

The finds are exact positions. They are visible only with the code, which
keeps the project rule for protected species: nothing public below 5 km.

The service needs nothing beyond the standard library. It can also serve the
map directory itself, for a local test with the page and the API on one
origin:

    python api.py --static reports/maps --port 8111

On the server it runs behind Caddy, which proxies /api/ to it. The file is
mirrored there by rsync, so the process watches its own mtime and exits when
the file changes; systemd starts it again with the new code.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
from datetime import date, datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SLUG = re.compile(r"^[a-z_]{1,40}$")
ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
MAX_BODY = 16_000
# Germany with a margin, so a find just across the border still counts.
LAT, LON = (45.0, 57.0), (4.0, 17.0)


def neuer_code() -> str:
    """Three groups of four characters, without the ones that look alike."""
    zeichen = "abcdefghjkmnpqrstuvwxyz23456789"
    return "-".join("".join(secrets.choice(zeichen) for _ in range(4)) for _ in range(3))


class Speicher:
    """The SQLite file, behind one lock. The server threads share it."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("""CREATE TABLE IF NOT EXISTS funde (
            id TEXT PRIMARY KEY, art TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL,
            datum TEXT NOT NULL, name TEXT NOT NULL, notiz TEXT NOT NULL,
            anzahl INTEGER, erstellt TEXT NOT NULL)""")
        self.db.execute("CREATE INDEX IF NOT EXISTS funde_art ON funde(art, datum)")
        self.db.commit()

    def liste(self, art: str | None) -> list[dict]:
        with self.lock:
            if art:
                rows = self.db.execute("SELECT * FROM funde WHERE art = ? ORDER BY datum DESC, erstellt DESC",
                                       (art,)).fetchall()
            else:
                rows = self.db.execute("SELECT * FROM funde ORDER BY datum DESC, erstellt DESC").fetchall()
        return [dict(r) for r in rows]

    def anzahl(self) -> int:
        with self.lock:
            return self.db.execute("SELECT count(*) FROM funde").fetchone()[0]

    def setze(self, fund: dict) -> dict:
        with self.lock:
            self.db.execute("""INSERT INTO funde (id, art, lat, lon, datum, name, notiz, anzahl, erstellt)
                VALUES (:id, :art, :lat, :lon, :datum, :name, :notiz, :anzahl, :erstellt)
                ON CONFLICT(id) DO UPDATE SET art=excluded.art, lat=excluded.lat, lon=excluded.lon,
                datum=excluded.datum, name=excluded.name, notiz=excluded.notiz, anzahl=excluded.anzahl""",
                            fund)
            self.db.commit()
            return dict(self.db.execute("SELECT * FROM funde WHERE id = ?", (fund["id"],)).fetchone())

    def loesche(self, kennung: str) -> bool:
        with self.lock:
            weg = self.db.execute("DELETE FROM funde WHERE id = ?", (kennung,)).rowcount
            self.db.commit()
        return weg > 0


def pruefe_fund(roh: dict) -> dict | str:
    """Return a clean row, or the reason the input is refused."""
    if not isinstance(roh, dict):
        return "kein Objekt"
    kennung = str(roh.get("id", ""))
    if not ID.match(kennung):
        return "id fehlt oder ist ungueltig"
    art = str(roh.get("art", ""))
    if not SLUG.match(art):
        return "art ist ungueltig"
    try:
        lat, lon = float(roh["lat"]), float(roh["lon"])
    except (KeyError, TypeError, ValueError):
        return "lat und lon fehlen"
    if not (LAT[0] <= lat <= LAT[1] and LON[0] <= lon <= LON[1]):
        return "Ort liegt ausserhalb des Gebiets"
    datum = str(roh.get("datum", ""))
    try:
        tag = date.fromisoformat(datum)
    except ValueError:
        return "datum muss JJJJ-MM-TT sein"
    if tag > date.today():
        return "datum liegt in der Zukunft"
    name = str(roh.get("name", "")).strip()[:40]
    if not name:
        return "name fehlt"
    notiz = str(roh.get("notiz", "")).strip()[:500]
    anzahl = roh.get("anzahl")
    if anzahl not in (None, ""):
        try:
            anzahl = int(anzahl)
        except (TypeError, ValueError):
            return "anzahl muss eine ganze Zahl sein"
        if not 1 <= anzahl <= 999:
            return "anzahl muss zwischen 1 und 999 liegen"
    else:
        anzahl = None
    return {"id": kennung, "art": art, "lat": round(lat, 6), "lon": round(lon, 6),
            "datum": tag.isoformat(), "name": name, "notiz": notiz, "anzahl": anzahl,
            "erstellt": datetime.now(timezone.utc).isoformat(timespec="seconds")}


class Handler(SimpleHTTPRequestHandler):
    speicher: Speicher
    code: str
    statisch: str | None

    def __init__(self, *args, **kwargs):
        # Without a static directory every non-API path is a 404.
        super().__init__(*args, directory=self.statisch or os.devnull, **kwargs)

    # -- helpers -----------------------------------------------------------
    def antwort(self, status: int, body) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def fehler(self, status: int, grund: str) -> None:
        self.antwort(status, {"fehler": grund})

    def koerper(self):
        laenge = int(self.headers.get("Content-Length") or 0)
        if laenge > MAX_BODY:
            self.fehler(413, "zu gross")
            return None
        try:
            return json.loads(self.rfile.read(laenge) or b"{}")
        except ValueError:
            self.fehler(400, "kein JSON")
            return None

    def angemeldet(self) -> bool:
        gegeben = self.headers.get("X-Zugang", "")
        if secrets.compare_digest(gegeben.encode(), self.code.encode()):
            return True
        self.fehler(403, "Zugangscode fehlt oder ist falsch")
        return False

    def log_message(self, form, *args):
        # Only the API is worth a line; the tiles would drown the log.
        if self.path.startswith("/api/"):
            sys.stderr.write("%s %s\n" % (self.command, form % args))

    # -- routes ------------------------------------------------------------
    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            if self.statisch:
                return super().do_GET()
            return self.fehler(404, "nicht hier")
        if url.path == "/api/status":
            return self.antwort(200, {"funde": self.speicher.anzahl(), "zugang": True})
        if url.path == "/api/funde":
            if not self.angemeldet():
                return
            art = parse_qs(url.query).get("art", [None])[0]
            if art and not SLUG.match(art):
                return self.fehler(400, "art ist ungueltig")
            return self.antwort(200, {"funde": self.speicher.liste(art)})
        self.fehler(404, "unbekannter Pfad")

    def do_POST(self):
        url = urlparse(self.path)
        if url.path == "/api/anmelden":
            body = self.koerper()
            if body is None:
                return
            gegeben = str(body.get("code", "")) if isinstance(body, dict) else ""
            if secrets.compare_digest(gegeben.encode(), self.code.encode()):
                return self.antwort(200, {"ok": True})
            time.sleep(0.5)          # a wrong guess costs a little time
            return self.fehler(403, "Zugangscode ist falsch")
        if url.path == "/api/funde":
            if not self.angemeldet():
                return
            body = self.koerper()
            if body is None:
                return
            fund = pruefe_fund(body)
            if isinstance(fund, str):
                return self.fehler(400, fund)
            return self.antwort(200, {"fund": self.speicher.setze(fund)})
        self.fehler(404, "unbekannter Pfad")

    def do_DELETE(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/funde/"):
            if not self.angemeldet():
                return
            kennung = url.path.rsplit("/", 1)[1]
            if not ID.match(kennung):
                return self.fehler(400, "id ist ungueltig")
            if self.speicher.loesche(kennung):
                return self.antwort(200, {"ok": True})
            return self.fehler(404, "kein Fund mit dieser id")
        self.fehler(404, "unbekannter Pfad")


def wache(pfad: Path, alle: float = 20.0) -> None:
    """Exit when this file changes on disk. systemd starts the new one."""
    stand = pfad.stat().st_mtime
    while True:
        time.sleep(alle)
        try:
            if pfad.stat().st_mtime != stand:
                print("api.py hat sich geaendert, Neustart", flush=True)
                os._exit(0)
        except FileNotFoundError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path,
                        default=Path(os.environ.get("PILZE_API_STATE", "data/api")),
                        help="folder for the database and the access code")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PILZE_API_PORT", 8111)))
    parser.add_argument("--bind", default=os.environ.get("PILZE_API_BIND", "127.0.0.1"))
    parser.add_argument("--static", default=None,
                        help="also serve this directory, for a local test")
    parser.add_argument("--watch", action="store_true",
                        help="exit when this file changes, so systemd restarts it")
    args = parser.parse_args()

    args.state.mkdir(parents=True, exist_ok=True)
    code_datei = args.state / "zugang"
    if not code_datei.exists():
        code_datei.write_text(neuer_code() + "\n")
        code_datei.chmod(0o600)
        print(f"neuer Zugangscode in {code_datei}", flush=True)
    code = code_datei.read_text().strip()
    print(f"Zugangscode: {code}", flush=True)

    Handler.speicher = Speicher(args.state / "funde.sqlite")
    Handler.code = code
    Handler.statisch = args.static
    if args.watch or os.environ.get("PILZE_API_WATCH"):
        threading.Thread(target=wache, args=(Path(__file__).resolve(),), daemon=True).start()
    server = ThreadingHTTPServer((args.bind, args.port), Handler)
    print(f"Fundserver auf {args.bind}:{args.port}, {Handler.speicher.anzahl()} Funde"
          + (f", statisch aus {args.static}" if args.static else ""), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
