# LP188.2A Projected-Area Membership Repair

## Root cause assessment

The certification GeoPackage previously copied both authoritative layers in
their source CRS, EPSG:4269, and evaluated `ST_Area(ST_Intersection(...))`
directly on those geographic coordinates. The Windows diagnostic result—valid,
intersecting polygons with every computed area reported as `0.0`—is consistent
with that unsuitable working-area operation. The source CRS and vintage match;
the repair does not alter either source dataset or add a membership fallback.

## Governed working CRS

The temporary certification layers use **EPSG:3083 — NAD83 / Texas Centric
Albers Equal Area**. It is a single deterministic CRS designed for statewide
Texas coverage, uses metres, and has an equal-area projection suitable for
polygon-intersection area measurement. GDAL/OGR must successfully transform
both layers to EPSG:3083 and report EPSG:3083 on both temporary layers or the
run fails closed.

## Certification method

The builder reads the authoritative EPSG:4269 PLACE and COUNTY shapefiles,
verifies their declared CRS, and uses `ogr2ogr -t_srs EPSG:3083` to create
`places_projected` and `counties_projected` in a randomly named temporary
GeoPackage. Source attributes, including canonical PLACE identity attributes,
are carried into the working layer. Polygon promotion remains enabled. No
command writes to or replaces either source shapefile.

The uniform membership predicate, applied to all 1,863 canonical PLACE rows,
is:

```sql
ST_Intersects(p.geom, c.geom)
AND ST_Area(ST_Intersection(p.geom, c.geom)) > 0
```

Here `p.geom` and `c.geom` are exclusively the EPSG:3083 temporary geometries.
There is no percentage, epsilon, buffer, minimum-square-metre threshold, or
centroid/internal-point/nearest/name assignment fallback. Boundary-only point
or line contact therefore remains excluded.

Unmatched diagnostics use the same projected layers and expose
`maximumIntersectionAreaSquareMeters`. `intersectsAnyCounty`, `touchesOnly`, and
`internalPointInOrOnCounty` remain diagnostic evidence only. Final membership
counts are deliberately not encoded: the owner Windows run must recompute the
complete membership set and derive all reconciliation counts. Any unmatched
place or other governed reconciliation failure prevents output promotion.

## Owner Windows retest

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\GitHub\Gridly-Source-Data\Tools\Build-Scripts\Build-CensusPlaceCountyMemberships.ps1
```

