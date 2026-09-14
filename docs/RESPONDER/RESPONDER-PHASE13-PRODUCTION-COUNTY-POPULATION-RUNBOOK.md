# Guarded production county population runbook — future separate authorization only

This document is a proposed procedure, not approval to connect, write, deploy, or activate responder authority. The Phase 13 SQL at `db/responder-local/phase13_county_population_rehearsal.sql` is explicitly a **local rehearsal artifact, not a production migration**. Its production use requires a separate owner decision approving the exact reviewed bytes, an execution identity, a window, and a recovery plan. Reconcile all Phase 12 observations against current production before taking action; do not assume the empty-table snapshot remains current.

## Phase A — authorization

Obtain written owner authorization naming the exact source SHA-256 `6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49`, the generated SQL SHA-256 `9e17bb6a0f08580aabcc4943ab9b3bdda6f41e7205a78a7dab8d696a8037815e`, target table, operator identity, maintenance window, backup checkpoint, and stop/rollback owner. Confirm separate authority for any later runtime binding, deployment, or publishing; population approval alone grants none. **STOP** if any element or artifact hash differs.

## Phase B — read-only preflight

In an owner-controlled read-only transaction, record PostgreSQL and PostGIS versions and current catalog snapshots. Confirm `public.gridly_texas_county_boundaries` still belongs to `postgres`, has only required `county_fips text` PK/check, `geom geometry(MultiPolygon,4326)`, and `boundary_version text` columns with no defaults, and has the valid named GiST index. Confirm RLS enabled, no FORCE RLS, zero policies and triggers, no new INSERT/SELECT grants to `PUBLIC`, `anon`, or `authenticated`, and no unreviewed privilege change. Confirm table count **exactly zero**. Reconcile deployed migration list with tracked inventory and review any intervening migration. Confirm no responder authority currently depends on the table and assess whether consumer runtime reads it. Confirm reporting and agency publishing controls remain in the approved state; the Phase 12 snapshot recorded `reporting_enabled=false` and Phase 8 local state ended `agency_publishing_enabled=false`, neither is a substitute for a live preflight. **STOP** on any mismatch, nonzero rows, unknown dependency, or control change.

## Phase C — backup/recovery checkpoint confirmation

Record the accepted, restorable production checkpoint and tested recovery owner before the first write. Confirm recovery point timing and the restoration impact on other production data. Record monitoring and a controlled execution window. **STOP** if the checkpoint is missing, stale, or unaccepted.

## Phase D — begin transaction

Use a dedicated owner/admin server-side connection. Confirm `current_user`, target database, target host, and transaction read/write state. Set an approved statement and lock timeout in the session, then execute the reviewed one-transaction payload exactly once with stop-on-error enabled. The payload itself begins a transaction and takes `SHARE ROW EXCLUSIVE` on only the county table. Do not add a public function, browser key, service-role client call, permanent EXECUTE grant, or production migration in this phase. **STOP** if identity or database differs or lock cannot be obtained within the approved window.

## Phase E — safety recheck

Inside the same transaction and after the table lock, the payload verifies target shape, RLS, index and trigger conditions and chooses `load` only for zero existing rows. A byte-and-geometry-identical 254-row target produces a no-op; other nonempty states fail. The separately approved production procedure must reconcile the immediate read-only preflight of owner, grants, migration inventory, and controls with this locked check; any change since preflight requires rollback. **STOP** on any failed condition. Never overwrite or merge drift.

## Phase F — populate 254 counties

The payload stages 254 FIPS-sorted geometries from the frozen source, converting Polygon to one-member MultiPolygon and setting SRID 4326. It inserts in two bounded batches within one transaction. No source is downloaded. No target other than `public.gridly_texas_county_boundaries` receives a permanent write. **STOP** on parser, constraint, validity, privilege, or timeout error; roll back the transaction.

## Phase G — in-transaction validation

Before commit require 254 rows and 254 exact approved FIPS, zero null geometries, `ST_MultiPolygon` and SRID 4326 throughout, all `ST_IsValid`, expected 604,979 points, exact `boundary_version`, and FIPS-keyed equivalence to the staged canonical source. The payload emits an ordered in-transaction table digest after those assertions and before commit; retain it for the postcommit comparison. Record bounds, index validity, and strict Liberty/Chambers interior/shared-boundary assertions using `ST_Contains` and `ST_Touches`; use the named GiST index plan as supporting evidence. **STOP and roll back** on any discrepancy or missing evidence. Do not replace strict containment with `ST_Covers`, a buffer, or nearest-county lookup.

## Phase H — commit decision

The owner and independent reviewer approve the exact artifact and automatic commit criteria before invocation. The artifact commits only after every embedded in-transaction assertion passes; otherwise the command fails and the transaction rolls back. A future operator who requires a manual hold point must separately review a split-commit wrapper before production use; do not edit the certified SQL ad hoc. The existing artifact's commit is a preauthorized conditional decision, not a pause for human review. Until commit, rollback returns the table to its prior zero rows with no partial inventory.

## Phase I — postcommit read-only certification

In a fresh read-only transaction, independently repeat row count, exact FIPS set, unique key, null/type/SRID/validity/point count, bounds, source equivalence, version, index, and strict boundary tests. Require the ordered table digest to equal the in-transaction digest emitted by the payload. Record production PostgreSQL/PostGIS versions, both digests, exact source/artifact hashes, operator, time, and immutable evidence location. A successful commit without this check is **not certified**. **STOP** any authority or consumer binding if any result differs. Do not assume local PostGIS 3.6.2 proves deployed 3.3.7 behavior.

## Phase J — B03/P12-01 status decision

Close P12-01 only after production population and 254/254 postload certification. Close B03 only after production geometry equivalence, strict boundary semantics, and approved immutable source/version-to-authority binding. Both remain open after Phase 13. Any responder authority, publishing gate, dashboard exposure, or consumer integration requires its own authorization and checks.

## Failure and rollback boundary

Before commit, abort the connection or issue `ROLLBACK`; verify the original row count and unchanged indexes. After commit, **do not run an automatic DELETE**. First establish whether any dependent use occurred. A separately authorized restore to the checkpoint may be considered only when safe for all other production data and when no dependent use exists. If geometry has entered authority decisions, retain evidence/history and plan an approved forward correction. Record the incident and keep B03/P12-01 open until independently recertified.

## Read-only query set for the future operator

The following queries are a specification for a **later authorized connection**, not an instruction to run them in Phase 13. Execute with `ON_ERROR_STOP=1`, record complete results, and compare them against the Phase 12 snapshot and the frozen manifest. Querying the catalog does not replace separate review of migration inventory, backup, runtime dependencies, controls, and grants.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT current_user, current_database(), current_setting('server_version') AS postgres_version,
       (SELECT extversion FROM pg_extension WHERE extname='postgis') AS postgis_version;
SELECT count(*) AS county_rows, count(DISTINCT county_fips) AS unique_fips
  FROM public.gridly_texas_county_boundaries;
SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
       (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS user_triggers
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='gridly_texas_county_boundaries';
SELECT a.attname, format_type(a.atttypid,a.atttypmod) AS type,
       a.attnotnull, pg_get_expr(d.adbin,d.adrelid) AS default_value
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.gridly_texas_county_boundaries'::regclass
   AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint WHERE conrelid='public.gridly_texas_county_boundaries'::regclass
 ORDER BY conname;
SELECT x.relname AS index_name, i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition
  FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid
 WHERE i.indrelid='public.gridly_texas_county_boundaries'::regclass
 ORDER BY x.relname;
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='gridly_texas_county_boundaries'
 ORDER BY grantee, privilege_type;
SELECT relacl FROM pg_class
 WHERE oid='public.gridly_texas_county_boundaries'::regclass;
ROLLBACK;
```

The first preflight must return zero rows. The later independent postload query must return 254 rows, 254 unique FIPS, zero failures in each geometry column, and the approved version. Compare the ordered FIPS string to `canonicalFipsInventory` in the frozen manifest **outside the database**, then record the database digest and exact manifest/artifact hashes in immutable evidence.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT count(*) AS rows, count(DISTINCT county_fips) AS unique_fips,
       count(*) FILTER (WHERE county_fips IS NULL) AS null_fips,
       count(*) FILTER (WHERE geom IS NULL) AS null_geom,
       count(*) FILTER (WHERE extensions.ST_GeometryType(geom)<>'ST_MultiPolygon') AS wrong_type,
       count(*) FILTER (WHERE extensions.ST_SRID(geom)<>4326) AS wrong_srid,
       count(*) FILTER (WHERE NOT extensions.ST_IsValid(geom)) AS invalid_geom,
       sum(extensions.ST_NPoints(geom)) AS coordinate_pairs,
       extensions.ST_Extent(geom) AS statewide_bounds
  FROM public.gridly_texas_county_boundaries;
SELECT string_agg(county_fips,',' ORDER BY county_fips) AS ordered_fips,
       count(DISTINCT boundary_version) AS versions,
       min(boundary_version) AS version
  FROM public.gridly_texas_county_boundaries;
SELECT md5(string_agg(county_fips || encode(extensions.ST_AsBinary(geom),'hex') ||
       boundary_version, '|' ORDER BY county_fips)) AS ordered_table_digest
  FROM public.gridly_texas_county_boundaries;
ROLLBACK;
```

Re-run the Phase 13 strict Liberty/Chambers query and named GiST plan check with the approved production PostGIS schema. The digest is evidence of the observed production bytes; 254 FIPS-keyed equivalence to the certified source remains a separate required comparison. No responder authority binding is permitted before that independent comparison is complete.
