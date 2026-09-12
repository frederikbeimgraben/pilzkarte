"""Der Artenkatalog: Stufen, Saisonkurve, Profile und die zwei Endpunkte.

Die Fixture haelt drei erfundene Arten mit runden Zahlen. So laesst sich jeder
Prozentwert im Kopf nachrechnen: 30 von 100 Begehungen sind 30 Prozent.
"""

import json
import re
import tomllib
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.core.errors import NotFound
from app.main import build_app
from app.modules.species.catalog import (
    DATA,
    EDIBILITY_TEXT,
    PROTECTION_TEXT,
    Catalog,
    SpeciesFilter,
    build_relations,
    build_tags,
    build_traits,
    catalog,
    check_names,
    check_references,
    colour_names,
    covers_month,
    find_maps,
    forecast_planned,
    mean_per_week,
    month_of_week,
    peak_months,
    peak_week_of,
    read_profiles,
    read_season,
    share_per_week,
    tier_for,
)
from app.modules.species.router import current_catalog
from app.modules.species.schemas import (
    BEST_RATING,
    MONTHS,
    WEAKEST_RATING,
    WEEKS,
    CapFeature,
    CapMargin,
    CapShape,
    ChangeSpeed,
    Colour,
    ColourChange,
    Development,
    Edibility,
    Frequency,
    GillAttachment,
    GillEdge,
    GillSpacing,
    Hymenophore,
    HymenophoreKind,
    Lookalike,
    Period,
    Profile,
    ProtectionStatus,
    Range,
    Reagent,
    ReagentEntry,
    RedListStatus,
    SeasonCurve,
    SeasonTable,
    Species,
    StemFeature,
    Tier,
    TraitKey,
    TreeSource,
    TreeSpecies,
    Unit,
)

# Die drei Arten der Fixture: eine mit Karte und vielen Begehungen, eine
# knapp ueber der Saisonschwelle, eine ganz ohne Zeile in der Tabelle.
PENNY_BUN = """
name = "Steinpilz"
lateinisch = "Boletus edulis"
gruppe = "roehrling"
speisewert = "essbar"
jahreszeiten = ["herbst"]
baeume = ["fichte", "buche"]
karte = "boletus_edulis"
speisewertHinweis = "Jung sammeln."
schutzHinweis = "Auch die Verwandten schont man."

[schutz]
status = "besondersGeschuetzt"
quelle = "Bundesartenschutzverordnung, Anlage 1"

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
slug = "gallenroehrling"
unterschied = "Bitter."
eigenerUnterschied = "Mild."

[[links]]
titel = "Wikipedia"
url = "https://de.wikipedia.org/wiki/Gemeiner_Steinpilz"
"""

ST_GEORGES = """
name = "Maipilz"
lateinisch = "Calocybe gambosa"
gruppe = "ritterling"
speisewert = "essbar"
jahreszeiten = ["fruehling"]
baeume = []

[schutz]
status = "keiner"
quelle = "Bundesartenschutzverordnung, Anlage 1"

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
slug = "gallenroehrling"
unterschied = "Roehren rosa, Geschmack bitter."

[[links]]
titel = "Wikipedia"
url = "https://de.wikipedia.org/wiki/Maipilz"
"""

SAFFRON_MILKCAP = """
name = "Braetling"
lateinisch = "Lactarius volemus"
gruppe = "milchling"
speisewert = "essbar"
jahreszeiten = ["sommer"]
baeume = ["buche"]

[schutz]
status = "besondersGeschuetzt"
quelle = "Bundesartenschutzverordnung, Anlage 1"

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
slug = "steinpilz"
unterschied = "Mit Roehren statt Lamellen, ohne Milch."

[[links]]
titel = "Wikipedia"
url = "https://de.wikipedia.org/wiki/Br%C3%A4tling"
"""


BITTER_BOLETE = """
name = "Gallenroehrling"
lateinisch = "Tylopilus felleus"
gruppe = "roehrling"
speisewert = "ungeniessbar"
sammelbar = false
jahreszeiten = ["sommer", "herbst"]
baeume = ["fichte"]

[schutz]
status = "keiner"
quelle = "Bundesartenschutzverordnung, Anlage 1"

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

[[links]]
titel = "123pilzsuche.de"
url = "https://www.123pilzsuche.de/daten/details/Gallenroehrling.htm"
"""


def _series_of(settings: dict[int, int]) -> list[int]:
    """Eine Wochenreihe aus wenigen gesetzten Wochen, alles andere null."""
    series = [0] * WEEKS
    for week, value in settings.items():
        series[week - 1] = value
    return series


def _table() -> dict[str, Any]:
    return {
        "standJahr": 2026,
        "standWoche": 3,
        "vonJahr": 2015,
        "bisJahr": 2025,
        "minArten": 2,
        "begehungenJeWoche": _series_of({1: 100, 2: 200, 40: 400}),
        "begehungenJeWocheLaufendesJahr": _series_of({1: 50, 2: 100, 3: 0, 40: 900}),
        "arten": {
            "Boletus edulis": {
                "begehungenMitFund": 700,
                "fundeJeWoche": _series_of({1: 10, 2: 20, 40: 200}),
                "fundeJeWocheLaufendesJahr": _series_of({1: 20, 2: 5, 40: 900}),
            },
            "Calocybe gambosa": {
                "begehungenMitFund": 60,
                "fundeJeWoche": _series_of({2: 50}),
                "fundeJeWocheLaufendesJahr": _series_of({}),
            },
        },
    }


@pytest.fixture
def data(tmp_path: Path) -> Path:
    """Legt einen Datenordner mit drei Profilen und einer Saisontabelle an."""
    folder = tmp_path / "daten"
    (folder / "arten").mkdir(parents=True)
    for slug, content in [
        ("steinpilz", PENNY_BUN),
        ("maipilz", ST_GEORGES),
        ("braetling", SAFFRON_MILKCAP),
        ("gallenroehrling", BITTER_BOLETE),
    ]:
        (folder / "arten" / f"{slug}.toml").write_text(content, encoding="utf-8")
    (folder / "saison.json").write_text(json.dumps(_table()), encoding="utf-8")
    return folder


@pytest.fixture
def maps(tmp_path: Path) -> Path:
    """Legt genau ein Manifest an, so wie die Kette es rendert."""
    folder = tmp_path / "maps"
    folder.mkdir()
    (folder / "boletus_edulis.json").write_text("{}", encoding="utf-8")
    return folder


@pytest.fixture
def built(data: Path, maps: Path) -> Catalog:
    return catalog(data, maps)


@pytest.fixture
def app(built: Catalog) -> FastAPI:
    """Die App mit dem Katalog der Fixture statt dem der ausgelieferten Dateien."""
    built_app = build_app()
    built_app.dependency_overrides[current_catalog] = lambda: built
    return built_app


def curve_of(built: Catalog, slug: str) -> SeasonCurve:
    """Die Kurve einer sammelbaren Art. Fehlt sie, liegt der Test falsch."""
    season = built.species(slug).season
    assert season is not None
    return season


def client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


# ------------------------------------------------------------------ Rechnen


@pytest.mark.parametrize(
    ("visits", "expected"),
    [
        (0, Tier.PROFILE),
        (59, Tier.PROFILE),
        (60, Tier.SEASON),
        (599, Tier.SEASON),
        # Ohne Karte bleibt auch eine Art mit Modell auf der Stufe Saison.
        (600, Tier.SEASON),
        (5000, Tier.SEASON),
    ],
)
def test_the_tier_without_a_map_follows_the_visits(visits: int, expected: Tier) -> None:
    assert tier_for(visits, has_map=False) == expected


@pytest.mark.parametrize("visits", [0, 59, 600, 5000])
def test_a_map_makes_the_tier_forecast(visits: int) -> None:
    assert tier_for(visits, has_map=True) == Tier.FORECAST


@pytest.mark.parametrize("visits", [0, 59, 599])
def test_below_the_threshold_no_forecast_is_planned(visits: int) -> None:
    assert forecast_planned(visits) is False


@pytest.mark.parametrize("visits", [600, 5000])
def test_at_the_threshold_a_forecast_is_planned(visits: int) -> None:
    assert forecast_planned(visits) is True


def test_share_gives_percent_and_avoids_zero_division() -> None:
    assert share_per_week([10, 1, 0], [100, 3, 0]) == [10.0, 33.3, 0.0]


def test_the_peak_week_is_one_based() -> None:
    assert peak_week_of([1.0, 5.0, 2.0]) == 2


def test_the_peak_week_is_missing_without_a_find() -> None:
    assert peak_week_of([0.0, 0.0]) is None


# ------------------------------------------------------------------ Katalog


def test_the_listing_carries_every_species_by_name(built: Catalog) -> None:
    listing = built.listing(only_collectable=None)

    assert [species.name for species in listing.species] == [
        "Braetling",
        "Gallenroehrling",
        "Maipilz",
        "Steinpilz",
    ]


def test_the_listing_names_as_of_years_and_denominator(built: Catalog) -> None:
    listing = built.listing()

    assert listing.as_of.year == 2026
    assert listing.as_of.week == 3
    assert (listing.years.start, listing.years.end) == (2015, 2025)
    assert listing.visits == 700


def test_tiers_come_from_map_and_table(built: Catalog) -> None:
    levels = {
        species.slug: species.tier for species in built.listing(only_collectable=None).species
    }

    assert levels == {
        "steinpilz": Tier.FORECAST,
        "maipilz": Tier.SEASON,
        "braetling": Tier.PROFILE,
        "gallenroehrling": Tier.PROFILE,
    }


def test_without_a_manifest_the_species_stays_on_season(data: Path, tmp_path: Path) -> None:
    empty = tmp_path / "ungerendert"
    empty.mkdir()
    built = catalog(data, empty)

    penny_bun = built.species("steinpilz")

    # 700 Begehungen mit Fund, aber kein Manifest: das Modell traegt, die
    # Karte fehlt. Der Chip "mit Vorhersage" darf die Art darum nicht zeigen.
    assert penny_bun.visits_with_find == 700
    assert penny_bun.map_slug is None
    assert penny_bun.tier == Tier.SEASON
    assert penny_bun.forecast_planned is True


def test_forecast_planned_appears_in_listing_and_profile(built: Catalog) -> None:
    planned = {
        species.slug: species.forecast_planned
        for species in built.listing(only_collectable=None).species
    }

    assert planned == {
        "steinpilz": True,
        "maipilz": False,
        "braetling": False,
        "gallenroehrling": False,
    }
    assert built.species("steinpilz").forecast_planned is True


def test_the_tier_follows_the_map_even_without_visits(data: Path, tmp_path: Path) -> None:
    maps = tmp_path / "frisch"
    maps.mkdir()
    (maps / "braetling.json").write_text("{}", encoding="utf-8")
    built = catalog(data, maps)

    saffron_milkcap = built.species("braetling")

    assert saffron_milkcap.tier == Tier.FORECAST
    assert saffron_milkcap.forecast_planned is False


def test_a_species_without_a_table_row_shows_no_curve(built: Catalog) -> None:
    species = built.species("braetling")

    # Eine Kurve aus lauter Nullen behauptet eine Messung, die es nicht gibt.
    assert species.visits_with_find == 0
    assert species.peak_week is None
    assert species.season is None


def test_the_season_curve_computes_both_series(built: Catalog) -> None:
    curve = curve_of(built, "steinpilz")

    # 10 von 100, 20 von 200, 200 von 400 Begehungen der geschlossenen Jahre.
    assert curve.all_years[0] == 10.0
    assert curve.all_years[1] == 10.0
    assert curve.all_years[39] == 50.0
    # 20 von 50 und 5 von 100 Begehungen des laufenden Jahres.
    assert curve.current_year == [40.0, 5.0, 0.0]


def test_the_current_year_ends_at_the_last_full_week(built: Catalog) -> None:
    curve = curve_of(built, "steinpilz")

    assert len(curve.current_year) == 3
    assert len(curve.all_years) == WEEKS


def test_the_maximum_covers_both_series(built: Catalog) -> None:
    curve = curve_of(built, "steinpilz")

    assert curve.maximum == 50.0
    assert max(curve.current_year) <= curve.maximum


def test_the_mean_divides_by_the_closed_years() -> None:
    assert mean_per_week([110, 55, 0], 11) == [10.0, 5.0, 0.0]


def test_the_listing_names_the_visits_per_week(built: Catalog) -> None:
    listing = built.listing()

    # Elf geschlossene Jahre, 2015 bis 2025: 100 Begehungen in KW 1 sind 9,1 je Jahr.
    assert listing.visits_per_week_all_years[0] == 9.1
    assert listing.visits_per_week_all_years[1] == 18.2
    assert listing.visits_per_week_all_years[39] == 36.4
    assert listing.visits_per_week_current_year == [50, 100, 0]


def test_the_profile_names_the_visits_per_week(built: Catalog) -> None:
    curve = curve_of(built, "steinpilz")

    assert curve.visits_per_week_all_years[0] == 9.1
    assert curve.visits_per_week_current_year == [50, 100, 0]


def test_the_visits_of_the_current_year_end_with_the_curve(built: Catalog) -> None:
    curve = curve_of(built, "steinpilz")

    assert len(curve.visits_per_week_current_year) == len(curve.current_year)
    assert len(curve.visits_per_week_all_years) == len(curve.all_years) == WEEKS


def test_a_thin_week_shows_in_its_denominator(built: Catalog) -> None:
    curve = curve_of(built, "steinpilz")

    # KW 3 traegt 0 Prozent, aber auch keine einzige Begehung. Das Frontend
    # zeichnet sie darum blass statt als Absturz der Linie.
    assert curve.current_year[2] == 0.0
    assert curve.visits_per_week_current_year[2] == 0


def test_the_peak_week_points_at_the_best_calendar_week(built: Catalog) -> None:
    assert built.species("steinpilz").peak_week == 40


def test_tags_start_with_the_tier(built: Catalog) -> None:
    species = built.species("steinpilz")

    assert species.tags == ["vorhersage", "roehrling", "herbst", "fichte", "buche"]


def test_a_map_appears_only_with_a_manifest(built: Catalog) -> None:
    maps = {
        species.slug: species.map_slug for species in built.listing(only_collectable=None).species
    }

    assert maps == {
        "steinpilz": "boletus_edulis",
        "maipilz": None,
        "braetling": None,
        "gallenroehrling": None,
    }


def test_the_map_falls_back_to_the_slug(data: Path, tmp_path: Path) -> None:
    maps = tmp_path / "spaeter"
    maps.mkdir()
    (maps / "maipilz.json").write_text("{}", encoding="utf-8")
    profiles = read_profiles(data / "arten")

    assert find_maps(profiles, maps) == {"maipilz": "maipilz"}


def test_an_unknown_slug_is_an_error(built: Catalog) -> None:
    with pytest.raises(NotFound):
        built.species("gibt-es-nicht")


def test_a_species_without_a_row_in_the_table_carries_no_curve(built: Catalog) -> None:
    gall = built.species("gallenroehrling")

    assert gall.tier == Tier.PROFILE
    assert gall.collectable is False
    assert gall.season is None
    assert gall.peak_week is None
    assert gall.map_slug is None


def test_the_curve_follows_the_table_not_the_flag(built: Catalog) -> None:
    species = {species.slug: species for species in built.listing(only_collectable=None).species}

    assert {slug: row.collectable for slug, row in species.items()} == {
        "steinpilz": True,
        "maipilz": True,
        "braetling": True,
        "gallenroehrling": False,
    }
    # Der Braetling ist sammelbar und steht trotzdem nicht in der Tabelle.
    assert {slug: row.season is not None for slug, row in species.items()} == {
        "steinpilz": True,
        "maipilz": True,
        "braetling": False,
        "gallenroehrling": False,
    }


def test_a_lookalike_links_its_own_profile(built: Catalog) -> None:
    gall = built.species("gallenroehrling")
    row = next(row for row in gall.lookalikes if row.slug == "steinpilz")

    assert built.species(row.slug).name == "Steinpilz"


def test_a_species_that_is_not_collectable_has_no_map() -> None:
    base = tomllib.loads(BITTER_BOLETE)
    base["karte"] = "gallenroehrling"

    with pytest.raises(ValidationError, match="keine Karte"):
        Profile.model_validate(base)


# ------------------------------------------------------------------ Merkmale


def test_traits_follow_the_order_of_the_species_page(built: Catalog) -> None:
    key = [line.key for line in built.species("steinpilz").traits]

    assert key == [
        TraitKey.CAP,
        TraitKey.TUBES,
        TraitKey.STEM,
        TraitKey.FLESH,
        TraitKey.SMELL,
        TraitKey.TASTE,
        TraitKey.SPORE_PRINT,
        TraitKey.HABITAT,
        TraitKey.SEASON,
        TraitKey.EDIBILITY,
        TraitKey.PROTECTION,
    ]


def test_edibility_and_protection_carry_the_note(built: Catalog) -> None:
    lines = {line.key: line.text for line in built.species("steinpilz").traits}

    assert lines[TraitKey.EDIBILITY] == "Essbar. Jung sammeln."
    special = PROTECTION_TEXT[ProtectionStatus.SPECIAL]
    assert lines[TraitKey.PROTECTION] == f"{special} Auch die Verwandten schont man."


def test_without_protection_the_second_sentence_stands(built: Catalog) -> None:
    lines = {line.key: line.text for line in built.species("maipilz").traits}

    assert lines[TraitKey.PROTECTION] == PROTECTION_TEXT[ProtectionStatus.NONE]
    assert lines[TraitKey.EDIBILITY] == "Essbar."


def test_every_edibility_has_a_sentence(built: Catalog) -> None:
    profile = built.profiles["maipilz"]

    for value in Edibility:
        patched = profile.model_copy(update={"edibility": value})
        lines = {line.key: line.text for line in build_traits(patched)}
        assert lines[TraitKey.EDIBILITY]


# ------------------------------------------------------------------ Dateien


def test_reagents_appear_as_a_row_in_the_table(built: Catalog) -> None:
    lines = {line.key: line.text for line in built.species("gallenroehrling").traits}

    assert lines[TraitKey.REAGENTS] == (
        "Kalilauge (KOH): Fleisch braeunt. Melzers Reagenz: Ohne Reaktion."
    )


def test_the_reagent_row_follows_the_spore_print(built: Catalog) -> None:
    key = [line.key for line in built.species("gallenroehrling").traits]

    assert key.index(TraitKey.SPORE_PRINT) + 1 == key.index(TraitKey.REAGENTS)


def test_without_reagents_the_row_is_missing(built: Catalog) -> None:
    key = [line.key for line in built.species("steinpilz").traits]

    assert TraitKey.REAGENTS not in key


def test_every_reagent_has_a_name(built: Catalog) -> None:
    profile = built.profiles["gallenroehrling"]

    for value in Reagent:
        patched = profile.model_copy(
            update={"reagents": [ReagentEntry(reagent=value, reaction="x")]}
        )
        lines = {line.key: line.text for line in build_traits(patched)}
        assert lines[TraitKey.REAGENTS].endswith(": x")


def test_a_profile_forbids_an_empty_row() -> None:
    base = _profile_base()
    base["merkmale"]["hut"] = "   "

    with pytest.raises(ValidationError, match="leer"):
        Profile.model_validate(base)


def test_a_profile_does_not_set_the_reagent_row_itself() -> None:
    base = _profile_base()
    base["merkmale"]["reagenzien"] = "KOH braun."

    with pytest.raises(ValidationError, match="reagenzien"):
        Profile.model_validate(base)


def test_a_profile_forbids_an_unknown_field() -> None:
    with pytest.raises(ValidationError):
        Profile.model_validate({**_profile_base(), "farbe": "gelb"})


def test_a_profile_requires_the_mandatory_rows() -> None:
    base = _profile_base()
    del base["merkmale"]["zeit"]

    with pytest.raises(ValidationError, match="zeit"):
        Profile.model_validate(base)


def test_a_profile_does_not_set_edibility_itself() -> None:
    base = _profile_base()
    base["merkmale"]["speisewert"] = "Speisepilz."

    with pytest.raises(ValidationError, match="speisewert"):
        Profile.model_validate(base)


def test_the_season_table_requires_a_closed_previous_year() -> None:
    with pytest.raises(ValidationError, match="geschlossene Jahr"):
        SeasonTable.model_validate({**_table(), "bisJahr": 2020})


def test_the_season_table_requires_a_non_empty_range() -> None:
    with pytest.raises(ValidationError, match="leer"):
        SeasonTable.model_validate(
            {**_table(), "vonJahr": 2030, "bisJahr": 2025, "standJahr": 2026}
        )


def test_the_season_table_requires_fiftytwo_weeks() -> None:
    with pytest.raises(ValidationError):
        SeasonTable.model_validate({**_table(), "begehungenJeWoche": [1, 2, 3]})


def test_read_season_reads_the_file(data: Path) -> None:
    table = read_season(data / "saison.json")

    assert table.as_of_week == 3


def _profile_base() -> dict[str, Any]:
    return tomllib.loads(ST_GEORGES)


# ------------------------------------------------------------------ Endpunkte


async def test_the_listing_answers_in_camel_case(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "stand",
        "jahre",
        "begehungen",
        "begehungenJeWocheAlleJahre",
        "begehungenJeWocheLaufendesJahr",
        "arten",
    }
    first_one = next(row for row in body["arten"] if row["slug"] == "steinpilz")
    assert set(first_one) == {
        "slug",
        "name",
        "lateinisch",
        "gruppe",
        "stufe",
        "tags",
        "schutz",
        "speisewert",
        "kartenSlug",
        "sammelbar",
        "marktfaehigkeit",
        "wertigkeit",
        "haeufigkeit",
        "gefaehrdung",
        "warnung",
        "jahreszeiten",
        "baeume",
        "baeumeAusErfahrung",
        "weitereNamen",
        "synonyme",
        "vorhersageGeplant",
        "begehungenMitFund",
        "spitzeWoche",
        "saison",
    }
    assert set(first_one["saison"]) == {"alleJahre", "laufendesJahr", "hoechstwert"}
    # Beide Reihen, wie im Profil: die Zeile zeichnet dieselbe Kurve, nur kleiner.
    penny_bun = next(species for species in body["arten"] if species["slug"] == "steinpilz")
    assert penny_bun["saison"]["laufendesJahr"] == [40.0, 5.0, 0.0]


async def test_the_profile_answers_with_table_and_curve(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten/steinpilz")

    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "steinpilz"
    assert body["kartenSlug"] == "boletus_edulis"
    assert body["merkmale"][0] == {"schluessel": "hut", "text": "Braun."}
    assert body["verwechslungen"] == [
        {
            "slug": "braetling",
            "name": "Braetling",
            "lateinisch": "Lactarius volemus",
            "unterschied": None,
            "speisewert": "essbar",
            "warnung": None,
        },
        {
            "slug": "gallenroehrling",
            "name": "Gallenroehrling",
            "lateinisch": "Tylopilus felleus",
            "unterschied": "Bitter.",
            "speisewert": "ungeniessbar",
            "warnung": None,
        },
    ]
    assert body["links"][0]["url"].startswith("https://")
    assert set(body["saison"]) == {
        "alleJahre",
        "laufendesJahr",
        "hoechstwert",
        "jahre",
        "stand",
        "begehungen",
        "begehungenJeWocheAlleJahre",
        "begehungenJeWocheLaufendesJahr",
    }
    assert body["saison"]["laufendesJahr"] == [40.0, 5.0, 0.0]


async def test_an_unknown_slug_is_problem_json(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten/gibt-es-nicht")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "not_found"
    assert "gibt-es-nicht" in response.json()["detail"]


async def test_the_listing_needs_no_token(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten")

    assert response.status_code == 200


# ------------------------------------------------------- die echten Profile


def test_every_shipped_profile_is_valid() -> None:
    profiles = read_profiles(DATA / "arten")

    assert len(profiles) == 306
    assert sum(1 for profile in profiles.values() if profile.collectable) == 85


def test_every_species_of_the_chain_has_a_profile() -> None:
    profiles = read_profiles(DATA / "arten")
    table = read_season(DATA / "saison.json")

    collectable = {p.scientific for p in profiles.values() if p.collectable}
    assert collectable == set(table.species)


def _chain_maps(target: Path) -> Path:
    """Legt die Manifeste an, die die Kette heute gerendert hat.

    Die echten Manifeste liegen unter ``PILZE_MAPS`` und nicht im Git. Welche
    es gibt, sagt das Feld ``karte`` der Profile: es steht genau dort, wo die
    Kette schon eine Karte abgelegt hat.
    """
    target.mkdir(parents=True, exist_ok=True)
    for profile in read_profiles(DATA / "arten").values():
        if profile.map_name:
            (target / f"{profile.map_name}.json").write_text("{}", encoding="utf-8")
    return target


def test_the_tiers_follow_the_rendered_maps(tmp_path: Path) -> None:
    built = catalog(DATA, _chain_maps(tmp_path / "maps"))
    levels = [species.tier for species in built.listing().species]

    assert levels.count(Tier.FORECAST) == 13
    assert levels.count(Tier.SEASON) == 52
    assert levels.count(Tier.PROFILE) == 20


def test_the_thirteen_species_with_a_map_are_named(tmp_path: Path) -> None:
    built = catalog(DATA, _chain_maps(tmp_path / "maps"))
    with_map = sorted(
        species.slug for species in built.listing().species if species.tier == Tier.FORECAST
    )

    assert with_map == [
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


def test_twentythree_species_carry_a_model(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    # Die Zahl aus konzept.html: 600 Begehungen mit Fund seit 2015. Sie haengt
    # nicht daran, ob die Kette die Karte schon gerendert hat.
    assert sum(1 for species in built.listing().species if species.forecast_planned) == 23


def test_every_slug_is_an_address() -> None:
    for slug in read_profiles(DATA / "arten"):
        assert slug == slug.lower()
        assert set(slug) <= set("abcdefghijklmnopqrstuvwxyz-")


def test_protected_species_name_the_collecting_rule(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)
    protected = [
        species
        for species in built.listing().species
        if species.protection.status is not ProtectionStatus.NONE
    ]

    assert len(protected) >= 18
    for brief in protected:
        lines = {line.key: line.text for line in built.species(brief.slug).traits}
        assert lines[TraitKey.PROTECTION].startswith(PROTECTION_TEXT[brief.protection.status])


def test_penny_bun_and_chanterelle_are_protected(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    assert built.species("steinpilz").protection.status is ProtectionStatus.SPECIAL
    assert built.species("pfifferling").protection.status is ProtectionStatus.SPECIAL
    assert built.is_protected("steinpilz")
    assert built.is_protected("pfifferling")


async def test_the_service_reads_the_shipped_files() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/arten/steinpilz")

    assert response.status_code == 200
    assert response.json()["lateinisch"] == "Boletus edulis"


# ------------------------------------------------- die geprueften Profile


def test_every_profile_names_its_source() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        assert profile.source is not None, slug
        assert profile.source.url.startswith("https://www.123pilzsuche.de/"), slug
        assert profile.source.checked_on == "2026-09-12", slug


def test_every_lookalike_carries_a_slug_and_a_difference() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        for lookalike in profile.lookalikes:
            assert lookalike.slug.strip(), slug
            assert lookalike.difference.strip(), slug
            assert lookalike.own_difference is None or lookalike.own_difference.strip(), slug


def test_no_trait_and_no_note_is_empty() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        for text in profile.traits.values():
            assert text.strip(), slug
        assert profile.name.strip(), slug
        assert profile.scientific.strip(), slug
        for note in (profile.edibility_note, profile.protection_note):
            assert note is None or note.strip(), slug


def test_every_lookalike_points_at_a_profile() -> None:
    profiles = read_profiles(DATA / "arten")

    for slug, profile in profiles.items():
        for lookalike in profile.lookalikes:
            assert lookalike.slug in profiles, f"{slug} zeigt auf {lookalike.slug}"


# Welche Merkmalszeile der Quellseite welche Fruchtschicht bedeutet. Die
# Zeile ist die Quelle, nicht die Gattung: eine Seite mit einer Zeile
# "Poren" nennt Poren, auch wenn andere Porlinge Roehren tragen.
HYMENOPHORE_ROWS = {
    TraitKey.GILLS: HymenophoreKind.GILLS,
    TraitKey.TUBES: HymenophoreKind.TUBES,
    TraitKey.PORES: HymenophoreKind.PORES,
    TraitKey.SPINES: HymenophoreKind.SPINES,
    TraitKey.FOLDS: HymenophoreKind.FOLDS,
}


def test_the_hymenophore_follows_the_trait_row() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        if profile.hymenophore is None:
            continue
        rows = [HYMENOPHORE_ROWS[key] for key in profile.traits if key in HYMENOPHORE_ROWS]
        assert rows == [profile.hymenophore.kind], slug


def test_one_profile_names_a_hymenophore_the_vocabulary_has_no_word_for() -> None:
    # Der Gezonte Ohrlappenpilz traegt eine aderig-faltige Unterseite. Keiner
    # der fuenf Werte trifft das, also bleibt das Feld leer statt geraten.
    without = {
        slug
        for slug, profile in read_profiles(DATA / "arten").items()
        if profile.hymenophore is None and any(key in HYMENOPHORE_ROWS for key in profile.traits)
    }

    assert without == {"gezonter-ohrlappenpilz"}


def test_no_cap_field_without_a_cap_row() -> None:
    # Wer keinen Hut hat, hat auch keine Hutform. Ein Wert dort waere eine
    # Behauptung ueber etwas, das die Art nicht hat.
    for slug, profile in read_profiles(DATA / "arten").items():
        if TraitKey.CAP in profile.traits or TraitKey.FRUITBODY in profile.traits:
            continue
        assert profile.cap_shape is None, slug
        assert profile.cap_features == [], slug
        assert profile.cap_margin is None, slug


def test_no_stem_feature_without_a_stem_row() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        if TraitKey.STEM in profile.traits:
            continue
        assert profile.stem_features == [], slug


def test_the_source_pages_fill_the_four_fields() -> None:
    # Was ein Durchgang durch die 305 Quellseiten hergibt. Die Zahlen stehen
    # hier, damit ein spaeterer Lauf sieht, was er verliert.
    profiles = read_profiles(DATA / "arten").values()

    filled = {
        "fruchtschicht": sum(profile.hymenophore is not None for profile in profiles),
        "ansatz": sum(
            profile.hymenophore is not None and profile.hymenophore.attachment is not None
            for profile in profiles
        ),
        "stand": sum(
            profile.hymenophore is not None and profile.hymenophore.spacing is not None
            for profile in profiles
        ),
        "schneide": sum(
            profile.hymenophore is not None and profile.hymenophore.edge is not None
            for profile in profiles
        ),
        "hutform": sum(profile.cap_shape is not None for profile in profiles),
        "hutmerkmale": sum(bool(profile.cap_features) for profile in profiles),
        "hutrand": sum(profile.cap_margin is not None for profile in profiles),
        "stielmerkmale": sum(bool(profile.stem_features) for profile in profiles),
    }

    assert filled == {
        "fruchtschicht": 273,
        "ansatz": 157,
        "stand": 63,
        "schneide": 27,
        "hutform": 94,
        "hutmerkmale": 94,
        "hutrand": 142,
        "stielmerkmale": 217,
    }


def test_a_stem_may_be_solid_when_young_and_hollow_when_old() -> None:
    # "Jung voll, spaeter hohl" sind zwei Aussagen, keine widerspruechliche.
    # Die flache Liste kann sie nicht ordnen, aber sie darf keine verschweigen.
    # Die Reihenfolge traegt erst die Spalte "phase" aus R4b.
    both = {
        slug
        for slug, profile in read_profiles(DATA / "arten").items()
        if {StemFeature.HOLLOW, StemFeature.SOLID} <= set(profile.stem_features)
    }

    assert both == {
        "falscher-wiesenegerling",
        "grauer-leistling",
        "huegelschwindling",
        "kegelhuetiger-knollenblaetterpilz",
        "koenigsfliegenpilz",
        "maggipilz",
        "olivfarbener-frauentaeubling",
        "verbogener-leistling",
    }


def test_no_file_carries_a_name_or_edibility_in_a_lookalike() -> None:
    # Der Umbau ist nur fertig, wenn die doppelten Felder wirklich weg sind.
    allowed = {"slug", "unterschied", "eigenerUnterschied"}

    for path in sorted((DATA / "arten").glob("*.toml")):
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
        for lookalike in raw.get("verwechslungen", []):
            assert set(lookalike) <= allowed, f"{path.stem}: {sorted(lookalike)}"


def test_the_collectable_species_stay_eightyfive() -> None:
    profiles = read_profiles(DATA / "arten")

    assert sum(1 for profile in profiles.values() if profile.collectable) == 85


def test_a_species_nobody_collects_carries_no_curve_and_no_map(tmp_path: Path) -> None:
    built = catalog(DATA, _chain_maps(tmp_path / "maps"))
    species = {species.slug: species for species in built.listing(only_collectable=None).species}
    profiles = read_profiles(DATA / "arten")

    for slug, profile in profiles.items():
        if profile.collectable:
            assert species[slug].season is not None, slug
        else:
            assert species[slug].tier == Tier.PROFILE, slug
            assert species[slug].season is None, slug
            assert species[slug].map_slug is None, slug


def test_every_profile_links_its_source_page() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        title = [link.title for link in profile.links]
        assert title[0] == "123pilzsuche.de", slug
        assert title[1:] in ([], ["Wikipedia"]), slug
        assert profile.links[0].url == (profile.source.url if profile.source else ""), slug


# ------------------------------------------------- Zahlen und Listen der Quelle


def test_a_range_runs_from_small_to_large() -> None:
    range_ = Range(start=4, end=20, rare_from=2, rare_until=25, unit=Unit.CM)

    assert (range_.start, range_.end, range_.rare_until) == (4, 20, 25)
    assert (range_.rare_from, range_.unit) == (2, Unit.CM)


def test_a_reversed_range_is_no_measurement() -> None:
    with pytest.raises(ValidationError, match="unter"):
        Range(start=20, end=4, unit=Unit.CM)


def test_the_exceptional_value_lies_above_the_upper_bound() -> None:
    with pytest.raises(ValidationError, match="Ausnahmewert"):
        Range(start=4, end=20, rare_until=10, unit=Unit.CM)


def test_the_exceptional_value_lies_below_the_lower_bound() -> None:
    with pytest.raises(ValidationError, match="Ausnahmewert"):
        Range(start=4, end=20, rare_from=6, unit=Unit.CM)


def test_a_measurement_carries_its_unit() -> None:
    for name, measurement in read_profiles(DATA / "arten")["steinpilz"].measurements:
        if measurement is not None:
            assert measurement.unit in set(Unit), name


def test_the_rating_stays_on_the_scale_of_one_to_six() -> None:
    for profile in read_profiles(DATA / "arten").values():
        if profile.rating is not None:
            assert BEST_RATING <= profile.rating <= WEAKEST_RATING


def test_marketable_follows_the_dgfm_positive_list(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    # Der Steinpilz steht auf der Liste, der Gruene Knollenblaetterpilz nicht.
    assert built.species("steinpilz").marketability.marketable is True
    assert built.species("gruener-knollenblaetterpilz").marketability.marketable is False


def test_marketability_carries_no_source_of_its_own(tmp_path: Path) -> None:
    species = catalog(DATA, tmp_path).species("steinpilz")

    # Die Zeile "Relativer Speisewert" steht auf derselben Seite wie der Rest.
    assert "source" not in type(species.marketability).model_fields
    assert species.source.url.startswith("https://www.123pilzsuche.de/")


def test_the_measurements_come_from_the_source_page(tmp_path: Path) -> None:
    measurements = catalog(DATA, tmp_path).species("steinpilz").measurements

    assert measurements.cap_width_cm is not None
    assert (measurements.cap_width_cm.start, measurements.cap_width_cm.end) == (4.0, 20.0)
    assert measurements.cap_width_cm.rare_until == 25.0
    assert measurements.spore_length_um is not None


def test_every_frequency_and_red_list_status_is_an_enum_value() -> None:
    for profile in read_profiles(DATA / "arten").values():
        assert profile.frequency is None or isinstance(profile.frequency, Frequency)
        assert profile.red_list is None or isinstance(profile.red_list, RedListStatus)


def test_no_other_name_repeats_the_main_name() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        assert profile.name not in profile.other_names, slug
        assert profile.scientific not in profile.synonyms, slug


async def test_the_profile_returns_the_numbers_of_the_source() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/arten/steinpilz")

    body = response.json()
    assert body["marktfaehigkeit"]["marktfaehig"] is True
    assert body["wertigkeit"] == 1
    assert body["masse"]["hutBreiteCm"] == {
        "von": 4.0,
        "bis": 20.0,
        "seltenVon": None,
        "seltenBis": 25.0,
        "einheit": "cm",
        "beschreibung": None,
    }
    assert "Herrenpilz" in body["weitereNamen"]
    assert body["quelle"]["url"].startswith("https://www.123pilzsuche.de/")


# ------------------------------------------------- Auswahl und Vollstaendigkeit

# Was in der Datei steht, geht auch hinaus. Wo ein Feld draussen anders heisst
# oder in einer Zeile der Merkmalstabelle aufgeht, sagt es diese Zuordnung.
PROFILE_FIELD_ON_THE_WIRE: dict[str, str | None] = {
    "map_name": "map_slug",
    "marketable": "marketability",
    "marketable_switzerland": "marketability",
    "edibility_note": None,
    "protection_note": None,
}


def test_every_field_of_the_file_reaches_the_response() -> None:
    response_fields = set(Species.model_fields)

    for field in Profile.model_fields:
        target = PROFILE_FIELD_ON_THE_WIRE.get(field, field)
        if target is None:
            continue
        assert target in response_fields, f"{field} fehlt in der Antwort"


def test_the_mapping_names_only_fields_of_the_file() -> None:
    assert set(PROFILE_FIELD_ON_THE_WIRE) <= set(Profile.model_fields)


def test_the_listing_shows_only_collectable_ones_without_a_parameter(built: Catalog) -> None:
    species = built.listing().species

    assert [species.slug for species in species] == ["braetling", "maipilz", "steinpilz"]
    assert all(species.collectable for species in species)


def test_the_listing_shows_the_lookalike_species_on_request(built: Catalog) -> None:
    species = built.listing(only_collectable=False).species

    assert [species.slug for species in species] == ["gallenroehrling"]
    assert not any(species.collectable for species in species)


def test_the_listing_shows_all_on_request(built: Catalog) -> None:
    assert len(built.listing(only_collectable=None).species) == 4


async def test_the_endpoint_returns_the_collectable_ones_without_a_parameter(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten")

    slugs = [species["slug"] for species in response.json()["arten"]]
    assert slugs == ["braetling", "maipilz", "steinpilz"]


async def test_the_endpoint_returns_the_others_with_collectable_false(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten", params={"sammelbar": "false"})

    assert [species["slug"] for species in response.json()["arten"]] == ["gallenroehrling"]


async def test_the_endpoint_returns_both_groups_with_all(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten", params={"alle": "true", "sammelbar": "false"})

    assert len(response.json()["arten"]) == 4


async def test_the_real_listing_shows_eightyfive_species() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/arten")

    assert len(response.json()["arten"]) == 85


async def test_the_real_listing_knows_all_threehundredsix() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/arten", params={"alle": "true"})

    assert len(response.json()["arten"]) == 306


# ------------------------------------------------- Baeume, Warnung, Reagenzien


def test_trees_from_experience_stand_beside_the_documented_ones(tmp_path: Path) -> None:
    species = catalog(DATA, tmp_path).species("maronenroehrling")

    assert species.trees_from_experience is not None
    assert species.trees_from_experience.source == "eigene Erfahrung"
    assert TreeSpecies.SPRUCE in species.trees_from_experience.trees
    assert TreeSpecies.SPRUCE not in species.trees


def test_both_tree_lists_become_chips(tmp_path: Path) -> None:
    species = catalog(DATA, tmp_path).species("maronenroehrling")

    assert TreeSpecies.SPRUCE in species.tags


def test_a_tree_appears_only_once_in_the_chips() -> None:
    profile = Profile.model_validate(
        {
            **_profile_base(),
            "baeume": ["fichte"],
            "baeumeAusErfahrung": {"baeume": ["fichte", "buche"], "quelle": "eigene Erfahrung"},
        }
    )

    assert build_tags(profile, Tier.SEASON).count(TreeSpecies.SPRUCE) == 1


def test_trees_from_experience_need_their_source() -> None:
    with pytest.raises(ValidationError):
        TreeSource(trees=[TreeSpecies.SPRUCE], source="123pilzsuche")


def test_trees_from_experience_are_never_empty() -> None:
    with pytest.raises(ValidationError):
        TreeSource(trees=[], source="eigene Erfahrung")


def test_a_poisonous_collectable_species_needs_a_warning() -> None:
    with pytest.raises(ValidationError, match="Warnung"):
        Profile.model_validate({**_profile_base(), "speisewert": "giftig"})


def test_a_poisonous_lookalike_species_needs_no_warning() -> None:
    profile = Profile.model_validate(
        {**_profile_base(), "speisewert": "toedlichGiftig", "sammelbar": False}
    )

    assert profile.warning is None


def test_the_poisonous_species_of_the_chain_warn(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)
    poisonous = {Edibility.POISONOUS, Edibility.DEADLY}

    warned = [species.slug for species in built.listing().species if species.edibility in poisonous]
    assert sorted(warned) == [
        "erdritterling",
        "nebelkappe",
        "rosablaettriger-egerlingsschirmling",
    ]
    for slug in warned:
        assert built.species(slug).warning


def test_reagents_also_appear_as_their_own_field(built: Catalog) -> None:
    species = built.species("gallenroehrling")

    assert [entry.reagent for entry in species.reagents] == [Reagent.KOH, Reagent.MELZER]


def test_the_new_reagents_and_trees_are_in_the_enum() -> None:
    assert {Reagent.FECL3, Reagent.WIELAND} <= set(Reagent)
    assert {
        TreeSpecies.BLACK_LOCUST,
        TreeSpecies.YEW,
        TreeSpecies.LABURNUM,
        TreeSpecies.BILBERRY,
        TreeSpecies.HOLM_OAK,
    } <= set(TreeSpecies)


async def test_the_profile_returns_marketability_and_measurements() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/arten/steinpilz")

    body = response.json()
    assert body["marktfaehigkeit"] == {"marktfaehig": True, "schweiz": True}
    assert body["quelle"]["url"].startswith("https://www.123pilzsuche.de/")
    assert body["baeume"]
    assert set(body) >= {
        "marktfaehigkeit",
        "wertigkeit",
        "haeufigkeit",
        "gefaehrdung",
        "reagenzien",
        "masse",
        "weitereNamen",
        "synonyme",
        "sammelbar",
        "warnung",
        "jahreszeiten",
        "baeume",
        "baeumeAusErfahrung",
    }


# ------------------------------------------------- Hut und Stiel


def test_a_shape_may_change_with_age() -> None:
    # Das Kuhmaul ist jung gewoelbt und alt verflacht. Ein Wert traegt das nicht.
    shape = Development[CapShape].model_validate({"von": "gewoelbt", "nach": "flach"})

    assert shape.start is CapShape.CONVEX
    assert shape.end is CapShape.FLAT


def test_a_shape_that_stays_names_no_second_value() -> None:
    shape = Development[CapShape].model_validate({"von": "muschelfoermig"})

    assert shape.end is None


def test_the_margin_carries_several_values_per_phase() -> None:
    margin = Development[list[CapMargin]].model_validate(
        {"von": ["eingerollt"], "nach": ["wellig", "gerissen"]}
    )

    assert margin.start == [CapMargin.INROLLED]
    assert margin.end == [CapMargin.WAVY, CapMargin.CRACKED]


def test_every_shape_of_the_source_has_a_value() -> None:
    # Die Liste ist gezaehlt, nicht erfunden: dreizehn Umrisse aus 305 Seiten.
    assert len(CapShape) == 13
    assert CapShape.SHELL in CapShape
    # Was kein Umriss ist, steht nicht darin.
    assert "gebuckelt" not in {shape.value for shape in CapShape}
    assert CapFeature.UMBONATE.value == "gebuckelt"


def test_a_multiple_choice_is_a_list_not_a_string() -> None:
    # Im Zielmodell wird daraus eine Kindtabelle mit einer Zeile je Wert.
    profile = Profile.model_validate(
        {
            **tomllib.loads(PENNY_BUN),
            "stielmerkmale": ["genetzt", "voll"],
            "hutmerkmale": ["gebuckelt"],
        }
    )

    assert profile.stem_features == [StemFeature.NETTED, StemFeature.SOLID]
    assert profile.cap_features == [CapFeature.UMBONATE]


def test_an_unknown_stem_feature_is_refused() -> None:
    with pytest.raises(ValidationError):
        Profile.model_validate({**tomllib.loads(PENNY_BUN), "stielmerkmale": ["gestreift"]})


def test_the_shape_filter_finds_both_phases(built: Catalog) -> None:
    penny_bun = built.profiles["steinpilz"].model_copy(
        update={
            "cap_shape": Development[CapShape](start=CapShape.HEMISPHERICAL, end=CapShape.CONVEX)
        }
    )
    catalogue = replace(built, profiles={**built.profiles, "steinpilz": penny_bun})

    for wanted in (CapShape.HEMISPHERICAL, CapShape.CONVEX):
        listing = catalogue.listing(only_collectable=None, chosen=SpeciesFilter(cap_shape=wanted))
        assert [species.slug for species in listing.species] == ["steinpilz"], wanted

    other = catalogue.listing(only_collectable=None, chosen=SpeciesFilter(cap_shape=CapShape.BELL))
    assert other.species == []


def test_the_margin_filter_finds_both_phases(built: Catalog) -> None:
    penny_bun = built.profiles["steinpilz"].model_copy(
        update={
            "cap_margin": Development[list[CapMargin]](
                start=[CapMargin.INROLLED], end=[CapMargin.WAVY]
            )
        }
    )
    catalogue = replace(built, profiles={**built.profiles, "steinpilz": penny_bun})

    for wanted in (CapMargin.INROLLED, CapMargin.WAVY):
        listing = catalogue.listing(only_collectable=None, chosen=SpeciesFilter(cap_margin=wanted))
        assert [species.slug for species in listing.species] == ["steinpilz"], wanted


def test_the_feature_filters_narrow_the_listing(built: Catalog) -> None:
    penny_bun = built.profiles["steinpilz"].model_copy(
        update={"cap_features": [CapFeature.UMBONATE], "stem_features": [StemFeature.NETTED]}
    )
    catalogue = replace(built, profiles={**built.profiles, "steinpilz": penny_bun})

    for chosen in (
        SpeciesFilter(cap_feature=CapFeature.UMBONATE),
        SpeciesFilter(stem_feature=StemFeature.NETTED),
    ):
        listing = catalogue.listing(only_collectable=None, chosen=chosen)
        assert [species.slug for species in listing.species] == ["steinpilz"], chosen

    without = catalogue.listing(
        only_collectable=None, chosen=SpeciesFilter(stem_feature=StemFeature.VOLVA)
    )
    assert without.species == []


async def test_the_endpoint_takes_the_new_filters(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get(
            "/api/arten",
            params={
                "alle": "true",
                "hutform": "gewoelbt",
                "hutmerkmal": "gebuckelt",
                "hutrand": "eingerollt",
                "stielmerkmal": "genetzt",
            },
        )

    assert response.status_code == 200


async def test_the_new_fields_reach_the_wire(app: FastAPI) -> None:
    async with client(app) as call:
        body = (await call.get("/api/arten/steinpilz")).json()

    assert set(body) >= {"hutform", "hutmerkmale", "hutrand", "stielmerkmale"}
    assert body["hutmerkmale"] == []
    assert body["stielmerkmale"] == []


# ------------------------------------------------- Die Fruchtschicht


def test_gills_carry_attachment_spacing_and_edge() -> None:
    layer = Hymenophore.model_validate(
        {"art": "lamellen", "ansatz": "frei", "stand": "eng", "schneide": "glatt"}
    )

    assert layer.kind is HymenophoreKind.GILLS
    assert layer.attachment is GillAttachment.FREE
    assert layer.spacing is GillSpacing.CLOSE
    assert layer.edge is GillEdge.SMOOTH


def test_tubes_carry_none_of_the_three() -> None:
    # Roehren haben keinen Ansatz am Stiel. Ein Wert dort waere eine
    # Behauptung ueber etwas, das die Art nicht hat.
    with pytest.raises(ValidationError, match="Nur Lamellen tragen ansatz"):
        Hymenophore.model_validate({"art": "roehren", "ansatz": "frei"})


def test_spines_carry_no_spacing() -> None:
    with pytest.raises(ValidationError, match="stand"):
        Hymenophore.model_validate({"art": "stacheln", "stand": "eng"})


def test_the_kind_alone_is_enough() -> None:
    assert Hymenophore.model_validate({"art": "leisten"}).attachment is None


def test_a_profile_without_the_layer_stays_empty(built: Catalog) -> None:
    # Die Quellseite nennt sie noch nicht; geraten wird nichts.
    assert built.species("braetling").hymenophore is None


def test_the_layer_reaches_the_wire(built: Catalog) -> None:
    penny_bun = built.profiles["steinpilz"].model_copy(
        update={"hymenophore": Hymenophore(kind=HymenophoreKind.TUBES)}
    )
    catalogue = replace(built, profiles={**built.profiles, "steinpilz": penny_bun})

    assert catalogue.species("steinpilz").hymenophore == Hymenophore(kind=HymenophoreKind.TUBES)


def test_the_filter_narrows_to_one_layer(built: Catalog) -> None:
    gills = built.profiles["maipilz"].model_copy(
        update={"hymenophore": Hymenophore(kind=HymenophoreKind.GILLS)}
    )
    catalogue = replace(built, profiles={**built.profiles, "maipilz": gills})
    chosen = SpeciesFilter(hymenophore=HymenophoreKind.GILLS)

    listing = catalogue.listing(only_collectable=None, chosen=chosen)

    assert [species.slug for species in listing.species] == ["maipilz"]


def test_the_filter_reaches_attachment_spacing_and_edge(built: Catalog) -> None:
    gills = built.profiles["maipilz"].model_copy(
        update={
            "hymenophore": Hymenophore(
                kind=HymenophoreKind.GILLS,
                attachment=GillAttachment.FREE,
                spacing=GillSpacing.CLOSE,
                edge=GillEdge.SMOOTH,
            )
        }
    )
    catalogue = replace(built, profiles={**built.profiles, "maipilz": gills})

    for chosen in (
        SpeciesFilter(attachment=GillAttachment.FREE),
        SpeciesFilter(spacing=GillSpacing.CLOSE),
        SpeciesFilter(edge=GillEdge.SMOOTH),
    ):
        listing = catalogue.listing(only_collectable=None, chosen=chosen)
        assert [species.slug for species in listing.species] == ["maipilz"], chosen

    without = catalogue.listing(
        only_collectable=None, chosen=SpeciesFilter(attachment=GillAttachment.DECURRENT)
    )
    assert without.species == []


async def test_the_endpoint_takes_the_layer_filter(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get(
            "/api/arten", params={"alle": "true", "fruchtschicht": "lamellen"}
        )

    assert response.status_code == 200


def test_no_shipped_profile_breaks_the_rule() -> None:
    # Ein Ansatz an Roehren faellt hier auf und nicht erst in der Oberflaeche.
    for slug, profile in read_profiles(DATA / "arten").items():
        layer = profile.hymenophore
        if layer is None or layer.kind is HymenophoreKind.GILLS:
            continue
        assert (layer.attachment, layer.spacing, layer.edge) == (None, None, None), slug


# ------------------------------------------------- Die beobachtete Hauptzeit


def test_a_week_belongs_to_its_month() -> None:
    assert month_of_week(0) == 1
    assert month_of_week(WEEKS - 1) == MONTHS
    assert month_of_week(WEEKS // 2) == 7
    # Woche 31 beginnt Ende Juli und liegt in der Mitte schon im August.
    assert month_of_week(30) == 8


def test_the_peak_months_are_the_weeks_above_half_the_year() -> None:
    shares = [0.0] * WEEKS
    for week in range(30, 40):
        shares[week] = 10.0
    shares[20] = 2.0

    months = peak_months(shares)

    assert months is not None
    assert (months.start_month, months.end_month) == (8, 10)


def test_a_peak_may_cross_the_turn_of_the_year() -> None:
    # Der Samtfussruebling faende sonst zwei Zeiten statt einer.
    shares = [0.0] * WEEKS
    for week in [*range(48, WEEKS), *range(6)]:
        shares[week] = 10.0

    months = peak_months(shares)

    assert months is not None
    assert (months.start_month, months.end_month) == (12, 2)


def test_a_curve_without_a_find_has_no_peak() -> None:
    assert peak_months([0.0] * WEEKS) is None


def test_the_longest_stretch_wins() -> None:
    shares = [0.0] * WEEKS
    shares[5] = 10.0
    for week in range(20, 26):
        shares[week] = 10.0

    months = peak_months(shares)

    assert months is not None
    assert (months.start_month, months.end_month) == (5, 6)


def test_the_profile_names_the_observed_period(built: Catalog) -> None:
    # Der Steinpilz der Vorrichtung wird in Woche 40 am haeufigsten gefunden.
    observed = built.species("steinpilz").observed_period

    assert observed is not None
    assert (observed.start_month, observed.end_month) == (10, 10)


def test_a_species_without_a_curve_names_no_observed_period(built: Catalog) -> None:
    assert built.species("braetling").observed_period is None


async def test_the_observed_period_reaches_the_wire(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten/steinpilz")

    assert response.json()["beobachteterZeitraum"] == {"vonMonat": 10, "bisMonat": 10}


# ------------------------------------------------- Stufen der Essbarkeit


def test_the_levels_name_the_danger_not_the_taste() -> None:
    # Sehr gut, gut und minderwertig sind Bewertungen. Sie stehen als
    # Wertigkeit im Profil und waeren hier eine zweite Skala im selben Feld.
    assert [level.value for level in Edibility] == [
        "essbar",
        "bedingtEssbar",
        "ungeniessbar",
        "giftig",
        "toedlichGiftig",
    ]


def test_every_level_carries_a_sentence() -> None:
    assert set(EDIBILITY_TEXT) == set(Edibility)


def test_the_word_essbar_hides_inside_ungeniessbar() -> None:
    # Wer die Kopfzeile der Quellseite nach "ESSBAR" durchsucht, findet sie
    # auch in "UNGENIESSBAR". Die zwei Stufen bleiben getrennte Werte.
    assert Edibility.EDIBLE.value in Edibility.INEDIBLE.value
    assert Edibility.EDIBLE is not Edibility.INEDIBLE


def test_the_filter_narrows_the_listing(built: Catalog) -> None:
    chosen = SpeciesFilter(edibility=Edibility.INEDIBLE)
    listing = built.listing(only_collectable=None, chosen=chosen)

    assert [species.slug for species in listing.species] == ["gallenroehrling"]


def test_the_filter_holds_together_with_the_collectable_flag(built: Catalog) -> None:
    chosen = SpeciesFilter(edibility=Edibility.INEDIBLE)

    assert built.listing(only_collectable=True, chosen=chosen).species == []


async def test_the_endpoint_takes_the_edibility_filter(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get(
            "/api/arten", params={"alle": "true", "speisewert": "ungeniessbar"}
        )

    assert response.status_code == 200
    assert [row["slug"] for row in response.json()["arten"]] == ["gallenroehrling"]


async def test_a_level_outside_the_enum_is_rejected(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten", params={"speisewert": "lecker"})

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_the_real_listing_filters_by_level() -> None:
    async with client(build_app()) as call:
        deadly = await call.get(
            "/api/arten", params={"alle": "true", "speisewert": "toedlichGiftig"}
        )
        edible = await call.get("/api/arten", params={"alle": "true", "speisewert": "essbar"})

    assert len(deadly.json()["arten"]) == 21
    assert len(edible.json()["arten"]) == 180
    assert all(row["speisewert"] == "toedlichGiftig" for row in deadly.json()["arten"])


def test_every_level_stands_in_the_catalog() -> None:
    profiles = read_profiles(DATA / "arten")

    assert {profile.edibility for profile in profiles.values()} == set(Edibility)


# ------------------------------------------------- Verweise statt Kopien


def test_a_reference_without_a_target_is_caught_when_loading(data: Path) -> None:
    profiles = read_profiles(data / "arten")
    profiles["steinpilz"] = profiles["steinpilz"].model_copy(
        update={"lookalikes": [Lookalike(slug="gibt-es-nicht", difference="x")]}
    )

    with pytest.raises(ValueError, match="gibt-es-nicht"):
        check_references(profiles)


def test_the_check_runs_when_the_catalog_is_built(data: Path, tmp_path: Path) -> None:
    broken = tmp_path / "kaputt"
    (broken / "arten").mkdir(parents=True)
    for file in (data / "arten").glob("*.toml"):
        (broken / "arten" / file.name).write_text(
            file.read_text(encoding="utf-8").replace(
                'slug = "gallenroehrling"', 'slug = "gibt-es-nicht"'
            ),
            encoding="utf-8",
        )
    (broken / "saison.json").write_text(
        (data / "saison.json").read_text(encoding="utf-8"), encoding="utf-8"
    )

    with pytest.raises(ValueError, match="ohne gueltiges Ziel"):
        catalog(broken, tmp_path / "leer")


def test_a_resolved_lookalike_shows_the_profile_of_its_target(built: Catalog) -> None:
    reference = built.species("steinpilz").lookalikes[0]
    target = built.species(reference.slug)

    assert reference.name == target.name
    assert reference.scientific == target.scientific
    assert reference.edibility == target.edibility
    assert reference.warning == target.warning


def test_the_difference_belongs_to_the_pair(built: Catalog) -> None:
    # Derselbe Gallenroehrling, zwei Arten, zwei Saetze.
    from_boletus = next(
        row for row in built.species("steinpilz").lookalikes if row.slug == "gallenroehrling"
    )
    from_maipilz = next(
        row for row in built.species("maipilz").lookalikes if row.slug == "gallenroehrling"
    )

    assert from_boletus.difference != from_maipilz.difference


def test_the_pair_reaches_both_species(built: Catalog) -> None:
    # Der Datensatz steht beim Steinpilz. Der Gallenroehrling zeigt ihn auch.
    from_boletus = next(
        row for row in built.species("steinpilz").lookalikes if row.slug == "gallenroehrling"
    )
    from_gall = next(
        row for row in built.species("gallenroehrling").lookalikes if row.slug == "steinpilz"
    )

    assert from_boletus.difference == "Bitter."
    assert from_gall.difference == "Mild."


def test_a_pair_without_a_second_sentence_still_reaches_back(built: Catalog) -> None:
    # Der Braetling nennt den Steinpilz, der Steinpilz nichts zum Braetling.
    from_boletus = next(
        row for row in built.species("steinpilz").lookalikes if row.slug == "braetling"
    )

    assert from_boletus.difference is None


def test_a_pair_stands_in_one_file_only(data: Path) -> None:
    profiles = read_profiles(data / "arten")
    profiles["gallenroehrling"] = profiles["gallenroehrling"].model_copy(
        update={"lookalikes": [Lookalike(slug="steinpilz", difference="Mild.")]}
    )

    with pytest.raises(ValueError, match="zweimal"):
        check_references(profiles)


def test_a_species_is_no_lookalike_of_itself(data: Path) -> None:
    profiles = read_profiles(data / "arten")
    profiles["steinpilz"] = profiles["steinpilz"].model_copy(
        update={"lookalikes": [Lookalike(slug="steinpilz", difference="x")]}
    )

    with pytest.raises(ValueError, match="ohne gueltiges Ziel"):
        check_references(profiles)


def test_the_same_pair_twice_in_one_file_is_refused() -> None:
    with pytest.raises(ValidationError, match="doppelt"):
        Profile.model_validate(
            {
                **tomllib.loads(PENNY_BUN),
                "verwechslungen": [
                    {"slug": "gallenroehrling", "unterschied": "a"},
                    {"slug": "gallenroehrling", "unterschied": "b"},
                ],
            }
        )


def test_every_pair_of_the_catalog_stands_once() -> None:
    profiles = read_profiles(DATA / "arten")

    check_references(profiles)

    relations = build_relations(profiles)
    records = sum(len(profile.lookalikes) for profile in profiles.values())
    assert sum(len(rows) for rows in relations.values()) == 2 * records


def test_no_species_stands_twice_in_the_catalog() -> None:
    check_names(read_profiles(DATA / "arten"))


def test_a_second_file_for_the_same_species_is_caught(data: Path) -> None:
    profiles = read_profiles(data / "arten")
    profiles["steinpilz-zweitname"] = profiles["steinpilz"]

    with pytest.raises(ValueError, match="Lateinischer Name Boletus edulis"):
        check_names(profiles)


def test_two_files_with_the_same_german_name_are_caught(data: Path) -> None:
    profiles = read_profiles(data / "arten")
    profiles["zwilling"] = profiles["steinpilz"].model_copy(
        update={"scientific": "Boletus separatus"}
    )

    with pytest.raises(ValueError, match="Name Steinpilz"):
        check_names(profiles)


def test_the_name_check_runs_when_the_catalog_is_built(data: Path, tmp_path: Path) -> None:
    doubled = tmp_path / "doppelt"
    (doubled / "arten").mkdir(parents=True)
    for file in (data / "arten").glob("*.toml"):
        (doubled / "arten" / file.name).write_text(
            file.read_text(encoding="utf-8"), encoding="utf-8"
        )
    (doubled / "arten" / "steinpilz-zweitname.toml").write_text(PENNY_BUN, encoding="utf-8")
    (doubled / "saison.json").write_text(
        (data / "saison.json").read_text(encoding="utf-8"), encoding="utf-8"
    )

    with pytest.raises(ValueError, match="doppelt im Katalog"):
        catalog(doubled, tmp_path / "leer")


async def test_the_profile_answers_with_both_directions(app: FastAPI) -> None:
    async with client(app) as call:
        answer = await call.get("/api/arten/gallenroehrling")

    body = answer.json()
    assert [row["slug"] for row in body["verwechslungen"]] == ["maipilz", "steinpilz"]
    assert set(body["verwechslungen"][0]) == {
        "slug",
        "name",
        "lateinisch",
        "unterschied",
        "speisewert",
        "warnung",
    }


# ------------------------------------------------- Strukturierte Felder


def test_the_period_reads_months_from_the_sentence(tmp_path: Path) -> None:
    period = catalog(DATA, tmp_path).species("steinpilz").period

    assert period is not None
    assert (period.start_month, period.end_month) == (6, 11)


def test_a_period_may_cross_the_turn_of_the_year(tmp_path: Path) -> None:
    period = catalog(DATA, tmp_path).species("samtfussruebling").period

    assert period is not None
    assert period.start_month > period.end_month
    assert covers_month(period, 12)
    assert covers_month(period, 3)
    assert not covers_month(period, 8)


def test_a_period_inside_one_year_covers_only_its_months() -> None:
    period = Period(start_month=6, end_month=9)

    assert covers_month(period, 7)
    assert not covers_month(period, 3)


def test_a_month_outside_the_calendar_is_no_month() -> None:
    with pytest.raises(ValidationError):
        Period(start_month=0, end_month=9)


def test_the_colours_carry_a_name_and_a_value(tmp_path: Path) -> None:
    colours = catalog(DATA, tmp_path).species("steinpilz").colours

    assert colours.cap
    for colour in colours.cap:
        assert colour.name.strip()
        assert re.fullmatch(r"#[0-9a-f]{6}", colour.hex)


def test_a_colour_needs_a_hex_value() -> None:
    with pytest.raises(ValidationError):
        Colour(name="braun", hex="braun")


def test_a_colour_change_names_its_target(tmp_path: Path) -> None:
    change = catalog(DATA, tmp_path).species("flockenstieliger-hexenroehrling").colours.change

    assert change is not None
    assert [colour.name for colour in change.end] == ["blau"]
    assert change.speed is ChangeSpeed.FAST


def test_a_colour_change_without_a_stated_speed_stays_empty() -> None:
    change = ColourChange(start=[], end=[Colour(name="rot", hex="#c0392b")])

    assert change.speed is None


def test_smell_and_taste_carry_tags_and_the_sentence(tmp_path: Path) -> None:
    boletus = catalog(DATA, tmp_path).species("steinpilz")

    assert "pilzig" in boletus.smell.tags
    assert "mild" in boletus.taste.tags
    assert boletus.smell.text


def test_a_negated_word_is_no_tag() -> None:
    # "nicht mehlartig" beim Erdritterling darf kein Schlagwort mehlig setzen.
    profiles = read_profiles(DATA / "arten")

    assert "mehlig" not in profiles["erdritterling"].smell.tags


def test_the_protection_status_names_its_source(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    boletus = built.species("steinpilz").protection
    parasol = built.species("parasol").protection
    assert boletus is not None
    assert parasol is not None
    assert boletus.status is ProtectionStatus.SPECIAL
    assert parasol.status is ProtectionStatus.NONE
    assert boletus.source.startswith("Bundesartenschutzverordnung")


def test_the_protection_status_is_the_only_place(tmp_path: Path) -> None:
    # Ein Schalter "geschuetzt" neben dem Status waere eine zweite Wahrheit,
    # und er koennte "streng" nicht von "fuer den Eigenbedarf" trennen.
    assert "protected" not in Profile.model_fields
    assert "protected" not in Species.model_fields

    built = catalog(DATA, tmp_path)
    for slug, profile in built.profiles.items():
        assert built.is_protected(slug) is profile.protection.restricted, slug


def test_every_measurement_of_every_profile_carries_a_unit() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        for name, measurement in profile.measurements:
            if measurement is not None:
                assert measurement.unit in set(Unit), f"{slug}: {name}"


# ------------------------------------------------- Filter


@pytest.mark.parametrize(
    ("chosen", "expected"),
    [
        (SpeciesFilter(smell="anisartig"), {"riesenchampignon", "schafchampignon"}),
        (SpeciesFilter(tree="laerche"), {"goldroehrling"}),
        (SpeciesFilter(protection=ProtectionStatus.SPECIAL), {"steinpilz", "pfifferling"}),
    ],
)
def test_a_filter_narrows_the_listing(
    tmp_path: Path, chosen: SpeciesFilter, expected: set[str]
) -> None:
    slugs = {species.slug for species in catalog(DATA, tmp_path).listing(chosen=chosen).species}

    assert expected <= slugs
    assert len(slugs) < 85


def test_filters_hold_together(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)
    both = built.listing(chosen=SpeciesFilter(tree="fichte", month=9))
    only_tree = built.listing(chosen=SpeciesFilter(tree="fichte"))

    assert 0 < len(both.species) <= len(only_tree.species)


def test_an_empty_filter_changes_nothing(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    assert len(built.listing(chosen=SpeciesFilter()).species) == len(built.listing().species)


def test_a_filter_without_a_hit_stays_empty(tmp_path: Path) -> None:
    chosen = SpeciesFilter(smell="anisartig", taste="brennend")

    assert catalog(DATA, tmp_path).listing(chosen=chosen).species == []


def test_the_colour_filter_looks_at_every_part(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)
    names = colour_names(built.species("steinpilz").colours)

    assert "olivbraun" in names
    slugs = {s.slug for s in built.listing(chosen=SpeciesFilter(colour="olivbraun")).species}
    assert "steinpilz" in slugs


async def test_the_endpoint_takes_every_filter() -> None:
    async with client(build_app()) as call:
        answer = await call.get(
            "/api/arten",
            params={
                "geruch": "anisartig",
                "monat": "9",
                "baum": "",
                "schutz": "keiner",
                "speisewert": "essbar",
            },
        )

    assert answer.status_code == 200


async def test_a_month_outside_the_calendar_is_rejected() -> None:
    async with client(build_app()) as call:
        answer = await call.get("/api/arten", params={"monat": "13"})

    assert answer.status_code == 422
    assert answer.headers["content-type"].startswith("application/problem+json")


async def test_the_tree_filter_answers_over_the_wire() -> None:
    async with client(build_app()) as call:
        body = (await call.get("/api/arten", params={"baum": "laerche"})).json()

    slugs = [species["slug"] for species in body["arten"]]
    assert "goldroehrling" in slugs
    assert len(slugs) < 85
