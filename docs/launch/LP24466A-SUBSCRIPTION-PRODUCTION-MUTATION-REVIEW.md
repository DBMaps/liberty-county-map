# LP244.66A — Subscription production mutation and retention review

## Verdict / source boundary

**NOT READY FOR OWNER AUTHORIZATION.** Additive SQL has useful isolation and encryption controls, but the complete package lacks independently scheduled deletion, terminal failure/deadline handling, completed-run health, and deployable authenticated operations wiring. This verdict grants no execution permission.

Reviewed authoritative committed source: branch `LP244.66-production-subscription-verification-admission`, HEAD `fce7185960962f4f4b00f7ce82fc563549c8342b`; initial tree clean. Cache migration `20260926205345_lp24462_store_entitlement_cache.sql`; acknowledgment migration `20260927204849_lp24466_google_acknowledgment_queue.sql`. Reviewed their full contents, LP244.66 readiness, cipher/queue/provider/core/handler/composition/RPC/health modules, Apple completion source and existing cleanup monitoring contracts. No fresh production metadata/health queries or credentials were inspected. Live state assertions remain historical/owner baseline. Apple Sandbox and Google Play purchase acceptance remain NO-GO.

## 1. Complete database mutation inventory

Common security: three postgres-owned tables, RLS enabled with no policies; REVOKE ALL direct table privileges from PUBLIC, anon, authenticated and service_role. Private schema also revokes those roles. No direct client writes. Six public functions are postgres SECURITY DEFINER, empty search_path, nongrantable service_role EXECUTE only; PUBLIC/anon/authenticated have none. Trusted service callers can submit shaped records: SQL cannot independently establish provider authenticity. Compromised service credentials could fabricate cache records/enqueue work. The handler never accepts cache lookup as access authority; fresh provider verification plus server signing is required.

No trigger, policy, extension, sequence, scheduled job, role or role membership is created. No broad default privilege change. Six indexes total: three implicit PK indexes and three explicit indexes. Both drafts are additive and touch only newly created subscription objects/data. Existing production reports, deletion/moderation, retention, guard, admission and Cron objects are untouched.

| Object / exact action | Purpose and data | Sensitivity / current retention / deletion | Authority / rollback |
| --- | --- | --- | --- |
| CREATE SCHEMA subscription_ops AUTHORIZATION postgres; REVOKE ALL from PUBLIC, anon, authenticated, service_role | Operational namespace | No rows; persists until rollback | No authority; DROP after dependencies removed |
| CREATE TABLE subscription_ops.store_entitlements; ENABLE RLS; REVOKE ALL as above | PK(platform, environment, chain_fingerprint); product/base plan, normalized subscription/entitlement state, period end, verification/source/error/reconciliation/expiry times | Sensitive HMAC purchase-chain linkage, entitlement and period metadata. No token/JWS/raw provider JSON/customer ID. TTL verification+24h, refreshed only on newer observation. Prune required | Cannot mint signed authority; committed rollback loses metadata |
| CREATE INDEX store_entitlements_cache_expiry(cache_expires_at); implicit store_entitlements_pkey | Prune lookup / uniqueness | Index follows table lifecycle | No authority; dropped with table |
| CREATE FUNCTION public.gridly_reconcile_store_entitlement(jsonb); REVOKE/GRANT EXECUTE | Exact11-field bounded recent record, insert/upsert newer; identical retry accepted, stale/conflicting rejected | Sensitive normalized metadata; fixed24h expiry; no archive | Mutating trusted server port, not independent provider proof; removable |
| CREATE FUNCTION public.gridly_prune_store_entitlement_cache(integer DEFAULT500); REVOKE/GRANT EXECUTE | Delete1..500 expired rows SKIP LOCKED; return count | Deletes metadata only when called; no schedule supplied | Mutating housekeeping; removable |
| CREATE TABLE subscription_ops.google_ack_work; ENABLE RLS; REVOKE ALL | PK(environment, chain_fingerprint); ciphertext/IV; created/expiry/next-attempt; lease UUID/until; attempts; fixed error | Encrypted purchase token, sensitive HMAC linkage and retry state. Expiry=min(enqueue+24h, verified period end). No plaintext/raw provider JSON | No signing authority; rollback refuses ANY retained work |
| CREATE INDEX google_ack_due(environment,next_attempt_at); CREATE INDEX google_ack_expiry(environment,expires_at); implicit google_ack_work_pkey | Due/expiry lookup and uniqueness | Sensitive linkage/time keys follow table lifecycle | No authority; dropped with table |
| CREATE TABLE subscription_ops.google_ack_health; ENABLE RLS; REVOKE ALL; INSERT two environment rows; implicit google_ack_health_pkey | production/sandbox_test, last_tick_at, capped completed/denied/expired counters | Nonidentifying aggregates; NO reset/window/deletion path; persists indefinitely. No promise of legal anonymization | No authority; rollback loses aggregate evidence |
| CREATE FUNCTION public.gridly_enqueue_google_ack(jsonb); exact ACL cleanup/GRANT | Exact4 fields; fresh <=5min cached Google entitlement/future period required; encrypted insert; duplicate no-op | No duplicate ciphertext/TTL replacement. Expired conflict rejects until purge; fresh reenqueue after purge can reset local TTL | Mutating internal port; SQL cannot verify provider truth |
| CREATE FUNCTION public.gridly_claim_google_ack(text,integer DEFAULT10,text DEFAULT NULL); exact ACL cleanup/GRANT | Purge <=100 expired/environment; tick/counter update; claim <=10 SKIP LOCKED; UUID lease2min; attempts capped1m | Returns environment/fingerprint/ciphertext/IV/lease to privileged server. Sensitive encrypted material, no plaintext | Mutating retry/deletion; claim-start tick is not completion proof |
| CREATE FUNCTION public.gridly_resolve_google_ack(text,text,uuid,text,text); exact ACL cleanup/GRANT | Live unexpired lease only; retry releases lease/next+30s; success/denied deletes row/counter+1 | Terminal token retention zero after successful resolution; retry retains original TTL | Mutating internal port; stale lease cannot resolve |
| CREATE FUNCTION public.gridly_google_ack_health(); exact ACL cleanup/GRANT | Fixed2 rows: environment/subsystem/last_tick_at, pending/failed/stale/overdue counts, completed/denied/expired counters | Inner LIMIT1m bounds counted rows; no identity/cipher/token/lease | Read-only health, no authority |

Cache postcheck rejects unexpected explicit EXECUTE defaults instead of changing defaults. Ack migration revokes all initial non-owner default-ACL EXECUTE grantees on its four NEW functions only, grants service_role, then checks exact owner/service function ACL and owner-only private table/schema ACL. aclexplode/coalesce(acldefault) accounts for default ACL representation. Current production memberships/effective inherited rights still require fresh read-only proof; local ACL tests do not certify production memberships. service_role is privileged, never a client credential.

## 2. Token / encryption / exposure

Raw token occurs in store/native evidence, client/server request memory, decrypted retry memory and Google's token-bearing API URL path. Proposed backend tables never store plaintext. Gridly source does not log raw evidence; proxy/Edge/provider tracing, URL/body capture and backups are NOT certified by source tests. Disable sensitive capture before activation.

AES-256-GCM encrypts BEFORE enqueue, using nonextractable application CryptoKey imported from a server secret, fresh random96-bit IV each seal. AAD binds format version, environment and HMAC fingerprint. Separate nonextractable HMAC-SHA256 key derives linkage. Encryption is randomized; encryption/HMAC keys are not entitlement signing keys. Eventual approved home is server secret storage; no secrets created/read here. Nonextractable runtime import does not prevent secret administrators possessing original key material.

DB operators seeing ciphertext/IV/AAD alone cannot decrypt without AES secret under this contract; operators with runtime secrets/code control or plaintext traces may. Do not promise protection against all administrators. Token-derived linkage is sensitive, not anonymous.

Claim RPC returns ciphertext/IV/linkage to service_role intentionally. anon/authenticated cannot invoke work RPCs or read private tables; service_role cannot directly SELECT either. Public handler output is bounded entitlement/continuity, not token/cipher/provider response. Internal drain is not a deployed external endpoint; its internal rows must never be exposed by a future adapter.

| Event | Exact current consequence |
| --- | --- |
| Completion / already acknowledged | Live resolve success deletes entire work row immediately |
| Permanent failure | No distinction implemented; provider exception becomes provider_unavailable retry, cipher exception cipher_unavailable; no attempt cutoff |
| Cancellation / expiry / refund | Canceled pending expiry can remain entitled until period end. Fresh not-entitled resolves denied/deletes; unknown retries. Refund is not automatically treated as revocation; provider truth governs |
| Community report/user deletion | Unrelated schema with no user/report link or cascade; does NOT purge subscription rows. No subscription-specific evidence-backed privacy handling path implemented |
| Uninstall | No backend notification/deletion; independent TTL purge needed. Reinstall requires store evidence + fresh verification, not installation-ID ownership |
| Never acknowledged | No new ACK-pending authority until ensure completion and fresh post-ACK verification. Logical expiry does not physically delete without claim |

Deleting SQL rows cannot revoke already issued signed native authorizations; confirmed denial flows through existing verification/native handling. Existing <=24h/period-end continuity remains unchanged.

New Google subscriptions require acknowledgment within3days or refund/revocation; renewals do not need acknowledgment. [Google lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions). License-test prose gives3min while its table gives5min; plan conservatively for3min, never substitute production3day timing. Current2min lease plus minute retry cadence leaves poor test margin. [Google tests](https://developer.android.com/google/play/billing/test).

## 3. Retention recommendations — NOT implemented / not approved

TTL is deletion eligibility, NOT a physical erasure guarantee. DELETE leaves WAL/backups/PITR/old disk versions subject to provider lifecycle. Record actual backup/log windows before privacy promises. No180day report-linkage ceiling inherited.

| Category | Recommended ceiling / deletion | Reason / remaining aggregate evidence |
| --- | --- | --- |
| Pending token |1h from FIRST enqueue, capped further by verified period end and applicable Google ACK deadline; independent purge target <=2min after expiry while healthy | Conservative proposed launch outage budget, not proved universal minimum. Owner may select24h if justified outage SLO; requires durable deadline across reenqueue |
| Completed row |Zero; immediate successful resolution deletion (already implemented) | Capped nonidentifying outcome evidence only |
| Failed row |Same original pending ceiling; proven invalid/nonrecoverable purchase/cipher promptly deletes after safe incident recording | No token dead-letter archive. Credentials/outages are infrastructure failures, not customer denial; no retry/rotation TTL extension |
| Entitlement cache |10min after authoritative observation +independent prune | Current acceptance recency<=5min; conservative in-flight margin. Retry freshly verifies before reconciliation. Metadata TTL does not control24h continuity |
| Per-work retry/error evidence |Same work expiry, zero after terminal deletion | No per-token history |
| Health |Fixed2 scaffold rows; rolling24h outcome window, unresolved incident carried until resolved/acknowledged | Current cumulative expired_count never resets and can keep overdue forever; separate revision required |
| Alert KV / redacted logs |Recovery removes active incident; proposed<=7d KV/log lifecycle subject to actual provider configuration | Aggregate/time/category only; backup/PITR windows recorded separately, not invented |

One hour/10min are recommendations requiring approval and implementation/tests, not existing code/store rules. Shortest operationally safe pending TTL depends on agreed outage SLO and actual store deadline; not yet established. Current schema lacks durable original ACK deadline and reenqueue protection. Do not infer deadline solely from current server time or blindly shorten sandbox TTL to its2min lease.

NO guaranteed deletion path exists if runner stops or retry composition fails (missing AES/provider/common secrets); cache prune is unscheduled. Health has NO reset/deletion path. New verification can refresh one cache identity indefinitely: per-observation TTL is not a total lifetime cap. Current bounds100 expired rows/call/environment and500 cache rows/call imply nominal6,000/30,000 rows/hour at minute cadence; arrival/lock/outage capacity and purge lag must be certified. <=2min is an operational target, not outage guarantee.

## 4. Exact state machine / authority

| Transition | Actor / fields | Idempotency, retry, recovery | Authority / signal |
| --- | --- | --- | --- |
| Admission → provider → cache | Server/native challenge composition; cache state/period/last_verified | Native authenticated challenge/body/replay/rate composition still pending; newer/identical cache observation only | Client/store hints/cache alone cannot grant |
| ACK pending → enqueue | Server AES seal; PK/environment/fingerprint/expiry | Unique PK, no duplicate TTL replacement; expired conflict rejected | Handler waits for ensure success |
| Claim | Targeted ensure1 or internal drain<=10 | SKIP LOCKED, UUID,2min lease, attempts+1cap | Tick set BEFORE successful processing |
| Decrypt → fresh Google GET → cache → ACK if needed | Server callback only | AAD/env/fingerprint checks; denial deletes, unknown/conflict/errors retry | Fresh provider truth required |
| ACK/already ACK → resolve success → post-ACK GET/cache | Live unexpired lease; deletion; completed_count | Response-loss retry GET avoids repeated ACK when already acknowledged | Fresh post-ACK observation before ensure permits signing |
| Retry | Clear lease,next=now+30s,fixed error | Original expiry; no attempt limit/backoff/permanent classifier | No new grant; health failed/stale when sampled |
| Crash/resolve failure → lease recovery | After2min fresh UUID | Old resolve rejected; DB fence does NOT fence external Google side effects of old process | Overlap/deadline/cancellation needs runtime proof |
| Expiry → purge | Claim deletes<=100 and increments expired_count | No independent purge; reenqueue can reset local TTL | Cumulative expired signal cannot recover without new reset policy |

30s is next eligibility, not maximum retry interval; without runner interval is unbounded. Danger: request-assisted tick can mask missing independent progress, stalled runner retains data indefinitely, older worker may overlap reclaimed lease, post-purge enqueue resets TTL. No reviewed source path grants new authority without provider verification; compromised privileged server remains a trust boundary. Existing continuity may cover temporary outage within its unchanged bounds, never confirmed denial/revocation.

## 5. Smallest proposed operational flow — review only

Reuse existing Supabase/pg_cron, Cloudflare cleanup Worker, Resend and Healthchecks. Existing cleanup Edge remains read-only; its token must NOT gain mutating authority.

1. Existing minute Worker trigger: independent cleanup branch unchanged + new subscription operations branch; collect outcomes independently, never claim one branch success for the other.
2. Proposed fixed empty POST `gridly-subscription-ops`; exact allowlisted `SUBSCRIPTION_OPS_URL`, separate `GRIDLY_SUBSCRIPTION_OPS_TOKEN` / `X-Gridly-Subscription-Ops-Token`. No caller token/SQL/environment/limit/URL. This is a bounded MUTATING server capability, separate from read-only GRIDLY_MONITOR_TOKEN.
3. Edge internally calls production-pinned retryGoogle for<=10 items. Proposed <=40s work budget / <=60s lease, abort/deadline discipline and stale-worker tests. Current code has2min lease and no deployed authenticated retry endpoint.
4. Record COMPLETED run and purge success/lag; return ONLY environment/subsystem/state/UTC timestamps/capped counts/safe categories. Never internal drain rows, ciphertext, fingerprint, lease, provider body or secret.
5. NEW ack response/alert adapter; existing cleanup adapter rejects additional subsystem/fields. Reuse Resend sender Gridly Alerts <monitor@alerts.gridlygo.com>, owner developer@gridlygo.com; namespaced KV `gridly-subscription-alert:google_ack`, bounded suppression/reminder/recovery, healthy no-email.
6. Separate subscription check using existing Healthchecks service, proposed `SUBSCRIPTION_DEADMAN_PING_URL`, minute period+minute grace. Ping after completed run/valid health/required alert delivery; /fail where possible, missed ping catches no runner. Cleanup check stays independent. Execution heartbeat and provider-health incident are distinct signals.
7. ONE additional SQL-only pg_cron `gridly-subscription-housekeeping` minute job: existing cache prune + NEW independent `gridly_prune_google_ack_work(integer)` with bounded purge-success/lag health. Works without AES/Google/Edge credentials. Do NOT schedule claim: exports ciphertext/leases and fabricates tick. Preserve existing2 cleanup jobs; total would become3 ONLY after separate approval.

Exact additional SQL/auth/health/Worker contract is NOT yet implemented. No new provider/service or pg_net/Vault duplicated HTTP capability needed: SQL-only housekeeping + existing external runner. Activation package therefore NOT READY. Fresh production identity/ledger/role/quota checks and exact review precede owner approval. [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Healthchecks](https://healthchecks.io/docs/).

## 6. Failure matrix

Fail closed below means no NEW authorization; existing signed continuity follows existing24h/period-end policy. Ack owner delivery is proposed, not live.

| Failure | Entitlement / retry | Signal | Retained data |
| --- | --- | --- | --- |
| Google outage |Closed; provider_unavailable,+30s eligibility |failed_count; proposed owner email |Original encrypted expiry; claim-dependent purge |
| Edge outage |Closed; no drain |Tick eventually stale; proposed dead-man |Physical rows can remain indefinitely |
| Scheduler stops |No scheduled retry; requests may work |Current request tick can mask; independent heartbeat needed |TTL alone does not delete |
| Worker crash |No completion;2min lease recovery |Tick initially can look healthy, row stale after1min |Same row/expiry |
| Expired lease |Old resolve rejected; new claim |No dedicated recovery count yet |External overlap risk; no new TTL |
| Malformed cipher |Closed,cipher_unavailable retry |failed_count, proposed immediate incident |No terminal classifier; original ceiling |
| Missing AES secret |Google503/retryGoogle null |Proposed config monitor_error/dead-man |Claim purge unreachable through failed composition |
| Rotated AES secret |Old decrypt fails; no key ID/keyring |Cipher incident |Drain before replace or separately review bounded key overlap; never extend TTL |
| Revoked Google credentials |Generic provider_unavailable, not customer denial |Proposed immediate credentials incident, currently undifferentiated |Retry to original expiry |
| Duplicate token |PK no-op; live lease blocks ensure |Stalled-progress signal only |One row; reenqueue after purge can reset TTL |
| Already acknowledged |Fresh GET skips POST, resolves success |completed_count |Immediate token erase; concurrent repeated POST failure still generic retry |
| Cancel/expire/refund |Pending cancellation may remain entitled; confirmed denial deletes; unknown retries |denied/failed counts |Cache updates truth; no blanket refund assumption |
| DB/resolve timeout |Closed; recover lease |Proposed completed-run failure |Retains work until recover/purge |
| Alert/Worker failure |Never mints authority |Independent subscription dead-man |Independent SQL purge must still run |

ACK acts on an existing purchase, not a new charge. Response-loss recovery checks current state; no end-to-end exactly-once external HTTP claim. [Google acknowledge API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge).

## 7. Apple comparison

**NO comparable durable backend acknowledgment queue.** StoreKit plugin retains verified transaction completion handles in memory; finishTransaction calls transaction.finish(). Server verification precedes native completion in client flow; StoreKit supplies recoverable store-owned unfinished/current evidence after restart. This is source architecture, not live acceptance.

Apple backend stores only shared cache: platform/environment/HMAC chain fingerprint/product/normalized state/period/verification metadata. Current24h metadata TTL; recommend10min. No raw JWS, transaction ID, certificate/provider body is persisted there. Native signed continuity is separate secure storage within unchanged24h/period bounds; no symmetric server finish queue or authority from cache.

## 8. Reversibility / review-only rollback

Both forward migrations additive, structurally reversible, DATA only partially reversible. New runtime pruning DELETEs own new rows; no destructive existing-production-data change. Review SQL copies added in docs/launch/review; not executed, even locally.

Each starts BEGIN + unconditional exception: no arming switch, no CASCADE, no ledger edits, no Cron/role/default privilege changes. Future operator copy requires separate approval, fresh exact function identity/dependency/ACL/ledger checks and quiescence. Ack rollback refuses ANY pending/leased/expired work row, then removes4 functions/2 tables/indexes; health aggregates lost. Cache rollback requires ack absent, removes2 functions/table/schema/indexes; metadata lost. Unexpected dependency causes transactional failure.

Before commit ordinary ROLLBACK restores transaction changes. After committed DROP, restore structure through approved new forward migration, not history repair; records need actual backup recovery. SQL deletion cannot revoke already issued signed continuity. Stop new requests and drain workers first; callback failure/in-flight signing otherwise remains possible. Review scripts are not an operational authority off switch.

## 9. Owner decisions

| Decision | Recommendation | Alternative | Consequence | Explicit approval? |
| --- | --- | --- | --- | --- |
| Pending token |1h +period/provider deadline; independent purge |24h justified outage budget |Shorter minimizes persistence but requires fresh restore after longer outage |YES |
| Completed rows |Zero/immediate deletion |Bounded non-token history |Extra schema/purpose needed |YES |
| Failed rows |Original ceiling; proven terminal prompt delete |Generic retry to expiry |Current incident/retention delay |YES |
| Cache |10min metadata |Current24h |Neither changes continuity; revision/tests needed |YES |
| Retry |Immediate then minute,<=40s work/<=60s lease |Current2min lease/30s eligibility |Test deadline/overlap proof required |YES |
| Terminal/deadline |Distinguish invalid purchase/cipher vs credentials/outage; durable deadline |Generic retry |Avoid silent failures/reenqueue TTL extension |YES |
| Monitoring |Completed/purge health+independent dead-man |Claim tick |Tick insufficient |YES |
| Destination |Reuse developer@gridlygo.com/approved sender |Different owner route |Ack-specific synthetic receipt proof still needed |YES |
| Rotation |Drain before AES replacement |Reviewed versioned bounded overlap |Blind rotation breaks pending work |YES |
| Health/log/backup |24h aggregate, bounded incidents; proposed7d logs/KV; record actual backup windows |Longer justified windows |No unverified hard-erasure promises |YES |
| Housekeeping |One SQL-only job, preserve existing2 |Claim pruning only |Deletion remains credential/runner coupled |YES |
| Native admission |Challenge/body/replay/rate gate before activation |Dormant503 |Do not activate client-hint authority |YES |
| Migrations |Revised exact local certification +pinned CLI dry-run +separate approval |Current drafts alone |Whole package remains not ready |YES |
| Deployments/secrets |Separately approve fixed capabilities/server provisioning, no secrets in Codex |Keep dormant |No store acceptance until configured/certified |YES |
| Rollback |Quiesce/drain; fresh identity review; new forward history |Explicit destructive abandonment |Cannot recover work/revoke issued grants via DROP alone |YES |

## 10. Verification / next step

Results appended after focused local tests and scans. Runtime/native/migrations/config remain unchanged. No production mutations, deployment, secret generation, push, merge or reporting activation.

Next: owner selects retention/outage/terminal/deadline/operations policies and authorizes bounded LOCAL revision/certification. Implement independent purge, completed/purge health, durable deadline and terminal classifier, operations auth/alert adapter; certify locally, then present exact SQL/deployment package for separate production authorization. Approval of this review alone is not permission to execute production changes.

LP244.54 and LP244.65 remain CLOSED; iOS G reboot qualification preserved. Old LP244.22 reset/repair must not be replayed. Reporting remains disabled under owner baseline; no fresh live query here.

### Recorded verification — September 27, 2026

- 39 tests passed, zero failed/skipped: lp24462-entitlement-db.test.cjs, lp24462-server-verification.test.mjs, lp24466-acknowledgment.test.mjs, lp24466-acknowledgment-db.test.cjs, lp24466a-mutation-review.test.cjs.
- Disposable PostgreSQL17 on 127.0.0.1:55462 only, unique test databases removed by suites; cluster stopped afterward. Source copies of the TWO forward drafts were applied only inside disposable fixtures. Review-only rollback copies were NOT executed.
- Coverage: cache recency/idempotence/expiry/cancellation and bounded prune; queue exact ACL/unexpected default grantee, private RLS/grants, duplicate TTL, stale lease/recovery, denial/expiry erasure, real AES-encrypted retry across fresh queue object, post-ACK signing observation; cipher tamper/wrong key/AAD binding; closed missing credentials/admission; safe response/health; four rollback source safeguards.
- Credential/source-sensitive-log/syntax scan PASS across13 changed/reviewed server files; no raw logging calls or credential patterns. External provider logging is NOT certified by this source scan.
- Migration safety/scope PASS: exactly four new review/test files; existing migrations, server/JS/native/config/dependency/cleanup-worker files byte-unchanged relative to starting commit.
- git diff --check PASS, including staged new files before commit. One local review commit requested; no push/merge/deploy.

Exact server secret NAMES from source, no values: GRIDLY_GOOGLE_ACK_AES_KEY_B64 (dedicated32byte AES key), GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64 (separate32byte HMAC key), GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64 (ECDSA authority key), GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON (provider credential), SUPABASE_SERVICE_ROLE_KEY (privileged RPC client). These proposed secrets have NOT been configured by this review.

Existing LP244.58 cleanup alert/dead-man closure remains accepted with its recorded qualifications; it is not reopened. Subscription monitoring requires its own bounded failure/missed-run and owner email receipt proof before activation. No actual subscription operational alert or missed-run proof was performed here.
