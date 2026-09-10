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
    WEEKS,
    Edibility,
    Profile,
    SeasonTable,
    Tier,
    TraitKey,
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


def _series(settings: dict[int, int]) -> list[int]:
    """Eine Wochenreihe aus wenigen gesetzten Wochen, alles andere null."""
    reihe = [0] * WEEKS
    for week, value in settings.items():
        reihe[week - 1] = value
    return reihe


def _table() -> dict[str, Any]:
    return {
        "standJahr": 2026,
        "standWoche": 3,
        "vonJahr": 2015,
        "bisJahr": 2025,
        "minArten": 2,
        "begehungenJeWoche": _series({1: 100, 2: 200, 40: 400}),
        "begehungenJeWocheLaufendesJahr": _series({1: 50, 2: 100, 3: 0, 40: 900}),
        "arten": {
            "Boletus edulis": {
                "begehungenMitFund": 700,
                "fundeJeWoche": _series({1: 10, 2: 20, 40: 200}),
                "fundeJeWocheLaufendesJahr": _series({1: 20, 2: 5, 40: 900}),
            },
            "Calocybe gambosa": {
                "begehungenMitFund": 60,
                "fundeJeWoche": _series({2: 50}),
                "fundeJeWocheLaufendesJahr": _series({}),
            },
        },
    }


@pytest.fixture
def data(tmp_path: Path) -> Path:
    """Legt einen Datenordner mit drei Profilen und einer Saisontabelle an."""
    folder = tmp_path / "daten"
    (folder / "arten").mkdir(parents=True)
    for slug, inhalt in [
        ("steinpilz", STEINPILZ),
        ("maipilz", MAIPILZ),
        ("braetling", BRAETLING),
    ]:
        (folder / "arten" / f"{slug}.toml").write_text(inhalt, encoding="utf-8")
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
    listing = built.listing()

    assert [species.name for species in listing.species] == ["Braetling", "Maipilz", "Steinpilz"]


def test_the_listing_names_as_of_years_and_denominator(built: Catalog) -> None:
    listing = built.listing()

    assert listing.as_of.year == 2026
    assert listing.as_of.week == 3
    assert (listing.years.start, listing.years.end) == (2015, 2025)
    assert listing.visits == 700


def test_tiers_come_from_map_and_table(built: Catalog) -> None:
    levels = {species.slug: species.tier for species in built.listing().species}

    assert levels == {
        "steinpilz": Tier.FORECAST,
        "maipilz": Tier.SEASON,
        "braetling": Tier.PROFILE,
    }


def test_without_a_manifest_the_species_stays_on_season(data: Path, tmp_path: Path) -> None:
    empty = tmp_path / "ungerendert"
    empty.mkdir()
    built = catalog(data, empty)

    steinpilz = built.species("steinpilz")

    # 700 Begehungen mit Fund, aber kein Manifest: das Modell traegt, die
    # Karte fehlt. Der Chip "mit Vorhersage" darf die Art darum nicht zeigen.
    assert steinpilz.visits_with_find == 700
    assert steinpilz.map_slug is None
    assert steinpilz.tier == Tier.SEASON
    assert steinpilz.forecast_planned is True


def test_forecast_planned_appears_in_listing_and_profile(built: Catalog) -> None:
    geplant = {species.slug: species.forecast_planned for species in built.listing().species}

    assert geplant == {"steinpilz": True, "maipilz": False, "braetling": False}
    assert built.species("steinpilz").forecast_planned is True


def test_the_tier_follows_the_map_even_without_visits(data: Path, tmp_path: Path) -> None:
    maps = tmp_path / "frisch"
    maps.mkdir()
    (maps / "braetling.json").write_text("{}", encoding="utf-8")
    built = catalog(data, maps)

    braetling = built.species("braetling")

    assert braetling.tier == Tier.FORECAST
    assert braetling.forecast_planned is False


def test_species_without_a_table_row_stays_empty(built: Catalog) -> None:
    species = built.species("braetling")

    assert species.visits_with_find == 0
    assert species.peak_week is None
    assert species.season.maximum == 0.0
    assert set(species.season.all_years) == {0.0}


def test_the_season_curve_computes_both_series(built: Catalog) -> None:
    kurve = built.species("steinpilz").season

    # 10 von 100, 20 von 200, 200 von 400 Begehungen der geschlossenen Jahre.
    assert kurve.all_years[0] == 10.0
    assert kurve.all_years[1] == 10.0
    assert kurve.all_years[39] == 50.0
    # 20 von 50 und 5 von 100 Begehungen des laufenden Jahres.
    assert kurve.current_year == [40.0, 5.0, 0.0]


def test_the_current_year_ends_at_the_last_full_week(built: Catalog) -> None:
    kurve = built.species("steinpilz").season

    assert len(kurve.current_year) == 3
    assert len(kurve.all_years) == WEEKS


def test_the_maximum_covers_both_series(built: Catalog) -> None:
    kurve = built.species("steinpilz").season

    assert kurve.maximum == 50.0
    assert max(kurve.current_year) <= kurve.maximum


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
    kurve = built.species("steinpilz").season

    assert kurve.visits_per_week_all_years[0] == 9.1
    assert kurve.visits_per_week_current_year == [50, 100, 0]


def test_the_visits_of_the_current_year_end_with_the_curve(built: Catalog) -> None:
    kurve = built.species("steinpilz").season

    assert len(kurve.visits_per_week_current_year) == len(kurve.current_year)
    assert len(kurve.visits_per_week_all_years) == len(kurve.all_years) == WEEKS


def test_a_thin_week_shows_in_its_denominator(built: Catalog) -> None:
    kurve = built.species("steinpilz").season

    # KW 3 traegt 0 Prozent, aber auch keine einzige Begehung. Das Frontend
    # zeichnet sie darum blass statt als Absturz der Linie.
    assert kurve.current_year[2] == 0.0
    assert kurve.visits_per_week_current_year[2] == 0


def test_the_peak_week_points_at_the_best_calendar_week(built: Catalog) -> None:
    assert built.species("steinpilz").peak_week == 40


def test_tags_start_with_the_tier(built: Catalog) -> None:
    species = built.species("steinpilz")

    assert species.tags == ["vorhersage", "roehrling", "herbst", "fichte", "buche"]


def test_a_map_appears_only_with_a_manifest(built: Catalog) -> None:
    maps = {species.slug: species.map_slug for species in built.listing().species}

    assert maps == {"steinpilz": "boletus_edulis", "maipilz": None, "braetling": None}


def test_the_map_falls_back_to_the_slug(data: Path, tmp_path: Path) -> None:
    maps = tmp_path / "spaeter"
    maps.mkdir()
    (maps / "maipilz.json").write_text("{}", encoding="utf-8")
    profile = read_profiles(data / "arten")

    assert find_maps(profile, maps) == {"maipilz": "maipilz"}


def test_an_unknown_slug_is_an_error(built: Catalog) -> None:
    with pytest.raises(NotFound):
        built.species("gibt-es-nicht")


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
    profile = built.profile["maipilz"]

    for value in Edibility:
        patched = profile.model_copy(update={"speisewert": value})
        lines = {line.key: line.text for line in build_traits(patched)}
        assert lines[TraitKey.EDIBILITY]


# ------------------------------------------------------------------ Dateien


def test_a_profile_forbids_an_unknown_field() -> None:
    with pytest.raises(ValidationError):
        Profile.model_validate({**_profile_base(), "farbe": "gelb"})


def test_a_profile_requires_the_mandatory_rows() -> None:
    grundlage = _profile_base()
    del grundlage["merkmale"]["zeit"]

    with pytest.raises(ValidationError, match="zeit"):
        Profile.model_validate(grundlage)


def test_a_profile_does_not_set_edibility_itself() -> None:
    grundlage = _profile_base()
    grundlage["merkmale"]["speisewert"] = "Speisepilz."

    with pytest.raises(ValidationError, match="speisewert"):
        Profile.model_validate(grundlage)


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
    return tomllib.loads(MAIPILZ)


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
    first = body["arten"][0]
    assert set(first) == {
        "slug",
        "name",
        "lateinisch",
        "gruppe",
        "stufe",
        "tags",
        "geschuetzt",
        "speisewert",
        "kartenSlug",
        "vorhersageGeplant",
        "begehungenMitFund",
        "spitzeWoche",
        "saison",
    }
    assert set(first["saison"]) == {"alleJahre", "laufendesJahr", "hoechstwert"}
    # Beide Reihen, wie im Profil: die Zeile zeichnet dieselbe Kurve, nur kleiner.
    steinpilz = next(species for species in body["arten"] if species["slug"] == "steinpilz")
    assert steinpilz["saison"]["laufendesJahr"] == [40.0, 5.0, 0.0]


async def test_the_profile_answers_with_table_and_curve(app: FastAPI) -> None:
    async with client(app) as call:
        response = await call.get("/api/arten/steinpilz")

    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "steinpilz"
    assert body["kartenSlug"] == "boletus_edulis"
    assert body["merkmale"][0] == {"schluessel": "hut", "text": "Braun."}
    assert body["verwechslungen"] == [
        {"name": "Gallenroehrling", "merkmal": "Bitter.", "essbar": "ungeniessbar"}
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
    profile = read_profiles(DATA / "arten")

    assert len(profile) == 85


def test_every_species_of_the_chain_has_a_profile() -> None:
    profile = read_profiles(DATA / "arten")
    table = read_season(DATA / "saison.json")

    assert {profile.scientific for profile in profile.values()} == set(table.species)


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
    mit_karte = sorted(
        species.slug for species in built.listing().species if species.tier == Tier.FORECAST
    )

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


def test_twentythree_species_carry_a_model(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)

    # Die Zahl aus konzept.html: 600 Begehungen mit Fund seit 2015. Sie haengt
    # nicht daran, ob die Kette die Karte schon gerendert hat.
    assert sum(1 for species in built.listing().species if species.forecast_planned) == 23


def test_every_profile_links_two_sources() -> None:
    for slug, profile in read_profiles(DATA / "arten").items():
        title = [verweis.title for verweis in profile.links]
        assert title == ["123pilzsuche.de", "Wikipedia"], slug


def test_every_slug_is_an_address() -> None:
    for slug in read_profiles(DATA / "arten"):
        assert slug == slug.lower()
        assert set(slug) <= set("abcdefghijklmnopqrstuvwxyz-")


def test_protected_species_name_the_collecting_rule(tmp_path: Path) -> None:
    built = catalog(DATA, tmp_path)
    protected = [species for species in built.listing().species if species.protected]

    assert len(protected) >= 18
    for kurz in protected:
        lines = {line.key: line.text for line in built.species(kurz.slug).traits}
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
