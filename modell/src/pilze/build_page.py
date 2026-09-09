#!/usr/bin/env python3
"""Assemble the page from the manifests, the catalogue and the web files.

The page lives in three files under web/: index.html, app.css and app.js.
This script fills the placeholders of index.html with the species manifests
that region_map.py writes, the input layers of input_layers.py, the species
catalogue of katalog.py and the colour ramp, and it puts the finished page
next to the tiles together with the manifest of the app, the service worker
and the icons.

Every file name that changes its content carries a version stamp, so a
browser that cached the old page gets the new one.

Usage:
    python build_page.py --out reports/maps/index.html
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from katalog import katalog

WEB = Path(__file__).parent / "web"

TITLES = {
    "boletus_edulis": "Steinpilz", "birkenpilz": "Birkenpilz",
    "pfifferling": "Pfifferling", "reizker": "Reizker",
    "hexen_flock": "Flockenstieliger Hexenröhrling",
    "hexen_netz": "Netzstieliger Hexenröhrling",
    "parasol": "Parasol",
    "nebelkappe": "Nebelkappe",
    "schopftintling": "Schopftintling",
    "flaschenbovist": "Flaschenbovist",
    "schleimruebling": "Buchen-Schleimrübling",
    "sommersteinpilz": "Sommersteinpilz",
}
COLORS = [[13,8,39],[54,17,82],[101,26,104],[148,40,100],[194,59,84],
          [229,92,60],[248,137,55],[252,187,89],[252,231,155]]

MANIFEST = {
    "name": "Pilzkarte", "short_name": "Pilze", "lang": "de",
    "description": "Wo und wann in Deutschland welche Pilze fruchten, mit Fundmeldungen.",
    "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#1b1b2f", "theme_color": "#1b1b2f",
    "icons": [
        {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}
ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="#1b1b2f"/>
<path d="M96 268c0-98 72-172 160-172s160 74 160 172c0 14-10 24-24 24H120c-14 0-24-10-24-24z" fill="#e8a33c"/>
<circle cx="190" cy="200" r="22" fill="#f6d9a6"/><circle cx="292" cy="160" r="16" fill="#f6d9a6"/>
<circle cx="330" cy="236" r="19" fill="#f6d9a6"/>
<path d="M208 292h96l-14 118c-2 14-12 22-26 22h-16c-14 0-24-8-26-22z" fill="#f2e6c9"/>
</svg>
"""
# Der Service Worker: die Huelle der App kommt zuerst aus dem Netz und faellt
# auf den Cache zurueck, Kacheln kommen zuerst aus dem Cache. Die API wird nie
# gecacht. Die Versionsnummer wechselt mit jedem Seitenbau, damit eine neue
# Seite den alten Huellen-Cache abloest.
SW = """// Pilzkarte, Service Worker, Stand __VERSION__
const VERSION = '__VERSION__';
const HUELLE = 'pilze-huelle-' + VERSION;
const KACHELN = 'pilze-kacheln';
const HINTERGRUND = 'pilze-hintergrund';
const HUELLE_DATEIEN = ['./', 'index.html', 'app.css?v=__VERSION__', 'app.js?v=__VERSION__',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
const GRENZE = {[KACHELN]: 4000, [HINTERGRUND]: 1500};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(HUELLE).then(c =>
    Promise.all(HUELLE_DATEIEN.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k.startsWith('pilze-huelle-') && k !== HUELLE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Ein Cache waechst nicht ueber seine Grenze; die aeltesten Eintraege gehen zuerst.
async function stutze(name){
  const c = await caches.open(name), ks = await c.keys();
  const zuviel = ks.length - GRENZE[name];
  for (let i = 0; i < zuviel; i++) await c.delete(ks[i]);
}
let stutzZaehler = 0;
async function zuerstCache(name, req){
  const c = await caches.open(name);
  const alt = await c.match(req);
  if (alt) return alt;
  const neu = await fetch(req);
  if (neu.ok){ c.put(req, neu.clone()); if (++stutzZaehler % 200 === 0) stutze(name); }
  return neu;
}
async function zuerstNetz(name, req){
  const c = await caches.open(name);
  try {
    const neu = await fetch(req);
    if (neu.ok) c.put(req, neu.clone());
    return neu;
  } catch(e){
    const alt = await c.match(req, {ignoreSearch: true});
    if (alt) return alt;
    throw e;
  }
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  const eigen = url.origin === self.location.origin;
  if (eigen && /\\.png$/.test(url.pathname) && !/icon-\\d+\\.png$/.test(url.pathname)){
    e.respondWith(zuerstCache(KACHELN, e.request));
  } else if (eigen || url.hostname === 'unpkg.com'){
    e.respondWith(zuerstNetz(HUELLE, e.request));
  } else if (/tile\\.openstreetmap\\.org|cartocdn\\.com|opentopomap\\.org|arcgisonline\\.com/.test(url.hostname)){
    e.respondWith(zuerstNetz(HINTERGRUND, e.request));
  }
});
"""


def schreibe_app_dateien(maps: Path, version: str) -> None:
    """The style, the script, the manifest, the service worker and the icons."""
    for name in ("app.css", "app.js"):
        shutil.copyfile(WEB / name, maps / name)
    (maps / "manifest.webmanifest").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=1))
    (maps / "sw.js").write_text(SW.replace("__VERSION__", version))
    (maps / "icon.svg").write_text(ICON_SVG)
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("  Pillow fehlt, keine PNG-Icons")
        return
    for size in (192, 512):
        s = size / 512
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(96 * s), fill="#1b1b2f")
        d.pieslice([int(96 * s), int(96 * s), int(416 * s), int(440 * s)], 180, 360, fill="#e8a33c")
        d.rectangle([int(96 * s), int(268 * s), int(416 * s), int(292 * s)], fill="#e8a33c")
        for cx, cy, r in ((190, 200, 22), (292, 160, 16), (330, 236, 19)):
            d.ellipse([int((cx - r) * s), int((cy - r) * s), int((cx + r) * s), int((cy + r) * s)],
                      fill="#f6d9a6")
        d.rounded_rectangle([int(208 * s), int(292 * s), int(304 * s), int(432 * s)],
                            radius=int(18 * s), fill="#f2e6c9")
        img.save(maps / f"icon-{size}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--maps", type=Path, default=Path("reports/maps"))
    parser.add_argument("--out", type=Path, default=Path("reports/maps/index.html"))
    args = parser.parse_args()

    data = {}
    for path in sorted(args.maps.glob("*.json")):
        meta = json.loads(path.read_text())
        if "weeks" not in meta:
            continue
        meta["title"] = TITLES.get(meta["name"], meta["name"])
        data[meta["name"]] = meta
        print(f"  {meta['name']}: {len(meta['weeks'])} weeks, max p {meta['top']:.3f}")
    if not data:
        raise SystemExit(f"no manifests in {args.maps}")

    def versioniere(datei: str) -> str:
        """Der Name bleibt gleich, der Inhalt nicht. Ohne Kennzeichen liefert
        der Browser das alte Bild aus, denn die Bilder gehen mit
        Cache-Control immutable und einer Woche Haltbarkeit raus."""
        bild = args.maps / datei
        return f"{datei}?v={int(bild.stat().st_mtime)}" if bild.exists() else datei

    layer_path = args.maps / "layers.json"
    inputs = json.loads(layer_path.read_text()) if layer_path.exists() else {"layers": {}}
    print(f"  Eingabe-Ebenen: {len(inputs['layers'])}")

    # Die Seite startet mit dem Steinpilz, nicht mit der alphabetisch ersten
    # Art. Sonst begruesst sie den Besucher mit der schwaechsten Karte im Satz.
    if "boletus_edulis" in data:
        data = {"boletus_edulis": data.pop("boletus_edulis"), **data}

    for satz in data.values():
        funde = args.maps / "funde" / f"{satz['name']}.json"
        if funde.exists():
            satz["finds"] = versioniere(f"funde/{satz['name']}.json")
        for woche in satz["weeks"]:
            if "file" in woche:
                woche["file"] = versioniere(woche["file"])
            if "tiles" in woche:
                # Ein Kennzeichen fuer das ganze Wochenverzeichnis statt
                # eines je Kachel. Sonst waeren es zehntausende stat-Aufrufe.
                ordner = args.maps / woche["tiles"]
                if ordner.exists():
                    woche["tv"] = int(ordner.stat().st_mtime)
    for ebene in inputs.get("layers", {}).values():
        if "file" in ebene:
            ebene["file"] = versioniere(ebene["file"])
        if "tiles" in ebene:
            ordner = args.maps / ebene["tiles"]
            if ordner.exists():
                ebene["tv"] = int(ordner.stat().st_mtime)

    # Das Gebiet ist die Huelle aller Karten. Weiter darf niemand herauszoomen.
    alle = [d["bounds"] for d in data.values()]
    if inputs.get("bounds"):
        alle.append(inputs["bounds"])
    gebiet = [[min(b[0][0] for b in alle), min(b[0][1] for b in alle)],
              [max(b[1][0] for b in alle), max(b[1][1] for b in alle)]]

    # Nur die Arten mit Karte kommen in den Katalog der Seite, in der
    # Reihenfolge der Karten.
    profile = {p["slug"]: p for p in katalog(args.maps)}
    profile = [profile[n] for n in data if n in profile] + [p for s, p in profile.items() if s not in data]
    version = time.strftime("%Y%m%d-%H%M%S")
    knapp = dict(separators=(",", ":"), ensure_ascii=False)
    html = ((WEB / "index.html").read_text(encoding="utf-8")
            .replace("__DATA__", json.dumps(data, **knapp))
            .replace("__INPUTS__", json.dumps(inputs, **knapp))
            .replace("__KATALOG__", json.dumps(profile, **knapp))
            .replace("__COLORS__", json.dumps(COLORS))
            .replace("__BOUNDS__", json.dumps(gebiet))
            .replace("__VERSION__", version))
    args.out.write_text(html, encoding="utf-8")
    schreibe_app_dateien(args.out.parent, version)
    print(f"\nwrote {args.out}  ({args.out.stat().st_size/1000:.0f} kB), {len(data)} species, "
          f"{len(profile)} profiles, plus app files")


if __name__ == "__main__":
    main()
