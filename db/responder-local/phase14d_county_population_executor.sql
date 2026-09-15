-- LOCAL CERTIFIED EXECUTOR TEMPLATE
-- NOT A MIGRATION
-- REQUIRES SEPARATE PRODUCTION AUTHORIZATION
--
-- Connection parameters and the absolute payload path must be supplied externally.
-- The safe default is ROLLBACK. Set phase14d_commit_authorized=true only for a
-- separately authorized run after independently verifying the command line.

\set ON_ERROR_STOP on

\if :{?phase14d_payload_path}
\else
  \echo 'PHASE14D_ERROR=phase14d_payload_path must be an absolute forward-slash path'
  \quit 3
\endif

\if :{?phase14d_commit_authorized}
\else
  \set phase14d_commit_authorized false
\endif

-- Safe local rehearsal hooks. Either value can only prevent a commit.
\if :{?phase14d_force_certification_failure}
\else
  \set phase14d_force_certification_failure false
\endif
\if :{?phase14d_force_certification_sql_error}
\else
  \set phase14d_force_certification_sql_error false
\endif

BEGIN;
LOCK TABLE public.gridly_texas_county_boundaries IN SHARE ROW EXCLUSIVE MODE;

DO $phase14d_preflight$
BEGIN
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries) <> 0 THEN
    RAISE EXCEPTION 'phase14d_nonempty_target';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.gridly_texas_county_boundaries'::regclass) THEN
    RAISE EXCEPTION 'phase14d_rls_not_enabled';
  END IF;
  IF (SELECT count(*) FROM pg_policy
      WHERE polrelid = 'public.gridly_texas_county_boundaries'::regclass) <> 0 THEN
    RAISE EXCEPTION 'phase14d_unexpected_policy';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'public.gridly_texas_county_boundaries'::regclass
        AND NOT tgisinternal) <> 0 THEN
    RAISE EXCEPTION 'phase14d_unexpected_trigger';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class x ON x.oid = i.indexrelid
    WHERE i.indrelid = 'public.gridly_texas_county_boundaries'::regclass
      AND x.relname = 'gridly_texas_county_boundaries_geom_idx'
      AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'phase14d_missing_valid_gist_index';
  END IF;
END
$phase14d_preflight$;

SELECT txid_current() AS phase14d_tx_before,
       pg_backend_pid() AS phase14d_pid_before
\gset
SELECT 'PHASE14D_TX_BEFORE=' || :'phase14d_tx_before';
SELECT 'PHASE14D_PID_BEFORE=' || :'phase14d_pid_before';
SELECT 'PHASE14D_LOCK_MODE=' || mode
FROM pg_locks
WHERE pid = pg_backend_pid()
  AND relation = 'public.gridly_texas_county_boundaries'::regclass
  AND mode = 'ShareRowExclusiveLock'
  AND granted;

-- psql expands phase14d_payload_path and streams this file on this same connection.
\i :phase14d_payload_path

SELECT 'PHASE14D_TX_AFTER=' || txid_current();
SELECT 'PHASE14D_PID_AFTER=' || pg_backend_pid();
SELECT 'PHASE14D_IN_TRANSACTION=' ||
       (txid_current() = :'phase14d_tx_before'::bigint
        AND pg_backend_pid() = :'phase14d_pid_before'::integer);
SELECT 'PHASE14D_IN_TX_ROWS=' || count(*)
FROM public.gridly_texas_county_boundaries;
SELECT 'PHASE14D_IN_TX_DIGEST=' || md5(string_agg(
  county_fips || encode(extensions.ST_AsBinary(geom), 'hex') || boundary_version,
  '|' ORDER BY county_fips))
FROM public.gridly_texas_county_boundaries;

-- This hook deliberately raises after a successful include and before any decision.
\if :phase14d_force_certification_sql_error
  SELECT 1 / 0 AS phase14d_forced_certification_sql_error;
\endif

WITH counts AS (
  SELECT count(*) AS rows,
    count(DISTINCT county_fips) AS unique_fips,
    count(*) FILTER (WHERE county_fips IS NULL OR geom IS NULL
      OR boundary_version IS NULL) AS nulls,
    count(*) FILTER (WHERE extensions.ST_SRID(geom) <> 4326) AS wrong_srid,
    count(*) FILTER (WHERE extensions.ST_GeometryType(geom) <> 'ST_MultiPolygon') AS wrong_type,
    count(*) FILTER (WHERE NOT extensions.ST_IsValid(geom)) AS invalid,
    sum(extensions.ST_NPoints(geom)) AS coordinate_pairs,
    min(county_fips) AS minimum_fips,
    max(county_fips) AS maximum_fips,
    bool_and((right(county_fips, 3)::integer % 2) = 1) AS texas_fips_sequence,
    count(DISTINCT boundary_version) AS version_count,
    min(boundary_version) AS boundary_version
  FROM public.gridly_texas_county_boundaries
), liberty AS (
  SELECT geom FROM public.gridly_texas_county_boundaries WHERE county_fips = '48291'
), chambers AS (
  SELECT geom FROM public.gridly_texas_county_boundaries WHERE county_fips = '48071'
), boundary AS (
  SELECT
    extensions.ST_Contains(liberty.geom,
      extensions.ST_PointOnSurface(liberty.geom)) AS liberty_interior,
    extensions.ST_Contains(liberty.geom,
      extensions.ST_PointOnSurface(chambers.geom)) AS chambers_interior_excluded,
    extensions.ST_Touches(liberty.geom, extensions.ST_PointOnSurface(
      extensions.ST_Intersection(extensions.ST_Boundary(liberty.geom),
        extensions.ST_Boundary(chambers.geom)))) AS shared_boundary_touches,
    extensions.ST_Contains(liberty.geom, extensions.ST_PointOnSurface(
      extensions.ST_Intersection(extensions.ST_Boundary(liberty.geom),
        extensions.ST_Boundary(chambers.geom)))) AS shared_boundary_contained
  FROM liberty, chambers
)
SELECT (
  counts.rows = 254
  AND counts.unique_fips = 254
  AND counts.nulls = 0
  AND counts.wrong_srid = 0
  AND counts.wrong_type = 0
  AND counts.invalid = 0
  AND counts.coordinate_pairs = 604979
  AND counts.minimum_fips = '48001'
  AND counts.maximum_fips = '48507'
  AND counts.texas_fips_sequence
  AND counts.version_count = 1
  AND counts.boundary_version = 'lp148-owner-built-statewide-runtime-geometry-v1'
  AND boundary.liberty_interior
  AND NOT boundary.chambers_interior_excluded
  AND boundary.shared_boundary_touches
  AND NOT boundary.shared_boundary_contained
  AND NOT :phase14d_force_certification_failure::boolean
) AS phase14d_certified
FROM counts, boundary
\gset

\if :phase14d_certified
  SELECT 'PHASE14D_CERTIFICATION=PASS';
  \if :phase14d_commit_authorized
    COMMIT;
    SELECT 'PHASE14D_DECISION=COMMIT';
  \else
    ROLLBACK;
    SELECT 'PHASE14D_DECISION=ROLLBACK_SAFE_DEFAULT';
  \endif
\else
  ROLLBACK;
  SELECT 'PHASE14D_CERTIFICATION=FAIL';
  SELECT 'PHASE14D_DECISION=ROLLBACK_CERTIFICATION_FAILURE';
\endif
