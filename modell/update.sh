#!/usr/bin/env bash
# Neue Wochen nachrechnen und die Seite aktualisieren.
#
# Nur die Teile, die sich aendern: das Wetter des laufenden Jahres, die
# Fundmeldungen der letzten Monate, und die Wochen, die davon beruehrt sind.
# Die Modelle bleiben, wie sie sind — die trainiert man selten, nicht taeglich.
#
# Was gebraucht wird (rund 400 MB statt der 21 GB der Forschungspipeline):
#   models/*.pkl                        die Modelle
#   data/interim/tree_scales.parquet    Baumanteile in vier Radien
#   data/interim/site.parquet           Gelaende und Boden
#   data/interim/trees_de_500m.parquet  das Kartenraster, Deutschland
#   data/interim/occurrences.parquet    Funde, wird hier fortgeschrieben
#   data/interim/weather_weekly.parquet Wetter, wird hier fortgeschrieben
#   data/raw/dwd/hyras/*/               das laufende und das Vorjahr
#   data/interim/weekly/*.parquet       Wetter der abgeschlossenen Jahre
set -euo pipefail
cd "$(dirname "$0")"

JAHR=$(date +%Y)
WOCHEN=${WOCHEN:-90}
LOG() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

LOG "1/5 Wetter des laufenden Jahres holen"
# HYRAS waechst im laufenden Jahr mit. Die Datei muss deshalb weg, sonst
# ueberspringt der Downloader sie und die neuen Tage fehlen.
find data/raw/dwd/hyras -name "*_${JAHR}_*.nc" -delete 2>/dev/null || true
python -u src/pilze/dwd_fetch.py hyras --start "$JAHR" --end "$JAHR" 2>&1 | tail -3

LOG "2/5 Wetter neu aggregieren"
# Nur das laufende Jahr. Die Zwischenspeicher unter data/interim/weekly
# bleiben stehen, sonst muesste das ganze HYRAS-Archiv vorgehalten werden,
# um jede Woche dreizehn Jahre neu zu rechnen.
# Ohne --cells-from. Das beschraenkt auf Zellen mit Fundmeldung, also auf
# 12.502 von 14.980, und die Karte spart alles ohne Wetterzelle als Ausland
# aus: 17 Prozent der Flaeche waeren nach der ersten Auffrischung weg.
python -u src/pilze/extract_grids.py --start 2014 --end "$JAHR" \
    --refresh-from "$JAHR" \
    --out data/interim/weather_weekly.parquet 2>&1 | tail -3
python -u src/pilze/merge_weekly.py 2>&1 | tail -2

LOG "3/5 neue Fundmeldungen"
python -u src/pilze/gbif_fetch.py --out data/raw/gbif --start "$JAHR" --end "$JAHR" \
    --pause 0.5 2>&1 | tail -3
python -u src/pilze/build_occurrences.py 2>&1 | tail -2

LOG "4/5 Karten neu rendern"
# Immer alle Arten, nicht nur die neue Woche. Die Kacheln kodieren den Wert
# relativ zum Hoechstwert der Art, und der kann sich mit einer neuen Woche
# aendern. Wer nur anbaut, mischt zwei Massstaebe in einem Satz.
for M in models/*.pkl; do
  SLUG=$(basename "$M" .pkl)
  # Der Schopftintling steht an Wegraendern, nicht im Wald. Die Waldmaske
  # wuerde ihn dort ausblenden, wo er waechst.
  WALD=0.03; [ "$SLUG" = "schopftintling" ] && WALD=0.0
  python -u src/pilze/region_map.py --model "$M" --name "$SLUG" \
      --region de --weeks "$WOCHEN" --forecast 2 --step 500 \
      --min-forest "$WALD" --tiles --no-image 2>&1 | tail -1
done
# Die Wetterebenen laufen mit dem Wochenregler mit, also dieselben Wochen.
# Die festen Ebenen bleiben stehen, die aendern sich nicht.
python -u src/pilze/input_layers.py --tiles --no-image --only-weekly \
    --weeks "$WOCHEN" 2>&1 | tail -1

LOG "4b/5 Wochen wegraeumen, die aus dem Fenster gefallen sind"
python - <<'PY'
import json, shutil
from pathlib import Path
karten = Path("reports/maps")
def raeume(wurzel, behalten):
    if not behalten or not wurzel.is_dir():
        return
    for ordner in wurzel.iterdir():
        if ordner.is_dir() and ordner.name not in behalten:
            shutil.rmtree(ordner)
            print(f"  weg: {ordner}")
for manifest in karten.glob("*.json"):
    if manifest.name == "layers.json":
        ebenen = json.loads(manifest.read_text()).get("layers", {})
        for ebene in ebenen.values():
            if not ebene.get("static") and "tiles" in ebene:
                raeume(karten / ebene["tiles"], set(ebene.get("weeks", [])))
        continue
    satz = json.loads(manifest.read_text())
    behalten = {Path(w["tiles"]).name for w in satz.get("weeks", []) if "tiles" in w}
    raeume(karten / f"{satz['name']}_kacheln", behalten)
PY

python -u src/pilze/build_page.py 2>&1 | tail -1

LOG "5/5 veroeffentlichen"
# Der Job laeuft unbeaufsichtigt und spiegelt mit --delete. Vorher pruefen,
# dass ueberhaupt eine vollstaendige Seite dasteht: set -e faengt einen
# Abbruch, aber nicht einen Lauf, der leise zu wenig geschrieben hat.
ARTEN=$(ls reports/maps/*.json 2>/dev/null | grep -vc layers.json || true)
SEITE=$(stat -c %s reports/maps/index.html 2>/dev/null || echo 0)
if [ "$ARTEN" -lt 1 ] || [ "$SEITE" -lt 10000 ]; then
  echo "ABBRUCH: nur $ARTEN Arten und index.html mit $SEITE Byte."
  echo "Die stehende Seite bleibt, wie sie ist."
  exit 1
fi
echo "  $ARTEN Arten, index.html $((SEITE / 1024)) kB"
# Auf dem Homeserver selbst gibt es nichts zu spiegeln: dort zeigt LOKAL_ZIEL
# auf den Webordner, und die Kacheln wandern nur ein Verzeichnis weiter.
# Von der Arbeitsmaschine aus geht es ueber ssh.
if [ -n "${LOKAL_ZIEL:-}" ]; then
  rsync -a --delete --exclude '_work_*' --exclude '*.parquet' --exclude '*.log' \
      reports/maps/ "$LOKAL_ZIEL"/
  echo "  nach $LOKAL_ZIEL geschrieben"
else
  ./deploy.sh 2>&1 | tail -2
fi
LOG "fertig"
