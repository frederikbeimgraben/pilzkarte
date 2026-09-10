"""Endpunkte der Funde, ihrer Fotos und der geteilten Karte.

Jede Route hier braucht ein Konto. Der Besitzer ist der ``sub`` aus dem Token.
Ein fremder Fund endet mit 404 und nicht mit 403.
"""

import shutil
from pathlib import Path
from typing import Annotated, Final

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Nutzer, aktueller_nutzer, nutzer_optional
from app.core.db import sitzung
from app.core.errors import Konflikt, MedientypFalsch, NichtGefunden, Ungueltig
from app.core.settings import Einstellungen, einstellungen
from app.models import Foto, Fund, neue_kennung
from app.modules.arten.katalog import Katalog
from app.modules.arten.router import aktueller_katalog
from app.modules.funde.schemas import (
    FotoAus,
    FundAenderung,
    FundAus,
    FundEingabe,
    GeteilterFund,
    foto_aus,
    fund_aus,
    geteilter_fund_aus,
)
from app.shared import bilder
from app.shared.geometrie import (
    KM_JE_BREITENGRAD,
    Punkt,
    Rechteck,
    auf_raster,
    im_rechteck,
    rechteck_erweitern,
    rechteck_lesen,
)
from app.shared.objekte import eigenes, uebernehmen
from app.shared.paging import Ausschnitt, Seite, seite_aus, seite_laden
from app.shared.schemas import Sichtbarkeit

router = APIRouter(prefix="/funde", tags=["funde"])

# Maschenweite fuer den Ort einer geschuetzten Art. Fuenf Kilometer nennen die
# Gegend und verraten die Stelle im Wald nicht.
RASTER_KM: Final = 5.0
# Weiter als eine halbe Masche kann das Runden einen Punkt nicht verschieben.
RASTER_RAND_GRAD: Final = RASTER_KM / KM_JE_BREITENGRAD

FOTOS_JE_FUND: Final = 3

Angemeldet = Annotated[Nutzer, Depends(aktueller_nutzer)]
# Die Karte mit geteilten Funden liest man auch ohne Konto. Ein Konto braucht
# nur, wer speichert. Ein falsches Token bleibt auch hier ein Fehler.
Vielleicht = Annotated[Nutzer | None, Depends(nutzer_optional)]
Sitzung = Annotated[AsyncSession, Depends(sitzung)]
Werte = Annotated[Einstellungen, Depends(einstellungen)]
Gewaehlt = Annotated[Katalog, Depends(aktueller_katalog)]


def art_pruefen(gewaehlt: Katalog, slug: str) -> None:
    """Weist einen Slug ab, den der Artenkatalog nicht kennt."""
    if not gewaehlt.hat(slug):
        raise Ungueltig(f"Die Art {slug} steht nicht im Katalog.")


def bbox_lesen(bbox: str | None) -> Rechteck | None:
    """Liest den bbox-Parameter, falls einer dabei ist."""
    if bbox is None:
        return None
    try:
        return rechteck_lesen(bbox)
    except ValueError as fehler:
        raise Ungueltig(str(fehler)) from fehler


def fotoordner(werte: Einstellungen, fund_id: str) -> Path:
    """Der Ordner, in dem die Fotos eines Fundes liegen."""
    return werte.fotos / fund_id


def eigene_funde(nutzer: Nutzer) -> Select[tuple[Fund]]:
    """Die eigenen Funde, neueste zuerst."""
    return (
        select(Fund)
        .where(Fund.besitzer_sub == nutzer.sub)
        .order_by(Fund.datum.desc(), Fund.erstellt_am.desc())
    )


async def lesbarer_fund(sitzung_: AsyncSession, kennung: str, nutzer: Nutzer) -> Fund:
    """Liest einen Fund, den diese Person sehen darf: den eigenen oder einen geteilten."""
    treffer = await sitzung_.get(Fund, kennung)
    if treffer is None:
        raise NichtGefunden("Diesen Fund gibt es nicht.")
    if treffer.besitzer_sub != nutzer.sub and treffer.sichtbarkeit is not Sichtbarkeit.GETEILT:
        raise NichtGefunden("Diesen Fund gibt es nicht.")
    return treffer


async def foto_zum_fund(sitzung_: AsyncSession, fund: Fund, foto_id: str) -> Foto:
    """Liest ein Foto, das an diesem Fund haengt."""
    treffer = await sitzung_.get(Foto, foto_id)
    if treffer is None or treffer.fund_id != fund.id:
        raise NichtGefunden("Dieses Foto gibt es nicht.")
    return treffer


def ort_fuer(fund: Fund, gewaehlt: Katalog, sub: str | None) -> tuple[Punkt, bool]:
    """Der Ort, der einen geteilten Fund verlassen darf, und ob er grob ist.

    Der eigene Fund bleibt immer genau. Bei einer geschuetzten Art liegt ein
    fremder Fund auf dem Raster, nie auf seinem Punkt. Ein Zugang ohne Konto hat
    keinen ``sub`` und besitzt darum keinen Fund.
    """
    genau: Punkt = (fund.lon, fund.lat)
    if fund.besitzer_sub == sub:
        return genau, False
    if gewaehlt.ist_geschuetzt(fund.art_slug):
        return auf_raster(genau, RASTER_KM), True
    return genau, False


@router.get("", summary="Eigene Funde")
async def funde_liste(
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    ausschnitt: Ausschnitt,
) -> Seite[FundAus]:
    """Liefert die eigenen Funde, neueste zuerst."""
    return await seite_laden(sitzung_, eigene_funde(nutzer), ausschnitt, fund_aus)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Fund melden")
async def fund_anlegen(
    eingabe: FundEingabe,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    gewaehlt: Gewaehlt,
) -> FundAus:
    """Legt einen Fund an. Besitzer und Anzeigename kommen aus dem Token."""
    art_pruefen(gewaehlt, eingabe.art_slug)
    fund = Fund(
        besitzer_sub=nutzer.sub,
        besitzer_name=nutzer.name,
        **eingabe.model_dump(),
    )
    sitzung_.add(fund)
    await sitzung_.commit()
    await sitzung_.refresh(fund)
    return fund_aus(fund)


@router.get("/geteilt", summary="Geteilte Funde im Ausschnitt, auch ohne Konto")
async def geteilte_funde(
    nutzer: Vielleicht,
    sitzung_: Sitzung,
    gewaehlt: Gewaehlt,
    ausschnitt: Ausschnitt,
    bbox: Annotated[str | None, Query(description="west,sueden,osten,norden in Grad")] = None,
) -> Seite[GeteilterFund]:
    """Liefert geteilte Funde. Geschuetzte Arten liegen auf einem 5-km-Raster.

    Diese Route liest auch, wer nicht angemeldet ist. Dann gehoert kein Fund dem
    Aufrufer: jeder Eintrag traegt ``eigen: false``, und jede geschuetzte Art
    liegt auf dem Raster.

    Gesucht wird in einem etwas groesseren Rechteck als gefragt, und gefiltert
    wird erst nach dem Runden. Sonst liesse sich der genaue Ort einer
    geschuetzten Art aus der Grenze des Ausschnitts zurueckrechnen.
    """
    sub = nutzer.sub if nutzer is not None else None
    rechteck = bbox_lesen(bbox)
    auswahl = (
        select(Fund)
        .where(Fund.sichtbarkeit == Sichtbarkeit.GETEILT)
        .order_by(Fund.datum.desc(), Fund.erstellt_am.desc())
    )
    if rechteck is not None:
        west, sueden, osten, norden = rechteck_erweitern(rechteck, RASTER_RAND_GRAD)
        auswahl = auswahl.where(
            Fund.lon >= west,
            Fund.lon <= osten,
            Fund.lat >= sueden,
            Fund.lat <= norden,
        )
    treffer = await sitzung_.scalars(auswahl)

    sichtbar: list[GeteilterFund] = []
    for fund in treffer:
        ort, gerundet = ort_fuer(fund, gewaehlt, sub)
        if rechteck is not None and not im_rechteck(ort, rechteck):
            continue
        sichtbar.append(
            geteilter_fund_aus(
                fund,
                ort,
                gerundet=gerundet,
                eigen=fund.besitzer_sub == sub,
            )
        )
    return seite_aus(sichtbar, ausschnitt)


@router.get("/{fund_id}", summary="Ein eigener Fund")
async def fund_lesen(fund_id: str, nutzer: Angemeldet, sitzung_: Sitzung) -> FundAus:
    """Liefert einen eigenen Fund mit genauem Ort und seinen Fotos."""
    return fund_aus(await eigenes(sitzung_, Fund, fund_id, nutzer))


@router.patch("/{fund_id}", summary="Fund aendern")
async def fund_aendern(
    fund_id: str,
    aenderung: FundAenderung,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    gewaehlt: Gewaehlt,
) -> FundAus:
    """Aendert die Felder, die in der Anfrage standen."""
    fund = await eigenes(sitzung_, Fund, fund_id, nutzer)
    if aenderung.art_slug is not None:
        art_pruefen(gewaehlt, aenderung.art_slug)
    uebernehmen(fund, aenderung)
    await sitzung_.commit()
    await sitzung_.refresh(fund)
    return fund_aus(fund)


@router.delete("/{fund_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Fund loeschen")
async def fund_loeschen(
    fund_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    werte: Werte,
) -> Response:
    """Loescht einen Fund mit seinen Fotos, in der Datenbank und auf der Platte."""
    fund = await eigenes(sitzung_, Fund, fund_id, nutzer)
    await sitzung_.delete(fund)
    await sitzung_.commit()
    shutil.rmtree(fotoordner(werte, fund_id), ignore_errors=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{fund_id}/fotos",
    status_code=status.HTTP_201_CREATED,
    summary="Foto an einen Fund haengen",
)
async def foto_anlegen(
    fund_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    werte: Werte,
    datei: Annotated[UploadFile, File(description="JPEG oder WebP")],
) -> FotoAus:
    """Nimmt ein Bild an, verkleinert es und legt es ohne EXIF als JPEG ab."""
    fund = await eigenes(sitzung_, Fund, fund_id, nutzer)
    if len(fund.fotos) >= FOTOS_JE_FUND:
        raise Konflikt(f"An einem Fund haengen hoechstens {FOTOS_JE_FUND} Fotos.")
    if datei.content_type not in bilder.MEDIENTYPEN:
        raise MedientypFalsch("Der Dienst nimmt nur JPEG und WebP an.")

    daten, breite, hoehe = bilder.verkleinern(await datei.read())
    # Die Kennung faellt hier und nicht erst beim Schreiben, weil sie den
    # Dateinamen traegt.
    kennung = neue_kennung()
    foto = Foto(
        id=kennung,
        fund_id=fund.id,
        dateiname=f"{kennung}{bilder.ENDUNG}",
        breite=breite,
        hoehe=hoehe,
    )
    _ = bilder.ablegen(fotoordner(werte, fund.id), foto.dateiname, daten)
    sitzung_.add(foto)
    await sitzung_.commit()
    await sitzung_.refresh(foto)
    return foto_aus(foto)


@router.get("/{fund_id}/fotos/{foto_id}", summary="Foto ausliefern")
async def foto_lesen(
    fund_id: str,
    foto_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    werte: Werte,
) -> FileResponse:
    """Liefert die Bilddatei. Nur der Besitzer oder ein geteilter Fund geben sie her."""
    fund = await lesbarer_fund(sitzung_, fund_id, nutzer)
    foto = await foto_zum_fund(sitzung_, fund, foto_id)
    return FileResponse(fotoordner(werte, fund.id) / foto.dateiname, media_type="image/jpeg")


@router.delete(
    "/{fund_id}/fotos/{foto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Foto loeschen",
)
async def foto_loeschen(
    fund_id: str,
    foto_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    werte: Werte,
) -> Response:
    """Loescht ein Foto des eigenen Fundes."""
    fund = await eigenes(sitzung_, Fund, fund_id, nutzer)
    foto = await foto_zum_fund(sitzung_, fund, foto_id)
    bilder.entfernen(fotoordner(werte, fund.id) / foto.dateiname)
    await sitzung_.delete(foto)
    await sitzung_.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
