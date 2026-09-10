#!/usr/bin/env bash
# Das PMTiles-Archiv in die Dokumentwurzel des Homeservers legen.
#
# Ohne --delete: in der Wurzel liegen Angular-Build, Kacheln und Manifeste.
# rsync schreibt erst eine Temporaerdatei und benennt sie um, darum sieht ein
# laufender Client entweder das alte oder das neue Archiv, nie ein halbes.
set -euo pipefail
cd "$(dirname "$0")"

ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_deploy}
QUELLE=${QUELLE:-arbeit/deutschland.pmtiles}
URL=${URL:-https://pilze.beimgraben.net/karte/deutschland.pmtiles}

[ -f "$QUELLE" ] || { echo "kein Archiv in $QUELLE, erst: ./bauen.sh"; exit 1; }

echo "lade $QUELLE ($(du -h "$QUELLE" | cut -f1)) nach $ZIEL:karte/"
rsync -a --info=progress2 \
  -e "ssh -i $SCHLUESSEL -o IdentitiesOnly=yes" \
  "$QUELLE" "$ZIEL":karte/

# Die App holt Kacheln ueber HTTP-Range. Ohne 206 nuetzt das Archiv nichts.
echo "Range-Probe:"
curl -sI -r 0-1023 "$URL" | grep -iE '^(HTTP/|content-range|content-length|content-type)'
nix run nixpkgs#pmtiles -- show "$URL"
