#!/usr/bin/env bash
# Deutschlandweit, nur Wertkacheln. Vollbilder waeren 1,4 GB, die niemand
# laedt: ein Bild wiegt 1,4 MB, ein Kachelblick 90 bis 300 kB.
set -u
cd "$(dirname "$0")"
karte () {
  SLUG=$1; LABEL=$2; WALD=${3:-0.03}
  if [ "${NEU:-0}" != "1" ] && [ -d "reports/maps/${SLUG}_kacheln" ]; then
    echo "--- $LABEL steht schon, uebersprungen ---"; return
  fi
  echo "=========== $LABEL ($SLUG) $(date +%H:%M:%S) ==========="
  python -u src/pilze/region_map.py --model "models/${SLUG}.pkl" --name "$SLUG" \
      --region de --weeks 90 --forecast 2 --step 500 --min-forest "$WALD" \
      --tiles --no-image 2>&1 | grep -E "^(wrote|  Kacheln|  ausgespart)" 
  [ -f "reports/maps/${SLUG}.json" ] || echo "FEHLER: keine Karte fuer $SLUG"
}
karte boletus_edulis "Steinpilz"
karte pfifferling    "Pfifferling"
karte birkenpilz     "Birkenpilz"
karte reizker        "Reizker"
karte hexen_flock    "Flockenstieliger Hexenroehrling"
karte hexen_netz     "Netzstieliger Hexenroehrling"
karte parasol        "Parasol"
karte nebelkappe     "Nebelkappe"
karte flaschenbovist "Flaschenbovist"
karte schleimruebling "Buchen-Schleimruebling"
karte schopftintling "Schopftintling" 0.0
echo "=========== FERTIG $(date -Is) ==========="
