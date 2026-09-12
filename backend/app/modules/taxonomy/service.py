"""Die Einordnung lesen: Abgleich beim Start, Pfad, Geschwister, Kinder, Arten."""

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.models import Taxon
from app.modules.species.catalog import Catalog
from app.modules.species.schemas import SpeciesBrief
from app.modules.taxonomy.naming import genus_slug_of
from app.modules.taxonomy.schemas import TaxonChild, TaxonPage
from app.modules.taxonomy.seed import seed_taxa
from app.shared.schemas import TaxonRank, TaxonStep


async def sync_taxa(session: AsyncSession) -> None:
    """Legt an, was die Vorgabe kennt und die Tabelle nicht.

    Ein Rang mehr in der Vorgabe braucht so keine eigene Migration. Was in der
    Tabelle steht, bleibt: sie ist die Wahrheit, sobald sie einmal steht.
    """
    known = {row.slug: row.id for row in (await session.execute(select(Taxon))).scalars()}
    added = False
    for seed in seed_taxa():
        if seed.slug in known:
            continue
        row = Taxon(
            rank=seed.rank,
            slug=seed.slug,
            name=seed.name,
            latin_name=seed.latin_name,
            parent_id=known[seed.parent] if seed.parent else None,
        )
        session.add(row)
        await session.flush()
        known[seed.slug] = row.id
        added = True
    if added:
        await session.commit()


async def read_taxa(session: AsyncSession) -> dict[str, Taxon]:
    """Die ganze Einordnung, nach Slug. Sie ist klein genug fuer einen Griff."""
    rows = (await session.execute(select(Taxon).order_by(Taxon.name))).scalars()
    return {row.slug: row for row in rows}


def _step(row: Taxon) -> TaxonStep:
    return TaxonStep(rank=row.rank, slug=row.slug, name=row.name, latin_name=row.latin_name)


def _by_identifier(taxa: Mapping[str, Taxon]) -> dict[str, Taxon]:
    return {row.id: row for row in taxa.values()}


def path_to_root(taxa: Mapping[str, Taxon], slug: str) -> list[Taxon]:
    """Der Weg von der Wurzel bis vor das Taxon selbst."""
    by_identifier = _by_identifier(taxa)
    row = taxa[slug]
    above: list[Taxon] = []
    while row.parent_id is not None:
        row = by_identifier[row.parent_id]
        above.append(row)
    above.reverse()
    return above


def species_per_taxon(species: Iterable[SpeciesBrief]) -> dict[str, list[SpeciesBrief]]:
    """Die Arten je Taxon-Slug.

    Eine Art haengt heute an der Gattung ihres eigenen lateinischen Namens. Die
    Tabelle laesst jede Stufe zu; sobald die Art eine Zeile ist, steht der
    Verweis dort und diese Ableitung faellt weg.
    """
    below: dict[str, list[SpeciesBrief]] = defaultdict(list)
    for entry in species:
        below[genus_slug_of(entry.scientific)].append(entry)
    return dict(below)


def counts_per_taxon(
    taxa: Mapping[str, Taxon], below: Mapping[str, Sequence[SpeciesBrief]]
) -> dict[str, int]:
    """Wie viele Arten unter einem Taxon stehen, ueber alle Stufen darunter."""
    by_identifier = _by_identifier(taxa)
    counts: dict[str, int] = defaultdict(int)
    for slug, entries in below.items():
        row = taxa.get(slug)
        while row is not None:
            counts[row.slug] += len(entries)
            row = by_identifier.get(row.parent_id) if row.parent_id else None
    return counts


def _children(taxa: Mapping[str, Taxon], row: Taxon, counts: Mapping[str, int]) -> list[TaxonChild]:
    return [
        TaxonChild(
            rank=child.rank,
            slug=child.slug,
            name=child.name,
            latin_name=child.latin_name,
            species_count=counts.get(child.slug, 0),
        )
        for child in sorted(taxa.values(), key=lambda entry: entry.name)
        if child.parent_id == row.id
    ]


def _siblings(taxa: Mapping[str, Taxon], row: Taxon) -> list[TaxonStep]:
    return [
        _step(other)
        for other in sorted(taxa.values(), key=lambda entry: entry.name)
        if other.parent_id == row.parent_id and other.id != row.id
    ]


async def taxon_page(
    session: AsyncSession, catalog: Catalog, rank: TaxonRank, slug: str
) -> TaxonPage:
    """Eine Taxonomieseite. Ein Slug, den es nicht gibt, ist ein 404.

    Der Rang steht in der Adresse und wird geprueft: ``/familie/boletus``
    zeigt nicht die Gattung, sondern nichts.
    """
    taxa = await read_taxa(session)
    row = taxa.get(slug)
    if row is None or row.rank is not rank:
        raise NotFound(f"Die Stufe {rank.value}/{slug} steht nicht in der Einordnung.")
    below = species_per_taxon(catalog.listing(only_collectable=None).species)
    counts = counts_per_taxon(taxa, below)
    return TaxonPage(
        rank=row.rank,
        slug=row.slug,
        name=row.name,
        latin_name=row.latin_name,
        description=row.description,
        path=[_step(step) for step in path_to_root(taxa, slug)],
        siblings=_siblings(taxa, row),
        children=_children(taxa, row, counts),
        species=below.get(slug, []),
        species_count=counts.get(slug, 0),
    )


async def lineage_of(session: AsyncSession, scientific: str | None) -> list[TaxonStep]:
    """Die Einordnung einer Art, Wurzel zuerst, Gattung zuletzt.

    Ohne lateinischen Namen und ohne bekannte Gattung bleibt sie leer. Ein
    leerer Pfad heisst nicht eingeordnet, er heisst nicht geraten.
    """
    if scientific is None:
        return []
    taxa = await read_taxa(session)
    slug = genus_slug_of(scientific)
    if slug not in taxa:
        return []
    return [_step(step) for step in (*path_to_root(taxa, slug), taxa[slug])]
