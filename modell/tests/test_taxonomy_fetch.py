"""Tests of the taxonomy builder.

The frame is small enough to check by hand: five profiles, three genera, one
family and one order. Run them from `modell/` with
`nix develop --command pytest tests`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "pilze"))

from taxonomy_fetch import (  # noqa: E402
    RANKS,
    Profile,
    build_taxa,
    count_names,
    feature_lines,
    genus_of,
    group_names,
    main,
    name_per_taxon,
    read_profiles,
    slug_of,
)

PROFILES = [
    Profile("steinpilz", "Boletus edulis", "https://example.invalid/steinpilz"),
    Profile("sommersteinpilz", "Boletus reticulatus", "https://example.invalid/sommer"),
    Profile("maronenroehrling", "Imleria badia", "https://example.invalid/marone"),
    Profile("butterpilz", "Suillus luteus", "https://example.invalid/butterpilz"),
    Profile("pfifferling", "Cantharellus cibarius", "https://example.invalid/pfifferling"),
]

# Was die Quellseite in der Zeile "Gattung:" fuehrt. Die Zeile nennt erst die
# weite Gruppe, dann die enge.
LINES = {
    "steinpilz": "Röhrlinge, Dickröhrlinge.",
    "sommersteinpilz": "Röhrlinge, Dickröhrlinge.",
    "maronenroehrling": "Röhrlinge, Filzröhrlinge.",
    "butterpilz": "Röhrlinge, Schmierröhrlinge.",
    "pfifferling": "Leistlinge.",
}

PLACES = {
    "Boletus": {"family": "Boletaceae", "order": "Boletales", "class": "Agaricomycetes"},
    "Imleria": {"family": "Boletaceae", "order": "Boletales", "class": "Agaricomycetes"},
    "Suillus": {"family": "Suillaceae", "order": "Boletales", "class": "Agaricomycetes"},
    "Cantharellus": {
        "family": "Cantharellaceae",
        "order": "Cantharellales",
        "class": "Agaricomycetes",
    },
}

PAGE = (
    "Steinpilze (BOLETUS EDULIS) Geruch: Sehr angenehm, pilzig. "
    "Hut: 4-20 cm breit, braun. Vorkommen: Mischwald, Symbiosepilz. "
    "Gattung: Röhrlinge, Dickröhrlinge. Verwechslungsgefahr: Gallenröhrling. "
    "Wiki-Link: https://de.wikipedia.org/wiki/Gemeiner_Steinpilz"
)


def test_genus_and_slug_come_from_the_latin_name() -> None:
    assert genus_of("Boletus edulis") == "Boletus"
    assert genus_of("Suillus cavipes var. aereus") == "Suillus"
    assert slug_of("Boletus edulis") == "boletus-edulis"
    assert slug_of("Boletaceae") == "boletaceae"


def test_feature_lines_cut_the_page_at_its_labels() -> None:
    lines = feature_lines(PAGE)

    assert lines["Gattung"] == "Röhrlinge, Dickröhrlinge."
    assert lines["Geruch"] == "Sehr angenehm, pilzig."
    assert lines["Verwechslungsgefahr"] == "Gallenröhrling."
    assert "BOLETUS EDULIS" not in lines


def test_feature_lines_keep_the_first_of_a_repeated_label() -> None:
    # Eine Quellseite wiederholt die Auszeichnung mitten im Satz:
    # "... (Gattung: IMLERIA = Kastanienröhrlinge)".
    page = "Gattung: Röhrlinge, alt Filzröhrlinge (Gattung: IMLERIA). Tipp: nichts."

    assert feature_lines(page)["Gattung"] == "Röhrlinge, alt Filzröhrlinge ("


def test_feature_lines_stay_empty_without_a_label() -> None:
    assert feature_lines("Ein Absatz ohne jede Auszeichnung.") == {}


def test_group_names_drop_what_is_no_name() -> None:
    assert group_names("Röhrlinge, Dickröhrlinge.") == ["Röhrlinge", "Dickröhrlinge"]
    assert group_names("Wulstlinge (Knollenblätterpilzartigen = AMANITAS).") == ["Wulstlinge"]
    assert group_names("Schmierlinge (Gelbfüße): Alle Pilze dieser Gattung sind essbar!") == [
        "Schmierlinge"
    ]
    assert group_names("Täublinge, Sektion EMETICINAE = Speitäublinge.") == [
        "Täublinge",
        "Speitäublinge",
    ]
    # "-artig" und "-verwandt" benennen die weitere Gruppe, nicht das Taxon.
    assert group_names("Stoppelpilze, Stoppelpilzverwandten (Hydnaceae).") == ["Stoppelpilze"]


def test_count_names_keeps_every_mention_with_its_place_in_the_line() -> None:
    counted = count_names(LINES)

    assert counted["Röhrlinge"] == [
        ("butterpilz", 0),
        ("maronenroehrling", 0),
        ("sommersteinpilz", 0),
        ("steinpilz", 0),
    ]
    assert counted["Dickröhrlinge"] == [("sommersteinpilz", 1), ("steinpilz", 1)]


def test_the_name_goes_to_the_lowest_rank_that_the_count_carries() -> None:
    chosen = name_per_taxon(PROFILES, PLACES, count_names(LINES))

    # "Röhrlinge" greift ueber die Familie Boletaceae hinaus, also traegt es
    # erst die Ordnung. "Dickröhrlinge" bleibt in der Gattung.
    assert chosen[("order", "Boletales")][0] == ("Röhrlinge", 4)
    assert chosen[("genus", "Boletus")][0] == ("Dickröhrlinge", 2)
    assert ("family", "Boletaceae") not in chosen
    assert ("class", "Agaricomycetes") not in chosen


def test_a_name_below_the_threshold_of_coverage_stays_out() -> None:
    # Nur eine der zwei Boletus-Arten nennt "Dickröhrlinge". Die Haelfte ist
    # keine Mehrheit, und weiter oben deckt der Name noch weniger.
    thin = {**LINES, "steinpilz": "Röhrlinge."}

    chosen = name_per_taxon(PROFILES, PLACES, count_names(thin))

    assert ("genus", "Boletus") not in chosen
    assert chosen[("order", "Boletales")][0] == ("Röhrlinge", 4)


def test_build_taxa_chains_the_ranks_and_names_the_root_last() -> None:
    taxa = {row["slug"]: row for row in build_taxa(PROFILES, PLACES, LINES)}

    assert taxa["boletus"] == {
        "slug": "boletus",
        "rang": "gattung",
        "lateinisch": "Boletus",
        "name": "Dickröhrlinge",
        "elter": "boletaceae",
        "belege": {"Dickröhrlinge": 2},
    }
    assert taxa["boletaceae"]["elter"] == "boletales"
    assert taxa["boletaceae"]["name"] == "Boletaceae"
    assert taxa["boletales"]["name"] == "Röhrlinge"
    assert taxa["agaricomycetes"]["elter"] is None
    # Ohne Beleg steht der lateinische Name da, geraten wird nichts.
    assert taxa["agaricomycetes"]["name"] == "Agaricomycetes"
    assert "belege" not in taxa["agaricomycetes"]


def test_every_rank_of_the_chain_appears() -> None:
    ranks = {row["rang"] for row in build_taxa(PROFILES, PLACES, LINES)}

    assert ranks == set(RANKS.values())


def test_read_profiles_takes_slug_latin_name_and_source(tmp_path: Path) -> None:
    (tmp_path / "steinpilz.toml").write_text(
        'name = "Steinpilz"\nlateinisch = "Boletus edulis"\n'
        '[quelle]\nurl = "https://example.invalid/steinpilz"\n',
        encoding="utf-8",
    )

    assert read_profiles(tmp_path) == [PROFILES[0]]


def test_main_writes_the_file_and_reports_the_count(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    folder = tmp_path / "arten"
    folder.mkdir()
    cache = tmp_path / "cache"
    for profile in PROFILES:
        (folder / f"{profile.slug}.toml").write_text(
            f'lateinisch = "{profile.latin}"\n[quelle]\nurl = "{profile.url}"\n',
            encoding="utf-8",
        )
    pages = {p.url: f"Gattung: {LINES[p.slug]} Wiki-Link: x" for p in PROFILES}
    target = tmp_path / "taxonomie.json"

    main(
        [
            "--profiles",
            str(folder),
            "--out",
            str(target),
            "--cache",
            str(cache),
        ],
        fetch_page=pages.__getitem__,
        match_species=lambda latin: PLACES[genus_of(latin)],
    )

    written = json.loads(target.read_text(encoding="utf-8"))
    assert {row["slug"] for row in written["taxa"]} >= {"boletus", "boletaceae", "boletales"}
    assert written["raenge"] == list(RANKS.values())
    assert "Röhrlinge 4" in capsys.readouterr().out
