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
    # Eine Art, die nur im Katalog steht, weil man eine sammelbare mit ihr
    # verwechselt. Sie traegt keine Saisonkurve und keine Karte.
    LOOKALIKE = "verwechslung"


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
    DOUGLAS_FIR = "douglasie"
    BEECH = "buche"
    OAK = "eiche"
    BIRCH = "birke"
    ALDER = "erle"
    BLACK_LOCUST = "robinie"
    YEW = "eibe"
    LABURNUM = "goldregen"
    BILBERRY = "heidelbeere"
    HOLM_OAK = "steineiche"
    HORNBEAM = "hainbuche"
    HAZEL = "hasel"
    POPLAR = "pappel"
    WILLOW = "weide"
    LIME = "linde"
    ASH = "esche"
    ELM = "ulme"
    MAPLE = "ahorn"
    CHESTNUT = "kastanie"
    ELDER = "holunder"
    FRUIT_TREE = "obstbaum"


class Frequency(StrEnum):
    """Wie oft man die Art findet, laut ihrer Quellseite."""

    VERY_COMMON = "sehrHaeufig"
    COMMON = "haeufig"
    SCATTERED = "zerstreut"
    RARE = "selten"
    VERY_RARE = "sehrSelten"


class RedListStatus(StrEnum):
    """Die Stufe der Roten Liste Deutschlands, wenn die Quellseite eine nennt."""

    CRITICALLY_ENDANGERED = "vomAussterbenBedroht"
    ENDANGERED = "starkGefaehrdet"
    VULNERABLE = "gefaehrdet"
    UNKNOWN_EXTENT = "unbekanntesAusmass"
    EXTREMELY_RARE = "extremSelten"
    NEAR_THREATENED = "vorwarnliste"
    DATA_DEFICIENT = "datenUnzureichend"


class Reagent(StrEnum):
    """Die Chemikalien, mit denen ein Bestimmer eine Farbreaktion auslöst."""

    KOH = "koh"
    NAOH = "naoh"
    FESO4 = "feso4"
    GUAIAC = "guajak"
    MELZER = "melzer"
    ANILINE = "anilin"
    PHENOL = "phenol"
    AMMONIA = "ammoniak"
    SULFOVANILLIN = "sulfovanillin"
    FORMALIN = "formalin"
    FECL3 = "fecl3"
    WIELAND = "wieland"
    SCHAEFFER = "schaeffer"


class Season(StrEnum):
    """Wann eine Art fruchtet."""

    SPRING = "fruehling"
    SUMMER = "sommer"
    AUTUMN = "herbst"
    WINTER = "winter"


class Edibility(StrEnum):
    """Was mit einer Art in der Pfanne passieren darf.

    Die Stufe kommt allein aus der Auszeichnung im Kopf der Quellseite und dem
    Zusatz dahinter. Garzeiten, Rohgiftigkeit und Unvertraeglichkeiten stehen
    im ``speisewertHinweis``: sie sagen, wie man die Art zubereitet, nicht ob
    man sie essen darf.
    """

    EXCELLENT = "sehrGuterSpeisepilz"
    CHOICE = "guterSpeisepilz"
    EDIBLE = "essbar"
    POOR = "minderwertig"
    EDIBLE_WHEN_COOKED = "bedingtEssbar"
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
    REAGENTS = "reagenzien"
    HABITAT = "vorkommen"
    SEASON = "zeit"
    EDIBILITY = "speisewert"
    PROTECTION = "schutz"


# Ein Chip in der Artenliste ist immer einer dieser vier Werte. Als Vereinigung
# bleibt jeder ein Enum, und keine Liste steht doppelt im Code.
type Tag = Tier | Group | Season | TreeSpecies


class Range(BaseSchema):
    """Ein Messbereich, so wie 123pilzsuche ihn schreibt: 4 bis 20, selten bis 25."""

    start: float = Field(validation_alias="von", serialization_alias="von", gt=0)
    end: float = Field(validation_alias="bis", serialization_alias="bis", gt=0)
    rare_until: float | None = Field(
        validation_alias="seltenBis", serialization_alias="seltenBis", default=None, gt=0
    )

    @model_validator(mode="after")
    def _order(self) -> "Range":
        if self.start > self.end:
            raise ValueError("Der untere Wert einer Spanne liegt ueber dem oberen.")
        if self.rare_until is not None and self.rare_until < self.end:
            raise ValueError("Der Ausnahmewert liegt unter dem oberen Wert.")
        return self


class Measurements(BaseSchema):
    """Die Zahlen, die die Quellseite nennt. Was sie nicht nennt, bleibt leer.

    Huete werden in Zentimetern breit gemessen, Sporen in Mikrometern. Ein Pilz
    hat entweder einen Hut oder einen Fruchtkoerper, nie beides.
    """

    cap_width_cm: Range | None = Field(
        default=None, validation_alias="hutBreiteCm", serialization_alias="hutBreiteCm"
    )
    fruitbody_width_cm: Range | None = Field(
        default=None,
        validation_alias="fruchtkoerperBreiteCm",
        serialization_alias="fruchtkoerperBreiteCm",
    )
    fruitbody_height_cm: Range | None = Field(
        default=None,
        validation_alias="fruchtkoerperHoeheCm",
        serialization_alias="fruchtkoerperHoeheCm",
    )
    stem_length_cm: Range | None = Field(
        default=None, validation_alias="stielLaengeCm", serialization_alias="stielLaengeCm"
    )
    stem_thickness_cm: Range | None = Field(
        default=None, validation_alias="stielDickeCm", serialization_alias="stielDickeCm"
    )
    spore_length_um: Range | None = Field(
        default=None, validation_alias="sporenLaengeUm", serialization_alias="sporenLaengeUm"
    )
    spore_width_um: Range | None = Field(
        default=None, validation_alias="sporenBreiteUm", serialization_alias="sporenBreiteUm"
    )


FROM_EXPERIENCE = "eigene Erfahrung"


class TreeSource(BaseSchema):
    """Baeume, die 123pilzsuche nicht nennt, das Projekt aber kennt.

    Sie stehen getrennt von ``baeume``, damit man sieht, welche Angabe belegt
    ist und welche aus dem eigenen Sammeln stammt. Die Chips der Artenliste
    zeigen beide Listen zusammen.
    """

    trees: list[TreeSpecies] = Field(
        validation_alias="baeume", serialization_alias="baeume", min_length=1
    )
    source: str = Field(
        validation_alias="quelle", serialization_alias="quelle", pattern=f"^{FROM_EXPERIENCE}$"
    )


class Lookalike(BaseSchema):
    """Ein Verweis auf die Art, mit der man diese verwechselt.

    Der Eintrag traegt nur den Slug und den Satz, der genau dieses Paar trennt.
    Name, Speisewert und Warnung stehen im Profil, auf das der Slug zeigt.
    Stuenden sie hier noch einmal, koennten die zwei Stellen auseinanderlaufen.

    Der Satz gehoert zum Paar, nicht zur Art: dieselbe Art trennt sich von
    einem Steinpilz an einem anderen Merkmal als von einem Maronenroehrling.
    """

    slug: str = Field(min_length=1)
    difference: str = Field(
        validation_alias="unterschied", serialization_alias="unterschied", min_length=1
    )


class ResolvedLookalike(BaseSchema):
    """Ein Verweis, wie die Antwort ihn ausliefert.

    Der Dienst schlaegt das Profil des Ziels nach und legt seine Angaben dazu.
    Das Frontend muss nichts nachladen, um eine Verwechslung zu zeigen.
    """

    slug: str
    name: str
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    difference: str = Field(validation_alias="unterschied", serialization_alias="unterschied")
    edibility: Edibility = Field(validation_alias="speisewert", serialization_alias="speisewert")
    warning: str | None = Field(validation_alias="warnung", serialization_alias="warnung")


class ReagentEntry(BaseSchema):
    """Eine Chemikalie und die Farbe, die sie am Pilz hervorruft."""

    reagent: Reagent = Field(validation_alias="reagenz", serialization_alias="reagenz")
    reaction: str = Field(validation_alias="reaktion", serialization_alias="reaktion", min_length=1)


class Link(BaseSchema):
    """Ein Link nach draussen. Nur die Adresse, kein fremder Text."""

    title: str = Field(validation_alias="titel", serialization_alias="titel")
    url: str


BEST_RATING = 1
WEAKEST_RATING = 6


class Source(BaseSchema):
    """Woher die Angaben eines Profils stammen und wann sie geprueft wurden.

    Die Texte sind selbst formuliert, die Fakten nicht selbst erfunden. Wer ein
    Merkmal anzweifelt, findet unter ``url`` die Seite, gegen die es zuletzt
    geprueft wurde.
    """

    url: str
    checked_on: str = Field(
        validation_alias="geprueftAm",
        serialization_alias="geprueftAm",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    )


class Profile(BaseSchema):
    """Eine Datei unter ``daten/arten/<slug>.toml``.

    Der Dateiname ist der Slug. ``karte`` nennt das Manifest der Kette, wenn es
    anders heisst als der Slug.
    """

    name: str = Field(min_length=1)
    scientific: str = Field(
        validation_alias="lateinisch", serialization_alias="lateinisch", min_length=1
    )
    group: Group = Field(validation_alias="gruppe", serialization_alias="gruppe")
    edibility: Edibility = Field(validation_alias="speisewert", serialization_alias="speisewert")
    protected: bool = Field(validation_alias="geschuetzt", serialization_alias="geschuetzt")
    seasons: list[Season] = Field(
        validation_alias="jahreszeiten", serialization_alias="jahreszeiten", min_length=1
    )
    trees: list[TreeSpecies] = Field(validation_alias="baeume", serialization_alias="baeume")
    trees_from_experience: TreeSource | None = Field(
        default=None,
        validation_alias="baeumeAusErfahrung",
        serialization_alias="baeumeAusErfahrung",
    )
    # Eine Art, die in der Kette steht und trotzdem giftig ist, braucht auf der
    # Artseite mehr als eine Enum-Stufe. Der Satz steht ueber der Tabelle.
    warning: str | None = Field(
        validation_alias="warnung", serialization_alias="warnung", default=None, min_length=1
    )
    collectable: bool = Field(
        default=True, validation_alias="sammelbar", serialization_alias="sammelbar"
    )
    # Die Positivliste der DGfM. Nur was dort steht, darf in den Handel.
    marketable: bool = Field(
        default=False, validation_alias="marktfaehig", serialization_alias="marktfaehig"
    )
    marketable_switzerland: bool | None = Field(
        default=None,
        validation_alias="marktfaehigSchweiz",
        serialization_alias="marktfaehigSchweiz",
    )
    # Die "Relative Wertigkeit" von 123pilzsuche: 1 ist die beste Stufe,
    # 6 die schwaechste. Die Seite nennt sie nicht fuer jede Art.
    rating: int | None = Field(
        validation_alias="wertigkeit",
        serialization_alias="wertigkeit",
        default=None,
        ge=BEST_RATING,
        le=WEAKEST_RATING,
    )
    frequency: Frequency | None = Field(
        default=None, validation_alias="haeufigkeit", serialization_alias="haeufigkeit"
    )
    red_list: RedListStatus | None = Field(
        default=None, validation_alias="gefaehrdung", serialization_alias="gefaehrdung"
    )
    other_names: list[str] = Field(
        validation_alias="weitereNamen",
        serialization_alias="weitereNamen",
        default_factory=list[str],
    )
    synonyms: list[str] = Field(
        validation_alias="synonyme", serialization_alias="synonyme", default_factory=list[str]
    )
    measurements: Measurements = Field(
        validation_alias="masse", serialization_alias="masse", default_factory=Measurements
    )
    map_name: str | None = Field(
        default=None, validation_alias="karte", serialization_alias="karte"
    )
    edibility_note: str | None = Field(
        default=None, validation_alias="speisewertHinweis", serialization_alias="speisewertHinweis"
    )
    protection_note: str | None = Field(
        default=None, validation_alias="schutzHinweis", serialization_alias="schutzHinweis"
    )
    source: Source = Field(validation_alias="quelle", serialization_alias="quelle")
    reagents: list[ReagentEntry] = Field(
        validation_alias="reagenzien",
        serialization_alias="reagenzien",
        default_factory=list["ReagentEntry"],
    )
    traits: dict[TraitKey, str] = Field(validation_alias="merkmale", serialization_alias="merkmale")
    # Eine Art ohne Verweis gibt es: 123pilzsuche nennt dort nur Arten ohne
    # eigene Seite, und ein Verweis ins Leere waere schlechter als keiner.
    lookalikes: list[Lookalike] = Field(
        validation_alias="verwechslungen",
        serialization_alias="verwechslungen",
        default_factory=list["Lookalike"],
    )
    links: list[Link] = Field(min_length=1)

    @model_validator(mode="after")
    def _poisonous_species_warn(self) -> "Profile":
        # Wer eine giftige Art im Katalog der sammelbaren findet, muss den Grund
        # sofort lesen und nicht erst in der Zeile Speisewert suchen.
        poisonous = {Edibility.POISONOUS, Edibility.DEADLY}
        if self.collectable and self.edibility in poisonous and not self.warning:
            raise ValueError("Eine giftige sammelbare Art braucht eine Warnung.")
        return self

    @model_validator(mode="after")
    def _no_map_without_collecting(self) -> "Profile":
        # Eine Verwechslungsart traegt kein Modell. Ein Manifest waere ein
        # Tippfehler, und die Stufe wuerde davon nicht vorhersage.
        if not self.collectable and self.map_name:
            raise ValueError("Eine nicht sammelbare Art hat keine Karte.")
        return self

    @field_validator("traits")
    @classmethod
    def _no_empty_row(cls, value: dict[TraitKey, str]) -> dict[TraitKey, str]:
        # Eine leere Zeile in der Merkmalstabelle sieht aus wie ein Fehler der
        # App. Fehlt die Angabe, laesst man den Schluessel ganz weg.
        empty = [key for key, text in value.items() if not text.strip()]
        if empty:
            raise ValueError(f"Diese Merkmale sind leer: {', '.join(sorted(empty))}.")
        return value

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
        # Speisewert, Schutz und Reagenzien stellt der Dienst aus den Enums
        # zusammen. Stuenden sie auch als Text in der Datei, koennten Anzeige
        # und Filterwert auseinanderlaufen.
        used = {
            TraitKey.EDIBILITY,
            TraitKey.PROTECTION,
            TraitKey.REAGENTS,
        } & set(value)
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


class Marketability(BaseSchema):
    """Was die Zeile "Relativer Speisewert" der Quellseite zum Handel sagt.

    Sie nennt die Positivliste der DGfM und die Marktfaehigkeit in der Schweiz.
    Die Zeile steht bei jeder Art und ist darum genauer als eine Gesamtliste.
    """

    marketable: bool = Field(validation_alias="marktfaehig", serialization_alias="marktfaehig")
    switzerland: bool | None = Field(validation_alias="schweiz", serialization_alias="schweiz")
    source: Source = Field(validation_alias="quelle", serialization_alias="quelle")


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
    collectable: bool = Field(validation_alias="sammelbar", serialization_alias="sammelbar")
    marketable: bool = Field(validation_alias="marktfaehig", serialization_alias="marktfaehig")
    marketable_switzerland: bool | None = Field(
        validation_alias="marktfaehigSchweiz", serialization_alias="marktfaehigSchweiz"
    )
    rating: int | None = Field(validation_alias="wertigkeit", serialization_alias="wertigkeit")
    frequency: Frequency | None = Field(
        validation_alias="haeufigkeit", serialization_alias="haeufigkeit"
    )
    red_list: RedListStatus | None = Field(
        validation_alias="gefaehrdung", serialization_alias="gefaehrdung"
    )
    warning: str | None = Field(validation_alias="warnung", serialization_alias="warnung")
    seasons: list[Season] = Field(
        validation_alias="jahreszeiten", serialization_alias="jahreszeiten"
    )
    trees: list[TreeSpecies] = Field(validation_alias="baeume", serialization_alias="baeume")
    trees_from_experience: TreeSource | None = Field(
        validation_alias="baeumeAusErfahrung", serialization_alias="baeumeAusErfahrung"
    )
    other_names: list[str] = Field(
        validation_alias="weitereNamen", serialization_alias="weitereNamen"
    )
    synonyms: list[str] = Field(validation_alias="synonyme", serialization_alias="synonyme")
    forecast_planned: bool = Field(
        validation_alias="vorhersageGeplant", serialization_alias="vorhersageGeplant"
    )
    visits_with_find: int = Field(
        validation_alias="begehungenMitFund", serialization_alias="begehungenMitFund"
    )
    peak_week: int | None = Field(validation_alias="spitzeWoche", serialization_alias="spitzeWoche")
    season: SeasonBrief | None = Field(validation_alias="saison", serialization_alias="saison")


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
    collectable: bool = Field(validation_alias="sammelbar", serialization_alias="sammelbar")
    marketable: bool = Field(validation_alias="marktfaehig", serialization_alias="marktfaehig")
    marketable_switzerland: bool | None = Field(
        validation_alias="marktfaehigSchweiz", serialization_alias="marktfaehigSchweiz"
    )
    marketability: Marketability = Field(
        validation_alias="marktfaehigkeit", serialization_alias="marktfaehigkeit"
    )
    rating: int | None = Field(validation_alias="wertigkeit", serialization_alias="wertigkeit")
    frequency: Frequency | None = Field(
        validation_alias="haeufigkeit", serialization_alias="haeufigkeit"
    )
    red_list: RedListStatus | None = Field(
        validation_alias="gefaehrdung", serialization_alias="gefaehrdung"
    )
    warning: str | None = Field(validation_alias="warnung", serialization_alias="warnung")
    seasons: list[Season] = Field(
        validation_alias="jahreszeiten", serialization_alias="jahreszeiten"
    )
    trees: list[TreeSpecies] = Field(validation_alias="baeume", serialization_alias="baeume")
    trees_from_experience: TreeSource | None = Field(
        validation_alias="baeumeAusErfahrung", serialization_alias="baeumeAusErfahrung"
    )
    other_names: list[str] = Field(
        validation_alias="weitereNamen", serialization_alias="weitereNamen"
    )
    synonyms: list[str] = Field(validation_alias="synonyme", serialization_alias="synonyme")
    measurements: Measurements = Field(validation_alias="masse", serialization_alias="masse")
    reagents: list[ReagentEntry] = Field(
        validation_alias="reagenzien", serialization_alias="reagenzien"
    )
    source: Source = Field(validation_alias="quelle", serialization_alias="quelle")
    forecast_planned: bool = Field(
        validation_alias="vorhersageGeplant", serialization_alias="vorhersageGeplant"
    )
    visits_with_find: int = Field(
        validation_alias="begehungenMitFund", serialization_alias="begehungenMitFund"
    )
    peak_week: int | None = Field(validation_alias="spitzeWoche", serialization_alias="spitzeWoche")
    traits: list[Trait] = Field(validation_alias="merkmale", serialization_alias="merkmale")
    lookalikes: list[ResolvedLookalike] = Field(
        validation_alias="verwechslungen", serialization_alias="verwechslungen"
    )
    # Die Gegenrichtung: bei welchen Arten diese als Verwechslung steht. Die
    # Seite eines Giftpilzes fuehrt damit zurueck zu dem, was man sammeln wollte.
    affects: list[str] = Field(validation_alias="betrifft", serialization_alias="betrifft")
    links: list[Link]
    season: SeasonCurve | None = Field(validation_alias="saison", serialization_alias="saison")


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
