# LP244.22A pre-launch community-data reset and migration repair readiness

**LP244.23D current state:** Gate 2A and its separately approved postflight passed.
The authorization is consumed, report/history reset counts are zero, protocol 2 is
installed, reporting remains disabled and Cron is absent. See [client readiness
and recorded Gate 2A evidence](LP24423D-PROTOCOL-V2-CLIENT-READINESS.md). The
already-armed execution instructions below are historical and must not be replayed.

**LP244.23C superseding execution contract:** Fresh authorization transaction → `already-armed-transition` payload. The current fresh authorization must not be bootstrapped again. The failed earlier authorization was separately revoked; the owner reports that the fresh authorization remains armed. This local repair does not access or revalidate production. Earlier status and execution instructions below are historical. See the LP244.23C section immediately below and the [managed-role repair and owner export](LP24423B-MANAGED-ROLE-OWNER-EXPORT-DECISION.md) decision. Gate 2A still requires separate owner approval of an exact committed payload.

## LP244.23C explicit already-armed production path

The certified assembler always prepended `renderAuthorization`. Reapplying that
bootstrap to an armed singleton attempts `authorized → authorized`; the permanent
authorization guard correctly rejects it. No production request was made during
that failed preflight or during this repair.

There is a second necessary safeguard: a disposable regression proved that simply
removing the bootstrap from the old batch accepts a different caller UUID and
consumes the stored authorization. The old migration checks stored authorization
state and fingerprint, but does not compare its identity with a caller-supplied UUID.
The new armed mode therefore binds identity inside the same atomic transaction.
No authorization bootstrap, migration, role predicate, exporter or RLS policy was edited.

`assembleProductionBatch` now requires one scalar `mode` with exactly one of:

- `bootstrap-and-transition`: the certified output is byte-for-byte unchanged for
  identical UUID/fingerprint inputs, including its separate bootstrap transaction.
  Use only for a workflow that has not already armed its authorization.
- `already-armed-transition`: requires a valid full UUID supplied privately in
  memory; omits the bootstrap and returns one `BEGIN`/`COMMIT` transition transaction.
  The assembler converts the UUID to a SHA-256 comparison over its 16 binary bytes;
  the returned SQL contains no full UUID. The helper does not log or write payloads.

Missing, unknown, combined/array modes and malformed identities fail locally.
There is no database-state inference or automatic fallback. Armed mode rejects
overrides of the certified production project or nine-field fingerprint.

Required production sequence:

1. Separately approve and execute the fresh authorization transaction.
2. Retain its UUID privately. Do not print it, save it in a payload file, pass it
   through echoed command arguments, or reapply the bootstrap.
3. From reviewed clean committed sources, call `assembleProductionBatch` with that
   UUID and `mode: 'already-armed-transition'`; privately transfer the returned SQL
   as one raw `execute_sql` request only after separate owner authorization.
4. Stop after that one attempt. Postflight requires separate read-only approval.

Before the transition begins, the only difference is removal of the bootstrap
transaction. Inside the transaction, the armed path adds a locked identity/state/
nine-field-fingerprint guard and protected-count guards. It acquires the existing
advisory and reset-table locks, locks protected tables against concurrent writes,
checks protected counts 7/480/2 before reconciliation and again before commit, and
holds the authorization row lock through commit. Generic errors do not contain
the UUID. The original seven reconciliation statements and six ordered migration
bodies remain one contiguous, byte-identical sequence; no migration text is rewritten.

The original migration still checks current data against all nine stored fields,
checks deletion counts, enforces the repaired managed-role predicate, and performs
single-use consumption. An error anywhere rolls back reconciliation, schema changes,
deletion and consumption. The immutable revocation ledger remains unchanged.
Successful final state remains 14 unique migration versions, protocol 2, reporting
disabled and no pg_cron installation or scheduling.

Local verification on PostgreSQL 17.10 with PostGIS available:
`node --test --test-concurrency=1 tests/lp24423a-production-batch.test.cjs`
completed **19 passed, 0 failed, 0 skipped**. Both modes execute through the direct
PostgreSQL simple-query protocol as one raw request. Coverage includes 510/355
deletion, protected 7/480/2, exact migration versions, RPC/schema/admission state,
ledger preservation, second-use rejection, wrong UUID/project, revoked/consumed/
launched/missing authorization, stored/current fingerprint mismatch, protected-count
drift, and forced mid/late errors restoring the armed row and prior catalog state.
The original bootstrap-mode rollback regression also passes.

Canonical LF SHA-256 identities (UTF-8, CRLF converted to LF, no other rewriting):

| Artifact | SHA-256 |
| --- | --- |
| Synthetic bootstrap-and-transition payload | `dfc3badf6c48833d5408dc6b25878770193e17072488c457416b7b1508ae7413` |
| Synthetic already-armed-transition payload | `0ea4a60c743eb483d9e804a8026540ac9c336294b40eaab93fb9d17e75e87be7` |
| Assembler helper | `81490ab7c4323fb770309416b3f58dc32cb59702cba6d7046cf9bc1360a525c7` |
| Focused regression file | `4c2a71e1fd3f43c950d460bb2aef83ccf956aecb8f4093dbda639af6d1d057c6` |

Payload hashes use `PRODUCTION_EXPECTED` plus the existing disposable
`BASELINE_EXPECTED.owner_authorization_id` and the indicated mode. No production UUID
was used, and no assembled SQL file was retained. The regression compares legacy
output against the assembler committed at `a1030be1e0541cd85de03cb0df07f57350d8ea66`.
The managed-role migration retains hash
`b2d0b75d0796033428160cae582db0c943459c3141e02a2566bf0978baff8dd8`;
the address migration retains hash
`24a1655cdcf24fe21ee38ff0b22d9f4bf85f75cecaa612b53c2246ded818d163`.

This is local commit-readiness evidence only. The production authorization was
untouched; no Gate 2A attempt, authorization change, export, Cron activation,
reporting release, staging or commit occurred in this repair.

**Updated:** 2026-09-09 01:37 UTC
**Decision:** **NO-GO for production mutation; LP244.23A is locally certified and ready for commit**
**Production work performed:** one bounded SELECT-only schema/count verification batch. No production data was changed; no migration history was repaired; no extension, Cron job, function, asset, policy, build, commit, or deployment was created.

This packet supersedes the earlier LP244.22 execution design. Do not use an earlier two-phase `db push` procedure.

## LP244.23A local syntax and evaluator correction

The first owner-authorized Gate 2A batch was rejected by PostgreSQL with `42601`
before any production change because `precision` was unquoted in the output-column
list of `public.gridly_lookup_texas_address(text,text)`. `precision` is an established
RPC result field consumed by `supabase/functions/gridly-geocode/index.ts`, so the
contract is preserved as `"precision" text`; the source projection is explicitly
qualified as `a."precision"`. No routing, geocoding, data, or output-value behavior
changes.

The canonical LF-normalized repository SHA-256 for
`supabase/migrations/202607290200_lp1041_texas_address_foundation.sql` is
`24a1655cdcf24fe21ee38ff0b22d9f4bf85f75cecaa612b53c2246ded818d163`.
The superseded pre-correction hash was
`7f347c4e981c3d44926de2f0bac6b215c8a2b86cc44f92edeb1dfbefe58067dc`.

`supabase/retention/evaluate-community-writer-transition.sql` now records the
actual two-phase authorization contract: both legacy anonymous writers are
authorized before transition, while both direct writers must be unavailable after
transition. `tests/helpers/lp24422a-prelaunch.cjs#assembleProductionBatch` generates
the future approval payload directly from the committed reconciliation plan,
authorization script, and six ordered migration files. The whole-batch regression
is `tests/lp24423a-production-batch.test.cjs`; manually retyped production SQL is
not an approved execution source. The assembler requires a fresh owner UUID, uses
the certified 510/355 production fingerprint by default, and aborts reconciliation
unless migration history is still exactly `202607280100`.

The final owner-authorized local PostgreSQL 17.10 run detected PostGIS 3.6.2,
completed cleanup of `.tmp-lp24423a-final`, and stopped its localhost-only server.
It reported 56 passes and one failure across 57 tests. The unrelated launch-contract
check still reports pre-existing `App/PWA version authority drift`.

All LP244.23A, LP244.22A, and LP244.21 database assertions passed. The exact batch
parsed and executed against production-sized fixtures, deleted 510 reports and 355
historical events, preserved untouched counts at 7/480/2, recorded all 14 migration
versions exactly once, consumed the authorization, installed the retention schema
and protocol-v2 objects, closed legacy anonymous writers and protocol admission,
rejected exact batch reuse, and left pg_cron inactive. The forced late-error case
restored 510/355, the authorized guard, the sole original migration version, the
absent retention schema, and the legacy RLS hook. The corrected `writer_state`
evaluator passed both pre- and post-transition states. LP244.23A is locally
certified and ready for commit; production mutation remains separately gated and
unauthorized.

## 1. Owner decision and reset authority

The owner confirms that Gridly has not publicly launched, no real user/community reports exist, and all 510 current reports plus all 355 historical records are disposable pre-launch test fixtures. A future production change may deliberately purge them only after final owner approval. The purge must be reported as deletion of test data, never as preservation or migration of user data. This exception is limited to this pre-launch dataset and creates no precedent for deleting post-launch user data.

That factual decision is not authorization to mutate production. Current blockers are the owner backup checkpoint, migration-history repair approval, report-only maintenance, production-shaped rehearsal, compatible client release, Cron and independent-monitor provisioning, and final mutation approval.

## 2. Exact pre-launch reset scope

The named reset is the opening phase of `20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql`. It obtains a transaction advisory lock and `ACCESS EXCLUSIVE` locks in a fixed order, verifies an owner-created authorization record and complete approved fingerprint, then deletes only:

| Relation | Approved count | Classification |
| --- | ---: | --- |
| `public.reports` | 510 | all pre-launch test reports; 510 device-linked, 321 synthetic/device-derived, 321 embedding a device value, 195 clears |
| `history_capture.historical_events` | 355 | all pre-launch history; 138 clear events |
| `history_capture.writer_monitoring_events` | 0 | related writer telemetry |
| `history_capture.retention_runs` | 0 | related retention telemetry |

No separate production confirmation, receipt, replay, device-link, moderation, or report-history relation exists. The migration aborts if the new retention schema is partially present. It creates the new retention/replay tables only after the reset, so they start empty. No sequence reset is needed: report IDs are UUIDs, history identities need not be reused, and new identities belong to new tables.

The SQL has no target for roadway, weather, crossing inventory, POI, community authority, saved places, configuration, geocoding, rural/Texas addresses, Auth, Storage, or unrelated data. It emits only non-sensitive deletion counts through the durable authorization row and a count-only NOTICE.

Exact owner-authorized fingerprint:

```text
reports=510; device_reports=510; synthetic_reports=321
embedded_device_reports=321; cleared_reports=195
historical_events=355; historical_clears=138
writer_events=0; retention_runs=0
project_ref=nhwhkbkludzkuyxmkkcj
```

Any changed count or classification aborts before deletion.

## 3. Durable post-launch reuse guard

No trustworthy existing production launch-state authority exists. The smallest owner-controlled guard is `supabase/retention/authorize-prelaunch-community-reset.sql`:

- it is a psql-only owner bootstrap requiring an explicit project ref, UUID authorization reference, and every approved count;
- it creates one private authorization row for migration `20260908200554`;
- RLS is enabled and all access is revoked from PUBLIC, `anon`, `authenticated`, and `service_role`;
- triggers prohibit DELETE, TRUNCATE, field changes, status reversal, authorization replacement, and reuse;
- the atomic migration can consume only the exact `authorized` row for this project/migration;
- `release-community-reporting.sql` performs the only allowed `consumed -> launched` transition while atomically enabling protocol v2;
- after `consumed` or `launched`, a second reset is impossible through the guard even if row counts match.

Both owner scripts are future procedures, not migration files and not authorization to run them.

## 4. Transaction and locks

The original LP244.21 files `202609080001` and `202609080002` are explicit no-op history checkpoints. The reset, retention schema, replay protocol, grants, and security repair are one PostgreSQL transaction in `20260908200554`.

It uses `lock_timeout='5s'`, `statement_timeout='60s'`, advisory key `(24422,1)`, and `ACCESS EXCLUSIVE` locks in fixed order on `public.reports`, then the three `history_capture` tables. That blocks reads/writes until commit. ALTER TABLE, triggers, policies, grants, functions, and indexes also take normal catalog/relation locks, but the explicit locks dominate client impact. The observed data is small—about 600 KiB/510 reports and 1.2 MiB/355 history rows—so work should take seconds and plausibly less than a minute. This is an estimate; contention or provider load can still hit the fail-closed timeouts.

All statements are transactional, including the already-present `pgcrypto` check. Cron is deliberately separate. Any error rolls back deletion, schema, privileges, admission state, security repair, and guard consumption. After commit reporting remains in protocol-v2 maintenance; safe recovery is forward completion of postflight, clients, Cron/monitoring, and owner release. Restore is disaster recovery, not routine rollback.

## 5. Eleven-migration reconciliation

Production was rechecked at 2026-09-08 20:48:23 UTC. History contains only `202607280100 lp100_geocoding_governance`. The machine-readable map is `supabase/migration-reconciliation/lp24422a-production-plan.json`.

| Migration | Effect | Production | Classification | Mark? | Execute? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `202606070001` | feedback table/RLS/policy | exact present | exact-effect-present | yes | no | exact relation, RLS, policy, shape |
| `202606110001` | county/state columns | absent | required-not-applied | **no** | **yes** | absent on both tables; no superseder |
| `202606160001` | three draft history tables | absent | immediate rollback supersedes | yes | no | exact targets absent; adjacent rollback removes full set |
| `202606160002` | remove draft tables | exact final absence | exact-final-effect-present | yes | no | exact tables/policies/indexes absent |
| `202606170410` | history storage/indexes/RLS | exact present | exact-effect-present | yes | no | three exact tables, columns, indexes, RLS |
| `202606170411` | drop history storage | superseded | rollback-do-not-execute | yes | no | live storage required by later transition |
| `202606170425` | phase-1 anon writer | exact present | exact-effect-present | yes | no | exact grant/policy; authenticated revoked |
| `202606170426` | revoke phase-1 writer | superseded | rollback-do-not-execute | yes | no | atomic transition replaces/closes writer |
| `202607280100` | geocoding governance | recorded/exact present | already-applied | no command | no | history plus exact tables/RPCs/index |
| `202607290100` | rural-address registry | absent | required-not-applied | **no** | **yes** | exact table/index absent; Edge Function references it |
| `202607290200` | Texas address foundation | absent | required-not-applied | **no** | **yes** | exact tables/RPC/indexes absent; Edge Function references it |

No classification relies on a similar name. Exact proposed repair, not authorized:

```powershell
npx supabase migration repair 202606070001 202606160001 202606160002 202606170410 202606170411 202606170425 202606170426 --status applied --linked
```

Do not repair the three required absent versions; their SQL must execute. Do not repair already-recorded `202607280100`. After repair, the dry run must show exactly those three required legacy migrations, two no-op checkpoints, and one atomic transition, in order. Anything else aborts.

## 6. `public.rls_auto_enable()`

The final production check found it owned by `postgres`, `SECURITY DEFINER`, fixed `search_path=pg_catalog`, executable by PUBLIC/anon/authenticated, with no routine callers. Its only dependency is enabled `ddl_command_end` event trigger `ensure_rls`.

It is unnecessary to the report protocol. The atomic migration revokes execution, drops every event trigger whose function OID matches exactly, then drops the function. An unexpected dependency makes the drop fail and rolls back everything. Tests prove ordinary clients cannot invoke it afterward, directly insert reports, or read admission state, and receive only bounded `maintenance` from RPCs.

## 7. Cleanup scheduling and monitoring

Production supports `pg_cron` (available default 1.6.4) but it is not installed. Supabase Cron backed by `pg_cron` is the supported mechanism. The prepared activation uses `CREATE EXTENSION` plus `cron.schedule`, never direct `cron.job` mutation.

Run every minute (`* * * * *`) for day-149 cleanup, leaving 31 days before day 180. `run_cleanup()` serializes with an advisory transaction lock, records count/status/SQLSTATE-only results, is idempotent, and returns `-1` after caught failure so evidence commits. Uncaught/interrupted runs appear in `cron.job_run_details` and as stale health.

Cron calls only the schema-qualified owner function; clients have no access. A NOLOGIN monitor role reads only the health view. An external monitor must poll each minute and notify the owner through the approved operational channel on non-success, success older than five minutes, any overdue/breached count, or query failure. Alert content is timestamp, status, bounded counts and SQLSTATE only—never report/device/token/body/coordinate data. This is one short job, within Supabase's recommended maximum eight concurrent jobs and ten-minute duration.

## 8. CLI authority

`supabase` is not on PATH. A cached Windows binary is version 2.116.0; local `--version`/`--help` confirmed it and reported current stable 2.117.0, matching the official release. Help verified multiple-version `migration repair ... --status applied|reverted --linked`, linked migration listing, dry-run push, and that `db push` should use `--skip-vault` here.

Official Windows/project installation is a pinned local dev dependency, not global npm:

```powershell
npm install --save-dev --save-exact supabase@2.117.0
npx supabase --version
```

Not run. No login, link, token, or production CLI command was used. Future separately approved commands:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
npx supabase db push --linked --skip-vault
```

Actual push is prohibited until project identity, repair transcript, exact pending order/checksums, owner guard, maintenance, and backup checkpoint are approved.

## 9. Client/server order

Server-first breaks current clients: RPCs stay in maintenance and direct INSERT is revoked. Client-first cannot safely bypass the old server: new RPCs are absent while old clients retain direct writing. Coordinated order:

1. Enter report-only maintenance; stop create/confirm/edit/clear/history/retry/background writers.
2. Drain in-flight operations and run exact read-only preflight.
3. Create the owner guard with approved fingerprint.
4. Repair only seven approved history versions.
5. Verify history and `db push --dry-run --skip-vault` show exactly six pending files.
6. Push under maintenance. The three required legacy migrations run first; failure before the atomic migration leaves report data untouched. The report transition then wholly commits or rolls back.
7. Run count-only postflight and advisors while RPC maintenance remains closed.
8. Activate/verify Cron and independent monitoring.
9. Deploy compatible web/PWA assets and rebuild/release native packages. Existing checked-in Android assets are deliberately rejected.
10. Verify old direct writers fail and new clients preserve their operation token on `maintenance`.
11. Run owner-only release, atomically marking `launched` and enabling protocol v2.
12. Recheck new RPC behavior, old-client rejection, cleanup, Realtime privacy and alerts; end maintenance. Publish policy only after verification.

Server grants are authoritative; cache/version messaging is only UX defense in depth.

## 10. Owner backup/PITR checkpoint

In the Supabase project Dashboard navigate to **Database -> Backups** and record, without report data:

- latest successful backup time and displayed status;
- PITR enabled/disabled;
- if enabled, exact earliest/latest points in Point in Time settings and configured window;
- scheduled physical-backup or PITR recovery method;
- in-place versus **Restore to a New Project**;
- observed/rehearsed restoration duration.

Verified plan facts: Pro daily physical backups provide seven days' access; PITR is a separate add-on requiring at least Small compute and replaces daily backups; in-place physical restore makes the project inaccessible; Restore to a New Project is a database-only isolated copy requiring endpoint/key and non-database service reconfiguration. `archive_mode=on` does not prove PITR or backup health. The connector cannot read backup status, so this remains owner-blocking. Never reconnect a pre-cutover restore until quarantine/sanitization certification passes.

## 11. Changed files

- `docs/LEGAL/LP24422-PRODUCTION-REPORT-RETENTION-MIGRATION-READINESS.md`
- `supabase/migration-reconciliation/lp24422a-production-plan.json`
- `supabase/migrations/202609080001_community_report_retention.sql`
- `supabase/migrations/202609080002_community_submission_protocol.sql`
- `supabase/migrations/20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql`
- `supabase/retention/authorize-prelaunch-community-reset.sql`
- `supabase/retention/activate-community-report-retention.sql`
- `supabase/retention/release-community-reporting.sql`
- `js/gridly-report-protocol.js`
- `tests/helpers/lp24422a-prelaunch.cjs`
- `tests/lp24422a-prelaunch-reset.test.cjs`
- `tests/fixtures/lp24421-baseline.sql`
- `tests/lp24421-report-retention.test.cjs`
- `tests/lp24421-submission-protocol.test.cjs`
- `tests/lp24421-restoration.test.mjs`
- `tools/retention/certify-restoration.mjs`

No bundle, native package, policy, credential, dump, or production configuration changed.

## 12. Verification and remaining gates

Isolated PostgreSQL 17 tests cover exact success/mismatch, post-launch rejection, late-error rollback, partial checkpoints, reconciliation, RLS/function denial, cleanup schedule/monitor failure, maintenance behavior, LP244.21 retention, replay, restoration/recovery, and launch contracts. Final results are in the task handoff.

Static verification includes Node syntax, JSON coverage, `git diff --check`, and credential/dump/identifier/temp scans. The only archive match is pre-existing governed Census source `data/source/zip/2025_Gaz_zcta_national.zip`; no new archive exists.

Local changes are ready for owner review and owner-authorized commit, but production remains **NO-GO**. Remaining gates:

1. Complete the backup/PITR checkpoint.
2. Approve the seven-version repair and actual execution of three absent migrations.
3. Pin CLI 2.117.0 and capture credential-free version/help.
4. Rehearse the exact six-file pending sequence on production-shaped staging.
5. Approve report-only maintenance and recovery operators.
6. Run/approve a fresh single SELECT-only fingerprint preflight.
7. Separately authorize guard bootstrap, history repair, push, Cron, client deployment, and release; never mix audit SELECTs with mutating SQL batches.
8. Provision independent owner notification.
9. Prepare/verify compatible web/native artifacts and retired-client rejection.
10. Run postflight/advisors; publish policy only after technical verification.

No production mutation is authorized by this document.

## Official references

- [CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [CLI releases](https://github.com/supabase/cli/releases)
- [Migration workflows](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Database backups](https://supabase.com/docs/guides/platform/backups)
- [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Breaking-change changelog](https://supabase.com/changelog?types=breaking-change)
