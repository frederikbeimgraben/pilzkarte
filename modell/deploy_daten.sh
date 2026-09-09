#!/usr/bin/env bash
# Den Arbeitsbaum auf den Homeserver spiegeln, damit er dort selbst rendert.
#
# Das ist der zweite Empfangspfad neben deploy.sh: der schiebt die fertige
# Seite, dieser den Code, die Modelle und die abgeleiteten Daten. Der Zielnutzer
# kann auch hier nur empfangen, erzwungenes rrsync -wo, keine Shell.
#
# Was mitgeht, rund 1,3 GB:
#   src/, update.sh, run_all.sh, render_de.sh   der Code
#   models/*.pkl                                die elf Modelle
#   data/interim/*.parquet                      Baeume, Gelaende, Boden, Funde,
#                                               Wetter je Zelle und Woche
#   data/interim/weekly/*.parquet               Wetter der fertigen Jahre
#   data/raw/dwd/hyras/*_JAHR-1_*.nc            Vorjahr, wegen der ISO-Woche
#                                               ueber den Jahreswechsel
#
# Nicht mitgehen die 6,3 GB HYRAS-Archiv der Jahre davor: seit
# --refresh-from rechnet der Server nur das laufende Jahr neu.
set -euo pipefail
cd "$(dirname "$0")"

ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_daten}
JAHR=$(date +%Y)
VORJAHR=$((JAHR - 1))

[ -f "$SCHLUESSEL" ] || { echo "kein Schluessel unter $SCHLUESSEL"; exit 1; }
[ -d models ] || { echo "keine Modelle im Arbeitsverzeichnis"; exit 1; }

echo "spiegle Code, Modelle und abgeleitete Daten nach $ZIEL"
# Dazu drei Teile der Seite, die der Server nicht selbst erzeugt: die
# Trainingsfunde je Art (schreibt final_model.py), die festen Eingabe-Ebenen
# und ihr Manifest. update.sh rechnet nur die Wochenebenen neu und liest die
# festen aus dem Manifest; ohne diese Dateien fielen sie beim Spiegeln in
# den Webordner weg. Die Kacheln der Arten bleiben ausgeschlossen, die
# rechnet der Server selbst.
rsync -a --delete --info=stats2 \
  --include='src/***' --include='models/***' \
  --include='data/' --include='data/interim/' \
  --include='data/interim/*.parquet' --include='data/interim/weekly/***' \
  --include='reports/' --include='reports/maps/' \
  --include='reports/maps/funde/***' --include='reports/maps/layers.json' \
  --include='reports/maps/layers_kacheln/***' \
  --include='update.sh' --include='run_all.sh' --include='render_de.sh' \
  --exclude='*' \
  -e "ssh -i $SCHLUESSEL -o IdentitiesOnly=yes" \
  ./ "$ZIEL":

echo "spiegle die DWD-Raster von $VORJAHR und $JAHR"
rsync -a --info=stats2 \
  --include='data/' --include='data/raw/' --include='data/raw/dwd/' \
  --include='data/raw/dwd/hyras/' --include='data/raw/dwd/hyras/*/' \
  --include="*_${VORJAHR}_*.nc" --include="*_${JAHR}_*.nc" \
  --exclude='*' \
  -e "ssh -i $SCHLUESSEL -o IdentitiesOnly=yes" \
  ./ "$ZIEL":

echo "fertig — der Timer rechnet montags um 03:30"
