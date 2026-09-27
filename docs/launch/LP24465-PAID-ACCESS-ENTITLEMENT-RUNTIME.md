# LP244.65 — Paid access / entitlement runtime integration

Date: September 27, 2026. **PREPARED / locally certified; paid production launch NO-GO.**

## LP244.65A superseding decision

The September 27 owner correction supersedes the original tour ordering and offline-policy claim below. See [LP244.65A](LP24465A-PAID-ACCESS-LAUNCH-FLOW-CORRECTION.md). First installs now complete the accepted seven pages before any paywall or protected runtime. Five-minute proof freshness is NOT owner-approved launch continuity. No replacement duration is selected; paid launch and merge remain NO-GO pending that decision and verifier/store gates.

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

Admission requires a branded LP244.61 ES256 authority result for the production environment, exact store product, fresh request nonce and current verification lease. Native hints, query flags, persisted values and plain objects cannot grant access. Delivery into volatile coordinator state precedes Apple transaction finish; UI admission waits for successful finish. Google authority remains contingent on the LP244.62 server acknowledgment ordering.

The admitted loader preserves the exact old script order and replays only DOMContentLoaded handlers registered during that load. It captures listener removal and aborted signals, restores the original listener methods even on failure, and never redispatches a global DOMContentLoaded event. Classic script load failures have a 15-second per-file budget. Runtime initialization is serialized with refresh work, and rechecks proof validity before each script and listener dispatch boundary. It initializes with real layout geometry beneath the opaque admission sheet.

On a later refresh, the app becomes hidden/inert until verification completes. A failed refresh or expired lease destroys initialized runtime through a fresh document reload, stopping old timers/feeds. Reload does not carry an entitlement flag or persisted proof. Partial startup failure stays blocked, with an explicit Reopen action; it never retries the partial script stack in place. Page exit disposes observers without interrupting legal navigation; a persisted back-forward document requires a fresh launch.

## Central coordinator and states

`js/gridly-paid-access.mjs` owns strict native platform selection, adapter choice, localized product lookup, launch/current query, refresh, purchase, restore, verification delivery, a volatile lease, safe state publication and lifecycle serialization.

| State | Admission / UI |
| --- | --- |
| initializing | Denied; bounded checking/purchasing/restoring copy |
| entitled | Current signed production proof and completed delivery; initialize or reveal runtime |
| not_entitled | Denied; subscribe or restore; cancellation has its own safe copy |
| pending | Denied; wait for store completion and recheck |
| unknown | Denied; invalid/missing authority requires retry/restore |
| temporarily_unavailable | Denied; retry/restore and public legal/support routes |
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

The original implementation clears admission on refresh/failure and limits proof freshness to five minutes. This was incorrectly described as approved launch policy. **That claim is withdrawn.** Freshness expiry means verification required, never subscription expired; only a verified provider decision establishes expiration/revocation. No replacement duration is implemented. The present strict behavior does not satisfy the owner-required transient continuity and remains an unreleased blocker.

Verified period end supplies a hard ceiling, but early revocation makes maximum staleness and restart persistence an owner decision. See LP244.65A for memory-only bounded continuity, durable bounded continuity and full-period risk options. The LP244.62 proposed 24-hour backend cache retention is not client access authority. Existing operational timeouts are unchanged.

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

## Certification

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

**Preparation PASS; LP244.65 paid-launch NO-GO.** The central coordinator, fail-closed candidate gate, admission UI, lifecycle and packaging are locally certified. Missing production verifier/native-admission/cache/acknowledgment operations prevent live purchases, verification and paid-runtime acceptance. No entitlement or reporting activation is claimed.

LP244.54 remains CLOSED / PASS. Old LP244.22 reset/repair must not be replayed. No production state, billing products, native app configuration or public website changed; no deployment, push or merge performed.
