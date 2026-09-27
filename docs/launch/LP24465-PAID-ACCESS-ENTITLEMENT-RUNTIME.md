# LP244.65 — Paid access / entitlement runtime integration

Date: September 27, 2026. **LP244.65 paid-access continuity foundation CLOSED / PASS (LP244.65J); paid production launch NO-GO.**

## LP244.65A superseding decision

The September 27 owner correction supersedes the original tour ordering and offline-policy claim below. See [LP244.65A](LP24465A-PAID-ACCESS-LAUNCH-FLOW-CORRECTION.md). First installs now complete the accepted seven pages before any paywall or protected runtime. The owner subsequently approved OPTION 2: durable continuity across ordinary app restart for at most 24 hours from successful verification, capped by verified period end. It is implemented and continuity-certified under LP244.65J; the iOS G host-boot qualification and separate production verifier/store gates remain. Five-minute response freshness remains separate.

## Source and scope

- Branch: `LP244.65-paid-access-entitlement-runtime`.
- Starting HEAD: `9f9b76e9c770b18aa985817f4af51580cd240977`; initial tree clean.
- Authority: owner LP244.65 request and merged LP244.61–64 foundations.
- Launch: U.S., 18+, $2.99/month through Apple App Store / Google Play. No free tier, trial, annual plan, grace period, direct checkout or alternative billing.
- Apple product: `com.gridlygo.gridly.monthly`. Google product/base plan: `gridly_monthly` / `monthly`.
- No production operation, deployment, store configuration, native build/sync, device acceptance, push or merge performed.
- Local commit subject: `Prepare paid access entitlement runtime`, because production verification composition remains unavailable.

## Startup audit and gate

Previously, 80 classic external scripts executed before app.js's DOMContentLoaded bootstrap. Their side effects included protected runtime services before the accepted first-run tour. The gate now precedes this complete stack, including its inline configuration, prepaint and diagnostic-loader code. Only the presentation-only early theme script and paid bootstrap execute initially.

`index.html` holds the old scripts inert (`application/gridly-protected`, external URLs in `data-gridly-source`). The paid bootstrap imports the central coordinator and admission UI. Unsupported browsers never execute Leaflet, app.js, provider modules or report runtime. Import/composition failure leaves protected scripts inert and legal links reachable.

Admission requires a branded LP244.61 ES256 authority result for the production environment, exact store product, fresh request nonce and current verification response, or the separately validated owner-approved durable continuity authorization during temporary outages. Native hints, query flags, persisted values and plain objects cannot grant access. Delivery into volatile coordinator state precedes Apple transaction finish; UI admission waits for successful finish. Google authority remains contingent on the LP244.62 server acknowledgment ordering.

The admitted loader preserves the exact old script order and replays only DOMContentLoaded handlers registered during that load. It captures listener removal and aborted signals, restores the original listener methods even on failure, and never redispatches a global DOMContentLoaded event. Classic script load failures have a 15-second per-file budget. Runtime initialization is serialized with refresh work, and rechecks proof validity before each script and listener dispatch boundary. It initializes with real layout geometry beneath the opaque admission sheet.

On a later refresh, a valid signed continuity authorization preserves admitted runtime during temporary verification failure; confirmed denial immediately removes access. Without valid authority, the app becomes hidden/inert and failed re-verification destroys initialized runtime through a fresh document reload. Partial startup failure stays blocked, with an explicit Reopen action; it never retries the partial script stack in place. Page exit disposes observers without interrupting legal navigation; a persisted back-forward document requires a fresh launch.

## Central coordinator and states

`js/gridly-paid-access.mjs` owns strict native platform selection, adapter choice, localized product lookup, launch/current query, refresh, purchase, restore, verification delivery, volatile fresh authority plus native signed continuity, safe state publication and lifecycle serialization.

| State | Admission / UI |
| --- | --- |
| initializing | Denied; bounded checking/purchasing/restoring copy |
| entitled | Current signed production proof and completed delivery; initialize or reveal runtime |
| not_entitled | Denied; subscribe or restore; cancellation has its own safe copy |
| pending | Denied; wait for store completion and recheck |
| unknown | Denied; invalid/missing authority requires retry/restore |
| temporarily_unavailable | Denied only without valid continuity; otherwise entitled with temporary-access copy and prompt retries |
| unsupported_platform | Denied; native-store availability notice and public links |

UI state excludes proof, nonce, receipts, purchase tokens, transaction handles, device identifiers and raw provider errors. The coordinator does not use either store adapter's `start()` method: it owns one pair of native event listeners and native observation, avoiding two independent refresh owners. Startup is idempotent; foreground and transaction/purchase events coalesce while refresh is outstanding. Explicit operations are serialized. Observer setup is bounded; late listeners are removed after timeout/stop.

## Accepted onboarding and paywall

The accepted seven-page renderer and resolver bodies are copied without changes into an isolated presentation/preferences module, with public geography generated from the accepted source. The original app tour remains for replay; only its bootstrap gains a preference handoff to prevent duplicate first-run presentation.

**Current sequence:** first install → accepted tour → paywall if needed → authoritative entitlement → Home. Existing store entitlement can be looked up silently but never interrupts the first-install tour. Returning completed subscribers verify into Home without purchasing; returning non-entitled users see the paywall. Preferences cannot establish entitlement. See LP244.65A four-case tests. LP244.54 remains CLOSED / PASS.

Portrait admission uses Gridly branding and Know Before You Go, a monthly subscription, store-returned localized price when available and $2.99/month canonical fallback. It names the relevant store, automatic renewal subject to store terms and cancellation through store settings. Restore/Check Purchase and Retry are obvious. No refund/trial/annual/direct-billing promises are added. Unsupported web hides purchase controls and pricing; the public website does not acquire a paywall. Short portrait views scroll with legal/deletion links reachable.

## Store and recovery flows

Apple: selected native GridlyStoreKit plugin → verified StoreKit evidence → fixed verification authority → shared signed proof validation → volatile delivery → exact transaction finish → admission. A finish failure denies admission. Restore uses user-initiated StoreKit sync; launch/foreground checks are silent.

Google: selected native GridlyPlayBilling plugin → current/purchased token → fixed server verification → cache/reconciliation and required server acknowledgment → signed proof validation → volatile delivery → admission. Client/native code never acknowledges or consumes a subscription. Already-owned recovery and pending/cancellation mapping retain LP244.64 behavior.

There is no Gridly consumer login, account ownership table or old installation-ID recovery dependency. Raw store evidence is transient within the existing bounded adapters and authority handoff, never published to UI/storage/logs.

## Offline and temporary failures

Owner-approved OPTION 2 is implemented: previously server-verified ACTIVE subscription authority may survive an ordinary app restart and brief native/store/backend outage until the earlier of last successful verification + 24 hours or verified period end. The separate five-minute nonce-bound response still requests prompt re-verification; its staleness does not mean subscription expiry. Only authoritative ACTIVE verification renews the durable window. Signed provider expiry/revocation/denial, authenticated endpoint denial and Apple verified revocation override it immediately. No local/native active hint or repeated failure extends it.

Apple scoped non-synchronizing device-only Keychain plus a non-backed-up reinstall sentinel, and Android authenticated Keystore encryption in noBackupFilesDir, hold the signed authorization. Pending verification barriers, attempt handles and binding rotation prevent interrupted writes/old grants from restoring authority. LocalStorage and installation IDs never prove ownership. Clock rollback or OS reboot requires fresh verification; ordinary same-boot app restart is supported. The new native plugins require real compile/platform certification. Details and exact fields are in LP244.65A.

Outages retry once per minute within bounds; foreground/store events and connectivity restoration trigger coalesced refresh. Invalid/stale continuity requires verification, never an expired-subscription claim. Public routes remain open. The 24-hour backend cache retention remains separate from client authorization; no billing grace is promised.

## Public routes and PWA

Privacy, Terms, Community Guidelines, Support and Delete Data are directly accessible without entitlement. Native legal documents remain bundled; support/deletion use the established public routes. Marketing `public-site/` is unchanged.

The service-worker closure cache gets a new name and the admission module assets; recognized older Gridly shell caches are removed on activation. Its existing app/reporting compatibility version remains aligned with unchanged app.js. A cached shell or localStorage value cannot grant native or browser access. The manifest distinguishes executable bootstrap from the unchanged protected startup stack. Native packaging continues its explicit allowlist, vendor replacement and submission-order/version checks.

Direct HTTPS retrieval of `gridlygo.com` and `preview.gridlygo.com` was unavailable in this environment (both web retrieval and direct HTTP attempts). This is not evidence that either page is down. Repository evidence proves marketing separation and local browser tests prove candidate web denial. **The candidate has not been deployed; live application-origin/PWA/cache-upgrade verification remains outstanding.** No additional current app origin is established by the repository Capacitor configuration; native packaging uses bundled `www`.

## Production composition and launch blockers

`js/gridly-paid-config.mjs` deliberately supplies no public verification key or authority transport. It obtains only the registered Capacitor plugin; no global/storage/query fixture can supply entitlement authority. Therefore actual production admission remains unavailable, and purchases cannot be initiated through an uncomposed verifier.

Separate authorized work is required for:

1. LP244.62 production provider composition: official Apple signed verifier/API client and roots, owner-managed Apple credentials; Google Play API identity/OAuth; exact production environment binding.
2. Native admission/challenge/replay/rate controls; fixed verification transport; pinned public verification key; separately protected proof signing and HMAC keys. No credentials in Codex or client bundles.
3. Owner-reviewed private cache migration/RPC transport, grants, 24-hour cleanup/health operation and operational certification. No migration was applied here.
4. Durable Google acknowledgment retry/health and replacement-token policy. Existing hash-only cache cannot reconstruct raw purchase tokens for autonomous retry; native resume/restore alone does not close this deadline risk.
5. Real Apple/Google store products and test-store access. Apple preconfiguration is historical owner evidence; Google configuration follows a real billing release artifact, never a placeholder upload.
6. Configured gate packaging, real provider verification, supported native candidate build/compile, subscription UI/device acceptance and deployed direct-app/PWA regression checks. Subscription acceptance is separate from closed LP244.54.
7. Later owner-only reporting activation after the remaining launch gates. Reporting remains disabled in the owner baseline; this phase has no activation path and makes no fresh production query claim.

Existing report/privacy RLS and retention deadlines are unchanged. The client startup gate does not introduce a new server data-authorization contract or claim to prevent a modified client from reading already-public data.

## Original LP244.65 certification (historical)

- Focused coordinator tests: Apple/Google selection, signed admission/denial, unknown/transient/pending/cancellation, exact Apple finish ordering, restore/reinstall, coalesced events, bounded observer cleanup, current-proof startup serialization and five-minute lease behavior.
- Isolated installed-Edge browser test: unsupported/query/storage/native-hint denial, no protected script requests, localized price, 390×844 and 320×568 portrait structure, legal navigation, ordered admitted classic scripts, listener removal, no global event replay and revocation during load. No actual native/store/device acceptance or live provider calls.
- Existing LP244.63/64 tests: 27 passed, including iOS source contracts and server handoff/ack behavior.
- Existing native packaging contracts: 24 passed. Current protected-stack assertions are updated in LP244.30A, LP244.33, LP244.51A and LP244.53 without weakening the order/drift checks.
- Native staging/version certification uses isolated temporary outputs, synthetic provider configuration and current source bytes. No canonical/generated native app assets are staged into Git.
- Final focused coordinator/browser tests: 15 passed. Existing bridge tests: 27 passed; native packaging: 24 passed; isolated configured staging/version/drift tests: 3 passed; selected existing manifest/compliance/diagnostic contracts: 5 passed. Total: 74 distinct passing checks, no failures. The expected negative staging check rejects a deliberately corrupted bundle identity report.
- JavaScript syntax, credential-pattern scan across all 17 changed files, and `git diff --check`: PASS before commit.
- Full protected-app startup with real store/server authority is not certified; the local browser checks exercise denial and the admitted legacy loader in isolation. Configured native candidate and real subscription acceptance remain launch blockers.
- Native Swift/Kotlin/registration/dependency sources unchanged; Android/Swift compilation not rerun for JS-only composition. Later configured candidate preparation/compile and device work remain required.

## Conclusion

**Local continuity implementation PASS; LP244.65 paid-launch NO-GO.** The central coordinator, fail-closed candidate gate, admission UI, lifecycle and packaging are locally certified. Missing production verifier/native-admission/cache/acknowledgment operations prevent live purchases, verification and paid-runtime acceptance. No entitlement or reporting activation is claimed.

LP244.54 remains CLOSED / PASS. Old LP244.22 reset/repair must not be replayed. No production state, billing products, native app configuration or public website changed; no deployment, push or merge performed.

## Current owner-approved continuity implementation and certification

## Implemented contract

The five-minute ES256, nonce-bound verification response remains a freshness/reconciliation contract. It is not subscription expiry. An optional separately signed `gridly-continuity-v1` authorization is included inside that verified response. Durable expiry is exactly:

`min(last authoritative verification + 86,400,000 ms, verified currentPeriodEnd)`.

Only freshly provider-verified ACTIVE evidence mints durable authority, after private cache reconciliation and required Google acknowledgment. Successful verification replaces the authorization and resets its window from that verification time. Cached evidence, local/native active hints, transport errors and retry attempts never mint, renew or extend it. Cancellation with paid time remaining retains existing fresh-entitlement semantics but does not mint a new ACTIVE continuity grant.

Signed fields: platform, exact product, entitlement state, subscription state, lastVerifiedAt, currentPeriodEnd, continuityExpiresAt, environment, audience, verificationSource and vault binding. Client verification pins ES256/P-256 key and exact token type/field set, validates production environment, active/entitled state, fixed product/audience, binding and exact deadline. Malformed, unsigned, wrong-key/type/platform/environment, overlong and tampered proofs fail closed. Public metadata is not enough: validated objects are branded in memory; decoded JSON cannot acquire authority.

`continuityBinding` is an optional bounded random native-vault context in the existing fixed verification request. It is covered by the native authorizer's body digest and signed only AFTER actual store ownership verification. It is not an installation ID used as ownership or recovery authority. No provider lookup or purchase grant is derived from it. Fixed Edge responses remain `{proof}`; no new public cache endpoint, database grant, migration or production operation.

## Native persistence and replay boundary

**Apple:** a dedicated `GridlyContinuity` Capacitor plugin stores one scoped generic-password Keychain record, with `AfterFirstUnlockThisDeviceOnly`, synchronization disabled and no shared access group. A non-backed-up Application Support sentinel is required before reading any retained Keychain record. Its absence deletes ONLY this plugin's scoped record and creates new vault binding: Keychain survival across uninstall cannot recover entitlement. The sentinel is not a purchase flag. Apple Keychain accessibility and backup behavior: [Apple documentation](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly), [backup exclusion](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup).

**Google:** one AES-256-GCM encrypted/authenticated record under `noBackupFilesDir`, using a non-exported AndroidKeyStore key and authenticated scope data. AtomicFile and a serialized mutex protect updates. Uninstall removes app state; backup/transfer cannot supply the record. Existing `allowBackup=false` remains unchanged. [Android Keystore](https://developer.android.com/privacy-and-security/keystore), [non-backup files](https://developer.android.com/reference/android/content/Context#getNoBackupFilesDir()), [AtomicFile](https://developer.android.com/reference/android/util/AtomicFile).

No new dependency, account, receipt/token cache, customer linkage, coordinates or raw store-evidence logging. Server signing keys are never on the client. The vault holds the bounded server authorization and clock/replay bookkeeping only. This assumes the supported unmodified OS/app sandbox; it does not claim protection against a rooted/jailbroken or modified client.

Before each verification, native `beginVerification` atomically persists a pending barrier BEFORE any provider/backend request and returns an attempt handle, binding and previously eligible record. A completed unavailable result may retain the previous record without changing last verification or expiry. Success commits the new signed authorization only AFTER adapter delivery/Apple exact finish. Confirmed denial clears the record and rotates binding. Failed/uncertain writes or an interrupted attempt leave the barrier pending; restart cannot resurrect old authority. Old attempt handles cannot commit a new operation. Old proof copied after revocation/reinstall cannot match the new binding. Native persisted verification time cannot move backward. Raw signed records never enter public UI state.

## Clock and restart behavior

Ordinary app restart in the same OS boot reloads and re-verifies the signature against the pinned key and current vault binding, then attempts fresh store/server reconciliation. If unavailable, valid continuity may admit Home. Neither preference storage nor an old installation identity participates in ownership recovery.

Native clocks use a UTC high-water anchor plus sleep-inclusive elapsed time: Android `elapsedRealtime` and boot count; Apple `mach_continuous_time` plus kernel boot-time identity. Accepted continuity advances the clock bookkeeping without advancing signed verification time. In-process checks use a monotonic anchor and wall time; deadlines are scheduled and checked before protected initialization. Clock rollback, changed/unavailable boot identity, missing/corrupt/locked storage or interrupted verification deny continuity. **Offline access after an OS/device reboot is conservatively unavailable until fresh authoritative verification**; this is distinct from ordinary app restart and avoids inventing trusted elapsed time across reboot. Fresh valid verification can establish a new clock anchor. Forward clock anomalies can deny early, never extend authority.

OS Keychain/Keystore integration and these clock assumptions still require native compile and real-platform restart/reinstall/sleep/clock checks. Windows fixture/source certification is not physical native acceptance.

## Denial and transient behavior

Confirmed signed expiration, inactive/revoked provider result or authenticated endpoint 401/403 denial immediately removes current access and invalidates continuity. Apple StoreKit's cryptographically verified revoked transaction flag signals immediate denial even when the backend is unavailable. It cannot grant access. Google signed/API-backed denial overrides the native PURCHASED hint. Invalid authority cannot fall back to old cached authority.

A brief native/store/backend outage may use only a valid prior durable grant. The central coordinator preserves initialized runtime during such rechecks, publishes temporary-access copy and retries at most once per minute while the authorization remains valid. Foreground/store updates and restored connectivity trigger prompt coalesced refresh. No intentional wait until the 24-hour deadline. At 24 hours or period end, authority stops and the state requests verification; this is NOT a declaration that the subscription itself expired. No valid authorization means no protected access. Retry/Restore and public legal/support/deletion routes remain.

## Launch sequence and invariants

- New install: unchanged accepted seven pages → paywall if needed → purchase/restore → authoritative entitlement → Home. Existing store entitlement never interrupts the first-install tour.
- Returning completed subscriber: current authoritative verification where available, otherwise valid continuity during temporary unavailability → Home without duplicate purchase.
- Returning expired/invalid continuity: verification required; signed non-entitlement leads to paywall.
- Reinstall: new vault binding and no offline recovery; StoreKit/Play evidence → server verification → new authorization. No Gridly account required.
- Browser/PWA: no native authority/persistence admission; remains denied. Privacy, Terms, Guidelines, Support and Delete Data remain public.
- Store billing and localized price remain unchanged. No trial, free tier, annual plan, direct billing or billing-grace promise is added.
- Reporting remains disabled in the owner baseline. No fresh production query/mutation, deployment, store setup, push or merge. LP244.54 remains CLOSED / PASS; old LP244.22 reset/repair must not be replayed.

## Local certification

Focused run: **125 tests PASS, 0 failures**: 30 new continuity checks; 67 entitlement/server/Apple/Google/coordinator checks; four browser/onboarding/source checks; 24 native packaging contracts. Includes both stores' restart/24-hour/period cap/renewal/denial/reinstall, unsigned/tampered/sandbox/overlong/replayed-context denial, interrupted/persistence failures, clock rollback, public bypass, protected gating and reporting invariant.

Browser tests use installed Edge and loopback fixture authority; native tests use explicit isolated vault ports plus source/registration contracts. No real store/provider/production calls. No native build/sync or device acceptance was performed. JavaScript syntax, changed-file credential scan and `git diff --check` are required before commit.

## Remaining launch/merge gates

LP244.65 paid-access continuity foundation is now CLOSED / PASS under LP244.65J owner-observed Android/iOS evidence, with the explicit iOS G host-reboot qualification. Paid production remains **NO-GO**: production composition still has no pinned public key or authority transport; default verifier entrypoints remain unavailable. Remaining separate gates: LP244.62 provider/native admission/cache composition and operational approval, durable Google acknowledgment/replacement handling, store products/provider credentials, real purchase/live-store restore and subscription/candidate acceptance, store review and app/PWA deployment/release checks.

No production activation is implied by this local commit: `Finalize paid access continuity policy`. Merge remains a separate owner action after review of remaining composition/release gates; it is not authorized by this certification closure.

## LP244.65H — Android native continuity certification status

2026-09-27 owner-provided runtime evidence: **ANDROID NATIVE CONTINUITY CERTIFICATION A-H: PASS** in the separate synthetic `com.gridlygo.continuitycert` API 36 emulator app. A/F prove encrypted persistence/reload and temporary admission after ordinary process restarts; B–E deny stale, expired-period, tampered and sandbox authority with zero protected initializations; G denies pre-reboot continuity; H denies after uninstall/reinstall of the same APK without seeding. The production Android numeric-reader repair at `5f4fe58c8942b3da9c3e34f0cdc168216a1fcbde` is runtime-certified for this bounded path.

iOS native continuity certification remains **PENDING**. LP244.65 is **not fully closed** and paid production remains **NO-GO**. See [the authoritative native certification record](LP24465C-NATIVE-CONTINUITY-CERTIFICATION.md#lp24465h--owner-observed-android-native-continuity-closure) for exact observations, scope and earlier harness repairs. Android-pending statements above describe earlier certification stages and are superseded by this result; iOS runtime, real store purchases, production verifier deployment/credentials/composition and launch acceptance remain separate gates. No runtime/policy/configuration change in this documentation phase. Reporting remains disabled by the repository contract and owner baseline; no fresh production query or mutation. LP244.54 remains CLOSED/PASS; old LP244.22 reset/repair must not be replayed.

## LP244.65J — Current continuity closure

**LP244.65 paid-access continuity foundation: CLOSED / PASS.** Android A–H PASS; signed iOS simulator A–F/H PASS. iOS Case G was not separately runtime-induced because that would require a Mac host reboot; implementation and focused contract coverage remain in place. See [the authoritative combined runtime evidence and signing RCA](LP24465C-NATIVE-CONTINUITY-CERTIFICATION.md#lp24465j--paid-access-continuity-foundation-closure). Earlier native-continuity pending/compilation requirements above describe prior phases and are superseded by this closure. iOS unsigned Keychain failure was certification-only; no production iOS defect proven. Android numeric repair is runtime-certified. Real store purchase/restore, production verifier/provider credentials/composition/Google acknowledgment, store review and release/activation remain separate gates. No merge, production subscription/reporting activation or deploy. LP244.54 remains CLOSED/PASS; preserved Mac stash untouched.
