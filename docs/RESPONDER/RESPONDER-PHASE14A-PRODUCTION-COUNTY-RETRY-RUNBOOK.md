# Phase 14 retry runbook — proposed future production procedure

**This runbook is not authorization to connect or write.** Phase 14A is local only. A later owner must separately approve the exact transaction-neutral payload hash, execution identity, recovery checkpoint, window, and independent reviewer. Never execute the Phase 13 rehearsal SQL in this retry: it owns `COMMIT`. The [Phase 14A payload](../../db/responder-local/phase14a_county_population_payload.sql) contains only 254 data inserts; the **executor owns `BEGIN`, validation, `COMMIT`, and `ROLLBACK`**. No responder schema, publishing, consumer binding, migration, or deployment is included.

## A — owner authorization

Name one production database, `public.gridly_texas_county_boundaries` as the sole mutation target, the owner/admin server-side operator, independent reviewer, maintenance window, stop authority, and recovery owner. Approve frozen source SHA-256 `6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49` and new payload SHA-256 `464565b291946ff12e948d683e402c83caa39e2737748996f669fa2327a25a9e`. Approval to populate counties does not approve responder activation. **STOP** if any scope or identity is ambiguous.

## B — artifact verification

Verify the frozen Git source, 254 counties, 604,979 coordinate pairs, canonical FIPS digest `7e80dd17d4d295d904f986a193ab259850e607c6bdfde3a7454e9af5a54a2092`, and payload size 13,965,052 bytes/hash above. Confirm the file is outside migration history, has exactly 254 inserts into only the target table, and has no transaction, DDL, update, delete, upsert, privilege or configuration statement. Verify no local drift from the Phase 14A certification. **STOP** on any mismatch; do not edit the approved file ad hoc.

## C — production read-only preflight

Use an explicit `BEGIN TRANSACTION READ ONLY` and verify `transaction_read_only=on`, target identity, PostgreSQL/PostGIS versions, table count **exactly zero**, FIPS PK/check, required `geometry(MultiPolygon,4326)` and version columns, valid named GiST index, RLS/ACL/policy/trigger state, 14-migration baseline or a separately reconciled harmless change, reporting and publishing controls, and absence of responder authority dependency. Record bounded baseline counts/digests for unrelated application and control tables without reading sensitive rows. `ROLLBACK` the read-only transaction. **STOP** on a nonzero county count, unreviewed catalog change, unknown dependency, or changed control.

## D — recovery checkpoint acceptance

Complete the [recovery evidence template](../../reports/responder/responder-phase14a-recovery-checkpoint-template.json) with a real recent backup/PITR point, exact timestamp preceding the planned write, database/table coverage, backup health, known restore mechanism and runbook, named recovery operator, prepopulation restore confidence, and explicit owner acceptance. Confirm restoration impact on unrelated production data. No blank, stale, degraded, or unaccepted field may be treated as a pass. **STOP** if evidence is insufficient. Do not change backup configuration in this operation.

## E — external `BEGIN`

Use one dedicated, persistent owner/admin database connection with reviewed timeouts and stop-on-error handling. Confirm target database and identity, then issue `BEGIN`. The payload must execute later on this **same connection and transaction**. A script/driver must preserve the connection until the final decision; do not let a file runner auto-commit or reconnect between steps. No second write transaction is authorized.

## F — bounded lock

Acquire `LOCK TABLE public.gridly_texas_county_boundaries IN SHARE ROW EXCLUSIVE MODE` inside the open transaction. This serializes competing writes to the one target while allowing ordinary reads. **ROLLBACK and STOP** if the approved lock timeout or maintenance guard fails.

## G — locked zero-row recheck

After the lock, repeat the exact zero-row count and material table shape, PK/check, geometry typmod, GiST validity, RLS, triggers, ACL, migration/control preconditions. **ROLLBACK and STOP** if any value differs. Do not reconcile, truncate, delete, overwrite, or alter the table.

## H — execute the transaction-neutral payload

Execute the exact hash-verified Phase 14A payload once on the existing connection (for example, a reviewed `psql` session may use `\i` without ending the transaction). It performs only the 254 county inserts; it contains no `BEGIN` or `COMMIT`. On any SQL error, issue `ROLLBACK` and stop. Do not use the Phase 13 rehearsal artifact, a production migration, browser client, public RPC, or service key in a client.

## I — in-transaction certification

While the same transaction remains open, require **all** of the following before a commit decision:

1. Exactly 254 rows and 254 unique county FIPS; ordered FIPS exactly equal the frozen manifest, with no extra, missing, duplicate, or null FIPS.
2. No null geometry; every row is valid `ST_MultiPolygon` in SRID 4326; summed `ST_NPoints` is 604,979; `boundary_version` is the approved package version; statewide bounds and per-county geometry evidence match the certified source meaning.
3. Record an ordered digest of FIPS, `ST_AsBinary(geom)`, and version from **inside** the transaction. Treat it as an observed production digest to compare with a fresh postcommit read; do not assume local PostGIS 3.6.2 bytes equal production 3.3.7 bytes.
4. Strict `ST_Contains` accepts Liberty interior, rejects its exact/shared Chambers boundary and neighboring interior; `ST_Touches` confirms shared boundary. No `ST_Covers`, buffer, or nearest-county substitution.
5. The named GiST index remains valid. Migration history, reporting/publishing/prelaunch controls, and bounded unrelated-table snapshots remain unchanged from the preflight. Review possible concurrent unrelated activity before claiming attribution.

**ROLLBACK and STOP** if any check fails or cannot be completed on the open connection. No repair is authorized within this phase.

## J — commit-or-rollback decision

Report the 254/254 counts, geometry checks, exact FIPS digest, strict boundary result, ordered in-transaction geometry digest, and unchanged-scope evidence to the approved reviewer **before** deciding. If every condition passes and authorization remains valid, issue one `COMMIT`. Otherwise issue `ROLLBACK`, verify the zero-row pre-state in a fresh read-only query, and report an aborted attempt. The payload itself must never make this decision.

## K — fresh postcommit read-only certification

After commit, start a **new** `BEGIN TRANSACTION READ ONLY`, verify read-only state, and repeat the row/FIPS, null/type/SRID/validity/point count, version, bounds, GiST, strict boundary, migration/control and unrelated-scope checks. Require the fresh ordered table digest to equal the recorded in-transaction digest, and retain 254 FIPS-keyed source-equivalence evidence. `ROLLBACK` the read-only session. If certification fails after commit, do not issue an automatic DELETE; keep responder use disabled and invoke the separately approved recovery/forward-fix process.

## L — B03 / P12-01 decision

P12-01 can close only after successful production commit and 254/254 postcommit certification. B03 can close only when production equivalence, strict boundary semantics, and approved immutable source/version binding are all proven. Otherwise mark B03 partial or open without claiming runtime readiness. No responder organization, authority, projection, dashboard, publishing, pilot, consumer exposure, Cron, or migration may be activated under this county-only authorization.

The Phase 13 dataset and disposable rehearsal remain valid historical evidence. Phase 14 exposed a transaction-boundary issue before any production write; this repaired procedure separates certified data from the operator-controlled transaction. Actual production backup health and production PostGIS 3.3.7 behavior remain future acceptance gates, not findings of Phase 14A.
