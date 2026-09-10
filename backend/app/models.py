"""Tabellen der App. Die Baseline-Migration baut das Schema aus diesen Modellen."""

from datetime import UTC, date, datetime
from enum import Enum
from typing import Final
from uuid import uuid4

from sqlalchemy import Date, DateTime, Dialect, Float, ForeignKey, String, Text
from sqlalchemy import Enum as SaEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.shared.schemas import Farbe, Regel, Sichtbarkeit

# Eine UUID als Zeichenkette. Das Geraet vergibt sie schon offline, damit ein
# Eintrag aus der Warteschlange dieselbe Kennung behaelt.
KENNUNG_LAENGE: Final = 36


def neue_kennung() -> str:
    """Eine neue Objektkennung."""
    return str(uuid4())


def jetzt() -> datetime:
    """Der aktuelle Zeitpunkt, immer mit Zeitzone."""
    return datetime.now(UTC)


def _werte(aufzaehlung: type[Enum]) -> list[str]:
    # Ohne das legt SQLAlchemy die Namen der Glieder ab. In der Spalte soll der
    # Wert stehen, den auch das JSON traegt.
    return [str(glied.value) for glied in aufzaehlung]


def _enum_spalte(aufzaehlung: type[Enum]) -> SaEnum:
    """Eine Aufzaehlung als Textspalte mit Pruefung, so wie SQLite sie kann."""
    return SaEnum(aufzaehlung, native_enum=False, length=16, values_callable=_werte)


class UtcZeit(TypeDecorator[datetime]):
    """Ein Zeitpunkt, der aus SQLite wieder mit Zeitzone herauskommt.

    SQLite hat keinen Zeittyp. Der Treiber gibt einen Zeitpunkt ohne Zeitzone
    zurueck, und der vergleicht sich falsch gegen einen bewussten. Diese Spalte
    schreibt in UTC und haengt UTC beim Lesen wieder an.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:  # noqa: ARG002
        """Legt den Zeitpunkt in UTC ab."""
        return None if value is None else value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:  # noqa: ARG002
        """Liest den Zeitpunkt als UTC zurueck."""
        return None if value is None else value.replace(tzinfo=UTC)


class Base(DeclarativeBase):
    """Gemeinsame Wurzel aller Tabellen."""


class Nutzer(Base):
    """Ein Konto. Es entsteht beim ersten Zugriff, erkannt am ``sub`` des Tokens."""

    __tablename__ = "nutzer"

    sub: Mapped[str] = mapped_column(String(255), primary_key=True)
    erstellt_am: Mapped[datetime] = mapped_column(UtcZeit, default=jetzt)


class Eigentum(Base):
    """Was einem Konto gehoert: Kennung, Besitzer und die beiden Zeitpunkte.

    Der Besitzer ist der ``sub`` aus dem Token. Er kommt nie aus dem Koerper
    einer Anfrage. Die Besitzerpruefung in ``app/shared/objekte.py`` haengt an
    dieser Stufe, damit sie fuer jedes eigene Objekt gilt.
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(String(KENNUNG_LAENGE), primary_key=True, default=neue_kennung)
    besitzer_sub: Mapped[str] = mapped_column(String(255), index=True)
    erstellt_am: Mapped[datetime] = mapped_column(UtcZeit, default=jetzt)
    geaendert_am: Mapped[datetime] = mapped_column(UtcZeit, default=jetzt, onupdate=jetzt)


class Besitztum(Eigentum):
    """Was auf der Karte liegt: Fund, Marker und Zone tragen zusaetzlich diese Felder."""

    __abstract__ = True

    sichtbarkeit: Mapped[Sichtbarkeit] = mapped_column(
        _enum_spalte(Sichtbarkeit),
        default=Sichtbarkeit.PRIVAT,
    )
    notiz: Mapped[str | None] = mapped_column(Text, default=None)


class Fund(Besitztum):
    """Ein gemeldeter Fund: eine Art an einem Ort an einem Tag."""

    __tablename__ = "fund"

    # Der Anzeigename friert beim Speichern ein. Ein spaeterer Namenswechsel im
    # SSO soll einen geteilten Fund nicht rueckwirkend umschreiben.
    besitzer_name: Mapped[str | None] = mapped_column(String(255), default=None)
    art_slug: Mapped[str] = mapped_column(String(64), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    datum: Mapped[date] = mapped_column(Date, index=True)
    anzahl: Mapped[int | None] = mapped_column(default=None)

    fotos: Mapped[list["Foto"]] = relationship(
        back_populates="fund",
        cascade="all, delete-orphan",
        # Die Fundliste zeigt die Fotos mit. Ohne Vorladen liefe jeder Zugriff
        # in eine spaete Abfrage, die es unter asyncio nicht gibt.
        lazy="selectin",
        order_by="Foto.erstellt_am",
    )


class Foto(Base):
    """Ein Bild zu einem Fund. Die Datei liegt unter ``PILZE_FOTOS``."""

    __tablename__ = "foto"

    id: Mapped[str] = mapped_column(String(KENNUNG_LAENGE), primary_key=True, default=neue_kennung)
    fund_id: Mapped[str] = mapped_column(ForeignKey("fund.id", ondelete="CASCADE"), index=True)
    dateiname: Mapped[str] = mapped_column(String(64))
    breite: Mapped[int] = mapped_column()
    hoehe: Mapped[int] = mapped_column()
    erstellt_am: Mapped[datetime] = mapped_column(UtcZeit, default=jetzt)

    fund: Mapped[Fund] = relationship(back_populates="fotos")


class Marker(Besitztum):
    """Eine gemerkte Stelle auf der Karte."""

    __tablename__ = "marker"

    name: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    farbe: Mapped[Farbe] = mapped_column(_enum_spalte(Farbe), default=Farbe.GRUEN)


class Zone(Besitztum):
    """Ein Revier als Flaeche. Die Karte gibt ihr einen Wert je Woche zurueck."""

    __tablename__ = "zone"

    name: Mapped[str] = mapped_column(String(80))
    # GeoJSON als Text. SQLite hat keinen Geometrietyp, und der Dienst rechnet
    # die Flaeche selbst.
    polygon: Mapped[str] = mapped_column(Text)
    flaeche_ha: Mapped[float] = mapped_column(Float)
    farbe: Mapped[Farbe] = mapped_column(_enum_spalte(Farbe), default=Farbe.GRUEN)


class Kombination(Eigentum):
    """Ein gespeicherter Faktor-Finder: eine Regel und ihre Faktoren.

    Die Faktoren liegen als GeoJSON-fremdes JSON in einer Textspalte. Sie sind
    eine Liste ohne eigene Abfrage: niemand sucht nach einem Faktor, und eine
    zweite Tabelle waere nur ein Verbund mehr je Zeile.
    """

    __tablename__ = "kombination"

    name: Mapped[str] = mapped_column(String(80))
    regel: Mapped[Regel] = mapped_column(_enum_spalte(Regel), default=Regel.SCHNITT)
    faktoren: Mapped[str] = mapped_column(Text)
