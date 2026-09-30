# LP244.66 — Production subscription verification and admission

## 1. Executive finding

**Local server contracts: prepared and tested. Real Apple Sandbox acceptance: NO-GO. Real Google Play acceptance: NO-GO. Production activation: NOT AUTHORIZED.**

Branch: `LP244.66-production-subscription-verification-admission`. Starting HEAD: `7868ead7c06842de91ae45c543505c7167160472`; initial working tree clean. This phase uses repository evidence, synthetic provider fixtures, and disposable PostgreSQL 17 databases on `127.0.0.1:55462`. It does not establish fresh live provider, deployment, migration-ledger, secret-presence, or reporting-state evidence.

The previous Google acknowledgment path was request-only. This phase adds encrypted durable work, restricted RPCs, lease recovery, fixed provider OAuth composition, secret/key import preparation, and bounded health classification. The two existing Edge entrypoints remain dormant 503 handlers. Native admission authentication is still an unimplemented mandatory port; release client composition still has `publicKey:null` and `authority:null`. Credentials alone cannot activate the release.

Reporting remains disabled under the inherited owner baseline; no reporting code or production state was changed. LP244.54 remains CLOSED/PASS. LP244.65 remains CLOSED/PASS, preserving the iOS G Mac-host-reboot qualification. Old LP244.22 reset/repair must not be replayed. No consumer account is introduced.

## 2. Existing architecture and exact handoffs

**Apple:** `GridlyStoreKit` native verified StoreKit transaction → bounded JWS request → mandatory native admission/challenge validation → Apple signed verification → `getAllSubscriptionStatuses(originalTransactionId)` → cryptographically verify current transaction and renewal → fixed product/environment/state normalization → private cache reconciliation → ES256 Gridly authorization → client verifies pinned key/nonce/platform/environment → volatile delivery confirmation → finish only the native completion handle → paid-access coordinator commits valid continuity → Home. A failed finish cannot unlock Home. No blanket finish occurs.

**Google:** `GridlyPlayBilling` native purchase/query/restore → purchase token → mandatory admission validation → fixed `subscriptionsv2.get` → normalization → cache reconciliation → if acknowledgment pending, encrypt and durably enqueue → lease/reverify/reconcile → server acknowledgment → lease-fenced completion → fresh post-ack verification/reconciliation → ES256 authorization → client signature verification/delivery → continuity commit where eligible → Home. This preserves the stricter existing rule: **no new signed access before required acknowledgment completes**. Already acknowledged provider evidence skips enqueue. Transient failure retains work and returns a bounded unavailable result; restore/retry uses the same purchase, not another purchase.

Shared source: `js/gridly-entitlement.mjs`, `js/gridly-store-verification.mjs`, `js/gridly-paid-access.mjs`, `js/gridly-continuity.mjs`. Provider/server source: `supabase/functions/_shared/entitlement/`. Native hints, cache contents, installation identifiers and localStorage cannot create ownership or new authority. Reinstall recovery still requires current store evidence and fresh server verification.

## 3. Apple readiness

Existing adapter verifies both the native evidence and current API transaction/renewal. Exact bundle `com.gridlygo.gridly`, product `com.gridlygo.gridly.monthly`, auto-renewable type, environment and original transaction chain are enforced. Revocation overrides a future period end; expiry immediately denies. Grace/billing-retry unknown states do not grant. Cancellation preserves only verified remaining period access.

Prepared `server-setup.mjs` constructs the official `AppStoreServerAPIClient(p8,keyId,issuerId,bundleId,environment)` and `SignedDataVerifier(roots,true,environment,bundleId,appAppleId)` through trusted injected constructors. It does not fake certificate verification or install a dependency. Apple roots must be reviewed Apple PKI DER assets (Node-compatible Buffers); online certificate checks are enabled. Production numeric app Apple ID is mandatory. Sandbox app Apple ID is optional in the library contract, although obtaining the real ID now is recommended.

Official library version currently shown by Apple's package source is **3.1.0**. Before deployment, pin and lock that reviewed exact library and dependencies in the function's own dependency configuration and certify its actual Supabase/Deno runtime behavior, roots, online checks and API authentication. This phase has not installed, bundled or executed the real library. Synthetic constructor tests prove configuration/call order, not Apple trust-chain verification.

App Store Server Notifications are **not called or required by this initial request verification path**. No notification endpoint exists. They remain a separate lifecycle/operational design decision; their absence is not evidence of notification-driven revocation. Fresh verification occurs on launch/resume/restore and while continuity retries. No promise of immediate knowledge of unobserved remote revocation is made.

Sources: [Apple library README](https://github.com/apple/app-store-server-library-node/blob/main/README.md), [SignedDataVerifier](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html), [Apple package source](https://github.com/apple/app-store-server-library-node/blob/main/package.json).

## 4. Google readiness

Fixed package `com.gridlygo.gridly`, product `gridly_monthly`, base plan `monthly`, U.S. region, monthly plan and no offer are enforced. Replacement/linked-token flows are intentionally rejected pending a separately reviewed contract. Test purchases are isolated from production. Pending/grace cannot grant; paused/on-hold/expired deny; cancellation is bounded by period end.

`google-oauth.mjs` accepts only a server service-account identity and nonextractable RSA private CryptoKey; signs RS256 assertions with fixed Android Publisher scope and Google token audience, no impersonated user, and at most one-hour credentials. Exchanges at `https://oauth2.googleapis.com/token`; bounded 8 KiB response, 8-second timeout, no redirects; caches credentials only in server memory with early refresh. Adapter GET/POST also has 8-second timeouts/no redirects and bounded verification response.

Enable **Google Play Android Developer API** in an owner-controlled Cloud project. Create a service account; invite its service-account email in Play Console Users & permissions with app access and Google's documented **View financial data, orders, and cancellation survey responses** and **Manage orders and subscriptions** permissions. Google no longer requires linking the Play developer account to a Cloud project; do not invent a legacy linking step. Review app scope and API calls with the owner.

GET: `/androidpublisher/v3/applications/com.gridlygo.gridly/purchases/subscriptionsv2/tokens/{encoded-token}`. ACK: POST `/androidpublisher/v3/applications/com.gridlygo.gridly/purchases/subscriptions/gridly_monthly/tokens/{encoded-token}:acknowledge`, JSON `{}`. There is no client-side acknowledge call, consumption or legacy subscription verification GET.

Sources: [Google setup/permissions](https://developers.google.com/android-publisher/getting_started), [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account), [subscriptionsv2.get](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get), [acknowledge](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge).

## 5. Durable Google acknowledgment

Draft: `supabase/migrations/20260927204849_lp24466_google_acknowledgment_queue.sql`, generated locally with existing Supabase CLI **2.117.0**, `migration new lp24466_google_acknowledgment_queue`. No package installation or package/lock changes. Depends on the unapplied LP244.62 cache migration. Repository now has 19 migration files; the live ledger was not queried. Do not infer pending production versions without fresh owner-approved comparison.

Private `subscription_ops.google_ack_work`: environment, HMAC chain fingerprint, AES-256-GCM ciphertext, 96-bit random IV, creation/expiry/retry times, UUID lease/expiry, capped attempt count, fixed error category. No plaintext token, user/account/install identity or report linkage. AES authenticated data binds environment and fingerprint. Dedicated encryption key stays outside PostgreSQL in platform secrets. Ciphertext is sensitive, recoverable store evidence: this is a new purpose-specific persistence proposal requiring owner privacy/security approval before production, not a change to community-report deadlines.

Proposed **logical ciphertext TTL: min(first enqueue + 24 hours, verified period end)**. Duplicate enqueue cannot replace ciphertext or refresh TTL. Success/confirmed denial removes the entire work row immediately. Each claim physically deletes at most 100 expired rows; expired evidence cannot be claimed or signed. Physical deletion requires a functioning runner, so launch approval must specify and prove deletion lag/capacity. A stopped runner can leave expired ciphertext stored; TTL is not automatic deletion. A newly verified request after deletion can create new work, not revive old authority. No perpetual customer work history is retained; aggregate counters are capped and contain no identity.

Claims: maximum 10, environment pinned, `FOR UPDATE SKIP LOCKED`, 2-minute lease with new UUID; bounded parallel processing avoids holding a batch behind sequential provider timeouts. Fixed retry delay 30 seconds; independent runner proposed every minute. Stale lease completion cannot erase newer work. Retry state survives request/process restart. A crash after Google succeeds but before DB completion is recovered by fresh ACKNOWLEDGED status and idempotent completion. Enqueue/database/lease/reverification failure produces no signed grant. The callback may complete bounded server work after an HTTP timeout, but the timed-out request cannot grant access.

Operator evidence: `gridly_google_ack_health()` returns exactly two aggregate environment rows, bounded counts and UTC tick time, never encrypted work or identity. `ack-health.mjs` classifies healthy, failed, stale, overdue and monitor_error. Failed retry work signals immediately; pending for at least 1 minute is stale; expiry/expired count signals overdue; no tick or tick older than 90 seconds is monitor_error. These thresholds are monitoring objectives, **not new subscription or reporting retention rules**. Expired aggregate evidence persists for owner adjudication; automatic counter reset is deliberately absent.

`last_tick_at` records a claim call, including request-assisted claims. It is not independent runner completion proof. Before acceptance, separately implement/deploy an authenticated server retry invocation, once-per-minute scheduling, independent heartbeat and owner-visible aggregate alerts. Never expose `claim` ciphertext through public monitor/client routes. Existing cleanup alert payload/routes must not be broadened silently. Pending worker/heartbeat/alert delivery remains a launch gate.

Google production acknowledgment is time-critical (three days); license tests are much shorter. The current testing page prose says refund after **3 minutes**, while its table lists **5 minutes**; use the conservative 3-minute bound and prove immediate ACK in actual tests. A 24-hour retry evidence TTL is not Google's purchase deadline and cannot rescue an already refunded purchase. Existing provider-issued start time is not persisted as an acknowledgment deadline; report enqueue staleness/expiry honestly.

Sources: [subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions), [license testing](https://developer.android.com/google/play/billing/test), [Postgres locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).

## 6. Cache policy

LP244.62 metadata cache expires **last successful provider observation + 24 hours**. This is a metadata deletion deadline, not a subscription expiration or usable access grant. Exact replay does not extend TTL; older/conflicting observations reject reconciliation. Confirmed newer expired/revoked/inactive observations replace active state. Outages cannot sign a cached record: no cache-read/grant RPC exists; server signing requires a branded current provider record, never arbitrary cache JSON.

Gridly response lease remains at most 5 minutes, capped by verified period end. Durable continuity is minted only from fresh ACTIVE authoritative records and expires at `min(lastVerifiedAt+24h, currentPeriodEnd)`. Revocation/expiry/authoritative denial overrides continuity; native restart/clock/reboot/reinstall safeguards remain LP244.65's. A metadata row may survive the subscription period until its deletion deadline but cannot extend authority. No cache policy repair is required. Bounded cache prune (maximum 500) still needs separately approved scheduling/deletion-lag proof.

## 7. Signing-key readiness

Gridly entitlement and continuity use **ES256 / P-256**. Private PKCS8 imports are nonextractable in the prepared server. Fingerprints use a separate 32-byte HMAC-SHA256 secret. A separate 32-byte AES key protects queue tokens; neither key is an ownership identifier. Google OAuth uses a different provider RSA key; Apple .p8 is a different provider credential.

Release public key delivery is a pinned public CryptoKey composed into the native candidate; never a key from a response, query string, storage or window global. Current release client key/authority are null. Existing checked-in fixtures are synthetic; this phase created no production keys or secrets. No `kid`/dual-key rotation is implemented: coordinated owner server/candidate key replacement forces fresh verification; old continuity fails closed. Drain acknowledgment work before AES/HMAC key replacement; a lost/wrong key produces cipher failure and operator evidence, not token recovery or access bypass.

**Owner-executed key procedure, after separate authorization (not executed):**

1. On a trusted owner computer, create a new directory outside Git/cloud synchronization. Restrict its ACL before creating files. Do not run a secret-generating command in Codex or capture its output. Owner-only PowerShell preparation, after separate authorization:

```powershell
$operatorSecrets = Join-Path $env:LOCALAPPDATA 'GridlyOwnerSecrets/LP24466-production'
if (Test-Path -LiteralPath $operatorSecrets) { throw 'Use a fresh owner-only directory' }
New-Item -ItemType Directory -Path $operatorSecrets | Out-Null
$operatorSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls $operatorSecrets /inheritance:r /grant:r "*${operatorSid}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Directory ACL failed; do not generate keys' }
Set-Location -LiteralPath $operatorSecrets
```

The parent path must also be outside any owner-configured sync location. Sandbox uses a different fresh directory and keys.
2. Save/run this Node script there. It writes files with exclusive creation and prints nothing:

```js
const fs = require('node:fs');
const {webcrypto: c} = require('node:crypto');
(async () => {
 const pair = await c.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const b64 = v => Buffer.from(v).toString('base64');
 const secrets = {
  GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64:b64(await c.subtle.exportKey('pkcs8',pair.privateKey)),
  GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64:b64(c.getRandomValues(new Uint8Array(32))),
  GRIDLY_GOOGLE_ACK_AES_KEY_B64:b64(c.getRandomValues(new Uint8Array(32)))
 };
 fs.writeFileSync('gridly-server-secrets.json',JSON.stringify(secrets),{flag:'wx',mode:0o600});
 fs.writeFileSync('gridly-public-key.json',JSON.stringify(await c.subtle.exportKey('jwk',pair.publicKey)),{flag:'wx'});
})().catch(() => { process.exitCode = 1; });
```

3. Use the owner-controlled Supabase secret UI to enter each private value locally, never into chat, terminal arguments, screenshots or Git. Check names only. Pin only the public JWK in the reviewed candidate composition. Certify server/client signing with synthetic input before purchase.
4. Keep private backups only in approved owner secret storage; remove transient secret files under the owner's procedure. Generate an entirely separate set for an isolated sandbox deployment/candidate. Windows mode `0o600` alone is not an ACL guarantee; use the protected directory ACL from step 1.

## 8. Exact server endpoint/function inventory

All listed current deployment states are **source states**, not fresh live deployment proof. SQL execution is postgres/service_role only; none is customer-account authenticated.

| Name/signature | Purpose / auth | Environment / state | Config | Mutates / grants access / Google ACK |
|---|---|---|---|---|
| Edge `gridly-verify-apple-subscription` | POST fixed evidence; mandatory native attestation, challenge/body-digest/nonce/replay/rate admission | Production release route; current index dormant 503 | Apple inputs + common secrets/public candidate key + implemented admission | Composed: cache write / signed provider authority / no ACK |
| Edge `gridly-verify-google-subscription` | Same admission; one fixed product token | Production release route; current index dormant 503 | Google inputs + common + queue AES/RPC ports | Composed: cache/queue writes / signed authority only after ACK / yes |
| `productionComposition` / `createProductionServer` | Trusted server factories, not HTTP endpoints | Fixed production; locally prepared, not imported by live entrypoints | Owner secrets, client, real admission; official Apple library/roots | Creates ports; provider authority only through handlers |
| `sandboxAcceptanceComposition` / `createSandboxAcceptanceServer` | Trusted separate deployment factories, never request selected | Fixed sandbox/test; isolated candidate still required | Separate deployment/key set/admission + provider sandbox config | Test authority only; production consumers reject it |
| `gridly_reconcile_store_entitlement(jsonb)` | Fresh bounded normalized metadata; restricted EXECUTE | Production/sandbox private rows; LP244.62 draft pending | Service-role client, fingerprint key upstream | Cache write / no grant / no ACK |
| `gridly_prune_store_entitlement_cache(integer)` | Bounded 1–500 deletion; restricted EXECUTE | LP244.62 draft pending | Authorized server runner | Metadata deletion / no grant / no ACK |
| `gridly_enqueue_google_ack(jsonb)` | Valid encryption fields + current reconciled entitled Google row | LP244.66 draft pending | Server encryption/RPC ports | Queue insert / no grant / no provider call |
| `gridly_claim_google_ack(text,integer,text)` | Up to 10 lease-fenced claims; expired deletion up to 100 | LP244.66 draft pending; service-only sensitive response | Authenticated internal retry runner, not external monitor | Leases/deletion/tick / no grant / no provider call |
| `gridly_resolve_google_ack(text,text,uuid,text,text)` | Lease-matched success/denied/retry | LP244.66 draft pending | Internal runner only | Deletes/retries/counters / no grant / no provider call |
| `gridly_google_ack_health()` | Fixed two aggregate health rows; restricted EXECUTE | LP244.66 draft pending | Server-only aggregate monitoring adapter | Read-only / no grant / no ACK |
| `retryGoogle()` / queue `drain()` | Internal bounded fresh verification/reconciliation/ACK | Locally prepared callback, **no HTTP endpoint/schedule exists** | Google OAuth/AES/cache/queue + future internal authentication | Cache/queue writes / cannot sign authority / yes |

No subscription notification webhook, public cache-read, client acknowledge, consume, duplicate verifier, consumer-login ownership or legacy direct store grant route exists in the inspected source. Dormant routes are intentional, not operationally accepted. The synthetic loopback certification issuer is debug-only and cannot ship; it is not a subscription backend.

New tables have RLS, zero consumer/service direct table grants, private schema restrictions. New SECURITY DEFINER RPCs use empty search paths and postgres ownership. Creation removes default-ACL-derived extra EXECUTE **only on these four new functions**, then grants service_role. Postcheck accepts only owner/service_role with no grant option; tests add an unexpected default grantee and prove its function access is removed while unrelated default privileges remain unchanged. No broad PUBLIC revocation, existing schema role change, sequence, account, report join, Cron activation or reporting mutation is introduced.

## 9. Owner credential/configuration checklist

Do not send values to Codex. Existing availability means owner historical evidence only; no secret presence was queried here.

| Group / exact name or asset | Classification / availability | Needed before sandbox / production |
|---|---|---|
| Apple `GRIDLY_APPLE_ISSUER_ID` | Apple-obtained, non-secret identifier; availability unverified | Both |
| Apple `GRIDLY_APPLE_KEY_ID` | Apple-obtained, non-secret identifier; unverified | Both |
| Apple `GRIDLY_APPLE_PRIVATE_KEY_P8` | Apple-obtained secret, platform secret storage; unverified | Both |
| Apple `GRIDLY_APPLE_APP_ID` | App Store Connect numeric non-secret; unverified | Optional sandbox library input; mandatory production |
| Apple roots + official library 3.1.0 | Public Apple PKI assets / reviewed pinned dependency, not yet composed | Both, runtime compatibility proof required |
| Apple product/group | Owner-reported Gridly Monthly / Gridly Subscription, product `com.gridlygo.gridly.monthly`, $2.99/month U.S., Prepare for Submission; no trial/annual/grace/family sharing | Availability/tester must be verified; submit first subscription with real new app version later |
| Apple Sandbox tester | Dashboard-only Apple setup; unverified | Sandbox; not a Gridly account |
| Google Cloud project + Android Developer API | Google dashboard setup, non-secret; unverified | Both |
| Google service account + Play permissions | Google-obtained identity/config; unverified | Both |
| `GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON` | Google-obtained server secret JSON (`type`, `client_email`, `private_key`; fixed token URI if present); unverified | Both |
| Google package/product/base plan | Non-secret `com.gridlygo.gridly` / `gridly_monthly` / `monthly`; product creation deferred to real artifact in LP244.60 | Licensed acceptance and launch, $2.99/month U.S. no offers |
| Google licensed tester/internal track | Owner dashboard-only, real signed candidate required; unverified | Play acceptance |
| `GRIDLY_STORE_ENVIRONMENT` | Non-secret immutable server deployment config; `production` or separate `sandbox/test` | Both separately; never request controlled |
| `GRIDLY_STORE_BUNDLE_ID` | Non-secret fixed `com.gridlygo.gridly` | Both |
| `SUPABASE_URL` | Non-secret existing project URL; source target historically `nhwhkbkludzkuyxmkkcj.supabase.co`, fresh identity check required | Both approved deployments |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing platform server secret; presence unverified/not retrieved | Server only, both |
| `GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64` | Owner-can-generate P-256 private PKCS8 base64 secret; not generated | Both, separate keys |
| Public entitlement JWK | Owner-can-generate non-secret counterpart; native pinning/code/deployment required | Both, isolated candidates |
| `GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64` | Owner-can-generate 32-byte HMAC secret; not generated | Both |
| `GRIDLY_GOOGLE_ACK_AES_KEY_B64` | Owner-can-generate 32-byte encryption secret; not generated | Google acceptance and launch |
| Native admission/challenge/replay/rate controls | **Source implementation still required**, plus platform-specific dashboard credentials if chosen; no static token substitute | Both |
| Private migrations + prune/retry runner + owner alert/heartbeat | Separate production mutation/deployment authorization required; absent local deployment evidence | Both before operational acceptance |

Values above are the prepared import contract, not a claim that dormant entrypoints currently read them. Missing/invalid common config yields 503; missing/invalid platform config closes that platform. Invalid provider credentials/HTTP/network responses never mint new authority. No credentials were inspected, created, requested or printed.

## 10. Production mutations required

Separate owner approval must review both exact local drafts: LP244.62 private cache and LP244.66 queue/RPCs, new encrypted-token purpose/TTL, physical deletion lag, bounded job capacity, exact ACLs and alert/heartbeat operation. Perform fresh source/production migration ledger and target identity comparison first. Do not run `db push` simply because draft files exist. No migration was applied to production here. Local fixtures verified reporting sentinel false/protocol 2; they are not live evidence.

Scheduling cache prune and authenticated Google retry is a new operational change requiring authorization. Preserve exactly the existing two cleanup Cron jobs; do not repurpose them or alter community-report retention. Review whether a separate scheduler/trigger fits the existing approved infrastructure before provisioning anything. No indexes beyond the new queue's due/expiry indexes are proposed; no existing-table monitoring scans are introduced.

## 11. Locally complete and certification evidence

Prepared: production/sandbox factories, bounded secret imports, fixed Google OAuth, restricted RPC transport, token AES-GCM, durable queue/lease/retry/completion, post-ack fresh signing record, private/RLS migration, redacted health classifier, owner setup contract and acceptance sequence. No native implementation, production client config, dependency/lock, pricing, onboarding, reporting or public site changed.

New tests cover tamper/wrong-key/environment binding; failed ACK retained across new objects and real SQL connections; crash after provider ACK; denied work erasure; provider/cipher/cache/lease failure; newest period/denial after ACK; missing/invalid config; fixed OAuth signature/scope/audience/cache; exact Apple constructor inputs; health redaction; unexpected default ACL; duplicate expiry; lease recovery; limits; RLS/direct-table denial; synthetic reporting unchanged.

Testing includes all focused LP244.61–66 suites, browser web/PWA denial, existing native source contracts and JVM fixture. Native/store device acceptance is not repeated. A first raw Windows run encountered inherited CRLF/LF fixture mismatches in LP244.65C/I. Canonical Git LF fixture reads were used only for certification rerun, without changing Swift source or weakening assertions. The LP244.64 server test fixture was updated to the mandatory durable acknowledgment port. Final totals/check evidence recorded below after execution.

Supabase changelog/auth/dependency docs were reviewed; the September PostgreSQL minor-release legacy pgcrypto changes do not affect this WebCrypto AES-GCM design. No database upgrade/custom operator/extension change is introduced. Installed Node 24 and PostgreSQL 17 were used; Deno/Swift production runtime compilation is not claimed.

## 12. Owner dashboard actions

Denise obtains Apple/API/product/tester inputs, Google Cloud/API/service-account/Play app permissions/product/tester inputs, and reviews new private persistence/deletion/alert operation. All remain owner actions; availability is not fabricated. No account/service creation, store product alteration, key creation or secrets configuration occurred. Supabase secret values stay in the owner dashboard/local approved secret store. Reporting activation is a different owner gate.

## 13. Deployment prerequisites

Implement real native admission/challenge/replay/rate controls and transport; pin official Apple library/assets and certify actual runtime. Compose reviewed production factories into the dormant entrypoints only after exact deployment authorization. Configure server-only secrets through owner UI. Implement authenticated internal retry endpoint/schedule and private aggregate alert/independent heartbeat, plus bounded cache/queue cleanup deletion proof. Wire a native candidate's pinned public key/authority; no shared secret in clients. Isolate sandbox function names/deployment and sandbox candidate composition/key set; the current `createPaidAccess` production environment must remain fixed for release. No sandbox URL/flag may enable production access.

This phase deliberately does not edit entrypoint/config deployment wiring, implement the unapproved native admission scheme, create an external runner, or deploy the proposed callbacks. Source factory preparation alone is not service operation.

## 14. Real store runtime proof still required

**Apple:** owner verifies product availability and tester → separately authorized signed sandbox candidate with isolated server/key/environment → purchase one monthly product → native signed evidence → real Apple library/API verification → signed test entitlement → delivery and exact transaction finish → Home → restart/outage continuity within `min(24h,periodEnd)` → reconnect reverify → restore/reinstall via store proof → practical accelerated expiry/revocation. Capture count/status/timestamp evidence only; do not log JWS. Sandbox cannot grant release production access. A normal signed candidate is required; no LP244.54 retest.

**Google:** real signed candidate/internal-track artifact → owner creates/activates fixed product/base plan without changing price model → API permissions/licensed tester → authorize actual test purchase → provider `subscriptionsv2.get` → durable encrypted work + server ACK before conservative license-test deadline → signed test entitlement/client admission → fresh-process retry/crash recovery with bounded evidence → restart continuity → restore/reinstall using current Play token → practical expiry/revocation → encrypted token erasure and healthy queue/independent runner/owner alert proof. No random placeholder APK, rebuy workaround, client ACK or sandbox-to-production grant.

Both also require denial/outage/tamper/period-end/clock trust/public legal bypass evidence with the real transport and keys. No real purchase or restore was performed in LP244.66.

## 15. Recommended next stage

**Next action: owner review of the LP244.62 + LP244.66 private schema/RPC, encrypted acknowledgment-token persistence/deletion, and authenticated retry/monitor operation proposal.** No production execution is authorized by this document. In parallel, collect non-secret identifiers/statuses and obtain provider keys directly into owner-controlled storage; implement and review native admission and isolated sandbox/candidate composition. Then authorize exact migrations/configuration/deployments, verify aggregate/private boundary/disabled reporting, and only afterward separately authorize one real store purchase acceptance per platform.

Do not push, merge, deploy, generate secrets, change pricing or enable reporting as an implied continuation of local certification.

## 16. Acceptance recommendation

| Gate | Result |
|---|---|
| Local verification/acknowledgment preparation | PASS subject to the recorded test representation qualification |
| Apple Sandbox purchase acceptance | **NO-GO**: admission, real provider composition/config, isolated signed candidate/deployment and purchase authorization missing |
| Google Play purchase acceptance | **NO-GO**: same, plus private migrations, retry/cleanup/alert/heartbeat operation and product/test-track availability |
| Production paid admission activation | **NO-GO**; default server and client compositions remain closed |
| Web/PWA protected admission | Denied; public legal/support/delete routes remain available |
| Production reporting | Remains disabled under owner baseline; untouched, no fresh live assertion |
| LP244.54 / LP244.65 | Remain CLOSED/PASS; iOS G qualification preserved |

### Final local verification

- Combined focused LP244.61/61A/62/63/64/65/65A/C/G/I/66 run: **181 passed, 0 failed, 0 skipped**; both opt-in local database suites enabled. Subsequent LP244.66 module rerun: **14 passed**, including one additional end-to-end HTTP/retry/restore test. **182 distinct tests passed** across these runs; 20 LP244.66-specific tests (14 module + 6 database).
- Raw initial run: 177/181 passed, one outdated Google acknowledgment-port fixture and three inherited Swift fixture line-ending failures. Google fixture was repaired. Read-only proof compares the starting Git Swift blob with current disk normalized ONLY CRLF→LF, proves exact equality, and proves the unchanged instrumenter accepts Git LF but rejects disk CRLF. The certification preload aligns only that Swift fixture's string/Buffer reads (including its generated copy) to Git LF; it changes no production file or policy assertion. Ordinary raw Windows LP244.65C/I execution still has that inherited representation limitation; no source fix is claimed.
- Node syntax checks: PASS for changed JavaScript/MJS files. Existing JVM native contract fixture: PASS. Browser paid-admission/web/PWA-denial and legal-bypass tests: PASS. No Swift/Deno compile or native acceptance performed.
- Established changed-file credential scan: PASS. Bounded sensitive-log, production-bypass, queue safety, protected native/client/config/package/reporting-source scans: PASS. `git diff --check`: PASS. Only 13 authorized repository files changed. The CLI's generated version-check artifact was removed; it is not a deliverable.
- Disposable databases were dropped; loopback PostgreSQL fixture stopped. No production SQL/provider call/deployment/native build/push/merge was performed. One local commit is authorized after this document passes final diff/scope checks; its SHA and clean Git status are returned separately.
