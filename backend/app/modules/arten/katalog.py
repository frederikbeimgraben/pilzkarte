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

from app.core.errors import NichtGefunden
from app.modules.arten.schemas import (
    WOCHEN,
    Art,
    ArtenListe,
    Artenzaehlung,
    ArtKurz,
    Essbarkeit,
    Jahresspanne,
    Merkmal,
    MerkmalSchluessel,
    Profil,
    SaisonKurve,
    SaisonKurz,
    Saisontabelle,
    Stufe,
    Tag,
)
from app.shared.schemas import Woche

# Der Ordner liegt neben ``app`` und wird mit dem Backend ausgeliefert. Ein
# eigener Pfad in der Umgebung waere ein weiterer Vertrag zum NixOS-Modul.
DATEN = Path(__file__).resolve().parents[3] / "daten"

SCHWELLE_VORHERSAGE = 600
SCHWELLE_SAISON = 60

# Diese Texte stehen in der Merkmalstabelle der Artseite. Sie tragen darum
# Umlaute, anders als die Bezeichner und Docstrings dieses Projekts.
SPEISEWERT_TEXT: dict[Essbarkeit, str] = {
    Essbarkeit.SPEISEPILZ: "Guter Speisepilz.",
    Essbarkeit.ESSBAR: "Essbar.",
    Essbarkeit.BEDINGT_ESSBAR: "Nur gegart essbar.",
    Essbarkeit.OHNE_SPEISEWERT: "Essbar, aber ohne Wert.",
    Essbarkeit.NICHT_EMPFOHLEN: "Wird nicht zum Essen empfohlen.",
    Essbarkeit.UNGENIESSBAR: "Ungenie\u00dfbar.",
    Essbarkeit.GIFTIG: "Giftig.",
    Essbarkeit.TOEDLICH_GIFTIG: "T\u00f6dlich giftig.",
}

SCHUTZ_JA = (
    "Besonders gesch\u00fctzt nach Bundesartenschutzverordnung. Entnahme nur in "
    "geringen Mengen f\u00fcr den Eigenbedarf, nicht in Schutzgebieten."
)
SCHUTZ_NEIN = (
    "Nicht besonders gesch\u00fctzt. Es gelten die Regeln des Landes und des Waldbesitzers."
)


def stufe_fuer(begehungen_mit_fund: int) -> Stufe:
    """Die Stufe einer Art, entschieden von ihren Begehungen mit Fund seit 2015."""
    if begehungen_mit_fund >= SCHWELLE_VORHERSAGE:
        return Stufe.VORHERSAGE
    if begehungen_mit_fund >= SCHWELLE_SAISON:
        return Stufe.SAISON
    return Stufe.PROFIL


def anteil_je_woche(funde: Sequence[int], begehungen: Sequence[int]) -> list[float]:
    """Anteil der Begehungen mit Fund je Kalenderwoche, in Prozent.

    Eine Woche ohne Begehung ist keine Woche ohne Pilz. Sie bekommt 0 Prozent,
    weil die Kurve sonst eine Luecke haette, die die Oberflaeche nicht zeichnen
    kann.
    """
    return [
        round(100 * fund / begehung, 1) if begehung else 0.0
        for fund, begehung in zip(funde, begehungen, strict=True)
    ]


def spitze_woche_fuer(anteile: Sequence[float]) -> int | None:
    """Die Kalenderwoche mit dem hoechsten Anteil, oder nichts ohne einen Fund."""
    hoechster = max(anteile)
    if hoechster <= 0:
        return None
    return anteile.index(hoechster) + 1


def merkmale_bauen(profil: Profil) -> list[Merkmal]:
    """Die Merkmalstabelle in der Reihenfolge der Artseite.

    Speisewert und Schutz kommen aus den Enums des Profils, damit Text und
    Filterwert nicht auseinanderlaufen koennen.
    """
    zeilen = dict(profil.merkmale)
    speisewert = SPEISEWERT_TEXT[profil.speisewert]
    if profil.speisewert_hinweis:
        speisewert = f"{speisewert} {profil.speisewert_hinweis}"
    zeilen[MerkmalSchluessel.SPEISEWERT] = speisewert
    schutz = SCHUTZ_JA if profil.geschuetzt else SCHUTZ_NEIN
    if profil.schutz_hinweis:
        schutz = f"{schutz} {profil.schutz_hinweis}"
    zeilen[MerkmalSchluessel.SCHUTZ] = schutz
    return [
        Merkmal(schluessel=schluessel, text=zeilen[schluessel])
        for schluessel in MerkmalSchluessel
        if schluessel in zeilen
    ]


def tags_bauen(profil: Profil, stufe: Stufe) -> list[Tag]:
    """Die Chips einer Art: erst die Stufe, dann Gruppe, Jahreszeit und Baum."""
    return [stufe, profil.gruppe, *profil.jahreszeiten, *profil.baeume]


def profile_lesen(ordner: Path) -> dict[str, Profil]:
    """Liest jede Profildatei des Ordners. Der Dateiname ist der Slug."""
    profile: dict[str, Profil] = {}
    for datei in sorted(ordner.glob("*.toml")):
        rohdaten = tomllib.loads(datei.read_text(encoding="utf-8"))
        profile[datei.stem] = Profil.model_validate(rohdaten)
    return profile


def saison_lesen(datei: Path) -> Saisontabelle:
    """Liest die Saisontabelle, die die Kette erzeugt hat."""
    return Saisontabelle.model_validate_json(datei.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class Katalog:
    """Alle Arten, einmal aus den Dateien gebaut und danach nur noch gelesen."""

    tabelle: Saisontabelle
    profile: dict[str, Profil]
    karten: dict[str, str]

    def _zaehlung(self, profil: Profil) -> Artenzaehlung:
        # Eine Art ohne Zeile in der Tabelle hat seit 2015 keine Begehung
        # getragen. Sie steht als Profil im Katalog, nicht als Luecke.
        leer = Artenzaehlung(
            begehungen_mit_fund=0,
            funde_je_woche=[0] * WOCHEN,
            funde_je_woche_laufendes_jahr=[0] * WOCHEN,
        )
        return self.tabelle.arten.get(profil.lateinisch, leer)

    def _reihen(self, profil: Profil) -> tuple[list[float], list[float]]:
        zaehlung = self._zaehlung(profil)
        alle = anteil_je_woche(zaehlung.funde_je_woche, self.tabelle.begehungen_je_woche)
        laufend = anteil_je_woche(
            zaehlung.funde_je_woche_laufendes_jahr,
            self.tabelle.begehungen_je_woche_laufendes_jahr,
        )
        return alle, laufend[: self.tabelle.stand_woche]

    @property
    def _stand(self) -> Woche:
        return Woche(jahr=self.tabelle.stand_jahr, woche=self.tabelle.stand_woche)

    @property
    def _jahre(self) -> Jahresspanne:
        return Jahresspanne(von=self.tabelle.von_jahr, bis=self.tabelle.bis_jahr)

    def liste(self) -> ArtenListe:
        """Alle Arten mit Stufe, Tags und der kleinen Kurve."""
        arten: list[ArtKurz] = []
        for slug, profil in self.profile.items():
            zaehlung = self._zaehlung(profil)
            alle, laufend = self._reihen(profil)
            stufe = stufe_fuer(zaehlung.begehungen_mit_fund)
            arten.append(
                ArtKurz(
                    slug=slug,
                    name=profil.name,
                    lateinisch=profil.lateinisch,
                    gruppe=profil.gruppe,
                    stufe=stufe,
                    tags=tags_bauen(profil, stufe),
                    geschuetzt=profil.geschuetzt,
                    speisewert=profil.speisewert,
                    karten_slug=self.karten.get(slug),
                    begehungen_mit_fund=zaehlung.begehungen_mit_fund,
                    spitze_woche=spitze_woche_fuer(alle),
                    saison=SaisonKurz(
                        alle_jahre=alle,
                        hoechstwert=max([*alle, *laufend]),
                    ),
                )
            )
        arten.sort(key=lambda art: art.name)
        return ArtenListe(
            stand=self._stand,
            jahre=self._jahre,
            begehungen=sum(self.tabelle.begehungen_je_woche),
            arten=arten,
        )

    def art(self, slug: str) -> Art:
        """Eine Art mit Profil. Ein unbekannter Slug ist ein 404."""
        profil = self.profile.get(slug)
        if profil is None:
            raise NichtGefunden(f"Die Art {slug} steht nicht im Katalog.")
        zaehlung = self._zaehlung(profil)
        alle, laufend = self._reihen(profil)
        stufe = stufe_fuer(zaehlung.begehungen_mit_fund)
        return Art(
            slug=slug,
            name=profil.name,
            lateinisch=profil.lateinisch,
            gruppe=profil.gruppe,
            stufe=stufe,
            tags=tags_bauen(profil, stufe),
            geschuetzt=profil.geschuetzt,
            speisewert=profil.speisewert,
            karten_slug=self.karten.get(slug),
            begehungen_mit_fund=zaehlung.begehungen_mit_fund,
            spitze_woche=spitze_woche_fuer(alle),
            merkmale=merkmale_bauen(profil),
            verwechslungen=profil.verwechslungen,
            links=profil.links,
            saison=SaisonKurve(
                alle_jahre=alle,
                laufendes_jahr=laufend,
                hoechstwert=max([*alle, *laufend]),
                jahre=self._jahre,
                stand=self._stand,
                begehungen=sum(self.tabelle.begehungen_je_woche),
            ),
        )


def karten_suchen(profile: dict[str, Profil], maps: Path) -> dict[str, str]:
    """Sucht zu jeder Art das Manifest der Kette, wenn es schon gerendert ist.

    Ohne Manifest gibt es keine Karte, und die Artseite bietet den Sprung
    dorthin nicht an.
    """
    gefunden: dict[str, str] = {}
    for slug, profil in profile.items():
        name = profil.karte or slug
        if (maps / f"{name}.json").is_file():
            gefunden[slug] = name
    return gefunden


@lru_cache(maxsize=4)
def katalog(daten: Path, maps: Path) -> Katalog:
    """Baut den Katalog aus den Dateien. Der Prozess liest sie einmal."""
    profile = profile_lesen(daten / "arten")
    tabelle = saison_lesen(daten / "saison.json")
    return Katalog(tabelle=tabelle, profile=profile, karten=karten_suchen(profile, maps))
