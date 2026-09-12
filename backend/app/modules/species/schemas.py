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
MONTHS = 12


class Tier(StrEnum):
    """Was die App zu einer Art zeigen kann. Die Datenlage entscheidet.

    Eine Verwechslung ist keine Stufe. Sie ist eine Beziehung zwischen zwei
    Arten und steht in ``verwechslungen``, nicht als Eigenschaft einer Art.
    """

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
    """Wie gefaehrlich eine Art in der Pfanne ist. Fuenf Stufen, mehr nicht.

    Die Stufe kommt allein aus der Auszeichnung im Kopf der Quellseite.
    Garzeiten, Rohgiftigkeit und Unvertraeglichkeiten stehen im
    ``speisewertHinweis``: sie sagen, wie man die Art zubereitet, nicht ob man
    sie essen darf.

    Wie gut eine essbare Art schmeckt, ist keine Stufe der Gefahr. Das steht
    als ``wertigkeit`` im Profil, mit derselben Zahl wie auf der Quellseite.
    """

    EDIBLE = "essbar"
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


class Unit(StrEnum):
    """Die Einheit einer Messung. Sie steht am Wert, nicht im Feldnamen."""

    CM = "cm"
    MM = "mm"
    UM = "um"


class Range(BaseSchema):
    """Ein Messbereich, so wie 123pilzsuche ihn schreibt: 4 bis 20, selten bis 25.

    ``seltenVon`` und ``seltenBis`` sind die Ausreisser nach unten und oben.
    ``beschreibung`` traegt den Satz der Seite, wo er mehr sagt als die Zahlen,
    etwa "jung halbkugelig, spaeter polsterfoermig".
    """

    start: float = Field(validation_alias="von", serialization_alias="von", gt=0)
    end: float = Field(validation_alias="bis", serialization_alias="bis", gt=0)
    rare_from: float | None = Field(
        validation_alias="seltenVon", serialization_alias="seltenVon", default=None, gt=0
    )
    rare_until: float | None = Field(
        validation_alias="seltenBis", serialization_alias="seltenBis", default=None, gt=0
    )
    unit: Unit = Field(validation_alias="einheit", serialization_alias="einheit")
    description: str | None = Field(
        validation_alias="beschreibung",
        serialization_alias="beschreibung",
        default=None,
        min_length=1,
    )

    @model_validator(mode="after")
    def _order(self) -> "Range":
        if self.start > self.end:
            raise ValueError("Der untere Wert einer Spanne liegt ueber dem oberen.")
        if self.rare_until is not None and self.rare_until < self.end:
            raise ValueError("Der Ausnahmewert nach oben liegt unter dem oberen Wert.")
        if self.rare_from is not None and self.rare_from > self.start:
            raise ValueError("Der Ausnahmewert nach unten liegt ueber dem unteren Wert.")
        return self


class Colour(BaseSchema):
    """Eine Farbe mit Namen und Wert. Der Name steht in der Tabelle, der Wert im Feld."""

    name: str = Field(min_length=1)
    hex: str = Field(pattern=r"^#[0-9a-f]{6}$")


class ChangeSpeed(StrEnum):
    """Wie schnell eine Verfaerbung eintritt."""

    FAST = "schnell"
    SLOW = "langsam"


class ColourChange(BaseSchema):
    """Was beim Anschnitt oder auf Druck passiert: "blaut sofort"."""

    start: list[Colour] = Field(validation_alias="von", serialization_alias="von")
    end: list[Colour] = Field(validation_alias="nach", serialization_alias="nach", min_length=1)
    # Die Quellseite sagt nicht immer, wie schnell. Wo sie schweigt, bleibt das
    # Feld leer, statt eine Geschwindigkeit zu behaupten.
    speed: ChangeSpeed | None = Field(
        validation_alias="dauer", serialization_alias="dauer", default=None
    )


class Colours(BaseSchema):
    """Die Farben der Art, nach Koerperteil getrennt.

    Sie stehen als Werte und nicht als Satz, damit die Oberflaeche sie zeigen
    und ein Filter sie vergleichen kann. Der Satz bleibt in der Merkmalstabelle.
    """

    cap: list[Colour] = Field(
        validation_alias="hut", serialization_alias="hut", default_factory=list["Colour"]
    )
    hymenium: list[Colour] = Field(
        validation_alias="sporenlager",
        serialization_alias="sporenlager",
        default_factory=list["Colour"],
    )
    stem: list[Colour] = Field(
        validation_alias="stiel", serialization_alias="stiel", default_factory=list["Colour"]
    )
    flesh: list[Colour] = Field(
        validation_alias="fleisch", serialization_alias="fleisch", default_factory=list["Colour"]
    )
    spore_print: list[Colour] = Field(
        validation_alias="sporenpulver",
        serialization_alias="sporenpulver",
        default_factory=list["Colour"],
    )
    change: ColourChange | None = Field(
        validation_alias="verfaerbung", serialization_alias="verfaerbung", default=None
    )


class MonthRange(BaseSchema):
    """Von welchem bis zu welchem Monat, beide eingeschlossen.

    Liegt das Ende vor dem Anfang, laeuft die Spanne ueber den Jahreswechsel:
    November bis Februar ist eine Spanne, keine zwei.
    """

    start_month: int = Field(
        validation_alias="vonMonat", serialization_alias="vonMonat", ge=1, le=12
    )
    end_month: int = Field(validation_alias="bisMonat", serialization_alias="bisMonat", ge=1, le=12)


class Period(MonthRange):
    """Der Zeitraum der Quellseite. Dezember bis Februar laeuft ueber den Jahreswechsel."""

    peak_month: int | None = Field(
        validation_alias="spitzeMonat",
        serialization_alias="spitzeMonat",
        default=None,
        ge=1,
        le=12,
    )


class ProtectionStatus(StrEnum):
    """Der Schutz nach Bundesartenschutzverordnung."""

    NONE = "keiner"
    SPECIAL = "besondersGeschuetzt"
    STRICT = "strengGeschuetzt"


class Protection(BaseSchema):
    """Der Schutzstatus mit der Verordnung, aus der er stammt.

    Drei Stufen statt eines Schalters: "streng geschuetzt" und "fuer den
    Eigenbedarf" sind zwei verschiedene Sachen, die ein Ja oder Nein nicht
    trennen kann.
    """

    status: ProtectionStatus
    source: str = Field(validation_alias="quelle", serialization_alias="quelle", min_length=1)

    @property
    def restricted(self) -> bool:
        """Sagt, ob die Art ueberhaupt unter Schutz steht."""
        return self.status is not ProtectionStatus.NONE


class HymenophoreKind(StrEnum):
    """Woran die Sporen sitzen. Ein Fruchtkoerper hat genau eine dieser Formen.

    Die Liste kommt aus den Quellseiten und nicht aus dem Kopf: 177 Seiten
    fuehren eine Zeile "Lamellen", 64 "Roehren", 10 "Poren", 9 "Leisten" und
    6 "Stacheln". Poren stehen als eigener Wert, weil die Porlinge sie von den
    Roehren der Roehrlinge trennen; die Merkmalstabelle tut das schon.
    """

    GILLS = "lamellen"
    TUBES = "roehren"
    PORES = "poren"
    SPINES = "stacheln"
    FOLDS = "leisten"


class GillAttachment(StrEnum):
    """Wie die Lamellen den Stiel treffen. Das trennt den Champignon vom Wulstling."""

    FREE = "frei"
    ADNATE = "angewachsen"
    EMARGINATE = "ausgebuchtet"
    DECURRENT = "herablaufend"


class GillSpacing(StrEnum):
    """Wie dicht die Lamellen stehen."""

    CLOSE = "eng"
    NORMAL = "normal"
    DISTANT = "weit"


class GillEdge(StrEnum):
    """Wie die Schneide einer Lamelle aussieht."""

    SMOOTH = "glatt"
    SERRATE = "gesaegt"
    CILIATE = "bewimpert"


class Hymenophore(BaseSchema):
    """Die Fruchtschicht: woran die Sporen sitzen und wie sie stehen.

    Ansatz, Stand und Schneide gibt es nur an Lamellen. Roehren, Stacheln und
    Leisten tragen sie nicht, und ein Wert dort waere eine Behauptung ueber
    etwas, das die Art nicht hat.

    Die Farbe steht nicht hier: sie gehoert zu ``farben.sporenlager`` und
    stuende sonst an zwei Stellen.
    """

    kind: HymenophoreKind = Field(validation_alias="art", serialization_alias="art")
    attachment: GillAttachment | None = Field(
        validation_alias="ansatz", serialization_alias="ansatz", default=None
    )
    spacing: GillSpacing | None = Field(
        validation_alias="stand", serialization_alias="stand", default=None
    )
    edge: GillEdge | None = Field(
        validation_alias="schneide", serialization_alias="schneide", default=None
    )

    @model_validator(mode="after")
    def _only_gills_carry_the_rest(self) -> "Hymenophore":
        if self.kind is HymenophoreKind.GILLS:
            return self
        set_here = [
            name
            for name, value in (
                ("ansatz", self.attachment),
                ("stand", self.spacing),
                ("schneide", self.edge),
            )
            if value is not None
        ]
        if set_here:
            raise ValueError(f"Nur Lamellen tragen {', '.join(set_here)}, nicht {self.kind.value}.")
        return self


class TaggedText(BaseSchema):
    """Geruch oder Geschmack: Schlagworte aus dem Katalog und der Satz daneben.

    Die Schlagworte kommen aus der Tabelle ``begriff`` und nicht aus einem Enum,
    damit die Verwaltung sie erweitern kann. Der Satz bleibt, weil er mehr sagt
    als eine Liste.
    """

    tags: list[str] = Field(default_factory=list[str])
    text: str | None = Field(default=None, min_length=1)


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
    """Ein Paar von Arten, die man miteinander verwechselt.

    Der Eintrag traegt nur den Slug der anderen Art und die Saetze, die genau
    dieses Paar trennen. Name, Speisewert und Warnung stehen im Profil, auf das
    der Slug zeigt. Stuenden sie hier noch einmal, koennten die zwei Stellen
    auseinanderlaufen.

    Das Paar steht in genau einer der beiden Dateien. ``unterschied`` nennt,
    woran man die andere Art erkennt, ``eigenerUnterschied`` woran man die Art
    erkennt, in deren Datei der Eintrag steht. Der Dienst liefert das Paar
    daher aus beiden Richtungen.
    """

    slug: str = Field(min_length=1)
    difference: str = Field(
        validation_alias="unterschied", serialization_alias="unterschied", min_length=1
    )
    own_difference: str | None = Field(
        default=None,
        validation_alias="eigenerUnterschied",
        serialization_alias="eigenerUnterschied",
        min_length=1,
    )


class ResolvedLookalike(BaseSchema):
    """Ein Paar, wie die Antwort es ausliefert.

    Der Dienst schlaegt das Profil der anderen Art nach und legt seine Angaben
    dazu. Das Frontend muss nichts nachladen, um eine Verwechslung zu zeigen.

    ``unterschied`` bleibt leer, solange nur die andere Seite einen Satz zu dem
    Paar traegt. Der Name allein ist dann immer noch die Warnung, die zaehlt.
    """

    slug: str
    name: str
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    difference: str | None = Field(
        validation_alias="unterschied", serialization_alias="unterschied"
    )
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
    colours: Colours = Field(
        validation_alias="farben", serialization_alias="farben", default_factory=Colours
    )
    period: Period | None = Field(
        validation_alias="zeitraum", serialization_alias="zeitraum", default=None
    )
    protection: Protection = Field(validation_alias="schutz", serialization_alias="schutz")
    # Die Quellseite nennt die Fruchtschicht nicht bei jeder Art. Wo sie
    # schweigt, bleibt das Feld leer statt geraten.
    hymenophore: Hymenophore | None = Field(
        validation_alias="fruchtschicht", serialization_alias="fruchtschicht", default=None
    )
    smell: TaggedText = Field(
        validation_alias="geruch", serialization_alias="geruch", default_factory=TaggedText
    )
    taste: TaggedText = Field(
        validation_alias="geschmack", serialization_alias="geschmack", default_factory=TaggedText
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

    @model_validator(mode="after")
    def _one_record_per_pair(self) -> "Profile":
        # Derselbe Slug zweimal liesse zwei Saetze zu demselben Paar zu, und
        # die Artseite zeigte die Verwechslung doppelt.
        slugs = [entry.slug for entry in self.lookalikes]
        twice = sorted({slug for slug in slugs if slugs.count(slug) > 1})
        if twice:
            raise ValueError(f"Diese Verwechslungen stehen doppelt: {', '.join(twice)}.")
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

    Die Quelle steht nicht hier. Sie gilt fuer das ganze Profil und stuende
    sonst zweimal in derselben Antwort.
    """

    marketable: bool = Field(validation_alias="marktfaehig", serialization_alias="marktfaehig")
    switzerland: bool | None = Field(validation_alias="schweiz", serialization_alias="schweiz")


class Trait(BaseSchema):
    """Eine Zeile der Merkmalstabelle."""

    key: TraitKey = Field(validation_alias="schluessel", serialization_alias="schluessel")
    text: str


class SpeciesCommon(BaseSchema):
    """Was die Liste und die Artseite gleich zeigen.

    Beide Antworten tragen dieselben Angaben zu Name, Einordnung, Gefahr und
    Vorkommen. Sie stehen einmal hier, damit sie nicht an zwei Stellen
    auseinanderlaufen.
    """

    slug: str
    name: str
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    group: Group = Field(validation_alias="gruppe", serialization_alias="gruppe")
    tier: Tier = Field(validation_alias="stufe", serialization_alias="stufe")
    tags: list[Tag]
    protection: Protection = Field(validation_alias="schutz", serialization_alias="schutz")
    edibility: Edibility = Field(validation_alias="speisewert", serialization_alias="speisewert")
    map_slug: str | None = Field(validation_alias="kartenSlug", serialization_alias="kartenSlug")
    collectable: bool = Field(validation_alias="sammelbar", serialization_alias="sammelbar")
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
    forecast_planned: bool = Field(
        validation_alias="vorhersageGeplant", serialization_alias="vorhersageGeplant"
    )
    visits_with_find: int = Field(
        validation_alias="begehungenMitFund", serialization_alias="begehungenMitFund"
    )
    peak_week: int | None = Field(validation_alias="spitzeWoche", serialization_alias="spitzeWoche")


class SpeciesBrief(SpeciesCommon):
    """Eine Art in der Liste: dazu die kleine Kurve."""

    season: SeasonBrief | None = Field(validation_alias="saison", serialization_alias="saison")


class Species(SpeciesCommon):
    """Eine Art mit Profil, so wie die Artseite sie braucht."""

    measurements: Measurements = Field(validation_alias="masse", serialization_alias="masse")
    colours: Colours = Field(validation_alias="farben", serialization_alias="farben")
    period: Period | None = Field(validation_alias="zeitraum", serialization_alias="zeitraum")
    # Was die Kurve zeigt, nicht was die Quellseite sagt: die Wochen ueber der
    # halben Hoehe des Jahres. Ohne Kurve bleibt es leer.
    observed_period: MonthRange | None = Field(
        validation_alias="beobachteterZeitraum", serialization_alias="beobachteterZeitraum"
    )
    hymenophore: Hymenophore | None = Field(
        validation_alias="fruchtschicht", serialization_alias="fruchtschicht"
    )
    smell: TaggedText = Field(validation_alias="geruch", serialization_alias="geruch")
    taste: TaggedText = Field(validation_alias="geschmack", serialization_alias="geschmack")
    reagents: list[ReagentEntry] = Field(
        validation_alias="reagenzien", serialization_alias="reagenzien"
    )
    source: Source = Field(validation_alias="quelle", serialization_alias="quelle")
    traits: list[Trait] = Field(validation_alias="merkmale", serialization_alias="merkmale")
    # Beide Richtungen in einer Liste. Ein Paar steht in einer der zwei
    # Dateien, und der Dienst dreht es fuer die andere Seite um.
    lookalikes: list[ResolvedLookalike] = Field(
        validation_alias="verwechslungen", serialization_alias="verwechslungen"
    )
    links: list[Link]
    season: SeasonCurve | None = Field(validation_alias="saison", serialization_alias="saison")


class SpeciesQuery(BaseSchema):
    """Die Abfrage von ``GET /api/arten``, jedes Feld eine Und-Bedingung.

    Sie steht als Modell und nicht als sechzehn Parameter, damit die Bedingungen
    an einer Stelle stehen und die OpenAPI sie zusammen zeigt.
    """

    collectable: bool = Field(
        validation_alias="sammelbar",
        serialization_alias="sammelbar",
        default=True,
        description="true liefert die sammelbaren Arten, false die Verwechslungsarten.",
    )
    all_groups: bool = Field(
        validation_alias="alle",
        serialization_alias="alle",
        default=False,
        description="Liefert beide Gruppen zusammen und schlaegt sammelbar.",
    )
    group: Group | None = Field(
        validation_alias="gruppe", serialization_alias="gruppe", default=None
    )
    tier: Tier | None = Field(validation_alias="stufe", serialization_alias="stufe", default=None)
    edibility: Edibility | None = Field(
        validation_alias="speisewert", serialization_alias="speisewert", default=None
    )
    protection: ProtectionStatus | None = Field(
        validation_alias="schutz", serialization_alias="schutz", default=None
    )
    frequency: Frequency | None = Field(
        validation_alias="haeufigkeit", serialization_alias="haeufigkeit", default=None
    )
    red_list: RedListStatus | None = Field(
        validation_alias="gefaehrdung", serialization_alias="gefaehrdung", default=None
    )
    rating: int | None = Field(
        validation_alias="wertigkeit",
        serialization_alias="wertigkeit",
        default=None,
        ge=BEST_RATING,
        le=WEAKEST_RATING,
    )
    marketable: bool | None = Field(
        validation_alias="marktfaehig", serialization_alias="marktfaehig", default=None
    )
    smell: str | None = Field(validation_alias="geruch", serialization_alias="geruch", default=None)
    taste: str | None = Field(
        validation_alias="geschmack", serialization_alias="geschmack", default=None
    )
    tree: str | None = Field(validation_alias="baum", serialization_alias="baum", default=None)
    month: int | None = Field(
        validation_alias="monat", serialization_alias="monat", default=None, ge=1, le=12
    )
    colour: str | None = Field(validation_alias="farbe", serialization_alias="farbe", default=None)
    hymenophore: HymenophoreKind | None = Field(
        validation_alias="fruchtschicht", serialization_alias="fruchtschicht", default=None
    )
    attachment: GillAttachment | None = Field(
        validation_alias="ansatz", serialization_alias="ansatz", default=None
    )
    spacing: GillSpacing | None = Field(
        validation_alias="stand", serialization_alias="stand", default=None
    )
    edge: GillEdge | None = Field(
        validation_alias="schneide", serialization_alias="schneide", default=None
    )


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
