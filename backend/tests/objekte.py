"""Vorrichtungen fuer Funde, Marker und Zonen.

Der Katalog hier haelt drei erfundene Arten: zwei geschuetzte mit Karte
(Steinpilz, Pfifferling) und eine ungeschuetzte ohne Karte (Parasol). Damit
laesst sich die Rundung geschuetzter Arten gegen ihr Gegenstueck pruefen.
"""

import io
import json
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from PIL import Image

from app.core.settings import einstellungen
from app.modules.arten.katalog import Katalog
from app.modules.arten.schemas import (
    WOCHEN,
    Artenzaehlung,
    Baumart,
    Essbarkeit,
    Gruppe,
    Jahreszeit,
    MerkmalSchluessel,
    Profil,
    Saisontabelle,
    Verwechslung,
    Verweis,
)
from app.modules.zonen.kacheln import KACHEL

# Ein Rechteck im Schoenbuch, gut zwei Kilometer breit. Es liegt sicher in
# Deutschland und laesst sich im Kopf nachrechnen.
ZONE_RING: list[list[float]] = [
    [9.05, 48.52],
    [9.08, 48.52],
    [9.08, 48.54],
    [9.05, 48.54],
]

FUNDORT = {"lat": 48.5203, "lon": 9.0511}


def polygon(ring: list[list[float]] | None = None) -> dict[str, Any]:
    """Ein GeoJSON-Polygon, so wie es das Zeichenwerkzeug schickt."""
    return {"type": "Polygon", "coordinates": [ring if ring is not None else ZONE_RING]}


def _profil(name: str, lateinisch: str, *, geschuetzt: bool) -> Profil:
    return Profil(
        name=name,
        lateinisch=lateinisch,
        gruppe=Gruppe.ROEHRLING,
        speisewert=Essbarkeit.SPEISEPILZ,
        geschuetzt=geschuetzt,
        jahreszeiten=[Jahreszeit.HERBST],
        baeume=[Baumart.FICHTE],
        merkmale={
            MerkmalSchluessel.FLEISCH: "Weiss.",
            MerkmalSchluessel.GERUCH: "Pilzig.",
            MerkmalSchluessel.SPORENPULVER: "Olivbraun.",
            MerkmalSchluessel.VORKOMMEN: "Im Wald.",
            MerkmalSchluessel.ZEIT: "Herbst.",
        },
        verwechslungen=[
            Verwechslung(name="Gallenroehrling", merkmal="Bitter.", essbar=Essbarkeit.UNGENIESSBAR)
        ],
        links=[Verweis(titel="Wikipedia", url="https://de.wikipedia.org/wiki/Pilze")],
    )


def katalog_der_tests() -> Katalog:
    """Der Katalog der Tests: Steinpilz und Pfifferling geschuetzt, Parasol nicht."""
    zaehlung = Artenzaehlung(
        begehungen_mit_fund=900,
        funde_je_woche=[10] * WOCHEN,
        funde_je_woche_laufendes_jahr=[5] * WOCHEN,
    )
    tabelle = Saisontabelle(
        stand_jahr=2026,
        stand_woche=36,
        von_jahr=2015,
        bis_jahr=2025,
        min_arten=2,
        begehungen_je_woche=[100] * WOCHEN,
        begehungen_je_woche_laufendes_jahr=[20] * WOCHEN,
        arten={
            "Boletus edulis": zaehlung,
            "Cantharellus cibarius": zaehlung,
            "Macrolepiota procera": zaehlung,
        },
    )
    return Katalog(
        tabelle=tabelle,
        profile={
            "steinpilz": _profil("Steinpilz", "Boletus edulis", geschuetzt=True),
            "pfifferling": _profil("Pfifferling", "Cantharellus cibarius", geschuetzt=True),
            "parasol": _profil("Parasol", "Macrolepiota procera", geschuetzt=False),
        },
        # Nur der Steinpilz hat eine Wertkarte. Der Parasol belegt den Fall
        # "Art im Katalog, aber ohne Vorhersage".
        karten={"steinpilz": "boletus_edulis"},
    )


def gestern() -> str:
    """Ein Datum, das sicher nicht in der Zukunft liegt."""
    return (datetime.now(UTC).date() - timedelta(days=1)).isoformat()


def morgen() -> str:
    """Ein Datum, das sicher in der Zukunft liegt."""
    return (datetime.now(UTC).date() + timedelta(days=1)).isoformat()


def fund_koerper(**abweichung: Any) -> dict[str, Any]:  # noqa: ANN401
    """Ein gueltiger Fund. Jedes Feld laesst sich ueberschreiben."""
    koerper: dict[str, Any] = {
        "artSlug": "steinpilz",
        "datum": gestern(),
        "anzahl": 3,
        "notiz": "Unter Fichten am Weg.",
        "sichtbarkeit": "privat",
        **FUNDORT,
    }
    koerper.update(abweichung)
    return koerper


def marker_koerper(**abweichung: Any) -> dict[str, Any]:  # noqa: ANN401
    """Ein gueltiger Marker."""
    koerper: dict[str, Any] = {
        "name": "Alter Fichtenhang",
        "farbe": "blau",
        "notiz": "Ab Mitte September.",
        "sichtbarkeit": "privat",
        **FUNDORT,
    }
    koerper.update(abweichung)
    return koerper


def zone_koerper(**abweichung: Any) -> dict[str, Any]:  # noqa: ANN401
    """Eine gueltige Zone."""
    koerper: dict[str, Any] = {
        "name": "Schoenbuch Nord",
        "polygon": polygon(),
        "farbe": "gruen",
        "notiz": "Nordhang, alte Fichten.",
        "sichtbarkeit": "privat",
    }
    koerper.update(abweichung)
    return koerper


def kombination_koerper(**abweichung: Any) -> dict[str, Any]:  # noqa: ANN401
    """Eine gueltige Kombination: das Beispiel aus dem Konzept."""
    koerper: dict[str, Any] = {
        "name": "Nasser Buchenhang",
        "regel": "schnitt",
        "faktoren": [
            {"quelle": "regen_4w", "bedingung": "ueber", "von": 80},
            {"quelle": "temperatur", "bedingung": "zwischen", "von": 8, "bis": 16},
            {"quelle": "hangneigung", "bedingung": "unter", "bis": 15, "aktiv": False},
        ],
    }
    koerper.update(abweichung)
    return koerper


def ebenen_schreiben(maps: Path, namen: list[str] | None = None) -> None:
    """Legt ein layers.json an, wie die Kette es neben die Kacheln legt."""
    ebenen = {
        name: {"label": name.capitalize(), "unit": "mm", "low": 0.0, "high": 200.0}
        for name in (namen if namen is not None else ["regen_4w", "temperatur", "hangneigung"])
    }
    maps.mkdir(parents=True, exist_ok=True)
    _ = (maps / "layers.json").write_text(
        json.dumps({"bounds": [[47.1, 4.9], [55.2, 15.2]], "layers": ebenen}),
        encoding="utf-8",
    )


def bild_mit_exif(breite: int = 2400, hoehe: int = 1200) -> bytes:
    """Ein JPEG mit Kamera- und GPS-Kopfzeilen, so wie es aus einem Telefon kommt."""
    exif = Image.Exif()
    exif[0x010F] = "TestKamera"
    exif[0x0110] = "Modell X"
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = (48.0, 31.0, 12.0)
    gps[3] = "E"
    gps[4] = (9.0, 3.0, 30.0)
    bild = Image.new("RGB", (breite, hoehe), (40, 90, 60))
    puffer = io.BytesIO()
    bild.save(puffer, format="JPEG", exif=exif)
    return puffer.getvalue()


def bild(format_: str = "PNG", breite: int = 40, hoehe: int = 30) -> bytes:
    """Ein einfaches Bild in einem beliebigen Format."""
    puffer = io.BytesIO()
    Image.new("RGB", (breite, hoehe), (10, 20, 30)).save(puffer, format=format_)
    return puffer.getvalue()


def hat_exif(rohdaten: bytes) -> bool:
    """Sagt, ob die Datei einen Exif-Abschnitt traegt."""
    return b"Exif\x00\x00" in rohdaten


def karte_schreiben(
    maps: Path,
    *,
    stufen: Mapping[tuple[int, int], int],
    kachel_x: int,
    kachel_y: int,
    zoom: int,
    top: float = 0.5,
    jahr: int = 2026,
    woche: int = 40,
) -> None:
    """Legt ein Manifest und eine Kachel an, wie die Kette sie schreibt.

    ``stufen`` setzt einzelne Punkte der Kachel auf ein Byte. Alles andere
    bleibt 0 und heisst damit: keine Daten.
    """
    pfad = f"boletus_edulis_kacheln/{jahr}W{woche:02d}"
    manifest = {
        "name": "boletus_edulis",
        "top": top,
        "weeks": [{"year": jahr, "week": woche, "tiles": pfad, "mean": 0.01, "max": 0.2}],
        "tiles": {"zooms": [zoom, zoom], "have": {str(zoom): [f"{kachel_x}/{kachel_y}"]}},
    }
    maps.mkdir(parents=True, exist_ok=True)
    _ = (maps / "boletus_edulis.json").write_text(json.dumps(manifest), encoding="utf-8")

    kachel = Image.new("L", (KACHEL, KACHEL), 0)
    for (x, y), stufe in stufen.items():
        kachel.putpixel((x, y), stufe)
    ordner = maps / pfad / str(zoom) / str(kachel_x)
    ordner.mkdir(parents=True, exist_ok=True)
    kachel.save(ordner / f"{kachel_y}.png")


def maps_ordner() -> Path:
    """Der Ordner aus PILZE_MAPS, so wie der Dienst ihn sieht."""
    return einstellungen().maps


def fotos_ordner() -> Path:
    """Der Ordner aus PILZE_FOTOS."""
    return einstellungen().fotos
