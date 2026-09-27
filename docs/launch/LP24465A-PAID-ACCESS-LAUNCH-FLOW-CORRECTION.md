# LP244.65A — Paid access launch flow and continuity decision

September 27, 2026. **Onboarding correction and owner-approved 24-hour restart continuity locally certified. Paid launch / merge NO-GO pending native/platform and production composition gates.**

## Authority and scope

Branch: `LP244.65-paid-access-entitlement-runtime`.
Starting HEAD: `5bf05b9ed895ef105fd2e0cd8a40c9c13621c5b7`; initial tree clean.
Owner LP244.65A supersedes the earlier entitlement-before-tour sequence and the claim that strict five-minute/offline denial was approved launch policy.
The original sequencing correction is preserved. The subsequent owner decision authorizes durable 24-hour continuity, native secure persistence, adapter denial propagation and server/client signing integration. The five-minute freshness and provider normalizers remain separate and unchanged.

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

## Subsequent owner decision — resolved

OPTION 2 is selected: at most 24 hours from successful authoritative verification, never past verified period end, surviving ordinary app restart. Earlier undecided options and strict-offline fallback are superseded.

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

Owner continuity policy is now resolved and implemented locally. Paid production remains **NO-GO**: production composition still has no pinned public key or authority transport; default verifier entrypoints remain unavailable. LP244.62 provider/native admission/cache composition and operational approval, durable Google acknowledgment/replacement handling, store products, native vault compilation and real platform security/restart/reinstall/clock certification, real subscription/candidate acceptance and app/PWA deployment checks remain.

No production activation is implied by this local commit: `Finalize paid access continuity policy`. Merge recommendation: **NO-GO until the new native vaults are compiled/certified and remaining composition gates are reviewed.**
