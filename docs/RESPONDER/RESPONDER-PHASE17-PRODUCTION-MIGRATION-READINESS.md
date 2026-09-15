# Responder V1 Phase 17 — Production Migration Readiness

Recorded: 2026-09-15

Source: Phase 16 commit `df98157a9e5e77065077ae657fa3062017c88ea0`

Decision: **CONDITIONAL GO**

Deployment authorization: **NOT AUTHORIZED**

## 1. Executive decision

The Phase 16 design has been converted into a deterministic, fail-closed package with a read-only production preflight, one write transaction, in-transaction post-DDL assertions, independent read-only postflight, and empty-data-only rollback. It compiles and rehearses on disposable PostgreSQL 17.10/PostGIS 3.6.2. Same-day committed production evidence establishes PostgreSQL 17.6, PostGIS 3.3.7, the required managed Auth shapes, owner-`postgres` Auth reads, and 254 certified county rows.

The result is **CONDITIONAL GO**, not deployment approval. Before deployment, the owner must provide an exact-version, production-shaped non-production clone rehearsal, run the fresh production preflight with the intended migration principal, create a fresh recovery checkpoint, generate the real migration with the then-current Supabase CLI, reconcile migration history, and approve the exact SHA. `responder_public` also requires a separately controlled Data API exposed-schema change before pilot use. Security and Performance Advisors cannot be truthfully certified before deployment.

Nothing was deployed or written to production in Phase 17.

## 2. Production compatibility findings

| Question | Result |
| --- | --- |
| A. PostgreSQL 17.6/PostGIS 3.3.7 compile | SQL uses features supported by those versions; same design compiled on 17.10/3.6.2. Exact-version clone execution remains a mandatory condition. |
| B. Extensions | Only `postgis` and `pgcrypto`, both observed in production under `extensions`. No extension is created by the migration. |
| C. Managed Auth objects/types | Compatible with same-day production catalog and Phase 15A behavior. Fresh preflight verifies exact columns, nullability, enums, PK/FK shapes, helper functions, and owner read privilege. |
| D. Role/grant assumptions | Future executor is `postgres`. Current Supabase documentation and production evidence support the model; fresh preflight requires `postgres`, `anon`, `authenticated`, `service_role`, exact BYPASSRLS posture, database CREATE, and Auth SELECT. |
| E. Data API exposure | Yes. `responder_public` must be added to exposed schemas before pilot API use. |
| F. Non-SQL configuration | Data API exposure, Auth/MFA operational settings, fresh backup/PITR confirmation, and advisor review. None is changed here. |
| G. Conflicts | Same-day evidence showed both responder schemas absent. Standalone and embedded preflight reject either schema, partial objects, or a stale responder migration marker. |
| H. Transactional safety | Yes. Schema/type/table/function/trigger/index/policy/grant/comment DDL used here is transactional. |
| I. Outside transaction | Data API configuration, recovery checkpoint, CLI migration-file generation/history orchestration, and Advisors. No package DDL must be split. |
| J. Partial usability | A precondition or post-DDL assertion aborts the transaction. No responder surface commits on error. |
| K. Publishing disabled | Yes. No organization is seeded and the table default is false; assertions require zero rows. |
| L. Empty object safety | Yes. There are no memberships, users, grants, organizations, updates, or projection rows. |
| M. Empty rollback | Yes, rehearsed. Rollback refuses after any responder evidence exists. |
| N. Irreversible after real data | Private organizations, principals, memberships, authority, revisions, approvals, receipts, events and public projection become evidence-bearing. Removal then requires preservation/export and forward recovery, not schema drop. |
| O. Production preflight | Section 8 and the preflight SQL define the exact gate. |
| P. Production postflight | Section 10 and the postflight SQL define the exact certification. |

## 3. Production catalog findings

Committed production reads on 2026-09-15 showed database `postgres`, executor `postgres`, PostgreSQL 17.6, PostGIS 3.3.7, `postgis` and `pgcrypto` in `extensions`, absent `agency_private`/`responder_public`, and an exact 254-row valid EPSG:4326 MultiPolygon county authority. Community schemas and `report_retention.admission_state` remained present with `reporting_enabled=false`.

Phase 17 performed no new production read because this process had no production database credentials. That absence is why the fresh preflight is a blocking owner gate rather than a claimed pass.

## 4. Auth compatibility

The live predicate uses `auth.uid()`, `auth.jwt()`, `auth.sessions(id,user_id,aal,factor_id)`, `auth.mfa_factors(id,user_id,factor_type,status)`, and `auth.mfa_amr_claims(session_id,authentication_method)`. Production evidence established UUID keys, nullable `sessions.aal`/`factor_id`, `auth.aal_level`, `auth.factor_type`, `auth.factor_status`, and cascade relationships. Phase 15A proved the same-user session/TOTP factor/AMR behavior and immediate fail-closed response to logout or factor removal.

No JWT metadata supplies organization, role, county, gate, or admin authority. Managed Auth tables are read only from a private `SECURITY DEFINER` helper owned by the migration principal. No Auth data is inserted, updated, or deleted.

## 5. Role and grant compatibility

The future migration principal is exactly `postgres`, the principal used by Supabase Dashboard SQL and normal linked migration execution. It creates and owns the responder objects. The migration requires database `CREATE`, Auth-table `SELECT`, and `postgres.rolbypassrls=true`; it does not require true superuser.

All 13 private tables and the public projection enable and force RLS. Private tables have no direct mutation grants. `PUBLIC`, `anon`, and `service_role` cannot use `agency_private`; authenticated receives schema usage only to satisfy stored policy/function call chains. Private definers have `search_path=''`, qualified relations, and no `PUBLIC`/`service_role` execute. `anon` may execute only `_public_update_eligible(uuid)` as an RLS dependency, but cannot resolve it through the Data API because the private schema is not exposed and has no schema usage. Authenticated execute on private functions is limited to the two context functions, three command implementations, and projection eligibility; the Data API surface is the three `SECURITY INVOKER` wrappers.

## 6. Data API configuration requirement

The tracked configuration currently exposes only `public` and `graphql_public`. `responder_public` must be separately added to Supabase Data API exposed schemas before an authorized pilot can call the wrappers or read the projection. The SQL migration may safely commit before that configuration change; doing so leaves the surface unreachable through PostgREST. `agency_private` must never be added to exposed schemas.

The May 2026 Supabase default-grant change makes explicit grants mandatory. The package explicitly grants only schema usage, projection SELECT, and wrapper EXECUTE needed by `anon`/`authenticated`; it does not rely on automatic exposure or automatic grants.

## 7. Transaction design

`phase17_production_migration.sql` runs one explicit transaction:

1. short lock timeout, bounded statement timeout, empty search path, UTC;
2. identity, role, version, extension, Auth, county, community gate, collision, and migration-marker assertions;
3. deterministic responder DDL copied from the accepted Phase 16 candidate;
4. explicit revokes/grants, RLS/FORCE RLS, policies and wrappers;
5. exact object, security, grant, projection and zero-activation assertions;
6. commit.

No concurrent index, extension installation, network call, project configuration, seed, or non-transactional statement exists. Any SQL error aborts the transaction.

## 8. Preflight

The standalone preflight is `REPEATABLE READ READ ONLY`, uses 30-second statement and 5-second lock timeouts, and always rolls back. It fails on:

- wrong executor/version/project identity or missing role/privilege;
- either responder schema, contained candidate object, stale responder migration marker, or missing migration history;
- missing/changed Auth columns, nullability, enum values, PK/FK relations, helpers, or owner reads;
- missing/misplaced `postgis`/`pgcrypto` or required routines;
- missing/invalid/non-unique/non-254 county authority;
- missing community/history/retention controls or enabled reporting.

Its single JSON result records the read-only state, versions, identity, responder absence, gate, county count, and six immediate bounded baseline counts for postflight.

## 9. Migration package

The package consists of:

- `db/responder-local/phase17_production_preflight.sql`
- `db/responder-local/phase17_production_migration.sql`
- `db/responder-local/phase17_production_postflight.sql`
- `db/responder-local/phase17_production_rollback.sql`

Expected committed inventory: 2 schemas, 10 private enums, 13 private tables, 1 public projection table, 11 private functions, 3 public invoker wrappers, 14 policies, 17 explicit performance indexes, and 6 append-only triggers. The manifest contains exact names and SHA-256 values.

## 10. Postflight

Postflight is independent, repeatable-read, read-only, and requires the six bounded counts emitted immediately before deployment. It certifies exact schemas/tables/functions/policies/indexes/triggers; RLS/FORCE RLS; schema/table/function grants; empty search paths; wrapper invoker status; the exact 18-column projection; live Auth references; zero responder rows; disabled reporting; unchanged 254-county authority; and unchanged bounded community/history/retention counts.

Postflight does not turn on Data API exposure, create users, or activate publishing.

## 11. Rollback

Rollback is a single transaction and drops only `responder_public` then `agency_private`. Before any drop it counts every private table and the public projection. Any row causes a hard stop with preservation/export and forward-recovery guidance. After the drops it asserts Auth, county, community, history, retention, and disabled reporting are intact before commit.

An empty install was applied, postflighted, rolled back, and certified locally. A separate seeded-evidence case proved rollback refusal preserves the schemas and row.

## 12. Recovery checkpoint requirement

The Phase 14E scheduled physical backup at `2026-09-14T04:46:09Z` protected the county population operation; it is neither fresh enough nor scoped as the approval checkpoint for this later schema deployment. A fresh verified production recovery checkpoint (and, where available, confirmed PITR coverage) is required immediately before the eventual migration. Record backup timestamp, project ref, recovery operator, retention window, and restore path. Do not deploy if backup health or restore authority is uncertain.

## 13. Advisor requirements

Security Advisor and Performance Advisor were not run against a deployed responder schema and are not claimed as passed. Run both on the production-shaped staging clone before owner approval and on production immediately after postflight. Any security error, exposed private object, missing RLS, mutable search path, or material performance warning is a stop condition; use a forward corrective migration or empty-data rollback as appropriate.

## 14. Migration history strategy

The local Supabase CLI is not installed, so no migration file was fabricated in `supabase/migrations`. With the current CLI at deployment-preparation time:

1. run `supabase --version` and all relevant `--help` commands;
2. run `supabase migration new prepare_responder_production_schema`;
3. copy the package SQL byte-for-byte into the generated timestamped file;
4. verify its SHA-256 equals the approved manifest migration SHA;
5. run `supabase migration list --local` and against the linked project;
6. rehearse the generated migration on the production-shaped clone;
7. use `supabase db push --dry-run`; require exactly that one pending migration;
8. after explicit owner approval, one operator may run `supabase db push` once.

Never use `migration repair`, manual Dashboard DDL, `--include-seed`, or a second deployment path for this install. After success, prove the remote migration timestamp exists exactly once and the committed file hash matches the approved package.

## 15. Deployment operator sequence

The exact future sequence is in `RESPONDER-PHASE17-PRODUCTION-MIGRATION-RUNBOOK.md`. It separates read-only preflight, human approval, one migration transaction, and read-only postflight. Data API exposure remains a separately approved configuration action after SQL postflight and before pilot testing.

## 16. Performance and privilege-escalation review

The local planner selected `organization_memberships_org_status_role_idx` for live membership lookup and `activation_rate_events_rolling_idx` for the rolling quota when sequential scans were disabled for the intentionally empty fixture. Composite/partial indexes cover membership, current county authority, current update/revision, approval uniqueness, event lineage, rolling rate, receipts, governance, invites, expiry, and geometry. Managed Auth lookups use existing primary/unique keys (`sessions.id`, `mfa_factors.id`, session/method AMR). No speculative index was added.

Every private definer is owned by the future `postgres` executor, uses `search_path=''`, schema-qualified relations, typed parameters, and an explicit grant allowlist. Command actors come only from live Auth; organization and county authority are re-derived; JSON envelope and payload keys are allowlisted; dynamic SQL is limited to fixed internal table identifiers during installation; no caller-supplied SQL identifier is executed. The wrappers are invokers and accept only a bounded JSON request. Phase 16's 38 security vectors remain the behavioral basis and are rerun as regression.

## 17. Remaining blockers

- Fresh read-only production preflight has not yet run for the eventual deployment window.
- Exact PostgreSQL 17.6/PostGIS 3.3.7 production-shaped clone rehearsal is not yet captured.
- The current Supabase CLI is absent; generated migration filename/history/dry-run evidence does not yet exist.
- Fresh backup/PITR checkpoint and restore authority are not yet captured.
- Staging and production Security/Performance Advisors are not yet run.
- `responder_public` Data API exposure is not yet approved or configured.
- No explicit owner deployment authorization exists.

## 18. Explicit non-deployment statement

Phase 17 performed no production CREATE, ALTER, DROP, GRANT, REVOKE, Auth mutation, data mutation, Data API configuration change, migration-history change, deployment, push, or merge. Agency publishing and community reporting were not enabled. The original LP244.26 worktree was not touched.
