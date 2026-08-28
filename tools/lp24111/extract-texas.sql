-- DuckDB 1.5.5; invoke with RELEASE_ID and TEXAS_GEOMETRY set by extract-texas.ps1.
INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;
SET preserve_insertion_order = false;
COPY (
  WITH texas AS (
    SELECT ST_Union_Agg(geom) AS geom
    FROM ST_Read(getvariable('texas_geometry'))
    WHERE STATEFP = '48'
  ), places AS (
    SELECT * FROM read_parquet(
      's3://overturemaps-us-west-2/release/' || getvariable('release_id') || '/theme=places/type=place/*',
      hive_partitioning = true
    )
  )
  SELECT p.* FROM places p, texas t
  WHERE ST_Intersects(p.geometry, t.geom)
  ORDER BY p.id
) TO 'owner-local/lp24111/overture-texas-places.geoparquet'
  (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000);
