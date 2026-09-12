"""Artbilder ablegen, finden und freigeben.

Die Ablage liegt unter ``PILZE_FOTOS/arten``, ein Ordner je Art. Der Name der
Datei traegt Kennung und Groesse; damit kennt der Dienst den Pfad aus der Zeile
allein und braucht keine zweite Tabelle fuer die Fassungen.
"""

from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User
from app.core.errors import Invalid, NotFound
from app.core.settings import Settings
from app.models import Person, SpeciesImage, new_identifier, utc_now
from app.modules.access.guard import Viewer
from app.modules.access.permissions import Permission
from app.modules.species.catalog import Catalog
from app.modules.species_images.schemas import ImageIn
from app.shared import images
from app.shared.images import Size
from app.shared.schemas import ImageState

# Ein Artbild laedt jemand am Rechner hoch, nicht aus dem Wald. Drei Megabyte
# reichen fuer eine gute Aufnahme und halten die Platte klein.
MAX_BYTES = 3 * 1024 * 1024


def folder(settings: Settings, species_slug: str) -> Path:
    """Der Ordner, in dem die Bilder einer Art liegen."""
    return settings.species_images / species_slug


def file_path(settings: Settings, image: SpeciesImage, size: Size) -> Path:
    """Der Pfad einer Fassung auf der Platte."""
    return folder(settings, image.species_slug) / f"{image.id}-{size.value}{images.SUFFIX}"


def check_species(catalog: Catalog, species_slug: str) -> None:
    """Weist einen Slug ab, den der Artenkatalog nicht kennt.

    Der Slug wird zum Ordnernamen. Nur ein Slug aus dem Katalog kommt darum
    ueberhaupt bis zur Platte.
    """
    if not catalog.has(species_slug):
        raise Invalid(f"Die Art {species_slug} steht nicht im Katalog.")


def write_files(
    settings: Settings,
    species_slug: str,
    image_id: str,
    raw_bytes: bytes,
) -> images.Rendered:
    """Legt jede Fassung ab und liefert die grosse zurueck."""
    rendered = images.sizes(raw_bytes, MAX_BYTES)
    target = folder(settings, species_slug)
    for size, version in rendered.items():
        _ = images.store(target, f"{image_id}-{size.value}{images.SUFFIX}", version.data)
    return rendered[Size.FULL]


def remove_files(settings: Settings, image: SpeciesImage) -> None:
    """Loescht jede Fassung eines Bildes."""
    for size in Size:
        images.remove(file_path(settings, image, size))


async def clear_lead(session: AsyncSession, species_slug: str, keep: str) -> None:
    """Nimmt jedem anderen Bild derselben Art das Titelbild ab."""
    _ = await session.execute(
        update(SpeciesImage)
        .where(SpeciesImage.species_slug == species_slug, SpeciesImage.id != keep)
        .values(lead=False),
    )


async def create(
    session: AsyncSession,
    settings: Settings,
    *,
    payload: ImageIn,
    user: User,
    state: ImageState,
) -> SpeciesImage:
    """Legt ein Bild an: Dateien auf die Platte, eine Zeile in die Datenbank."""
    # Die Kennung faellt hier und nicht erst beim Schreiben, weil sie den
    # Dateinamen traegt.
    identifier = new_identifier()
    rendered = write_files(settings, payload.species_slug, identifier, await payload.file.read())
    approved = state is ImageState.APPROVED
    image = SpeciesImage(
        id=identifier,
        species_slug=payload.species_slug,
        uploader_sub=user.sub,
        photographer=payload.photographer,
        licence=payload.licence,
        source=payload.source,
        taken_on=payload.taken_on,
        caption=payload.caption,
        lead=payload.lead and approved,
        state=state,
        reviewed_by=user.sub if approved else None,
        reviewed_at=utc_now() if approved else None,
        width=rendered.width,
        height=rendered.height,
    )
    session.add(image)
    if image.lead:
        await session.flush()
        await clear_lead(session, image.species_slug, image.id)
    await session.commit()
    await session.refresh(image)
    return image


async def image_or_404(session: AsyncSession, image_id: str) -> SpeciesImage:
    """Liest ein Bild. Eine unbekannte Kennung ist ein 404."""
    image = await session.get(SpeciesImage, image_id)
    if image is None:
        raise NotFound("Dieses Bild gibt es nicht.")
    return image


def may_see(image: SpeciesImage, visitor: Viewer) -> bool:
    """Sagt, ob dieser Zugriff das Bild sehen darf.

    Bis zur Freigabe sieht ein Bild nur, wer es eingereicht hat, und wer es
    pruefen soll.
    """
    if image.state is ImageState.APPROVED:
        return True
    if visitor.user is None:
        return False
    return image.uploader_sub == visitor.user.sub or Permission.IMAGE_REVIEW in visitor.rights


async def visible(session: AsyncSession, image_id: str, visitor: Viewer) -> SpeciesImage:
    """Liest ein Bild, das dieser Zugriff sehen darf.

    Ein Bild, das er nicht sehen darf, gibt es fuer ihn nicht. Es endet darum
    mit 404 und nicht mit 403.
    """
    image = await image_or_404(session, image_id)
    if not may_see(image, visitor):
        raise NotFound("Dieses Bild gibt es nicht.")
    return image


async def names_of(session: AsyncSession, subs: list[str]) -> dict[str, str | None]:
    """Die Anzeigenamen der einreichenden Personen."""
    if not subs:
        return {}
    query = select(Person.sub, Person.name).where(Person.sub.in_(subs))
    return {row.sub: row.name for row in await session.execute(query)}
