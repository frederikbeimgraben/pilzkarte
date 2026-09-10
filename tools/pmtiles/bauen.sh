#!/usr/bin/env bash
# Das PMTiles-Archiv fuer Deutschland bauen.
#
# Die Aufrufliste unten ist die von OpenFreeMap (tilegen/tilegen_lib/planetiler.py),
# nur mit --area=germany statt planet. Nur so tragen die Kacheln dieselben
# Felder wie die Online-Karte, und die Stile "liberty" und "dark" passen offline
# ohne Aenderung.
#
# Zwei Abweichungen halten das Archiv unter 3 GB, ohne dass ein Pixel anders
# aussieht:
#
# --languages: nur de und en statt der 84 Sprachen von OpenFreeMap. Die Stile
# lesen als Beschriftung allein name:latin und name:nonlatin, und die App
# spricht de und en.
#
# --exclude-ids: die Kacheln tragen keine Merkmal-IDs. Die braucht nur, wer
# feature-state setzt; die Hintergrundkarte wird bloss gezeichnet.
#
# Gemessen an Deutschland, Zoom 14: 3,25 GB mit allen Sprachen, 3,12 GB mit
# de und en, 2,86 GB auch ohne IDs.
set -euo pipefail

PLANETILER_VERSION=${PLANETILER_VERSION:-v0.10.2}
PLANETILER_SHA256=${PLANETILER_SHA256:-f310bd0413e2e4512b27f4046d418664e8e1d3bf31603c2a70e23de06c167e4d}

HIER=$(cd "$(dirname "$0")" && pwd)
ARBEIT=${ARBEIT:-$HIER/arbeit}
ZIEL=${ZIEL:-$ARBEIT/deutschland.pmtiles}
GEBIET=${GEBIET:-germany}
SPEICHER=${SPEICHER:-8g}

JAR=$ARBEIT/planetiler-$PLANETILER_VERSION.jar
mkdir -p "$ARBEIT"

if [ ! -f "$JAR" ]; then
  echo "lade planetiler $PLANETILER_VERSION"
  curl -fsSL -o "$JAR.teil" \
    "https://github.com/onthegomap/planetiler/releases/download/$PLANETILER_VERSION/planetiler.jar"
  mv "$JAR.teil" "$JAR"
fi
echo "$PLANETILER_SHA256  $JAR" | sha256sum -c - >/dev/null

# Der Lauf legt Quellen und Zwischenstaende unter dem Arbeitsverzeichnis ab,
# nicht unter dem aktuellen Ordner. Die Quellen bleiben liegen, damit ein
# zweiter Lauf die 5 GB des OSM-Extrakts nicht noch einmal zieht.
cd "$ARBEIT"
zeit_start=$(date +%s)
nix run nixpkgs#jdk21 -- \
  "-Xmx$SPEICHER" -jar "$JAR" \
  "--area=$GEBIET" \
  --download \
  --download-threads=10 \
  --download-chunk-size-mb=1000 \
  --fetch-wikidata \
  "--output=$ZIEL" \
  --storage=mmap \
  --nodemap-type=sparsearray \
  --force \
  --languages=de,en \
  --exclude-ids \
  --transliterate=false
zeit_ende=$(date +%s)

nix run nixpkgs#pmtiles -- verify "$ZIEL"
echo "fertig: $ZIEL, $(du -h "$ZIEL" | cut -f1), $(( (zeit_ende - zeit_start) / 60 )) min"
echo "weiter mit: $HIER/hochladen.sh"
