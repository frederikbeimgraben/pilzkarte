#!/usr/bin/env bash
# Download the DWD grids in one sequential pass, so the server sees one stream.
set -u
cd "$(dirname "$0")"
echo "=== HYRAS 2010-2026 ==="
python3 -u src/pilze/dwd_fetch.py hyras --start 2010 --end 2026
echo
echo "=== soil moisture 0-30 cm, 2010-2026 ==="
python3 -u src/pilze/dwd_fetch.py soil --start 2010 --end 2026 --depth 0-30
echo
echo "=== DONE $(date -Is) ==="
