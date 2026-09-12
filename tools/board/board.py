#!/usr/bin/env python3
"""Ein Brett für die Arbeit an der Pilzkarte, im eigenen Netz.

Frederik will den Stand sehen, ohne zu fragen. Agenten schreiben ihren
Fortschritt hinein, ohne ein Werkzeug zu lernen: eine Zeile mit curl
genügt. Darum Standardbibliothek, eine JSON-Datei als Speicher und ein
Dienst, der auf der Schleife und auf der Tunneladresse horcht.

    python3 tools/board/board.py            # 127.0.0.1:8123 und 10.66.66.5:8123
    curl -s localhost:8123/api/cards | jq   # alles lesen
    curl -sX POST localhost:8123/api/cards -d '{"titel":"…","spalte":"backlog"}'
    curl -sX PATCH localhost:8123/api/cards/17 -d '{"spalte":"arbeit","agent":"b3"}'
    http://localhost:8123/erd               # das Entitätendiagramm der Modelle
"""

from __future__ import annotations

import json
import os
import re
import threading
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

SPEICHER = Path(os.environ.get("BOARD_DATEI", Path.home() / ".local/state/pilzkarte-board.json"))
HERE = Path(__file__).resolve().parent
# Das Diagramm baut `backend/tools/erd.py` aus den Modellen. Mermaid liegt
# daneben, denn der Rechner hängt nicht immer am Netz.
DIAGRAM = HERE / "erd.mmd"
MERMAID = HERE / "vendor" / "mermaid.min.js"
PORT = int(os.environ.get("BOARD_PORT", "8123"))
ADRESSEN = os.environ.get("BOARD_ADRESSEN", "127.0.0.1,10.66.66.5").split(",")
SPALTEN = [
    ("backlog", "Backlog"),
    ("bereit", "Bereit"),
    ("arbeit", "In Arbeit"),
    ("pruefung", "Abnahme"),
    ("fertig", "Fertig"),
]
SPALTEN_IDS = [s for s, _ in SPALTEN]
SPERRE = threading.Lock()


def jetzt() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def laden() -> dict:
    if not SPEICHER.exists():
        return {"naechste": 1, "karten": []}
    return json.loads(SPEICHER.read_text())


def sichern(daten: dict) -> None:
    # Erst daneben schreiben, dann tauschen: ein Absturz mittendrin darf das
    # Brett nicht zerreissen.
    SPEICHER.parent.mkdir(parents=True, exist_ok=True)
    vorlaeufig = SPEICHER.with_suffix(".tmp")
    vorlaeufig.write_text(json.dumps(daten, ensure_ascii=False, indent=1))
    vorlaeufig.replace(SPEICHER)


def karte_bauen(daten: dict, feld: dict) -> dict:
    karte = {
        "id": daten["naechste"],
        "titel": feld.get("titel", "ohne Titel"),
        "spalte": feld.get("spalte", "backlog"),
        "paket": feld.get("paket", ""),
        "agent": feld.get("agent", ""),
        "notiz": feld.get("notiz", ""),
        "marke": feld.get("marke", ""),
        "pr": feld.get("pr", ""),
        "angelegt": jetzt(),
        "geaendert": jetzt(),
    }
    daten["naechste"] += 1
    daten["karten"].append(karte)
    return karte


class Griff(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_: object) -> None:  # noqa: D102 - kein Zugriffslog noetig
        return

    def _antwort(self, koerper: bytes, typ: str = "application/json", code: int = 200) -> None:
        self.send_response(code)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(koerper)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(koerper)

    def _json(self, wert: object, code: int = 200) -> None:
        self._antwort(json.dumps(wert, ensure_ascii=False).encode(), code=code)

    def _koerper(self) -> dict:
        laenge = int(self.headers.get("Content-Length", "0"))
        if not laenge:
            return {}
        return json.loads(self.rfile.read(laenge))

    def _datei(self, datei: Path, typ: str) -> None:
        if not datei.exists():
            self._json({"fehler": f"{datei.name} fehlt"}, 404)
            return
        self._antwort(datei.read_bytes(), typ)

    def do_GET(self) -> None:  # noqa: N802
        pfad = urlparse(self.path).path
        if pfad == "/api/cards":
            with SPERRE:
                self._json(laden())
            return
        if pfad in ("/", "/index.html"):
            self._antwort(BOARD_PAGE.encode(), "text/html; charset=utf-8")
            return
        if pfad in ("/erd", "/erd/"):
            self._antwort(ERD_PAGE.encode(), "text/html; charset=utf-8")
            return
        if pfad == "/erd.mmd":
            self._datei(DIAGRAM, "text/plain; charset=utf-8")
            return
        if pfad == "/erd/mermaid.min.js":
            self._datei(MERMAID, "text/javascript; charset=utf-8")
            return
        self._json({"fehler": "nicht gefunden"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/cards":
            self._json({"fehler": "nicht gefunden"}, 404)
            return
        with SPERRE:
            daten = laden()
            karte = karte_bauen(daten, self._koerper())
            sichern(daten)
        self._json(karte, 201)

    def do_PATCH(self) -> None:  # noqa: N802
        treffer = re.fullmatch(r"/api/cards/(\d+)", urlparse(self.path).path)
        if not treffer:
            self._json({"fehler": "nicht gefunden"}, 404)
            return
        kennung = int(treffer.group(1))
        feld = self._koerper()
        with SPERRE:
            daten = laden()
            for karte in daten["karten"]:
                if karte["id"] == kennung:
                    for name in ("titel", "spalte", "paket", "agent", "notiz", "marke", "pr"):
                        if name in feld:
                            karte[name] = feld[name]
                    karte["geaendert"] = jetzt()
                    sichern(daten)
                    self._json(karte)
                    return
        self._json({"fehler": "keine Karte mit dieser Nummer"}, 404)

    def do_DELETE(self) -> None:  # noqa: N802
        treffer = re.fullmatch(r"/api/cards/(\d+)", urlparse(self.path).path)
        if not treffer:
            self._json({"fehler": "nicht gefunden"}, 404)
            return
        kennung = int(treffer.group(1))
        with SPERRE:
            daten = laden()
            vorher = len(daten["karten"])
            daten["karten"] = [k for k in daten["karten"] if k["id"] != kennung]
            sichern(daten)
        self._json({"geloescht": vorher - len(daten["karten"])})


FONT = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap"

# Was beide Seiten teilen: Farben, Schrift, Kopfleiste. Das Diagramm soll neben
# dem Brett nicht wie ein zweites Werkzeug aussehen.
STYLE = """
 :root{--bg:#101512;--flaeche:#161c18;--rand:#2a332d;--text:#e8eee9;--leise:#95a09a;
       --gruen:#4f9d6f;--gruensub:#16291f;--rot:#d2685f;--gold:#c8a25a}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--text);font-family:Archivo,system-ui,sans-serif}
 header{padding:14px 18px;border-bottom:1px solid var(--rand);display:flex;align-items:center;gap:14px;position:sticky;top:0;background:var(--bg);z-index:2}
 header b{font-size:19px}
 header span{color:var(--leise);font-size:13px}
 header nav{margin-left:auto;display:flex;gap:16px;font-size:13px}
 a{color:var(--gruen)}
"""


def page(title: str, style: str, body: str) -> str:
    """Eine Seite des Bretts: gleiche Schrift, gleiche Farben, eigener Inhalt."""
    return (
        '<!doctype html>\n<html lang="de"><head><meta charset="utf-8">'
        f"<title>Pilzkarte, {title}</title>\n"
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        f'<link rel="stylesheet" href="{FONT}">\n'
        "<style>" + STYLE + style + "</style></head><body>\n" + body + "\n</body></html>\n"
    )


BOARD_STYLE = """
 .brett{display:grid;grid-template-columns:repeat(5,minmax(260px,1fr));gap:12px;padding:14px;align-items:start}
 .spalte{background:var(--flaeche);border:1px solid var(--rand);border-radius:12px;padding:10px;min-height:120px}
 .spalte h2{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--leise);margin:2px 4px 10px;display:flex;justify-content:space-between}
 .karte{background:var(--bg);border:1px solid var(--rand);border-radius:10px;padding:10px 12px;margin-bottom:8px}
 .karte h3{font-size:14px;font-weight:600;margin:0 0 6px;line-height:1.35}
 .zeile{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
 .marke{font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;background:#1d2420;color:var(--leise)}
 .marke.paket{background:var(--gruensub);color:var(--gruen)}
 .marke.agent{background:#241f14;color:var(--gold)}
 .marke.fehler{background:#2a1a19;color:var(--rot)}
 .notiz{font-size:12px;color:var(--leise);margin-top:6px;line-height:1.45}
 .knopf{margin-top:8px;display:flex;gap:6px}
 .knopf button{flex:1;background:transparent;border:1px solid var(--rand);color:var(--leise);border-radius:8px;height:26px;font-size:12px;cursor:pointer;font-family:inherit}
 .knopf button:hover{border-color:var(--gruen);color:var(--gruen)}
 @media(max-width:900px){.brett{grid-template-columns:1fr}}
"""

BOARD_BODY = """<header><b>Pilzkarte</b><span id="stand">lädt …</span>
<nav><a href="/erd">Entitäten</a></nav></header>
<div class="brett" id="brett"></div>
<script>
const SPALTEN = [["backlog","Backlog"],["bereit","Bereit"],["arbeit","In Arbeit"],["pruefung","Abnahme"],["fertig","Fertig"]];
async function zeichnen(){
  const daten = await (await fetch('/api/cards',{cache:'no-store'})).json();
  const brett = document.getElementById('brett');
  brett.innerHTML = '';
  for (const [id, name] of SPALTEN) {
    const karten = daten.karten.filter(k => k.spalte === id);
    const spalte = document.createElement('div');
    spalte.className = 'spalte';
    spalte.innerHTML = `<h2><span>${name}</span><span>${karten.length}</span></h2>`;
    for (const k of karten) {
      const el = document.createElement('div');
      el.className = 'karte';
      const marken = [k.paket && `<span class="marke paket">${k.paket}</span>`,
                      k.agent && `<span class="marke agent">${k.agent}</span>`,
                      k.marke && `<span class="marke ${k.marke==='Fehler'?'fehler':''}">${k.marke}</span>`,
                      k.pr && `<a class="marke" href="${k.pr}" target="_blank">PR</a>`]
                     .filter(Boolean).join('');
      el.innerHTML = `<h3>${k.titel}</h3><div class="zeile">${marken}</div>` +
                     (k.notiz ? `<div class="notiz">${k.notiz}</div>` : '') +
                     `<div class="knopf"><button data-id="${k.id}" data-zu="links">◀</button>` +
                     `<button data-id="${k.id}" data-zu="rechts">▶</button></div>`;
      spalte.appendChild(el);
    }
    brett.appendChild(spalte);
  }
  document.getElementById('stand').textContent =
    daten.karten.length + ' Karten · Stand ' + new Date().toLocaleTimeString('de-DE');
  for (const b of brett.querySelectorAll('button')) b.onclick = schieben;
}
async function schieben(e){
  const id = e.target.dataset.id, zu = e.target.dataset.zu;
  const daten = await (await fetch('/api/cards',{cache:'no-store'})).json();
  const karte = daten.karten.find(k => String(k.id) === id);
  const i = SPALTEN.findIndex(([s]) => s === karte.spalte);
  const neu = SPALTEN[Math.min(SPALTEN.length-1, Math.max(0, i + (zu === 'rechts' ? 1 : -1)))][0];
  await fetch('/api/cards/' + id, {method:'PATCH', body: JSON.stringify({spalte: neu})});
  zeichnen();
}
zeichnen();
setInterval(zeichnen, 5000);
</script>"""

ERD_STYLE = """
 .diagram{padding:18px;overflow:auto}
 .diagram svg{max-width:none}
 .hint{margin:18px;padding:12px 14px;background:var(--flaeche);border:1px solid var(--rand);border-radius:12px;color:var(--leise);font-size:13px;line-height:1.6}
 .hint code{color:var(--gruen);font-family:ui-monospace,SFMono-Regular,monospace}
"""

ERD_BODY = """<header><b>Pilzkarte</b><span id="stand">lädt …</span>
<nav><a href="/">Brett</a></nav></header>
<div class="diagram" id="diagram"></div>
<script src="/erd/mermaid.min.js"></script>
<script>
const BUILD = 'Neu bauen mit <code>cd backend &amp;&amp; uv run python -m tools.erd</code>.';
const status = document.getElementById('stand');
const board = document.getElementById('diagram');
function hint(text){ board.innerHTML = '<div class="hint">' + text + '</div>'; }
if (typeof mermaid === 'undefined') {
  status.textContent = 'Mermaid fehlt';
  hint('<code>tools/board/vendor/mermaid.min.js</code> fehlt. Die Seite lädt nichts aus dem Netz.');
} else {
  // darkMode leitet die Streifen der Spaltenliste aus dem Hintergrund ab.
  // Ohne ihn legt Mermaid helle Streifen unter die helle Schrift.
  mermaid.initialize({startOnLoad:false, theme:'base', fontFamily:'Archivo, system-ui, sans-serif',
    themeVariables:{darkMode:true, background:'#101512', primaryColor:'#161c18',
      primaryTextColor:'#e8eee9', primaryBorderColor:'#2a332d', lineColor:'#4f9d6f',
      textColor:'#e8eee9', nodeBorder:'#2a332d'},
    er:{useMaxWidth:false}});
  let drawn = '';
  async function draw(){
    const answer = await fetch('/erd.mmd', {cache:'no-store'});
    if (!answer.ok) { status.textContent = 'kein Diagramm'; drawn = ''; hint('Es gibt noch kein Diagramm. ' + BUILD); return; }
    const text = await answer.text();
    // Nur bei Änderung neu zeichnen: ein Neuaufbau je Umlauf ließe die
    // Seite bei jedem Blick springen.
    if (text === drawn) return;
    try {
      const {svg} = await mermaid.render('erd-svg', text);
      board.innerHTML = svg;
      drawn = text;
      const tables = (text.match(/^ {4}\\S+ \\{$/gm) || []).length;
      status.textContent = tables + ' Tabellen · Stand ' + new Date().toLocaleTimeString('de-DE');
    } catch (error) {
      status.textContent = 'Diagramm fehlerhaft';
      hint(String(error.message || error) + '<br>' + BUILD);
    }
  }
  draw();
  setInterval(draw, 5000);
}
</script>"""

BOARD_PAGE = page("Brett", BOARD_STYLE, BOARD_BODY)
ERD_PAGE = page("Entitäten", ERD_STYLE, ERD_BODY)


def main() -> None:
    dienste = []
    for adresse in ADRESSEN:
        dienst = ThreadingHTTPServer((adresse.strip(), PORT), Griff)
        dienste.append(dienst)
        threading.Thread(target=dienst.serve_forever, daemon=True).start()
        print(f"horcht auf http://{adresse.strip()}:{PORT}")
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        for dienst in dienste:
            dienst.shutdown()


if __name__ == "__main__":
    main()
