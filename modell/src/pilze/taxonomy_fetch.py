#!/usr/bin/env python3
"""Build the taxonomy of the species catalogue: one row per rank, chained.

Two sources, and neither is memory.

  The placement comes from the GBIF backbone. One `/v1/species/match` call per
  Latin name returns class, order and family. The genus is the first word of
  the Latin name in the profile, not the accepted genus of the match: the
  profile name is what the app shows and what the season table is keyed on, so
  the page of a species and the page of its genus must carry the same word.
  Seventeen of the profiles hold a name that GBIF keeps as a synonym; their
  genus still gets the family, order and class that GBIF gives the name.

  The German names come from the source pages of 123pilzsuche.de, by counting.
  Every page carries a line `Gattung:` with one to three German group names,
  widest first. The script cuts each page into its feature lines, reads that
  line, and counts which name appears for which species. A name goes to the
  lowest rank that holds at least `PURITY` of its mentions and more than
  `COVERAGE` of whose species carry it. Of the names that reach one rank the
  most frequent wins. A rank that no count reaches keeps its Latin name; it is
  not guessed.

Output is `backend/daten/taxonomie.json`: the taxa with slug, rank, Latin name,
German name, parent and the counts that carried the name. The species are not
listed. A species hangs under the genus of its own Latin name, and the backend
derives that where it needs it.

Usage:
    python taxonomy_fetch.py --profiles ../backend/daten/arten \
        --out ../backend/daten/taxonomie.json --cache data/raw/p123
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import tomllib
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Mapping, Sequence

GBIF_MATCH: Final = "https://api.gbif.org/v1/species/match"
USER_AGENT: Final = "pilze-research/0.1 (fungal taxonomy; +https://gbif.org)"
PAUSE_SECONDS: Final = 0.5

# Von eng nach weit. Der Wert ist der Rang auf dem Draht; die App spricht
# deutsch, ihre Bezeichner nicht.
RANKS: Final[dict[str, str]] = {
    "genus": "gattung",
    "family": "familie",
    "order": "ordnung",
    "class": "klasse",
}

# Ein Name gilt fuer einen Rang, wenn so viele seiner Nennungen darin liegen
# und er mehr als diesen Anteil der Arten des Rangs benennt.
PURITY: Final = 0.8
COVERAGE: Final = 0.5

# Die Auszeichnungen, mit denen 123pilzsuche eine Merkmalszeile beginnt. Was
# nicht in der Liste steht, bleibt Teil der Zeile davor.
LABELS: Final = (
    "Geruch",
    "Geschmack",
    "Hut",
    "Huthaut",
    "Stiel",
    "Ring",
    "Lamellen",
    "Röhren",
    "Poren",
    "Leisten",
    "Fleisch",
    "Fruchtkörper",
    "Sporenpulverfarbe",
    "Vorkommen",
    "Gattung",
    "Verwechslungsgefahr",
    "Vergleich",
    "Besonderheit",
    "Kommentar",
    "Tipp",
    "Bemerkung",
    "Chemische Reaktionen",
    "Gifthinweise",
    "Speisewert",
    "Relativer Speisewert",
    "Medizin für",
    "Vitalpilz (Heilpilz)",
    "Beispiele",
    "Lustige Anmerkung",
    "Wiki-Link",
    "Priorität",
    "DGfM",
    "Aktualisierung dieser Seite",
    "Bestimmungshilfen und Informationen hier",
)

_LABEL_PATTERN: Final = re.compile(
    r"(?<![\wÄÖÜäöüß])(" + "|".join(re.escape(label) for label in LABELS) + r"):\s"
)

# Was in der Zeile "Gattung:" kein Gruppenname ist: eine Unterteilung, ein
# lateinischer Name in Versalien, oder eine Gruppe eine Stufe darueber.
_NO_NAME: Final = re.compile(r"^(sektion|untergattung|gruppe|alt |kleine |sehr )|(artig|verwandt)", re.I)


@dataclass(frozen=True)
class Profile:
    """What the taxonomy needs from one species profile."""

    slug: str
    latin: str
    url: str


def read_profiles(folder: Path) -> list[Profile]:
    """Read slug, Latin name and source URL from every profile in the folder."""
    profiles = []
    for file in sorted(folder.glob("*.toml")):
        data = tomllib.loads(file.read_text(encoding="utf-8"))
        profiles.append(Profile(file.stem, data["lateinisch"], data["quelle"]["url"]))
    return profiles


def genus_of(latin: str) -> str:
    """The genus of a Latin name: its first word."""
    return latin.split()[0]


def slug_of(name: str) -> str:
    """The slug of a Latin name: lower case, ASCII, words joined by a dash."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")


def clean(page: str) -> str:
    """Strip markup, scripts and entities from a page and fold the whitespace."""
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    page = re.sub(r"<(script|style)\b.*?</\1>", "", page, flags=re.S | re.I)
    page = re.sub(r"<[^>]+>", " ", page)
    return re.sub(r"\s+", " ", html.unescape(page).replace("\xa0", " ")).strip()


def feature_lines(text: str) -> dict[str, str]:
    """Cut a cleaned page into its feature lines, label by label.

    The pages carry no structure a parser could hold on to; the labels are the
    only marks. Everything before the first label is the head of the page with
    the names and the picture credits, and it is dropped.

    A label can come back inside a later line, as in `(Gattung: IMLERIA)`. The
    first one wins: the line of a label is the one the page opens with it.
    """
    marks = list(_LABEL_PATTERN.finditer(text))
    lines: dict[str, str] = {}
    for index, mark in enumerate(marks):
        end = marks[index + 1].start() if index + 1 < len(marks) else len(text)
        lines.setdefault(mark.group(1), text[mark.end() : end].strip())
    return lines


def group_names(line: str) -> list[str]:
    """The German group names of one `Gattung:` line, widest first."""
    line = re.sub(r"\([^)]*\)", " ", line)
    line = re.split(r"[:!]", line)[0]
    names = []
    for piece in re.split(r"[,;=]|\bund\b|\boder\b", line):
        name = piece.strip(" .")
        if len(name) < 4 or len(name.split()) > 1 or name.isupper() or _NO_NAME.search(name):
            continue
        if name not in names:
            names.append(name)
    return names


def count_names(lines: Mapping[str, str]) -> dict[str, list[tuple[str, int]]]:
    """Count every German name: which species names it, and where in the line."""
    mentions: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for slug in sorted(lines):
        for position, name in enumerate(group_names(lines[slug])):
            mentions[name].append((slug, position))
    return dict(mentions)


def members_per_taxon(
    profiles: Sequence[Profile], places: Mapping[str, Mapping[str, str]]
) -> dict[tuple[str, str], set[str]]:
    """The species of every taxon, keyed by rank and Latin name."""
    members: dict[tuple[str, str], set[str]] = defaultdict(set)
    for profile in profiles:
        genus = genus_of(profile.latin)
        for rank in RANKS:
            value = genus if rank == "genus" else places[genus].get(rank)
            if value:
                members[(rank, value)].add(profile.slug)
    return dict(members)


def name_per_taxon(
    profiles: Sequence[Profile],
    places: Mapping[str, Mapping[str, str]],
    mentions: Mapping[str, list[tuple[str, int]]],
) -> dict[tuple[str, str], list[tuple[str, int]]]:
    """Sort every counted name under the taxon it names, most frequent first."""
    members = members_per_taxon(profiles, places)
    rank_of = {profile.slug: {} for profile in profiles}
    for (rank, value), slugs in members.items():
        for slug in slugs:
            rank_of[slug][rank] = value

    found: dict[tuple[str, str], dict[str, tuple[int, float]]] = defaultdict(dict)
    for name, seen in mentions.items():
        slugs = [slug for slug, _ in seen if slug in rank_of]
        if not slugs:
            continue
        for rank in RANKS:
            counted = Counter(rank_of[slug][rank] for slug in slugs if rank in rank_of[slug])
            if not counted:
                continue
            value, hits = counted.most_common(1)[0]
            if hits / len(slugs) >= PURITY and hits / len(members[(rank, value)]) > COVERAGE:
                place = sum(position for _, position in seen) / len(seen)
                found[(rank, value)][name] = (hits, place)
                break

    ordered = {}
    for taxon, candidates in found.items():
        ranking = sorted(candidates.items(), key=lambda entry: (-entry[1][0], entry[1][1], entry[0]))
        # Ein Gleichstand entscheidet nichts. Dann bleibt der Rang unbenannt.
        first, second = ranking[0], ranking[1] if len(ranking) > 1 else None
        if second and second[1] == first[1]:
            continue
        ordered[taxon] = [(name, count) for name, (count, _) in ranking]
    return ordered


def build_taxa(
    profiles: Sequence[Profile],
    places: Mapping[str, Mapping[str, str]],
    lines: Mapping[str, str],
) -> list[dict[str, object]]:
    """Build one row per taxon: slug, rank, both names, parent and the counts."""
    named = name_per_taxon(profiles, places, count_names(lines))

    latin_names: dict[str, set[str]] = defaultdict(set)
    for profile in profiles:
        genus = genus_of(profile.latin)
        latin_names["genus"].add(genus)
        for rank in ("family", "order", "class"):
            if places[genus].get(rank):
                latin_names[rank].add(places[genus][rank])

    parents = {}
    for profile in profiles:
        genus = genus_of(profile.latin)
        chain = [genus, *(places[genus].get(rank) for rank in ("family", "order", "class"))]
        known = [step for step in chain if step]
        for step, above in zip(known, known[1:], strict=False):
            parents[step] = above

    rows: list[dict[str, object]] = []
    for rank in RANKS:
        for latin in sorted(latin_names[rank]):
            counts = named.get((rank, latin), [])
            row: dict[str, object] = {
                "slug": slug_of(latin),
                "rang": RANKS[rank],
                "lateinisch": latin,
                "name": counts[0][0] if counts else latin,
                "elter": slug_of(parents[latin]) if latin in parents else None,
            }
            if counts:
                row["belege"] = dict(counts)
            rows.append(row)
    return rows


def _fetch(url: str, file: Path) -> bytes:
    """Load one address once and keep the answer on disk."""
    if not file.exists():
        file.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            file.write_bytes(response.read())
        # Beide Quellen sind fremde Dienste. Dreihundert Anfragen am Stueck
        # gehen im Schritt, nicht im Sprint.
        time.sleep(PAUSE_SECONDS)
    return file.read_bytes()


def cached_page(cache: Path) -> Callable[[str], str]:
    """A reader for the source pages, one file per address.

    The pages carry no charset that a parser could trust. They are Windows-1252
    all the way through, and the umlauts come out right that way.
    """

    def read(url: str) -> str:
        name = hashlib.sha1(url.encode()).hexdigest()  # noqa: S324
        return _fetch(url, cache / "seiten" / f"{name}.html").decode("cp1252", errors="replace")

    return read


def cached_match(cache: Path) -> Callable[[str], dict[str, str]]:
    """A reader for the GBIF backbone: where one Latin name sits."""

    def match(latin: str) -> dict[str, str]:
        query = urllib.parse.urlencode({"name": latin, "kingdom": "Fungi", "strict": "false"})
        name = hashlib.sha1(latin.encode()).hexdigest()  # noqa: S324
        found = json.loads(_fetch(f"{GBIF_MATCH}?{query}", cache / "gbif" / f"{name}.json"))
        return {rank: found[rank] for rank in ("family", "order", "class") if found.get(rank)}

    return match


def placements(
    profiles: Iterable[Profile], match: Callable[[str], Mapping[str, str]]
) -> dict[str, dict[str, str]]:
    """Place every genus: the family, order and class that its species match to."""
    seen: dict[str, list[Mapping[str, str]]] = defaultdict(list)
    for profile in profiles:
        seen[genus_of(profile.latin)].append(match(profile.latin))
    places = {}
    for genus, matches in seen.items():
        place = {}
        for rank in ("family", "order", "class"):
            counted = Counter(found[rank] for found in matches if found.get(rank))
            if counted:
                place[rank] = counted.most_common(1)[0][0]
        places[genus] = place
    return places


def report(taxa: Sequence[Mapping[str, object]]) -> str:
    """The count behind every German name, rank by rank."""
    lines = []
    for rank in RANKS.values():
        rows = [row for row in taxa if row["rang"] == rank]
        named = [row for row in rows if "belege" in row]
        lines.append(f"{rank}: {len(rows)} Taxa, {len(named)} mit deutschem Namen")
        for row in sorted(named, key=lambda row: str(row["lateinisch"])):
            counts = row["belege"]
            assert isinstance(counts, dict)
            evidence = ", ".join(f"{name} {count}" for name, count in counts.items())
            lines.append(f"  {row['lateinisch']}: {evidence}")
    return "\n".join(lines)


def main(
    argv: Sequence[str] | None = None,
    *,
    fetch_page: Callable[[str], str] | None = None,
    match_species: Callable[[str], Mapping[str, str]] | None = None,
) -> None:
    """Read the profiles, ask GBIF, count the names, write the file."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profiles", type=Path, required=True, help="folder with the TOML profiles")
    parser.add_argument("--out", type=Path, required=True, help="the JSON file to write")
    parser.add_argument(
        "--cache", type=Path, default=Path("data/raw/p123"), help="where the source pages are kept"
    )
    args = parser.parse_args(argv)

    profiles = read_profiles(args.profiles)
    read = fetch_page or cached_page(args.cache)
    match = match_species or cached_match(args.cache)
    places = placements(profiles, match)
    lines = {}
    for profile in profiles:
        line = feature_lines(clean(read(profile.url))).get("Gattung", "")
        if line:
            lines[profile.slug] = line

    taxa = build_taxa(profiles, places, lines)
    args.out.write_text(
        json.dumps(
            {
                "erzeugtAm": datetime.now(UTC).date().isoformat(),
                "quellen": {"einordnung": GBIF_MATCH, "namen": "https://www.123pilzsuche.de/"},
                "raenge": list(RANKS.values()),
                "taxa": taxa,
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{len(profiles)} Profile, {len(lines)} mit Gattungszeile, {len(taxa)} Taxa")
    print(report(taxa))


if __name__ == "__main__":
    main(sys.argv[1:])
