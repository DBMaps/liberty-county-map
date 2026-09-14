# Responder Phase 12: production schema inventory

This is an authorized **read-only** inventory of the existing Gridly Platform production PostgreSQL database, taken from branch `RESPONDER-PHASE12-production-schema-inventory` at `3952342e7334b56b09495d341b0fef15d9bcfa30`. The branch was clean before inspection. The [Phase 9 B02 gate](RESPONDER-PHASE9-PRODUCTION-READINESS-AUDIT.md), [Phase 10 county decision](RESPONDER-PHASE10-COUNTY-SOURCE-DECISION-AUDIT.md), and [Phase 11 Auth mapping](RESPONDER-PHASE11-AUTH-MFA-PRODUCTION-MAPPING-AUDIT.md) set the comparison baseline. The complete catalog-level evidence is in the [inventory JSON](../../reports/responder/responder-phase12-production-schema-inventory.json); proposed object-family comparisons are in the [collision matrix](../../reports/responder/responder-phase12-collision-matrix.json).

## Connection and evidence boundary

The existing production connector identified Gridly Platform. Every successful inventory SQL call began `BEGIN TRANSACTION READ ONLY`, read catalog metadata or bounded aggregate counts with `SELECT`, and ended with `ROLLBACK`. `SHOW transaction_read_only` returned **on**. Server identity: PostgreSQL **17.6**, database `postgres`, `current_user=postgres`, `session_user=postgres`, `current_schema=public`, timezone **UTC**; installed PostGIS is **3.3.7**. No connection URI, password, API key, JWT, user row, email, factor, token, or Vault value was retrieved or recorded. Two preliminary catalog expressions failed harmlessly inside read-only transactions; they produced no inventory result or write.

The inventory includes catalog snapshots and exact counts only where useful. PostgreSQL `reltuples=-1` means no usable estimate, **not** an empty table. The exact counts below are labelled as such. A catalog inventory cannot attest to production Data API settings that the catalog did not expose, application function behavior, or concurrent activity by other actors. No mutation statement was issued in this phase.

## Schemas, relations, and data size

Twelve non-system schemas were visible, with **72** relations/sequences and the following catalog counts. Type notation is `r` ordinary table, `p` partitioned table, `v` view, and `S` sequence. Owners and every object name/type/RLS state are recorded in the JSON.

| Schema | Owner | Objects by type | Functions | Responder relevance |
| --- | --- | --- | ---: | --- |
| `auth` | `supabase_admin` | 23r + 1S | 4 | Auth users and built-in helpers exist; no user contents inspected. |
| `extensions` | `postgres` | 1r + 4v | 799 | Extension-owned support objects, not responder tables. |
| `graphql` | `supabase_admin` | none | 0 | No responder collision. |
| `graphql_public` | `supabase_admin` | none | 1 | API-related schema; deployed exposure setting unverified. |
| `gridly_control` | `postgres` | 2r | 2 | Existing prelaunch reset governance, separate from responder governance. |
| `history_capture` | `postgres` | 3r | 0 | Community history and writer monitoring; separate evidence domain. |
| `public` | `pg_database_owner` | 7r + 1p | 6 | Community reports, feedback, geocoding, county boundary table. |
| `realtime` | `supabase_admin` | 9r + 1p + 1S | 15 | Platform-managed; `public.reports` is in a publication. |
| `report_retention` | `postgres` | 6r + 1v + 1S | 6 | Community admission, receipts, replay, cleanup; not agency storage. |
| `storage` | `supabase_admin` | 8r | 17 | Platform-managed; no responder storage proposed. |
| `supabase_migrations` | `postgres` | 1r | 0 | Migration history. |
| `vault` | `supabase_admin` | 1r + 1v | 5 | Presence only; no secret contents inspected. |

`agency_private` and `responder_public` are **absent**. No deployed `agency_*`, `responder_*`, organization membership, authority, governance receipt, or responder publishing-control object was found. Existing relevant application objects include `public.reports`, `public.gridly_feedback`, `public.gridly_geocode_cache`, `public.gridly_geocode_provider_state`, `public.gridly_texas_address_points` and its default partition, `public.gridly_texas_county_boundaries`, `public.gridly_verified_rural_addresses`, `history_capture.*`, `report_retention.*`, and `gridly_control.*`. The inventory JSON lists each of them with owner, primary-key presence, row estimate or exact count, and RLS/FORCE RLS. No application materialized view was found.

Exact bounded counts: `public.reports=0`, `public.gridly_feedback=7`, `public.gridly_geocode_cache=489`, provider-state rows `=2`, county boundaries `=0`, default address partition `=0`, verified rural addresses `=0`, historical events `=0`, writer monitoring events `=0`, community receipts `=0`, replay evidence `=0`, device links `=0`, condition-month counts `=0`, retention runs `=1`, and admission-state singleton `=1`. The partitioned address parent was not scanned for an exact count; unknown estimates remain `UNKNOWN`. These counts classify migration impact only and contain no records.

## Columns, constraints, indexes, functions, triggers

The captured application metadata comprises **182 columns**, **72 constraints**, **36 indexes**, **15 functions** (including the `graphql_public` entry), **7 RLS policies**, and **9 non-internal triggers**. The JSON records every relevant column's type, default, nullability, generated/identity status, plus constraint definitions, index definitions, function signatures/owners/security settings, policies, and triggers.

Existing names overlap responder vocabulary only in meaning: `status` appears in feedback, geocode and run/control tables; `county_fips` appears in address and boundary tables; `token_digest` is the community replay key; `expires_at` appears in reports/geocode cache; and `reporting_enabled` is the community admission gate. The captured application columns have **no** `organization_id`, `user_id`, `role`, `authority_version`, `source_family`, `revision`, `operation_token`, `payload_digest`, `activated_at`, or `agency_publishing_enabled`. The county geometry column is `geom`, not `geometry`. Production design must not equate similarly named status, digest, expiry, or gate fields with responder semantics.

There are three captured application foreign keys: `report_retention.device_links.report_id` and `report_retention.observation_receipts.report_id` both cascade on deletion of a community report; `observation_receipts.token_digest` references community replay evidence without cascade. Reusing either receipt/history domain for immutable agency evidence would risk destructive community semantics. No application FK to `auth.users` exists. Existing indexes include county FIPS PK and geometry GiST, address FIPS/hash lookup, report crossing/expiry/cleanup time, community replay digest, and history time/idempotency. They do **not** provide future organization/user/revision/agency-rate indexes; those belong to a separately authorized migration design.

Installed extensions: `postgis 3.3.7`, `pgcrypto 1.3`, `uuid-ossp 1.1`, `pg_stat_statements 1.11`, `supabase_vault 0.3.1`, and `plpgsql 1.0`. `pg_cron` and a `cron.job` object were absent. The local disposable responder suites used PostGIS 3.6.2, so production translation needs version-specific geometry regression testing. No extension was changed.

Eight captured application functions are `SECURITY DEFINER`: three public community submit/mutate/cancel RPCs (EXECUTE for `anon` and `authenticated`, fixed `pg_catalog` search path), three public geocode helpers (service-role EXECUTE, `search_path=public`), and private `report_retention.guard_report`/`run_cleanup` (not executable by ordinary API roles). The public reporting functions are expected existing API surfaces but require their own security review; the geocode helpers' public search path warrants a later ownership/search-path review, without an unsafe conclusion from metadata alone. No function body was executed. The 9 triggers protect prelaunch controls, close historical writer paths, guard report origin, and preserve immutable community receipts/replay evidence. New responder trigger and function names must stay separate.

## RLS, grants, Auth, and exposure

All captured application tables have RLS enabled; **none has FORCE RLS**. `report_retention.health` is a view. There are 5 policies on `public.reports`, 1 anonymous-insert policy on `public.gridly_feedback`, and 1 historical-events policy. The JSON preserves each policy's command, roles, `USING`, and `WITH CHECK`. Most private tables have no policies and no ordinary role grants; absence of policy is not a reusable responder authorization design. `public.reports` has broad permissive historical policies plus a restrictive read-boundary policy. No captured application policy or function metadata reference to `auth.uid()` or `auth.jwt()` was found.

The `public` schema has PUBLIC/anon/authenticated USAGE; `gridly_control`, `history_capture`, and `report_retention` do not grant those roles schema USAGE. The table-level ACL scan found `anon` INSERT on feedback, while `public.reports` has **column-level** SELECT for `anon` and `authenticated` on 13 bounded fields despite no table-level SELECT. No direct ordinary-role report INSERT/UPDATE/DELETE grant was found. The three public community command RPCs are executable by `anon`/`authenticated`; geocode tables/helpers are service-role oriented. The one relevant sequence grants no ordinary-role USAGE. The only named Gridly role found was `gridly_retention_monitor` (non-login, no BYPASSRLS); no responder database role exists. Role grants and RLS are both required to assess actual exposure.

`auth.users` and built-in `auth.uid()`, `auth.jwt()`, `auth.email()`, `auth.role()` exist. Eight FKs to `auth.users` belong to Auth's own tables and cascade internally; no application membership/governance/user-link table or application FK exists. This confirms the Phase 11 production adapter remains future work; it does **not** verify TOTP configuration, claims, sessions, or individual users.

The local [Supabase config](../../supabase/config.toml) lists `public` and `graphql_public` API schemas. The production catalog setting `pgrst.db_schemas` returned null, so deployed Data API exposed-schema configuration is **unverified**; catalog grants and publication entries are evidence of possible access, not a full API-configuration readout. `public.reports` is in `supabase_realtime`; no responder relation is published. A private responder schema must remain outside exposed schemas, with any later safe projection deliberate and separately authorized.

## Migration history and community separation

Production `supabase_migrations.schema_migrations` contains **14** versions. Every identifier and name matches the **14 tracked files** in [repository migrations](../../supabase/migrations); ordering matches, and no tracked-only, deployed-only, or name-mismatched entry was found. No responder migration has been applied. Migration-history agreement does not prove byte-for-byte deployed definitions, which this direct catalog inventory supplies separately.

`public.reports`, `history_capture`, `report_retention`, and `gridly_control` are a community-reporting/prelaunch domain. Responder updates must retain distinct `AGENCY_OFFICIAL` identity, private agency events, agency/governance receipt and replay domains, and an independent `agency_publishing_enabled` gate. They must not reuse `reporting_enabled`, community replay tokens, report history, or report deletion cascades. This follows the [frozen responder contract](RESPONDER-V1-CONTRACT.md), [role matrix](RESPONDER-V1-ROLE-MATRIX.md), and [command contract](RESPONDER-V1-COMMAND-CONTRACT.md).

## County source and controls

`public.gridly_texas_county_boundaries` exists with `county_fips text` primary key constrained to Texas FIPS, `geom geometry(MultiPolygon,4326)`, `boundary_version text`, and a GiST spatial index. **Its exact production row count is zero.** FIPS coverage is **0/254**; there are no deployed geometry values to validate, compare by coordinates/bounds, or bind to the frozen local SHA-256 `6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49`. The table's shape is compatible with the Phase 10 candidate, but an empty table cannot prove production equivalence. `PRODUCTION EQUIVALENCE NOT PROVEN`; B03 remains blocked. No geometry was rewritten or loaded.

Bounded control reads found `reporting_enabled=false`, prelaunch reset status `consumed`, and `launched_at` absent. No `agency_publishing_enabled` column/object was found, as expected. The absence of `pg_cron` is catalog evidence only, not permission to add or activate scheduling. No control value was changed.

## Collision decision and remaining gates

The [collision matrix](../../reports/responder/responder-phase12-collision-matrix.json) covers **21** Phase 1–8 object families. There are **zero exact deployed name collisions**. Ten families have **semantic collisions** with existing community reports, history/receipts/controls, county geometry, or public projection; those objects must stay separate even though their names differ. Fixture-only `local_auth_identities`, `phase4_session_bindings`, and fixture role/session helpers must not ship. Future private tables, functions, views, grants and indexes require production-specific design and separate authorization.

**B02 is resolved for deployed schema inventory.** Newly discovered blocker **P12-01** is the empty deployed county-boundary source: B03 cannot be cleared or reused until a separately authorized source population/provenance and equivalence proof. Production Data API configuration remains an already-known B04 verification item, not a claimed inventory result. No new owner decision is required to finish B02. B03 still needs an owner-approved canonical source/load and runtime version/hash binding, plus later independent deployment and publishing authorization. No production migration, setting, Auth object, user, cron job, or publication was created or changed; no file was staged or committed in this phase.

B02 RESOLVED — PRODUCTION SCHEMA INVENTORY COMPLETE
