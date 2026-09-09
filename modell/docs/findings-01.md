# First results — Boletus edulis

Date: 2026-09-06. Data: 626,420 of 746,827 GBIF records. October to December
2025 and all of 2026 were still downloading, so repeat this run later.

Training table: 125,449 cell-weeks, 2,632 of them positive. The base rate is
2.08 percent. Cells are 5 km in EPSG:3035. Steps are ISO weeks. The rows cover
2015 to 2025.

## What the models saw

| set | features |
|---|---|
| effort_only | record count, species count, observer count |
| season | effort + week of the year |
| place | season + cell position |
| weather | place + lagged rain, temperature and soil moisture |
| weather_noeffort | the same as weather, but without the effort columns |

## Results

AUC and average precision, mean over the folds.

| set | year AUC | year AP | space AUC | space AP |
|---|---|---|---|---|
| effort_only | 0.819 | 0.189 | 0.802 | 0.164 |
| season | 0.863 | 0.221 | 0.865 | 0.197 |
| place | 0.876 | 0.261 | 0.856 | 0.192 |
| weather | **0.885** | **0.275** | **0.878** | **0.225** |
| weather_noeffort | 0.807 | 0.109 | 0.795 | 0.071 |

Folds are blocked. The year scheme holds out one whole year, eleven times. The
space scheme holds out one band of cells about 100 km wide, seven times.

## The main finding

Survey effort alone reaches an AUC of 0.819. Everything else together, without
the effort columns, reaches 0.807. The strongest single signal in this dataset
is how hard people looked, not what the weather did.

This matters more than it looks, because **the effort columns cannot be known
in advance**. Nobody knows next week how many species other people will report
in a cell. A model that forecasts must therefore run without them. The row that
describes real forecast skill is weather_noeffort: an AUC of 0.807 and an
average precision of 0.109 against a base rate of 0.021. That is a lift of
about five times over chance. It is a real signal. It is not yet a useful
prediction.

The target-group background removed part of the effort effect, as intended.
It did not remove enough.

## What the weather contributed

Weather improves the full model by 0.009 AUC over season and place under year
blocking, and by 0.022 under space blocking. The improvement is small but it
is consistent across both fold schemes.

The features it chose make biological sense. Rain at a lag of two to eight
weeks ranks 5, 6, 9, 12 and 13 by gain, above rain in the current week. Rolling
rain sums over four and eight weeks also rank high. Fruiting follows rain after
a delay, and the model found that delay without being told.

The cell position helps under year blocking and hurts under space blocking
(0.865 to 0.856). Raw coordinates cannot extrapolate into a region that the
model never saw. Replace them with site properties.

## The negative result

The DWD soil moisture grids contributed nothing. Not one of the sixteen
paws features reached the top thirty by gain, for any of the four tree
species. The download was about 9 GB.

Two likely reasons. The values correlate strongly with recent rain, which the
model already has. The stand type in the grid says what the soil moisture would
be under spruce, beech, oak or pine, but it does not say which of them actually
grows in the cell. Until the model knows the real forest composition, the four
fields are four versions of the same thing.

Test the anomaly instead of the value. Soil moisture 30 percent below the
normal level for that cell in that week probably matters more than 90 percent
nFK on its own.

## Calibration

The model reproduces the shape of the season well. The peak is week 39, in late
September, which matches the known season. January to May is near zero.

The peak height is too low. In week 39 the observed rate is 0.064 and the mean
prediction is 0.043. The model is under-confident where it matters most.

## Next steps

1. Replace the effort columns with values that are known in advance: the mean
   effort of that cell in that week of the year over past years, population
   density, distance to a road or a parking place, and a weekend flag.
2. Add the static site data. The DEM, SoilGrids and the OpenStreetMap forest
   polygons are downloaded but no model uses them yet. These also replace the
   raw cell position, which fails across regions.
3. Pool species into groups that share a host tree. Boletus edulis alone gives
   2,632 positive cell-weeks. That is too few to learn a lag structure well.
4. Use the soil moisture anomaly, not the soil moisture.
