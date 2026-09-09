#!/usr/bin/env bash
# Den Angular-Build in die Dokumentwurzel des Homeservers spiegeln.
#
# Die Wurzel gehoert nicht dem Build allein: das Rendering schreibt dort die
# Kacheln, Manifeste und Ebenen. Ohne die Schutzfilter wuerde --delete sie
# mitnehmen. assets/ faellt unter denselben Schutz; veraltete Dateien darin
# schaden nicht, weil Angular sie nicht mehr referenziert.
set -euo pipefail
cd "$(dirname "$0")/.."
ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_deploy}
QUELLE=frontend/dist/pilzkarte/browser/

[ -f "$QUELLE/index.html" ] || { echo "kein Build in $QUELLE, erst: cd frontend && npm run build"; exit 1; }
echo "spiegle Build ($(du -sh "$QUELLE" | cut -f1)) nach $ZIEL"
rsync -av --delete --info=stats2 \
  --filter='P /*/' --filter='P /*.json' \
  -e "ssh -i $SCHLUESSEL -o IdentitiesOnly=yes" \
  "$QUELLE" "$ZIEL":
echo "fertig: https://pilze.beimgraben.net"
