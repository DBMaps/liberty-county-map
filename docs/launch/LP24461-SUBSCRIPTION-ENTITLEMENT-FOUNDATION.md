# LP244.61 — Subscription entitlement foundation

Date: September 26, 2026. Branch `LP244.61-subscription-entitlement-foundation`; starting main/HEAD `a5309fa0366e9444a37552a6a3218e1f68a97098`; initial working tree clean.

## Decision and implementation boundary

**Foundation prepared and locally tested; production/candidate subscription access NO-GO.** One shared, dependency-free entitlement module and focused tests are implemented. No production mutation, native dependency change, store change or deployment occurred. The module is deliberately not loaded by `index.html`: server verification, authenticated ownership/recovery and native adapters do not exist yet. Loading an incomplete paywall would either lock out legitimate subscribers or create an unverified purchase bypass. This is the clean architectural split authorized by LP244.61's preparation commit rule, not a claim of working StoreKit/Play integration.

Paid launch is $2.99/month, US only, through Apple App Store/Google Play. No free tier, trial, annual plan, billing grace, direct web checkout or alternative billing. Apple product `com.gridlygo.gridly.monthly`; proposed Google subscription **`gridly_monthly`**, monthly auto-renewing base plan **`monthly`**. Google identifiers are planned, not created/owner-console verified. App bundle/package is `com.gridlygo.gridly`.

Community reporting remains required at launch but disabled during this phase; no reporting admission was queried/changed. LP244.60 legal publication and LP244.54 physical iPhone acceptance remain CLOSED/PASS. Adding subscriptions will require targeted future billing candidate verification, not reopening unrelated physical acceptance or replaying LP244.22 reset/repair.

## Repository architecture audit

| Area | Current evidence and consequence |
|---|---|
| Capacitor/native stack | `package.json` pins core/ios/android/CLI 8.3.4. `capacitor.config.json` uses app ID above and `www` web directory. iOS SPM has Capacitor/Cordova and iOS 16.4 floor. Android uses Kotlin/BridgeActivity and project Capacitor dependencies. |
| Bridge patterns | `MainActivity.kt` registers custom `GridlyGeolocationPlugin`; no billing plugin registration. iOS `AppDelegate.swift` is standard Capacitor lifecycle/proxy, with no StoreKit listener or entitlement refresh. A small first-party Capacitor billing bridge fits this architecture; no third-party subscription SDK chosen or installed. |
| Billing code | No StoreKit, BillingClient, purchase SDK dependency, billing implementation or entitlement schema found in audited native sources, package dependencies and tracked Supabase migrations. Apple preconfigured subscription is owner evidence in LP244.60, not implemented runtime. |
| Startup | `js/app.js` DOMContentLoaded bootstrap around line 47264 initializes search/map/Supabase, binds events and invokes `maybeOpenFirstRunSetup()`. Additional top-level module/hooks make a late visual overlay insufficient as a security gate. |
| Onboarding | Seven accepted steps (`GRIDLY_WELCOME_TOTAL_STEPS = 7`), current walkthrough keys and local completion state. Completion skips education only, never subscription verification. Preserve pages/layout; do not treat legacy completion keys as entitlement. |
| Settings/persistence | Preferences/saved places/profile/onboarding use local storage. UGC terms acceptance uses its own versioned local record. None proves a store purchase. Subscription proof/credentials must not join report pending storage or local settings. |
| Existing gates | Reporting has a separate public status/maintenance boundary and explicit UGC acceptance; entitlement must not replace either. Native-layout/location checks are not purchase checks. |
| Identity | Persistent report device identity is client generated and tied to private report linkage; unsuitable as ownership credential. No consumer email/password account flow exists. No authenticated subscription principal or secure purchase-recovery binding is established. |
| Resume | Native AppDelegate foreground hooks exist but do not refresh subscriptions; app visibility listeners serve other features. Future native bridge foreground event plus visibility fallback must invalidate/reconcile entitlement, not rely on cached storage. |
| Public web | `public-site/` is separate informational/legal static website. Root app/PWA currently serves existing app runtime without a subscription gate. This foundation does **not** close that existing bypass; paid launch remains blocked until runtime/data boundaries are integrated. |

## Shared implemented contract

Source: `js/gridly-entitlement.mjs`. This is an ES module with no runtime side effects, globals registration, storage, network endpoint, receipt logs or production test bypass. `LAUNCH` freezes the single monthly model and IDs. Native store display data must match USD $2.99, US storefront, P1M, no offer; unexpected lookup results fail closed. Native adapters must normalize store formats to those fields rather than invent a price. Store change handling requires explicit contract revision.

| Field | Contract |
|---|---|
| `platform` | `apple` or `google`, matched to trusted native composition. Web is never a store platform. |
| `productId` | Exactly the platform's configured monthly product. Google authority additionally verifies base plan before signing. |
| `subscriptionState` | `active`, `inactive`, `expired`, `canceled_pending_expiry`, `unknown`. Revoked/refunded/on-hold states map to inactive/expired from verified store state; pending/store errors remain unknown. |
| `entitlementState` | `entitled`, `not_entitled`, `unknown`, consistent with subscription state. |
| `currentPeriodEnd` | UTC instant when supplied; mandatory and future for any entitled state. |
| `lastVerifiedAt` | UTC instant of server store verification; must not be future. |
| `verificationSource` | Only `gridly_server_store_api` for accepted authority; error fallback uses `none`. |
| `environment` | `production` or `sandbox/test`; exact runtime match. Production composition must hardcode production, without query/local-setting overrides. |
| `restoreAvailable` | True; restore remains available on the paywall even when verification fails. |
| `errorCategory` | Safe enum only: none/network_unavailable/store_unavailable/verification_unavailable/invalid_authority/platform_unavailable/purchase_pending/user_canceled. Never raw errors. |
| `nonce`, `audience`, `expiresAt` | Random request challenge, app audience `com.gridlygo.gridly`, short authority expiry. Not store receipts or stable device identifiers. |

`verifyAuthorityProof` validates an ES256 signed envelope using an already-pinned public P-256 CryptoKey, allowed header/type, exact fields, product/platform/environment, audience, nonce, state consistency and timestamps. Client cannot supply a new public key through the response. Signed freshness lease is at most five minutes and never beyond period end; this is verification freshness, **not subscription grace or a trial**. Reverification and backend revocation enforcement are still necessary. No proof contains a receipt/token/transaction ID. Unknown results never unlock.

Only snapshots produced by cryptographic verification are accepted by `accessDecision` (private WeakSet, frozen snapshots). JSON copies, local flags and raw state objects cannot unlock it. The decision rechecks expiry each time; a once-entitled snapshot is not permanent authority. Legal/privacy/Terms/Guidelines/support/delete-data/emergency surfaces are explicitly public. Arbitrary feature names or onboarding-complete flags are not public exceptions.

`createEntitlementSession` coordinates launch/resume/refresh query, purchase and restore through trusted injected ports, always reconciling store evidence with authority before granting access. It invalidates on refresh, bounds operations to 15 seconds, rejects stale concurrent completions and cannot unlock on late timeout work. Completion is requested only after verified entitlement. Temporary failure yields unknown and retry/restore, not a fabricated inactive result or indefinite local unlock. Production composition must not expose these ports or keys as mutable window/test globals. This controller is **not a store implementation or backend authentication mechanism**.

## Native implementation contracts — pending

One local Capacitor plugin `GridlyBilling` is proposed, with methods `lookupProduct`, `purchase`, `queryPurchases`, `restore`, `completeVerifiedPurchase`, and a foreground/transaction-update event. The native bridge owns raw store evidence and native secure session material. JavaScript receives safe product display fields; verification evidence is carried only to the dedicated authority, never UI/console/localStorage. Completion must internally match the verified purchase—not trust an arbitrary JS transaction identifier. No bridge file or generated native project was changed here.

### Apple

Use StoreKit 2 `Product.products(for:)`, product purchase results, verified `Transaction.currentEntitlements` and `Transaction.updates`; restore invokes `AppStore.sync()` only in response to an explicit restore action. Refresh current entitlements on launch and foreground. Handle pending/cancel/failure distinctly and pass verified signed transaction evidence to server verification. Finish each validated transaction after durable entitlement processing; rejected/expired valid transaction finalization also needs explicit adapter tests, not a blanket finish-everything call. Sandbox/test is a separate verifier path; no sandbox entitlement unlocks production.

StoreKit's verified result is stronger than client-reported JSON, but this design deliberately chooses shared server authority for both platforms. No real purchase/restore/product lookup or compile claim is made in this phase. [Apple Transaction](https://developer.apple.com/documentation/storekit/transaction), [VerificationResult](https://developer.apple.com/documentation/storekit/verificationresult), [currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements).

### Google

Add an explicitly reviewed supported Play Billing dependency later; none installed now. Query subscription ProductDetails, select only `gridly_monthly` / `monthly` with US monthly USD 2.99 and no offer/trial phase. Use the returned base-plan offer token to launch the store dialog (an offer token is an API routing value, not authorization of a promotional offer). Query existing purchases at launch/resume and restore; PURCHASED alone is not backend verification. PENDING does not grant access. Verify token via server `purchases.subscriptionsv2.get`, durable idempotent grant, then acknowledge through server API; retry acknowledgment independent of app lifetime. Do not consume a subscription. Track linked/replacement tokens, expiry, revocation/refund and reconciliation. [Google integration](https://developer.android.com/google/play/billing/integrate), [backend verification/security](https://developer.android.com/google/play/billing/security).

Owner LP244.60 evidence: Apple product prepared in US for one month/$2.99, no trial/grace/annual, Family Sharing off, Prepare for Submission. Google requires the real billing-capable artifact before product configuration; no placeholder APK. No products/settings altered here.

## Server verification and schema/RPC design — NOT applied

Server verification is required for coherent Apple/Google launch authority and backend access control. Prefer a dedicated Supabase Edge endpoint, private schema and fixed operations; do not give the app a service-role credential. Verifier checks store signatures/API status, app/package/product/base plan/environment/expiry/revocation and purchase ownership before producing the shared signed result. Client state never writes entitlement truth.

Proposed private schema **`subscription_ops`**:

| Object | Minimum design |
|---|---|
| `principals` | Random subscription principal UUID, authenticated native install public-key fingerprint, created/disabled timestamps. Separate from report device identity, location, emails and UGC linkage. |
| `store_entitlements` | Platform/environment/product/base plan, unique store subscription-chain fingerprint, principal binding, normalized state/period end/last verified time, revision. Apple original transaction identifier only where needed to query; Google purchase token encrypted at rest because later API reconciliation requires it, with keyed fingerprint for uniqueness. No full card data, raw receipt archive, names, coordinates or report references. |
| `install_bindings` | Principal/key association and challenge expiry/replay consumption; bounded secure recovery/rebinding lifecycle. No user-visible device tracking feed. |
| `store_events` | Unique verified event fingerprint and reconciliation revision/time for idempotence; no raw event-body/error logs. Keep only when operationally required under a separately reviewed retention schedule. |

Proposed fixed endpoints/operations:

- `POST subscription bootstrap/challenge`: register/validate native secure key possession and anti-abuse/app attestation before authenticated principal lookup. Existing anon Data API key is not ownership proof.
- `POST subscription reconcile`: authenticated fresh challenge plus private store proof, server API verification, atomic idempotent upsert/reconciliation, acknowledgment outcome and signed safe response. No arbitrary table/RPC/subject arguments.
- `POST subscription restore`: real native store restore/current-ownership evidence and reviewed rebinding policy; copied historical tokens must not silently transfer another principal's entitlement. Old bindings/replacement tokens cannot grant duplicate unauthorized access.
- Private DB write function `subscription_ops.apply_verified_store_result(...)`: service-only inputs from trusted verifier, transactionally unique chain/event keys and revision checks; never exposed to anon/authenticated. Default PUBLIC EXECUTE must be explicitly revoked; assert no unexpected grantees. Exact executable SQL and ACL review are a later prerequisite.
- Safe authenticated read `subscription_ops.read_entitlement()`: principal derived from validated authentication, never caller-provided report device ID. No receipt/token/transaction ID returned. Whether an authenticated Data API RPC is appropriate depends on the final principal authentication design; do not create a public read prematurely.

All private tables: RLS enabled; no PUBLIC/anon/authenticated table access; narrow internal server access. Authenticated responses only for the validated caller. Separate production and sandbox/test uniqueness/credentials/records; signing keys pinned to environment. Planned keyed fingerprints are identifiers, not claims of anonymity. Store credentials/encryption/signing private keys stay server-side in provider secret stores; none created or committed.

**Prerequisite deliberately unresolved:** existing accountless install identity is not safe authority. Before executing DDL or implementing a bootstrap, specify native Keychain/Keystore session/key provisioning, app attestation/rate limits, replay challenges, ownership proof and reinstall/cross-device restore conflict policy. An anonymous Supabase Auth principal may be evaluated without email/password, but is not currently configured/proven and must not be treated as automatically secure recovery. A client-supplied ID or signed copied receipt alone must not authorize rebinding. No consumer email/password system is added here. Same business rules do not imply Apple purchases automatically transfer to Google accounts.

Schema/RPC design is an architectural review proposal, not an executable migration. No migration added; existing production ledger, RLS/grants, cleanup and reporting contracts unchanged. This split avoids exposing an unverifiable entitlement endpoint. Owner review must resolve credential provisioning, minimum transaction retention/deletion, private grants and recovery before backend/native implementation. No new retention deadline is invented or imposed on community reports.

## Launch access, onboarding and web design — not activated

Use one entry boundary **before protected scripts/data/subscriptions initialize**, rather than checks scattered across map/features or a removable late paywall overlay. Current DOMContentLoaded checkpoint is too late because app.js contains many self-starting hooks. Build a minimal ungated shell that hosts accepted onboarding, purchase/restore/retry and legal/support/deletion access; defer paid runtime loading until signed verification passes. Then recheck lease/period on foreground and before protected session continuation. Server endpoints/data delivery must enforce entitlement too; hiding buttons does not protect unrestricted data feeds or modified clients.

Preserve all seven onboarding pages and portrait assets. Education completion only advances to the bounded subscription step. Purchase controls display store-provided monthly price, applicable renewal/cancellation terms, Restore, Retry and independently accessible policy/support/deletion links. Unknown shows a verification-retry state; confirmed inactive/expired shows subscription required. No free skip. Canceled-before-expiry remains entitled until expiry; revocation/end-of-period denies. Long offline/transient failure cannot get free access, but retry/restore/support stay reachable and no durable local lockout flag is written.

`accessDecision` denies product access for web/unknown platform even with signed native entitlement; production runtime must use native-detected platform, not URL/local-setting spoofing. Keep `gridlygo.com` informational/legal site separate. Root web/PWA app runtime must deny paid entry and stop protected initialization/network work; no web checkout or web unlock. **Current app/PWA is not changed by this foundation and still lacks that enforcement.** This is an explicit paid-launch blocker, not a feature flag left as an approved free tier. Native/user-agent detection alone is not a security boundary; backend authentication/authorization is still required.

## Privacy and closure requirements

No receipts/tokens/full transaction payloads in UI, logs, report/device linkage, public RPCs or local settings. Native bridge/server memory may process raw verification material only for its dedicated purpose. Token encryption, purchase metadata retention, replay records, log redaction and request/deletion handling must be reviewed and synchronized with approved Privacy before operational deployment. Tests use ephemeral cryptographic keys and synthetic evidence in memory; no credentials generated for production.

Next work: (1) finalize authenticated accountless ownership/recovery and schema/ACL contract; (2) provision store API verification credentials privately under separate infrastructure authorization; (3) implement server verifier/idempotent processing/signing; (4) implement/compile native StoreKit2 and Play adapters, transaction listeners and completion/acknowledgment; (5) wire pre-runtime paywall/onboarding/public surfaces and server access enforcement; (6) sandbox/test revoke/expiry/restore/reinstall/acknowledgment/end-to-end checks and real candidate/store configuration; (7) separately authorized release and reporting activation. No physical acceptance reopened or release build performed now.

## Verification and commit

Focused `tests/lp24461-subscription-entitlement.test.mjs`: **13/13 PASS**. Tests exercise real ephemeral ES256 signatures/tampering/wrong keys, state consistency, nonce/environment/product/audience/freshness, canceled expiry, unknown vs denial, restore/launch/resume calls, purchase pending/cancel, concurrency/timeout, public surface exceptions, web deny, safe product display and unchanged seven-page onboarding/dependency/reporting wiring. Store ports are test doubles only; these results are not store/server verification certification.

Existing bounded legal/publication tests remain relevant for public exceptions and 18+/subscription text. Before commit run those, `git diff --check`, exact scope and secret-pattern checks. No dependency install, Supabase mutation, native build, device testing, store change, push/merge or production reporting activation.

Commit: **Prepare subscription entitlement foundation**. Current release verdict: **NO-GO** until the explicitly listed native/server/gating prerequisites are implemented and verified. Foundation tests passing do not convert missing store integration into GO.

Final combined bounded run: 38/38 PASS (13 entitlement + 25 existing legal/public-site/compliance). Only the three named foundation files are added; existing runtime/native/dependencies/migrations/policy files have no diff.
