"""Der Bestand der Oberflaechentexte in der Datenbank.

Wie beim Rechtekatalog gleicht der Start die Tabelle mit dem Code ab: ein neuer
Schluessel im Frontend braucht keine eigene Migration, und ein Schluessel, den
es nicht mehr gibt, verschwindet. Ein geaenderter Text bleibt dabei stehen; der
Abgleich schreibt nur, was fehlt.
"""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UiText
from app.modules.texts.schemas import Catalogue, TextOut
from app.modules.texts.seed import Locale, seed_catalogue


async def sync_texts(session: AsyncSession) -> None:
    """Legt fehlende Texte aus der Vorgabe an und raeumt unbekannte Schluessel ab."""
    catalogue = seed_catalogue()
    known = {(row.key, row.locale): row for row in await session.scalars(select(UiText))}
    wanted: set[tuple[str, str]] = set()
    for locale, texts in catalogue.items():
        for key, value in texts.items():
            wanted.add((key, locale.value))
            if (key, locale.value) not in known:
                session.add(UiText(key=key, locale=locale.value, value=value))
    for identity, row in known.items():
        if identity not in wanted:
            await session.delete(row)
    await session.commit()


async def revision(session: AsyncSession) -> str:
    """Der ETag des Katalogs: Zeilenzahl und juengste Aenderung.

    Beides zusammen deckt jede Aenderung ab: ein neuer oder entfernter
    Schluessel bewegt die Zahl, ein geaenderter Text den Zeitpunkt. Der Client
    spart sich damit den Katalog, solange sich nichts getan hat.
    """
    count = await session.scalar(select(func.count()).select_from(UiText)) or 0
    newest = await session.scalar(select(func.max(UiText.updated_at)))
    stamp = int(newest.timestamp() * 1_000_000) if isinstance(newest, datetime) else 0
    return f'W/"{count}-{stamp}"'


def _entry(key: str, rows: Sequence[UiText]) -> TextOut:
    """Baut die Antwort zu einem Schluessel aus seinen Zeilen."""
    catalogue = seed_catalogue()
    values = {Locale(row.locale): row.value for row in rows}
    changed = any(catalogue[locale].get(key) != value for locale, value in values.items())
    return TextOut(
        key=key,
        values=values,
        changed=changed,
        updated_at=max(row.updated_at for row in rows),
    )


async def one_text(session: AsyncSession, key: str) -> TextOut:
    """Liest einen Schluessel mit allen seinen Sprachen."""
    rows = list(await session.scalars(select(UiText).where(UiText.key == key)))
    return _entry(key, rows)


async def whole_catalogue(session: AsyncSession, tag: str) -> Catalogue:
    """Liest den ganzen Katalog, nach Schluessel sortiert.

    Der ETag kommt von aussen: die Route hat ihn schon geholt, um die Anfrage
    gegen ihn zu halten.
    """
    rows = list(await session.scalars(select(UiText).order_by(UiText.key, UiText.locale)))
    grouped: dict[str, list[UiText]] = {}
    for row in rows:
        grouped.setdefault(row.key, []).append(row)
    return Catalogue(
        revision=tag,
        locales=list(Locale),
        entries=[_entry(key, group) for key, group in grouped.items()],
    )
