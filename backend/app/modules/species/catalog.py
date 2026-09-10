"""Der Katalog: Profile und Saisontabelle lesen, Stufen und Kurven rechnen.

Die Profile sind TOML, weil ``tomllib`` zur Standardbibliothek gehoert. Ein
YAML-Leser stuende nicht auf der Paketliste in ``docs/betrieb.md``.

Nichts hier laedt etwas aus ``modell/``. Die Kette legt zwei Dinge ab, die
dieser Dienst nur liest: die Saisontabelle unter ``daten/saison.json`` und die
Manifeste unter ``PILZE_MAPS``.
"""

import tomllib
from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.errors import NotFound
from app.modules.species.schemas import (
    WEEKS,
    Edibility,
    Marketability,
    Profile,
    Reagent,
    SeasonBrief,
    SeasonCurve,
    SeasonTable,
    Species,
    SpeciesBrief,
    SpeciesCounts,
    SpeciesList,
    Tag,
    Tier,
    Trait,
    TraitKey,
    YearRange,
)
from app.shared.schemas import Week

# Der Ordner liegt neben ``app`` und wird mit dem Backend ausgeliefert. Ein
# eigener Pfad in der Umgebung waere ein weiterer Vertrag zum NixOS-Modul.
DATA = Path(__file__).resolve().parents[3] / "daten"

FORECAST_THRESHOLD = 600
SEASON_THRESHOLD = 60

# Diese Texte stehen in der Merkmalstabelle der Artseite. Sie tragen darum
# Umlaute, anders als die Bezeichner und Docstrings dieses Projekts.
EDIBILITY_TEXT: dict[Edibility, str] = {
    Edibility.EXCELLENT: "Sehr guter Speisepilz.",
    Edibility.CHOICE: "Guter Speisepilz.",
    Edibility.EDIBLE: "Essbar.",
    Edibility.POOR: "Essbar, aber minderwertig.",
    Edibility.EDIBLE_WHEN_COOKED: "Giftig, erst nach Vorbehandlung essbar.",
    Edibility.INEDIBLE: "Ungenie\u00dfbar.",
    Edibility.POISONOUS: "Giftig.",
    Edibility.DEADLY: "T\u00f6dlich giftig.",
}

PROTECTED_TEXT = (
    "Besonders gesch\u00fctzt nach Bundesartenschutzverordnung. Entnahme nur in "
    "geringen Mengen f\u00fcr den Eigenbedarf, nicht in Schutzgebieten."
)
UNPROTECTED_TEXT = (
    "Nicht besonders gesch\u00fctzt. Es gelten die Regeln des Landes und des Waldbesitzers."
)

REAGENT_TEXT: dict[Reagent, str] = {
    Reagent.KOH: "Kalilauge (KOH)",
    Reagent.NAOH: "Natronlauge (NaOH)",
    Reagent.FESO4: "Eisensulfat (FeSO\u2084)",
    Reagent.GUAIAC: "Guajak",
    Reagent.MELZER: "Melzers Reagenz",
    Reagent.ANILINE: "Anilin",
    Reagent.PHENOL: "Phenol",
    Reagent.AMMONIA: "Ammoniak",
    Reagent.SULFOVANILLIN: "Sulfovanillin",
    Reagent.FORMALIN: "Formalin",
    Reagent.FECL3: "Eisen(III)-chlorid (FeCl\u2083)",
    Reagent.WIELAND: "Wieland-Test",
    Reagent.SCHAEFFER: "Sch\u00e4ffer-Reaktion",
}


def tier_for(visits_with_find: int, *, has_map: bool, collectable: bool = True) -> Tier:
    """Die Stufe einer Art: was die App zu ihr zeigen kann, heute.

    ``vorhersage`` heisst, dass eine Karte da ist. Die Datenlage allein reicht
    nicht: 23 Arten tragen ein Modell, gerendert sind erst 13. Der Chip "mit
    Vorhersage" zeigte sonst zehn Arten ohne Karte.

    ``verwechslung`` traegt eine Art, die niemand sammelt. Sie steht im Katalog,
    weil eine sammelbare Art ihr aehnlich sieht.
    """
    if not collectable:
        return Tier.LOOKALIKE
    if has_map:
        return Tier.FORECAST
    if visits_with_find >= SEASON_THRESHOLD:
        return Tier.SEASON
    return Tier.PROFILE


def forecast_planned(visits_with_find: int) -> bool:
    """Sagt, ob die Datenlage ein Modell traegt: 600 Begehungen mit Fund.

    Das Feld ueberlebt die Trennung von Stufe und Karte. Die Artseite sagt
    damit "Vorhersage in Arbeit", solange die Art noch kein Manifest hat, und
    die dokumentierte Zahl von 23 Arten bleibt nachzuzaehlen.
    """
    return visits_with_find >= FORECAST_THRESHOLD


def share_per_week(finds: Sequence[int], visits: Sequence[int]) -> list[float]:
    """Anteil der Begehungen mit Fund je Kalenderwoche, in Prozent.

    Eine Woche ohne Begehung ist keine Woche ohne Pilz. Sie bekommt 0 Prozent,
    weil die Kurve sonst eine Luecke haette, die die Oberflaeche nicht zeichnen
    kann.
    """
    return [
        round(100 * find / visit, 1) if visit else 0.0
        for find, visit in zip(finds, visits, strict=True)
    ]


def mean_per_week(visits: Sequence[int], years: int) -> list[float]:
    """Begehungen je Kalenderwoche, gemittelt ueber die geschlossenen Jahre.

    Das Mittel steht neben der Zahl des laufenden Jahres, darum teilt es durch
    die Jahre. Eine Summe ueber elf Jahre waere elfmal so gross und liesse sich
    mit dem laufenden Jahr nicht vergleichen.
    """
    return [round(value / years, 1) for value in visits]


def peak_week_of(shares: Sequence[float]) -> int | None:
    """Die Kalenderwoche mit dem hoechsten Anteil, oder nichts ohne einen Fund."""
    highest = max(shares)
    if highest <= 0:
        return None
    return shares.index(highest) + 1


def build_traits(profile: Profile) -> list[Trait]:
    """Die Merkmalstabelle in der Reihenfolge der Artseite.

    Speisewert und Schutz kommen aus den Enums des Profils, damit Text und
    Filterwert nicht auseinanderlaufen koennen.
    """
    lines = dict(profile.traits)
    edibility = EDIBILITY_TEXT[profile.edibility]
    if profile.edibility_note:
        edibility = f"{edibility} {profile.edibility_note}"
    lines[TraitKey.EDIBILITY] = edibility
    protection = PROTECTED_TEXT if profile.protected else UNPROTECTED_TEXT
    if profile.protection_note:
        protection = f"{protection} {profile.protection_note}"
    lines[TraitKey.PROTECTION] = protection
    if profile.reagents:
        lines[TraitKey.REAGENTS] = " ".join(
            f"{REAGENT_TEXT[entry.reagent]}: {entry.reaction}" for entry in profile.reagents
        )
    return [Trait(key=key, text=lines[key]) for key in TraitKey if key in lines]


def build_tags(profile: Profile, tier: Tier) -> list[Tag]:
    """Die Chips einer Art: erst die Stufe, dann Gruppe, Jahreszeit und Baum.

    Beide Baumlisten zaehlen. Wer nach Fichte filtert, will die Art auch dann
    sehen, wenn nur das eigene Sammeln den Baum kennt.
    """
    experience = profile.trees_from_experience.trees if profile.trees_from_experience else []
    trees = list(dict.fromkeys([*profile.trees, *experience]))
    return [tier, profile.group, *profile.seasons, *trees]


def read_profiles(folder: Path) -> dict[str, Profile]:
    """Liest jede Profildatei des Ordners. Der Dateiname ist der Slug."""
    profiles: dict[str, Profile] = {}
    for file in sorted(folder.glob("*.toml")):
        raw_bytes = tomllib.loads(file.read_text(encoding="utf-8"))
        profiles[file.stem] = Profile.model_validate(raw_bytes)
    return profiles


def read_season(file: Path) -> SeasonTable:
    """Liest die Saisontabelle, die die Kette erzeugt hat."""
    return SeasonTable.model_validate_json(file.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class Catalog:
    """Alle Arten, einmal aus den Dateien gebaut und danach nur noch gelesen."""

    table: SeasonTable
    profiles: dict[str, Profile]
    maps: dict[str, str]

    def _counts(self, profile: Profile) -> SpeciesCounts:
        # Eine Art ohne Zeile in der Tabelle hat seit 2015 keine Begehung
        # getragen. Sie steht als Profil im Katalog, nicht als Luecke.
        empty = SpeciesCounts(
            visits_with_find=0,
            finds_per_week=[0] * WEEKS,
            finds_per_week_current_year=[0] * WEEKS,
        )
        return self.table.species.get(profile.scientific, empty)

    def _series(self, profile: Profile) -> tuple[list[float], list[float]]:
        counts = self._counts(profile)
        all_years = share_per_week(counts.finds_per_week, self.table.visits_per_week)
        current = share_per_week(
            counts.finds_per_week_current_year,
            self.table.visits_per_week_current_year,
        )
        return all_years, current[: self.table.as_of_week]

    @property
    def _as_of(self) -> Week:
        return Week(year=self.table.as_of_year, week=self.table.as_of_week)

    @property
    def _years(self) -> YearRange:
        return YearRange(start=self.table.from_year, end=self.table.to_year)

    @property
    def _visits_all_years(self) -> list[float]:
        count = self.table.to_year - self.table.from_year + 1
        return mean_per_week(self.table.visits_per_week, count)

    @property
    def _visits_current_year(self) -> list[int]:
        return self.table.visits_per_week_current_year[: self.table.as_of_week]

    def listing(self, *, only_collectable: bool | None = True) -> SpeciesList:
        """Die Arten mit Stufe, Tags und der kleinen Kurve.

        ``nur_sammelbare`` waehlt aus: ``True`` liefert die 85 sammelbaren,
        ``False`` die Verwechslungsarten, ``None`` alle. Die Auswahl gehoert
        hierher und nicht ins Frontend: der Reiter Arten zeigt sonst Giftpilze
        zwischen den Speisepilzen.
        """
        species: list[SpeciesBrief] = []
        for slug, profile in self.profiles.items():
            if only_collectable is not None and profile.collectable is not only_collectable:
                continue
            counts = self._counts(profile)
            all_years, current = self._series(profile)
            map_name = self.maps.get(slug)
            tier = tier_for(
                counts.visits_with_find,
                has_map=map_name is not None,
                collectable=profile.collectable,
            )
            species.append(
                SpeciesBrief(
                    slug=slug,
                    name=profile.name,
                    scientific=profile.scientific,
                    group=profile.group,
                    tier=tier,
                    tags=build_tags(profile, tier),
                    protected=profile.protected,
                    edibility=profile.edibility,
                    map_slug=map_name,
                    collectable=profile.collectable,
                    marketable=profile.marketable,
                    marketable_switzerland=profile.marketable_switzerland,
                    rating=profile.rating,
                    frequency=profile.frequency,
                    red_list=profile.red_list,
                    warning=profile.warning,
                    seasons=profile.seasons,
                    trees=profile.trees,
                    trees_from_experience=profile.trees_from_experience,
                    other_names=profile.other_names,
                    synonyms=profile.synonyms,
                    forecast_planned=forecast_planned(counts.visits_with_find),
                    visits_with_find=counts.visits_with_find,
                    peak_week=peak_week_of(all_years) if profile.collectable else None,
                    season=SeasonBrief(
                        all_years=all_years,
                        current_year=current,
                        maximum=max([*all_years, *current]),
                    )
                    if profile.collectable
                    else None,
                )
            )
        species.sort(key=lambda species: species.name)
        return SpeciesList(
            as_of=self._as_of,
            years=self._years,
            visits=sum(self.table.visits_per_week),
            visits_per_week_all_years=self._visits_all_years,
            visits_per_week_current_year=self._visits_current_year,
            species=species,
        )

    def has(self, slug: str) -> bool:
        """Sagt, ob der Slug im Katalog steht."""
        return slug in self.profiles

    def is_protected(self, slug: str) -> bool:
        """Sagt, ob die Art besonders geschuetzt ist.

        Ein unbekannter Slug gilt als geschuetzt. Ein Fundort geht so im
        Zweifel grob heraus und nicht genau.
        """
        profile = self.profiles.get(slug)
        return profile is None or profile.protected

    def scientific(self, slug: str) -> str | None:
        """Der wissenschaftliche Name einer Art, oder nichts fuer einen unbekannten Slug.

        Die Kette kennt nur diesen Namen. Ein Slug sagt ihr nichts.
        """
        profile = self.profiles.get(slug)
        return None if profile is None else profile.scientific

    def species(self, slug: str) -> Species:
        """Eine Art mit Profil. Ein unbekannter Slug ist ein 404."""
        profile = self.profiles.get(slug)
        if profile is None:
            raise NotFound(f"Die Art {slug} steht nicht im Katalog.")
        counts = self._counts(profile)
        all_years, current = self._series(profile)
        map_name = self.maps.get(slug)
        tier = tier_for(
            counts.visits_with_find,
            has_map=map_name is not None,
            collectable=profile.collectable,
        )
        return Species(
            slug=slug,
            name=profile.name,
            scientific=profile.scientific,
            group=profile.group,
            tier=tier,
            tags=build_tags(profile, tier),
            protected=profile.protected,
            edibility=profile.edibility,
            map_slug=map_name,
            collectable=profile.collectable,
            marketable=profile.marketable,
            marketable_switzerland=profile.marketable_switzerland,
            marketability=Marketability(
                marketable=profile.marketable,
                switzerland=profile.marketable_switzerland,
                source=profile.source,
            ),
            rating=profile.rating,
            frequency=profile.frequency,
            red_list=profile.red_list,
            warning=profile.warning,
            seasons=profile.seasons,
            trees=profile.trees,
            trees_from_experience=profile.trees_from_experience,
            other_names=profile.other_names,
            synonyms=profile.synonyms,
            measurements=profile.measurements,
            reagents=profile.reagents,
            source=profile.source,
            forecast_planned=forecast_planned(counts.visits_with_find),
            visits_with_find=counts.visits_with_find,
            peak_week=peak_week_of(all_years) if profile.collectable else None,
            traits=build_traits(profile),
            lookalikes=profile.lookalikes,
            links=profile.links,
            season=SeasonCurve(
                all_years=all_years,
                current_year=current,
                maximum=max([*all_years, *current]),
                years=self._years,
                as_of=self._as_of,
                visits=sum(self.table.visits_per_week),
                visits_per_week_all_years=self._visits_all_years,
                visits_per_week_current_year=self._visits_current_year,
            )
            if profile.collectable
            else None,
        )


def find_maps(profiles: dict[str, Profile], maps: Path) -> dict[str, str]:
    """Sucht zu jeder Art das Manifest der Kette, wenn es schon gerendert ist.

    Ohne Manifest gibt es keine Karte, und die Artseite bietet den Sprung
    dorthin nicht an.
    """
    found: dict[str, str] = {}
    for slug, profile in profiles.items():
        name = profile.map_name or slug
        if (maps / f"{name}.json").is_file():
            found[slug] = name
    return found


@lru_cache(maxsize=4)
def catalog(data: Path, maps: Path) -> Catalog:
    """Baut den Katalog aus den Dateien. Der Prozess liest sie einmal."""
    profiles = read_profiles(data / "arten")
    table = read_season(data / "saison.json")
    return Catalog(table=table, profiles=profiles, maps=find_maps(profiles, maps))
