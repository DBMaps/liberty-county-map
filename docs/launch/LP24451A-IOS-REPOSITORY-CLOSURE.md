# LP244.51A iOS repository preflight closure

**PASS — REPOSITORY READY FOR MAC/IPHONE PHASE**

Branch: `LP244.51A-ios-repository-preflight-closure`.
Starting HEAD: `aee1341696edabf99ce8f902f3c22ea0ef1e540c` (verified main == origin/main, no tracked edits).
One local commit is authorized after the gates below. No push or merge.

This supplements the protected LP244.51 audit/proofs without modifying them. The old proof intentionally describes the old baseline and is not the closure test. Closure command:

```sh
node --test tests/lp24451a-ios-preflight-closure.test.mjs tests/lp2444-2-native-search-geolocation-runtime.test.mjs
node tools/native-provider-config.mjs validate
node tools/ios-appicon.mjs --verify
```

Results: **14 tests passed, 0 failed** (6 new closure tests plus all 8 existing geolocation/search tests); provider validation PASS, without printing credentials; deterministic icon verification PASS. No native candidate stage, sync, Android build, Windows iOS build, reporting activation or production write occurred. Native-copy tests use unique disposable temporary directories, never the checkout's native output directories.

## D1: owner-approved iOS 16.4 minimum

RCA: the repository allowed iOS 15 although production POI/address/Montgomery roadway loaders require DecompressionStream, introduced in WebKit 16.4. The owner explicitly chose a 16.4 minimum instead of a polyfill.

| Governing declaration | Before | After |
|---|---|---|
| Xcode project Debug, `project.pbxproj:233` | 15.0 | 16.4 |
| Xcode project Release, `project.pbxproj:284` | 15.0 | 16.4 |
| App target Debug, `project.pbxproj:301` | 15.0 | 16.4 |
| App target Release, `project.pbxproj:323` | 15.0 | 16.4 |
| `ios/App/CapApp-SPM/Package.swift:7` | `.iOS(.v15)` | `.iOS("16.4")` |

The Xcode diff changes exactly those four values. The SPM diff changes only its platform declaration. Bundle ID remains `com.gridlygo.gridly`; version/build remain 1.0.0 / 1; iPhone+iPad targeting and orientations are unchanged. Tests compare the entire configuration against the starting commit after only the intended replacements. No production decompression consumer was changed. Historical audit statements and third-party minimums are not governing Gridly launch declarations and are preserved.

Additional direct RCA evidence: Capacitor 8.3.4 `node_modules/@capacitor/cli/dist/ios/common.js:getMajoriOSVersion` reads only two characters of the Xcode deployment version. `dist/util/spm.js` regenerates `.iOS(.v${iosVersion})`. A later sync would therefore lower SPM to `.v16`. The minimal `capacitor:sync:after` hook in package.json invokes `tools/ios-deployment-floor.mjs`, only for iOS. It verifies all four Xcode floors are exactly 16.4 and replaces the known generated `.v16` declaration with the exact minor floor; unknown declarations fail closed. Tests reproduce major-only SPM generation in an isolated fixture, verify correction/idempotence, and reject mismatched targets/unexpected SPM declarations. No Capacitor dependency was patched or upgraded. Android sync is a no-op for this hook.

**PASS — CONFIGURATION ALIGNED.** Actual SPM resolution, Xcode acceptance/build/archive and physical compatibility remain **MAC/XCODE REQUIRED**. Use the planned `npx cap sync ios` workflow; if using a standalone `cap update ios` instead, explicitly run the same iOS post-sync hook and recheck the floor because this hook is attached to sync.

## D2: opaque default AppIcon

RCA: the default universal catalog used the shared transparent master (999,004 nonopaque pixels). The native-assets tool previously copied that master verbatim for iOS. Android uses separate 192px legacy and 167px adaptive sources; neither mapping needed to change.

Generation uses the PNG codec already installed through pinned Playwright 1.54.2, with no added dependency. `tools/ios-appicon.mjs --write` creates a dedicated source derivative. It applies standard alpha compositing at original pixel coordinates onto **#071826**, sampled from the approved portrait splash background. No resize, crop, text, mark replacement or redesign. The source is untouched. Output is encoded as RGB PNG. Visual inspection confirms the approved mark remains centered and fully contained.

| Property | Result |
|---|---|
| Shared input | `assets/store/icons/gridly-icon-master-1024.png` |
| Shared input SHA-256 (unchanged) | `35dd199b10af5914b832c0db08ddef4f1938eb46de1d1f2d1466134ab3d111e4` |
| Opaque derivative / new iOS copy source | `assets/store/icons/gridly-ios-appicon-1024.png` |
| Dimensions | 1024 × 1024 |
| Format | Valid PNG, color type 2 (RGB), no alpha channel |
| Decoded alpha | Every one of 1,048,576 pixels is 255 |
| Derivative SHA-256 | `ca9ae7f238d2cc3bd41bf2f61a41d9f67788ab1df9eb579fea995443c506e6fd` |
| Native destination, verified only in temporary output | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |
| Catalog | Existing universal/default 1024×1024 reference unchanged |

`tools/native-assets.mjs` changes exactly one source mapping: iosIcon now points to the derivative. All other logic/mappings match the baseline. The derivative is tracked source artwork, not a staged native candidate. Existing ignored native AppIcon remains stale by design until final preparation. Isolated output was decoded/compared to the derivative; every derived pixel was checked against the original compositing formula; regeneration produced identical bytes.

**PASS — OPAQUE SOURCE AND COPY CONTRACT VERIFIED.** Compiled AppIcon acceptance, generated appearances, archive and upload acceptance remain **MAC/XCODE / APP STORE CONNECT REQUIRED**. The codec import is internal to the pinned Playwright distribution; revalidate this bounded tool if Playwright is upgraded. It is not shipped as consumer runtime code.

## Preservation and remaining gates

- Android legacy/adaptive sources and mappings: unchanged against starting Git blobs; isolated generated PNG bytes match the original sources. No Android build performed.
- Splash source and both platform mappings: unchanged, isolated output byte-identical. Portrait source SHA-256 remains `ea0ac2ae03b9b121fcf0a836c5872bef25241b4bb557779f047360d273b68960`.
- Shared master, web branding, app runtime/decompression, index and consumer manifest: unchanged. Manifest consistency passes with `js/gridly-map-visibility.js?v=lp24448f2`.
- Info.plist: unchanged; NSLocationWhenInUseUsageDescription retained; no Always permission, background mode, ATS exception or push permission added. No native geolocation/plugin/privacy-manifest work.
- R1: **PHYSICAL IPHONE REQUIRED**. iOS still uses WKWebView/browser geolocation; test prompt, precise/approximate, success, denial, retry, Around Me, marker, Return Home and Route Watch foreground behavior.
- R2: **FINAL CONTROLLED STAGING REQUIRED**. Existing ignored www/iOS public trees remain stale and unmodified. After candidate selection, one `prepare:native`, then Mac `cap sync ios` (post-sync floor guard included).
- R3: **PHYSICAL IPHONE / TESTFLIGHT REQUIRED** for capacitor://localhost provider behavior. No security/key changes.
- R4: **MAC/XCODE VALIDATION REQUIRED** for resolved SPM/archive privacy resources. No speculative manifest.
- iPad remains targeted (family 1,2); iPad acceptance/store screenshots remain a consideration. Portrait authority and supported landscape orientations remain unchanged.
- Signing/team, physical acceptance, Archive, TestFlight and App Review remain unperformed. This PASS applies only to repository preflight.

Commit boundary: the two governing iOS files, package hook, two bounded tools, one native source mapping, one opaque source derivative, bounded regression test, and this closure document. Prior protected artifacts, local provider configuration, generated www/iOS public, screenshots and browser profiles are excluded.
