#!/usr/bin/env bash
# One series per species. final_model.py builds two models in one run: the
# horizon 0 model for the weeks that happened and the horizon 2 model for the
# two forecast weeks. region_map.py picks the right one per week.
# Logs go to reports/rebuild/<slug>.*.log, so a failed step can be read.
set -u
cd "$(dirname "$0")"
LOGS=${LOGS:-reports/rebuild}; mkdir -p "$LOGS"
run () {
  SLUG=$1; TAXA=$2; LABEL=$3; WALD=${4:-0.03}
  # NUR="a b c" beschraenkt den Lauf auf diese Arten, etwa fuer zwei
  # Instanzen nebeneinander: jede rechnet mit acht Faeden.
  if [ -n "${NUR:-}" ] && ! echo " $NUR " | grep -q " $SLUG "; then return; fi
  echo "=========== $LABEL ($SLUG) $(date +%H:%M:%S) ==========="
  # Fertige Arten ueberspringen, ausser NEU=1 erzwingt alles.
  if [ "${NEU:-0}" != "1" ] && [ -f "reports/maps/${SLUG}.json" ] \
     && [ -f "models/${SLUG}.pkl" ]; then
    echo "--- $LABEL steht schon, uebersprungen ---"
    return
  fi
  if [ "${NEU:-0}" = "1" ] || [ ! -f "data/processed/visits_${SLUG}.parquet" ]; then
    python -u src/pilze/visit_model.py --species "$TAXA" --min-species 2 --quick \
        --save-prepared "data/processed/visits_${SLUG}.parquet" \
        2>&1 | tee "$LOGS/$SLUG.visits.log" | grep -E "^visits with weather" | head -1 || return
  fi
  python -u src/pilze/final_model.py --data "data/processed/visits_${SLUG}.parquet" \
      --name "$SLUG" --species "$TAXA" \
      2>&1 | tee "$LOGS/$SLUG.model.log" | grep -E "^(=====|chosen|calibration ceiling|Brier)"
  [ -f "models/${SLUG}.pkl" ] || { echo "FEHLER: kein Modell fuer $SLUG"; tail -5 "$LOGS/$SLUG.model.log"; return; }
  python -u src/pilze/region_map.py --model "models/${SLUG}.pkl" --name "$SLUG" \
      --region de --weeks 90 --forecast 2 --step 500 --min-forest "${WALD:-0.03}" \
      --tiles --no-image 2>&1 | tee "$LOGS/$SLUG.map.log" | grep -E "^(wrote|  Kacheln)"
  [ -f "reports/maps/${SLUG}.json" ] || { echo "FEHLER: keine Karte fuer $SLUG"; tail -5 "$LOGS/$SLUG.map.log"; return; }
  python -u src/pilze/build_page.py > /dev/null 2>&1 || true
  echo "--- $LABEL live ---"
}
run boletus_edulis "Boletus edulis" "Steinpilz"
run pfifferling "Cantharellus cibarius" "Pfifferling"
run birkenpilz  "Leccinum scabrum" "Birkenpilz"
run reizker     "Lactarius deliciosus,Lactarius deterrimus,Lactarius salmonicolor,Lactarius semisanguifluus" "Reizker"
run hexen_flock "Neoboletus erythropus" "Flockenstieliger Hexenroehrling"
run hexen_netz  "Suillellus luridus" "Netzstieliger Hexenroehrling"
run parasol        "Macrolepiota procera" "Parasol"
run nebelkappe     "Clitocybe nebularis" "Nebelkappe"
run flaschenbovist "Lycoperdon perlatum" "Flaschenbovist"
run schleimruebling "Mucidula mucida" "Buchen-Schleimruebling"
# Der Schopftintling waechst an Wegraendern und auf Wiesen, nicht im Wald.
# Die Waldmaske von 3 Prozent wuerde ihn dort ausblenden, wo er steht.
run schopftintling "Coprinus comatus" "Schopftintling" 0.0
python -u src/pilze/build_page.py
echo "=========== ALL REBUILT $(date -Is) ==========="
