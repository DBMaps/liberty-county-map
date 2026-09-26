# LP244.61 — Subscription entitlement foundation

Date: September 26, 2026. Branch `LP244.61-subscription-entitlement-foundation`; starting main/HEAD `a5309fa0366e9444a37552a6a3218e1f68a97098`; initial working tree clean.

## Decision and implementation boundary

**Foundation prepared and locally tested; production/candidate subscription access NO-GO.** One shared, dependency-free entitlement module and focused tests are implemented. No production mutation, native dependency change, store change or deployment occurred. The module is deliberately not loaded by `index.html`: server verification, store-owned recovery/native request protection and native adapters do not exist yet. Loading an incomplete paywall would either lock out legitimate subscribers or create an unverified purchase bypass. This is the clean architectural split authorized by LP244.61's preparation commit rule, not a claim of working StoreKit/Play integration.

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
| Identity | Persistent report device identity is client generated and tied to private report linkage; unsuitable as ownership credential. No consumer email/password account flow exists. Store-owned purchase lookup/restore is not implemented; installation identity must not become durable purchase ownership. |
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

## LP244.61A — Store-owned verification/recovery authority

Owner clarification recorded September 26, 2026, starting HEAD `28fb266ea1f9ed92a71ae06202706f3ab4e7e940`. **No Gridly consumer account is required.** This supersedes the original proposed principal/install-binding/anonymous-auth/rebinding architecture. Those concepts are not launch prerequisites and must not be implemented as a replacement store identity system. No email/password, profile creation, Gridly login or custom account recovery is introduced.

**Ownership belongs to Apple App Store or Google Play.** StoreKit/Play obtain the current user's purchases through the store account; Supabase verifies the resulting evidence, caches and reconciles store-derived state. An optional native installation key/session authenticates this request and limits replay/abuse only; it is neither purchase ownership nor a required old identifier for restore. Reinstall/new-device recovery starts from fresh native store results. Several legitimate installations can prove the same store purchase; cache uniqueness prevents duplicate processing, not legitimate store-account access. No cross-store Apple-to-Google transfer is promised.

### Exact planned verifier endpoints and request contracts

The new `js/gridly-store-verification.mjs` implements bounded request shape/IDs for the trusted coordinator. **It is not a deployed Edge Function or cryptographic store verifier.** Neither endpoint exists yet. Request body fields are fixed; no email/profile/Gridly account/report-device/installation identifier is required. Each request uses a fresh nonce. Production native composition fixes the store/environment; the server independently validates those values from the verified provider evidence. Evidence input shape alone never grants entitlement.

| Endpoint | Accepted input | Verification and response |
|---|---|---|
| `POST /functions/v1/gridly-verify-apple-subscription` | platform=apple, productId=`com.gridlygo.gridly.monthly`, environment, nonce, evidence.signedTransactions (0–8 compact signed StoreKit transaction JWS strings, each at most 16,384 characters). | Use Apple's server-library signed transaction verification with configured Apple root trust, bundle ID, numeric App Apple ID and explicit environment; do not merely decode JWS. Verify product/type/app/signature/revocation/expiry. Query current App Store Server API subscription status for the verified transaction/original transaction chain and verify returned signed transaction/renewal data. Return the existing safe signed Gridly entitlement envelope; never return raw JWS, chain IDs or decoded customer data. |
| `POST /functions/v1/gridly-verify-google-subscription` | platform=google, productId=`gridly_monthly`, basePlanId=`monthly`, environment, nonce, evidence.purchaseTokens (0–8 unique native Play tokens, each at most 16,384 characters). | Call **`purchases.subscriptionsv2.get`**, fixed package `com.gridlygo.gridly`, token from private evidence. Check verified line-item product/base plan, state, expiry, revocation/replacement and test-purchase marker; claimed request environment is insufficient. Production rejects test results. Return the same signed safe Gridly contract. Do not use deprecated `purchases.subscriptions.get` for verification. |

No HTTP GET containing raw tokens is exposed to clients; Google API token paths are internal server requests with redacted logging. Body contents may contain sensitive store evidence and must never be logged, echoed, included in analytics or sent to unrelated services. Query/restore with an empty array does not by itself establish authoritative no-entitlement; return unknown unless trusted native store-query evidence and the verifier can establish absence. A missing cache row is never proof that a subscriber lost ownership.

Transport security prerequisite: use HTTPS, bounded/rate-limited native-origin requests, server challenges and native platform attestation/session proof to deter arbitrary copied-token replay. A transient attested installation key can be recreated after reinstall, independently of the store purchase. No public cache lookup by chain fingerprint, old installation ID or client-supplied `active=true`. Design/test platform attestation and replay controls before exposing these endpoints; no credentials or authentication infrastructure are created by this clarification. Store evidence remains the entitlement source, not the attestation key. Backend protected-data requests require the resulting short-lived verified session, without a Gridly login screen.

### Minimal private cache and reconciliation design — NOT applied

Private schema `subscription_ops`; one `store_entitlements` cache keyed uniquely by **platform + verified environment + store purchase-chain fingerprint**. Necessary columns: product ID, Google base plan where relevant, normalized state, period end, last store verification time, revision and acknowledgment state. Apple transaction/original-transaction references only as needed for status reconciliation; Google token encrypted at rest where needed for later `subscriptionsv2.get`, keyed fingerprint for uniqueness. Linked/replacement purchase-token references are private, bounded to operational necessity. No principal/consumer-account foreign key and no durable installation ownership field.

An optional private `store_events` table holds unique verified notification/event fingerprints and reconciliation revisions for idempotence, without raw event bodies. Native transport challenge/session state is short-lived operational state, not an entitlement owner registry. Transaction identifiers, fingerprints and tokens are sensitive identifiers, not anonymous data. Define minimum cache/event/token retention, secure deletion, backup/log handling and relevant Privacy disclosure before migration; no new community-report retention deadline is invented.

Proposed internal function `subscription_ops.apply_verified_store_result(...)` accepts only trusted verifier-normalized state and atomically upserts the unique store-chain row/revision; client JSON is never a writer. Optional internal `subscription_ops.read_store_cache(...)` is service-only and requires a store-evidence-verified context at the Edge layer. No public Data API entitlement lookup/RPC is added. Enable private-table RLS, revoke PUBLIC/anon/authenticated table/function access, grant only the necessary verifier service execution, assert exact grants and keep production/test keys/rows separate. Executable DDL/RPC SQL remains a later separately authorized implementation step.

### Refresh, recovery and completion

**Apple:** Launch and foreground enumerate StoreKit 2 `Transaction.currentEntitlements` and verified transaction updates silently. Explicit **Restore Purchases** calls `AppStore.sync()` and re-enumerates verified current/history evidence. Do not invoke intrusive sync automatically on every launch. After reinstall/new device, the store account supplies the purchase history again; no previous Gridly install ID, email, profile or snapshot is needed. Backend rechecks current chain state rather than trusting an old cached active transaction. Invalid/unverified transactions do not unlock. Finish valid transactions after durable reconciliation, including an explicit tested completion policy for valid expired/revoked results; do not confuse finish with granting access.

**Google:** Launch/resume use BillingClient `queryPurchasesAsync` for subscriptions; restore/recheck queries current Play-account purchases again. Send current tokens privately to verifier. Verify with `purchases.subscriptionsv2.get`; PENDING does not unlock. Persist an idempotent verified entitlement result and acknowledge the initial purchase using **`purchases.subscriptions.acknowledge`** if acknowledgment remains pending; the distinct acknowledgment API is intentional and is not the deprecated verification getter. Retry acknowledgment independently of app lifetime, reconcile linked tokens/replacements and prevent stale state from overwriting newer verified revocation. Do not consume a subscription. Reinstall/new device obtains the tokens again from the Play account; no old installation key is required.

Refresh at launch, foreground, explicit restore/retry and transaction updates. Server notifications (Apple Notifications V2 / Google RTDN) may invalidate cache once separately configured; never treat a notification as client ownership proof or require those integrations to be silently created here. Store reconciliation detects expiration/refund/revocation; canceled auto-renew remains entitled only until verified expiry. Unknown/store/network errors do not unlock and do not write a durable inactive/lockout flag. Restore/Retry and public assistance remain available, so a legitimate subscriber can recover without custom account recovery. Cache is subordinate to fresh provider truth.

Primary references: [Apple server-library verification](https://developer.apple.com/documentation/AppStoreServerAPI/simplifying-your-implementation-by-using-the-app-store-server-library), [StoreKit currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements), [Google subscriptionsv2.get](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get), [Google acknowledgment](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge).

### Native implementation choice and dependency review

Choose a **small first-party Capacitor 8 bridge**: Swift StoreKit 2 plus Kotlin Play Billing, exposing only lookup/purchase/query/restore/completion and safe lifecycle events. Existing custom Android plugin registration demonstrates the integration model. Current iOS floor supports modern StoreKit; native build/runtime compatibility still needs verification. This choice limits subscription surface and gives direct control of signed evidence, restore semantics and receipt/token redaction; it creates a real maintenance obligation for Gridly and is not claimed inherently safer without native tests.

Alternative reviewed: `cordova-plugin-purchase` (observed upstream master package version **13.18.0**, **MIT**) has maintained release history, store purchase/restore/query surfaces and a separate StoreKit 2 extension. These are positive maintenance/support signals, not proof of compatibility with this exact Capacitor 8.3.4 project. The extra adapter/extension, platform-version support and configurable receipt logging/validator path would need pinned-version code review and native compile/restore tests before adoption. No plugin installed or proposed as a dependency here; a final certified version would be pinned if this decision changes. [Package metadata](https://github.com/j3k0/cordova-plugin-purchase/blob/master/package.json), [releases](https://github.com/j3k0/cordova-plugin-purchase/releases), [StoreKit 2 extension](https://github.com/j3k0/cordova-plugin-purchase-storekit2).

| Criterion | First-party bridge decision / remaining proof |
|---|---|
| Maintenance | Small owned surface; Gridly must follow StoreKit/Play changes. External plugin has observable releases but adds adapter/extension lifecycle. |
| StoreKit 2 / Play Billing | Direct native APIs selected; exact supported Play dependency pinned only during implementation. |
| Restore/query | Silent current-purchase query on launch/resume, explicit restore; no auto-sync prompt or consumer login. |
| Verification surface | Native signed Apple evidence/private Play tokens into fixed verifier contracts; no client-only purchase truth. |
| Logging | No receipt/token logs; native/server redaction tests required. |
| Capacitor 8 | Existing custom plugin model fits; iOS registration/Kotlin/Swift compilation still unverified. Plugin Capacitor 8 suitability is not assumed. |
| Launch risk | First-party implementation/testing still substantial; foundation is not candidate-ready. No new SDK/service dependency added merely for convenience. |

## Launch access, onboarding and web design — not activated

Use one entry boundary **before protected scripts/data/subscriptions initialize**, rather than checks scattered across map/features or a removable late paywall overlay. Current DOMContentLoaded checkpoint is too late because app.js contains many self-starting hooks. Build a minimal ungated shell that hosts accepted onboarding, purchase/restore/retry and legal/support/deletion access; defer paid runtime loading until signed verification passes. Then recheck lease/period on foreground and before protected session continuation. Server endpoints/data delivery must enforce entitlement too; hiding buttons does not protect unrestricted data feeds or modified clients.

Preserve all seven onboarding pages and portrait assets. Education completion only advances to the bounded subscription step. Purchase controls display store-provided monthly price, applicable renewal/cancellation terms, Restore, Retry and independently accessible policy/support/deletion links. Unknown shows a verification-retry state; confirmed inactive/expired shows subscription required. No free skip. Canceled-before-expiry remains entitled until expiry; revocation/end-of-period denies. Long offline/transient failure cannot get free access, but retry/restore/support stay reachable and no durable local lockout flag is written.

`accessDecision` denies product access for web/unknown platform even with signed native entitlement; production runtime must use native-detected platform, not URL/local-setting spoofing. Keep `gridlygo.com` informational/legal site separate. Root web/PWA app runtime must deny paid entry and stop protected initialization/network work; no web checkout or web unlock. **Current app/PWA is not changed by this foundation and still lacks that enforcement.** This is an explicit paid-launch blocker, not a feature flag left as an approved free tier. Native/user-agent detection alone is not a security boundary; backend authentication/authorization is still required.

## Privacy and closure requirements

No receipts/tokens/full transaction payloads in UI, logs, report/device linkage, public RPCs or local settings. Native bridge/server memory may process raw verification material only for its dedicated purpose. Token encryption, purchase metadata retention, replay records, log redaction and request/deletion handling must be reviewed and synchronized with approved Privacy before operational deployment. Tests use ephemeral cryptographic keys and synthetic evidence in memory; no credentials generated for production.

Next work: (1) finalize store-owned verifier/cache and native request protection/schema/ACL contract; (2) provision store API verification credentials privately under separate infrastructure authorization; (3) implement server verifier/idempotent processing/signing; (4) implement/compile native StoreKit2 and Play adapters, transaction listeners and completion/acknowledgment; (5) wire pre-runtime paywall/onboarding/public surfaces and server access enforcement; (6) sandbox/test revoke/expiry/restore/reinstall/acknowledgment/end-to-end checks and real candidate/store configuration; (7) separately authorized release and reporting activation. No physical acceptance reopened or release build performed now.

## Verification and commit

Focused `tests/lp24461-subscription-entitlement.test.mjs`: **13/13 PASS**. Tests exercise real ephemeral ES256 signatures/tampering/wrong keys, state consistency, nonce/environment/product/audience/freshness, canceled expiry, unknown vs denial, restore/launch/resume calls, purchase pending/cancel, concurrency/timeout, public surface exceptions, web deny, safe product display and unchanged seven-page onboarding/dependency/reporting wiring. Store ports are test doubles only; these results are not store/server verification certification.

Existing bounded legal/publication tests remain relevant for public exceptions and 18+/subscription text. Before commit run those, `git diff --check`, exact scope and secret-pattern checks. No dependency install, Supabase mutation, native build, device testing, store change, push/merge or production reporting activation.

Commit: **Prepare subscription entitlement foundation**. Current release verdict: **NO-GO** until the explicitly listed native/server/gating prerequisites are implemented and verified. Foundation tests passing do not convert missing store integration into GO.

Final combined bounded run: 38/38 PASS (13 entitlement + 25 existing legal/public-site/compliance). Only the three named foundation files are added; existing runtime/native/dependencies/migrations/policy files have no diff.

## LP244.61A access and merge decision

Preserve accepted seven-page onboarding, then gate first protected entry. Verified active/canceled-before-expiry enters; confirmed inactive/expired shows purchase; unknown shows Retry/Restore without unlock or permanent lockout. Public Privacy/Terms/Guidelines/Support/Delete Data and emergency guidance never require payment. Production has no debug/local-storage unlock.

Exact future web enforcement: an informational/legal/paywall shell loads first; native platform detection rejects unsupported web/PWA before loading app.js or other protected initialization/data scripts. Keep public-site/ and its routes separate. Server protected endpoints independently require a short-lived verified native store session; user-agent/native flags alone cannot authorize data. Current root runtime is still not wired to this foundation, so actual web bypass closure remains a launch implementation prerequisite, not a reason to invent free access.

Architecture now coherently uses store-owned recovery without Gridly consumer accounts. Recommend merging the prepared foundation after this clarification review; this is not approval to deploy billing, apply migrations, create credentials, activate reporting or claim launch-ready subscriptions. Native/store/API verification and end-to-end restore/reinstall tests remain prerequisites. No production reporting or native behavior changed; LP244.54 remains CLOSED/PASS.

LP244.61A verification: 43/43 combined bounded tests PASS (13 shared entitlement, 5 store-owned contract/recovery, 25 existing legal/publication/compliance). Reinstall tests create fresh in-memory sessions with store-origin test evidence and no old installation/account state; they are contract/coordinator tests, not actual StoreKit/Play device proof. Store descriptor IDs are the single configuration source consumed by LAUNCH. Only the foundation doc/module/tests and new store request contract/tests change. No native dependencies, migration, auth system or production configuration added. git diff --check and credential-pattern checks precede local commit.
