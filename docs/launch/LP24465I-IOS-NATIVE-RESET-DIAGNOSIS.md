# LP244.65I — iOS native reset certification diagnosis

## Status / source

2026-09-27. Branch `LP244.65-paid-access-entitlement-runtime`; starting HEAD `01254630ff6cb10d2791502c153b1d036681ca0c`; initial working tree clean. Owner evidence: Xcode 27 / Device Hub simulated iPhone 17 Pro / iOS 26.4, separate `com.gridlygo.continuitycert` app builds/installs/launches successfully. First A tap reports native_reset_failed, protectedInitializations=0, no issuer request.

**LP244.65J superseding result: certification reset RCA CLOSED / PASS.** Owner diagnosed initial_begin / sentinel_delete / missing_entitlement in the unsigned simulator build; normal simulator signing of the same source resolved it. No production iOS defect proven. iOS A–F/H PASS; G not separately runtime-induced (Mac host reboot qualification). Android A–H remains CLOSED/PASS. The original audit below records the earlier unresolved LP244.65I phase; [the authoritative closure](LP24465C-NATIVE-CONTINUITY-CERTIFICATION.md#lp24465j--paid-access-continuity-foundation-closure) supersedes its pending statements.

## Exact seed reset path

The actual harness calls coordinator?.stop, validates platform/vault, awaits first beginVerification, then awaits revoke with that returned attempt and requires revoked=true. Only then does second begin/context/issuer/proof verification/commit occur. On a fresh page coordinator is unset, so optional stop is a no-op; plugin availability or native begin/revoke can still fail. The old generic output did not distinguish these steps.

New safe progress/failure substeps: coordinator_stop, plugin_check, initial_begin, initial_context, revoke. A fixed nativeResetCategory now accompanies native_reset failure; nativeResetOperation and nativeResetStatus are also fixed allowlisted labels. Malformed native results, arbitrary error text/raw OSStatus/extra fields are clipped to unknown and never forwarded. No rejection.message/data/stack is inspected. First-begin attempt shape is checked before revoke. Android certification behavior/result is not reopened; shared changes are in the excluded synthetic frontend only.

## Production Swift audit

| Operation | Actual source / first-run behavior / failure |
| --- | --- |
| loadRecord / directory | FileManager resolves Application Support with create=true, appends GridlyContinuity, creates it, marks it excluded from backup. Any thrown filesystem/resource-value error rejects. Native path/status are not printed. |
| Sentinel | If present marker is missing, delete this service/account Keychain item; only success/item-not-found accepted. Write v1 atomically with completeFileProtectionUntilFirstUserAuthentication. Marker absence prevents trusting a surviving reinstall item. Filesystem/protection failure or unexpected delete status rejects; no fallback removes protection. |
| Read | Generic password query: service, account=authorization, synchronizable=false; no explicit access-group override. CopyMatching requests one Data item. Item-not-found creates a new random-bound empty record and saves it. Other failure/non-Data/size >=16384 rejects; malformed Codable data rejects. |
| Save | JSONEncoder encodes Record, SecItemUpdate tries value replacement. Item-not-found invokes SecItemAdd with AfterFirstUnlockThisDeviceOnly. Non-success update/add rejects. No accessibility/synchronization/grant is broadened. |
| Random | SecRandomCopyBytes fills 32 bytes and must succeed; lower-case 64-character hex for binding/attempt. |
| Clock | sysctl(KERN_BOOTTIME) must succeed; boot string uses seconds/microseconds. Wall epoch milliseconds; mach_timebase_info must succeed with nonzero denominator; mach_continuous_time converted to milliseconds includes sleep. Empty proof is trusted; otherwise same boot and nondecreasing uptime/wall required. UTC is max(wall, storedUTC+nonnegative elapsed delta). |
| Begin | Load, clock, ready=!blocked && trusted; prior proof exposed only if ready. Set recoverable, blocked=true and new random attempt; save barrier BEFORE resolving context. Load/clock/random/save can all fail. No caller proof is required. |
| Revoke | Load current record, require blocked and exact supplied attempt equality, randomize a fresh empty binding and save it, then resolve revoked=true. First begin success is not known from the old result, so revoke failure cannot yet be ruled in/out. |
| Error | Production operate holds NSLock, catches work errors and rejects only continuity_unavailable. It does not expose a safe failure branch. |

### Simulator signing and Keychain isolation

Unsigned CODE_SIGNING_ALLOWED=NO compile/launch success is not evidence that these Security calls succeed. The query does not specify an access group; Apple documents default access-group scope and missing-entitlement failures ([CopyMatching](https://developer.apple.com/documentation/security/secitemcopymatching%28_%3A_%3A%29), [missing entitlement](https://developer.apple.com/documentation/security/errsecmissingentitlement)). Runtime status for THIS app remains unknown. Do not create entitlements, change signing, bypass Keychain or weaken file protection until a bounded status proves the failing API.

Before this phase the copied plugin retained production service `com.gridlygo.gridly.continuity.v1`. Its bundle/sandbox differs, but access-group separation for this unsigned simulator is not proven. The generated certification copy now uses `com.gridlygo.continuitycert.continuity.v1` to avoid reading/deleting ordinary Gridly service items if simulator access groups overlap. Production service/sandbox/query remain untouched. Application Support sentinel remains inside the certification app sandbox. This deliberate fresh service means a successful rerun does NOT retrospectively prove why an older service failed; do not inspect ordinary Gridly Keychain data to investigate that history.

## Generated iOS diagnostics only

prepare first verifies original/copied source byte identity, then transforms only the debug certification copy. Manifest records productionVaultSha256, generated vaultSha256, certificationResetDiagnostics=true for iOS and false for Android. Android instrumentation/source remains unchanged. The generated Swift additionally has a !DEBUG compile error. Tests reverse the transformations and recover original Swift EXACTLY; security guards and API invocation counts are preserved. No production Swift file changed.

Under the existing per-call lock, the generated copy resets fixed diagnostic state and tags the next risky operation. Failure resolves only nativeResetFailed=true plus fixed category/operation/status. Success retains original return values; no failure is reported as a successful begin/revoke/commit. The frontend catches the diagnostic before consuming missing context. No raw NSError/OSStatus/path/data is returned. Framework logging remains none.

Categories: plugin_unavailable, initial_load_failed, sentinel_failed, keychain_read_failed, keychain_write_failed, random_failed, clock_failed, begin_attempt_failed, revoke_attempt_mismatch, revoke_storage_failed, unknown_native_reset_failure.

Operations: unknown, application_support, sentinel_directory, sentinel_backup_exclusion, sentinel_delete, sentinel_write, keychain_copy, record_decode, random, record_encode, keychain_update, keychain_add, boot_identity, timebase, begin_attempt, barrier_write, revoke_attempt, revoke_write.

Security status labels: unknown, success, item_not_found, missing_entitlement, interaction_not_allowed, not_available, auth_failed, duplicate_item, invalid_parameter, other. Status labels are only set from the actual Security API return; raw integer codes/messages never escape. A successful status combined with keychain_read_failed can mean a Data/size check failed, not an API error. Filesystem/clock/random failures have unknown Security status. Revoke save uses revoke_storage_failed with exact encode/update/add operation; no unproven underlying cause is named.

## Separate iOS verifiedAt audit

Installed Capacitor JSTypes.getDouble returns jsObjectRepresentation[key] as? Double; bridge coercion retains NSNumber values. It has no Java Long allowlist. Swift NSNumber casts accept safely representable numeric values, including current integral milliseconds below 2^53 ([implemented SE-0170](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0170-nsnumber_bridge.md)). Thus source/bridging rules support this numeric shape; no analogous iOS defect is proven and getDouble is UNCHANGED. Commit has not been reached in the owner failure and cannot explain native_reset_failed.

New Mac-only `ios-numeric-contract.mjs` extracts the ACTUAL installed getter into a small Foundation Swift probe. It checks JSONSerialization integral milliseconds and explicitly boxed NSNumber(Int64) acceptance, missing/string rejection; prints only one fixed PASS label. No Keychain/store/backend call or fixture data. Windows validates probe generation/source, not its execution; actual Mac numeric probe and WK/native commit remain pending. If the probe fails, STOP and report its fixed result; do not rewrite the getter to make it pass.

## Focused verification / safety

Focused tests: **102/102 PASS, zero failures/skips** (48 iOS reset/harness tests, plus 54 continuity/native commit/paid-access/launch-flow/startup tests). Changed-file credential/syntax scan and sensitive-output/source tests PASS; final git diff --check PASS. Swift/iOS runtime compilation is NOT performed on Windows; Mac compile and numeric-probe execution remain required. JS category tests use explicit ports and do NOT claim Swift/Keychain execution. Generated source contracts verify all API counts, original-source recovery, Keychain accessibility/sentinel/clock/attempt guards, fixed output and release isolation. Existing signer/verifier acceptance tests remain real cryptographic tests; Android native contract remains separately certified.

No production native plugin/config/manifest, policy/24-hour/period cap, billing, backend, reporting, Android closure or accepted app data changed. No real purchase, production request, deployment, push or merge. LP244.54 physical acceptance and its Mac stash are untouched. Old LP244.22 reset/repair is not replayed. iOS A–H remains pending, LP244.65 not fully closed, paid production NO-GO.

## Historical LP244.65I diagnostic rerun (superseded)

These unsigned commands reproduced the earlier diagnostic failure; they are not current acceptance instructions. LP244.65J acceptance used normal simulator signing. For historical reproduction, use the existing Mac checkout containing this reviewed commit, on `LP244.65-paid-access-entitlement-runtime`. Do not apply/pop/drop the LP244.54 stash, reset unrelated files, run native prepare/Capacitor sync, touch the accepted phone, or install tooling. Generated SwiftPM workspace state remains untracked. Stop the OLD synthetic issuer with Ctrl+C; use a NEW clone/APK-equivalent artifact and its matching public key. Leave the new issuer running.

Terminal 1, FROM the reviewed repository root:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
if ! node tools/native-continuity-certification/ios-numeric-contract.mjs; then exit 1; fi
# Require IOS_NUMERIC_CONTRACT_PASS; no Keychain operation occurs in this probe.
cert_root="$(mktemp -d)/app"
node tools/native-continuity-certification/prepare.mjs --platform ios --output "$cert_root"
```

Terminal 2: copy the exact nonsecret generated output path. Existing booted simulator must be the intended iPhone 17 Pro / iOS 26.4. The selector below refuses multiple/no booted simulators. It does not query or operate a physical phone.

```sh
cert_root='COPY-EXACT-OUTPUT-PATH-FROM-TERMINAL-1'
if ! node -e 'const fs=require("fs");const p=process.argv[1];const m=JSON.parse(fs.readFileSync(p+"/certification-manifest.json"));const c=JSON.parse(fs.readFileSync(p+"/ios/App/App/capacitor.config.json"));if(m.bundle!=="com.gridlygo.continuitycert"||m.certificationResetDiagnostics!==true||c.appId!==m.bundle||c.loggingBehavior!=="none")process.exit(1);console.log("IOS_CERT_CONFIG_PASS")' "$cert_root"; then exit 1; fi
sim_udid="$(xcrun simctl list devices booted -j | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const a=Object.values(JSON.parse(s).devices).flat().filter(x=>x.state==="Booted");if(a.length!==1)process.exit(1);process.stdout.write(a[0].udid)})')"
test -n "$sim_udid" || exit 1
if ! xcodebuild -project "$cert_root/ios/App/App.xcodeproj" -scheme App -configuration Debug -sdk iphonesimulator -destination "platform=iOS Simulator,id=$sim_udid" -derivedDataPath "$cert_root/derived" CODE_SIGNING_ALLOWED=NO build; then exit 1; fi
# Keep signing unchanged for this diagnostic reproduction.
if ! xcrun simctl install "$sim_udid" "$cert_root/derived/Build/Products/Debug-iphonesimulator/App.app"; then exit 1; fi
xcrun simctl launch "$sim_udid" com.gridlygo.continuitycert
```

Tap A ONCE. Return only on-screen scenario/stage/errorCategory/nativeResetStep/nativeResetCategory/nativeResetOperation/nativeResetStatus/httpStatus/protectedInitializations and fixed CERT_ISSUER trace if reached. No Keychain dumps, raw logs, proof, binding, attempts, signing keys, purchase evidence or raw stack. A pending progress substep identifies which await has not returned. This is the required next evidence to identify the exact first failing API; do not resend/reseed blindly.

If A completes, restart SAME artifact and Check:

```sh
xcrun simctl terminate "$sim_udid" com.gridlygo.continuitycert
xcrun simctl launch "$sim_udid" com.gridlygo.continuitycert
```

Expect allowed=true, temporaryAccess=true, protectedInitializations=1; no iOS PASS is recorded until actual evidence is supplied. Continue the existing iOS A–H matrix after A succeeds. No Android recertification is required.
