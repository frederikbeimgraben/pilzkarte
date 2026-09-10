"""Tabellen der App. Die Baseline-Migration baut das Schema aus diesen Modellen."""

from datetime import UTC, date, datetime
from enum import Enum
from typing import Final
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Dialect, Float, ForeignKey, String, Text, false
from sqlalchemy import Enum as SaEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.shared.schemas import Color, Rule, Visibility

# Eine UUID als Zeichenkette. Das Geraet vergibt sie schon offline, damit ein
# Eintrag aus der Warteschlange dieselbe Kennung behaelt.
ID_LENGTH: Final = 36


def new_identifier() -> str:
    """Eine neue Objektkennung."""
    return str(uuid4())


def utc_now() -> datetime:
    """Der aktuelle Zeitpunkt, immer mit Zeitzone."""
    return datetime.now(UTC)


def _values(enumeration: type[Enum]) -> list[str]:
    # Ohne das legt SQLAlchemy die Namen der Glieder ab. In der Spalte soll der
    # Wert stehen, den auch das JSON traegt.
    return [str(member.value) for member in enumeration]


def _enum_column(enumeration: type[Enum]) -> SaEnum:
    """Eine Aufzaehlung als Textspalte mit Pruefung, so wie SQLite sie kann."""
    return SaEnum(enumeration, native_enum=False, length=16, values_callable=_values)


class UtcTime(TypeDecorator[datetime]):
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


class Person(Base):
    """Ein Konto. Es entsteht beim ersten Zugriff, erkannt am ``sub`` des Tokens.

    ``app.core.auth.User`` ist die Person im Token, diese Zeile ist ihr
    Gedächtnis. Nur so weiß die Rollenverwaltung, wen es überhaupt gibt: das
    SSO gibt keine Liste heraus.
    """

    __tablename__ = "nutzer"

    sub: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    name: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column("erstellt_am", UtcTime, default=utc_now)


class Role(Base):
    """Eine Rolle. Zwei stehen fest, alles Weitere legt jemand mit dem Recht an."""

    __tablename__ = "role"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    # Der Slug trägt die Bedeutung, der Name nur die Beschriftung. Nur so
    # bleiben die festen Rollen erkennbar, auch wenn jemand sie umbenennt.
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    built_in: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)


class PermissionRow(Base):
    """Ein Recht in der Datenbank.

    Der Katalog steht im Code, in ``app.modules.access.permissions``. Diese
    Tabelle spiegelt ihn, damit ``role_permission`` einen Fremdschlüssel hat
    und ein Recht nicht als Tippfehler in einer Rolle landet. Der Dienst
    gleicht sie beim Start ab.
    """

    __tablename__ = "permission"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    area: Mapped[str] = mapped_column(String(20))


class RolePermission(Base):
    """Ein Recht an einer Rolle."""

    __tablename__ = "role_permission"

    role_id: Mapped[str] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission_key: Mapped[str] = mapped_column(
        ForeignKey("permission.key", ondelete="CASCADE"),
        primary_key=True,
    )


class UserRole(Base):
    """Eine Rolle an einer Person. Die feste Rolle ``user`` steht hier nie.

    Sie gilt jeder angemeldeten Person, und eine Zeile je Konto wäre eine
    Zeile, die nichts sagt.
    """

    __tablename__ = "user_role"

    user_sub: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    role_id: Mapped[str] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)


class Owned(Base):
    """Was einem Konto gehoert: Kennung, Besitzer und die beiden Zeitpunkte.

    Der Besitzer ist der ``sub`` aus dem Token. Er kommt nie aus dem Koerper
    einer Anfrage. Die Besitzerpruefung in ``app/shared/objects.py`` haengt an
    dieser Stufe, damit sie fuer jedes eigene Objekt gilt.
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    owner_sub: Mapped[str] = mapped_column("besitzer_sub", String(255), index=True)
    created_at: Mapped[datetime] = mapped_column("erstellt_am", UtcTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        "geaendert_am", UtcTime, default=utc_now, onupdate=utc_now
    )


class MapObject(Owned):
    """Was auf der Karte liegt: Fund, Marker und Zone tragen zusaetzlich diese Felder."""

    __abstract__ = True

    visibility: Mapped[Visibility] = mapped_column(
        "sichtbarkeit",
        _enum_column(Visibility),
        default=Visibility.PRIVATE,
    )
    note: Mapped[str | None] = mapped_column("notiz", Text, default=None)


class Find(MapObject):
    """Ein gemeldeter Fund: eine Art an einem Ort an einem Tag."""

    __tablename__ = "fund"

    # Der Anzeigename friert beim Speichern ein. Ein spaeterer Namenswechsel im
    # SSO soll einen geteilten Fund nicht rueckwirkend umschreiben.
    owner_name: Mapped[str | None] = mapped_column("besitzer_name", String(255), default=None)
    species_slug: Mapped[str] = mapped_column("art_slug", String(64), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    found_on: Mapped[date] = mapped_column("datum", Date, index=True)
    count: Mapped[int | None] = mapped_column("anzahl", default=None)
    # Wer das setzt, gibt den genauen Fundort an die Kette weiter. Die Vorgabe
    # ist darum nein, und nur der Besitzer kann sie aendern.
    # Ohne Index: die Kette liest die Liste einmal je Lauf, und eine Spalte
    # mit zwei Werten hilft SQLite dabei nicht.
    for_training: Mapped[bool] = mapped_column(
        "fuer_training", Boolean, default=False, server_default=false()
    )

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="find",
        cascade="all, delete-orphan",
        # Die Fundliste zeigt die Fotos mit. Ohne Vorladen liefe jeder Zugriff
        # in eine spaete Abfrage, die es unter asyncio nicht gibt.
        lazy="selectin",
        order_by="Photo.created_at",
    )


class Photo(Base):
    """Ein Bild zu einem Fund. Die Datei liegt unter ``PILZE_FOTOS``."""

    __tablename__ = "foto"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    find_id: Mapped[str] = mapped_column(
        "fund_id", ForeignKey("fund.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column("dateiname", String(64))
    width: Mapped[int] = mapped_column("breite")
    height: Mapped[int] = mapped_column("hoehe")
    created_at: Mapped[datetime] = mapped_column("erstellt_am", UtcTime, default=utc_now)

    find: Mapped[Find] = relationship(back_populates="photos")


class Marker(MapObject):
    """Eine gemerkte Stelle auf der Karte."""

    __tablename__ = "marker"

    name: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    color: Mapped[Color] = mapped_column("farbe", _enum_column(Color), default=Color.GREEN)


class Zone(MapObject):
    """Ein Revier als Flaeche. Die Karte gibt ihr einen Wert je Woche zurueck."""

    __tablename__ = "zone"

    name: Mapped[str] = mapped_column(String(80))
    # GeoJSON als Text. SQLite hat keinen Geometrietyp, und der Dienst rechnet
    # die Flaeche selbst.
    polygon: Mapped[str] = mapped_column(Text)
    area_ha: Mapped[float] = mapped_column("flaeche_ha", Float)
    color: Mapped[Color] = mapped_column("farbe", _enum_column(Color), default=Color.GREEN)


class Combination(Owned):
    """Ein gespeicherter Faktor-Finder: eine Regel und ihre Faktoren.

    Die Faktoren liegen als GeoJSON-fremdes JSON in einer Textspalte. Sie sind
    eine Liste ohne eigene Abfrage: niemand sucht nach einem Faktor, und eine
    zweite Tabelle waere nur ein Verbund mehr je Zeile.
    """

    __tablename__ = "kombination"

    name: Mapped[str] = mapped_column(String(80))
    rule: Mapped[Rule] = mapped_column("regel", _enum_column(Rule), default=Rule.INTERSECTION)
    factors: Mapped[str] = mapped_column("faktoren", Text)
