# P0 Google paid access — local proof-clock repair

2026-10-23. Branch: codex/p0-google-subscriber-access.
Authoritative baseline: 0e9eebd185dac45aa3382471870092852645941b.
Production deployment/release status: BLOCKED; no production changes made by this repair.
Local source correction: PASS for the evidenced clock defect.
Historical affected-customer cause: NOT independently established. No customer involvement is needed or requested.

## Confirmed defect and exact transition

Build 14 compares a server-signed lastVerifiedAt directly with device Date.now(),
with zero future-time tolerance. A legitimate nonce-bound ACTIVE/ENTITLED proof
therefore fails when the phone is behind the server at proof validation.

The unchanged deployed v12 handler and exact Build 14 Google/coordinator code
were exercised internally with generated test keys and synthetic acknowledged
production-shaped subscriptions. At -1 ms, -1 second and -60 seconds device
offset, the server returns HTTP 200 and writes ACTIVE/ENTITLED/error-none cache
metadata, but the original client ends UNKNOWN / invalid_authority.

The exact path is:
1. Native purchased evidence, server admission, provider normalization, cache
   reconciliation and proof signing succeed in the isolated production-format fixture.
2. verifyAuthorityProof verifies the signature but rejects verified > now.
3. Google billing converts that failure to unknown / invalid_authority.
4. createPaidAccess clears authority; revoke publishes a temporary not_entitled
   state, then classify selects unknown.
5. The existing UI maps unknown to “Your subscription could not be verified”.

The same fixtures with the local correction reach entitled / allowed through
launch, repeated restore/resume, already-owned recheck and reopened sessions.
The original Build 14 source is loaded from its exact Git commit, not reconstructed
as an approximate failing implementation.

This proves a client implementation defect and a sufficient failure mechanism.
It does NOT prove the unavailable customer's clock offset or rule out a
production signer mismatch. Those claims are deliberately separate.

## Minimal source correction

Only three runtime files change:
- js/gridly-entitlement.mjs
- js/gridly-google-play-billing.mjs
- js/gridly-paid-access.mjs

The Google adapter creates an opaque request-clock context bound to its fresh
random nonce BEFORE calling authority.reconcile. The response is still validated
by the existing pinned-key signature and complete claim validator. The candidate
signed lastVerifiedAt is not retained as clock authority unless all those checks
pass. The context is nonce-bound and single-use.

For that verified Google snapshot, effective UTC is:
signed lastVerifiedAt + max(elapsed monotonic time, elapsed wall progression).

Both elapsed intervals start before the network request. This conservatively
includes the whole request duration, including time before the server's own
observation. It can shorten authority; it cannot add time beyond the signed lease.
Decreasing/nonfinite clocks invalidate the context/snapshot permanently.
A new fresh request can establish another valid clock. A forward wall change
can only shorten the current lease; wall progression also counts sleep if a
WebView monotonic timer pauses. A proof is not persisted across process restarts.

All pinned-key, ES256/P1363 format, nonce, product, platform, production environment,
audience, exact fields, state/error, maximum 300-second lease and provider
period-end checks remain. Request and signature work must complete within the
existing 15-second authority budget. Reporting retains its required 30-second
remaining lifetime. Cloned or unverified objects cannot inherit authority.
There is no clock-derived payment grant and no offline grace added.

Apple, native Billing/Play Integrity, purchase acknowledgment, backend handlers,
store identity, production signer, customer data and app-store metadata are unchanged.
The shared standalone verifier retains strict wall-time behavior; the new
authenticated clock is used only for fresh Google responses in trusted composition.

Clock design reference: [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/#monotonic-clock).
The implementation explicitly handles relative wall progression rather than
assuming every WebView timer continues identically through sleep.

## Bounds outside this correction

The native challenge remains unchanged: server TTL 120 seconds, with the client's
existing expiry/five-minute upper-window check. Tests verify moderate offsets
(-60/0/+60 seconds) pass that gate while -180001 ms and +120000 ms reject before
the verifier call. Thus very large skew can still fail closed at challenge
admission with temporary unavailability. No claim of arbitrary-clock end-to-end
admission is made.

The original customer HTTP 200 calls establish that challenge/native/server
admission completed for those observed requests. The evidenced proof-time defect
can occur inside that otherwise permitted challenge window.

## Production signing identity: conclusively bounded, not assumed

The authorized metadata check established:
- Project nhwhkbkludzkuyxmkkcj, main PRODUCTION.
- Production Google verifier ACTIVE v12.
- Fixed shared Gridly production signer secret:
  GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64.
- Secret-value digest:
  c18dd74454b3401baf705650775a44dcacc801b554453d8df03d4b7f84562450.
- Last updated 2026-09-28 01:52:12 UTC / September 27, 8:52:12 PM CDT.
- Expected production environment and com.gridlygo.gridly bundle digests match.
- Build 14 public SPKI pin:
  963a8a6b5c79f20d0f3948f4cad187794d42276d4c71f40dd577830f865e0d7c.

These two hashes cover DIFFERENT representations and cannot be directly compared.
Supabase exposes a digest of the private-key value, not the private key or its
derived public identity. No matching production signer source was found in the
checked authorized local environments/project locations or the targeted
Gridly-named Desktop/Downloads/Documents records. Sandbox and Apple distribution
signing files were excluded and never treated as the production entitlement key.

No existing public-identity endpoint is present in the inspected verifier.
The offline identity tool can safely derive only public SPKI SHA-256 from an
already-authorized key source and first require its value digest to match the
record above. No such key was available here. No secret was read/exported or
replaced to work around that limitation, and no diagnostic function was deployed.

The key mismatch hypothesis therefore remains an explicit production gate.
The repaired path still denies a wrong key; tests prove the clock repair cannot
mask a signature mismatch.

A successful NORMAL production subscription admission by an owner-controlled
unmodified Build 14, after a cold launch and without reviewer access, would
independently demonstrate signer/pin compatibility for that observed response.
It would not derive the public fingerprint, but would eliminate key mismatch
for that response. The pinned key must verify before that client can admit.
No such live owner acceptance occurred in this task.

## Certification evidence

The completed pre-change evidence remains 89/89 passing.
After the runtime correction:
- Focused suite: 143/143 PASS, zero failures/skips.
- It includes baseline proof tests, new clocks, native admission, Google billing,
  paid coordinator, continuity, actual Capacitor production bridge, Apple parity
  and Chromium execution of the shared acceptance fixture.
- One subsequently added fresh-response signed-claim/DER-signature security test
  passed separately. The updated test-fixture generator and sanitized transition
  recorder also passed their targeted checks. The full suite was not repeatedly
  rerun after documentation/test-only changes.
- Chromium acceptance fixture: all 24 internal checks PASS.
- The exact legacy before/after state traces are saved without proofs/tokens.
- Offline Android debug CERT build: PASS.
- Actual CERT release packaging attempt: blocked by the expected release guard;
  no release APK exists.
- git diff --check: PASS.

Local evidence:
.artifacts/p0-google-access/clock-repair-tests.log
.artifacts/p0-google-access/clock-transition-evidence.json
.artifacts/p0-google-access/android-cert-v2-build.log
.artifacts/p0-google-access/android-cert-release-guard.log
.artifacts/p0-google-access/certification-validation.json

The first test-app builds exposed missing generated production branding resources.
The final isolated generator uses its own minimal test theme and depends on none
of those resources. This was an explained local fixture packaging issue; no
production build or deployment was attempted.

## Owner-controlled physical Android acceptance artifact

APK:
.artifacts/p0-google-access/android-proof-clock-cert-v2/android/app/build/outputs/apk/debug/app-debug.apk

SHA-256:
0abb59ebe33f2816256a22d561adcee95f4ff29d09027da6d2e19822c374fab4

Application ID: com.gridlygo.proofclockcert
Version: 0.0.1-CERT / code 1; debuggable.
The three repaired packaged modules were compared byte-for-byte to tested source.
This is a synthetic COMPONENT acceptance app, not a production release candidate.
No production endpoint, real Billing/Integrity plugin or signing secret is configured.
Its runtime and Gradle both guard against Release use. The component uses injected
clock ports; it does not require changing an owner's device clock or settings.

Owner path:
1. Use a dedicated owner-controlled Android device. None was connected during this task.
2. Verify the APK hash above.
3. Install ONLY com.gridlygo.proofclockcert, then open it and tap Run proof-clock checks.
   Existing Gridly installation and data remain separate.
4. Expect 24 PASS checks and allPassed=true: original Build 14 UNKNOWN, corrected
   offsets, restore/resume/already-owned, expiry and negative signatures/nonces.
5. Close/reopen this separate test app and repeat.
6. Record only device/engine version, artifact hash, safe PASS/FAIL output and
   whether hardware was physical. No receipt, account, token or proof collection.
7. This component result does not certify actual Play Billing, Play Integrity,
   the active production signer, or historical customer restoration.

Regenerate a NEW fixture directory with:
node tools/entitlement/prepare-proof-clock-android.mjs .artifacts/p0-google-access/owner-cert-new

Build only that generated project's assembleDebug, using the existing Android
SDK/JBR and cached toolchain. Never point this generator at the production app
or replace www. Production packaging excludes tools/tests by its normal allowlist.

## Backend-only versus binary decision

For the confirmed clock defect: backend-only correction NO. The comparison and
subsequent admission/expiry logic are bundled in the installed Android binary.
Backdating a signed verification timestamp to guess a device offset would
misrepresent verification time and is not a certified remedy.

A corrected Android binary is required. Build 15 shares the defective paid-access
source and must not be assumed to fix it. Its in-review submission was untouched.
A future candidate requires a newly verified unused versionCode above 15
(16 is only the next numerical candidate; console availability was not checked).
Apple Build 16, all releases and all Play products/prices remain untouched.

## Exact next production action and remaining gates

No backend patch, signer rotation, entitlement grant or store release is approved
by this local certification.

The next operational step is owner-only physical component acceptance with the
prepared isolated APK. Then, using an EXISTING owner-controlled Google production
subscription, establish normal current-release admission under known UTC conditions
to resolve the signer-compatibility gate. Do not purchase, repurchase or alter a
subscription under this authorization. No customer participation or identifiers
are required.

Alternatively an existing authorized production-key custodian may run the offline
identity tool with the exact configured digest. Return only public identity and
match booleans, never private material.

Before a future corrected Play candidate can be activated, separately authorize
its distribution/submission and verify the production pin, exact packaged source,
native Billing/Integrity/acknowledgment, retained-data upgrade/reopen/restore, and
old cached-module replacement. Current service-worker/native upgrade behavior
was not changed or certified by this source repair. No reinstall/clear-data
workaround is acceptable. Full native Play acceptance requires a Play-recognized
candidate; the isolated component APK cannot substitute for that gate.

Rollback before release is local Git reversion only; no production state was
migrated. A future release rollout/rollback plan must preserve existing reports,
preferences, cached authority rules and signing-key compatibility. It is not
authorized here.

Production customer access restored: NOT VERIFIED. The unavailable customer's
precise rejection and production public signer identity remain evidence gaps.
Cleanup-monitor work remains suspended and was not inspected or changed.

## Emergency native delivery extension — 2026-10-23

This section supersedes the earlier Apple-unchanged statement for the locally
prepared next candidate. It does not change the historical dee9d21e certification.

### Reproduced Apple defect and local correction

The exact approved application source 0e9eebd185dac45aa3382471870092852645941b
was loaded as an isolated baseline. Synthetic, correctly signed ACTIVE Apple
proofs with the local clock 1 second, 1 minute or 1 day behind server time produced
UNKNOWN, denied access and zero transaction finishes. The aligned-time control
unlocked. This reproduces an Apple client defect; it does not prove any particular
customer's device state or the identity of the production signing key.

The existing Android response-clock design now serves both stores through separate
platform-bound, opaque, single-use request contexts. Apple starts its context before
reconciliation and validates the response using the authenticated signed observation
time plus conservative elapsed time. The coordinator uses the authenticated clock
for both platforms. The strict standalone verifier, pinned public key, ES256 claims,
nonce, product, environment, audience, five-minute lease, period expiry, restore,
delivery-before-finish ordering and native authorization remain enforced. No offline
payment grant was added. Existing native challenge time windows remain unchanged;
large arbitrary clock offsets are not certified end to end through those windows.

### Android delivery actually completed

- Package com.gridlygo.gridly; versionName 1.0.1; versionCode 16.
- Exact AAB: .artifacts/p0-android16-release/Gridly-1.0.1-versionCode16-clock-repair-release.aab
- Bytes: 116038424.
- SHA-256: ca4d5a25dacb6503b5e51e408fab74db2de5882819bc53ceb60dcbd90b629a1f.
- Upload certificate SHA-256: 84fb65b7e36538dd1fb95727b89e4644bb0cf51a1bb270c254269dcdfcf7c8a3.
  It matches the public Play upload fingerprint independently copied from Play's
  upload-key control and the existing Gradle release signing report. No secret
  values were printed, copied or changed.
- The first authorized release build failed at signReleaseBundle with an exhausted
  metaspace warning and a generated heap dump. The dump was removed without reading.
  The owner then explicitly authorized ONE additional diagnostic build. A fresh
  JDK21 process, 2GiB heap/1GiB metaspace and two workers succeeded. Two build
  invocations total, one successfully certified artifact, ONE upload, no retry upload.
- Official existing bundletool1.18.1 validation, unique ZIP entries/CRC, and all
  1485 payload-entry signatures passed. Release/nondebuggable; manifest differs from
  certified15 only by versionCode. Resources, native bridge and dependencies match15.
- The certified15 AAB (SHA e4552cd03fef4c056f3b56374536bff8ecc395abc40cab6044ff2d9f3fe140ff)
  supplied the preserved runtime payload. Exactly four files changed: entitlement,
  Google billing, paid access and Apple StoreKit modules. Other1003 web files are
  byte-identical, including performance, crossing, NWS/weather, legal and saved-data
  runtime assets. No statewide assets were regenerated.
- Play accepted the exact uploaded filename and16(1.0.1). Artifact ID4860243754369551831.
  Existing Internal Testing track4700731124967069144, release15, is AVAILABLE TO
  INTERNAL TESTERS as of Oct23 12:20PM CDT. Existing Testers list has2 eligible users;
  no tester configuration or invitations changed. UI upload provenance identifies
  the submitted bytes; no separate provider-returned whole-file checksum is claimed.
- The sole Play warning is missing deobfuscation mapping. The existing release has
  no new R8/minification configuration; device support did not change.
- Postcheck: public14 remains Available on Google Play; production15 remains Ready
  to publish; Managed Publishing ON. No production submission or rollout occurred.

### Apple17 candidate preparation, not a signed binary

Authenticated App Store Connect All Statuses history showed highest upload16 and
no observed17. This is a point-in-time availability observation, not a reservation;
recheck immediately before any future upload. The owner directly authorized local17
metadata, exact recovery compatibility14/16/17 and matching fail-closed checks.

Local project: com.gridlygo.gridly,1.0.1(17), iPhone, minimumOS16.4. The native
controller changes only the exact recovery build whitelist. All migration, stored
report, readiness, schema, origin, lifecycle and confirmation bodies remain unchanged.
Build-only certification requires17, exact four-module P0 hashes and unchanged
performance/NWS source before signing. Parity retains legacy14/16 contracts.

No Apple archive/IPA was built or uploaded here. Windows cannot execute Xcode,
actual Swift lifecycle compilation or codesign. The established macOS26/Xcode26
workflow and existing distribution certificate/profile must be used; a reviewed
build-only control must pin this new application commit and17, preserve the proven
signing/attestation/cleanup body, and omit transfer. Do not run an old control pinned
to0e9e/16: it would omit the repair. No workflow/tag/branch was published or dispatched.
The local source handoff manifest/bundle identifies the exact prepared commit.

The retained actual16 attestation is reused as baseline evidence: source0e9e,
1007 runtime files, digest a633f1d201bed1fe98b6bae67c230076427829746b7ac0b0b5b36712c5009503,
IPA SHA25f6d39e0892da826f1faf7bb52bdb2dfd6b83cc6710f11099db9758bd375d96,
macOS run39879265009. Its IPA was deliberately removed by that workflow's cleanup;
new17 archive/IPA parity is therefore PENDING, not inferred from local tests.
Fresh Apple postcheck:1.0.1(16) Pending Developer Release, manual release selected;
1.0.0 Ready for Distribution. No Apple store field or release was changed.

### Focused certification and evidence

Existing89/143 test evidence is retained; no broad audit was repeated. Selected
runs overlap and must not be summed as unique tests:

- Actual AAB-extracted Google/Apple clock and negative-security regressions:19/19.
- Final staged Capacitor production Android bridge cases:9/9; AAB bytes match stage.
- Apple clock/restore/replay, continuity, paid coordinator and report authorization:63/63.
- Shared Google/Chromium/source parity:35/35; six source-preservation cases rechecked
  after Apple17 metadata:6/6.
- Apple17 build controls, including injected versions and clock-payload drift:17/17.
- Portable native parity:7 PASS;1 real macOS codesign case explicitly SKIPPED.
- Focused community loading/crossing and NWS safety tests passed. Strict full-source
  preservation checks retain the17 approved performance hunks and NWS repair.
- No unresolved final local assertion failure. Before-repair regression failures,
  initial stale metadata/source-pin fixtures and the failed first build are retained.

Evidence: .artifacts/p0-android16-release/{artifact-certification.json,
signature-entry-verification.json,artifact-clock-security.tap,final-native-bridge.tap,
final-stage-identity.json,release-build.log,release-build2.log,upload-attempt.json};
.artifacts/p0-apple-clock-repair/{before.tap,after-focused.tap,security-continuity.tap,
final-parity.tap,build17-controls-final.txt,final-source-preservation.tap,native-parity17.txt}.

### Remaining acceptance and controlled next action

Production entitlement signer identity remains independently UNVERIFIED. Upload
certificate verification is a different key identity. No signing keys were rotated
and no proof check bypassed. Wrong-key proofs still deny access.

ADB check found0 authorized/unauthorized/offline devices; no install was performed.
The two existing internal testers can opt in at
https://play.google.com/apps/internaltest/4700731124967069144 and update14/15 to16
in place through Play. Do not uninstall, clear data, repurchase or use reviewer codes.
On an authorized owner account already holding a PRODUCTION subscription, verify
startup admission, repeated reopen/foreground, restore, Home Area/settings/saved
places/Route Watch, pending report preservation, location/map and alerts. Without
that account/device, production acceptance stays pending; sandbox is not a substitute.
Do not generate test community reports or collect customer evidence.

Next Apple step: certified macOS build-only execution from this exact candidate,
14 actual Swift lifecycle cases, production signing and complete archive/IPA runtime
and native parity. A separately authorized TestFlight upload is then needed for
physical in-place acceptance. Keep held16 until the replacement is certified.

After both physical acceptance gates and signer compatibility close, obtain separate
store-submission authorization to replace held Google15 with16 and held Apple16
with17, request expedited review as appropriate, and retain Managed/Manual publishing.
No public release is authorized. Do not release the currently held defective binaries.

No backend, cleanup monitor, subscription products/prices/payment states,
entitlements, customer records, settings or app-store public releases were modified.
Customer access restored: NOT VERIFIED. The original customer's precise cause
remains unproven.

Additional final handoff checks: native-version compatibility3/3 PASS. The legacy
Android staging gate still rejects16; the emergency AAB used exact certified artifact
composition without widening reviewer authority. A local17 build-only control template
reuses the actually certified f0906a8 macOS body and remains unpublished/unexecuted.
