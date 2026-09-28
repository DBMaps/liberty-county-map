# LP244.66 Window 2B — production Google acknowledgment migration result

**Observation:** September 28, 2026, approximately 01:05–01:25 UTC. **Verdict: WINDOW 2B ACKNOWLEDGMENT MIGRATION PASS WITH FOLLOW-UP.** The owner-authorized acknowledgment migration `20260927204849` was the sole migration applied to Gridly production. The production ledger now records both subscription migrations exactly once. Schema, grants, launch state and existing cleanup jobs passed read-only postflight. Once-per-minute cost under load and live external scheduler configuration remain later gates; no scheduler was activated in this window.

## Source, identity, recovery and authorized scope

Branch `LP244.66-production-subscription-verification-admission`; starting HEAD `9cca7a271ac82e14ac7c34f124e4d5c9ca76f733`. Initial Git status showed only the known owner-created untracked Supabase CLI artifact. It was not read, staged, deleted or intentionally modified. No other local change existed before this result document. The existing cached Supabase CLI package reports **2.118.0**. Its Node entrypoint was used without downloading a package or changing dependencies, as in Window 2A.

Binary Git blob SHA-256 checked at starting HEAD:

| Migration | Approved committed-byte SHA-256 | Production preflight |
| --- | --- | --- |
| Cache `20260926205345_lp24462_store_entitlement_cache.sql` | `4ed076fe114e6d69b8104ea1e6de10c71031f7310d6a2bbbb2cd784158f24e6a` | Already recorded once; **not reapplied**. Checkout CRLF→LF only reproduces the approved hash. |
| Acknowledgment `20260927204849_lp24466_google_acknowledgment_queue.sql` | `53f9e93fbbf9f9acf831a8e301d8594a4b016f0fc1b25a227aead561c4125270` | Absent before Window 2B; **the only authorized application**. Raw checkout bytes match the approved hash. |

The authenticated CLI project lookup exited 0 and showed **Gridly Platform**, ref `nhwhkbkludzkuyxmkkcj`; the checkout's linked ref matched. Independent read-only project metadata identified that ref as active and healthy in `us-east-1`. No credential storage, access token, password or connection string was inspected or printed.

The owner had verified scheduled physical backups, daily restore points visible for at least September 20–27, 2026, a Restore action, and PITR disabled, and accepted backup-based recovery for these additive database objects. Storage API objects lie outside database backup scope; this migration changes database objects only. No backup configuration or restore operation was performed.

## Fresh preflight, dry run and application

Fresh production read-only preflight found **18 ledger rows / 18 distinct expected versions**, zero missing/unexpected/duplicate versions, cache recorded once and acknowledgment absent. The cache table existed with **0 rows** and both cache RPCs existed. The acknowledgment work and health tables were absent. Reporting remained disabled with protocol `2`; the matching-project guard was `consumed` and unlaunched. The two existing report-retention and compliance-cleanup Cron jobs were active at `* * * * *`, postgres-owned, pointed to the current database and had exact expected commands. No subscription job appeared.

The linked `db push --dry-run --skip-vault` exited **0** and proposed **exactly one** migration: `20260927204849_lp24466_google_acknowledgment_queue.sql`. Cache was not proposed. With both approved local hashes and the linked project ref rechecked, the owner-authorized linked `db push --skip-vault` exited **0** and named **only** the acknowledgment migration. No seed/role inclusion, migration repair or second migration was requested or run.

Fresh production ledger postcheck returned **19 rows / 19 distinct expected versions**, zero missing/unexpected/duplicate versions. Cache `20260926205345` and acknowledgment `20260927204849` each appeared **exactly once**.

## Exact object, access and sensitive-data inventory

The existing postgres-owned `subscription_ops` private schema remained without nonowner schema ACL entries; anon, authenticated and service_role have no direct schema USAGE. The migration added two postgres-owned private RLS-enabled tables with **zero policies and zero nonowner table ACL entries**. Anon and authenticated have no direct SELECT or INSERT on either. Service_role also has no direct table grant; server code reaches them through narrowly granted `SECURITY DEFINER` RPCs.

| New object | Read-only catalog result |
| --- | --- |
| `subscription_ops.google_ack_work` | **15** reviewed columns: environment, chain fingerprint, encrypted `ciphertext`, randomized `iv`, `key_version`, queue state, source/provider deadline times, created/expiry/next-attempt times, lease/lease-until, attempts and safe error category. No plaintext purchase-token or encryption-key-material column. **0 rows.** |
| Work constraints | Environment/state/error vocabularies, bounded ciphertext/IV/key-version shapes, attempt bound, lease consistency, PK `(environment,chain_fingerprint)`, and absolute `expires_at` after creation but no later than creation+1 hour, source start+1 hour or provider deadline. |
| Work indexes | PK plus `google_ack_due(environment,next_attempt_at)`, `google_ack_expiry(environment,expires_at)`, and `google_ack_created(environment,created_at)`. |
| `subscription_ops.google_ack_health` | Environment-keyed safe aggregate/timestamp/category table; exactly two initial rows, `production` and `sandbox_test`. Work-tick/completion/purge times unset, window start set, four counters zero, category `none`. No token/ciphertext/key columns. PK `(environment)`. |
| New functions | Private owner-only `subscription_ops.roll_ack_health(text)` plus seven service_role-only public-schema RPCs: `gridly_enqueue_google_ack`, `gridly_prune_google_ack_work`, `gridly_claim_google_ack`, `gridly_resolve_google_ack`, `gridly_complete_google_ack_run`, `gridly_subscription_housekeeping`, and `gridly_google_ack_health`. |

All eight new functions exist, are postgres-owned `SECURITY DEFINER` with `search_path=""`, and have **zero unexpected EXECUTE grantees** or grantable service_role grants. Anon/authenticated cannot execute any; service_role can execute the seven intended public-schema RPCs and cannot execute the private helper. The service-role-only `gridly_claim_google_ack` intentionally returns ciphertext, IV and key version to the trusted backend for provider work; it is **not client-executable**. `gridly_google_ack_health` returns only environment, subsystem, safe timestamps, bounded aggregate counts, age and error category—no token, ciphertext or fingerprint.

Read-only live function-definition checks confirmed: enqueue uses an absolute least-of-deadlines calculation; re-enqueue uses `ON CONFLICT ... DO NOTHING`; retry changes next attempt without extending expiry; successful/terminal resolution has the work-row DELETE path; independent expiry prune uses bounded `FOR UPDATE SKIP LOCKED`; claim uses bounded row locking; and housekeeping includes bounded cache prune. The work-table constraint independently enforces the one-hour upper bound. No mutating RPC, housekeeping function or synthetic token insertion was invoked. The safe read-only health RPC returned **two** rows with pending/due/failed/stale/overdue and outcome counts all **0**, age **0**, unset run timestamps and category `none`. This is expected **no work yet**, not proof that a scheduler has run.

## Scheduler, launch state, advisors and cost

Postflight Cron catalog still showed only the two unchanged, active minute cleanup jobs with expected command identities. No subscription/entitlement/Google-named pg_cron job appeared. The tracked Cloudflare cleanup Worker configuration still names `worker.mjs` as its entrypoint; no Cloudflare deployment was invoked in this window. Live Cloudflare configuration was **not independently queried** here, so external scheduler status is not inferred beyond the fact that this database migration could not deploy Cloudflare code.

Postflight admission remained `reporting_enabled=false`, protocol `2`; the matching-project launch guard remained `consumed`, `launched_at=NULL`. No Edge/server, Cloudflare, native or store asset was deployed, no secret configured, and no paid-admission switch was touched.

Supabase advisors showed no material new finding for these objects. The new acknowledgment tables carry expected **INFO** [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices: private owner-only tables intentionally deny direct client access. The three new work indexes carry expected **INFO** [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) notices while the queue is empty and scheduling is off. The Window 2A cache notices remain; no advisor finding was auto-fixed.

Read-only `EXPLAIN (FORMAT JSON)` **without ANALYZE** on the empty queue showed: due leasing uses `google_ack_due`; deadline purge uses `google_ack_expiry`; oldest-pending uses an index-only scan on `google_ack_created`; pending count also uses an index-only scan on `google_ack_created`. The empty-table planner used an environment index plus residual filters for due, failed, stale and overdue health counts rather than proving selective plans at scale. In particular, `failed_count` has no error-category index. The `LIMIT 1000000` subqueries bound returned counts but do not make repeated scans cheap. Empty-table plans estimated approximately one row and cannot certify loaded once-per-minute cost. **Before any subscription scheduler authorization**, obtain the separately reviewed bounded load/capacity and current-plan evidence; no index or scheduler change is authorized here.

## Verdict, rollback and next owner decision

**WINDOW 2B ACKNOWLEDGMENT MIGRATION PASS WITH FOLLOW-UP.** Schema, identity, ledger, RLS, grants, function posture, initial state, existing cleanup jobs and reporting/guard postchecks match the reviewed migration. The follow-up is nonmaterial at this dormant stage: information-level advisors and loaded query-cost proof before scheduler activation. **Rollback classification: no rollback.** The reviewed decision tree keeps these inert objects while admission/operations remain off; a later material defect would require a fresh read-only snapshot and separately approved exact rollback after dependency and retained-work checks. No destructive rollback or ledger repair was attempted.

The exact next owner decision is whether to review and separately authorize **Window 3 secret/key lifecycle preparation and configuration**—including distinct signing, fingerprint, Google service/AES, Apple and operations-auth decisions—without providing secret values to Codex. Edge deployments and scheduler/monitoring require their own later approvals. Real Apple/Google purchase acceptance and paid admission remain NO-GO; community reporting remains disabled and separate.

## Local verification

After the push, both committed migration blobs still matched their approved SHA-256 identities. No application source or migration file changed. The only new tracked deliverable is this result document. `git diff --check` passed before staging, and a focused scan for credential, connection-string, JWT and private-key patterns in this document found zero matches. The owner's preexisting untracked CLI artifact remains outside the commit; it was not opened or staged. No native build, device test or provider purchase test belongs to this database-only window.
