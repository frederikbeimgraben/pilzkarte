"""Der Artenkatalog: Stufen, Saisonkurve, Profile und die zwei Endpunkte.

Die Fixture haelt drei erfundene Arten mit runden Zahlen. So laesst sich jeder
Prozentwert im Kopf nachrechnen: 30 von 100 Begehungen sind 30 Prozent.
"""

import json
import tomllib
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.core.errors import NichtGefunden
from app.main import app_bauen
from app.modules.arten.katalog import (
    DATEN,
    SCHUTZ_JA,
    SCHUTZ_NEIN,
    Katalog,
    anteil_je_woche,
    karten_suchen,
    katalog,
    merkmale_bauen,
    mittel_je_woche,
    profile_lesen,
    saison_lesen,
    spitze_woche_fuer,
    stufe_fuer,
    vorhersage_geplant,
)
from app.modules.arten.router import aktueller_katalog
from app.modules.arten.schemas import (
    WERTIGKEIT_BESTE,
    WERTIGKEIT_SCHWAECHSTE,
    WOCHEN,
    Essbarkeit,
    Gefaehrdung,
    Haeufigkeit,
    MerkmalSchluessel,
    Profil,
    Reagenz,
    Reagenzeintrag,
    SaisonKurve,
    Saisontabelle,
    Spanne,
    Stufe,
)

# Die drei Arten der Fixture: eine mit Karte und vielen Begehungen, eine
# knapp ueber der Saisonschwelle, eine ganz ohne Zeile in der Tabelle.
STEINPILZ = """
name = "Steinpilz"
lateinisch = "Boletus edulis"
gruppe = "roehrling"
speisewert = "speisepilz"
geschuetzt = true
jahreszeiten = ["herbst"]
baeume = ["fichte", "buche"]
karte = "boletus_edulis"
speisewertHinweis = "Jung sammeln."
schutzHinweis = "Auch die Verwandten schont man."

[quelle]
url = "https://www.123pilzsuche.de/daten/details/Steinpilze.htm"
geprueftAm = "2026-09-10"

[merkmale]
hut = "Braun."
roehren = "Weiss, dann oliv."
stiel = "Bauchig."
fleisch = "Weiss."
geruch = "Pilzig."
geschmack = "Mild."
sporenpulver = "Olivbraun."
vorkommen = "Im Wald."
zeit = "Herbst."

[[verwechslungen]]
name = "Gallenroehrling"
merkmal = "Bitter."
essbar = "ungeniessbar"

[[links]]
titel = "Wikipedia"
url = "https://de.wikipedia.org/wiki/Gemeiner_Steinpilz"
"""

MAIPILZ = """
name = "Maipilz"
lateinisch = "Calocybe gambosa"
gruppe = "ritterling"
speisewert = "speisepilz"
geschuetzt = false
jahreszeiten = ["fruehling"]
baeume = []

[quelle]
url = "https://www.123pilzsuche.de/daten/details/Mairitterling.htm"
geprueftAm = "2026-09-10"

[merkmale]
hut = "Cremeweiss."
lamellen = "Weiss."
fleisch = "Fest."
geruch = "Mehlig."
geschmack = "Mehlig."
sporenpulver = "Weiss."
vorkommen = "Hecken."
zeit = "Mai."

[[verwechslungen]]
name = "Ziegelroter Risspilz"
merkmal = "Lamellen braeunlich."
essbar = "toedlichGiftig"

[[links]]
titel = "Wikipedia"
url = "https://de.wikipedia.org/wiki/Maipilz"
"""

BRAETLING = """
name = "Braetling"
lateinisch = "Lactarius volemus"
gruppe = "milchling"
speisewert = "speisepilz"
geschuetzt = true
jahreszeiten = ["sommer"]
baeume = ["buche"]

[quelle]
url = "https://www.123pilzsuche.de/daten/details/Braetling2004.htm"
geprueftAm = "2026-09-10"

[merkmale]
hut = "Rostbraun."
milch = "Weiss und reichlich."
fleisch = "Fest."
geruch = "Nach Fisch."
geschmack = "Nussig."
sporenpulver = "Weiss."
vorkommen = "Laubwald."
zeit = "Sommer."

[[verwechslungen]]
name = "Andere Milchlinge"
merkmal = "Kein Fischgeruch."
essbar = "ungeniessbar"

[[links]]
titel = "Wikipedia"
url = "https://de.wikipedia.org/wiki/Br%C3%A4tling"
"""


GALLENROEHRLING = """
name = "Gallenroehrling"
lateinisch = "Tylopilus felleus"
gruppe = "roehrling"
speisewert = "ungeniessbar"
geschuetzt = false
sammelbar = false
jahreszeiten = ["sommer", "herbst"]
baeume = ["fichte"]

[quelle]
url = "https://www.123pilzsuche.de/daten/details/Gallenroehrling.htm"
geprueftAm = "2026-09-10"

[[reagenzien]]
reagenz = "koh"
reaktion = "Fleisch braeunt."

[[reagenzien]]
reagenz = "melzer"
reaktion = "Ohne Reaktion."

[merkmale]
hut = "Hellbraun."
roehren = "Jung weiss, bald rosa."
stiel = "Mit grobem dunklem Netz."
fleisch = "Weiss."
geruch = "Unauffaellig."
geschmack = "Sehr bitter."
sporenpulver = "Rosa."
vorkommen = "Bei Fichte."
zeit = "Juni bis Oktober."

[[verwechslungen]]
name = "Steinpilz"
merkmal = "Roehren bleiben weiss bis oliv, Netz weiss, Geschmack mild."
essbar = "speisepilz"
slug = "steinpilz"

[[links]]
titel = "123pilzsuche.de"
url = "https://www.123pilzsuche.de/daten/details/Gallenroehrling.htm"
"""


def _reihe(werte: dict[int, int]) -> list[int]:
    """Eine Wochenreihe aus wenigen gesetzten Wochen, alles andere null."""
    reihe = [0] * WOCHEN
    for woche, wert in werte.items():
        reihe[woche - 1] = wert
    return reihe


def _tabelle() -> dict[str, Any]:
    return {
        "standJahr": 2026,
        "standWoche": 3,
        "vonJahr": 2015,
        "bisJahr": 2025,
        "minArten": 2,
        "begehungenJeWoche": _reihe({1: 100, 2: 200, 40: 400}),
        "begehungenJeWocheLaufendesJahr": _reihe({1: 50, 2: 100, 3: 0, 40: 900}),
        "arten": {
            "Boletus edulis": {
                "begehungenMitFund": 700,
                "fundeJeWoche": _reihe({1: 10, 2: 20, 40: 200}),
                "fundeJeWocheLaufendesJahr": _reihe({1: 20, 2: 5, 40: 900}),
            },
            "Calocybe gambosa": {
                "begehungenMitFund": 60,
                "fundeJeWoche": _reihe({2: 50}),
                "fundeJeWocheLaufendesJahr": _reihe({}),
            },
        },
    }


@pytest.fixture
def daten(tmp_path: Path) -> Path:
    """Legt einen Datenordner mit drei Profilen und einer Saisontabelle an."""
    ordner = tmp_path / "daten"
    (ordner / "arten").mkdir(parents=True)
    for slug, inhalt in [
        ("steinpilz", STEINPILZ),
        ("maipilz", MAIPILZ),
        ("braetling", BRAETLING),
        ("gallenroehrling", GALLENROEHRLING),
    ]:
        (ordner / "arten" / f"{slug}.toml").write_text(inhalt, encoding="utf-8")
    (ordner / "saison.json").write_text(json.dumps(_tabelle()), encoding="utf-8")
    return ordner


@pytest.fixture
def maps(tmp_path: Path) -> Path:
    """Legt genau ein Manifest an, so wie die Kette es rendert."""
    ordner = tmp_path / "maps"
    ordner.mkdir()
    (ordner / "boletus_edulis.json").write_text("{}", encoding="utf-8")
    return ordner


@pytest.fixture
def gebaut(daten: Path, maps: Path) -> Katalog:
    return katalog(daten, maps)


@pytest.fixture
def app(gebaut: Katalog) -> FastAPI:
    """Die App mit dem Katalog der Fixture statt dem der ausgelieferten Dateien."""
    gebaute_app = app_bauen()
    gebaute_app.dependency_overrides[aktueller_katalog] = lambda: gebaut
    return gebaute_app


def kurve_von(gebaut: Katalog, slug: str) -> SaisonKurve:
    """Die Kurve einer sammelbaren Art. Fehlt sie, liegt der Test falsch."""
    saison = gebaut.art(slug).saison
    assert saison is not None
    return saison


def klient(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


# ------------------------------------------------------------------ Rechnen


@pytest.mark.parametrize(
    ("begehungen", "erwartet"),
    [
        (0, Stufe.PROFIL),
        (59, Stufe.PROFIL),
        (60, Stufe.SAISON),
        (599, Stufe.SAISON),
        # Ohne Karte bleibt auch eine Art mit Modell auf der Stufe Saison.
        (600, Stufe.SAISON),
        (5000, Stufe.SAISON),
    ],
)
def test_stufe_ohne_karte_haengt_an_den_begehungen(begehungen: int, erwartet: Stufe) -> None:
    assert stufe_fuer(begehungen, hat_karte=False) == erwartet


@pytest.mark.parametrize("begehungen", [0, 59, 600, 5000])
def test_eine_karte_macht_die_stufe_vorhersage(begehungen: int) -> None:
    assert stufe_fuer(begehungen, hat_karte=True) == Stufe.VORHERSAGE


@pytest.mark.parametrize("begehungen", [0, 59, 599])
def test_unter_der_schwelle_ist_keine_vorhersage_geplant(begehungen: int) -> None:
    assert vorhersage_geplant(begehungen) is False


@pytest.mark.parametrize("begehungen", [600, 5000])
def test_ab_der_schwelle_ist_eine_vorhersage_geplant(begehungen: int) -> None:
    assert vorhersage_geplant(begehungen) is True


def test_anteil_rechnet_prozent_und_meidet_die_null() -> None:
    assert anteil_je_woche([10, 1, 0], [100, 3, 0]) == [10.0, 33.3, 0.0]


def test_spitze_woche_ist_eins_basiert() -> None:
    assert spitze_woche_fuer([1.0, 5.0, 2.0]) == 2


def test_spitze_woche_fehlt_ohne_fund() -> None:
    assert spitze_woche_fuer([0.0, 0.0]) is None


# ------------------------------------------------------------------ Katalog


def test_liste_traegt_alle_arten_nach_namen(gebaut: Katalog) -> None:
    liste = gebaut.liste()

    assert [art.name for art in liste.arten] == [
        "Braetling",
        "Gallenroehrling",
        "Maipilz",
        "Steinpilz",
    ]


def test_liste_nennt_stand_jahre_und_nenner(gebaut: Katalog) -> None:
    liste = gebaut.liste()

    assert liste.stand.jahr == 2026
    assert liste.stand.woche == 3
    assert (liste.jahre.von, liste.jahre.bis) == (2015, 2025)
    assert liste.begehungen == 700


def test_stufen_kommen_aus_karte_und_tabelle(gebaut: Katalog) -> None:
    stufen = {art.slug: art.stufe for art in gebaut.liste().arten}

    assert stufen == {
        "steinpilz": Stufe.VORHERSAGE,
        "maipilz": Stufe.SAISON,
        "braetling": Stufe.PROFIL,
        "gallenroehrling": Stufe.VERWECHSLUNG,
    }


def test_ohne_manifest_bleibt_die_art_auf_saison(daten: Path, tmp_path: Path) -> None:
    leer = tmp_path / "ungerendert"
    leer.mkdir()
    gebaut = katalog(daten, leer)

    steinpilz = gebaut.art("steinpilz")

    # 700 Begehungen mit Fund, aber kein Manifest: das Modell traegt, die
    # Karte fehlt. Der Chip "mit Vorhersage" darf die Art darum nicht zeigen.
    assert steinpilz.begehungen_mit_fund == 700
    assert steinpilz.karten_slug is None
    assert steinpilz.stufe == Stufe.SAISON
    assert steinpilz.vorhersage_geplant is True


def test_vorhersage_geplant_steht_in_liste_und_profil(gebaut: Katalog) -> None:
    geplant = {art.slug: art.vorhersage_geplant for art in gebaut.liste().arten}

    assert geplant == {
        "steinpilz": True,
        "maipilz": False,
        "braetling": False,
        "gallenroehrling": False,
    }
    assert gebaut.art("steinpilz").vorhersage_geplant is True


def test_die_stufe_folgt_der_karte_auch_ohne_begehungen(daten: Path, tmp_path: Path) -> None:
    maps = tmp_path / "frisch"
    maps.mkdir()
    (maps / "braetling.json").write_text("{}", encoding="utf-8")
    gebaut = katalog(daten, maps)

    braetling = gebaut.art("braetling")

    assert braetling.stufe == Stufe.VORHERSAGE
    assert braetling.vorhersage_geplant is False


def test_art_ohne_zeile_in_der_tabelle_bleibt_leer(gebaut: Katalog) -> None:
    art = gebaut.art("braetling")
    kurve = kurve_von(gebaut, "braetling")

    assert art.begehungen_mit_fund == 0
    assert art.spitze_woche is None
    assert kurve.hoechstwert == 0.0
    assert set(kurve.alle_jahre) == {0.0}


def test_saisonkurve_rechnet_beide_reihen(gebaut: Katalog) -> None:
    kurve = kurve_von(gebaut, "steinpilz")

    # 10 von 100, 20 von 200, 200 von 400 Begehungen der geschlossenen Jahre.
    assert kurve.alle_jahre[0] == 10.0
    assert kurve.alle_jahre[1] == 10.0
    assert kurve.alle_jahre[39] == 50.0
    # 20 von 50 und 5 von 100 Begehungen des laufenden Jahres.
    assert kurve.laufendes_jahr == [40.0, 5.0, 0.0]


def test_laufendes_jahr_endet_an_der_letzten_vollen_woche(gebaut: Katalog) -> None:
    kurve = kurve_von(gebaut, "steinpilz")

    assert len(kurve.laufendes_jahr) == 3
    assert len(kurve.alle_jahre) == WOCHEN


def test_hoechstwert_gilt_fuer_beide_reihen(gebaut: Katalog) -> None:
    kurve = kurve_von(gebaut, "steinpilz")

    assert kurve.hoechstwert == 50.0
    assert max(kurve.laufendes_jahr) <= kurve.hoechstwert


def test_mittel_teilt_durch_die_geschlossenen_jahre() -> None:
    assert mittel_je_woche([110, 55, 0], 11) == [10.0, 5.0, 0.0]


def test_liste_nennt_die_begehungen_je_woche(gebaut: Katalog) -> None:
    liste = gebaut.liste()

    # Elf geschlossene Jahre, 2015 bis 2025: 100 Begehungen in KW 1 sind 9,1 je Jahr.
    assert liste.begehungen_je_woche_alle_jahre[0] == 9.1
    assert liste.begehungen_je_woche_alle_jahre[1] == 18.2
    assert liste.begehungen_je_woche_alle_jahre[39] == 36.4
    assert liste.begehungen_je_woche_laufendes_jahr == [50, 100, 0]


def test_profil_nennt_die_begehungen_je_woche(gebaut: Katalog) -> None:
    kurve = kurve_von(gebaut, "steinpilz")

    assert kurve.begehungen_je_woche_alle_jahre[0] == 9.1
    assert kurve.begehungen_je_woche_laufendes_jahr == [50, 100, 0]


def test_die_begehungen_des_laufenden_jahres_enden_mit_der_kurve(gebaut: Katalog) -> None:
    kurve = kurve_von(gebaut, "steinpilz")

    assert len(kurve.begehungen_je_woche_laufendes_jahr) == len(kurve.laufendes_jahr)
    assert len(kurve.begehungen_je_woche_alle_jahre) == len(kurve.alle_jahre) == WOCHEN


def test_eine_duenne_woche_ist_an_ihrem_nenner_zu_erkennen(gebaut: Katalog) -> None:
    kurve = kurve_von(gebaut, "steinpilz")

    # KW 3 traegt 0 Prozent, aber auch keine einzige Begehung. Das Frontend
    # zeichnet sie darum blass statt als Absturz der Linie.
    assert kurve.laufendes_jahr[2] == 0.0
    assert kurve.begehungen_je_woche_laufendes_jahr[2] == 0


def test_spitze_woche_zeigt_auf_die_beste_kalenderwoche(gebaut: Katalog) -> None:
    assert gebaut.art("steinpilz").spitze_woche == 40


def test_tags_beginnen_mit_der_stufe(gebaut: Katalog) -> None:
    art = gebaut.art("steinpilz")

    assert art.tags == ["vorhersage", "roehrling", "herbst", "fichte", "buche"]


def test_karte_kommt_nur_mit_manifest(gebaut: Katalog) -> None:
    karten = {art.slug: art.karten_slug for art in gebaut.liste().arten}

    assert karten == {
        "steinpilz": "boletus_edulis",
        "maipilz": None,
        "braetling": None,
        "gallenroehrling": None,
    }


def test_karte_faellt_auf_den_slug_zurueck(daten: Path, tmp_path: Path) -> None:
    maps = tmp_path / "spaeter"
    maps.mkdir()
    (maps / "maipilz.json").write_text("{}", encoding="utf-8")
    profile = profile_lesen(daten / "arten")

    assert karten_suchen(profile, maps) == {"maipilz": "maipilz"}


def test_unbekannter_slug_ist_ein_fehler(gebaut: Katalog) -> None:
    with pytest.raises(NichtGefunden):
        gebaut.art("gibt-es-nicht")


def test_eine_verwechslungsart_traegt_keine_saisonkurve(gebaut: Katalog) -> None:
    galle = gebaut.art("gallenroehrling")

    assert galle.stufe == Stufe.VERWECHSLUNG
    assert galle.sammelbar is False
    assert galle.saison is None
    assert galle.spitze_woche is None
    assert galle.karten_slug is None


def test_sammelbare_arten_tragen_die_kurve(gebaut: Katalog) -> None:
    sammelbar = {art.slug: art.sammelbar for art in gebaut.liste().arten}

    assert sammelbar == {
        "steinpilz": True,
        "maipilz": True,
        "braetling": True,
        "gallenroehrling": False,
    }
    assert all(art.saison is not None for art in gebaut.liste().arten if art.sammelbar)
    assert all(art.saison is None for art in gebaut.liste().arten if not art.sammelbar)


def test_eine_verwechslung_verlinkt_ihr_eigenes_profil(gebaut: Katalog) -> None:
    galle = gebaut.art("gallenroehrling")

    assert galle.verwechslungen[0].slug == "steinpilz"
    assert gebaut.art(galle.verwechslungen[0].slug or "").name == "Steinpilz"


def test_eine_nicht_sammelbare_art_darf_keine_karte_haben() -> None:
    grundlage = tomllib.loads(GALLENROEHRLING)
    grundlage["karte"] = "gallenroehrling"

    with pytest.raises(ValidationError, match="keine Karte"):
        Profil.model_validate(grundlage)


# ------------------------------------------------------------------ Merkmale


def test_merkmale_stehen_in_der_reihenfolge_der_artseite(gebaut: Katalog) -> None:
    schluessel = [zeile.schluessel for zeile in gebaut.art("steinpilz").merkmale]

    assert schluessel == [
        MerkmalSchluessel.HUT,
        MerkmalSchluessel.ROEHREN,
        MerkmalSchluessel.STIEL,
        MerkmalSchluessel.FLEISCH,
        MerkmalSchluessel.GERUCH,
        MerkmalSchluessel.GESCHMACK,
        MerkmalSchluessel.SPORENPULVER,
        MerkmalSchluessel.VORKOMMEN,
        MerkmalSchluessel.ZEIT,
        MerkmalSchluessel.SPEISEWERT,
        MerkmalSchluessel.SCHUTZ,
    ]


def test_speisewert_und_schutz_tragen_den_hinweis(gebaut: Katalog) -> None:
    zeilen = {zeile.schluessel: zeile.text for zeile in gebaut.art("steinpilz").merkmale}

    assert zeilen[MerkmalSchluessel.SPEISEWERT] == "Guter Speisepilz. Jung sammeln."
    assert zeilen[MerkmalSchluessel.SCHUTZ] == f"{SCHUTZ_JA} Auch die Verwandten schont man."


def test_ohne_schutz_steht_der_zweite_satz(gebaut: Katalog) -> None:
    zeilen = {zeile.schluessel: zeile.text for zeile in gebaut.art("maipilz").merkmale}

    assert zeilen[MerkmalSchluessel.SCHUTZ] == SCHUTZ_NEIN
    assert zeilen[MerkmalSchluessel.SPEISEWERT] == "Guter Speisepilz."


def test_jede_essbarkeit_hat_einen_satz(gebaut: Katalog) -> None:
    profil = gebaut.profile["maipilz"]

    for wert in Essbarkeit:
        geaendert = profil.model_copy(update={"speisewert": wert})
        zeilen = {zeile.schluessel: zeile.text for zeile in merkmale_bauen(geaendert)}
        assert zeilen[MerkmalSchluessel.SPEISEWERT]


# ------------------------------------------------------------------ Dateien


def test_reagenzien_stehen_als_zeile_in_der_tabelle(gebaut: Katalog) -> None:
    zeilen = {zeile.schluessel: zeile.text for zeile in gebaut.art("gallenroehrling").merkmale}

    assert zeilen[MerkmalSchluessel.REAGENZIEN] == (
        "Kalilauge (KOH): Fleisch braeunt. Melzers Reagenz: Ohne Reaktion."
    )


def test_die_reagenzzeile_steht_hinter_dem_sporenpulver(gebaut: Katalog) -> None:
    schluessel = [zeile.schluessel for zeile in gebaut.art("gallenroehrling").merkmale]

    assert schluessel.index(MerkmalSchluessel.SPORENPULVER) + 1 == schluessel.index(
        MerkmalSchluessel.REAGENZIEN
    )


def test_ohne_reagenzien_fehlt_die_zeile(gebaut: Katalog) -> None:
    schluessel = [zeile.schluessel for zeile in gebaut.art("steinpilz").merkmale]

    assert MerkmalSchluessel.REAGENZIEN not in schluessel


def test_jedes_reagenz_hat_einen_namen(gebaut: Katalog) -> None:
    profil = gebaut.profile["gallenroehrling"]

    for wert in Reagenz:
        geaendert = profil.model_copy(
            update={"reagenzien": [Reagenzeintrag(reagenz=wert, reaktion="x")]}
        )
        zeilen = {zeile.schluessel: zeile.text for zeile in merkmale_bauen(geaendert)}
        assert zeilen[MerkmalSchluessel.REAGENZIEN].endswith(": x")


def test_profil_verbietet_eine_leere_zeile() -> None:
    grundlage = _profil_grundlage()
    grundlage["merkmale"]["hut"] = "   "

    with pytest.raises(ValidationError, match="leer"):
        Profil.model_validate(grundlage)


def test_profil_setzt_die_reagenzzeile_nicht_selbst() -> None:
    grundlage = _profil_grundlage()
    grundlage["merkmale"]["reagenzien"] = "KOH braun."

    with pytest.raises(ValidationError, match="reagenzien"):
        Profil.model_validate(grundlage)


def test_profil_verbietet_ein_fremdes_feld() -> None:
    with pytest.raises(ValidationError):
        Profil.model_validate({**_profil_grundlage(), "farbe": "gelb"})


def test_profil_verlangt_die_pflichtzeilen() -> None:
    grundlage = _profil_grundlage()
    del grundlage["merkmale"]["zeit"]

    with pytest.raises(ValidationError, match="zeit"):
        Profil.model_validate(grundlage)


def test_profil_setzt_speisewert_nicht_selbst() -> None:
    grundlage = _profil_grundlage()
    grundlage["merkmale"]["speisewert"] = "Speisepilz."

    with pytest.raises(ValidationError, match="speisewert"):
        Profil.model_validate(grundlage)


def test_saisontabelle_verlangt_ein_geschlossenes_vorjahr() -> None:
    with pytest.raises(ValidationError, match="geschlossene Jahr"):
        Saisontabelle.model_validate({**_tabelle(), "bisJahr": 2020})


def test_saisontabelle_verlangt_eine_nicht_leere_spanne() -> None:
    with pytest.raises(ValidationError, match="leer"):
        Saisontabelle.model_validate(
            {**_tabelle(), "vonJahr": 2030, "bisJahr": 2025, "standJahr": 2026}
        )


def test_saisontabelle_verlangt_zweiundfuenfzig_wochen() -> None:
    with pytest.raises(ValidationError):
        Saisontabelle.model_validate({**_tabelle(), "begehungenJeWoche": [1, 2, 3]})


def test_saison_lesen_liest_die_datei(daten: Path) -> None:
    tabelle = saison_lesen(daten / "saison.json")

    assert tabelle.stand_woche == 3


def _profil_grundlage() -> dict[str, Any]:
    return tomllib.loads(MAIPILZ)


# ------------------------------------------------------------------ Endpunkte


async def test_liste_antwortet_in_camel_case(app: FastAPI) -> None:
    async with klient(app) as ruf:
        antwort = await ruf.get("/api/arten")

    assert antwort.status_code == 200
    koerper = antwort.json()
    assert set(koerper) == {
        "stand",
        "jahre",
        "begehungen",
        "begehungenJeWocheAlleJahre",
        "begehungenJeWocheLaufendesJahr",
        "arten",
    }
    erste = koerper["arten"][0]
    assert set(erste) == {
        "slug",
        "name",
        "lateinisch",
        "gruppe",
        "stufe",
        "tags",
        "geschuetzt",
        "speisewert",
        "kartenSlug",
        "sammelbar",
        "marktfaehig",
        "wertigkeit",
        "haeufigkeit",
        "vorhersageGeplant",
        "begehungenMitFund",
        "spitzeWoche",
        "saison",
    }
    assert set(erste["saison"]) == {"alleJahre", "laufendesJahr", "hoechstwert"}
    # Beide Reihen, wie im Profil: die Zeile zeichnet dieselbe Kurve, nur kleiner.
    steinpilz = next(art for art in koerper["arten"] if art["slug"] == "steinpilz")
    assert steinpilz["saison"]["laufendesJahr"] == [40.0, 5.0, 0.0]


async def test_profil_antwortet_mit_tabelle_und_kurve(app: FastAPI) -> None:
    async with klient(app) as ruf:
        antwort = await ruf.get("/api/arten/steinpilz")

    assert antwort.status_code == 200
    koerper = antwort.json()
    assert koerper["slug"] == "steinpilz"
    assert koerper["kartenSlug"] == "boletus_edulis"
    assert koerper["merkmale"][0] == {"schluessel": "hut", "text": "Braun."}
    assert koerper["verwechslungen"] == [
        {
            "name": "Gallenroehrling",
            "merkmal": "Bitter.",
            "essbar": "ungeniessbar",
            "slug": None,
        }
    ]
    assert koerper["links"][0]["url"].startswith("https://")
    assert set(koerper["saison"]) == {
        "alleJahre",
        "laufendesJahr",
        "hoechstwert",
        "jahre",
        "stand",
        "begehungen",
        "begehungenJeWocheAlleJahre",
        "begehungenJeWocheLaufendesJahr",
    }
    assert koerper["saison"]["laufendesJahr"] == [40.0, 5.0, 0.0]


async def test_unbekannter_slug_ist_problem_json(app: FastAPI) -> None:
    async with klient(app) as ruf:
        antwort = await ruf.get("/api/arten/gibt-es-nicht")

    assert antwort.status_code == 404
    assert antwort.headers["content-type"].startswith("application/problem+json")
    assert antwort.json()["code"] == "not_found"
    assert "gibt-es-nicht" in antwort.json()["detail"]


async def test_liste_braucht_kein_token(app: FastAPI) -> None:
    async with klient(app) as ruf:
        antwort = await ruf.get("/api/arten")

    assert antwort.status_code == 200


# ------------------------------------------------------- die echten Profile


def test_alle_ausgelieferten_profile_sind_gueltig() -> None:
    profile = profile_lesen(DATEN / "arten")

    assert len(profile) == 309
    assert sum(1 for profil in profile.values() if profil.sammelbar) == 85


def test_jede_art_der_kette_hat_ein_profil() -> None:
    profile = profile_lesen(DATEN / "arten")
    tabelle = saison_lesen(DATEN / "saison.json")

    sammelbar = {p.lateinisch for p in profile.values() if p.sammelbar}
    assert sammelbar == set(tabelle.arten)


def _maps_der_kette(ziel: Path) -> Path:
    """Legt die Manifeste an, die die Kette heute gerendert hat.

    Die echten Manifeste liegen unter ``PILZE_MAPS`` und nicht im Git. Welche
    es gibt, sagt das Feld ``karte`` der Profile: es steht genau dort, wo die
    Kette schon eine Karte abgelegt hat.
    """
    ziel.mkdir(parents=True, exist_ok=True)
    for profil in profile_lesen(DATEN / "arten").values():
        if profil.karte:
            (ziel / f"{profil.karte}.json").write_text("{}", encoding="utf-8")
    return ziel


def test_die_stufen_folgen_den_gerenderten_karten(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, _maps_der_kette(tmp_path / "maps"))
    stufen = [art.stufe for art in gebaut.liste().arten]

    assert stufen.count(Stufe.VORHERSAGE) == 13
    assert stufen.count(Stufe.SAISON) == 52
    assert stufen.count(Stufe.PROFIL) == 20


def test_die_dreizehn_arten_mit_karte_stehen_namentlich_fest(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, _maps_der_kette(tmp_path / "maps"))
    mit_karte = sorted(art.slug for art in gebaut.liste().arten if art.stufe == Stufe.VORHERSAGE)

    assert mit_karte == [
        "birkenpilz",
        "buchen-schleimruebling",
        "edelreizker",
        "fichtenreizker",
        "flaschenbovist",
        "flockenstieliger-hexenroehrling",
        "lachsreizker",
        "nebelkappe",
        "netzstieliger-hexenroehrling",
        "parasol",
        "pfifferling",
        "schopftintling",
        "steinpilz",
    ]


def test_dreiundzwanzig_arten_tragen_ein_modell(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, tmp_path)

    # Die Zahl aus konzept.html: 600 Begehungen mit Fund seit 2015. Sie haengt
    # nicht daran, ob die Kette die Karte schon gerendert hat.
    assert sum(1 for art in gebaut.liste().arten if art.vorhersage_geplant) == 23


def test_jeder_slug_ist_eine_adresse() -> None:
    for slug in profile_lesen(DATEN / "arten"):
        assert slug == slug.lower()
        assert set(slug) <= set("abcdefghijklmnopqrstuvwxyz-")


def test_geschuetzte_arten_nennen_die_entnahme(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, tmp_path)
    geschuetzt = [art for art in gebaut.liste().arten if art.geschuetzt]

    assert len(geschuetzt) >= 18
    for kurz in geschuetzt:
        zeilen = {zeile.schluessel: zeile.text for zeile in gebaut.art(kurz.slug).merkmale}
        assert zeilen[MerkmalSchluessel.SCHUTZ].startswith(SCHUTZ_JA)


def test_steinpilz_und_pfifferling_sind_geschuetzt(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, tmp_path)

    assert gebaut.art("steinpilz").geschuetzt
    assert gebaut.art("pfifferling").geschuetzt


async def test_der_dienst_nimmt_die_ausgelieferten_dateien() -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get("/api/arten/steinpilz")

    assert antwort.status_code == 200
    assert antwort.json()["lateinisch"] == "Boletus edulis"


# ------------------------------------------------- die geprueften Profile


def test_jedes_profil_nennt_seine_quelle() -> None:
    for slug, profil in profile_lesen(DATEN / "arten").items():
        assert profil.quelle is not None, slug
        assert profil.quelle.url.startswith("https://www.123pilzsuche.de/"), slug
        assert profil.quelle.geprueft_am == "2026-09-10", slug


def test_jede_verwechslung_traegt_namen_und_merkmal() -> None:
    for slug, profil in profile_lesen(DATEN / "arten").items():
        for verwechslung in profil.verwechslungen:
            assert verwechslung.name.strip(), slug
            assert verwechslung.merkmal.strip(), slug


def test_kein_merkmal_und_kein_hinweis_ist_leer() -> None:
    for slug, profil in profile_lesen(DATEN / "arten").items():
        for text in profil.merkmale.values():
            assert text.strip(), slug
        assert profil.name.strip(), slug
        assert profil.lateinisch.strip(), slug
        for hinweis in (profil.speisewert_hinweis, profil.schutz_hinweis):
            assert hinweis is None or hinweis.strip(), slug


def test_jeder_verwechslungsslug_zeigt_auf_ein_profil() -> None:
    profile = profile_lesen(DATEN / "arten")

    for slug, profil in profile.items():
        for verwechslung in profil.verwechslungen:
            if verwechslung.slug is not None:
                assert verwechslung.slug in profile, f"{slug} zeigt auf {verwechslung.slug}"


def test_die_essbarkeit_einer_verwechslung_passt_zu_ihrem_profil() -> None:
    # Sonst stuende dieselbe Art auf zwei Seiten mit zwei Urteilen.
    profile = profile_lesen(DATEN / "arten")

    for slug, profil in profile.items():
        for verwechslung in profil.verwechslungen:
            if verwechslung.slug is not None:
                ziel = profile[verwechslung.slug]
                assert verwechslung.essbar == ziel.speisewert, f"{slug} zu {verwechslung.slug}"


def test_die_sammelbaren_arten_bleiben_fuenfundachtzig() -> None:
    profile = profile_lesen(DATEN / "arten")

    assert sum(1 for profil in profile.values() if profil.sammelbar) == 85


def test_verwechslungsarten_tragen_die_stufe_verwechslung(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, _maps_der_kette(tmp_path / "maps"))
    arten = {art.slug: art for art in gebaut.liste().arten}
    profile = profile_lesen(DATEN / "arten")

    for slug, profil in profile.items():
        if not profil.sammelbar:
            assert arten[slug].stufe == Stufe.VERWECHSLUNG, slug
            assert arten[slug].saison is None, slug
            assert arten[slug].karten_slug is None, slug


def test_jedes_profil_verlinkt_seine_quellseite() -> None:
    for slug, profil in profile_lesen(DATEN / "arten").items():
        titel = [verweis.titel for verweis in profil.links]
        assert titel[0] == "123pilzsuche.de", slug
        assert titel[1:] in ([], ["Wikipedia"]), slug
        assert profil.links[0].url == (profil.quelle.url if profil.quelle else ""), slug


# ------------------------------------------------- Zahlen und Listen der Quelle


def test_eine_spanne_laeuft_von_klein_nach_gross() -> None:
    spanne = Spanne(von=4, bis=20, selten_bis=25)

    assert (spanne.von, spanne.bis, spanne.selten_bis) == (4, 20, 25)


def test_eine_verdrehte_spanne_ist_kein_mass() -> None:
    with pytest.raises(ValidationError, match="unter"):
        Spanne(von=20, bis=4)


def test_der_ausnahmewert_liegt_ueber_dem_oberen_wert() -> None:
    with pytest.raises(ValidationError, match="Ausnahmewert"):
        Spanne(von=4, bis=20, selten_bis=10)


def test_die_wertigkeit_bleibt_in_der_skala_von_eins_bis_sechs() -> None:
    for profil in profile_lesen(DATEN / "arten").values():
        if profil.wertigkeit is not None:
            assert WERTIGKEIT_BESTE <= profil.wertigkeit <= WERTIGKEIT_SCHWAECHSTE


def test_marktfaehig_folgt_der_positivliste_der_dgfm(tmp_path: Path) -> None:
    gebaut = katalog(DATEN, tmp_path)

    # Der Steinpilz steht auf der Liste, der Gruene Knollenblaetterpilz nicht.
    assert gebaut.art("steinpilz").marktfaehigkeit.marktfaehig is True
    assert gebaut.art("gruener-knollenblaetterpilz").marktfaehigkeit.marktfaehig is False


def test_die_marktfaehigkeit_nennt_ihre_quelle(tmp_path: Path) -> None:
    quelle = katalog(DATEN, tmp_path).art("steinpilz").marktfaehigkeit.quelle

    assert quelle.url.startswith("https://www.dgfm-ev.de/")
    assert quelle.geprueft_am == "2026-05-01"


def test_die_masse_kommen_aus_der_quellseite(tmp_path: Path) -> None:
    masse = katalog(DATEN, tmp_path).art("steinpilz").masse

    assert masse.hut_breite_cm is not None
    assert (masse.hut_breite_cm.von, masse.hut_breite_cm.bis) == (4.0, 20.0)
    assert masse.hut_breite_cm.selten_bis == 25.0
    assert masse.sporen_laenge_um is not None


def test_jede_haeufigkeit_und_gefaehrdung_ist_ein_enumwert() -> None:
    for profil in profile_lesen(DATEN / "arten").values():
        assert profil.haeufigkeit is None or isinstance(profil.haeufigkeit, Haeufigkeit)
        assert profil.gefaehrdung is None or isinstance(profil.gefaehrdung, Gefaehrdung)


def test_kein_weiterer_name_wiederholt_den_hauptnamen() -> None:
    for slug, profil in profile_lesen(DATEN / "arten").items():
        assert profil.name not in profil.weitere_namen, slug
        assert profil.lateinisch not in profil.synonyme, slug


async def test_das_profil_liefert_die_zahlen_der_quelle() -> None:
    async with klient(app_bauen()) as ruf:
        antwort = await ruf.get("/api/arten/steinpilz")

    koerper = antwort.json()
    assert koerper["marktfaehigkeit"]["marktfaehig"] is True
    assert koerper["wertigkeit"] == 1
    assert koerper["masse"]["hutBreiteCm"] == {"von": 4.0, "bis": 20.0, "seltenBis": 25.0}
    assert "Herrenpilz" in koerper["weitereNamen"]
    assert koerper["quelle"]["url"].startswith("https://www.123pilzsuche.de/")
