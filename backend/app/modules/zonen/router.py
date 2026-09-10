"""Endpunkte der Zonen. Jede Route braucht ein Konto, eine fremde Zone ist 404."""

from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Nutzer, aktueller_nutzer
from app.core.db import sitzung
from app.core.errors import NichtGefunden
from app.core.settings import Einstellungen, einstellungen
from app.models import Fund, Zone
from app.modules.arten.katalog import Katalog
from app.modules.arten.router import aktueller_katalog
from app.modules.zonen.kacheln import (
    Manifest,
    flaechenmittel,
    manifest_lesen,
    woche_suchen,
)
from app.modules.zonen.schemas import (
    ZoneAenderung,
    ZoneAus,
    ZoneEingabe,
    ZonenWert,
    zone_aus,
)
from app.shared.geometrie import flaeche_ha, punkt_in_polygon
from app.shared.objekte import eigenes, uebernehmen
from app.shared.paging import Ausschnitt, Seite, seite_laden
from app.shared.schemas import GeoPolygon, Woche

router = APIRouter(prefix="/zonen", tags=["zonen"])

Angemeldet = Annotated[Nutzer, Depends(aktueller_nutzer)]
Sitzung = Annotated[AsyncSession, Depends(sitzung)]
Werte = Annotated[Einstellungen, Depends(einstellungen)]
Gewaehlt = Annotated[Katalog, Depends(aktueller_katalog)]


def flaeche_setzen(zone: Zone, polygon: GeoPolygon) -> None:
    """Legt Polygon und Flaeche gemeinsam ab. Die Flaeche rechnet der Dienst."""
    zone.polygon = polygon.model_dump_json()
    zone.flaeche_ha = round(flaeche_ha(polygon.ring), 2)


@router.get("", summary="Eigene Zonen")
async def zonen_liste(
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    ausschnitt: Ausschnitt,
) -> Seite[ZoneAus]:
    """Liefert die eigenen Zonen, zuletzt geaenderte zuerst."""
    auswahl = select(Zone).where(Zone.besitzer_sub == nutzer.sub).order_by(Zone.geaendert_am.desc())
    return await seite_laden(sitzung_, auswahl, ausschnitt, zone_aus)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Zone zeichnen")
async def zone_anlegen(
    eingabe: ZoneEingabe,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
) -> ZoneAus:
    """Legt eine Zone an. Der Besitzer kommt aus dem Token."""
    zone = Zone(besitzer_sub=nutzer.sub, **eingabe.model_dump(exclude={"polygon"}))
    flaeche_setzen(zone, eingabe.polygon)
    sitzung_.add(zone)
    await sitzung_.commit()
    await sitzung_.refresh(zone)
    return zone_aus(zone)


@router.get("/{zone_id}", summary="Eine eigene Zone")
async def zone_lesen(zone_id: str, nutzer: Angemeldet, sitzung_: Sitzung) -> ZoneAus:
    """Liefert eine eigene Zone."""
    return zone_aus(await eigenes(sitzung_, Zone, zone_id, nutzer))


@router.patch("/{zone_id}", summary="Zone aendern")
async def zone_aendern(
    zone_id: str,
    aenderung: ZoneAenderung,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
) -> ZoneAus:
    """Aendert die Felder, die in der Anfrage standen. Neue Eckpunkte, neue Flaeche."""
    zone = await eigenes(sitzung_, Zone, zone_id, nutzer)
    uebernehmen(zone, aenderung, ausser={"polygon"})
    if aenderung.polygon is not None:
        flaeche_setzen(zone, aenderung.polygon)
    await sitzung_.commit()
    await sitzung_.refresh(zone)
    return zone_aus(zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Zone loeschen")
async def zone_loeschen(zone_id: str, nutzer: Angemeldet, sitzung_: Sitzung) -> Response:
    """Loescht eine eigene Zone."""
    zone = await eigenes(sitzung_, Zone, zone_id, nutzer)
    await sitzung_.delete(zone)
    await sitzung_.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@dataclass(frozen=True, slots=True)
class Kartenwoche:
    """Die Wertkarte einer Art in einer Woche, aus dem Manifest aufgeloest."""

    art: str
    woche: Woche
    manifest: Manifest
    kachelpfad: str
    maps: Path


def kartenwoche(
    werte: Werte,
    gewaehlt: Gewaehlt,
    art: Annotated[str, Query(description="Slug der Art aus dem Katalog")],
    jahr: Annotated[int, Query(ge=2015, le=2100)],
    woche: Annotated[int, Query(ge=1, le=53)],
) -> Kartenwoche:
    """Dependency: sucht Manifest und Woche der gefragten Art unter PILZE_MAPS."""
    profil = gewaehlt.art(art)
    if profil.karten_slug is None:
        raise NichtGefunden(f"Fuer {art} gibt es keine Vorhersagekarte.")
    manifest = manifest_lesen(werte.maps, profil.karten_slug)
    eintrag = woche_suchen(manifest, jahr, woche)
    return Kartenwoche(
        art=art,
        woche=Woche(jahr=jahr, woche=woche),
        manifest=manifest,
        kachelpfad=eintrag.tiles,
        maps=werte.maps,
    )


@router.get("/{zone_id}/wert", summary="Vorhersage in der Zone")
async def zone_wert(
    zone_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    karte: Annotated[Kartenwoche, Depends(kartenwoche)],
) -> ZonenWert:
    """Mittelt die Vorhersage ueber die Flaeche und zaehlt die eigenen Funde darin.

    Der Mittelwert gilt fuer genau diese Art und diese Woche, in Prozent je
    Begehung. Die Funde zaehlen alle Arten und alle Jahre.
    """
    zone = await eigenes(sitzung_, Zone, zone_id, nutzer)
    ring = GeoPolygon.model_validate_json(zone.polygon).ring
    mittel, punkte = flaechenmittel(karte.maps, karte.manifest, karte.kachelpfad, ring)

    funde = await sitzung_.scalars(select(Fund).where(Fund.besitzer_sub == nutzer.sub))
    eigene = sum(1 for fund in funde if punkt_in_polygon((fund.lon, fund.lat), ring))

    return ZonenWert(
        art=karte.art,
        woche=karte.woche,
        flaechenmittel=round(mittel, 1),
        punkte=punkte,
        eigene_funde=eigene,
    )
