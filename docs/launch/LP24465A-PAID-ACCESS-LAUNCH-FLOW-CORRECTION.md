# LP244.65A — Paid access launch flow and continuity decision

September 27, 2026. **Onboarding correction locally certified. Continuity policy awaits owner decision. Paid launch / merge NO-GO.**

## Authority and scope

Branch: `LP244.65-paid-access-entitlement-runtime`.
Starting HEAD: `5bf05b9ed895ef105fd2e0cd8a40c9c13621c5b7`; initial tree clean.
Owner LP244.65A supersedes the earlier entitlement-before-tour sequence and the claim that strict five-minute/offline denial was approved launch policy.
Only sequencing, public preference extraction, focused tests and analysis change here. No entitlement duration, store adapter, provider normalizer, proof signature/nonce contract or coordinator ownership changes.

## Four install cases

| Case | Sequence |
| --- | --- |
| A. First install, no entitlement | Launch → accepted seven pages → paywall → purchase or restore/check → authoritative entitlement and required store completion → protected Home |
| B. First install, existing store entitlement | Launch → accepted seven pages while silent lookup runs → Home if signed authority remains valid; otherwise recheck/paywall, no forced duplicate purchase |
| C. Returning, completed onboarding, active entitlement | Silent current verification → Home; no tour or purchase |
| D. Returning, completed onboarding, no entitlement | Paywall → purchase/restore/check → authoritative entitlement → Home; no repeated tour |

A signed result cannot interrupt first-install onboarding. Protected scripts remain inert while the tour is open, even for an entitled subscriber. Completion preferences determine tour presentation only; they cannot establish subscription ownership. Existing canonical completion and `profile.setupComplete` semantics remain. Existing legacy flags are cleared on completion as before.

The seven-page renderer, interactions, orientation, ZIP/town resolver, nearest-area selection and completion presentation are extracted from the accepted app source without rewriting their bodies. `css/styles.css` is unchanged. A build tool evaluates only public geography constants and pure expansion functions, never app startup. The static model contains 254 counties and 2,342 awareness areas; it preserves statewide resolver behavior. A source hash/equality test detects drift. The original app retains its accepted tour for Settings replay.

The pre-access adapter saves only a public area key, ZIP preference and bounded source label. Optional geolocation stays in memory and is handed to the existing setup path only after admission; no private coordinates persist in the new preference record. The original runtime callback applies the pending preference after protected startup. Its two-line bootstrap handoff suppresses a duplicate first-run tour. The handoff grants no access. Public Help & legal navigation is separate from the accepted seven-page contents and remains accessible during onboarding.

Only early presentation, subscription composition and the isolated onboarding module execute before admission. Maps, feeds, report runtime and the 80 governed classic modules do not load until current authority AND first-run completion are satisfied. Web/PWA remains denied without native store authority. Purchase, restore, localized pricing, transaction finish/server acknowledgment, fixed verifier selection and central lifecycle ownership remain unchanged.

## Evidence versus freshness

| Fact | Current contract | Meaning |
| --- | --- | --- |
| Provider period end | Apple verified `expiresDate`; Google current API `lineItems.expiryTime` → signed `currentPeriodEnd` | Upper bound on the previously verified period, not assurance of no later revocation |
| Signed authority | Pinned ES256 key; exact environment/product/audience; fresh request nonce; branded immutable result | Prevents native hints/plain objects/preferences becoming ownership authority |
| Proof freshness | Existing issuer and client contract permit at most 300,000 ms and never past the period end | Reverification deadline; NOT subscription expiration and NOT owner-approved continuity policy |
| Provider denial | Fresh verified expired/inactive state | Overrides earlier active evidence; no continuity after confirmed expiry/revocation |
| Transport failure | Unknown/temporarily unavailable, no fresh signed entitlement | Does not establish that the subscription expired |

**Previous five-minute disposition:** no replacement duration is selected. Existing LP244.61/62 cryptographic freshness mechanics remain intact as an unreleased contract, not an approved offline launch policy. LP244.65's description of that behavior as the launch policy is withdrawn. The present coordinator clears admission on reconciliation/failure and cannot yet satisfy the requested brief-outage continuity. That is explicitly a blocker, not a certified launch behavior. Release composition remains `publicKey:null, authority:null`; no production unlock or purchases are enabled by this work.

A verified period end can bound temporary continuity but is insufficient by itself to establish an acceptable revocation-detection window. A refund/revocation can terminate entitlement earlier. No code can learn a new server/store revocation while fully offline; the remaining interval is a product risk choice. Freshness expiration uses `verification_required`, never an expired-subscription claim. No billing grace promise is introduced.

### Apple

Current foundation combines provider-verified transaction/renewal and current subscription status, checks exact bundle/product/environment and period end, and treats revocation/status 5 as inactive even when the prior period end is future. User cancellation may remain entitled through the paid period. Native StoreKit evidence is input to server verification, not standalone runtime authority. Apple transaction delivery precedes exact finish and UI admission waits for finish.

Apple documents distinct subscription expiration and refund/revocation dates: [expiration](https://developer.apple.com/documentation/appstoreserverapi/expiresdate), [revocation](https://developer.apple.com/documentation/storekit/transaction/revocationdate). Thus an old expiration timestamp cannot prove present non-revocation. This is the technical inference behind the continuity decision.

### Google

Current foundation checks the current subscriptionsv2 state, exact U.S. product/base plan and environment, acknowledgment sequencing and expiry. Active/canceled subscriptions can remain entitled through their verified period; expired/hold/paused states deny. Pending/unknown or configured grace states do not acquire new authority. Linked replacement tokens remain a separately reviewed limitation. A native PURCHASED hint does not override signed denial.

Google documents current API status reconciliation, cancellation until expiry and immediate revocation: [lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions), [revocation](https://developer.android.com/google/play/billing/manage-purchases), [expiry field](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2). Store-managed retry/grace behavior is distinct from a Gridly offline window; this phase neither changes store configuration nor promises additional access or billing grace.

### Trust, restart and clocks

Current branded proof exists only in memory. LocalStorage flags, stored JSON, decoded receipts and native active hints are never authority. Restart loses the brand and nonce-bound session proof and therefore requires fresh reconciliation under the present code. A nonce-bound five-minute result cannot simply be replayed after restart as a longer offline authorization.

Any durable continuity design needs a separately reviewed, server-signed continuity contract tied to current store ownership, verification using a pinned key, tamper/replay resistance, safe retention and native storage, and clock rollback/restart behavior. A device wall clock alone is insufficient to enforce an extended signed deadline against rollback; memory-only continuity can use monotonic elapsed time in addition to a verified time anchor. Neither design can detect unseen offline revocations; never extend beyond verified period end, never extend repeatedly on failures, and always supersede old evidence with a fresh confirmed denial.

## Owner decision required: YES

Choose scope and acceptable maximum revocation staleness before implementing continuity:

1. **Memory-only bounded continuity:** while the same verified session remains alive, permit transient failure continuity until `min(verified period end, last verified time + owner-approved maximum staleness)`. Restart requires online verification. Smallest implementation; does not solve offline restart. Owner must choose the staleness limit; none is proposed as approved.
2. **Bounded continuity across restart:** same cap, backed by the reviewed durable signed/native-storage/clock/replay design above. Supports restart during outages; more implementation and certification. Owner must choose the staleness limit and authorize this persistence scope.
3. **Entire previously verified paid period:** cap at the verified period end without introducing a new numeric window. Can tolerate long outages, but an early refund/revocation may remain unseen for much of a month. Requires explicit owner acceptance of that risk and a choice of memory-only versus durable scope. Not selected by this implementation.

Recommended direction: choose bounded continuity and explicitly decide whether restart must work offline. The evidence cannot select a risk window for the owner. Strict online-only behavior remains an unreleased fallback, and does not meet the owner's brief-outage continuity requirement. No arbitrary duration or 24-hour backend cache TTL is adopted as client authorization.

## Certification and limits

- All focused LP244.65/65A tests plus Apple/Google bridge tests: **47 PASS, 0 failures**. Includes four browser install cases; seven-page source/model equality; inert tour/no protected requests; restore denial/purchase admission; future-period revocation; freshness versus expiration; transient unavailable; localized price; public bypass; web denial; redacted state and no reporting activation.
- Browser fixtures use installed Edge, loopback-only mock authority and ephemeral test signing keys. Protected app Home initialization is a controlled fixture: no claim of full native/store/device acceptance or actual live provider verification.
- Native packaging: **24 PASS**. Total: **71 distinct passing checks** (20 LP244.65/65A, 27 Apple/Google bridge, 24 packaging). JavaScript syntax, credential-pattern scan across all 13 changed files and `git diff --check`: **PASS**. No broad suite or native build/device acceptance runs.
- New module/model are explicitly packaged and cached. Preferences carry no entitlement; there is no query/debug/persisted ownership bypass.

## Remaining gates and invariants

Continuity owner decision and its later implementation/certification remain required. LP244.62 production verifier/key/transport/admission/cache composition, Google durable acknowledgment/replacement handling, configured store products, real candidate/native subscription acceptance and live app/PWA checks remain outstanding as recorded in LP244.65.

Production reporting remains disabled in the owner baseline; no production query or mutation was performed here. Existing report retention/RLS/guards/Cron and legal texts are unchanged. LP244.54 remains CLOSED / PASS. Old LP244.22 reset/repair must not be replayed. No deploy, push or merge.

Local commit subject: `Prepare paid access continuity policy`. **Onboarding correction PASS; paid launch and merge NO-GO pending continuity and remaining verifier/store gates.**
