# LP244.64 — Google Play Billing native bridge

## Decision / starting proof

- Branch: `LP244.64-google-play-billing-native-bridge`.
- Starting HEAD: `e83c41bdb2a0ad026fdc3aff922fdd23279a0d95`; working tree initially clean.
- Repository: `C:\GitHub\liberty-county-map`; date September 27, 2026.
- **Windows implementation/compile/contracts: PASS. Live Play purchase/paid launch: NO-GO.**
- Commit: `Implement Google Play Billing native bridge`, because Android compilation and bounded contracts pass. This does not certify real Play transactions or authorize upload.

No Apple StoreKit/iOS, shared entitlement contracts, Supabase backend/migrations, package.json/lock, onboarding, runtime startup, paywall or reporting protocol changed. No production query/mutation, credential creation/deployment, artifact upload, store submission, device acceptance, push or merge occurred. Reporting remains disabled by the inherited baseline; no fresh live-state claim. LP244.54 remains CLOSED/PASS; old LP244.22 reset/repair must not be replayed.

## 1. Existing Android audit

Before patching, Android had no BillingClient/Google billing dependency or plugin. Existing first-party `GridlyGeolocationPlugin.kt` uses Capacitor Plugin/PluginMethod/CapacitorPlugin and MainActivity registers it before super.onCreate. The billing plugin follows that pattern and registers alongside geolocation without changing its behavior.

Toolchain: Capacitor 8.3.4; Kotlin 2.2.0; Gradle wrapper 8.14.4; AGP 8.13.1; JDK 21.0.12; compile/target SDK 36; min SDK 24; Java/Kotlin JVM target 1.8. Existing AndroidX appcompat 1.7.1, core 1.17.0 and splashscreen 1.0.1 remain unchanged. Package remains `com.gridlygo.gridly`. Existing MainActivity text zoom adjustment is untouched.

Native staging is governed by tools/native-web.mjs and prepare:native builds/verifies configured web assets. Three isolated modules are added to the asset allowlist, not the startup/consumer manifest: new Google coordinator plus existing shared entitlement/store-verification modules. Native source registration is compiled, but no configured web restaging or Capacitor sync is needed/run for this phase. Generated assets/APK remain ignored and are not committed.

## 2. Library and plugin

Pinned Maven dependency: **`com.android.billingclient:billing:9.1.0`**, the current version identified in [Google's release notes](https://developer.android.com/google/play/billing/release-notes). It resolved through the project's existing Google Maven repository and Gradle cache; no global installer, alternate SDK, npm dependency or lock change was used. No KTX wrapper is needed for this callback-based bridge.

`android/app/src/main/java/com/gridlygo/gridly/GridlyPlayBillingPlugin.kt` exposes:

| Method | Purpose |
| --- | --- |
| `getProducts` | Current billing country and fixed subscription ProductDetails |
| `purchase` | Fresh approved ProductDetails → launchBillingFlow → safe purchase result |
| `queryCurrentPurchases` | Silent queryPurchasesAsync for SUBS |
| `restorePurchases` | Silent recheck of current Play purchases |
| `refreshEntitlement` | Same current purchase query |
| `startObserving` / `stopObserving` | Opt-in safe update/foreground signals |

BillingClient is created lazily only on a requested billing operation. Connection setup has one in-flight attempt, an eight-second timeout and at most eight waiting calls. Disconnection resolves pending setup/purchase calls with a bounded category; next explicit request may reconnect. No automatic repeated reconnect/retry loop. Activity destruction cancels retained call timers, resolves pending calls and ends the connection. Native purchase result wait is capped at two minutes, with one purchase flow at a time.

Purchase update/foreground/disconnection events expose only fixed reason strings. Tokens and raw BillingResult/debug messages are never sent in events. The coordinator listens to purchase/foreground signals only after explicit start; import is inert.

## 3. Product/base-plan contract

Canonical package `com.gridlygo.gridly`, product `gridly_monthly`, base plan `monthly`. Query only that SUBS product. Require current billing country US; one returned product; one subscription option with that base plan and no offerId; one USD, positive-price, P1M infinite-recurring pricing phase; nonempty internal offer token. Trial/free/annual/introductory/prepaid/ambiguous offer structures fail safely. ProductDetails is queried fresh before purchase and never kept as a long-lived price/purchase authority.

Display name, formatted price and currency come from Play. The bridge does not replace a differing price with $2.99. UI-facing metadata drops the private offer token. Approved owner/store launch is still $2.99/month; differing live metadata requires owner/store reconciliation before release. There is no hardcoded purchase UI or paywall activation.

Native purchases must have the exact package and single canonical product, PURCHASED state, and a bounded nonempty token. PENDING, cancellation, already-owned, unavailable, disconnected and malformed results have bounded paths. The native `basePlanId` is the expected contract value, not proof that Purchase independently exposes/validates the purchased base plan; the backend validates actual line-item offerDetails.basePlanId using subscriptionsv2.get.

## 4. Server handoff / final authority

`js/gridly-google-play-billing.mjs` provides opt-in `createGooglePlayBilling` and fixed `createGoogleVerificationAuthority` composition. Future trusted composition registers `registerPlugin('GridlyPlayBilling')` from existing Capacitor core and supplies the proxy, platform, explicit environment, pinned public signing key, native-admitted invoke port and delivery port. None are automatically configured by this commit.

Only `gridly-verify-google-subscription` is invoked with fixed product/base plan, platform, explicit environment, fresh nonce and one `purchaseTokens` entry. Empty current evidence is not a backend-confirmed denial and does not unlock access. Client Native PURCHASED/isAcknowledged flags cannot grant entitlement.

The LP244.62 backend independently calls **purchases.subscriptionsv2.get**, verifies package/product/base-plan/current status/expiry/region/test marker, privately reconciles the cache and, when necessary, acknowledges before signing its bounded proof. This phase does not change that backend or use deprecated purchases.subscriptions.get. Production entrypoints still return HTTP503 until actual native security/provider/cache/signing ports exist. A focused test calls the real default handler and proves no delivery/unlock.

The coordinator verifies the signed proof against the shared LP244.61 nonce/audience/product/platform/environment/expiry lease checks, then calls a trusted service-delivery port. Missing delivery port denies. The callback must honor its `isCurrent` guard before committing runtime effects. No final runtime paid gating is implemented here; that remains LP244.65.

## 5. Acknowledgment sequence and retry boundary

Sequence: native purchase token → current server verification → durable private cache reconciliation → required server acknowledgment → signed entitlement proof → service delivery. This matches the existing LP244.62 contract: the cache records verified entitlement before acknowledgment, while runtime delivery waits for a successfully verified signed response.

Acknowledgment belongs exclusively to the server's distinct purchases.subscriptions.acknowledge path. Native code does not call acknowledgePurchase or consumeAsync, and cannot hide a failed reconciliation through a local fallback. Provider state determines whether acknowledgment is required; already acknowledged results avoid an unnecessary acknowledgment call.

Synthetic certification runs the actual LP244.62 handler with a first acknowledgment failure, then a current-purchase restore retry for the same token. Failure returns no signed authority or delivery; recheck verifies/reconciles/acknowledges again and succeeds without another purchase. Existing SQL cache retries remain idempotent. This proves retry ordering, not a durable background retry service or live Google idempotence.

[Google requires timely acknowledgment of new purchases](https://developer.android.com/google/play/billing/integrate), otherwise refund/revocation may occur. **Durable retry/monitoring is still a launch blocker.** LP244.62 stores only a private token fingerprint and cannot reconstruct a token for autonomous retry; native restore/resume alone is not certified to meet the deadline when the app closes or the device is offline. A separately approved privacy-bounded token/retry or provider-notification architecture and real-store acknowledgment certification remain required. No indefinite token store or background infrastructure is invented here.

## 6. Current purchase, reinstall and lifecycle

Launch silently queries current subscription purchases and reconciles. Restore/Check Purchase uses the same Play query, without old Gridly installation state or a consumer login. Already-owned purchase attempts recheck current purchases instead of launching another purchase. Expired/canceled/paused/revoked decisions come from current server state; native evidence is insufficient. Cancellation before verified period end stays entitled only until that deadline.

Start is idempotent; resume/update signals coalesce while a refresh is outstanding. All explicit operations are serialized, and there is no timer-driven refresh loop. Stop removes listeners and invalidates access. Provider work has a fifteen-second response budget; store purchase interaction allows two minutes. Late/forged responses cannot deliver or overwrite state. A timeout does not cancel a purchase already underway in Google Play; subsequent store query/update must recover it.

Reinstall/new device under the same Play account obtains fresh current tokens and uses the normal backend verifier. There is no consumer email/account/profile table or old installation-ID ownership dependency. Synthetic separate sessions prove this contract; actual account restore requires the later Play test track/device phase.

## 7. Privacy and non-Android safety

Raw purchase tokens exist only transiently in BillingClient callbacks, the bounded native result and one verifier request. They are not logged, saved to localStorage/SharedPreferences, returned in session/product UI state or placed in event telemetry. Product offer tokens stay inside the fresh native purchase setup. No full card details, Google account email, obfuscated account/profile ID or report-device linkage is collected.

Backend raw-error/provider responses are discarded; failures stay bounded. Native categories distinguish user_cancelled, purchase_pending, already_owned, billing_unavailable, billing_disconnected, product_unavailable, verification_failed and unknown. Shared client contract maps these to its existing safe categories where needed; acknowledgment errors remain server_verification_unavailable rather than raw API errors.

BillingClient cannot reliably classify test versus production evidence on its own. The trusted session environment is explicit and the provider verifies Google's testPurchase marker; a mismatched sandbox proof never establishes production access. No native debug flag bypasses server verification. iOS, web and PWA calls fail closed without native/provider work. Apple files and shared Apple behavior are unchanged.

## 8. Certification evidence

Focused command:

```powershell
node --test tests/lp24464-google-play-billing.test.mjs tests/lp24461-subscription-entitlement.test.mjs tests/lp24461a-store-owned-recovery.test.mjs tests/lp24462-server-verification.test.mjs
```

**43 passed**, including fourteen new Google tests. Seven selected fast native-packaging contracts also passed: MainActivity registration, SDK floor/target, package identity, source manifest permissions, staging families/allowlist and pinned browser dependencies. Tests use synthetic native/provider ports; no live store calls.

Real native command from android/:

```powershell
.\gradlew.bat :app:assembleDebug --console=plain
```

**BUILD SUCCESSFUL**, Kotlin compiled, Billing 9.1.0 resolved, manifest/resource/dex/package tasks passed. An initial compile identified two incorrect API class references; corrected to GetBillingConfigParams and ProductDetails.RecurrenceMode using the pinned library and official API reference. Final Kotlin build passed without those errors. Existing Gradle deprecation summary remains; no unrelated toolchain upgrade was attempted.

APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 100,650,988 bytes, SHA256 `058EC00812696C4BAC073CA2A9F02F0668B9DC82B06B95766FA69B893F8626E0`. Dex inspection confirms GridlyPlayBillingPlugin. aapt confirms package com.gridlygo.gridly, min SDK24/target36, debug versionCode1/versionName1.0.0 (existing debug configuration, not release version authority).

Merged APK permissions: existing INTERNET, ACCESS_NETWORK_STATE, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION; library's normal com.android.vending.BILLING; existing signature-protected DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION. No new dangerous permission or background location. Source manifest unchanged.

This debug APK is **compile evidence only** with existing staged web assets; no configured native-web restaging, paid runtime composition or release candidate certification occurred. It is not the authorized final store artifact, is ignored/uncommitted, and was not installed or uploaded. Do not use it merely to bypass Play Console subscription setup.

Bounded new/changed-source credential scan and staged/working-tree git diff --check passed before commit. No device acceptance or broad suite was run.

## 9. Remaining work / release NO-GO

The owner baseline says Play Console requires a real artifact before subscription configuration. That is not worked around here. After separately authorized real release-candidate preparation/upload, configure gridly_monthly/monthly at $2.99/month US, without trial/free/annual/introductory/alternative billing. Complete listing/subscription review, agreements and legitimate license-tester/internal-track setup.

Before launch: compose and certify actual Google OAuth/Play permissions outside Codex, native admission/replay/rate limits, server signing and private cache operations/cleanup; close acknowledgment durable retry/monitoring and replacement-token handling; certify real current/pending/cancel/restore/disconnect/retry/environment/expiry scenarios; implement LP244.65 runtime paid delivery/gating and web denial; produce and review the real signed release artifact. No live transaction or Play account behavior is certified by synthetic tests or assembleDebug.

**LP244.64 local bridge implementation/Android compile PASS; live billing and public launch NO-GO.** Production reporting remains disabled and separate owner authorization is still required for activation.
