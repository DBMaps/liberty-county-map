# LP244.23D protocol-v2 client readiness

Work is local on `LP244.23D-protocol-v2-client-readiness`. Reporting stays disabled.
No production connection, authorization change, deployment, native package build,
Cron activation, reporting release, staging or commit occurred in this mission.

## Certified Gate 2A evidence

The preceding owner-approved atomic transition and its separately approved,
single read-only postflight completed with `overall_pass=true`. This document
records that evidence; it is not a new production observation or restoration witness.

- Fresh authorization consumed, consumption timestamp populated, launch timestamp null.
- Reports / historical events / history writer monitoring / history retention runs: 0/0/0/0.
- Feedback / geocode cache / provider state: 7/480/2.
- One prior revocation-ledger entry preserved, private and immutable.
- Exactly fourteen unique migration versions; seven reconciliation marks and six
  execution candidates each present once, plus the original geocode migration.
- Retention objects and all three protocol-v2 RPCs installed; old RLS hook and its
  invokers absent. Unrelated event-trigger preservation was supported by review
  of the exact committed DROP scope, not a before/after inventory comparison.
- Required RLS, restrictive policy, column/RPC grants and monitor role checks passed.
- Legacy anonymous inserts denied; protocol 2, reporting disabled; pg_cron absent,
  zero jobs; no partial transition observed.

Versions: `202606070001`, `202606110001`, `202606160001`, `202606160002`,
`202606170410`, `202606170411`, `202606170425`, `202606170426`, `202607280100`,
`202607290100`, `202607290200`, `202609080001`, `202609080002`, `20260908200554`.
No authorization identifier, comparison digest, secret or row content is recorded.

## Client writer call graph

| Entry / operation | Call path and database boundary |
| --- | --- |
| New road hazard | `createSharedHazardReport` → `gridlyInsertWithCountyMetadataFallback('reports')` → protocol `submit('create')` → `submit_community_observation` |
| New crossing report | `createSharedReport` → same report adapter → protocol `submit('create')` → submission RPC |
| Confirmation of an existing hazard/crossing | The two creation entry points detect the existing target → `gridlySubmitCommunityMutation('confirm')` → protocol → `mutate_community_observation` |
| Edit | protocol `submit('edit', {observation_id, changes})` → mutation RPC; the original-device check remains server-side |
| Road clear | `clearHazard` → report adapter `submit('clear')` → mutation RPC → `gridlyPersistExactHazardClear` verifies the returned/read original identity and cleared state |
| Crossing clear | `createSharedReport('cleared')` → report adapter extracts the original lifecycle target → mutation RPC |
| Manual retry / restart | `gridlyRefreshPendingOperationButton` → the same persisted protocol operation → same RPC and token; no new identity, automatic loop or reconnect listener |
| Cancellation | explicit protocol `cancel()` or age-expired pending payload → same operation token → `cancel_community_operation`; cancellation does not delete an already accepted report |
| Old history capture | `writePhase1AEnvelope` unconditionally returns disabled before resolving storage; canary/options cannot enable it |
| Developer purge helpers | direct report deletion expressions are replaced with a denied result; no database mutation occurs |
| Feedback | separate existing `gridly_feedback` write path only; generic adapter rejects every other non-report table name |

Only `gridly-report-protocol.js` dispatches Community Report write RPCs. Remaining
`from('reports')` calls are reads. The adapter's direct INSERT branch is restricted
to feedback, and cannot reach reports, history or private retention tables. The
historical writer's retained INSERT text is unreachable behind its unconditional
disabled gate, which is exercised with a throwing storage client.

## Defects repaired

1. The pending-operation button reported maintenance as resolved. It now uses a
   shared truthful outcome message and refreshes only resolved outcomes.
2. The report adapter manufactured a local row for replay responses without a
   returned report. It now refreshes and returns an error result, preventing an
   optimistic marker/card. New accepted road/crossing projections use the actual
   server identity and creation timestamp, avoiding a second synthetic identity.
3. A consumed token is not proof that an edit/confirmation succeeded (a previous
   forbidden/gone result can also consume it). Mutation replay now refreshes and
   returns false instead of claiming a confirmed update. Clear still requires
   a confirmed cleared row; timeout copy no longer asserts the row is active.
4. Missing protocol RPC errors were treated as ordinary network failures. They
   now produce an explicit stale-client response. The client exports
   `protocol_version=2` and rejects an explicitly stale local contract before send.
5. The generic adapter and developer purge helpers retained reachable non-protocol
   mutation capability. Report lifecycle paths now have only the RPC boundary;
   feedback remains separate. Consumer transport output uses a field allowlist.
   Device-bearing duplicate-lock keys were removed from submission diagnostics;
   private in-memory locking behavior is unchanged.
6. App/index/service-worker version drift prevented deterministic bundle
   certification. Those report-client identities are aligned, and the bundle
   manifest now binds protocol 2 and the actual atomic transition migration,
   alongside the two superseded checkpoints. No unrelated PWA behavior changed.

RPC signatures have no `protocol_version` argument. Version 2 is the client and
bundle contract and database admission version, not invented wire negotiation.
Legacy direct writers are denied by grants; unsupported report fields are rejected
by the committed RPC. Missing/malformed token shapes are rejected, while a new
cryptographically random UUIDv4 is a legitimate operation token, not a forged user
credential. Transport failures retain the durable token; retries are explicit.
Maintenance retains an unconfirmed operation and never fabricates completion.

## Local acceptance and limits

The exact browser protocol module is driven by a Supabase-shaped `rpc` adapter
against disposable PostgreSQL 17.10 / PostGIS 3.6.2 with the committed 510/355 batch.
The adapter executes only the three exact SQL RPC signatures as `anon`. UI adapters
are evaluated from their actual app source with isolated dependencies; no app
connection reaches production. Fixture-only reporting enablement is removed with
the disposable database. This is not a PostgREST deployment or physical-device test.

| Acceptance case | Evidence |
| --- | --- |
| Reporting disabled | create/edit/confirm/clear/cancel return maintenance; no rows or replay entries, no automatic retry |
| Enabled submission | exact module accepts a report using the installed RPC |
| Duplicate/lost response/restart | same durable token, one row, replay returns no fabricated report |
| Edit/confirm/clear | original row identity retained; retention clocks unchanged |
| Cancellation | pending identity becomes a tombstone; later submit cannot recreate it |
| Offline/reconnect | pending operation survives; explicit retry succeeds once |
| Stale client / malformed token | local version mismatch and missing RPC are truthful; malformed/missing tokens and unsupported fields rejected |
| Legacy writes | anonymous reports/history/private retention INSERT attempts denied |
| Replay / linkage / deadlines | private receipt/link exists only as governed; consumer output excludes it; day-149/day-180 intervals preserved |
| Rejected/replayed UI submission | no inserted row or optimistic marker identity; mutation replay does not claim success |
| Protected layout | CSS is canonical-byte-identical to HEAD; index changes only script identities, no layout markup |
| Owner Level 1 | redacted analytics succeeds on this disposable post-transition fixture |
| Owner Level 2 | real restrictive Windows ACLs and encrypted output succeed for safe first-party crossing content; unsafe-looking content fails with INCOMPLETE and no valid manifest |

**Remaining Level 2 limitation:** independently generated `hazard-UUID` identifiers
from the current client trigger the certified archive's UUID-in-text secret-review
rule. The test proves this rejection, then uses a separate safe-content fixture
for positive archive validation. No exporter was weakened, no rejected row was
silently omitted and no production archive was extracted. Full hazard-archive
compatibility needs a separately reviewed, provenance-aware solution before claiming
complete owner extraction for all newly collected report shapes.

## Asset authority and next gates

Final focused command:
`node --test --test-concurrency=1 tests/lp24423d-client-readiness.test.cjs tests/lp24421-submission-protocol.test.cjs tests/lp24421-launch-contracts.test.mjs tests/lp24421-report-retention.test.cjs`
completed **40/40 passed, zero skipped**. This includes eleven new readiness cases.
Real Windows ACL verification required execution outside the filesystem sandbox;
no storage check was mocked or weakened for the positive archive test.

Broad command `node --test --test-concurrency=1 tests/lp244*.test.*` completed
**457/460 passed, zero skipped**. Its remaining old cache-name assertion was then
corrected and the three affected asset/layout suites passed **15/15**. Two broad
failures remain in `lp2444-api36-first-launch-repair.test.mjs`: Dallas/native search
diagnostic ordering and use-location bounded-state assertions. The exact failing
assertions were replayed against both HEAD and current source: both fail, and both
relevant function sections are canonical-byte-identical. They are baseline issues,
not silently waived passes. The full broad suite was not rerun after that final
cache-assertion correction. JavaScript syntax and `git diff --check` pass.

The bounded client change is ready for owner-authorized commit with these disclosed
limitations; it is not a production reporting-release certificate. No APK/IPA or
physical-device acceptance was performed.

Exact changed-file inventory (12 modified tracked files, 3 new files):

- `js/app.js`
- `js/gridly-report-protocol.js`
- `index.html`
- `service-worker.js`
- `tools/native-web.mjs`
- `tests/lp24421-launch-contracts.test.mjs`
- `tests/lp24421-report-retention.test.cjs`
- `tests/lp2445-bare-texas-place-destination.test.mjs`
- `tests/lp2445c-consumer-visual-search-closure.test.mjs`
- `tests/lp2445c-owner-acceptance-correction.test.mjs`
- `docs/LEGAL/LP24421-RECOVERY-RUNBOOK.md`
- `docs/LEGAL/LP24422-PRODUCTION-REPORT-RETENTION-MIGRATION-READINESS.md`
- `tests/lp24423d-client-readiness.test.cjs` (new)
- `docs/LEGAL/LP24423D-PROTOCOL-V2-CLIENT-READINESS.md` (new)
- `docs/LEGAL/LP24423D-CLIENT-ASSET-IDENTITIES.json` (new)

See `LP24423D-CLIENT-ASSET-IDENTITIES.json` for exact working-tree byte hashes and
the protected CSS canonical-LF hash. Runtime authority is
`lp244.23d-protocol-v2-readiness`; cache is `gridly-pwa-shell-lp24423d-v2`.
Runtime/manifest hashes bind the actual copied bytes, not canonical-LF migration
review hashes. Git line-ending normalization can change future copied byte hashes;
the packaging verifier must generate and validate the manifest from those exact bytes.

The checked-in Android assets are obsolete and lack the protocol module. They are
rejected by the bundle verifier and were not refreshed or packaged. Deterministic
candidate staging, APK/IPA manufacture and device testing require separate approval.
Existing installations cannot be claimed upgraded from this local evidence.

The next production-affecting step, after owner commit review and launch-blocker
review, is separately approved distribution of a manifest-verified protocol-v2
client while reporting remains disabled, followed by bounded maintenance-mode
verification. Production reporting release is a later explicit gate, requiring
the retention scheduler/independent monitoring and recovery prerequisites; it is
not authorized by client certification. No automatic Cron activation is proposed.
