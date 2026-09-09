# Pilze — fruiting prediction for German macrofungi

The goal is a model that answers one question: in which week, and in which
part of Germany, does a given mushroom species fruit?

The model joins three kinds of data.

1. Occurrence records of fungi with a coordinate and a date.
2. Daily weather and soil moisture on a 1 km grid.
3. Static site properties: elevation, soil, and forest composition.

## The central design decision

Citizen-science records do not measure fruiting. They measure reporting. The
record count for Germany rose from about 10,000 in 2012 to about 152,000 in
2025. That growth comes from app adoption, not from more mushrooms. Records
also cluster near towns, near paths, and on weekends.

The project handles this with a target-group background. The model does not
predict "a fungus is present here". It predicts:

    P(target species | somebody reported any fungus in this cell this week)

All fungal records form the background. Observer effort appears in the
numerator and in the denominator, so it largely cancels. This matters more
than the choice of model architecture.

## Data volume sets the limits

Germany holds 746,827 human observations of fungi with coordinates on GBIF.
Per species the numbers are much smaller:

| species | records in Germany |
|---|---|
| Macrolepiota procera | 6,148 |
| Boletus edulis | 4,659 |
| Imleria badia | 4,440 |
| Cantharellus cibarius | 2,174 |
| Leccinum scabrum | 1,553 |
| Craterellus cornucopioides | 658 |

A grid of 1 km cells and weekly steps gives about 280 million cell-weeks over
15 years. About 4,000 of them hold a Boletus edulis record. A sequence model
on that grid learns to predict zero.

Two consequences follow. Pool species into groups that share a host tree and
a habitat. Start with gradient boosting on lagged weather features, not with
an LSTM. Move to a sequence model after the simple model works.

## Validation

Use blocked cross-validation. Hold out whole years, and hold out whole
regions. A random split gives a high score that means nothing, because two
people who report the same flush produce near-duplicate rows.

## Layout

    src/pilze/gbif_fetch.py     occurrence records from GBIF
    src/pilze/dwd_fetch.py      DWD 1 km daily grids
    src/pilze/static_fetch.py   elevation, soil, OpenStreetMap extract
    correspondence/             data-request emails, drafts
    docs/data-sources.md        every source, with license and access notes
    data/raw/                   downloads, not in version control

## Start

The fetchers use the Python standard library only. They run with any Python
3.11 or later.

    python src/pilze/gbif_fetch.py --out data/raw/gbif --start 1970 --end 2026
    python src/pilze/dwd_fetch.py hyras --start 2010 --end 2026
    python src/pilze/dwd_fetch.py soil --start 2010 --end 2026 --depth 0-30
    python src/pilze/static_fetch.py dem
    python src/pilze/static_fetch.py soil
    python src/pilze/static_fetch.py osm

Every fetcher skips a file that is already present. You can stop a fetcher and
start it again.

For the analysis steps, use the Nix shell. It gives numpy, pandas, xarray,
netCDF4, geopandas, rasterio, LightGBM, GDAL, and osmium.

    nix develop

Do not install numpy with pip on NixOS. The wheel cannot find libstdc++ and
the import fails.

## The app and the find server

The page has four parts, reachable from one navigation: the map, the species
catalogue, the reported finds and an info page. On a phone the controls sit in
a sheet that slides up from the bottom; on a larger screen they fill a column
on the left. The files are `src/pilze/web/index.html`, `app.css` and
`app.js`; `build_page.py` fills them with the manifests and the catalogue.

The catalogue in `src/pilze/katalog.py` holds one profile per species: what
to look at, where it grows, what it can be confused with, what the law says,
and the season curve from the training finds. The profiles are written for
this project; each links to the detail page of 123pilzsuche.de where one
exists, and to Wikipedia. They are not an identification key.


The page is a progressive web app. A phone installs it from the browser
menu, and the service worker keeps the page, the Leaflet library and the
tiles that were seen, so the map opens in the forest without a signal. Finds
reported without a signal wait in the browser and go out when the connection
is back.

Two things on the page go beyond the prediction.

1. **Fund melden.** A visitor with the access code sets a marker on the map
   or takes the phone position, names the species, the date and a name, and
   the find goes to the server. Reported finds show as orange markers, per
   species, and anyone with the code can remove one. The finds are exact
   positions and are visible only with the code.
2. **Kombination.** The input layers and the prediction share one tiling, so
   the browser can read several of them for the same tile and combine them
   pixel by pixel: geometric mean, minimum, or weighted mean, each layer
   with a direction and a weight. This answers a question the model does
   not ask, such as "beech within 1 km, rain of the last four weeks, and the
   prediction, all at once".

The server is `src/pilze/api.py`, standard library only, one SQLite file.
It runs behind Caddy on the homeserver under `/api/`. The access code is
generated on the first start and printed to the journal:

    journalctl -u pilze-api | grep Zugangscode

For a local test the script also serves the map directory:

    python src/pilze/api.py --static reports/maps --port 8111

## The manifests

Every rendered map writes a manifest next to its tiles: `<slug>.json` per
species, `layers.json` for the input layers. Beside the tile names each entry
carries a histogram of its values over Germany. The Faktor screen of the app
shows that distribution with two handles; the browser cannot count 2.3 million
cells per week, and a value tile only holds a byte per point.

    "histogramm": {"klassen": [41 edges], "anteile": [40 shares]}

- Forty classes over the scale the entry already declares: `low` to `high` in
  the unit of the layer, `0` to `top` for a prediction. A handle therefore
  points at metres, at a pH or at a probability.
- `klassen` holds 41 edges, not 40 lower edges. The upper edge of the last
  class is a number the screen prints. It must not depend on a subtraction in
  the browser.
- `anteile` sums to 1. Every point covers the same 500 m by 500 m in an
  equal-area projection, so a share is a share of the area. A point without
  data does not count. A value outside the scale falls into the outer class,
  which is where the value tile puts it too.
- A weekly layer keeps its histograms in `histogramme`, a map from the week
  key to the histogram, beside `weeks`. `weeks` stays a list of week keys:
  `update.sh` deletes every tile folder that is no longer in it.
- A prediction keeps its histogram in the week entry, `weeks[i].histogramm`.

`region_map.py` and `input_layers.py` count while they still hold the field.
`week_stats.py --maps reports/maps` fills a manifest that was rendered before,
from the coarsest zoom level, and `--force` recomputes.

## Tests

    nix develop . --command python -m pytest tests

## Legal and ethical limits

The iNaturalist and Observation.org records carry a CC-BY-NC license. They
suit research and a private tool. They do not suit a commercial product.

Boletus edulis and Cantharellus cibarius are "besonders geschützt" under the
Bundesartenschutzverordnung. Collection is legal only in small amounts for
personal use.

Do not publish precise locations of rare or protected species. A public map
must use a coarse grid of 5 km or more. This is also honest about the true
accuracy of the model.
