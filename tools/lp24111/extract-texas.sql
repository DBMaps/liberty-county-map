-- DuckDB 1.5.5 / Overture 2026-08-19.0 staged spatial-authority build.
-- The numeric Texas bounds are deliberately literal: remote Parquet pruning did
-- not occur when equivalent values were supplied by a CTE.
INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;
SET preserve_insertion_order = false;

COPY (
  SELECT id, geometry, bbox
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/' || getvariable('release_id') || '/theme=places/type=place/*',
    hive_partitioning = true
  )
  WHERE bbox.xmin <= -93.5 AND bbox.xmax >= -106.7
    AND bbox.ymin <= 36.6 AND bbox.ymax >= 25.8
  ORDER BY id
) TO 'owner-local/lp24111/overture-texas-bbox-spatial.geoparquet'
  (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000);

-- Census source CRS is EPSG:4269; Overture geometry is OGC:CRS84.
CREATE OR REPLACE TEMP TABLE texas_counties AS
SELECT GEOID AS county_fips, NAME AS county_name,
       ST_Transform(geom, 'EPSG:4269', 'OGC:CRS84', always_xy := true) AS geometry
FROM ST_Read(getvariable('texas_geometry')) WHERE STATEFP = '48';

COPY (
  SELECT DISTINCT p.id, p.geometry, p.bbox
  FROM read_parquet('owner-local/lp24111/overture-texas-bbox-spatial.geoparquet') p
  JOIN texas_counties c ON ST_Intersects(p.geometry, c.geometry)
  ORDER BY p.id
) TO 'owner-local/lp24111/overture-texas-spatial-authority.geoparquet'
  (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000);

-- Deterministic boundary audit: retain every intersecting assignment; certification
-- distinguishes unique, unassigned, and geometrically explainable multi-county IDs.
COPY (
  WITH authority AS (
    SELECT * FROM read_parquet('owner-local/lp24111/overture-texas-spatial-authority.geoparquet')
  ), assignments AS (
    SELECT p.id, c.county_fips, c.county_name
    FROM authority p JOIN texas_counties c ON ST_Intersects(p.geometry, c.geometry)
  ), per_id AS (
    SELECT id, count(*) assignment_count, string_agg(county_fips, ',' ORDER BY county_fips) county_fips
    FROM assignments GROUP BY id
  )
  SELECT a.id, coalesce(p.assignment_count, 0) assignment_count, p.county_fips,
         CASE WHEN p.assignment_count IS NULL THEN 'UNASSIGNED'
              WHEN p.assignment_count = 1 THEN 'UNIQUE'
              ELSE 'BOUNDARY_MULTI_INTERSECTION' END assignment_class
  FROM authority a LEFT JOIN per_id p USING (id) ORDER BY a.id
) TO 'owner-local/lp24111/county-assignment-certification.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

COPY (
  SELECT c.county_fips, c.county_name, count(DISTINCT p.id) raw_poi_count
  FROM texas_counties c LEFT JOIN read_parquet('owner-local/lp24111/overture-texas-spatial-authority.geoparquet') p
    ON ST_Intersects(p.geometry, c.geometry)
  GROUP BY c.county_fips, c.county_name ORDER BY c.county_fips
) TO 'owner-local/lp24111/overture-texas-county-coverage.csv' (HEADER, DELIMITER ',');

-- Rich fields are fetched by a separate shard program generated from literal,
-- precomputed bounds, then matched locally to this authoritative ID set. Never
-- replace this projection with SELECT * or an authority-ID join against the globe.
