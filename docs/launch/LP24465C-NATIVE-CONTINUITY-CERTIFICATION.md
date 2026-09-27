# LP244.65C — Native continuity certification

## Status and source

2026-09-27. Branch: `LP244.65-paid-access-entitlement-runtime`. Starting HEAD: `0f8e5997f7001f62b62127b1956bbd7de708ecb0`; initial tree clean.

**Harness preparation PASS. Native lifecycle certification NO-GO / owner execution pending. Paid production remains NO-GO.** No actual native runtime result is inferred from JavaScript mocks, source assertions or compile success.

Owner-provided preceding evidence: Android prepare/sync/assembleDebug PASS; iOS StoreKit and continuity simulator compile PASS following the helper-collision repair. Those results concern the preceding production source, not compilation/execution of this new certification clone.

LP244.54 remains CLOSED / PASS. Do not reopen device acceptance. Old LP244.22 reset/repair must not be replayed. Reporting remains disabled in the owner baseline; no fresh production query or mutation is made here.

## Current testability

Both real plugins expose exactly `beginVerification`, `commit`, `retain`, `revoke`. Begin reads storage and clock, saves a durable pending barrier, and returns bounded proof/context to the trusted coordinator. Commit requires the current attempt and monotonically nondecreasing verified time; retain can recover only a clock-trusted previous record; revoke rotates the binding. Native plugins store material, while the unchanged JavaScript verifier validates the ES256 signature, platform/product/environment/binding and deadlines before admission.

- iOS: device-only, nonsynchronizing Keychain record; a non-backed-up Application Support sentinel discards a surviving Keychain item after reinstall. Wall time, `mach_continuous_time`, and `KERN_BOOTTIME` provide clock/boot checks.
- Android: AES-GCM record in `noBackupFilesDir`, AndroidKeyStore key, AtomicFile, and serialized updates. Uninstall removes app storage/key ownership. Clock checks use wall time, elapsedRealtime, and BOOT_COUNT.
- The production paid coordinator attempts fresh store/authority reconciliation, then permits signed continuity only on a temporary outage, for at most 24 hours and never past the verified period end. Denial/revocation overrides cached authority. No new hooks were added to either plugin or consumer coordinator.

| Evidence | Pure local tests | Native execution still needed | Physical device required in this phase |
| --- | --- | --- | --- |
| Signature, 24-hour/period caps, denial, environment, binding | PASS | Native integration cases A–E | No |
| Restart/barrier policy | PASS with isolated vault fixtures | F: actual process restart | No; emulator/simulator |
| Clock/boot checks | PASS source and isolated vault fixtures | G: actual emulator reboot; iOS host reboot | No; hardware guarantees not claimed |
| Reinstall ownership boundary | PASS policy/source fixtures | H: cert-app uninstall/reinstall | No; simulator/emulator only |
| Public routes / protected initialization | PASS real Edge browser and source tests | Check links and gated canary in cert app | No |

A native compile alone does not exercise Keystore/Keychain lifecycle. Android physical-device work adds no required unique evidence to these bounded checks; use one emulator. Simulator results do not certify hardware-backed key properties or physical iPhone behavior.

## Isolation and release exclusion

`tools/native-continuity-certification/prepare.mjs` creates a NEW directory outside the repository, copying a separate **debug-only** app with ID `com.gridlygo.continuitycert` and visible name **Gridly Continuity CERT**. Production app ID `com.gridlygo.gridly` is preserved. Vault source bytes are compared before any instrumentation; source and generated SHA-256 are recorded in the manifest (LP244.65G Android commit diagnostics detailed below). Only the continuity plugin is registered in the clone; store/location plugin implementations are excluded. Existing JavaScript store adapters are used with an explicit unavailable fixture port, never a real purchase plugin.

The loopback issuer generates an ephemeral signing key in memory. Only its public JWK goes into the certification bundle. The issuer uses the existing server normalizers/signResponse to create synthetic continuity; private key/proofs/bindings/attempts are never logged or written as diagnostics. The endpoint listens only on `127.0.0.1:8765`, accepts a bounded three-field synthetic seed request, and has no production transport. Keep the issuer process and installed artifact unchanged throughout a case. Rerunning preparation generates another key and invalidates previous evidence.

The generated clone alone enables local HTTP fixture transport (Android cleartext and iOS WebView ATS allowances); its page CSP limits connections to self and loopback. These allowances never modify the original native project. The temporary Android clone links existing node_modules; no dependency installation or Capacitor sync is performed by this tool.

Release safeguards:

- Harness/tools paths are outside the native runtime allowlist, original index, and consumer script manifest.
- Native packaging rejects known harness files/fixture names; final contract verification rejects those names and the synthetic index marker even if the index is renamed/copied.
- Generated iOS bridge fails compilation outside DEBUG; generated Android release tasks fail and its activity requires BuildConfig.DEBUG.
- No consumer query flag, localStorage authority, runtime-global unlock, production signing key, or release entitlement flag exists.
- Copying a certification bundle into production staging fails the contract tests. Deliberately modifying/removing these safeguards is outside this claim.

The certification page calls the native vault directly to seed only this separate app; LP244.65G adds fixed commit diagnostics only to the generated Android copy, as detailed below. Negative fixtures intentionally write invalid synthetic records; the real verifier/coordinator must reject them. No hidden native injection method was added.

## Cases and bounded observations

Only state/booleans/canary count are displayed. Do not dump vault storage, web requests, proof strings, bindings or operation attempts.

For every independent A–E case: press its seed button, wait for `seeded:true`, force-stop/terminate and relaunch the SAME installed certification artifact, then press **Check offline admission**. A freshly started page must show zero protected initializations before Check. Do not substitute a reused page whose module imports may already be cached.

| Case | Synthetic input or actual lifecycle | Required result |
| --- | --- | --- |
| A | ACTIVE, verification one second ago, period end seven days later | allowed=true, temporaryAccess=true, canary=1 |
| B | ACTIVE at verification 25 hours ago | allowed=false, canary=0 |
| C | ACTIVE at historical verification; period end one hour ago | allowed=false, canary=0 |
| D | Single changed signature byte | allowed=false, canary=0 |
| E | Validly signed sandbox authority against production verifier | allowed=false, canary=0 |
| F | Seed A; Check allowed; ordinary actual process restart; Check again | allowed=true, temporaryAccess=true, canary=1 |
| G | Seed A, Check allowed; actual boot identity change or actual wall-clock rollback | clockTrusted=false, allowed=false, canary=0; fresh verification required |
| H | Seed A, Check allowed; uninstall only certification app; reinstall SAME artifact, no seeding | no reusable proof; allowed=false, canary=0 |

After every denied case, check the five public links. Use app relaunch to return from local/external routes without reseeding. Public links do not initialize protected runtime. Support/Delete Data may open the system browser; that is acceptable public bypass.

**Scope:** the native harness loads a gated canary through the actual coordinator's `initializeRuntime`; it does not bundle Home/Search/KBYG/Route Watch. Actual consumer denial/inertness is separately exercised by browser tests (no app.js/package registry or Leaflet startup). Support/Delete responses in the local browser test are navigation fixtures, not fresh live-publication evidence.

## Exact Windows / Android emulator commands

Use the existing SDK/JDK and one running emulator, not the accepted owner phone. No installs/upgrades of tooling. If `adb -e` is ambiguous, stop and select the intended emulator explicitly with `-s SERIAL`.

Terminal 1, from the repository (the command stays running):

```powershell
Set-Location C:\GitHub\liberty-county-map
$certRoot = Join-Path $env:TEMP ('gridly-continuity-cert-' + [guid]::NewGuid().ToString('N'))
node tools/native-continuity-certification/prepare.mjs --platform android --output $certRoot
```

Terminal 2: substitute only the nonsecret output path printed by terminal 1. SDK example uses the standard existing Windows SDK; use your already configured SDK path if different. Stop if absent; do not install anything as part of this phase.

```powershell
$certRoot = 'COPY-EXACT-OUTPUT-PATH-FROM-TERMINAL-1'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Existing Android SDK required' }
Set-Location (Join-Path $certRoot 'android')
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Certification compile failed' }
adb -e reverse tcp:8765 tcp:8765
adb -e install (Join-Path $certRoot 'android\app\build\outputs\apk\debug\app-debug.apk')
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

F / fresh-process step for A–E:

```powershell
adb -e shell am force-stop com.gridlygo.continuitycert
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

G: after A is admitted, record the boot count, reboot ONLY emulator, then check before reseeding:

```powershell
adb -e shell settings get global boot_count
adb -e reboot
adb -e wait-for-device
adb -e shell settings get global boot_count
adb -e reverse tcp:8765 tcp:8765
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

If boot count did not change, this does not prove the boot branch. For a separate rollback observation, seed A again after normal time is restored; force-stop, use only emulator Settings → System → Date & time to disable automatic time and move its wall clock backward one hour, relaunch, Inspect/Check denial, then restore automatic date/time. Do not change the host clock or accepted phone. If that emulator disallows time changes, mark actual rollback pending; mocked rollback is not native evidence. No production clock or deadline changes are authorized.

H: uninstall ONLY the certification ID, then install the SAME APK and Check without Seed:

```powershell
adb -e uninstall com.gridlygo.continuitycert
adb -e install (Join-Path $certRoot 'android\app\build\outputs\apk\debug\app-debug.apk')
adb -e reverse tcp:8765 tcp:8765
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

## Exact Mac / iOS simulator commands

Use the existing repository checkout on Mac, same reviewed commit, and existing Node/Xcode environment. Boot one intended simulator via Xcode; no phone commands. No native prepare/sync command: those would overwrite the certification assets/registration.

Terminal 1, from repository root:

```sh
cert_root="$(mktemp -d)/app"
node tools/native-continuity-certification/prepare.mjs --platform ios --output "$cert_root"
```

Terminal 2, replace the nonsecret output path; exactly one intended simulator must be booted:

```sh
cert_root='COPY-EXACT-OUTPUT-PATH-FROM-TERMINAL-1'
xcrun simctl list devices booted
xcodebuild -project "$cert_root/ios/App/App.xcodeproj" -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$cert_root/derived" CODE_SIGNING_ALLOWED=NO build
```

Proceed ONLY if xcodebuild exits zero. If package resolution/compile fails, record that blocker rather than syncing or changing production source.

```sh
xcrun simctl install booted "$cert_root/derived/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl launch booted com.gridlygo.continuitycert
```

F / A–E fresh process:

```sh
xcrun simctl terminate booted com.gridlygo.continuitycert
xcrun simctl launch booted com.gridlygo.continuitycert
```

H (simulator certification app only):

```sh
xcrun simctl uninstall booted com.gridlygo.continuitycert
xcrun simctl install booted "$cert_root/derived/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl launch booted com.gridlygo.continuitycert
```

G is different: simulator shutdown/boot does NOT change the host kernel identity used by these APIs. Seed A and Check admitted; record simulator UDID with `xcrun simctl list devices booted`; terminate the cert app; save work and manually restart the Mac when ready. After the actual host restart boot the SAME simulator in Xcode, then:

```sh
xcrun simctl launch booted com.gridlygo.continuitycert
```

Check/Inspect without Seed. The installed bundle retains its public key even though the in-memory issuer is gone; expect denial and clockTrusted=false. Do NOT regenerate/install a different-key harness to simulate reboot failure. Temporary build paths may be cleared by the OS; the installed app remains the evidence target. Use host reboot as actual boot-branch evidence; actual iOS clock rollback is not claimed here. If host restart is deferred, G remains pending. A simulator-only boot cycle must not be recorded as PASS.

**No uninstall of the owner's accepted iPhone app is required or instructed.** Any future need to remove that installation requires stopping for separate owner action. Simulator Keychain evidence is not physical-device security certification. Existing generated `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/` state remains generated/untracked; never stage it or modify the preserved LP244.54 stash.

## Reporting / production safety

The fixture signer is entirely local. There is no store purchase call, report writer, Supabase transport, reporting toggle, launch guard, cleanup/retention call or deployment. Public support links are plain navigation. Production native vaults, legal text, entitlement semantics, 24-hour policy and store implementations are unchanged. This phase cannot attest a fresh reporting-enabled value; it preserves the owner-provided disabled baseline through absence of backend operations.

## Verification and remaining gates

All LP244.65 focused tests plus native-packaging tests: **88/88 PASS** (51 prior LP65 tests, 13 harness tests, 24 packaging tests). New fixture cases use real ES256 validation for both platforms. Generator tests attest separate identities, byte-identical vaults, debug-only guards and public-only fixture config; negative packaging tests reject harness files and renamed synthetic index. Browser tests traverse all five public links while denied and assert protected app/Leaflet absence. Existing focused tests cover 24-hour/period caps, restart, replay/binding, interrupted verification, clock rollback, revocation/denial, reinstalls, localStorage rejection and reporting exclusion. Native Keychain/Keystore was not executed here.

Run before commit:

```powershell
node --test tests/lp24465-paid-access.test.mjs tests/lp24465-continuity.test.mjs tests/lp24465a-launch-flow.test.mjs tests/lp24465-paid-startup-browser.test.mjs tests/lp24465c-native-harness.test.mjs tests/native-packaging.test.mjs
git diff --check
git status --short
```

Final `git diff --check`: PASS. Changed-file JavaScript syntax and credential-pattern scan: PASS (9 changed/new files); scan includes private-key PEM, Supabase/Resend secret shapes, JWT strings and credential-bearing database URLs. No secrets/real store evidence are introduced.

Remaining: owner native certification-clone compile and A–H execution evidence, actual clock/boot branch evidence as specified; LP244.62 real Apple/Google verifier/admission/key/cache/acknowledgment composition and authorization; real store products/purchase/restore/candidate acceptance; later separately authorized reporting activation. No production GO, purchase acceptance, physical acceptance, deploy, push or merge is claimed by the harness preparation commit.

## LP244.65D — Android loopback transport repair

Starting HEAD: `52c3e5cb5f2c7a67aaf8e861242024c8875d7e99`. Owner reports certification compile/install/launch, plugin registration, and real Android Keystore begin/revoke/second-begin PASS; seed then failed before commit. Owner TCP/ADB-reverse evidence passes. This is not full A–H lifecycle certification.

### RCA and evidence limits

Confirmed configuration defect: the generated certification config omitted `server.androidScheme`. Installed Capacitor `CapConfig.java` defaults that field to HTTPS, reads `server.androidScheme`, and accepts HTTP. `Bridge.java` constructs the local URL from that scheme/hostname; broad mixed-content allowance is not enabled by the harness. Thus the prior page origin was `https://localhost`, while `seed()` fetches `http://127.0.0.1:8765/seed` using POST and a JSON body `{scenario,platform,binding}`. Manifest cleartext allowance controls Android transport permission, not the WebView's mixed-content policy.

After the second native begin, the first network statement is that `fetch`. Following statements check status, parse the fixture, validate its signature/bounds, and commit. Owner evidence does not include the actual WebView fetch exception/response or issuer request trace; therefore mixed-content rejection is the leading explanation, NOT a conclusively observed live failure category. Do not claim the original precise browser rejection or post-repair native success until the emulator rerun supplies it.

Repair: set `config.server={androidScheme:'http'}` ONLY inside preparation's Android branch. Generated `com.gridlygo.continuitycert` now uses `http://localhost`; issuer remains `http://127.0.0.1:8765`. Different origins still require CORS: the existing issuer explicitly allows `http://localhost`. No `server.url`, navigation allowlist or `allowMixedContent` bypass is introduced. Production configs/manifests and iOS transport remain unchanged.

A valid synthetic 64-character binding against the actual HTTP issuer returns HTTP200 and a signature-valid Google fixture. `binding:"test"` returns expected HTTP400. HTTP localhost retains a secure context/WebCrypto in installed Edge. An additional desktop-browser fetch probe from a routed test page was denied by Edge's loopback local-network permission policy; that is not Android WebView evidence. Final tests separate real issuer HTTP/CORS validation from desktop WebCrypto availability, without relaxing browser permissions or issuer policy.

### Local verification

Focused LP244.65C/D harness tests: **14/14 PASS**. Generator assertions inspect the actual generated Android asset config (`server` exactly `{androidScheme:'http'}`), the separate bundle identity/debug guards, and absence of broad mixed-content allowance. Four original Capacitor configs, production Android manifest and iOS Info.plist remain byte-identical during generation; production configs contain no HTTP scheme override. Tests preserve real synthetic signatures, production packaging exclusion, unchanged vaults, memory-only fixture signing key, loopback binding and absence of backend/store authority calls. Issuer tests use an ephemeral port so the owner's existing port 8765 process is not touched; normal CLI port remains 8765.

LP244.65D whitespace/syntax/credential-pattern checks: PASS (three changed files). Reporting remains untouched; no production/native deployment, push or merge.

### Exact owner rerun

Close the OLD fixture issuer with Ctrl+C in its own terminal before starting a new one; do not kill unrelated Node processes. Use the existing emulator/SDK/JDK. Do not uninstall `com.gridlygo.gridly`. Do not run native-web preparation or Capacitor sync inside the temporary clone, because those overwrite certification assets.

Terminal 1 from the repaired repository checkout, keep it running:

```powershell
Set-Location C:\GitHub\liberty-county-map
$certRoot = Join-Path $env:TEMP ('gridly-continuity-cert-' + [guid]::NewGuid().ToString('N'))
node tools/native-continuity-certification/prepare.mjs --platform android --output $certRoot
```

Terminal 2 (copy the nonsecret output path printed above):

```powershell
$certRoot = 'COPY-EXACT-OUTPUT-PATH-FROM-TERMINAL-1'
$cfgPath = Join-Path $certRoot 'android\app\src\main\assets\capacitor.config.json'
$cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
if ($cfg.appId -ne 'com.gridlygo.continuitycert' -or $cfg.server.androidScheme -ne 'http') { throw 'Wrong certification config' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Existing Android SDK required' }
Set-Location (Join-Path $certRoot 'android')
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Certification build failed' }
adb -e shell am force-stop com.gridlygo.continuitycert
adb -e reverse tcp:8765 tcp:8765
if ($LASTEXITCODE -ne 0) { throw 'ADB reverse failed' }
adb -e install -r (Join-Path $certRoot 'android\app\build\outputs\apk\debug\app-debug.apk')
if ($LASTEXITCODE -ne 0) { throw 'Certification install failed' }
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

Use exactly one emulator (`adb -e`); if ambiguous, stop and select its explicit serial. The `-r` install replaces ONLY the certification app. Preparation creates a new fixture key; old local records are not new ownership proof. Tap **A: valid**, wait for `seeded:true`, then:

```powershell
adb -e shell am force-stop com.gridlygo.continuitycert
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

Tap **Check offline admission**: expect `allowed:true`, `temporaryAccess:true`, `protectedInitializations:1`. Continue B–H using the existing case matrix and SAME installed artifact/issuer. If A still fails, stop that certification attempt and report only its bounded category and whether the issuer was reached; do not dump proofs, bindings, attempt tokens or raw storage. No production repair or entitlement bypass is authorized by this rerun.

**Repair preparation PASS; native post-repair A–H proof remains pending.** LP244.54 remains CLOSED/PASS. Production reporting stays at the owner-disabled baseline without a fresh backend query.

## LP244.65E — Bounded seed diagnostics

Starting HEAD: `6c01761af731f1a23647290c74dec18d27a3dca2`. Owner confirms the generated Android HTTP scheme at runtime, ADB reverse, and native begin/revoke/second-begin success. Commit has not been reached. No observed mixed-content, cleartext, net::ERR or SecurityError establishes a transport cause; do not assume one. The owner runtime failure remains unclassified until the new stage output is observed.

Only the synthetic certification frontend, issuer tooling, focused tests and this record change. Production configs/manifests, native vaults, store billing and 24-hour paid-access policy are untouched. Android certification HTTP origin, CSP, loopback allowlist and port 8765 remain unchanged.

### Diagnostic contract

Seed now displays progress before each potentially failing stage. Its catch projects only the fixed scenario/stage/category, bounded HTTP status when present, and protected initialization count, with the existing synthetic marker. No exception messages, stack traces, response bodies, proofs, binding, attempt, signing key, JWT/JWS content or purchase evidence are displayed/logged.

| Stage | Failure category | Meaning |
| --- | --- | --- |
| native_reset | native_reset_failed | Stop/reset, first begin or revoke failed |
| native_context | native_context_failed | Second begin failed or context shape is invalid |
| issuer_fetch | issuer_fetch_failed | Fetch rejected/threw, including its 10-second abort |
| issuer_http | issuer_http_error | HTTP response is non-2xx; status is shown |
| issuer_response | issuer_response_invalid | JSON parsing or exact bounded fixture shape failed |
| fixture_verification | fixture_verification_failed | Case A verification threw or rejected the fixture |
| native_commit | native_commit_failed | Commit threw or did not explicitly return saved=true |
| complete | none | Seed saved=true; this alone is not paid-admission evidence |

The HTTP deadline bounds acquisition of response headers, not JSON-body reading; a pending body read remains visibly at issuer_response. B–E still deliberately seed negative synthetic material for the unchanged runtime to reject; they do not require a positive verifier result. Case A still requires actual signature/bounds verification before native commit. No bypass or authority change is introduced.

### Safe issuer and framework logging

CLI issuer tracing is enabled only in the synthetic tool. It emits fixed-label method, pathname, scenario, platform and HTTP status, for example:

```text
CERT_ISSUER POST /seed scenario=A platform=google status=200
```

Methods outside POST/OPTIONS become OTHER; unexpected paths become other; unrecognized scenarios/platforms become '-'. Arbitrary URL paths, JSON bodies, binding, proof and exceptions are never echoed. Response-finish tracing records the issued HTTP status. Tests use an ephemeral loopback port and do not disturb the owner's running 8765 process.

Installed Capacitor Android Bridge.java can log native call methodData at debug level. Generated certification configs now set `loggingBehavior:'none'` to suppress that framework logger for fixture calls; the installed CapConfig.java explicitly sets loggingEnabled=false for none. This is confined to generated separate apps; production native config remains byte-identical. Use the bounded UI and CERT_ISSUER trace instead of capturing raw native bridge logs.

### Verification and owner rerun

Focused C/D/E tests: **29/29 PASS**. Tests execute the actual seed-function source with isolated native/fetch/verifier ports for reset/context/fetch/HTTP/JSON/verification/commit exceptions and negative return values, verify safe output keys and absence of sentinel private values, and preserve B–E semantics. Real HTTP tests retain valid 64-character binding → signature-valid HTTP200 fixture, invalid binding → HTTP400, and HTTP-localhost CORS/WebCrypto checks. Generator/packaging tests retain HTTP scheme, loopback-only binding, native vault byte identity, release guards, generated framework logging disabled, unchanged production config/network policy, and bundle exclusion. Safe trace tests include malicious-looking scenario/platform/path strings and confirm only fixed metadata labels escape. Native post-update execution is not performed here.

Final checks: `node --test tests/lp24465c-native-harness.test.mjs` PASS (29/29); `git diff --check` PASS; changed-file syntax/credential scan PASS (four files); safe-output and sensitive-log regression checks PASS.

For the exact Android commands, use the LP244.65D owner rerun block above: stop the old issuer with Ctrl+C, generate a NEW temporary clone from the updated repository, leave its new issuer running, rebuild Debug using the existing toolchain, and `adb -e install -r` ONLY `com.gridlygo.continuitycert`. Do not sync/prepare consumer assets, uninstall the accepted Gridly app, or reuse an APK/public key from a different issuer generation.

Verify the new temporary native config has server.androidScheme=http AND loggingBehavior=none. Tap A once. Record only the on-screen scenario/stage/errorCategory/httpStatus/protectedInitializations and the corresponding CERT_ISSUER line. A pending stage also identifies where execution is waiting. Do not paste raw logcat native payloads or HTTP bodies. On complete/seeded=true, force-stop/relaunch the SAME artifact and Check offline admission (allowed=true, temporaryAccess=true, canary=1). Otherwise stop and provide the bounded diagnostic; do not invent a cause or alter network/security policy.

Diagnostics preparation PASS; native A–H certification remains pending. Reporting remains at the owner-disabled baseline; no fresh production query or mutation. LP244.54 remains CLOSED/PASS. No deploy, push or merge.

## LP244.65F — Synthetic proof clock-domain repair

Starting HEAD: `be092ad1eeafc9b91a0716e9e2f188324b8cb7ab`. Owner reports HTTP204 preflight and HTTP200 POST, followed by fixture_verification_failed before commit. This supersedes the earlier unconfirmed transport explanation: the issuer is reached; do not assume mixed content.

### Exact observed RCA

A bounded local audit requested only a synthetic fixture, read the existing generated public JWK, and read only the public fixture-key asset from the installed `com.gridlygo.continuitycert` APK. No native vault, private app data or production package was read. Emulator wall-clock read was limited to `adb -e shell date +%s`, converted to milliseconds for comparison; no device IDs, raw times, proof, claims body, binding or keys were printed.

Observed flags: issuerHttpStatus=200; signatureMatchesLatestGeneratedKey=true; signatureMatchesInstalledKey=true; validAtHostTime=true; emulatorClockRead=true; verifiedTimeAheadOfEmulator=true; validAtEmulatorTime=false. The future-time comparison allows an extra second for shell timestamp truncation, so this is not a seconds-rounding artifact.

**Mismatch:** old issuer used Windows `Date.now() - 1000` for lastVerifiedAt; the harness evaluated that proof at the native context's earlier `nowMs`. The emulator clock is behind the host. All signature/identity/schema checks pass; `Date.parse(lastVerifiedAt) > native nowMs` is the rejecting production predicate. Even synchronized clocks can reproduce the same defect when the request takes more than the old one-second cushion. Previous fixture tests issued and verified at the same injected time, masking the real two-clock contract.

Production verifier behavior is correct and unchanged. The shared signer and store normalizers are unchanged. No future-time tolerance or clock adjustment is added to production.

### Bounded synthetic repair

The harness sends the native clock sample as `nowMs` only to its loopback POST. The synthetic issuer now requires that sample (no host-clock fallback) and uses it to construct all scenario timestamps. Request schema is exactly binding/nowMs/platform/scenario; old/missing/seconds-valued time requests fail HTTP400 instead of silently minting host-time fixtures. The sample must be a safe integer millisecond epoch in [1e12,1e13); this is a synthetic-input range check, not a new production authority rule.

Native iOS can supply fractional milliseconds. The harness explicitly floors ONLY that clock sample to ISO timestamp millisecond precision before sending it; less than one millisecond is discarded, never converted from seconds. Verification still uses the original native context.nowMs. Android System.currentTimeMillis is already integral. No native clock is changed, no OS time synchronization is performed, and no production server accepts caller-supplied authority time. This request field exists only in the excluded synthetic tool.

Case A uses sample-1000 ms and sample+7 days. B remains sample-25 hours. C is verified two hours earlier with period end one hour earlier. D still changes one signature byte. E remains validly signed sandbox material rejected in production mode. Commit verifiedAt matches the signed lastVerifiedAt; continuity still ends at min(periodEnd, lastVerifiedAt+86400000).

### Full contract audit

| Contract | Actual match / authority |
| --- | --- |
| Signature | ES256, ECDSA P-256, SHA-256, WebCrypto signature over the original UTF-8 base64url header.payload; actual verifier checks signature |
| Key import | Exported public EC/P-256 JWK, imported public CryptoKey with verify usage; no private d field; installed key matches the live fixture signature |
| Header/version | Exactly alg/typ, typ=gridly-continuity-v1; no extra schema/version field |
| Payload serialization | Real signResponse builds JSON claims; issuer extracts nested continuityAuthorization; verifier authenticates original encoded bytes, then decodes exact 11-field schema |
| Binding | Exact native 64-character lower-case hex binding; no installation identity grants ownership |
| Platform/product | google/gridly_monthly or apple/com.gridlygo.gridly.monthly; exact checks unchanged |
| Environment/state | production, entitled, active required; sandbox/test rejected |
| Identity/audience | audience=com.gridlygo.gridly; source=gridly_server_store_api |
| Google base plan/store | monthly and US, active acknowledged purchase fixture; base plan and package constraints checked by real normalizer, not additional durable claims; packageName omission is permitted by current normalizer |
| Apple store fixture | Real normalizer checks fixed bundle/product/type, matching synthetic original reference and renewal environment, active status |
| Last verification | ISO UTC milliseconds; formerly host-clock value could be in native future; repaired synthetic sample aligns that predicate |
| Period/continuity expiry | ISO UTC milliseconds, end>verified, expiry exactly min(end, verified+24h), now<expiry |
| iat/exp/nonce/reference | Durable schema contains no iat or exp NumericDate, no nonce/reference/basePlan field. Outer five-minute response uses ISO expiresAt and synthetic nonce; these are not durable authorization fields. Original synthetic references only feed normalizer/signResponse, never diagnostic output |

Time units: Date.now and both native nowMs values are Unix milliseconds. iOS multiplies wall-clock seconds by 1000 and converts mach ticks to milliseconds; Android uses System.currentTimeMillis and elapsedRealtime milliseconds. Date.parse(ISO) yields milliseconds. 24h=86400000 ms; outer freshness=300000 ms; fixture seven-day end=7*86400000 ms. There was no ms/seconds unit mismatch: the defect was mixing independent clocks. HTTP regression tests reject seconds, missing/null/string and fractional request samples instead of silently converting them.

### Verification / boundaries

Focused continuity plus all C/D/E/F harness tests: **63/63 PASS** (31 continuity + 32 harness). New direct flow generates a fresh issuer/public key, random real 64-character synthetic binding, issues Google A using a native sample one hour behind host time, and calls the ACTUAL runtime verifyContinuity successfully. It checks the exact header, payload-field set, signed times, period cap and key shape without printing private material. Real-verifier B/C/D/E results: rejected/rejected/rejected/rejected. HTTP end-to-end A–E uses the native sample and matches the same outcomes. Old issuance at sample+1001 ms and sample+one hour fails at native sample but succeeds at host time, proving the precise predicate. Existing diagnostic tests use isolated ports only to test error categories; the proof acceptance regressions use no mock verifier.

Production policy, signer, verifier, native vaults, store billing, configs/manifests and reporting remain untouched. Loopback/CSP/debug guards, framework logging disabled, safe issuer trace, package exclusion, environment/binding enforcement and no-localStorage authority remain tested. The local audit never commits/revokes native authority; the only emulator action was read-only clock/public-APK inspection. No store request, purchase, production mutation, deploy, push or merge.

Final `git diff --check`, JavaScript syntax, changed-file credential-pattern scan (five files), and sensitive-log/projection regression checks: PASS. Repaired native seed/restart A–H evidence remains pending; Node success does not claim native certification GO. LP244.54 remains CLOSED/PASS.

### Exact owner rerun requirement

Stop the old issuer with Ctrl+C in its own terminal. Generate a NEW clone from this repaired source and leave its new issuer running; rebuild Debug and replace ONLY the certification app with `adb -e install -r`. Use the same LP244.65D Android commands above (and verify HTTP scheme plus loggingBehavior=none). Do not run Capacitor sync or overwrite consumer assets in the clone. The frontend and issuer must both be from LP244.65F because POST now includes nowMs; an older issuer correctly rejects the new shape. Do not reuse an APK/public key from a different issuer generation or change emulator/host clocks to hide the mismatch.

Tap A once: expect trace HTTP204/HTTP200, then stage=complete/seeded=true. Force-stop/relaunch the SAME artifact, then Check offline admission: expect allowed=true, temporaryAccess=true, protectedInitializations=1. Continue B–H only after A passes. If it fails, return only bounded UI fields and safe issuer line; never raw proof, binding, attempt, key or HTTP body. Production reporting remains at the owner-disabled baseline with no fresh production query.

## LP244.65G — Native commit contract diagnosis and numeric-read repair

Starting branch: `LP244.65-paid-access-entitlement-runtime`. Starting HEAD: `66b648c877ab0e2dd0e515172f7aa75fdb855dda`. Initial working tree was clean. Owner's Android evidence reaches native_commit after actual proof verification and HTTP200. No observed native crash or KeyStore/Cipher exception establishes a storage failure; force-stop DeadObjectException is unrelated.

### Proven first failing statement

Production Android commit used `call.getDouble("verifiedAt") ?: error("unavailable")`. The installed Capacitor PluginCall implementation accepts Double, Float and Integer but returns the default null for Long. An integral epoch-millisecond JSON number exceeds the Integer range and is parsed as Long by Android JSONTokener ([AOSP source](https://android.googlesource.com/platform/libcore/+/master/json/src/main/java/org/json/JSONTokener.java)). The synthetic fixture uses integral milliseconds, as does ordinary server-signed ISO-millisecond verification time. This is a production native argument-reader defect, not a verifier, clock, attempt or encryption defect.

The source-extracted JVM regression reproduces JSON -> Long -> old getter null; the former Kotlin commit body consequently rejects the same otherwise valid arguments. Changing only the numeric read lets the repaired contract save those arguments through an explicitly in-memory test port. The defect was reported to the owner before source repair. No device rerun of this repaired source is claimed.

Smallest repair: `(call.data.opt("verifiedAt") as? Number)?.toDouble() ?: error("unavailable")`. Missing/null/string/boolean values still fail, with no string coercion. Existing finite and monotonically nondecreasing predicates remain intact. No other production line changed.

### Exact contract and failure branches

| Stage | Actual production contract / failure |
| --- | --- |
| beginVerification | Load/decrypt record and read clock; ready is !blocked && clock.trusted. Return proof only if ready. Persist recoverable=ready, blocked=true and a new random 64-character attempt before resolving binding/attempt/proof/nowMs/clockTrusted. Any load/clock/random/write exception rejects. |
| revoke -> fresh begin | Revoke requires blocked and matching attempt; saves empty record with NEW random binding, verifiedAt=0, no proof, cleared barrier/attempt and reset anchors. Fresh begin creates another attempt. Revoke does not leave an unusable state. |
| Binding | Commit retains the record binding; it does not accept a caller binding. Actual JS verifier checks signed binding/platform/product/environment/signature/deadlines before authoritative commit. Native commit does not independently verify the signed proof. |
| Arguments / guard | String proof required, length 1..4096 characters; blocked=true and exact current attempt equality required. Numeric verifiedAt must be finite and >= stored verifiedAt. No extra argument is missing from the harness. |
| Clock | Commit reads wall time, elapsedRealtime and BOOT_COUNT. It does not require a previous clockTrusted=true because fresh authoritative verification can establish new anchors. Existing clock trust checks remain for restoring/retaining old authority. Clock read failure rejects. |
| Record | Set proof/verifiedAt/utc=max(wall,verified), capture wall/uptime/boot, clear blocked/recoverable and consume attempt by setting it empty. JSON record mutation/serialization failure rejects. |
| Persistence | Serialize UTF-8 JSON, AES-256/GCM with AndroidKeyStore key and alias AAD; write IV+ciphertext through AtomicFile in noBackupFilesDir. Encryption/key/write failures reject; finishWrite precedes saved=true. Existing failWrite preserves the prior durable file on write failure. |
| Return | Success resolves only {saved:true}. Production does not resolve saved:false. operate catches Exception and rejects only continuity_unavailable. The original harness therefore collapsed native rejection into native_commit_failed. |

No changes to AES/GCM, key lifecycle, noBackup placement, AtomicFile, read bounds, boot identity, rollback trust, barrier persistence, 24-hour/period ceilings, denial enforcement, billing, iOS, production manifests/config/app IDs or reporting. No store/production call was made. Reporting remains at the owner-disabled baseline, not freshly queried. LP244.54 remains CLOSED/PASS; old LP244.22 reset/repair is not replayed.

### Safe diagnostics in generated certification Android app only

The generator first verifies the copied vault bytes against production, then instruments ONLY commit in the separate debug certification clone. Production plugin has no diagnostic endpoint/logging. Generated native helper requires BuildConfig.DEBUG; existing release task and activity guards and com.gridlygo.continuitycert identity remain. Original storage/clock and begin/retain/revoke source are unchanged in that copy. Manifest now honestly records both productionVaultSha256 and generated vaultSha256 plus certificationCommitDiagnostics=true (Android); iOS remains byte-identical with diagnostics=false. Earlier C/F byte-identity statements describe those prior phases; the Android generated copy is now deliberately instrumented.

On generated commit failure: {saved:false,nativeCommitCategory:<fixed enum>}. Frontend shows it only with stage=native_commit/errorCategory=native_commit_failed, and clips arbitrary native text to unknown_commit_failure. No raw rejection message is read.

Enums: attempt_invalid, attempt_mismatch, verified_at_invalid, proof_invalid, record_read_failed, clock_failed, record_update_failed, persistence_failed, unknown_commit_failure. Categories identify operation stages, not unproven underlying exceptions. persistence_failed covers serialization/encryption/key/AtomicFile failures; it does NOT claim which one occurred. record_read_failed likewise does not identify a KeyStore cause. No invented clock_untrusted rejection is added to commit.

No proof, attempt, binding, ciphertext, key, storage content, raw exception or stack is logged/displayed. Framework loggingBehavior remains none; issuer trace remains only fixed method/path/scenario/platform/status. Loopback-only issuer/CSP/network policy unchanged.

### Verification and remaining runtime boundary

87/87 focused tests PASS, zero skipped: 31 continuity, 16 paid-access, 3 launch-flow, 1 paid-startup browser, 33 C/D/E/F/G harness and 3 G source/JVM tests. Cached JDK 21, Kotlin 2.2 compiler and org.json 20250517 only; no installation, Gradle or native build here. JVM compiles actual source-extracted Kotlin begin/commit/revoke bodies and generated diagnostic commit/helper; uses installed Capacitor getter/JSObject sources. Storage/clock ports are explicitly in-memory/deterministic and never impersonate Android KeyStore.

Covered: begin returns attempt; valid Long milliseconds save; old getter rejects identical input; mismatched/reused attempts reject; missing/null/string/boolean, negative/older and non-finite times reject; empty/overlong proof rejects; revoke -> new attempt -> valid commit succeeds; failed memory write cannot report success/change persisted record; fixed diagnostic output and unknown-text suppression; no sensitive logging. Existing tests preserve 24-hour/period caps, revocation/denial, reinstall, reboot/rollback, public bypass, protected gating, reporting exclusion, loopback, debug-only shipping exclusion and unchanged production config. Real fixture acceptance still runs the real signer/verifier.

Final diff/check and syntax/credential/sensitive-output checks PASS. Actual Android KeyStore commit and restart A–H remain OWNER RUNTIME EVIDENCE REQUIRED. Earlier successful native begin/revoke/fresh-begin already demonstrate some encrypted reads/writes on that device; they do not certify this repaired commit or every storage failure branch. Full native certification GO is not claimed.

### Exact owner Android rerun

Stop the old issuer with Ctrl+C in its own terminal. Terminal 1, keep running:

```powershell
Set-Location C:\GitHub\liberty-county-map
$certRoot = Join-Path $env:TEMP ('gridly-continuity-cert-' + [guid]::NewGuid().ToString('N'))
node tools/native-continuity-certification/prepare.mjs --platform android --output $certRoot
```

Terminal 2: copy only the printed nonsecret output path. Use existing SDK/JDK; do not sync Capacitor or install dependencies. Stop on any failed command.

```powershell
$certRoot = 'COPY-EXACT-OUTPUT-PATH-FROM-TERMINAL-1'
$config = Get-Content -Raw (Join-Path $certRoot 'android\app\src\main\assets\capacitor.config.json') | ConvertFrom-Json
$manifest = Get-Content -Raw (Join-Path $certRoot 'certification-manifest.json') | ConvertFrom-Json
if ($config.appId -ne 'com.gridlygo.continuitycert' -or $config.server.androidScheme -ne 'http' -or $config.loggingBehavior -ne 'none' -or $manifest.certificationCommitDiagnostics -ne $true) { throw 'Wrong certification artifact' }
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Existing Android SDK required' }
Set-Location (Join-Path $certRoot 'android')
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Certification compile failed' }
adb -e reverse tcp:8765 tcp:8765
if ($LASTEXITCODE -ne 0) { throw 'Reverse failed' }
adb -e install -r (Join-Path $certRoot 'android\app\build\outputs\apk\debug\app-debug.apk')
if ($LASTEXITCODE -ne 0) { throw 'Certification install failed' }
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'Certification launch failed' }
```

Tap A once. Expect HTTP204/200 trace, stage=complete, seeded=true, protectedInitializations=0. If failure, stop and report only scenario/stage/errorCategory/nativeCommitCategory/httpStatus/count and safe issuer line. Do not paste native payload logs, proofs, binding, attempt or HTTP bodies. On success, restart SAME artifact then Check:

```powershell
adb -e shell am force-stop com.gridlygo.continuitycert
adb -e shell am start -n com.gridlygo.continuitycert/com.gridlygo.gridly.MainActivity
```

Expect allowed=true, temporaryAccess=true, protectedInitializations=1. Continue B–H from the existing case matrix only after A succeeds. Never uninstall accepted Gridly or change its config; do not touch the LP244.54 stash, reuse a mismatched issuer key/APK, deploy, push, merge or enable reporting.
