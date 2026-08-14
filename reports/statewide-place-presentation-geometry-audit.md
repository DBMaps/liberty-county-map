# Statewide PLACE Presentation Geometry Audit

Audit-only evidence. No production target is selected or authorized.

## Source and method

- Source: `tl_2025_48_place.zip` (9782040 bytes; SHA-256 `5a0c4d49641f69028ee9f5c343bf09936ec00a378e5e6393115b106bab935e13`).
- Source CRS: EPSG:4269. Working CRS: EPSG:3083 — NAD83 / Texas Centric Albers Equal Area.
- Toolchain: GDAL 3.13.0 "Iowa City", released 2026/05/04; QGIS 3.44.11; GEOS/PROJ through GDAL/OGR.
- Area-weighted centroid and deterministic GEOS point-on-surface are computed only in EPSG:3083. Distances use the mean-radius haversine documented in JSON.

## Reconciliation

| Eligible | Matched | Missing | Duplicate | Excluded leakage |
|---:|---:|---:|---:|---:|
| 1859 | 1859 | 0 | 0 | 0 |

## Statewide summary

- Centroids outside their feature: **95**
- Multipart PLACEs: **241**

## Required six-city detail

| GEOID | Place | Area m² | Parts | Centroid contained | INTPT→centroid m | INTPT→bbox m | INTPT→surface m | Centroid→surface m |
|---|---|---:|---:|---|---:|---:|---:|---:|
| 4819000 | Dallas | 993651570.368 | 3 | true | 28.866 | 4263.82 | 2711.999 | 2683.328 |
| 4824000 | El Paso | 671731391.991 | 1 | true | 123.788 | 4173.394 | 7295.001 | 7376.812 |
| 4841464 | Laredo | 286305832.349 | 1 | true | 292.503 | 5105.84 | 1498.627 | 1492.384 |
| 4842568 | Liberty | 118545703.841 | 6 | true | 150.997 | 4027.148 | 1355.202 | 1435.425 |
| 4854708 | Palestine | 50921690.513 | 1 | true | 19.868 | 309.944 | 876.119 | 885.683 |
| 4865000 | San Antonio | 1307203062.123 | 9 | true | 40.365 | 817.028 | 3251.442 | 3284.052 |

Exact coordinates, bounds, candidate distances, segment statistics, focus comparisons, and all 1,859 records are preserved in the companion JSON.
