# LP244.54 — physical iPhone acceptance harness

**Status: portable harness locally tested; Mac compilation, installed-tool discovery, and physical execution remain pending. Physical acceptance is NOT CERTIFIED.**

The source baseline is main at `bbe837cc2a94214510e04b39c06626fd66b36a24`. Physical execution will occur from Codex running locally on the connected Mac at `/Users/crissy/GitHub/liberty-county-map`, using Xcode 27, `xcrun devicectl`, and Denise’s real physical iPhone. No cloud execution or SSH connection is required or used. The supplied Mac/device facts below are owner evidence, not observations made by this harness. No synthetic test result is represented as physical evidence.

## Scope and implementation

The transfer commit contains exactly four implementation files in `tools/lp24454/`, `tests/lp24454-iphone-harness.test.mjs`, and this report. No production file, dependency, native project, credential, ATS setting, provider endpoint, reporting state, or database is changed. Transfer preparation creates one local commit; pushing remains a separate owner-authorized step. No merge is required.

- `run.mjs`: bounded Mac orchestrator, installed `devicectl` help discovery, source/device/app/destination preflight, preservation snapshots, separate test-runner generation/build, real-device execution, screenshot/console commands, XCTest attachment export and report generation.
- `core.mjs`: pinned authorities, fail-closed evidence parsing, protected-state comparison, stage/sync critical-file comparison, separate Xcode project generator, log redaction and conservative visual classification.
- `GridlyAcceptance.swift`: public XCTest/XCUIAutomation against the already installed `com.gridlygo.gridly`. Semantic, unique, hittable controls only. No coordinate fallback or production test hooks.
- `analyze.mjs`: exported screenshot metadata/accessibility analysis, per-page copy/image/navigation frames and named-pager relative measurements. Does not invent DOM card bounds or safe-area geometry.

The baseline source project has only the App application target, no UI-test target. The harness therefore generates a **separate UI-testing project in its own evidence directory**, not an edit to `ios/App/App.xcodeproj`. It has no App target or production target dependency. It builds/signs the acceptance runner with team `2XSH6R7K37`; its bundle is `com.gridlygo.gridly.lp24454tests`. The runner activates Gridly using its existing bundle ID. This generated project and Swift code require actual Xcode validation; Windows tests do not establish that Xcode 27 can build/sign/run it.

If a UI-test target subsequently exists in the source project, preflight stops for review so that the existing target can be preferred. No private CoreDevice framework, undocumented HID binary, Android CDP assumption, simulator, synthetic location or fixed Dayton GPS is used. Advertised HID capabilities are recorded, never translated into guessed input commands.

## Mac execution

After the owner authorizes pushing `codex/lp24454-iphone-harness-transfer` to GitHub, fetch and export only its six portable files. **Keep the Mac checkout on main at the pinned source baseline.** Checking out the transfer branch or cherry-picking the transfer commit would change HEAD and intentionally fail the existing source gate. Exporting the six new paths leaves main, the Git index, and the protected Mac-day native changes intact. Do not replace `ios/`, `www/`, `.artifacts/` or owner-local files. Keep the installed app and onboarding state.

Run locally on the Mac:

```sh
cd /Users/crissy/GitHub/liberty-county-map
git fetch origin codex/lp24454-iphone-harness-transfer
node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git(['branch', '--show-current']) !== 'main' ||
    git(['rev-parse', 'HEAD']) !== 'bbe837cc2a94214510e04b39c06626fd66b36a24') {
  throw Error('Keep the Mac on the certified main baseline; do not reset or discard local state.');
}
const files = [
  'tools/lp24454/core.mjs',
  'tools/lp24454/run.mjs',
  'tools/lp24454/analyze.mjs',
  'tools/lp24454/GridlyAcceptance.swift',
  'tests/lp24454-iphone-harness.test.mjs',
  'docs/launch/LP24454-PHYSICAL-IPHONE-ACCEPTANCE.md',
];
for (const file of files) {
  if (fs.existsSync(file)) throw Error('Transfer path already exists; review before replacing: ' + file);
}
// Read every file before writing any. FETCH_HEAD is the explicitly fetched branch.
const contents = files.map(file => execFileSync('git', ['show', `FETCH_HEAD:${file}`]));
for (let i = 0; i < files.length; i++) {
  fs.mkdirSync(path.dirname(files[i]), { recursive: true });
  fs.writeFileSync(files[i], contents[i], { flag: 'wx' });
}
NODE
```

This transfer refuses to overwrite an existing harness/report. If those paths already exist on the Mac, review them locally rather than resetting or blindly replacing them. The source gate is unchanged. Then run:

```sh
node --test tests/lp24454-iphone-harness.test.mjs
node tools/lp24454/run.mjs preflight
node tools/lp24454/run.mjs run --phase onboarding
```

The onboarding phase activates the installed app without reset. It returns an existing page 2–7 to page 1 using Back and verifies each resulting title inside the named tour region. It captures all seven pages, verifies every Next, exercises page 2 → Back → page 1 → Next → page 2, then taps Finish and verifies the Gridly map/dock. It does not select location or Home. Passive snapshots preserve titles, indicators, logo, navigation and geometry for the Welcome vertical-placement review; only an intended required control is hit-tested, with evidence captured first.

Skip is exercised in a second walkthrough session only through the reopen-only legacy control identified as settingsReplaySetupBtn. The similarly named portrait Settings action is NOT safe: its forceSetupReset path clears saved profile/Home/awareness fields. The harness never invokes that action or matches replay by label alone. If the legacy control is not accessible/actionable, or page 1 cannot otherwise be established, the run reports BLOCKED and preserves sequential/Finish evidence. It does not uninstall, erase data, call JavaScript hooks or claim complete acceptance. Successful Skip must return to the map/dock; onboarding then stops before journey.

To continue through the installed app:

```sh
node tools/lp24454/run.mjs run --phase journey
```

Journey uses the existing Finish action without selecting a town/ZIP/Home, then invokes the actual Around Me control. It captures Home, Around Me, Return Home when exposed, reachable Home/Search/Alerts/Settings surfaces, keyboard/search observations for Dayton/Dallas/Austin, background/resume, orientation and relaunch. It never enters Report or generates a community report. Search attempts and screenshots are observations; they do not alone certify provider success, multi-county context selection, marker identity or saved Home persistence.

During either phase, location before harness contextual intent is captured and stops the test for investigation. After Around Me, a protected prompt produces **HUMAN ACTION REQUIRED**. The owner may choose Allow While Using App if consenting, note Precise Location, and the runner detects disappearance and resumes. It does not press permission/security buttons. Disappearance does not prove which permission was chosen; that field remains unobserved unless independently evidenced. Prompts time out after 180 seconds with evidence retained. Signing/authentication prompts are also owner actions; never broaden Keychain access to get the runner past one.

Optional bounded controls, each redoing preflight:

```sh
node tools/lp24454/run.mjs capture
node tools/lp24454/run.mjs relaunch
node tools/lp24454/run.mjs console
```

`console` explicitly relaunches Gridly and attaches console collection for up to 30 seconds. Its timeout is a collection limit, not a passing runtime test. No existing device log is cleared. Screenshot destination flags are selected only when documented in installed command help; an unknown syntax stops with help preserved. CoreDevice JSON paths preserve the Mac-proven Xcode 27 JSON v5 adapter and its regression fixtures. Unknown schema/readiness stops input automation and requires adapting the harness to the saved actual output; never relax an unknown field into PASS.

Every invocation creates a new `.artifacts/iphone-acceptance/lp24454/<timestamp>-<unique>/` directory. It never overwrites the existing `01-fresh-launch.png` or earlier run. Evidence includes command arguments/status/times, installed help, device/app/destination metadata, native diffs, before/after preservation hashes, structured report and, for UI runs, `physical.xcresult`, exported attachments and analysis. Screenshot dimensions come from the actual XCTest image, not a hard-coded 1290×2796 claim. UI coordinates are points; image dimensions are pixels. Keep these local: screenshots, accessibility trees and device/application inventories can contain private information. Common key/token forms in command logs are redacted; do not assume arbitrary device diagnostics are suitable for public sharing.

## Protection and preflight

Expected physical device is UDID `00008120-000C49A43EC0201E`, iPhone15,3 / iPhone 14 Pro Max, iOS 26.7 build 23H24, wired, paired, booted, connected tunnel, Developer Mode enabled. Expected installed app is Gridly `com.gridlygo.gridly`, 1.0.0 (1). Xcode expectation is 27.0 build 27A266a, and the App scheme must show the exact physical destination. Unknown or mismatched evidence blocks interacting phases. The device is rechecked immediately before XCTest input, after runner build.

Known Mac-day changes are preserved, not normalized:

- project.pbxproj: local signing team selection;
- Info.plist: recorded whitespace changes;
- staged Splash.imageset/Contents.json expansion;
- untracked shared SwiftPM Package.resolved;
- all existing `.artifacts/` evidence.

The harness records index identity, complete tracked binary diff identity and selected protected file hashes before and after. Unexpected changes are reported, never automatically restored. Read-only Xcode discovery is still checked for side effects. Four deployment floors and SPM remain 16.4; foreground-only plist and no permissive ATS are checked. No native geolocation plugin is added. The source gate permits the three known changed native paths, records their actual diff, and rejects unrelated tracked edits.

The five supplied Mac critical file hashes are compared against `www` and synced `ios/App/App/public`; the recorded native identity summary is retained if available. No package preparation/sync/rebuild is invoked. The Mac/Windows aggregate byte difference is not reopened. Installed ID/version/build **cannot establish installed byte identity**; this limitation is explicit rather than claiming that the package on the phone is cryptographically matched.

## Evidence truth and remaining gates

| Gate | This task's actual result | How the physical run contributes |
|---|---|---|
| Host access / Xcode 27 discovery | PENDING local Mac execution | Run preflight on connected Mac; retain actual help/JSON |
| Separate UI-runner compilation/signing | NOT RUN | Build only generated test runner; owner handles security prompts |
| Real iPhone UI execution | NOT RUN | XCTest result bundle, screen captures, semantic tree and timestamps |
| Seven-page onboarding | NOT RUN | Automatic Next/capture; missing/ambiguous controls stop without coordinates |
| Top-biased composition | OWNER-REPORTED SUSPECT; not classified as defect | Inspect all seven physical screenshots and AX measurements; compare shared/page-specific evidence |
| R1 WKWebView real geolocation | NOT OBSERVED | Actual Around Me UI, prompt and terminal screen; exact coordinates/error/permission/Home storage still need exposed runtime evidence |
| R3 capacitor://localhost networking | NOT OBSERVED | Real UI and available console only; no assumption that a rendered screen proves a request origin or successful provider acquisition |
| DriveTexas, Weather, NWS, community read, tiles, search | NOT OBSERVED on device | Capture visible source health/results and correlate with real app-origin network/console evidence |
| Network/provider recovery | NOT RUN | No arbitrary OS network toggling or endpoint changes; needs a controlled physical interruption |
| OS push | Intentionally outside 1.0 launch | No delivery claim, subscription, permission request or implementation added |
| Protected Mac state | NOT INSPECTED from Windows | Before/after native/index/diff hashes; never discard differences |

XCTest accessibility is not a DOM or JavaScript execution bridge into WKWebView. The inspected existing `gridlyNativeProviderOriginAudit` additionally issues its own fetches; it is not proof of all production provider acquisitions and is not silently injected/called. Android's ADB/WebView CDP channel and mock location do not apply. No production hook or plugin is authorized to fill the observability gap. Current internal provider counts, native origin, permission choice, coordinates, persisted Home and precise first error must remain **INCONCLUSIVE** until actual supported runtime evidence is accessible. No automatic PRODUCTION IOS GEOLOCATION DEFECT is generated merely because XCTest cannot read those fields.

The visual analyzer keeps true card/safe-area bounds null unless actually observed. It can report accessible title/body/image unions, logo and navigation frames, and offsets inside the named pager. It does not rename that pager as a card or safe area. Missing geometry or incomplete pages yields **INCONCLUSIVE — HUMAN VISUAL CONFIRMATION REQUIRED**. A future complete, proven geometry set may be screened for upper/lower imbalance using the documented 15%-of-card-height review threshold; this heuristic alone is not a product design specification or defect certification.

## Local validation

`node --test tests/lp24454-iphone-harness.test.mjs`: **81 pass, zero failures, zero skips on Windows**. Node syntax checks pass. Coverage includes wrong-device/source/version/connection blocking, explicit unknown-schema handling, staged/unstaged state preservation, runner isolation, missing payload, redaction, no-coordinate/permission boundaries, conservative measurement/reporting and refusal to execute physical commands on Windows. These are harness tests using synthetic evidence, not device acceptance. Swift compilation and Xcode project validity remain unverified until Mac execution.

Production tracked diff remains empty. Prior untracked launch evidence remains present. The transfer commit is limited to the six portable source/test/documentation files. The generated transfer ZIP and local test logs under `output/` are excluded, as are all unrelated audit artifacts, existing launch evidence, credentials, owner-local/provider configuration, generated native payloads, dependencies and unrelated reports/tools. No device was contacted during transfer preparation, and no production defect was repaired.

## Required post-acceptance security cleanup

**Owner action: review and tighten the Apple Development private key's Keychain Access Control that was temporarily set to “Allow all applications to access this item.”** The harness records this reminder in each run report and does not change Keychain access. Do not leave the temporary broad permission forgotten after acceptance.

## Apple references

Implementation uses Apple's documented [bundle-identifier application targeting](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/init(bundleidentifier:)), [activation without terminating an existing instance](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/activate()), [accessibility snapshots](https://developer.apple.com/documentation/xcuiautomation/xcuielementsnapshot), and [XCTest attachments](https://developer.apple.com/documentation/xctest/xctattachment). Apple's [command-line tool reference](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference) directs discovery through installed command help. These references establish the API choice; they do not substitute for running the exact installed Xcode 27 toolchain.
