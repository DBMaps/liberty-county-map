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

`tools/native-continuity-certification/prepare.mjs` creates a NEW directory outside the repository, copying a separate **debug-only** app with ID `com.gridlygo.continuitycert` and visible name **Gridly Continuity CERT**. Production app ID `com.gridlygo.gridly` is preserved. Vault source bytes are compared to the originals and SHA-256 recorded in the generated manifest. Only the continuity plugin is registered in the clone; store/location plugin implementations are excluded. Existing JavaScript store adapters are used with an explicit unavailable fixture port, never a real purchase plugin.

The loopback issuer generates an ephemeral signing key in memory. Only its public JWK goes into the certification bundle. The issuer uses the existing server normalizers/signResponse to create synthetic continuity; private key/proofs/bindings/attempts are never logged or written as diagnostics. The endpoint listens only on `127.0.0.1:8765`, accepts a bounded three-field synthetic seed request, and has no production transport. Keep the issuer process and installed artifact unchanged throughout a case. Rerunning preparation generates another key and invalidates previous evidence.

The generated clone alone enables local HTTP fixture transport (Android cleartext and iOS WebView ATS allowances); its page CSP limits connections to self and loopback. These allowances never modify the original native project. The temporary Android clone links existing node_modules; no dependency installation or Capacitor sync is performed by this tool.

Release safeguards:

- Harness/tools paths are outside the native runtime allowlist, original index, and consumer script manifest.
- Native packaging rejects known harness files/fixture names; final contract verification rejects those names and the synthetic index marker even if the index is renamed/copied.
- Generated iOS bridge fails compilation outside DEBUG; generated Android release tasks fail and its activity requires BuildConfig.DEBUG.
- No consumer query flag, localStorage authority, runtime-global unlock, production signing key, or release entitlement flag exists.
- Copying a certification bundle into production staging fails the contract tests. Deliberately modifying/removing these safeguards is outside this claim.

The certification page calls the unchanged native vault directly to seed only this separate app. Negative fixtures intentionally write invalid synthetic records; the real verifier/coordinator must reject them. No hidden native injection method was added.

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
