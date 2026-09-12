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
from typing import TypedDict

from app.core.errors import NotFound
from app.modules.species.schemas import (
    Colours,
    Edibility,
    Frequency,
    Group,
    Marketability,
    Period,
    Profile,
    ProtectionStatus,
    Reagent,
    RedListStatus,
    ResolvedLookalike,
    Season,
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
    TreeSource,
    TreeSpecies,
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
    Edibility.EDIBLE: "Essbar.",
    Edibility.EDIBLE_WHEN_COOKED: "Nur unter einer Bedingung essbar.",
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


def tier_for(visits_with_find: int, *, has_map: bool) -> Tier:
    """Die Stufe einer Art: was die App zu ihr zeigen kann, heute.

    ``vorhersage`` heisst, dass eine Karte da ist. Die Datenlage allein reicht
    nicht: 23 Arten tragen ein Modell, gerendert sind erst 13. Der Chip "mit
    Vorhersage" zeigte sonst zehn Arten ohne Karte.
    """
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


def covers_month(period: Period, month: int) -> bool:
    """Sagt, ob ein Zeitraum einen Monat einschliesst.

    Der Samtfussruebling laeuft von November bis Mai. Ein Zeitraum, dessen Ende
    vor seinem Anfang liegt, geht ueber den Jahreswechsel.
    """
    if period.start_month <= period.end_month:
        return period.start_month <= month <= period.end_month
    return month >= period.start_month or month <= period.end_month


def colour_names(colours: Colours) -> set[str]:
    """Alle Farbnamen einer Art, ueber alle Koerperteile hinweg."""
    parts = (
        colours.cap,
        colours.hymenium,
        colours.stem,
        colours.flesh,
        colours.spore_print,
        colours.change.end if colours.change else [],
    )
    return {colour.name for part in parts for colour in part}


@dataclass(frozen=True)
class SpeciesFilter:
    """Die Auswahl, die ``GET /api/arten`` als Abfrage entgegennimmt.

    Jedes Feld ist eine Und-Bedingung. Was leer bleibt, schraenkt nicht ein.
    Die Auswahl gehoert auf den Server: er kennt die Werte, das Frontend nur
    die Slugs.
    """

    group: Group | None = None
    tier: Tier | None = None
    edibility: Edibility | None = None
    protection: ProtectionStatus | None = None
    frequency: Frequency | None = None
    red_list: RedListStatus | None = None
    rating: int | None = None
    marketable: bool | None = None
    smell: str | None = None
    taste: str | None = None
    tree: str | None = None
    month: int | None = None
    colour: str | None = None

    def matches(self, profile: Profile, tier: Tier) -> bool:
        """Prueft eine Art gegen jede gesetzte Bedingung."""
        trees = set(profile.trees)
        if profile.trees_from_experience:
            trees |= set(profile.trees_from_experience.trees)
        checks = (
            self.group is None or profile.group is self.group,
            self.tier is None or tier is self.tier,
            self.edibility is None or profile.edibility is self.edibility,
            self.protection is None
            or (profile.protection is not None and profile.protection.status is self.protection),
            self.frequency is None or profile.frequency is self.frequency,
            self.red_list is None or profile.red_list is self.red_list,
            self.rating is None or profile.rating == self.rating,
            self.marketable is None or profile.marketable is self.marketable,
            self.smell is None or self.smell in profile.smell.tags,
            self.taste is None or self.taste in profile.taste.tags,
            self.tree is None or self.tree in trees,
            self.month is None
            or (profile.period is not None and covers_month(profile.period, self.month)),
            self.colour is None or self.colour in colour_names(profile.colours),
        )
        return all(checks)


def check_names(profiles: dict[str, Profile]) -> None:
    """Prueft, dass keine Art zweimal im Katalog steht.

    Zwei Dateien zu derselben Art sind der Weg, auf dem die Artenliste
    Doppelte bekommt: dieselbe Quellseite, zwei Namen, zwei Slugs. Der
    lateinische Name ist der Schluessel zur Saisontabelle und darf darum nur
    einmal vorkommen, der deutsche Name nur einmal in der Liste.
    """
    doubled: list[str] = []
    for field, values in (
        ("Lateinischer Name", [profile.scientific for profile in profiles.values()]),
        ("Name", [profile.name for profile in profiles.values()]),
    ):
        doubled += [f"{field} {value}" for value in sorted(set(values)) if values.count(value) > 1]
    if doubled:
        raise ValueError("Diese Angaben stehen doppelt im Katalog: " + ", ".join(doubled))


def check_references(profiles: dict[str, Profile]) -> None:
    """Prueft, dass jedes Paar einmal steht und auf ein Profil zeigt.

    Ein Slug ohne Ziel ist ein Fehler beim Start und kein stiller Ausfall in
    der Oberflaeche: das Frontend kann einen Verweis nicht aufloesen, den es
    erst beim Antippen als kaputt erkennt.

    Ein Paar, das in beiden Dateien steht, hat zwei Saetze zu derselben
    Beziehung. Sie laufen auseinander, sobald jemand einen davon aendert.
    """
    faults = [
        f"{slug} zeigt auf {lookalike.slug}"
        for slug, profile in profiles.items()
        for lookalike in profile.lookalikes
        if lookalike.slug not in profiles or lookalike.slug == slug
    ]
    if faults:
        raise ValueError("Verwechslungen ohne gueltiges Ziel: " + ", ".join(sorted(faults)))
    pairs = [
        " und ".join(sorted((slug, lookalike.slug)))
        for slug, profile in profiles.items()
        for lookalike in profile.lookalikes
    ]
    twice = sorted({pair for pair in pairs if pairs.count(pair) > 1})
    if twice:
        raise ValueError("Diese Paare stehen zweimal: " + ", ".join(twice))


def build_relations(profiles: dict[str, Profile]) -> dict[str, list[tuple[str, str | None]]]:
    """Loest die Paare in beide Richtungen auf: Slug der Art, dann Gegenueber.

    Ein Paar steht in einer der zwei Dateien. Die andere Seite bekommt es
    hier, mit dem Satz, der zu ihrer Blickrichtung gehoert.
    """
    result: dict[str, list[tuple[str, str | None]]] = {slug: [] for slug in profiles}
    for slug, profile in profiles.items():
        for lookalike in profile.lookalikes:
            result[slug].append((lookalike.slug, lookalike.difference))
            result[lookalike.slug].append((slug, lookalike.own_difference))
    return result


def read_season(file: Path) -> SeasonTable:
    """Liest die Saisontabelle, die die Kette erzeugt hat."""
    return SeasonTable.model_validate_json(file.read_text(encoding="utf-8"))


class CommonFields(TypedDict):
    """Die Felder, die ``SpeciesBrief`` und ``Species`` gemeinsam tragen."""

    slug: str
    name: str
    scientific: str
    group: Group
    tier: Tier
    tags: list[Tag]
    protected: bool
    edibility: Edibility
    map_slug: str | None
    collectable: bool
    marketability: Marketability
    rating: int | None
    frequency: Frequency | None
    red_list: RedListStatus | None
    warning: str | None
    seasons: list[Season]
    trees: list[TreeSpecies]
    trees_from_experience: TreeSource | None
    other_names: list[str]
    synonyms: list[str]
    forecast_planned: bool
    visits_with_find: int
    peak_week: int | None


@dataclass(frozen=True)
class Catalog:
    """Alle Arten, einmal aus den Dateien gebaut und danach nur noch gelesen."""

    table: SeasonTable
    profiles: dict[str, Profile]
    maps: dict[str, str]
    relations: dict[str, list[tuple[str, str | None]]]

    def _counts(self, profile: Profile) -> SpeciesCounts | None:
        # Eine Art ohne Zeile in der Tabelle hat seit 2015 keine Begehung
        # getragen. Sie steht als Profil im Katalog, nicht als Luecke.
        return self.table.species.get(profile.scientific)

    def _series(self, counts: SpeciesCounts) -> tuple[list[float], list[float]]:
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

    def _common(self, slug: str, profile: Profile) -> CommonFields:
        """Die Felder, die Liste und Artseite gleich tragen.

        Sie stehen hier einmal. Zweimal geschrieben liefen sie auseinander,
        sobald ein Feld dazukommt.
        """
        counts = self._counts(profile)
        visits = counts.visits_with_find if counts else 0
        map_name = self.maps.get(slug)
        tier = tier_for(visits, has_map=map_name is not None)
        return CommonFields(
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
            marketability=Marketability(
                marketable=profile.marketable,
                switzerland=profile.marketable_switzerland,
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
            forecast_planned=forecast_planned(visits),
            visits_with_find=visits,
            peak_week=peak_week_of(self._series(counts)[0]) if counts else None,
        )

    def listing(
        self,
        *,
        only_collectable: bool | None = True,
        chosen: SpeciesFilter | None = None,
    ) -> SpeciesList:
        """Die Arten mit Stufe, Tags und der kleinen Kurve.

        ``nur_sammelbare`` waehlt aus: ``True`` liefert die 85 sammelbaren,
        ``False`` die Verwechslungsarten, ``None`` alle. Die Auswahl gehoert
        hierher und nicht ins Frontend: der Reiter Arten zeigt sonst Giftpilze
        zwischen den Speisepilzen.

        ``chosen`` schraenkt weiter ein, ueber die strukturierten Felder.
        """
        wanted = chosen or SpeciesFilter()
        species: list[SpeciesBrief] = []
        for slug, profile in self.profiles.items():
            if only_collectable is not None and profile.collectable is not only_collectable:
                continue
            common = self._common(slug, profile)
            if not wanted.matches(profile, common["tier"]):
                continue
            counts = self._counts(profile)
            season = None
            if counts:
                all_years, current = self._series(counts)
                season = SeasonBrief(
                    all_years=all_years,
                    current_year=current,
                    maximum=max([*all_years, *current]),
                )
            species.append(SpeciesBrief(**common, season=season))
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

    def _resolve(self, other: str, difference: str | None) -> ResolvedLookalike:
        target = self.profiles[other]
        return ResolvedLookalike(
            slug=other,
            name=target.name,
            scientific=target.scientific,
            difference=difference,
            edibility=target.edibility,
            warning=target.warning,
        )

    def lookalikes(self, slug: str) -> list[ResolvedLookalike]:
        """Alle Arten, mit denen diese verwechselt wird, aus beiden Richtungen."""
        pairs = sorted(self.relations[slug], key=lambda pair: self.profiles[pair[0]].name)
        return [self._resolve(other, difference) for other, difference in pairs]

    def species(self, slug: str) -> Species:
        """Eine Art mit Profil. Ein unbekannter Slug ist ein 404."""
        profile = self.profiles.get(slug)
        if profile is None:
            raise NotFound(f"Die Art {slug} steht nicht im Katalog.")
        counts = self._counts(profile)
        season = None
        if counts:
            all_years, current = self._series(counts)
            season = SeasonCurve(
                all_years=all_years,
                current_year=current,
                maximum=max([*all_years, *current]),
                years=self._years,
                as_of=self._as_of,
                visits=sum(self.table.visits_per_week),
                visits_per_week_all_years=self._visits_all_years,
                visits_per_week_current_year=self._visits_current_year,
            )
        return Species(
            **self._common(slug, profile),
            measurements=profile.measurements,
            colours=profile.colours,
            period=profile.period,
            protection=profile.protection,
            smell=profile.smell,
            taste=profile.taste,
            reagents=profile.reagents,
            source=profile.source,
            traits=build_traits(profile),
            lookalikes=self.lookalikes(slug),
            links=profile.links,
            season=season,
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
    check_names(profiles)
    check_references(profiles)
    table = read_season(data / "saison.json")
    return Catalog(
        table=table,
        profiles=profiles,
        maps=find_maps(profiles, maps),
        relations=build_relations(profiles),
    )
