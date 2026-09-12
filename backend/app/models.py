"""Tabellen der App. Die Baseline-Migration baut das Schema aus diesen Modellen."""

from datetime import UTC, date, datetime
from enum import Enum
from typing import Final
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Dialect,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy import Enum as SaEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.shared.schemas import Color, ImageState, Licence, Rule, Visibility

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


# Wie ein Verweis auf ``nutzer`` reagiert, wenn das Konto verschwindet.
#
# ``RESTRICT`` traegt alles, was jemand angelegt hat und was ohne ihn weiter
# gilt: Funde, Marker, Zonen, Kombinationen und eingereichte Bilder. Ein
# geloeschtes Konto darf sie nicht stillschweigend mitreissen. Heute loescht
# der Dienst kein Konto; wer das baut, stoesst an diese Sperre und muss je
# Tabelle entscheiden, was mit dem Bestand geschieht. Genau diese Entscheidung
# soll er treffen muessen.
OWNED_BY_PERSON: Final = "RESTRICT"


def person_key(table: str, column: str) -> str:
    """Der Name einer Bedingung auf ``nutzer.sub``.

    Ein Name ist noetig, weil SQLite eine Bedingung nur ueber ihn wiederfindet:
    die Migration muss wissen, ob sie schon steht, und ein spaeterer Schritt
    muss sie loesen koennen.
    """
    return f"fk_{table}_{column}_nutzer"


# ``SET NULL`` traegt die wahlfreien Spuren einer Handlung. Der geprueften
# Aufnahme bleibt ihr Zustand, dem Text sein Wortlaut; nur der Name dahinter
# faellt weg. Ein Verbot haette hier nichts zu schuetzen.
TRACE_OF_PERSON: Final = "SET NULL"

# Die acht Spalten, die auf ein Konto zeigen, mit ihrer Loeschregel. Migration
# und Zaehlwerkzeug lesen daraus, damit die Liste an einer Stelle steht.
PERSON_KEYS: Final[tuple[tuple[str, str, str], ...]] = (
    ("fund", "besitzer_sub", OWNED_BY_PERSON),
    ("marker", "besitzer_sub", OWNED_BY_PERSON),
    ("zone", "besitzer_sub", OWNED_BY_PERSON),
    ("kombination", "besitzer_sub", OWNED_BY_PERSON),
    ("species_image", "uploader_sub", OWNED_BY_PERSON),
    ("species_image", "reviewed_by", TRACE_OF_PERSON),
    ("text", "updated_by", TRACE_OF_PERSON),
    ("user_role", "user_sub", "CASCADE"),
)


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

    # ``CASCADE``: eine Rolle an einem Konto, das es nicht mehr gibt, sagt
    # nichts und traegt nichts. Sie geht mit, wie sie mit der Rolle mitgeht.
    user_sub: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("nutzer.sub", ondelete="CASCADE", name=person_key("user_role", "user_sub")),
        primary_key=True,
        index=True,
    )
    role_id: Mapped[str] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)


class Term(Base):
    """Ein Begriff aus einem verwalteten Katalog: Geruch, Geschmack, Baumart.

    Diese Werte stehen nicht als Enum im Code. Die Verwaltung muss sie
    erweitern koennen, und ein neuer Geruch soll eine Zeile sein, kein Deploy.
    Der Slug steht in den Profilen, der Name nur hier.
    """

    __tablename__ = "begriff"
    __table_args__ = (UniqueConstraint("art", "slug", name="uq_begriff_art_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column("art", String(32), index=True)
    slug: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column("reihenfolge", Integer, default=0)


class UiText(Base):
    """Ein Text der Oberflaeche, je Schluessel und Sprache eine Zeile.

    Der Anfangsbestand kommt aus ``daten/texte.json``. Danach ist diese Tabelle
    die einzige Wahrheit: der eingebaute Katalog des Frontends dient nur noch
    dem ersten Start und dem Betrieb ohne Netz.
    """

    __tablename__ = "text"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    locale: Mapped[str] = mapped_column(String(5), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)
    # Wer zuletzt geschrieben hat. Leer heisst: so kam der Text aus der Vorgabe.
    updated_by: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("nutzer.sub", ondelete=TRACE_OF_PERSON, name=person_key("text", "updated_by")),
        default=None,
    )


class Owned(Base):
    """Was einem Konto gehoert: Kennung, Besitzer und die beiden Zeitpunkte.

    Der Besitzer ist der ``sub`` aus dem Token. Er kommt nie aus dem Koerper
    einer Anfrage. Die Besitzerpruefung in ``app/shared/objects.py`` haengt an
    dieser Stufe, damit sie fuer jedes eigene Objekt gilt.
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)

    @declared_attr
    @classmethod
    def owner_sub(cls) -> Mapped[str]:
        """Der Besitzer, je Tabelle mit eigenem Namen der Bedingung.

        Der Name muss die Tabelle nennen: vier Tabellen erben diese Spalte, und
        zwei Bedingungen desselben Namens gaebe es nicht.
        """
        return mapped_column(
            "besitzer_sub",
            String(255),
            ForeignKey(
                "nutzer.sub",
                ondelete=OWNED_BY_PERSON,
                name=person_key(cls.__tablename__, "besitzer_sub"),
            ),
            index=True,
        )

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


class SpeciesImage(Base):
    """Ein Bild zu einer Art. Die Dateien liegen unter ``PILZE_FOTOS/arten``.

    Die Art steht als Slug und nicht als Fremdschluessel: der Artenkatalog ist
    kein Tabelleninhalt, er kommt als TOML mit dem Deploy.

    ``photographer`` und ``licence`` sind Pflicht. Ein Bild ohne Urheber ist
    eines, das die App nicht zeigen darf.
    """

    __tablename__ = "species_image"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    species_slug: Mapped[str] = mapped_column(String(80), index=True)
    uploader_sub: Mapped[str] = mapped_column(
        String(255),
        ForeignKey(
            "nutzer.sub", ondelete=OWNED_BY_PERSON, name=person_key("species_image", "uploader_sub")
        ),
        index=True,
    )
    photographer: Mapped[str] = mapped_column(String(120))
    licence: Mapped[Licence] = mapped_column(_enum_column(Licence))
    source: Mapped[str | None] = mapped_column(Text, default=None)
    taken_on: Mapped[date | None] = mapped_column(Date, default=None)
    caption: Mapped[str | None] = mapped_column(String(200), default=None)
    # Der Ort der Aufnahme, wahlfrei. Er steht hier nur auf dem Raster: der
    # Dienst rundet vor dem Schreiben und kennt den genauen Punkt nie.
    lat: Mapped[float | None] = mapped_column(Float, default=None)
    lon: Mapped[float | None] = mapped_column(Float, default=None)
    # Das Titelbild einer Art. Hoechstens eines traegt es, das setzt der Dienst
    # beim Schreiben durch.
    lead: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    state: Mapped[ImageState] = mapped_column(
        _enum_column(ImageState),
        default=ImageState.SUBMITTED,
        index=True,
    )
    # Der Grund einer Absage. Er geht an die einreichende Person zurueck.
    reject_reason: Mapped[str | None] = mapped_column(String(200), default=None)
    reviewed_by: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey(
            "nutzer.sub", ondelete=TRACE_OF_PERSON, name=person_key("species_image", "reviewed_by")
        ),
        default=None,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(UtcTime, default=None)
    width: Mapped[int] = mapped_column()
    height: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)


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
