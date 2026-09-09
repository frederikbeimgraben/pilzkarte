#!/usr/bin/env bash
# Die gerenderte Seite auf den Homeserver spiegeln.
# Der Zielnutzer dort kann nur empfangen: erzwungenes rrsync -wo, keine Shell.
set -euo pipefail
cd "$(dirname "$0")"
ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
QUELLE=reports/maps/

[ -f "$QUELLE/index.html" ] || { echo "keine index.html in $QUELLE"; exit 1; }
echo "spiegle $(du -sh "$QUELLE" | cut -f1) nach $ZIEL"
# -W statt Delta-Abgleich: Kacheln aendern sich nie, sie kommen oder gehen.
# Bei Zehntausenden kleiner Dateien ist das Rechnen teurer als das Senden.
rsync -av --delete -W --info=stats2 \
  --exclude '_work_*' --exclude '*.parquet' --exclude '*.log' \
  -e "ssh -i $HOME/.ssh/pilze_deploy -o IdentitiesOnly=yes" \
  "$QUELLE" "$ZIEL":
echo "fertig — https://pilze.beimgraben.net"
