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

from app.core.errors import NotFound
from app.main import build_app
from app.modules.species.catalog import (
    DATA,
    PROTECTED_TEXT,
    UNPROTECTED_TEXT,
    Catalog,
    build_tags,
    build_traits,
    catalog,
    find_maps,
    forecast_planned,
    mean_per_week,
    peak_week_of,
    read_profiles,
    read_season,
    share_per_week,
    tier_for,
)
from app.modules.species.router import current_catalog
from app.modules.species.schemas import (
    BEST_RATING,
    WEAKEST_RATING,
    WEEKS,
    Edibility,
    Frequency,
    Profile,
    Range,
    Reagent,
    ReagentEntry,
    RedListStatus,
    SeasonCurve,
    SeasonTable,
    Species,
    Tier,
    TraitKey,
    TreeSource,
    TreeSpecies,
)

# Die drei Arten der Fixture: eine mit Karte und vielen Begehungen, eine
# knapp ueber der Saisonschwelle, eine ganz ohne Zeile in der Tabelle.
PENNY_BUN = """
name = "Steinpilz"
lateinisch = "Boletus edulis"
gruppe = "roehrling"
speisewert = "guterSpeisepilz"
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

ST_GEORGES = """
name = "Maipilz"
lateinisch = "Calocybe gambosa"
gruppe = "ritterling"
speisewert = "guterSpeisepilz"
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

SAFFRON_MILKCAP = """
name = "Braetling"
lateinisch = "Lactarius volemus"
gruppe = "milchling"
speisewert = "guterSpeisepilz"
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


BITTER_BOLETE = """
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
essbar = "guterSpeisepilz"
slug = "steinpilz"

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
        "gallenroehrling": Tier.LOOKALIKE,
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


def test_species_without_a_table_row_stays_empty(built: Catalog) -> None:
    species = built.species("braetling")
    curve = curve_of(built, "braetling")

    assert species.visits_with_find == 0
    assert species.peak_week is None
    assert curve.maximum == 0.0
    assert set(curve.all_years) == {0.0}


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


def test_a_lookalike_species_carries_no_season_curve(built: Catalog) -> None:
    gall = built.species("gallenroehrling")

    assert gall.tier == Tier.LOOKALIKE
    assert gall.collectable is False
    assert gall.season is None
    assert gall.peak_week is None
    assert gall.map_slug is None


def test_collectable_species_carry_the_curve(built: Catalog) -> None:
    collectable = {
        species.slug: species.collectable
        for species in built.listing(only_collectable=None).species
    }

    assert collectable == {
        "steinpilz": True,
        "maipilz": True,
        "braetling": True,
        "gallenroehrling": False,
    }
    assert all(
        species.season is not None
        for species in built.listing(only_collectable=None).species
        if species.collectable
    )
    assert all(
        species.season is None
        for species in built.listing(only_collectable=None).species
        if not species.collectable
    )


def test_a_lookalike_links_its_own_profile(built: Catalog) -> None:
    gall = built.species("gallenroehrling")

    assert gall.lookalikes[0].slug == "steinpilz"
    assert built.species(gall.lookalikes[0].slug or "").name == "Steinpilz"


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

    assert lines[TraitKey.EDIBILITY] == "Guter Speisepilz. Jung sammeln."
    assert lines[TraitKey.PROTECTION] == f"{PROTECTED_TEXT} Auch die Verwandten schont man."


def test_without_protection_the_second_sentence_stands(built: Catalog) -> None:
    lines = {line.key: line.text for line in built.species("maipilz").traits}

    assert lines[TraitKey.PROTECTION] == UNPROTECTED_TEXT
    assert lines[TraitKey.EDIBILITY] == "Guter Speisepilz."


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
    first_one = body["arten"][0]
    assert set(first_one) == {
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
        "marktfaehigSchweiz",
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
            "name": "Gallenroehrling",
            "merkmal": "Bitter.",
            "essbar": "ungeniessbar",
            "slug": None,
        }
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

    assert len(profiles) == 309
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
    protected = [species for species in built.listing().species if species.protected]

    assert len(protected) >= 18
    for brief in protected:
        lines = {line.key: line.text for line in built.species(brief.slug).traits}
        assert lines[TraitKey.PROTECTION].startswith(PROTECTED_TEXT)


def test_penny_bun_and_chanterelle_are_protected(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    assert built.species("steinpilz").protected
    assert built.species("pfifferling").protected


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
        assert profile.source.checked_on == "2026-09-10", slug


def test_every_lookalike_carries_a_name_and_a_trait() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        for lookalike in profile.lookalikes:
            assert lookalike.name.strip(), slug
            assert lookalike.trait.strip(), slug


def test_no_trait_and_no_note_is_empty() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        for text in profile.traits.values():
            assert text.strip(), slug
        assert profile.name.strip(), slug
        assert profile.scientific.strip(), slug
        for note in (profile.edibility_note, profile.protection_note):
            assert note is None or note.strip(), slug


def test_every_lookalike_slug_points_at_a_profile() -> None:
    profiles = read_profiles(DATA / "arten")

    for slug, profile in profiles.items():
        for lookalike in profile.lookalikes:
            if lookalike.slug is not None:
                assert lookalike.slug in profiles, f"{slug} zeigt auf {lookalike.slug}"


def test_the_edibility_of_a_lookalike_matches_its_profile() -> None:
    # Sonst stuende dieselbe Art auf zwei Seiten mit zwei Urteilen.
    profiles = read_profiles(DATA / "arten")

    for slug, profile in profiles.items():
        for lookalike in profile.lookalikes:
            if lookalike.slug is not None:
                target = profiles[lookalike.slug]
                assert lookalike.edible == target.edibility, f"{slug} zu {lookalike.slug}"


def test_the_collectable_species_stay_eightyfive() -> None:
    profiles = read_profiles(DATA / "arten")

    assert sum(1 for profile in profiles.values() if profile.collectable) == 85


def test_lookalike_species_carry_the_lookalike_tier(tmp_path: Path) -> None:
    built = catalog(DATA, _chain_maps(tmp_path / "maps"))
    species = {species.slug: species for species in built.listing(only_collectable=None).species}
    profiles = read_profiles(DATA / "arten")

    for slug, profile in profiles.items():
        if not profile.collectable:
            assert species[slug].tier == Tier.LOOKALIKE, slug
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
    range_ = Range(start=4, end=20, rare_until=25)

    assert (range_.start, range_.end, range_.rare_until) == (4, 20, 25)


def test_a_reversed_range_is_no_measurement() -> None:
    with pytest.raises(ValidationError, match="unter"):
        Range(start=20, end=4)


def test_the_exceptional_value_lies_above_the_upper_bound() -> None:
    with pytest.raises(ValidationError, match="Ausnahmewert"):
        Range(start=4, end=20, rare_until=10)


def test_the_rating_stays_on_the_scale_of_one_to_six() -> None:
    for profile in read_profiles(DATA / "arten").values():
        if profile.rating is not None:
            assert BEST_RATING <= profile.rating <= WEAKEST_RATING


def test_marketable_follows_the_dgfm_positive_list(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    # Der Steinpilz steht auf der Liste, der Gruene Knollenblaetterpilz nicht.
    assert built.species("steinpilz").marketability.marketable is True
    assert built.species("gruener-knollenblaetterpilz").marketability.marketable is False


def test_marketability_names_its_source(tmp_path: Path) -> None:
    species = catalog(DATA, tmp_path).species("steinpilz")

    # Die Zeile "Relativer Speisewert" steht auf der Artseite selbst.
    assert species.marketability.source == species.source
    assert species.marketability.source.url.startswith("https://www.123pilzsuche.de/")


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
    assert body["masse"]["hutBreiteCm"] == {"von": 4.0, "bis": 20.0, "seltenBis": 25.0}
    assert "Herrenpilz" in body["weitereNamen"]
    assert body["quelle"]["url"].startswith("https://www.123pilzsuche.de/")


# ------------------------------------------------- Auswahl und Vollstaendigkeit

# Was in der Datei steht, geht auch hinaus. Wo ein Feld draussen anders heisst
# oder in einer Zeile der Merkmalstabelle aufgeht, sagt es diese Zuordnung.
PROFILE_FIELD_ON_THE_WIRE: dict[str, str | None] = {
    "map_name": "map_slug",
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


async def test_the_real_listing_knows_all_threehundrednine() -> None:
    async with client(build_app()) as call:
        response = await call.get("/api/arten", params={"alle": "true"})

    assert len(response.json()["arten"]) == 309


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
    assert body["marktfaehig"] is True
    assert body["marktfaehigkeit"]["quelle"]["url"].startswith("https://www.123pilzsuche.de/")
    assert body["marktfaehigSchweiz"] is True
    assert body["baeume"]
    assert set(body) >= {
        "marktfaehig",
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
