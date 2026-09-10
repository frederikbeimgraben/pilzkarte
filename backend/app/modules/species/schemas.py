"""Vertrag des Artenkatalogs.

Alles, was feststeht, ist ein Enum: die Stufe, die Gruppe, die Baumart, die
Jahreszeit, die Essbarkeit und die Schluessel der Merkmalstabelle. Freien Text
traegt nur der Wert einer Merkmalszeile.

Drei Modelle beschreiben Dateien statt Antworten: ``Profil`` ist eine Datei
unter ``daten/arten/``, ``Saisontabelle`` und ``Artenzaehlung`` sind
``daten/saison.json``. Sie erben dieselbe strenge Basis, darum faellt ein
Tippfehler in einer Datei beim Start auf und nicht erst in der Oberflaeche.
"""

from enum import StrEnum

from pydantic import Field, field_validator, model_validator

from app.shared.schemas import BaseSchema, Week

WEEKS = 52


class Tier(StrEnum):
    """Was die App zu einer Art zeigen kann. Die Datenlage entscheidet."""

    FORECAST = "vorhersage"
    SEASON = "saison"
    PROFILE = "profil"


class Group(StrEnum):
    """Die Verwandtschaft, mit der eine Art im Katalog steht."""

    BOLETE = "roehrling"
    ROUGH_STEMMED_BOLETE = "raufussroehrling"
    SLIPPERY_JACK = "schmierroehrling"
    CHANTERELLE = "leistling"
    HEDGEHOG = "stoppelpilz"
    MILKCAP = "milchling"
    BRITTLEGILL = "taeubling"
    PARASOL = "schirmling"
    AGARICUS = "champignon"
    INKCAP = "tintling"
    PUFFBALL = "staeubling"
    FUNNEL = "trichterling"
    BLEWIT = "roetelritterling"
    HONEY_FUNGUS = "hallimasch"
    SCALYCAP = "schueppling"
    TOUGHSHANK = "ruebling"
    PORCELAIN = "schleimruebling"
    OYSTER = "seitling"
    LIONS_MANE = "stachelbart"
    POLYPORE = "porling"
    CAULIFLOWER = "glucke"
    KNIGHT = "ritterling"
    PARACHUTE = "schwindling"
    WOODWAX = "schneckling"
    AMANITA = "wulstling"
    MOREL = "morchel"
    JELLY_EAR = "ohrlappenpilz"
    SPIKE = "gelbfuss"
    WEBCAP = "schleierling"
    DOMECAP = "rasling"
    PINKGILL = "roetling"
    SPINE_FUNGUS = "stachelpilz"
    CUP_FUNGUS = "becherling"


class TreeSpecies(StrEnum):
    """Der Baum, an dem eine Art waechst. Leer bei Zersetzern ohne Wirt."""

    SPRUCE = "fichte"
    PINE = "kiefer"
    FIR = "tanne"
    LARCH = "laerche"
    BEECH = "buche"
    OAK = "eiche"
    BIRCH = "birke"
    HORNBEAM = "hainbuche"
    POPLAR = "pappel"
    WILLOW = "weide"
    LIME = "linde"
    ASH = "esche"
    ELM = "ulme"
    MAPLE = "ahorn"
    CHESTNUT = "kastanie"
    ELDER = "holunder"
    FRUIT_TREE = "obstbaum"


class Season(StrEnum):
    """Wann eine Art fruchtet."""

    SPRING = "fruehling"
    SUMMER = "sommer"
    AUTUMN = "herbst"
    WINTER = "winter"


class Edibility(StrEnum):
    """Was mit einer Art in der Pfanne passieren darf."""

    CHOICE = "speisepilz"
    EDIBLE = "essbar"
    EDIBLE_WHEN_COOKED = "bedingtEssbar"
    NO_FOOD_VALUE = "ohneSpeisewert"
    NOT_RECOMMENDED = "nichtEmpfohlen"
    INEDIBLE = "ungeniessbar"
    POISONOUS = "giftig"
    DEADLY = "toedlichGiftig"


class TraitKey(StrEnum):
    """Die Zeilen der Merkmalstabelle.

    Die Reihenfolge hier ist die Reihenfolge auf der Artseite: erst der
    Fruchtkoerper, dann das Sporenlager, dann Stiel und Fleisch, zuletzt
    Standort und Zeit.
    """

    FRUITBODY = "fruchtkoerper"
    CAP = "hut"
    TUBES = "roehren"
    GILLS = "lamellen"
    FOLDS = "leisten"
    SPINES = "stacheln"
    PORES = "poren"
    MILK = "milch"
    STEM = "stiel"
    FLESH = "fleisch"
    SMELL = "geruch"
    TASTE = "geschmack"
    SPORE_PRINT = "sporenpulver"
    HABITAT = "vorkommen"
    SEASON = "zeit"
    EDIBILITY = "speisewert"
    PROTECTION = "schutz"


# Ein Chip in der Artenliste ist immer einer dieser vier Werte. Als Vereinigung
# bleibt jeder ein Enum, und keine Liste steht doppelt im Code.
type Tag = Tier | Group | Season | TreeSpecies


class Lookalike(BaseSchema):
    """Eine Art, die man mit dieser verwechselt, und das trennende Merkmal."""

    name: str
    trait: str = Field(validation_alias="merkmal", serialization_alias="merkmal")
    edible: Edibility = Field(validation_alias="essbar", serialization_alias="essbar")


class Link(BaseSchema):
    """Ein Link nach draussen. Nur die Adresse, kein fremder Text."""

    title: str = Field(validation_alias="titel", serialization_alias="titel")
    url: str


class Profile(BaseSchema):
    """Eine Datei unter ``daten/arten/<slug>.toml``.

    Der Dateiname ist der Slug. ``karte`` nennt das Manifest der Kette, wenn es
    anders heisst als der Slug.
    """

    name: str
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    group: Group = Field(validation_alias="gruppe", serialization_alias="gruppe")
    edibility: Edibility = Field(validation_alias="speisewert", serialization_alias="speisewert")
    protected: bool = Field(validation_alias="geschuetzt", serialization_alias="geschuetzt")
    seasons: list[Season] = Field(
        validation_alias="jahreszeiten", serialization_alias="jahreszeiten", min_length=1
    )
    trees: list[TreeSpecies] = Field(validation_alias="baeume", serialization_alias="baeume")
    map_name: str | None = Field(
        default=None, validation_alias="karte", serialization_alias="karte"
    )
    edibility_note: str | None = Field(
        default=None, validation_alias="speisewertHinweis", serialization_alias="speisewertHinweis"
    )
    protection_note: str | None = Field(
        default=None, validation_alias="schutzHinweis", serialization_alias="schutzHinweis"
    )
    traits: dict[TraitKey, str] = Field(validation_alias="merkmale", serialization_alias="merkmale")
    lookalikes: list[Lookalike] = Field(
        validation_alias="verwechslungen", serialization_alias="verwechslungen", min_length=1
    )
    links: list[Link] = Field(min_length=1)

    @field_validator("traits")
    @classmethod
    def _required_rows(cls, value: dict[TraitKey, str]) -> dict[TraitKey, str]:
        # Ohne Standort und Zeit ist ein Profil fuer den Sammler wertlos, und
        # die Artseite haette Luecken in der Tabelle.
        required = {
            TraitKey.FLESH,
            TraitKey.SMELL,
            TraitKey.SPORE_PRINT,
            TraitKey.HABITAT,
            TraitKey.SEASON,
        }
        missing = required - set(value)
        if missing:
            raise ValueError(f"Diese Merkmale fehlen: {', '.join(sorted(missing))}.")
        return value

    @field_validator("traits")
    @classmethod
    def _set_by_service(cls, value: dict[TraitKey, str]) -> dict[TraitKey, str]:
        # Speisewert und Schutz stellt der Dienst aus den Enums zusammen. Stuende
        # beides auch als Text in der Datei, koennten die zwei auseinanderlaufen.
        used = {TraitKey.EDIBILITY, TraitKey.PROTECTION} & set(value)
        if used:
            raise ValueError(f"Diese Merkmale setzt der Dienst: {', '.join(sorted(used))}.")
        return value


class SpeciesCounts(BaseSchema):
    """Die Zahlen einer Art in ``daten/saison.json``."""

    visits_with_find: int = Field(
        validation_alias="begehungenMitFund", serialization_alias="begehungenMitFund", ge=0
    )
    finds_per_week: list[int] = Field(
        validation_alias="fundeJeWoche",
        serialization_alias="fundeJeWoche",
        min_length=WEEKS,
        max_length=WEEKS,
    )
    finds_per_week_current_year: list[int] = Field(
        validation_alias="fundeJeWocheLaufendesJahr",
        serialization_alias="fundeJeWocheLaufendesJahr",
        min_length=WEEKS,
        max_length=WEEKS,
    )


class SeasonTable(BaseSchema):
    """``daten/saison.json``: Begehungen je Kalenderwoche, Funde je Art und Woche.

    Die Tabelle traegt ihren eigenen Stand. Der Dienst rechnet damit und nicht
    mit der Uhr des Servers, sonst haengt die Antwort vom Aufrufzeitpunkt ab.
    """

    as_of_year: int = Field(validation_alias="standJahr", serialization_alias="standJahr")
    as_of_week: int = Field(
        validation_alias="standWoche", serialization_alias="standWoche", ge=1, le=WEEKS
    )
    from_year: int = Field(validation_alias="vonJahr", serialization_alias="vonJahr")
    to_year: int = Field(validation_alias="bisJahr", serialization_alias="bisJahr")
    min_species: int = Field(validation_alias="minArten", serialization_alias="minArten", ge=1)
    visits_per_week: list[int] = Field(
        validation_alias="begehungenJeWoche",
        serialization_alias="begehungenJeWoche",
        min_length=WEEKS,
        max_length=WEEKS,
    )
    visits_per_week_current_year: list[int] = Field(
        validation_alias="begehungenJeWocheLaufendesJahr",
        serialization_alias="begehungenJeWocheLaufendesJahr",
        min_length=WEEKS,
        max_length=WEEKS,
    )
    species: dict[str, SpeciesCounts] = Field(validation_alias="arten", serialization_alias="arten")

    @model_validator(mode="after")
    def _years_match(self) -> "SeasonTable":
        # Die Flaeche der Kurve zeigt die abgeschlossenen Jahre, die Linie das
        # laufende. Ueberlappen sie, zaehlt die App Begehungen doppelt.
        if self.to_year != self.as_of_year - 1:
            raise ValueError("Das letzte geschlossene Jahr liegt vor dem laufenden.")
        if self.from_year > self.to_year:
            raise ValueError("Die Jahresspanne der Saisonkurve ist leer.")
        return self


class YearRange(BaseSchema):
    """Von welchem bis zu welchem Jahr eine Reihe zaehlt, beide eingeschlossen."""

    start: int = Field(validation_alias="von", serialization_alias="von")
    end: int = Field(validation_alias="bis", serialization_alias="bis")


class SeasonBrief(BaseSchema):
    """Die Kurve, wie die Artenliste sie klein zeichnet.

    Beide Reihen, weil die Zeile der Artenliste dieselbe Kurve zeigt wie die
    Artseite, nur kleiner. Die Nenner stehen am Kopf der Liste, nicht hier.
    """

    all_years: list[float] = Field(validation_alias="alleJahre", serialization_alias="alleJahre")
    current_year: list[float] = Field(
        validation_alias="laufendesJahr", serialization_alias="laufendesJahr"
    )
    maximum: float = Field(validation_alias="hoechstwert", serialization_alias="hoechstwert")


class SeasonCurve(BaseSchema):
    """Beide Reihen der Saisonkurve, je Kalenderwoche in Prozent.

    Ein Wert ist der Anteil der Begehungen einer Kalenderwoche, bei denen die
    Art gefunden wurde. ``begehungen`` ist der Nenner der Reihe ``alleJahre``.

    Die zwei ``begehungenJeWoche``-Reihen sind der Nenner selbst, je Woche.
    Ohne sie sieht eine Woche mit drei Begehungen aus wie eine mit dreihundert,
    und das laufende Jahr faellt am Ende ab, weil die Meldungen nachhinken.
    """

    all_years: list[float] = Field(validation_alias="alleJahre", serialization_alias="alleJahre")
    current_year: list[float] = Field(
        validation_alias="laufendesJahr", serialization_alias="laufendesJahr"
    )
    maximum: float = Field(validation_alias="hoechstwert", serialization_alias="hoechstwert")
    years: YearRange = Field(validation_alias="jahre", serialization_alias="jahre")
    as_of: Week = Field(validation_alias="stand", serialization_alias="stand")
    visits: int = Field(validation_alias="begehungen", serialization_alias="begehungen")
    visits_per_week_all_years: list[float] = Field(
        validation_alias="begehungenJeWocheAlleJahre",
        serialization_alias="begehungenJeWocheAlleJahre",
    )
    visits_per_week_current_year: list[int] = Field(
        validation_alias="begehungenJeWocheLaufendesJahr",
        serialization_alias="begehungenJeWocheLaufendesJahr",
    )


class Trait(BaseSchema):
    """Eine Zeile der Merkmalstabelle."""

    key: TraitKey = Field(validation_alias="schluessel", serialization_alias="schluessel")
    text: str


class SpeciesBrief(BaseSchema):
    """Eine Art in der Liste."""

    slug: str
    name: str
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    group: Group = Field(validation_alias="gruppe", serialization_alias="gruppe")
    tier: Tier = Field(validation_alias="stufe", serialization_alias="stufe")
    tags: list[Tag]
    protected: bool = Field(validation_alias="geschuetzt", serialization_alias="geschuetzt")
    edibility: Edibility = Field(validation_alias="speisewert", serialization_alias="speisewert")
    map_slug: str | None = Field(validation_alias="kartenSlug", serialization_alias="kartenSlug")
    forecast_planned: bool = Field(
        validation_alias="vorhersageGeplant", serialization_alias="vorhersageGeplant"
    )
    visits_with_find: int = Field(
        validation_alias="begehungenMitFund", serialization_alias="begehungenMitFund"
    )
    peak_week: int | None = Field(validation_alias="spitzeWoche", serialization_alias="spitzeWoche")
    season: SeasonBrief = Field(validation_alias="saison", serialization_alias="saison")


class Species(BaseSchema):
    """Eine Art mit Profil, so wie die Artseite sie braucht."""

    slug: str
    name: str
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    group: Group = Field(validation_alias="gruppe", serialization_alias="gruppe")
    tier: Tier = Field(validation_alias="stufe", serialization_alias="stufe")
    tags: list[Tag]
    protected: bool = Field(validation_alias="geschuetzt", serialization_alias="geschuetzt")
    edibility: Edibility = Field(validation_alias="speisewert", serialization_alias="speisewert")
    map_slug: str | None = Field(validation_alias="kartenSlug", serialization_alias="kartenSlug")
    forecast_planned: bool = Field(
        validation_alias="vorhersageGeplant", serialization_alias="vorhersageGeplant"
    )
    visits_with_find: int = Field(
        validation_alias="begehungenMitFund", serialization_alias="begehungenMitFund"
    )
    peak_week: int | None = Field(validation_alias="spitzeWoche", serialization_alias="spitzeWoche")
    traits: list[Trait] = Field(validation_alias="merkmale", serialization_alias="merkmale")
    lookalikes: list[Lookalike] = Field(
        validation_alias="verwechslungen", serialization_alias="verwechslungen"
    )
    links: list[Link]
    season: SeasonCurve = Field(validation_alias="saison", serialization_alias="saison")


class SpeciesList(BaseSchema):
    """Die Antwort auf ``GET /api/arten``.

    ``begehungen``, ``jahre`` und die zwei ``begehungenJeWoche``-Reihen gelten
    fuer alle Arten gleich und stehen darum einmal am Kopf statt in jeder Zeile.
    """

    as_of: Week = Field(validation_alias="stand", serialization_alias="stand")
    years: YearRange = Field(validation_alias="jahre", serialization_alias="jahre")
    visits: int = Field(validation_alias="begehungen", serialization_alias="begehungen")
    visits_per_week_all_years: list[float] = Field(
        validation_alias="begehungenJeWocheAlleJahre",
        serialization_alias="begehungenJeWocheAlleJahre",
    )
    visits_per_week_current_year: list[int] = Field(
        validation_alias="begehungenJeWocheLaufendesJahr",
        serialization_alias="begehungenJeWocheLaufendesJahr",
    )
    species: list[SpeciesBrief] = Field(validation_alias="arten", serialization_alias="arten")
