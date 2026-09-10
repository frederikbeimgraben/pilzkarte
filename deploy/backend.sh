#!/usr/bin/env bash
# Das Backend in den Arbeitsbaum des Homeservers spiegeln.
#
# Der Dienst startet neu, sobald deploy.stamp geschrieben wird. Der Stempel
# geht deshalb in einem zweiten Aufruf: waehrend des ersten ist der Code noch
# unvollstaendig, und ein Neustart mitten im Kopieren wuerde eine halbe
# Version starten. Die Migration laeuft beim Neustart im Dienst selbst.
set -euo pipefail
cd "$(dirname "$0")/.."
ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_daten}
SSH="ssh -i $SCHLUESSEL -o IdentitiesOnly=yes"

[ -f backend/app/main.py ] || { echo "kein Backend unter backend/app"; exit 1; }
echo "spiegle Backend nach $ZIEL:app/backend"
# rsync legt keine Elternordner an, und app/ gehoert keinem der Deploys der
# Kette. Ein leeres Geruest davor macht den ersten Lauf auf einem frischen
# Server moeglich und kostet danach nichts.
GERUEST=$(mktemp -d)
mkdir -p "$GERUEST/app/backend"
rsync -a -e "$SSH" "$GERUEST/app" "$ZIEL":
rm -rf "$GERUEST"
rsync -a --delete --info=stats2 \
  --exclude 'tests/' --exclude '.venv/' --exclude '__pycache__/' --exclude '.pytest_cache/' \
  --exclude '.ruff_cache/' --exclude 'var/' --exclude '.env' --exclude 'deploy.stamp' \
  -e "$SSH" backend/ "$ZIEL":app/backend/
STEMPEL=$(mktemp)
date -u +%Y-%m-%dT%H:%M:%SZ > "$STEMPEL"
rsync -a -e "$SSH" "$STEMPEL" "$ZIEL":app/backend/deploy.stamp
rm -f "$STEMPEL"
echo "fertig, der Dienst startet neu"
