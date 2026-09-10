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

from app.shared.schemas import BasisModell, Woche

WOCHEN = 52


class Stufe(StrEnum):
    """Was die App zu einer Art zeigen kann. Die Datenlage entscheidet."""

    VORHERSAGE = "vorhersage"
    SAISON = "saison"
    PROFIL = "profil"
    # Eine Art, die nur im Katalog steht, weil man eine sammelbare mit ihr
    # verwechselt. Sie traegt keine Saisonkurve und keine Karte.
    VERWECHSLUNG = "verwechslung"


class Gruppe(StrEnum):
    """Die Verwandtschaft, mit der eine Art im Katalog steht."""

    ROEHRLING = "roehrling"
    RAUFUSSROEHRLING = "raufussroehrling"
    SCHMIERROEHRLING = "schmierroehrling"
    LEISTLING = "leistling"
    STOPPELPILZ = "stoppelpilz"
    MILCHLING = "milchling"
    TAEUBLING = "taeubling"
    SCHIRMLING = "schirmling"
    CHAMPIGNON = "champignon"
    TINTLING = "tintling"
    STAEUBLING = "staeubling"
    TRICHTERLING = "trichterling"
    ROETELRITTERLING = "roetelritterling"
    HALLIMASCH = "hallimasch"
    SCHUEPPLING = "schueppling"
    RUEBLING = "ruebling"
    SCHLEIMRUEBLING = "schleimruebling"
    SEITLING = "seitling"
    STACHELBART = "stachelbart"
    PORLING = "porling"
    GLUCKE = "glucke"
    RITTERLING = "ritterling"
    SCHWINDLING = "schwindling"
    SCHNECKLING = "schneckling"
    WULSTLING = "wulstling"
    MORCHEL = "morchel"
    OHRLAPPENPILZ = "ohrlappenpilz"
    GELBFUSS = "gelbfuss"
    SCHLEIERLING = "schleierling"
    RASLING = "rasling"
    ROETLING = "roetling"
    STACHELPILZ = "stachelpilz"
    BECHERLING = "becherling"


class Baumart(StrEnum):
    """Der Baum, an dem eine Art waechst. Leer bei Zersetzern ohne Wirt."""

    FICHTE = "fichte"
    KIEFER = "kiefer"
    TANNE = "tanne"
    LAERCHE = "laerche"
    DOUGLASIE = "douglasie"
    BUCHE = "buche"
    EICHE = "eiche"
    BIRKE = "birke"
    ERLE = "erle"
    HAINBUCHE = "hainbuche"
    HASEL = "hasel"
    PAPPEL = "pappel"
    WEIDE = "weide"
    LINDE = "linde"
    ESCHE = "esche"
    ULME = "ulme"
    AHORN = "ahorn"
    KASTANIE = "kastanie"
    HOLUNDER = "holunder"
    OBSTBAUM = "obstbaum"


class Haeufigkeit(StrEnum):
    """Wie oft man die Art findet, laut ihrer Quellseite."""

    SEHR_HAEUFIG = "sehrHaeufig"
    HAEUFIG = "haeufig"
    ZERSTREUT = "zerstreut"
    SELTEN = "selten"
    SEHR_SELTEN = "sehrSelten"


class Gefaehrdung(StrEnum):
    """Die Stufe der Roten Liste Deutschlands, wenn die Quellseite eine nennt."""

    VOM_AUSSTERBEN_BEDROHT = "vomAussterbenBedroht"
    STARK_GEFAEHRDET = "starkGefaehrdet"
    GEFAEHRDET = "gefaehrdet"
    UNBEKANNTES_AUSMASS = "unbekanntesAusmass"
    EXTREM_SELTEN = "extremSelten"
    VORWARNLISTE = "vorwarnliste"
    DATEN_UNZUREICHEND = "datenUnzureichend"


class Reagenz(StrEnum):
    """Die Chemikalien, mit denen ein Bestimmer eine Farbreaktion auslöst."""

    KOH = "koh"
    NAOH = "naoh"
    FESO4 = "feso4"
    GUAJAK = "guajak"
    MELZER = "melzer"
    ANILIN = "anilin"
    PHENOL = "phenol"
    AMMONIAK = "ammoniak"
    SULFOVANILLIN = "sulfovanillin"
    FORMALIN = "formalin"
    SCHAEFFER = "schaeffer"


class Jahreszeit(StrEnum):
    """Wann eine Art fruchtet."""

    FRUEHLING = "fruehling"
    SOMMER = "sommer"
    HERBST = "herbst"
    WINTER = "winter"


class Essbarkeit(StrEnum):
    """Was mit einer Art in der Pfanne passieren darf."""

    SPEISEPILZ = "speisepilz"
    ESSBAR = "essbar"
    BEDINGT_ESSBAR = "bedingtEssbar"
    OHNE_SPEISEWERT = "ohneSpeisewert"
    NICHT_EMPFOHLEN = "nichtEmpfohlen"
    UNGENIESSBAR = "ungeniessbar"
    GIFTIG = "giftig"
    TOEDLICH_GIFTIG = "toedlichGiftig"


class MerkmalSchluessel(StrEnum):
    """Die Zeilen der Merkmalstabelle.

    Die Reihenfolge hier ist die Reihenfolge auf der Artseite: erst der
    Fruchtkoerper, dann das Sporenlager, dann Stiel und Fleisch, zuletzt
    Standort und Zeit.
    """

    FRUCHTKOERPER = "fruchtkoerper"
    HUT = "hut"
    ROEHREN = "roehren"
    LAMELLEN = "lamellen"
    LEISTEN = "leisten"
    STACHELN = "stacheln"
    POREN = "poren"
    MILCH = "milch"
    STIEL = "stiel"
    FLEISCH = "fleisch"
    GERUCH = "geruch"
    GESCHMACK = "geschmack"
    SPORENPULVER = "sporenpulver"
    REAGENZIEN = "reagenzien"
    VORKOMMEN = "vorkommen"
    ZEIT = "zeit"
    SPEISEWERT = "speisewert"
    SCHUTZ = "schutz"


# Ein Chip in der Artenliste ist immer einer dieser vier Werte. Als Vereinigung
# bleibt jeder ein Enum, und keine Liste steht doppelt im Code.
type Tag = Stufe | Gruppe | Jahreszeit | Baumart


class Spanne(BasisModell):
    """Ein Messbereich, so wie 123pilzsuche ihn schreibt: 4 bis 20, selten bis 25."""

    von: float = Field(gt=0)
    bis: float = Field(gt=0)
    selten_bis: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _reihenfolge(self) -> "Spanne":
        if self.von > self.bis:
            raise ValueError("Der untere Wert einer Spanne liegt ueber dem oberen.")
        if self.selten_bis is not None and self.selten_bis < self.bis:
            raise ValueError("Der Ausnahmewert liegt unter dem oberen Wert.")
        return self


class Masse(BasisModell):
    """Die Zahlen, die die Quellseite nennt. Was sie nicht nennt, bleibt leer.

    Huete werden in Zentimetern breit gemessen, Sporen in Mikrometern. Ein Pilz
    hat entweder einen Hut oder einen Fruchtkoerper, nie beides.
    """

    hut_breite_cm: Spanne | None = None
    fruchtkoerper_breite_cm: Spanne | None = None
    fruchtkoerper_hoehe_cm: Spanne | None = None
    stiel_laenge_cm: Spanne | None = None
    stiel_dicke_cm: Spanne | None = None
    sporen_laenge_um: Spanne | None = None
    sporen_breite_um: Spanne | None = None


class Verwechslung(BasisModell):
    """Eine Art, die man mit dieser verwechselt, und das trennende Merkmal.

    ``slug`` zeigt auf das eigene Profil der Art, wenn es eines gibt. Das
    Frontend verlinkt darauf, damit man die Verwechslung nachschlagen kann,
    statt sie nur genannt zu bekommen.
    """

    name: str = Field(min_length=1)
    merkmal: str = Field(min_length=1)
    essbar: Essbarkeit
    slug: str | None = None


class Reagenzeintrag(BasisModell):
    """Eine Chemikalie und die Farbe, die sie am Pilz hervorruft."""

    reagenz: Reagenz
    reaktion: str = Field(min_length=1)


class Verweis(BasisModell):
    """Ein Link nach draussen. Nur die Adresse, kein fremder Text."""

    titel: str
    url: str


WERTIGKEIT_BESTE = 1
WERTIGKEIT_SCHWAECHSTE = 6


class Quelle(BasisModell):
    """Woher die Angaben eines Profils stammen und wann sie geprueft wurden.

    Die Texte sind selbst formuliert, die Fakten nicht selbst erfunden. Wer ein
    Merkmal anzweifelt, findet unter ``url`` die Seite, gegen die es zuletzt
    geprueft wurde.
    """

    url: str
    geprueft_am: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class Profil(BasisModell):
    """Eine Datei unter ``daten/arten/<slug>.toml``.

    Der Dateiname ist der Slug. ``karte`` nennt das Manifest der Kette, wenn es
    anders heisst als der Slug.
    """

    name: str = Field(min_length=1)
    lateinisch: str = Field(min_length=1)
    gruppe: Gruppe
    speisewert: Essbarkeit
    geschuetzt: bool
    jahreszeiten: list[Jahreszeit] = Field(min_length=1)
    baeume: list[Baumart]
    sammelbar: bool = True
    # Die Positivliste der DGfM. Nur was dort steht, darf in den Handel.
    marktfaehig: bool = False
    # Die "Relative Wertigkeit" von 123pilzsuche: 1 ist die beste Stufe,
    # 6 die schwaechste. Die Seite nennt sie nicht fuer jede Art.
    wertigkeit: int | None = Field(default=None, ge=WERTIGKEIT_BESTE, le=WERTIGKEIT_SCHWAECHSTE)
    haeufigkeit: Haeufigkeit | None = None
    gefaehrdung: Gefaehrdung | None = None
    weitere_namen: list[str] = Field(default_factory=list[str])
    synonyme: list[str] = Field(default_factory=list[str])
    masse: Masse = Field(default_factory=Masse)
    karte: str | None = None
    speisewert_hinweis: str | None = None
    schutz_hinweis: str | None = None
    quelle: Quelle
    reagenzien: list[Reagenzeintrag] = Field(default_factory=list["Reagenzeintrag"])
    merkmale: dict[MerkmalSchluessel, str]
    verwechslungen: list[Verwechslung] = Field(min_length=1)
    links: list[Verweis] = Field(min_length=1)

    @model_validator(mode="after")
    def _keine_karte_ohne_sammeln(self) -> "Profil":
        # Eine Verwechslungsart traegt kein Modell. Ein Manifest waere ein
        # Tippfehler, und die Stufe wuerde davon nicht vorhersage.
        if not self.sammelbar and self.karte:
            raise ValueError("Eine nicht sammelbare Art hat keine Karte.")
        return self

    @field_validator("merkmale")
    @classmethod
    def _keine_leere_zeile(cls, wert: dict[MerkmalSchluessel, str]) -> dict[MerkmalSchluessel, str]:
        # Eine leere Zeile in der Merkmalstabelle sieht aus wie ein Fehler der
        # App. Fehlt die Angabe, laesst man den Schluessel ganz weg.
        leer = [schluessel for schluessel, text in wert.items() if not text.strip()]
        if leer:
            raise ValueError(f"Diese Merkmale sind leer: {', '.join(sorted(leer))}.")
        return wert

    @field_validator("merkmale")
    @classmethod
    def _pflichtzeilen(cls, wert: dict[MerkmalSchluessel, str]) -> dict[MerkmalSchluessel, str]:
        # Ohne Standort und Zeit ist ein Profil fuer den Sammler wertlos, und
        # die Artseite haette Luecken in der Tabelle.
        pflicht = {
            MerkmalSchluessel.FLEISCH,
            MerkmalSchluessel.GERUCH,
            MerkmalSchluessel.SPORENPULVER,
            MerkmalSchluessel.VORKOMMEN,
            MerkmalSchluessel.ZEIT,
        }
        fehlt = pflicht - set(wert)
        if fehlt:
            raise ValueError(f"Diese Merkmale fehlen: {', '.join(sorted(fehlt))}.")
        return wert

    @field_validator("merkmale")
    @classmethod
    def _selbst_gesetzt(cls, wert: dict[MerkmalSchluessel, str]) -> dict[MerkmalSchluessel, str]:
        # Speisewert, Schutz und Reagenzien stellt der Dienst aus den Enums
        # zusammen. Stuenden sie auch als Text in der Datei, koennten Anzeige
        # und Filterwert auseinanderlaufen.
        gesetzt = {
            MerkmalSchluessel.SPEISEWERT,
            MerkmalSchluessel.SCHUTZ,
            MerkmalSchluessel.REAGENZIEN,
        } & set(wert)
        if gesetzt:
            raise ValueError(f"Diese Merkmale setzt der Dienst: {', '.join(sorted(gesetzt))}.")
        return wert


class Artenzaehlung(BasisModell):
    """Die Zahlen einer Art in ``daten/saison.json``."""

    begehungen_mit_fund: int = Field(ge=0)
    funde_je_woche: list[int] = Field(min_length=WOCHEN, max_length=WOCHEN)
    funde_je_woche_laufendes_jahr: list[int] = Field(min_length=WOCHEN, max_length=WOCHEN)


class Saisontabelle(BasisModell):
    """``daten/saison.json``: Begehungen je Kalenderwoche, Funde je Art und Woche.

    Die Tabelle traegt ihren eigenen Stand. Der Dienst rechnet damit und nicht
    mit der Uhr des Servers, sonst haengt die Antwort vom Aufrufzeitpunkt ab.
    """

    stand_jahr: int
    stand_woche: int = Field(ge=1, le=WOCHEN)
    von_jahr: int
    bis_jahr: int
    min_arten: int = Field(ge=1)
    begehungen_je_woche: list[int] = Field(min_length=WOCHEN, max_length=WOCHEN)
    begehungen_je_woche_laufendes_jahr: list[int] = Field(min_length=WOCHEN, max_length=WOCHEN)
    arten: dict[str, Artenzaehlung]

    @model_validator(mode="after")
    def _jahre_passen(self) -> "Saisontabelle":
        # Die Flaeche der Kurve zeigt die abgeschlossenen Jahre, die Linie das
        # laufende. Ueberlappen sie, zaehlt die App Begehungen doppelt.
        if self.bis_jahr != self.stand_jahr - 1:
            raise ValueError("Das letzte geschlossene Jahr liegt vor dem laufenden.")
        if self.von_jahr > self.bis_jahr:
            raise ValueError("Die Jahresspanne der Saisonkurve ist leer.")
        return self


class Jahresspanne(BasisModell):
    """Von welchem bis zu welchem Jahr eine Reihe zaehlt, beide eingeschlossen."""

    von: int
    bis: int


class SaisonKurz(BasisModell):
    """Die Kurve, wie die Artenliste sie klein zeichnet.

    Beide Reihen, weil die Zeile der Artenliste dieselbe Kurve zeigt wie die
    Artseite, nur kleiner. Die Nenner stehen am Kopf der Liste, nicht hier.
    """

    alle_jahre: list[float]
    laufendes_jahr: list[float]
    hoechstwert: float


class SaisonKurve(BasisModell):
    """Beide Reihen der Saisonkurve, je Kalenderwoche in Prozent.

    Ein Wert ist der Anteil der Begehungen einer Kalenderwoche, bei denen die
    Art gefunden wurde. ``begehungen`` ist der Nenner der Reihe ``alleJahre``.

    Die zwei ``begehungenJeWoche``-Reihen sind der Nenner selbst, je Woche.
    Ohne sie sieht eine Woche mit drei Begehungen aus wie eine mit dreihundert,
    und das laufende Jahr faellt am Ende ab, weil die Meldungen nachhinken.
    """

    alle_jahre: list[float]
    laufendes_jahr: list[float]
    hoechstwert: float
    jahre: Jahresspanne
    stand: Woche
    begehungen: int
    begehungen_je_woche_alle_jahre: list[float]
    begehungen_je_woche_laufendes_jahr: list[int]


class Marktfaehigkeit(BasisModell):
    """Ob die DGfM die Art auf ihrer Positivliste der Speisepilze fuehrt."""

    marktfaehig: bool
    quelle: Quelle


class Merkmal(BasisModell):
    """Eine Zeile der Merkmalstabelle."""

    schluessel: MerkmalSchluessel
    text: str


class ArtKurz(BasisModell):
    """Eine Art in der Liste."""

    slug: str
    name: str
    lateinisch: str
    gruppe: Gruppe
    stufe: Stufe
    tags: list[Tag]
    geschuetzt: bool
    speisewert: Essbarkeit
    karten_slug: str | None
    sammelbar: bool
    marktfaehig: bool
    wertigkeit: int | None
    haeufigkeit: Haeufigkeit | None
    vorhersage_geplant: bool
    begehungen_mit_fund: int
    spitze_woche: int | None
    saison: SaisonKurz | None


class Art(BasisModell):
    """Eine Art mit Profil, so wie die Artseite sie braucht."""

    slug: str
    name: str
    lateinisch: str
    gruppe: Gruppe
    stufe: Stufe
    tags: list[Tag]
    geschuetzt: bool
    speisewert: Essbarkeit
    karten_slug: str | None
    sammelbar: bool
    marktfaehigkeit: Marktfaehigkeit
    wertigkeit: int | None
    haeufigkeit: Haeufigkeit | None
    gefaehrdung: Gefaehrdung | None
    weitere_namen: list[str]
    synonyme: list[str]
    masse: Masse
    quelle: Quelle
    vorhersage_geplant: bool
    begehungen_mit_fund: int
    spitze_woche: int | None
    merkmale: list[Merkmal]
    verwechslungen: list[Verwechslung]
    links: list[Verweis]
    saison: SaisonKurve | None


class ArtenListe(BasisModell):
    """Die Antwort auf ``GET /api/arten``.

    ``begehungen``, ``jahre`` und die zwei ``begehungenJeWoche``-Reihen gelten
    fuer alle Arten gleich und stehen darum einmal am Kopf statt in jeder Zeile.
    """

    stand: Woche
    jahre: Jahresspanne
    begehungen: int
    begehungen_je_woche_alle_jahre: list[float]
    begehungen_je_woche_laufendes_jahr: list[int]
    arten: list[ArtKurz]
