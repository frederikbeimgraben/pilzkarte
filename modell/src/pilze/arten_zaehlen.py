#!/usr/bin/env python3
"""Count visits per collectable species and write the season table of the app.

A visit is one observer, on one day, inside one square kilometre, with at
least two species recorded. `visit_model.py` trains on the same unit, so the
numbers here and the numbers a model learns on come from one definition.

Two products leave this script.

  The report on stdout: German name, Latin name, records, visits, level. The
  level decides what the app shows for a species: `Vorhersage` from 600
  visits, `Saison` from 60, `Profil` below that.

  The season table as JSON. Per calendar week it holds the number of visits
  and the number of visits that found the species, split into the closed
  years and the running year. The backend divides the two and gets the share
  of visits with a find, the curve of the species page. The table is small
  and is committed under `backend/daten/saison.json`, so the backend runs
  without the 28 GB of the chain.

Week 53 is folded into week 52. It falls in some years only; a curve of 52
weeks that skips it would leave a hole in the numerator and the denominator
alike.

Usage:
    python arten_zaehlen.py --occurrences data/interim/occurrences.parquet
    python arten_zaehlen.py --tabelle ../backend/daten/saison.json
"""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    from collections.abc import Iterable

ARTEN = """Boletus edulis;Steinpilz
Boletus reticulatus;Sommersteinpilz
Boletus pinophilus;Kiefernsteinpilz
Boletus aereus;Schwarzhütiger Steinpilz
Imleria badia;Maronenröhrling
Leccinum scabrum;Birkenpilz
Leccinum versipelle;Birken-Rotkappe
Leccinum aurantiacum;Espen-Rotkappe
Suillus luteus;Butterpilz
Suillus grevillei;Goldröhrling
Suillus bovinus;Kuhröhrling
Suillus granulatus;Körnchenröhrling
Xerocomellus chrysenteron;Rotfußröhrling
Xerocomus subtomentosus;Ziegenlippe
Neoboletus erythropus;Flockenstieliger Hexenröhrling
Suillellus luridus;Netzstieliger Hexenröhrling
Butyriboletus appendiculatus;Anhängselröhrling
Cantharellus cibarius;Pfifferling
Craterellus tubaeformis;Trompetenpfifferling
Craterellus cornucopioides;Totentrompete
Craterellus lutescens;Gelbstieliger Trompetenpfifferling
Hydnum repandum;Semmelstoppelpilz
Hydnum rufescens;Rotgelber Stoppelpilz
Lactarius deliciosus;Edelreizker
Lactarius deterrimus;Fichtenreizker
Lactarius salmonicolor;Lachsreizker
Lactarius volemus;Brätling
Russula cyanoxantha;Frauentäubling
Russula vesca;Speisetäubling
Russula virescens;Grüngefelderter Täubling
Russula claroflava;Gelber Graustieltäubling
Macrolepiota procera;Parasol
Macrolepiota mastoidea;Zitzen-Riesenschirmling
Chlorophyllum rhacodes;Safranschirmling
Agaricus campestris;Wiesenchampignon
Agaricus arvensis;Schafchampignon
Agaricus augustus;Riesenchampignon
Agaricus sylvaticus;Waldchampignon
Coprinus comatus;Schopftintling
Lycoperdon perlatum;Flaschenbovist
Calvatia gigantea;Riesenbovist
Lycoperdon utriforme;Hasenbovist
Clitocybe nebularis;Nebelkappe
Lepista nuda;Violetter Rötelritterling
Lepista personata;Lilastieliger Rötelritterling
Infundibulicybe geotropa;Mönchskopf
Armillaria mellea;Honiggelber Hallimasch
Armillaria ostoyae;Dunkler Hallimasch
Armillaria gallica;Gelbschuppiger Hallimasch
Kuehneromyces mutabilis;Stockschwämmchen
Flammulina velutipes;Samtfußrübling
Pleurotus ostreatus;Austernseitling
Pleurotus pulmonarius;Lungenseitling
Hericium erinaceus;Igelstachelbart
Hericium coralloides;Ästiger Stachelbart
Fistulina hepatica;Ochsenzunge
Laetiporus sulphureus;Schwefelporling
Sparassis crispa;Krause Glucke
Grifola frondosa;Klapperschwamm
Meripilus giganteus;Riesenporling
Cerioporus squamosus;Schuppiger Porling
Marasmius oreades;Nelkenschwindling
Calocybe gambosa;Maipilz
Amanita rubescens;Perlpilz
Amanita fulva;Fuchsiger Scheidenstreifling
Morchella esculenta;Speisemorchel
Morchella elata;Spitzmorchel
Mitrophora semilibera;Käppchenmorchel
Verpa bohemica;Böhmische Verpel
Auricularia auricula-judae;Judasohr
Tricholoma terreum;Erdritterling
Tricholoma portentosum;Schwarzfaseriger Ritterling
Hygrophorus marzuolus;Märzschneckling
Mucidula mucida;Buchen-Schleimrübling
Gomphidius glutinosus;Kuhmaul
Chroogomphus rutilus;Kupferroter Gelbfuß
Cortinarius caperatus;Reifpilz
Lyophyllum decastes;Büscheliger Rasling
Clitopilus prunulus;Mehlräsling
Albatrellus ovinus;Schafporling
Sarcodon imbricatus;Habichtspilz
Aleuria aurantia;Orangebecherling
Leucoagaricus leucothites;Rosablättriger Egerlingsschirmling
Entoloma clypeatum;Schildrötling
Lepista flaccida;Fuchsiger Rötelritterling"""

WOCHEN = 52
AB_JAHR = 2015
MIN_ARTEN = 2
# Ein Fund mit 5 km Unschaerfe sagt nicht, in welchem Quadratkilometer der
# Beobachter stand. Er kann darum keine Begehung tragen.
MAX_UNSICHERHEIT_M = 500
SCHWELLE_VORHERSAGE = 600
SCHWELLE_SAISON = 60


def arten_namen() -> dict[str, str]:
    """Latin name to German name for every collectable species of the app."""
    return dict(zeile.split(";") for zeile in ARTEN.splitlines())


def stufe(besuche: int) -> str:
    """The level of a species, decided by its number of visits since 2015."""
    if besuche >= SCHWELLE_VORHERSAGE:
        return "Vorhersage"
    if besuche >= SCHWELLE_SAISON:
        return "Saison"
    return "Profil"


def letzte_volle_woche(letzter_tag: date) -> tuple[int, int]:
    """ISO year and week of the last week the data covers from Monday to Sunday.

    A week the data cuts in half would pull the curve of the running year
    down for a reason that has nothing to do with the fungus.
    """
    # isoweekday() is 7 on Sunday, so a Sunday closes its own week.
    ende = letzter_tag - timedelta(days=letzter_tag.isoweekday() % 7)
    jahr, woche, _ = ende.isocalendar()
    return jahr, min(woche, WOCHEN)


def begehungen_bilden(
    occ: pd.DataFrame,
    *,
    ab_jahr: int = AB_JAHR,
    min_arten: int = MIN_ARTEN,
    max_unsicherheit: int = MAX_UNSICHERHEIT_M,
) -> pd.DataFrame:
    """Reduce the records to the records that lie inside a usable visit.

    The result keeps one row per record and carries the visit key, so the
    caller counts visits per week and finds per week from the same frame.
    """
    gefiltert = occ[(occ["iso_year"] >= ab_jahr) & occ["recordedByHash"].notna()]
    fehler = gefiltert["coordinateUncertaintyInMeters"]
    gefiltert = gefiltert[fehler.isna() | (fehler <= max_unsicherheit)]
    schluessel = (
        gefiltert["recordedByHash"].astype(str)
        + "|"
        + gefiltert["date"].astype(str)
        + "|"
        + (gefiltert["x"] // 1000).astype(int).astype(str)
        + "_"
        + (gefiltert["y"] // 1000).astype(int).astype(str)
    )
    gefiltert = gefiltert.assign(visit=schluessel)
    arten_je_besuch = gefiltert.groupby("visit")["species"].nunique()
    tragfaehig = set(arten_je_besuch[arten_je_besuch >= min_arten].index)
    return gefiltert[gefiltert["visit"].isin(tragfaehig)]


def wochenreihe(zaehlung: pd.Series) -> list[int]:
    """A series indexed by ISO week as a list of 52 numbers, week 53 folded in."""
    reihe = [0] * WOCHEN
    for woche, anzahl in zaehlung.items():
        nummer = min(int(woche), WOCHEN)
        if 1 <= nummer <= WOCHEN:
            reihe[nummer - 1] += int(anzahl)
    return reihe


def saisontabelle(besuche: pd.DataFrame, *, stand: tuple[int, int]) -> dict[str, object]:
    """Build the season table: visits per week and finds per week, per species.

    The closed years carry the area of the curve, the running year the line.
    They are counted apart because the running year is not comparable to a
    full one until it ends.
    """
    laufendes_jahr, letzte_woche = stand
    eindeutig = besuche.drop_duplicates("visit")
    geschlossen = eindeutig[eindeutig["iso_year"] < laufendes_jahr]
    laufend = eindeutig[eindeutig["iso_year"] == laufendes_jahr]

    je_art = besuche.drop_duplicates(["visit", "species"])
    arten: dict[str, object] = {}
    for lateinisch in arten_namen():
        treffer = je_art[je_art["species"] == lateinisch]
        arten[lateinisch] = {
            "begehungenMitFund": int(len(treffer)),
            "fundeJeWoche": wochenreihe(
                treffer[treffer["iso_year"] < laufendes_jahr].groupby("iso_week").size()
            ),
            "fundeJeWocheLaufendesJahr": wochenreihe(
                treffer[treffer["iso_year"] == laufendes_jahr].groupby("iso_week").size()
            ),
        }

    return {
        "standJahr": laufendes_jahr,
        "standWoche": letzte_woche,
        "vonJahr": int(eindeutig["iso_year"].min()),
        "bisJahr": laufendes_jahr - 1,
        "minArten": MIN_ARTEN,
        "begehungenJeWoche": wochenreihe(geschlossen.groupby("iso_week").size()),
        "begehungenJeWocheLaufendesJahr": wochenreihe(laufend.groupby("iso_week").size()),
        "arten": arten,
    }


def bericht(occ: pd.DataFrame, besuche: pd.DataFrame) -> pd.DataFrame:
    """The table of the report: one row per species, sorted by visits."""
    gesamt = occ["species"].value_counts()
    je_art = besuche.drop_duplicates(["visit", "species"])["species"].value_counts()
    zeilen = [
        (deutsch, lateinisch, int(gesamt.get(lateinisch, 0)), int(je_art.get(lateinisch, 0)))
        for lateinisch, deutsch in arten_namen().items()
    ]
    frame = pd.DataFrame(zeilen, columns=["deutsch", "latein", "records", "besuche"])
    frame = frame.sort_values("besuche", ascending=False)
    frame["stufe"] = frame["besuche"].map(stufe)
    return frame


def _stand_lesen(besuche: pd.DataFrame, vorgabe: str | None) -> tuple[int, int]:
    letzter = date.fromisoformat(vorgabe) if vorgabe else besuche["date"].max().date()
    return letzte_volle_woche(letzter)


def _argumente(argv: Iterable[str] | None) -> argparse.Namespace:
    zerleger = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    zerleger.add_argument(
        "--occurrences",
        type=Path,
        default=Path("data/interim/occurrences.parquet"),
        help="Fundtabelle der Kette",
    )
    zerleger.add_argument(
        "--tabelle",
        type=Path,
        default=None,
        help="Ziel der Saisontabelle als JSON. Ohne Angabe wird nur berichtet",
    )
    zerleger.add_argument("--ab-jahr", type=int, default=AB_JAHR, help="erstes gezaehltes ISO-Jahr")
    zerleger.add_argument(
        "--min-arten", type=int, default=MIN_ARTEN, help="Arten je Begehung, mindestens"
    )
    zerleger.add_argument(
        "--stand",
        default=None,
        help="letzter Tag der Daten als ISO-Datum. Ohne Angabe der spaeteste Fund",
    )
    return zerleger.parse_args(None if argv is None else list(argv))


def main(argv: Iterable[str] | None = None) -> None:
    """Read the records, report the levels and write the season table."""
    args = _argumente(argv)
    spalten = [
        "species",
        "recordedByHash",
        "date",
        "x",
        "y",
        "iso_year",
        "iso_week",
        "coordinateUncertaintyInMeters",
    ]
    occ = pd.read_parquet(args.occurrences, columns=spalten)
    besuche = begehungen_bilden(occ, ab_jahr=args.ab_jahr, min_arten=args.min_arten)

    frame = bericht(occ, besuche)
    pd.set_option("display.width", 200)
    pd.set_option("display.max_rows", 200)
    print(frame.to_string(index=False))
    print("\nStufen:", frame["stufe"].value_counts().to_dict())

    if args.tabelle:
        stand = _stand_lesen(besuche, args.stand)
        tabelle = saisontabelle(besuche, stand=stand)
        args.tabelle.parent.mkdir(parents=True, exist_ok=True)
        args.tabelle.write_text(
            json.dumps(tabelle, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        groesse = args.tabelle.stat().st_size // 1024
        print(f"\nSaisontabelle: {args.tabelle} ({groesse} kB, Stand {stand[0]} KW {stand[1]})")


if __name__ == "__main__":
    main()
