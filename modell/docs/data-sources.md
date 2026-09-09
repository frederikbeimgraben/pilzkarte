# Data sources

This file lists every source, its license, and how to get it. "Open" means
that no account is needed.

## Occurrence records

### GBIF — in use

The download covers Germany, kingdom Fungi, human observations, with
coordinates and without a geospatial issue. The total is 746,827 records
(read on 2026-09-06).

The three datasets that carry the observations are:

| dataset | records | license |
|---|---|---|
| NABU\|naturgucker | 272,400 | CC-BY 4.0 |
| iNaturalist research-grade | 225,784 | CC-BY-NC 4.0 |
| Observation.org | 202,109 | CC-BY-NC 4.0 |

Access: open, no account. The script `gbif_fetch.py` uses the public search
API. That API returns at most 100,000 records for one query, so the script
splits the request by year, and large years by month.

An account gives access to the download API. That route returns a full
Darwin Core archive and a citable DOI. Use it when you publish results.

Note two things about the data. The kingdom Fungi includes lichens, and
lichens do not fruit in a seasonal way. Filter them out for the fruiting
model, but keep them in the effort background. The script replaces the
observer name with a SHA-256 hash, because the model needs the identity of
an observer but not the name.

Records that are not useful for fruiting: soil metabarcoding samples
(about 300,000 records from the Biodiversity Exploratories) and herbarium
specimens. The `basisOfRecord=HUMAN_OBSERVATION` filter removes them.

### pilze-deutschland.de (DGfM) — request sent

About 4.5 million records and more than 14,500 species. This is the best
fungal dataset for Germany. It reaches much further back than the app
portals, and experts check the determinations.

Access: not open. Do not scrape the site. The draft request is in
`correspondence/01-dgfm-datenanfrage.md`.

Much of the older material uses the MTB-Quadrant grid, which is about
5.6 km by 6 km. That grid sets the spatial resolution of any model built on
this source.

### Flora Incognita — request sent

The app identifies about 3,000 lichen and fungus species since 2025, next to
30,000 vascular plants and about 500 mosses.

Access: not open. Flora Incognita is not a GBIF publisher. The FAQ describes
only a personal CSV or GPX export. GBIF has an open request for this data at
https://github.com/gbif/data-mobilization/issues/176, with no reply so far.

Fungus support is one year old, so the temporal depth is one season. Treat
this as a source for later, not for the first model. The draft request is in
`correspondence/02-flora-incognita-datenanfrage.md`.

## Weather and soil moisture

### DWD HYRAS — in use

Daily grids for Germany at 1 km, from 1951. The download covers 2010 to 2026
for six variables: precipitation, mean air temperature, minimum and maximum
air temperature, humidity, and global radiation. One NetCDF file holds one
variable for one year, at 35 MB to 115 MB.

Access: open. https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/hyras_de/

### DWD soil moisture per tree species — in use

Daily grids at 1 km, from 1991, modelled separately for spruce, beech, oak
and pine stands. Several soil layers exist. The download uses the 0-30 cm
layer, which holds most of the mycorrhizal mycelium.

This is the most valuable weather layer for this project. The host tree
controls which mycorrhizal fungi can fruit at a site. A soil moisture field
per tree species matches that better than one generic field.

Access: open. Each file covers one species, one year, and one layer, at about
140 MB.
https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moisture/

### Other DWD grids — available, not yet used

Potential evapotranspiration (`evapo_p`) and soil temperature at 5 cm
(`soil_temperature_5cm`) are open. Both arrive as monthly .tgz archives.
Precipitation minus potential evapotranspiration gives a water balance, which
often predicts fruiting better than rainfall alone.

### ERA5-Land — needs an account

Hourly reanalysis at about 9 km, from 1950, with four soil moisture layers.
It needs a free Copernicus CDS account and an API key. The DWD grids beat it
inside Germany, so ERA5-Land is only useful to extend the model past the
German border.

## Static site properties

### Copernicus DEM GLO-90 — in use

Elevation at 90 m. The download covers 94 tiles for the German bounding box,
at 342 MB. Elevation, slope, and aspect all shift the local fruiting date.

Access: open, from the AWS open-data bucket. No account.
https://copernicus-dem-90m.s3.amazonaws.com/

### SoilGrids 250 m (ISRIC) — in use

Clay, sand, silt, pH, organic carbon, bulk density, coarse fragments and
nitrogen, for three depth layers. The web coverage service cuts the German
extent and returns a GeoTIFF of about 10 MB.

Access: open, no account. https://maps.isric.org/

### OpenStreetMap, Germany extract — in use

OpenStreetMap tags forest polygons with `leaf_type`, which separates
broadleaved from needleleaved cover. German forest mapping is good. This
replaces the Copernicus forest-type layer, which needs an account.

Access: open. https://download.geofabrik.de/europe/germany-latest.osm.pbf
Use `osmium-tool` from the Nix shell to cut out the forest polygons.

### BGR BÜK200 — available as a map service

The German soil map at 1:200,000. The WMS at
https://services.bgr.de/wms/boden/buek200/ responds without an account, but a
WMS returns pictures, not soil classes. SoilGrids covers the same need with
real values, so use BÜK200 only if you need the German soil-type classes.

### Copernicus HRL forest layers — needs an account

Tree cover density and dominant leaf type at 10 m. Better than OpenStreetMap
for forest composition, but the download needs a free Copernicus Land account.
Get one if the OpenStreetMap layer proves too coarse.

## Citation

The European extract used from 2026-09-06 onward has a DOI. Cite it as:

    GBIF.org (6 September 2026) GBIF Occurrence Download
    https://doi.org/10.15468/dl.9sapgr

It holds 5,911,058 human observations of fungi with coordinates from Germany,
Austria, Switzerland, the Netherlands, Belgium, Luxembourg, Denmark, Czechia,
Poland and France, from 2014 onward. 681 MB as a simple CSV.

The earlier German-only pull came from the search API and therefore has no
DOI. Use this download for anything published.
