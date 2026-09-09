#!/usr/bin/env python3
"""Build the artboards of the Pilzkarte design canvas from one set of parts.

Every value comes from the ui-kit tokens (light theme): colours, Archivo,
the 4 px grid, radii 4/8/12/18, control height 36 px.
"""
from pathlib import Path
import json

OUT = Path(__file__).parent
T = dict(bg="#f7f8f7", surface="#ffffff", sunken="#eef0ee", border="#e0e3e0", strong="#828a84",
         text="#141815", muted="#666c67", primary="#004225", psub="#e9f1ec", onp="#ffffff",
         accent="#8c6820", accent4="#c8a25a", danger="#8c1c16", warn="#876010", warnsub="#f7eed8",
         info="#185468", infosub="#dfeef3", success="#1f5d38", successsub="#e3f1e8")
RAMP = ["#0d0827", "#361152", "#651a68", "#942864", "#c23b54", "#e55c3c", "#f88937", "#fcbb59", "#fce79b"]

HEAD = """<!doctype html>
<html><head><meta charset="utf-8"><script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap">
<style>
 *{box-sizing:border-box}
 body{margin:0;background:#c7ccc8;font-family:'Archivo','Segoe UI',system-ui,sans-serif;color:%(text)s;-webkit-font-smoothing:antialiased}
 a{color:%(primary)s} a:hover{color:#00351e}
 .tel{width:390px;height:844px;position:relative;overflow:hidden;background:%(bg)s}
 .desk{width:1440px;height:900px;position:relative;overflow:hidden;background:%(bg)s;display:grid;grid-template-columns:400px 1fr;grid-template-rows:64px 1fr}
 .karte{position:absolute;inset:0;background:
   radial-gradient(120px 90px at 22%% 18%%, #dfe8d6 0, transparent 100%%),
   radial-gradient(160px 120px at 78%% 30%%, #d3dfcb 0, transparent 100%%),
   radial-gradient(200px 140px at 40%% 62%%, #d8e3d0 0, transparent 100%%),
   linear-gradient(180deg,#eef2ea,#e4ebe0)}
 .karte svg{position:absolute;inset:0;width:100%%;height:100%%}
 .heat{position:absolute;inset:0;mix-blend-mode:multiply;opacity:.92}
 .tab-nav{position:absolute;left:0;right:0;bottom:0;height:64px;background:%(surface)s;border-top:1px solid %(border)s;display:flex;padding:6px 8px 8px}
 .tab-nav div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;font-weight:600;color:%(muted)s}
 .tab-nav div.on{color:%(primary)s}
 .tab-nav svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
 .blatt{position:absolute;left:0;right:0;bottom:64px;background:%(surface)s;border-radius:18px 18px 0 0;box-shadow:0 8px 28px rgba(0,38,21,.14);display:flex;flex-direction:column}
 .griff{height:24px;display:flex;align-items:center;justify-content:center}
 .griff i{display:block;width:40px;height:4px;border-radius:2px;background:%(border)s}
 .kopf{padding:0 16px 12px;border-bottom:1px solid %(border)s}
 .kopfzeile{display:flex;align-items:center;justify-content:space-between;height:44px}
 .kopfzeile b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
 .kopfzeile b span{color:%(muted)s;font-weight:500;margin-right:6px}
 .kopfzeile b em{font-style:normal;color:%(danger)s}
 .knoepfe{display:flex;gap:0;border:1px solid %(strong)s;border-radius:8px;overflow:hidden;flex:0 0 auto;margin-left:12px}
 .knoepfe i{display:flex;align-items:center;justify-content:center;width:38px;height:36px;background:%(surface)s;border-left:1px solid %(strong)s}
 .knoepfe i:first-child{border-left:0}
 .knoepfe i svg{width:12px;height:12px;fill:%(text)s}
 .leiste{display:flex;gap:6px;overflow:hidden;padding:10px 16px 2px;margin:0 -16px}
 .woche{flex:0 0 auto;width:48px;height:56px;border:1px solid %(border)s;border-radius:8px;background:%(surface)s;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;color:%(muted)s}
 .woche small{font-size:10px;letter-spacing:.06em}
 .woche b{font-size:15px;color:%(text)s;font-variant-numeric:tabular-nums}
 .woche u{position:absolute;bottom:6px;left:8px;right:8px;height:3px;border-radius:2px;background:%(border)s;text-decoration:none}
 .woche u i{display:block;height:100%%;border-radius:2px;background:%(accent4)s}
 .woche.on{background:%(primary)s;border-color:%(primary)s}
 .woche.on b,.woche.on small{color:%(onp)s}
 .woche.prog{border-style:dashed}
 .woche.jahr::before{content:attr(data-jahr);position:absolute;top:3px;font-size:8px;font-weight:700;color:%(accent)s}
 .inhalt{padding:16px 16px 24px;display:flex;flex-direction:column;gap:24px;flex:1 1 auto;min-height:0;overflow:hidden}
 .seg{display:flex;gap:4px;background:%(sunken)s;border:1px solid %(border)s;border-radius:12px;padding:4px}
 .seg div{flex:1;text-align:center;padding:9px 4px;font-size:15px;font-weight:600;color:%(muted)s;border-radius:8px}
 .seg div.on{background:%(surface)s;color:%(text)s;box-shadow:0 1px 2px rgba(0,38,21,.06),0 1px 3px rgba(0,38,21,.08)}
 .h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:%(muted)s;font-weight:600;margin-bottom:10px}
 .chips{display:flex;gap:8px;overflow:hidden;padding-bottom:2px}
 .chip{flex:0 0 auto;height:40px;display:flex;align-items:center;padding:0 16px;border:1px solid %(strong)s;border-radius:999px;font-size:14px;font-weight:600;color:%(text)s;background:%(surface)s;white-space:nowrap}
 .chip.on{background:%(primary)s;border-color:%(primary)s;color:%(onp)s}
 .rampe{display:flex;height:12px;border-radius:6px;overflow:hidden}
 .rampe i{flex:1}
 .enden{display:flex;justify-content:space-between;font-size:13px;color:%(muted)s;font-variant-numeric:tabular-nums;margin-top:6px}
 .schalter{display:flex;align-items:center;gap:12px;height:48px;padding:0 14px;border:1px solid %(border)s;border-radius:10px;font-size:15px}
 .schalter i{width:20px;height:20px;border:1px solid %(strong)s;border-radius:4px;background:%(surface)s;display:flex;align-items:center;justify-content:center}
 .schalter i.on{background:%(primary)s;border-color:%(primary)s}
 .schalter i svg{width:12px;height:12px;stroke:%(onp)s;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
 .schalter em{font-style:normal;color:%(muted)s;margin-left:auto;font-size:13px}
 .knopf{height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 20px;border-radius:10px;font-size:15px;font-weight:600;border:1px solid transparent;white-space:nowrap}
 .knopf.primaer{background:%(primary)s;color:%(onp)s}
 .knopf.sekundaer{background:%(surface)s;color:%(text)s;border-color:%(strong)s}
 .knopf.geist{color:%(primary)s}
 .knopf.gefahr{background:%(surface)s;color:%(danger)s;border-color:%(danger)s}
 .knopf.gross{height:48px}
 .knopf.breit{width:100%%}
 .knopf svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
 .feld{height:44px;display:flex;align-items:center;padding:0 16px;border:1px solid %(strong)s;border-radius:10px;background:%(surface)s;font-size:16px}
 .feld.leer{color:%(muted)s}
 .feld.mehrzeilig{height:80px;align-items:flex-start;padding-top:10px}
 .label{font-size:14px;font-weight:500;margin-bottom:8px}
 .badge{display:inline-flex;align-items:center;padding:4px 12px;font-size:12.5px;font-weight:600;line-height:1.4;border-radius:999px;background:%(sunken)s;color:%(muted)s;white-space:nowrap}
 .badge.p{background:%(psub)s;color:%(primary)s}
 .badge.w{background:%(warnsub)s;color:%(warn)s}
 .badge.i{background:%(infosub)s;color:%(info)s}
 .badge.s{background:%(successsub)s;color:%(success)s}
 .schwebe{position:absolute;right:12px;width:48px;height:48px;border-radius:14px;background:%(primary)s;color:%(onp)s;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(0,38,21,.14)}
 .schwebe.hell{background:%(surface)s;color:%(text)s;border:1px solid %(border)s}
 .schwebe svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
 .quelle{position:absolute;left:8px;top:8px;font-size:10px;color:%(muted)s;background:rgba(255,255,255,.75);padding:2px 6px;border-radius:4px}
 .card{background:%(surface)s;border:1px solid %(border)s;border-radius:12px;box-shadow:0 1px 2px rgba(0,38,21,.06),0 1px 3px rgba(0,38,21,.08);overflow:hidden}
 .zeile{display:flex;align-items:center;gap:14px}
 .stapel{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
 .titel{font-size:16px;font-weight:600}
 .unter{font-size:14px;color:%(muted)s}
 .kreuz{position:absolute;left:50%%;top:38%%;width:52px;height:52px;transform:translate(-50%%,-50%%)}
 .kreuz::before,.kreuz::after{content:"";position:absolute;background:%(primary)s}
 .kreuz::before{left:50%%;top:0;width:2px;height:100%%;transform:translateX(-50%%)}
 .kreuz::after{top:50%%;left:0;height:2px;width:100%%;transform:translateY(-50%%)}
 .kreuz i{position:absolute;inset:14px;border:2px solid %(primary)s;border-radius:50%%;background:rgba(0,66,37,.12)}
 .fund{position:absolute;width:16px;height:16px;border-radius:50%%;background:%(accent4)s;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
 .notiz{font-size:13px;color:%(muted)s;line-height:1.45}
 .kopfleiste{height:64px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid %(border)s;background:%(surface)s}
 .kopfleiste b{font-size:22px;font-weight:600;letter-spacing:-.01em}
 .kopfleiste .zurueck{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:%(primary)s}
 .kopfleiste .zurueck svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
 .seite{position:absolute;left:0;right:0;top:0;bottom:64px;display:flex;flex-direction:column;background:%(bg)s}
 .scroll{flex:1;overflow:hidden;padding:20px 16px;display:flex;flex-direction:column;gap:20px}
 .funke{width:96px;height:40px;flex:0 0 auto}
 .absatz{font-size:15px;line-height:1.55}
 .absatz.leise{color:%(muted)s}
 .liste{display:flex;flex-direction:column}
 .liste .zeile{padding:16px 0;border-bottom:1px solid %(border)s}
 .artliste{display:flex;flex-direction:column}
 .artzeile{display:grid;grid-template-columns:minmax(0,1fr) 96px;grid-template-rows:auto auto auto;column-gap:16px;row-gap:0;align-items:center;padding:14px 16px;border-bottom:1px solid %(border)s}
 .artzeile:last-child{border-bottom:0}
 .artzeile.aktiv{background:%(psub)s}
 .artzeile .funke{grid-column:2;grid-row:1/3;align-self:center}
 .artzeile .tags{grid-column:1/3;display:flex;gap:8px;margin-top:10px}
 .tabelle{display:flex;flex-direction:column}
 .tz{display:grid;grid-template-columns:104px minmax(0,1fr);column-gap:12px;padding:10px 14px;border-bottom:1px solid %(border)s;font-size:14px;line-height:1.45}
 .tz:last-child{border-bottom:0}
 .tz:nth-child(even){background:%(bg)s}
 .tk{color:%(muted)s;font-weight:600}
 .tw{color:%(text)s}
 .fuss{margin-top:auto;padding:12px 16px 16px;border-top:1px solid %(border)s;background:%(surface)s;display:flex;flex-direction:column;gap:10px}
 .fuss .reihe{display:grid;grid-template-columns:1fr 1fr;gap:12px}
 .anno{position:absolute;font-size:11px;color:%(accent)s;font-weight:600;letter-spacing:.04em}
</style>
</helmet>
""" % T
FOOT = "</x-dc>\n</body>\n</html>\n"

# ---------- Icons (stroke, 24 grid)
IC = {
    "karte": '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    "arten": '<svg viewBox="0 0 24 24"><path d="M4 11a8 6 0 0 1 16 0H4z"/><path d="M9 11v7a3 3 0 0 0 6 0v-7"/></svg>',
    "funde": '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    "mehr": '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    "plus": '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    "ort": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>',
    "ebenen": '<svg viewBox="0 0 24 24"><path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/></svg>',
    "zurueck": '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    "zu": '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    "haken": '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    "zone": '<svg viewBox="0 0 24 24"><path d="M5 8l7-4 7 5-2 8-8 3-4-6z"/><circle cx="5" cy="8" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="19" cy="9" r="1.5"/><circle cx="17" cy="17" r="1.5"/><circle cx="9" cy="20" r="1.5"/></svg>',
    "suche": '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
}
PLAY = '<svg viewBox="0 0 12 12"><path d="M3 1.4 10 6 3 10.6Z"/></svg>'
LINKS = '<svg viewBox="0 0 12 12"><path d="M8.5 1.5 3.5 6l5 4.5z"/></svg>'
RECHTS = '<svg viewBox="0 0 12 12"><path d="M3.5 1.5 8.5 6l-5 4.5z"/></svg>'


def nav(aktiv):
    teile = [("karte", "Karte"), ("arten", "Arten"), ("funde", "Einträge")]
    return '<div class="tab-nav">' + "".join(
        f'<div class="{"on" if k == aktiv else ""}">{IC[k]}<span>{t}</span></div>' for k, t in teile) + "</div>"


def heat(art="stein"):
    """A stylised prediction field: soft blobs in the ramp colours."""
    if art == "schnitt":
        blobs = [(110, 130, 60, T["primary"]), (250, 100, 40, T["primary"]), (200, 210, 70, T["primary"]), (330, 230, 35, T["primary"])]
        g = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity=".5"/>' for x, y, r, c in blobs)
        return f'<svg viewBox="0 0 390 320" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%">{g}</svg>'
    if art == "regen":
        blobs = [(70, 40, 90, "#c7dbe8"), (200, 130, 120, "#8fb6d1"), (300, 60, 80, "#5f93b8"), (120, 230, 110, "#a9c8dd")]
    else:
        blobs = [(90, 120, 70, RAMP[3]), (250, 90, 60, RAMP[5]), (180, 200, 90, RAMP[4]), (310, 220, 55, RAMP[6]), (60, 260, 50, RAMP[2])]
    g = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity=".55" filter="url(#w)"/>' for x, y, r, c in blobs)
    return (f'<svg class="heat" viewBox="0 0 390 420" preserveAspectRatio="xMidYMid slice"><defs><filter id="w"><feGaussianBlur stdDeviation="22"/></filter></defs>'
            f'<path d="M0 300 C80 260 140 330 220 290 S340 250 390 300" stroke="#b7c7e6" stroke-width="4" fill="none" opacity=".8"/>'
            f'<path d="M0 120 L120 150 L200 100 L290 170 L390 140" stroke="#ffffff" stroke-width="3" fill="none" opacity=".9"/>{g}</svg>')


AVATAR = f'<div style="position:absolute;left:12px;top:12px;width:40px;height:40px;border-radius:50%;background:{T["surface"]};border:1px solid {T["border"]};box-shadow:0 1px 3px rgba(0,38,21,.12);display:flex;align-items:center;justify-content:center;font-weight:600;color:{T["primary"]}">F</div>'
def karte(hoehe, art="stein", extra="", avatar=True):
    return f'<div class="karte" style="height:{hoehe}px;bottom:auto">{heat(art)}{extra}<span class="quelle" style="top:auto;bottom:8px">© OpenStreetMap</span>{AVATAR if avatar else ""}</div>'


def zeitleiste(aktiv=40, start=33, prognose_ab=41, jahr_bei=None, werte=None):
    werte = werte or {}
    w = ""
    for kw in range(start, start + 8):
        cls = "woche" + (" on" if kw == aktiv else "") + (" prog" if kw >= prognose_ab else "") + (" jahr" if kw == jahr_bei else "")
        pct = werte.get(kw, 30)
        w += f'<div class="{cls}"{" data-jahr=" + chr(34) + "2026" + chr(34) if kw == jahr_bei else ""}><small>KW</small><b>{kw}</b><u><i style="width:{pct}%"></i></u></div>'
    return f'<div class="leiste">{w}</div>'


def kopf(art="Steinpilz", woche="KW 40 · 2025", prognose=False, leiste=True, aktiv=40, link=True):
    em = ' <em>· Prognose</em>' if prognose else ''
    werte = {33: 18, 34: 26, 35: 40, 36: 48, 37: 62, 38: 70, 39: 88, 40: 100, 41: 76, 42: 60}
    titel = f'<span style="color:{T["primary"]};text-decoration:underline;text-decoration-color:{T["border"]};text-underline-offset:3px">{art}</span>' if link else f'<span style="color:{T["text"]}">{art}</span>'
    return (f'<div class="kopf"><div class="kopfzeile"><b>{titel}<span>·</span>{woche}{em}</b>'
            f'<div class="knoepfe"><i>{LINKS}</i><i>{PLAY}</i><i>{RECHTS}</i></div></div>'
            + (zeitleiste(aktiv=aktiv, werte=werte) if leiste else "") + '</div>')


def fuss(primaer=None, sekundaer=None, gefahr=None, geist=None, icon=None, zweite=None):
    """Aktionsleiste am unteren Rand jedes Blatts und jeder Objektseite.
    Oben die Hauptaktion in voller Breite, darunter Löschen links und Nebenaktion rechts."""
    teile = []
    if primaer:
        teile.append(f'<span class="knopf primaer gross breit">{IC[icon] if icon else ""}{primaer}</span>')
    if zweite and sekundaer:
        teile.append(f'<div class="reihe"><span class="knopf sekundaer">{zweite}</span><span class="knopf sekundaer">{sekundaer}</span></div>')
    elif gefahr and sekundaer:
        teile.append(f'<div class="reihe"><span class="knopf gefahr">{gefahr}</span><span class="knopf sekundaer">{sekundaer}</span></div>')
    elif sekundaer:
        teile.append(f'<span class="knopf sekundaer gross breit">{sekundaer}</span>')
    elif gefahr:
        teile.append(f'<span class="knopf gefahr breit">{gefahr}</span>')
    if geist:
        teile.append(f'<span class="knopf geist breit">{geist}</span>')
    return '<div class="fuss">' + "".join(teile) + '</div>'


def seg(aktiv):
    return '<div class="seg">' + "".join(f'<div class="{"on" if n == aktiv else ""}">{n}</div>' for n in ("Vorhersage", "Ebene", "Kombination")) + "</div>"


def chips(aktiv="Steinpilz"):
    namen = ["Steinpilz", "Birkenpilz", "Flaschenbovist", "Flockenstieliger H…"]
    return '<div class="chips">' + "".join(f'<div class="chip{" on" if n == aktiv else ""}">{n}</div>' for n in namen) + "</div>"


def rampe(lo="0 %", mitte="Fundwahrscheinlichkeit je Begehung", hi="50 %"):
    return (f'<div class="label" style="margin-bottom:10px">{mitte}</div><div class="rampe">' + "".join(f'<i style="background:{c}"></i>' for c in RAMP) + '</div>'
            f'<div class="enden"><span>{lo}</span><span>{hi}</span></div>')


def schalter(text, an=False, extra=""):
    return f'<div class="schalter"><i class="{"on" if an else ""}">{IC["haken"] if an else ""}</i>{text}{f"<em>{extra}</em>" if extra else ""}</div>'


def schwebend(top, icon, hell=False):
    return f'<div class="schwebe{" hell" if hell else ""}" style="top:{top}px">{IC[icon]}</div>'


def funke(gross=False, spitze=40, bis=39, achse=None):
    """Saisonkurve: Anteil positiver Gänge je Woche. Alle Jahre schwach als Fläche,
    das laufende Jahr als Linie bis zur letzten vollen Woche."""
    import math, random
    w, h = (330, 72) if gross else (88, 36)
    def wert(i, versatz=0.0, faktor=1.0):
        return faktor * (math.exp(-((i + 1 - spitze - versatz) ** 2) / 26) + 0.25 * math.exp(-((i + 1 - spitze - versatz + 6) ** 2) / 40))
    rnd = random.Random(spitze)
    roh_alt = [wert(i) for i in range(52)]
    roh_neu = [wert(i, -1.5, 1.1) + rnd.uniform(-.05, .05) * (wert(i) + .1) for i in range(bis)]
    top = max(roh_alt + roh_neu)  # beide Reihen auf denselben Höchstwert, nichts ragt über den Rand
    alt = [(i / 51 * w, h - 3 - v / top * (h - 8)) for i, v in enumerate(roh_alt)]
    neu = [(i / 51 * w, h - 3 - v / top * (h - 8)) for i, v in enumerate(roh_neu)]
    d_alt = f"M0,{h} " + " ".join(f"L{x:.1f},{y:.1f}" for x, y in alt) + f" L{w},{h} Z"
    d_neu = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in neu)
    d_neuf = f"M0,{h} " + " ".join(f"L{x:.1f},{y:.1f}" for x, y in neu) + f" L{neu[-1][0]:.1f},{h} Z"
    marken = "".join(f'<line x1="{k/51*w:.1f}" y1="{h-5}" x2="{k/51*w:.1f}" y2="{h}" stroke="{T["strong"]}"/>' for k in (0, 9, 18, 27, 36, 44))
    grund = f'<line x1="0" y1="{h-0.5}" x2="{w}" y2="{h-0.5}" stroke="{T["border"]}"/>'
    ex, ey = neu[-1]
    punkt = f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{3 if gross else 2}" fill="{T["primary"]}"/>'
    label = f'<text x="2" y="10" font-size="9" fill="{T["muted"]}" font-family="Archivo,system-ui">{achse}</text>' if achse else ""
    return (f'<svg class="funke" style="{"width:100%;height:72px" if gross else ""}" viewBox="0 0 {w} {h}" preserveAspectRatio="{"xMidYMid meet" if achse else "none"}">{grund}{marken}{label}'
            f'<path d="{d_alt}" fill="{T["accent4"]}" opacity=".3"/>'
            f'<path d="{d_neuf}" fill="{T["primary"]}" opacity=".12"/>'
            f'<path d="{d_neu}" fill="none" stroke="{T["primary"]}" stroke-width="{2 if gross else 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>{punkt}</svg>')


def kurvenlegende(bis=39, hoch=32):
    return (f'<div class="enden" style="margin-top:8px"><span><i style="display:inline-block;width:14px;height:3px;background:{T["primary"]};vertical-align:middle;margin-right:6px;border-radius:2px"></i>2025 bis KW {bis}</span>'
            f'<span><i style="display:inline-block;width:14px;height:10px;background:{T["accent4"]};opacity:.35;vertical-align:middle;margin-right:6px;border-radius:2px"></i>2015 bis 2024, Anteil der Begehungen mit Fund</span></div>')


def artboard(name, body, breite=390, hoehe=844):
    (OUT / f"{name}.dc.html").write_text(HEAD + body + FOOT)


# ---------- 1 Karte, Blatt halb (Main)
artboard("Main",
    '<div class="tel">' + karte(470)
    + '<div class="fund" style="left:150px;top:255px"></div><div class="fund" style="left:238px;top:190px"></div>'
    + schwebend(12, "ebenen", True) + schwebend(72, "ort", True) + schwebend(132, "plus")
    + '<div class="blatt" style="top:466px">'
    + '<div class="griff"><i></i></div>' + kopf()
    + '<div class="inhalt">' + seg("Vorhersage")
    + '<div>' + rampe("0 %", "Fundwahrscheinlichkeit je Begehung", "50 %") + '</div>'
    + '</div></div>' + nav("karte") + '</div>')

# ---------- 2 Karte, Blatt eingeklappt
artboard("KarteEingeklappt",
    '<div class="tel">' + karte(660)
    + '<div class="fund" style="left:150px;top:395px"></div><div class="fund" style="left:238px;top:330px"></div>'
    + schwebend(12, "ebenen", True) + schwebend(72, "ort", True) + schwebend(132, "plus")
    + '<div class="blatt" style="top:620px"><div class="griff"><i></i></div>' + kopf() + '</div>'
    + nav("karte") + '</div>')

# ---------- 3 Ebene
artboard("Ebene",
    '<div class="tel">' + karte(470, "regen") + schwebend(12, "ebenen", True) + schwebend(72, "ort", True) + schwebend(132, "plus")
    + '<div class="blatt" style="top:420px"><div class="griff"><i></i></div>' + kopf(art="Niederschlag 4 Wochen")
    + '<div class="inhalt">' + seg("Ebene")
    + '<div><div class="h2">Ebene</div><div class="feld">Niederschlag der letzten 4 Wochen</div></div>'
    + '<div>' + rampe("0 mm", "je Woche, 5-km-Raster, DWD HYRAS", "152 mm") + '</div>'
    + '</div></div>' + nav("karte") + '</div>')

# ---------- 4 Kombination
def faktor_zeile(name, unter, bedingung, an=True):
    box = f'<i style="width:20px;height:20px;border:1px solid {T["strong"]};border-radius:4px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;{"background:" + T["primary"] + ";border-color:" + T["primary"] if an else ""}">{IC["haken"].replace("<svg", "<svg style=\"width:14px;height:14px;stroke:#fff;fill:none;stroke-width:2.5\"") if an else ""}</i>'
    return (f'<div style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid {T["border"]}">{box}'
            f'<div class="stapel" style="gap:2px"><span style="font-size:15px;font-weight:600">{name}</span><span class="unter">{unter}</span></div>'
            f'<span class="feld" style="height:36px;padding:0 12px;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap">{bedingung}</span></div>')

artboard("Kombination",
    '<div class="tel">' + karte(470, art="schnitt") + schwebend(12, "ebenen", True) + schwebend(72, "ort", True) + schwebend(132, "plus")
    + '<div class="blatt" style="top:300px"><div class="griff"><i></i></div>' + kopf(art="Kombination", link=False)
    + '<div class="inhalt" style="gap:16px">' + seg("Kombination")
    + '<div class="seg" style="border-radius:10px"><div class="on" style="border-radius:6px">Schnittmenge</div><div style="border-radius:6px">Abgestuft</div></div>'
    + '<div class="unter" style="margin-top:-8px">Grün markiert Flächen, auf denen alle aktiven Bedingungen erfüllt sind. Wochenbezogene Faktoren beziehen sich auf KW 40 · 2025.</div>'
    + '<div>' + faktor_zeile("Niederschlag", "Summe KW 37 bis 40", "≥ 80 mm")
    + faktor_zeile("Mitteltemperatur", "KW 40", "8 bis 16 °C")
    + faktor_zeile("Buche", "Anteil der Waldfläche im Umkreis 1 km", "≥ 30 %")
    + faktor_zeile("Hangneigung", "Gelände, zeitlich konstant", "≤ 15°")
    + faktor_zeile("Boden pH", "Oberboden, zeitlich konstant", "≤ 5,5", an=False) + '</div>'
    + '</div>' + fuss("Speichern", "Faktor hinzufügen") + '</div>' + nav("karte") + '</div>')

# ---------- 4b Faktor: Bedingung eines Faktors einstellen
def histogramm(w=326, h=64, lo=0.35, hi=1.0):
    import math
    balken = []
    n = 40
    for i in range(n):
        v = math.exp(-((i - 14) ** 2) / 90) + 0.35 * math.exp(-((i - 30) ** 2) / 60)
        x = i / n
        drin = lo <= x <= hi
        balken.append(f'<rect x="{x * w:.1f}" y="{h - v * (h - 4):.1f}" width="{w / n - 1.5:.1f}" height="{v * (h - 4):.1f}" fill="{T["primary"] if drin else T["border"]}" opacity="{".85" if drin else "1"}"/>')
    return f'<svg viewBox="0 0 {w} {h}" style="width:100%;height:{h}px;display:block">{"".join(balken)}</svg>'

def schieber(lo=0.35, hi=1.0):
    return (f'<div style="position:relative;height:28px"><div style="position:absolute;left:0;right:0;top:12px;height:4px;border-radius:2px;background:{T["border"]}"></div>'
            f'<div style="position:absolute;left:{lo*100:.0f}%;right:{(1-hi)*100:.0f}%;top:12px;height:4px;background:{T["primary"]}"></div>'
            f'<i style="position:absolute;left:calc({lo*100:.0f}% - 12px);top:2px;width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid {T["primary"]};box-shadow:0 1px 3px rgba(0,0,0,.2)"></i>'
            f'<i style="position:absolute;left:calc({hi*100:.0f}% - 12px);top:2px;width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid {T["primary"]};box-shadow:0 1px 3px rgba(0,0,0,.2)"></i></div>')

artboard("Faktor",
    '<div class="tel">' + karte(300, art="regen") + schwebend(12, "ebenen", True)
    + '<div class="blatt" style="top:236px"><div class="griff"><i></i></div>'
    + '<div class="kopf"><div class="kopfzeile"><b><span style="color:' + T["text"] + '">Niederschlag</span><span>·</span>Summe KW 37 bis 40</b></div></div>'
    + '<div class="inhalt" style="gap:20px">'
    + '<div class="seg"><div>unter</div><div class="on">über</div><div>zwischen</div></div>'
    + '<div><div class="h2">Niederschlag KW 37 bis 40, Verteilung über Deutschland</div>' + histogramm() + schieber() + '<div class="enden"><span>0 mm</span><span>80 mm</span><span>240 mm</span></div></div>'
    + '<div class="tz" style="padding:0;border:0"><span class="tk" style="align-self:center">Bedingung</span><span class="feld" style="height:44px;font-variant-numeric:tabular-nums">≥ 80 mm</span></div>'
    + '<div class="unter">Die Bedingung ist auf 41 % der Fläche Deutschlands erfüllt.</div>'
    + '</div>' + fuss("Übernehmen", gefahr="Faktor entfernen") + '</div>' + nav("karte") + '</div>')

# ---------- 5 Melden, Ort
artboard("MeldenOrt",
    '<div class="tel">' + karte(844, extra='<div class="kreuz"><i></i></div>') + schwebend(12, "ebenen", True) + schwebend(72, "ort", True)
    + '<div class="blatt" style="top:auto;bottom:64px"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="padding:4px 16px 16px;gap:4px"><b style="font-size:17px;font-weight:600">Fundort festlegen</b><span class="unter">Karte verschieben, bis das Fadenkreuz auf dem Fundort liegt.</span></div>'
    + fuss("Fundort übernehmen", geist="Abbrechen")
    + '</div>' + nav("funde") + '</div>')

# ---------- 6 Melden, Formular
artboard("MeldenFormular",
    '<div class="tel">' + karte(844)
    + '<div style="position:absolute;inset:0;background:rgba(0,18,10,.55)"></div>'
    + '<div class="blatt" style="top:150px;bottom:0;border-radius:18px 18px 0 0"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="gap:18px;padding-top:4px">'
    + '<div style="display:flex;align-items:baseline;justify-content:space-between"><b style="font-size:24px;letter-spacing:-.01em">Fund melden</b><span class="unter">48,5203 · 9,0511</span></div>'
    + '<div><div class="label">Art</div><div class="feld">Steinpilz</div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><div class="label">Datum</div><div class="feld">9. 9. 2026</div></div><div><div class="label">Anzahl</div><div class="feld leer">optional</div></div></div>'
    + '<div><div class="label">Notiz</div><div class="feld mehrzeilig leer">optional</div></div>'
    + '<div><div class="label">Fotos</div><div style="display:flex;gap:8px"><div style="width:72px;height:72px;border-radius:8px;background:linear-gradient(135deg,#8a6b3e,#c9a36a)"></div><div style="width:72px;height:72px;border-radius:8px;border:1px dashed ' + T["strong"] + ';display:flex;align-items:center;justify-content:center;color:' + T["muted"] + '">' + IC["plus"].replace("<svg", "<svg style=\"width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2\"") + '</div></div></div>'
    + '<div><div class="label">Sichtbarkeit</div><div class="seg"><div class="on">Privat</div><div>Geteilt</div></div></div>'
    + '<div class="notiz">Ohne Verbindung wird der Fund lokal gespeichert und später übertragen.</div>'
    + '</div>' + fuss("Speichern", geist="Abbrechen") + '</div></div>')

# ---------- 7 Arten
def artkarte(name, latein, tags, spitze):
    """Eine Zeile der Artenliste: festes Raster, Kurve rechts, Tags unten."""
    aktiv = "aktiv" in tags
    tags = [x for x in tags if x != "aktiv"]
    klasse = lambda s: " w" if s == "geschützt" else (" p" if s == "Vorhersage" else (" i" if s == "Saison" else ""))
    t = (f'<span class="badge" style="background:{T["primary"]};color:#fff">aktiv</span>' if aktiv else "") + "".join(f'<span class="badge{klasse(s)}">{s}</span>' for s in tags)
    return (f'<div class="artzeile{" aktiv" if aktiv else ""}">'
            f'<span class="titel" style="font-size:17px;line-height:1.3">{name}</span>'
            f'{funke(spitze=spitze)}'
            f'<span class="unter" style="font-style:italic;line-height:1.3">{latein}</span>'
            f'<div class="tags">{t}</div></div>')

artboard("Arten",
    '<div class="tel"><div class="seite"><div class="kopfleiste"><b>Arten</b></div><div class="scroll">'
    + f'<div class="feld leer" style="gap:10px">{IC["suche"].replace("<svg", "<svg style=\"width:18px;height:18px;stroke:#666c67;fill:none;stroke-width:2\"")}Art suchen</div>'
    + '<div class="chips"><div class="chip on">alle</div><div class="chip">mit Vorhersage</div><div class="chip">Röhrlinge</div><div class="chip">Herbst</div></div>'
    + '<div class="card artliste">'
    + artkarte("Steinpilz", "Boletus edulis", ["aktiv", "Vorhersage", "geschützt"], 40)
    + artkarte("Maronenröhrling", "Imleria badia", ["Vorhersage", "Fichte"], 41)
    + artkarte("Pfifferling", "Cantharellus cibarius", ["Vorhersage", "geschützt"], 38)
    + artkarte("Semmelstoppelpilz", "Hydnum repandum", ["Saison", "Buche"], 42)
    + artkarte("Speisemorchel", "Morchella esculenta", ["Profil", "Frühling"], 17)
    + '</div>'
    + '</div></div>' + nav("arten") + '</div>')

# ---------- 8 Art
TABELLE = '<div class="tz"><span class="tk">Hut</span><span class="tw">6 bis 25 cm, hell- bis dunkelbraun, jung halbkugelig, später polsterförmig. Rand oft heller.</span></div><div class="tz"><span class="tk">Röhren</span><span class="tw">Jung weiß, später gelb bis olivgrün. Fein, am Stiel ausgebuchtet.</span></div><div class="tz"><span class="tk">Stiel</span><span class="tw">Dick, bauchig, hellbraun mit feinem weißem Netz im oberen Teil.</span></div><div class="tz"><span class="tk">Fleisch</span><span class="tw">Weiß, fest, verfärbt nicht.</span></div><div class="tz"><span class="tk">Geruch</span><span class="tw">Angenehm pilzig.</span></div><div class="tz"><span class="tk">Geschmack</span><span class="tw">Mild, nussig.</span></div><div class="tz"><span class="tk">Sporenpulver</span><span class="tw">Olivbraun.</span></div><div class="tz"><span class="tk">Vorkommen</span><span class="tw">Nadel- und Laubwald, meist bei Fichte und Buche. Saure Böden.</span></div><div class="tz"><span class="tk">Zeit</span><span class="tw">Juli bis November, Spitze im Oktober.</span></div><div class="tz"><span class="tk">Speisewert</span><span class="tw"><span class="badge s">Speisepilz</span></span></div><div class="tz"><span class="tk">Schutz</span><span class="tw">Besonders geschützt nach BArtSchV. Entnahme nur in geringen Mengen für den Eigenbedarf.</span></div>'
VERWECHSLUNG = '<div class="tz"><span class="tk">Gallenröhrling</span><span class="tw">Röhren rosa, Netz dunkel, sehr bitter. Ungenießbar.</span></div><div class="tz"><span class="tk">Sommersteinpilz</span><span class="tw">Heller, feiner genetzt, ab Juni. Essbar.</span></div>'
artboard("Art",
    '<div class="tel"><div class="seite"><div class="kopfleiste"><span class="zurueck">' + IC["zurueck"] + '</span><b>Steinpilz</b></div><div class="scroll" style="gap:20px">'
    + '<div class="stapel" style="gap:10px;margin-top:-4px"><span class="unter" style="font-style:italic;font-size:15px">Boletus edulis · Röhrling</span>'
    + '<div style="display:flex;gap:8px"><span class="badge p">Vorhersage</span><span class="badge w">geschützt</span></div></div>'
    + '<div><div class="h2">Saison</div>' + funke(True, 40, achse="32 %") + '<div class="enden"><span>Jan</span><span>Apr</span><span>Jul</span><span>Okt</span><span>Dez</span></div>' + kurvenlegende() + '</div>'
    + '<div><div class="h2">Merkmale</div><div class="card tabelle">' + TABELLE + '</div></div>'
    + '<div><div class="h2">Verwechslung</div><div class="card tabelle">' + VERWECHSLUNG + '</div></div>'
    + '<div class="notiz">Weiterführend: 123pilzsuche.de, Wikipedia.</div>'
    + '</div>' + fuss("Auf der Karte anzeigen", icon="karte") + '</div>' + nav("arten") + '</div>')

# ---------- 9 Funde
def fundzeile(art, meta, notiz="", badge=""):
    b = f'<span class="badge {badge[0]}">{badge[1]}</span>' if badge else ""
    n = f'<span class="unter" style="color:{T["text"]}">{notiz}</span>' if notiz else ""
    return f'<div class="zeile" style="align-items:flex-start"><span class="fund" style="position:static;flex:0 0 auto;margin-top:5px"></span><div class="stapel"><span class="titel">{art}</span><span class="unter">{meta}</span>{n}</div>{b}</div>'

artboard("Funde",
    '<div class="tel"><div class="seite"><div class="kopfleiste"><b>Einträge</b><span class="knopf primaer" style="margin-left:auto;height:40px;padding:0 16px">' + IC["plus"] + 'Eintragen</span></div><div class="scroll">'
    + '<div class="seg"><div class="on">Funde</div><div>Marker</div><div>Zonen</div></div>'
    + '<div class="chips"><div class="chip on">alle</div><div class="chip">Steinpilz</div><div class="chip">Pfifferling</div><div class="chip">nur meine</div></div>'
    + '<div class="liste">'
    + fundzeile("Pfifferling", "Heute · 2 Stück · Frederik", "unter Fichten am Hang", ("w", "Übertragung ausstehend"))
    + fundzeile("Steinpilz", "6. Sept. · 3 Stück · Frederik", "unter Fichten")
    + fundzeile("Steinpilz", "6. Sept. · Testerin", "Wegrand, Mischwald")
    + fundzeile("Parasol", "4. Sept. · 5 Stück · Jonas", "Wiese am Waldrand, viele junge")
    + fundzeile("Flaschenbovist", "1. Sept. · Jonas")
    + '</div></div></div>' + nav("funde") + '</div>')

# ---------- 10 Mehr
def einstellung(titel, wert):
    return f'<div class="zeile" style="padding:14px 0;border-bottom:1px solid {T["border"]}"><div class="stapel"><span style="font-size:16px">{titel}</span></div><span class="unter">{wert}</span></div>'

artboard("Mehr",
    '<div class="tel"><div class="seite"><div class="kopfleiste"><span class="zurueck">' + IC["zurueck"] + '</span><b>Konto</b></div><div class="scroll" style="gap:16px">'
    + '<div><div class="h2" style="margin-bottom:4px">Konto</div><div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:' + T["psub"] + ';color:' + T["primary"] + ';display:flex;align-items:center;justify-content:center;font-weight:600">F</div><div class="stapel"><span class="titel" style="font-size:15px">Frederik</span><span class="unter">frederik@beimgraben.net · sso.beimgraben.net</span></div><span class="knopf sekundaer" style="height:32px;padding:0 10px">Abmelden</span></div></div>'
    + '<div><div class="h2" style="margin-bottom:4px">Darstellung</div><div class="seg"><div>Hell</div><div>Dunkel</div><div class="on">System</div></div></div>'
    + '<div><div class="h2" style="margin-bottom:4px">Offline</div>' + einstellung("Offline-Gebiete", "84 MB") + einstellung("Ausstehende Übertragungen", "1") + '</div>'
    + '<div><div class="h2" style="margin-bottom:4px">Über</div>' + einstellung("Methode", "") + einstellung("Quellen und Lizenzen", "") + einstellung("Version", "2026-09-09") + '</div>'
    + '</div></div>' + nav("karte") + '</div>')

# ---------- 11 Desktop
artboard("Desktop",
    '<div class="desk">'
    + f'<div style="grid-column:1;grid-row:1;border-right:1px solid {T["border"]};border-bottom:1px solid {T["border"]};background:{T["surface"]};display:flex;padding:10px 12px 0;gap:4px">'
    + "".join(f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0 10px;font-size:12px;font-weight:600;color:{T["primary"] if k == "karte" else T["muted"]};border-bottom:2px solid {T["accent"] if k == "karte" else "transparent"}">{IC[k].replace("<svg", "<svg style=\"width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8\"")}{t}</div>' for k, t in (("karte", "Karte"), ("arten", "Arten"), ("funde", "Einträge")))
    + '</div>'
    + f'<div style="grid-column:1;grid-row:2;border-right:1px solid {T["border"]};background:{T["surface"]};display:flex;flex-direction:column;padding-top:12px">' + kopf()
    + '<div class="inhalt">' + seg("Vorhersage")
    + '<div>' + rampe("0 %", "Fundwahrscheinlichkeit je Begehung", "50 %") + '</div>'
    + '</div></div>'
    + '<div style="grid-column:2;grid-row:1/3;position:relative">' + karte(900) + schwebend(16, "ebenen", True) + schwebend(76, "ort", True) + '<div class="schwebe" style="top:auto;bottom:24px;right:24px;width:56px;height:56px">' + IC["plus"] + '</div></div>'
    + '</div>', 1440, 900)

# ---------- 12 Bausteine
artboard("Bausteine",
    '<div style="width:900px;min-height:700px;padding:24px;background:' + T["bg"] + ';display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;position:relative">'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">BottomNav · 64 px, aktiv Primär</div><div style="position:relative;height:64px">' + nav("karte") + '</div></div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">Blattkopf mit Timeline · Raste „Kopf“ 112 px</div><div class="griff"><i></i></div>' + kopf() + '</div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">ChipGroup · Höhe 36, Pille, Rand strong</div>' + chips() + '</div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">Segmented · Rolle tablist, Radius 12/8</div>' + seg("Ebene") + '</div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">Timeline-Knopf · 44 × 48, Balken Accent-400</div><div class="leiste">' + zeitleiste(aktiv=40, start=38, prognose_ab=41, jahr_bei=41, werte={38: 70, 39: 88, 40: 100, 41: 76, 42: 40, 43: 20, 44: 8, 45: 4}) + '</div><div class="notiz">Balken = Mittel der Vorhersage über Deutschland in der Woche, relativ zum Höchstwert der Art · gestrichelt = Prognose · Jahresmarke oben</div></div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">ListRow und Badge</div><div class="liste">' + fundzeile("Pfifferling", "Heute · 2 Stück · Frederik", "", ("w", "Übertragung ausstehend")) + fundzeile("Steinpilz", "6. Sept. · Frederik", "", ("s", "gemeldet")) + '</div><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge">neutral</span><span class="badge p">primär</span><span class="badge w">geschützt</span><span class="badge i">Prognose</span><span class="badge s">gespeichert</span></div></div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">Buttons aus dem Kit · 36 und 44 px</div><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="knopf primaer">Speichern</span><span class="knopf sekundaer">Abbrechen</span><span class="knopf geist">Mehr</span><span class="knopf primaer gross">' + IC["plus"] + 'Melden</span></div></div>'
    + '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><div class="h2">Schwebende Knöpfe · 48 px, Radius 14</div><div style="display:flex;gap:10px"><span class="schwebe hell" style="position:static">' + IC["ebenen"] + '</span><span class="schwebe hell" style="position:static">' + IC["ort"] + '</span><span class="schwebe" style="position:static">' + IC["plus"] + '</span></div><div class="notiz">Hintergrund, Standort, Melden. Rechts oben, außerhalb des Blatts.</div></div>'
    + '</div>', 900, 700)

# ---------- Aktionen: der Plus-Knopf oeffnet drei Eintraege
def aktion(icon, text, top):
    return (f'<div style="position:absolute;right:12px;top:{top}px;display:flex;align-items:center;gap:10px">'
            f'<span style="padding:6px 12px;font-size:14px;font-weight:600;color:#fff">{text}</span>'
            f'<span class="schwebe hell" style="position:static;width:44px;height:44px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.25)">{IC[icon]}</span></div>')
def aktionsreihe(icon, titel, unter, letzte=False):
    rand = "" if letzte else "border-bottom:1px solid " + T["border"] + ";"
    svg = IC[icon].replace("<svg", '<svg style="width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"')
    return ('<div style="display:flex;align-items:center;gap:14px;padding:14px 0;' + rand + '">'
            '<span style="width:44px;height:44px;border-radius:12px;background:' + T["psub"] + ';color:' + T["primary"] + ';display:flex;align-items:center;justify-content:center;flex:0 0 auto">' + svg + '</span>'
            '<div class="stapel" style="gap:2px"><span style="font-size:16px;font-weight:600">' + titel + '</span><span class="unter">' + unter + '</span></div></div>')

artboard("KarteAktionen",
    '<div class="tel">' + karte(844) + schwebend(12, "ebenen", True) + schwebend(72, "ort", True) + schwebend(132, "plus")
    + '<div style="position:absolute;inset:0;background:rgba(0,18,10,.45)"></div>'
    + '<div class="blatt" style="top:auto;bottom:64px"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="padding:4px 16px 8px;gap:8px"><b style="font-size:17px;font-weight:600">Eintragen</b><div>'
    + aktionsreihe("funde", "Fund melden", "Art, Ort, Datum, Fotos") + aktionsreihe("ort", "Marker setzen", "Ort mit Name und Notiz merken") + aktionsreihe("zone", "Zone zeichnen", "Fläche mit eigener Vorhersage anlegen", True)
    + '</div></div>' + fuss(geist="Abbrechen") + '</div>' + nav("karte") + '</div>')

# ---------- Zone zeichnen
POLY = '<svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 390 680"><polygon points="120,300 250,250 300,340 195,258" fill="rgba(0,66,37,.18)" stroke="#004225" stroke-width="2" stroke-dasharray="6 4"/><circle cx="120" cy="300" r="6" fill="#fff" stroke="#004225" stroke-width="2"/><circle cx="250" cy="250" r="6" fill="#fff" stroke="#004225" stroke-width="2"/><circle cx="300" cy="340" r="6" fill="#fff" stroke="#004225" stroke-width="2"/></svg>'
artboard("ZoneZeichnen",
    '<div class="tel">' + karte(844, extra=POLY + '<div class="kreuz" style="top:258px;left:195px"><i></i></div>') + schwebend(12, "ebenen", True) + schwebend(72, "ort", True)
    + '<div class="blatt" style="top:auto;bottom:64px"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="padding:4px 16px 16px;gap:4px"><b style="font-size:17px;font-weight:600">Zone zeichnen</b><span class="unter">4 Eckpunkte · 42 ha. Fadenkreuz auf den nächsten Eckpunkt setzen.</span></div>'
    + fuss("Eckpunkt setzen", "Zone abschließen", zweite="Letzten Punkt entfernen")
    + '</div>' + nav("funde") + '</div>')

# ---------- Zone: Blatt mit Wochenwert
FARBEN = ["#004225", "#8c6820", "#185468", "#8c1c16", "#876010", "#3a3f3b"]
artboard("Zone",
    '<div class="tel">' + karte(844, extra=POLY.replace("stroke-dasharray=\"6 4\"", ""))
    + '<div class="blatt" style="top:120px;bottom:0"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="padding-top:4px">'
    + '<div class="stapel" style="gap:4px"><b style="font-size:24px;letter-spacing:-.01em;line-height:1.2">Schönbuch Nord</b><span class="unter">Zone · 42 ha · privat</span></div>'
    + '<div class="card tabelle">'
    + '<div class="tz" style="grid-template-columns:minmax(0,1fr) auto;align-items:center"><span class="stapel" style="gap:2px"><span class="tk" style="color:' + T["text"] + '">Vorhersage Steinpilz, KW 40</span><span class="notiz">Flächenmittel, je Begehung</span></span><b style="font-size:18px;font-variant-numeric:tabular-nums">18 %</b></div>'
    + '<div class="tz" style="grid-template-columns:minmax(0,1fr) auto;align-items:center"><span class="stapel" style="gap:2px"><span class="tk" style="color:' + T["text"] + '">Eigene Funde in der Zone</span><span class="notiz">alle Arten, alle Jahre</span></span><b style="font-size:18px;font-variant-numeric:tabular-nums">2</b></div>'
    + '</div>'
    + '<div><div class="label">Farbe</div><div style="display:flex;gap:12px">' + "".join(f'<span style="width:36px;height:36px;border-radius:10px;background:{c};{"outline:2px solid " + T["primary"] + ";outline-offset:3px" if i == 0 else ""}"></span>' for i, c in enumerate(FARBEN)) + '</div></div>'
    + '<div><div class="label">Sichtbarkeit</div><div class="seg"><div class="on">Privat</div><div>Geteilt</div></div></div>'
    + '<div><div class="label">Notiz</div><div class="feld mehrzeilig" style="min-height:72px">Nordhang, alte Fichten, ab Mitte September.</div></div>'
    + '</div>' + fuss("Speichern", "Eckpunkte bearbeiten", "Zone löschen") + '</div></div>')

# ---------- Anmelden: erst beim Speichern
artboard("Anmelden",
    '<div class="tel">' + karte(844) + '<div style="position:absolute;inset:0;background:rgba(0,18,10,.55)"></div>'
    + '<div class="blatt" style="top:440px;bottom:0"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="gap:16px;padding-top:4px">'
    + '<b style="font-size:24px;letter-spacing:-.01em">Zum Speichern anmelden</b>'
    + '<div class="absatz">Funde, Marker und Zonen werden in deinem Konto bei beimgraben.net gespeichert. Die Karte ist auch ohne Anmeldung nutzbar.</div>'
    + '</div>' + fuss("Anmelden mit beimgraben.net", geist="Später anmelden, Eintrag lokal behalten") + '</div></div>')

# ---------- Ebenen-Knopf: was auf der Karte liegt
artboard("KarteEbenen",
    '<div class="tel">' + karte(660) + '<div style="position:absolute;inset:0;background:rgba(0,18,10,.25)"></div>'
    + f'<div class="card" style="position:absolute;right:12px;top:68px;width:300px;padding:18px;display:flex;flex-direction:column;gap:12px">'
    + '<div><div class="h2">Hintergrund</div><div class="seg"><div class="on">Karte</div><div>Hell</div><div>Topo</div><div>Satellit</div></div></div>'
    + '<div><div class="h2">Auf der Karte</div><div style="display:flex;flex-direction:column;gap:8px">'
    + schalter("Geteilte Funde", True, "12") + schalter("Meine Marker", True, "5") + schalter("Zonen", True, "2") + '</div></div>'
    + '<div><div class="h2">Deckkraft</div>'
    + '<div style="height:4px;border-radius:2px;background:' + T["border"] + ';position:relative;margin:12px 0 8px"><i style="position:absolute;left:0;top:0;height:100%;width:80%;background:' + T["primary"] + ';border-radius:2px"></i><i style="position:absolute;left:80%;top:-7px;width:18px;height:18px;border-radius:50%;background:' + T["primary"] + ';transform:translateX(-50%)"></i></div></div>'
    + '</div>' + schwebend(12, "ebenen", True).replace("schwebe hell", "schwebe")
    + '<div class="blatt" style="top:620px"><div class="griff"><i></i></div>' + kopf() + '</div>'
    + nav("karte") + '</div>')

# ---------- Fund: Detail-Screen als Blatt ueber der Karte
artboard("Fund",
    '<div class="tel">' + karte(844) + '<div class="fund" style="left:188px;top:250px;width:18px;height:18px"></div>'
    + '<div class="blatt" style="top:250px;bottom:0"><div class="griff"><i></i></div>'
    + '<div class="inhalt" style="gap:16px;padding-top:4px">'
    + '<div><div style="display:flex;align-items:baseline;justify-content:space-between"><b style="font-size:24px;letter-spacing:-.01em">Steinpilz</b><span class="badge s">geteilt</span></div>'
    + '<div class="unter" style="margin-top:4px">6. September 2026 · 3 Stück · Frederik</div></div>'
    + '<div style="display:flex;gap:8px"><div style="flex:1;height:120px;border-radius:12px;background:linear-gradient(135deg,#8a6b3e,#c9a36a)"></div><div style="flex:1;height:120px;border-radius:12px;background:linear-gradient(135deg,#5d6f4a,#a4b57f)"></div></div>'
    + '<div class="absatz">Unter Fichten am Weg, drei junge, Kappen noch geschlossen.</div>'
    + '<div class="card" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px"><div class="stapel" style="gap:2px"><span style="font-size:15px;font-weight:600">Vorhersage an diesem Ort</span><span class="unter">Steinpilz, KW 40 · 2025, je Begehung</span></div><b style="font-size:20px;font-variant-numeric:tabular-nums">21 %</b></div>'
    + '</div>' + fuss("Auf der Karte anzeigen", "Bearbeiten", "Löschen", icon="karte") + '</div></div>')

canvas = {
    "pages": [{"id": "screens", "name": "Screens"}, {"id": "bausteine", "name": "Bausteine"}],
    "artboards": [
        {"file": "Main.dc.html", "title": "Karte · Blatt halb", "x": 0, "y": 0, "w": 390, "h": 844},
        {"file": "KarteEingeklappt.dc.html", "title": "Karte · eingeklappt", "x": 480, "y": 0, "w": 390, "h": 844},
        {"file": "KarteEbenen.dc.html", "title": "Karte · Ebenen-Knopf", "x": 960, "y": 0, "w": 390, "h": 844},
        {"file": "Ebene.dc.html", "title": "Darstellung · Ebene", "x": 1440, "y": 0, "w": 390, "h": 844},
        {"file": "Kombination.dc.html", "title": "Darstellung · Kombination", "x": 1920, "y": 0, "w": 390, "h": 844},
        {"file": "Faktor.dc.html", "title": "Darstellung · Faktor", "x": 2400, "y": 0, "w": 390, "h": 844},
        {"file": "KarteAktionen.dc.html", "title": "Eintragen · Plus-Knopf", "x": 0, "y": 980, "w": 390, "h": 844},
        {"file": "MeldenOrt.dc.html", "title": "Eintragen · Ort", "x": 480, "y": 980, "w": 390, "h": 844},
        {"file": "MeldenFormular.dc.html", "title": "Eintragen · Fund beschreiben", "x": 960, "y": 980, "w": 390, "h": 844},
        {"file": "ZoneZeichnen.dc.html", "title": "Eintragen · Zone zeichnen", "x": 1440, "y": 980, "w": 390, "h": 844},
        {"file": "Anmelden.dc.html", "title": "Eintragen · Anmelden beim Speichern", "x": 1920, "y": 980, "w": 390, "h": 844},
        {"file": "Arten.dc.html", "title": "Reiter · Arten", "x": 0, "y": 1960, "w": 390, "h": 844},
        {"file": "Art.dc.html", "title": "Objekt · Art", "x": 480, "y": 1960, "w": 390, "h": 844},
        {"file": "Funde.dc.html", "title": "Reiter · Einträge", "x": 960, "y": 1960, "w": 390, "h": 844},
        {"file": "Fund.dc.html", "title": "Objekt · Fund", "x": 1440, "y": 1960, "w": 390, "h": 844},
        {"file": "Zone.dc.html", "title": "Objekt · Zone", "x": 1920, "y": 1960, "w": 390, "h": 844},
        {"file": "Mehr.dc.html", "title": "Konto", "x": 2400, "y": 1960, "w": 390, "h": 844},
        {"file": "Desktop.dc.html", "title": "Rechner · 1440", "x": 0, "y": 2940, "w": 1440, "h": 900},
        {"file": "Bausteine.dc.html", "title": "Bausteine", "x": 0, "y": 0, "w": 900, "h": 720, "page": "bausteine"},
    ],
    "annotations": [
        {"id": "hinweis-karte", "x": 0, "y": -130, "w": 380, "text": "Kartenbild ist ein Platzhalter: OSM-Kacheln laden im Canvas nicht. Farbfeld = Vorhersage, blau = Regen-Ebene.", "page": "screens"},
        {"id": "hinweis-tokens", "x": 960, "y": -130, "w": 380, "text": "Alle Werte aus @stupa-makers/ui-kit: British Racing Green #004225, Archivo, 4-px-Raster, Radien 4/8/12/18, Controls 36 px.", "page": "screens"},
        {"id": "hinweis-bausteine", "x": 0, "y": -110, "w": 380, "text": "Sechs mobile Bausteine, die dem Kit fehlen. Vorschlag: Eintragspunkt @stupa-makers/ui-kit/mobile.", "page": "bausteine"},
    ],
    "launch": {"view": "canvas", "page": "screens"},
}
(OUT / "canvas.json").write_text(json.dumps(canvas, ensure_ascii=False, indent=1))
print("artboards:", sorted(p.name for p in OUT.glob("*.dc.html")))
