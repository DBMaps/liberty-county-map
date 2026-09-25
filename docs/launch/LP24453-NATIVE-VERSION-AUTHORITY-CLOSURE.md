# LP244.53 native version-authority packaging closure

## RCA established before repair

Baseline: main and origin/main both `7d6b382946bcdab25c9da7ba44719f4ad0c86086`, clean tracked tree. Protected prior untracked evidence remains untouched. Working branch: `LP244.53-native-version-authority-packaging-closure`.

Classification: **PACKAGING CONTRACT DEFECT**. Windows Node 24.17.0 reproduces the Mac error with `npm run prepare:native` after provider validation passes, without printing credentials. No tracked file changes occur during reproduction. Logs and before/after status/hash evidence are in ignored `output/lp24453/`. Existing `www` and native identity report are preserved there before bounded certification; no sync or native build is performed.

Call chain: `prepare:native` invokes `build:native-web:configured` (native-assets, then native-web with the owner-local overlay and identity report), then `verify:native-web:configured`. Native-assets copies six ignored rasters and checks the tracked adaptive XML without changing identical text. Native-web `stage(destination, {runtimeConfigFile})` validates the source consumer manifest, composes provider configuration, copies the allowlisted runtime and governed data, replaces remote startup dependencies with local vendors, and calls `communitySubmissionContract(destination)`. The failure occurs before writing that contract and the configured identity report. Verification independently regenerates the contract and compares it with the recorded manifest.

`communitySubmissionContract` reads staged app/index/SW/protocol bytes. `version` comes exclusively from staged `GRIDLY_SW_VERSION`; it is neither package.json nor an HTML-wide version. Its local `scripts(text)` selects ONLY `js/gridly-report-protocol.js` and `js/app.js`, including queries, in HTML order. It validates current-source hashes for app, protocol, package registry and SW; exact source URL parity and protocol-before-app order; SW version/cache presence; APP_BUILD equality; protocol v2; and migration hashes. The offending second disjunct additionally requires both selected query suffixes to equal SW version. The first divergence is the valid app URL `js/app.js?v=lp24448-awareness`, while APP_BUILD and SW both remain `lp244.33-google-play-compliance`.

History proves the boundary:

- `54f7b6a1c58b1fc0ce8a736466ed1e0c4ef06a6b` (LP244.21, report retention/recovery safeguards) introduced the entire guard and paired app/protocol URLs with APP_BUILD/SW `lp244.21e-local-certification`. Other scripts already had heterogeneous revisions (e.g. DriveTexas 831); global URL uniformity was never the invariant.
- `5fcf08e0` aligned protocol v2; `50d87098` updated reporting availability; `d884ec50` moved the coupled app/SW/reporting labels to LP244.33 and added the fifth schema digest without updating the old test's count of four.
- `a029bb3a` introduced the ordered consumer manifest with heterogeneous URLs. `9ac13c47` changed the app query to `lp24447-approved-png`; `3476d1bb` recorded that exact URL in the manifest. Neither changed APP_BUILD/SW or the packaging assertion. This is the first independent app cache revision after LP244.33.
- `5eb003a8` advanced index and manifest together to `lp24448-awareness`. `4114066b` explicitly preserved it and added map visibility `lp24448f2`; see LP24450A1-MANIFEST-CLOSURE.md, which also states the SW shell cache is a separate boundary. The packaging assertion remained unchanged.

Expected behavior: certify those current source bytes and exact per-script identities while rejecting retired, reordered, mismatched or tampered payloads. Actual behavior: reject current certified bytes before verification. Launch impact: native preparation blocked before iOS sync on both platforms. Earlier LP244.50A1/51A certification deliberately validated the consumer manifest without staging. The native-packaging suite mostly checks source contracts; the executable launch-contract and startup-stage tests do expose the blocker but also carry stale expectations. This is not an untested Mac-only branch.

Smallest repair: remove only the requirement equating the two URL cache revisions with the SW token. Preserve the immediately preceding exact source URL/order check, APP_BUILD/SW equality, all hash/protocol/schema checks, consumer manifest validation and native verification. No new global token, runtime version change, SW change, reporting activation or provider change is justified.

## Version inventory and semantics

| Authority | Current value | Classification / role |
|---|---|---|
| package.json (and lock root) | 276.1.0 | PRODUCT VERSION: npm metadata; not a native or PWA authority |
| APP_BUILD | lp244.33-google-play-compliance | AUDIT/LEGACY IDENTIFIER and retained app/PWA compatibility token |
| GRIDLY_APP_VERSION_LABEL | Gridly V204.0B | Human-facing product/version label, independent of npm metadata |
| GRIDLY_APP_BUILD_LABEL | Build 1710 | HUMAN-FACING BUILD LABEL |
| index script URLs | 80 ordered entries, 60 distinct `?v=` values | PER-SCRIPT REVISION / CACHE-BUST ID; some entries have no query |
| consumer-script-manifest | gridly.consumerScripts.v1 | Exact ordered path-plus-query identity, not one release version |
| GRIDLY_SW_VERSION | lp244.33-google-play-compliance | PWA version-message/compatibility authority |
| GRIDLY_CLOSURE_CACHE_NAME | gridly-pwa-shell-lp24433-v1 | PWA CACHE AUTHORITY |
| manifest.json | no version field | Install metadata, icons, start URL, scope |
| Android | versionName 1.0.0; versionCode 1 | NATIVE PACKAGE VERSION |
| iOS | MARKETING_VERSION 1.0.0; CURRENT_PROJECT_VERSION 1 | NATIVE PACKAGE VERSION |
| Capacitor | com.gridlygo.gridly; webDir www | Package identity/stage location, no release version |
| native identity report | candidateGitSha, SHA-256 bundle/files/config | Content identity of prepared bytes, not semantic version |
| submission contract | gridly.communitySubmissionBundle.v2; protocol 2 | Protocol/schema identity, SW metadata, source URLs and digests |

APP_BUILD is used for live-sync status text, passive about/audit signals, diagnostic version strings and a legacy local feedback record. The user-facing Settings and feedback product labels use the separate version/build labels. No APP_BUILD-driven cache invalidation, SW registration URL, protocol authorization, security decision or native package version was found. The retained equality guard and coordinated LP244.21/23/29/33 history independently support keeping APP_BUILD/SW coupled. An old-looking label alone is not evidence for changing production behavior.

SW navigation is network-first with `cache: no-store`, updating cached index and falling back offline. Installation precaches a fixed shell URL list and calls skipWaiting (including its catch path); activation deletes recognized old Gridly caches and claims clients. Listed runtime/geometry URLs are cache-first. URL matching compares full href; there is no ignoreSearch. Query-bearing app/protocol URLs are not in that list and pass through to browser networking/cache. SW version messaging is passive; app registration uses `./service-worker.js`, detects update state and offers an update with submission-aware reload handling. No runtime equality comparison forces per-script queries to equal APP_BUILD. Native file lookup strips query/fragment while HTML preserves queries and source order.

Globally rewriting queries would alter 60 distinct cache identities across the governed startup list, require corresponding manifest changes, and change browser request/cache behavior with no architectural justification. Exact affected counts depend on the proposed replacement token; none is proposed. The current manifest independently passes with 80 startup URLs, 80 consumer runtime files and 81 native JS files (one opted-in diagnostic). Native local-vendor substitutions are intentional, while the copied manifest remains the source browser contract.

Regression requirements: current configured staging must succeed with heterogeneous app/protocol queries; deterministic contract generation and configured identity verification must pass; changed queries/order, client bytes, SW bytes, stale contract and manifest divergence must still fail. Tests must use platform-neutral temporary paths and synthetic configuration rather than ambient Android assets or real credentials.

## Repair and certification

Only production tooling change: remove the URL-uniformity disjunct in `communitySubmissionContract`, with an explanatory comment. No runtime app, index, manifest, SW, native project, dependency, provider or asset changes.

Evidence-based test maintenance:

- LP244.21: schema count 4 to 5 follows `d884ec50`'s compliance migration; replace a test certifying ignored, ambient Android output against LP244.29 constants with an isolated retired-client rejection. Current configured bundle acceptance is covered by the new LP244.53 CLI test, including actual verifier execution.
- LP244.30A: startup/runtime/native counts 77/77/78 to 80/80/81 follow the two marker modules added by `3476d1bb` and map visibility added by `4114066b`. Exact ordered manifest parity and file-byte checks remain.
- LP052.2: version/cache expectations advance from LP244.21 to the unchanged LP244.33 authority, introduced in `d884ec50`. The lifecycle behavior assertions are unchanged.
- Three LP244.5/5C tests still required the app query to equal APP_BUILD. Replace those stale relationships with exact current per-script identity. Two also pinned the former CSS query; `9ac13c47` explicitly advanced CSS to `lp24447-approved-png`. Retain app/SW equality and all behavior checks. Baseline targeted failures are recorded before these changes; complete suites pass afterward.
- New LP244.53 tests run the current configured native CLI with synthetic keys in platform-neutral temporary directories, verify its report, preserve app/map/SW/manifest bytes, and reject identity-report tampering, changed app/protocol queries, missing/reordered protocol, all four altered client hashes, stale contract records, and manifest query/order/map omission. No real keys or device assets are test inputs.

Baseline main suites: 36 tests, 32 pass, 4 fail (two version-drift failures, stale ambient Android, stale startup count). Baseline PWA lifecycle fails on old LP244.21 literals. These establish both the real blocker and test drift; none was hidden or skipped.

Final bounded gates, all with zero failures and zero skips:

```powershell
node --test tests/lp24453-native-version-authority.test.mjs tests/lp24421-launch-contracts.test.mjs tests/native-packaging.test.mjs tests/lp24430a-prelaunch-startup-cleanup.test.mjs tests/lp24451a-ios-preflight-closure.test.mjs tests/lp0522-pwa-update-lifecycle-audit.test.js tests/lp24450a-alerts-heading.test.cjs tests/lp24450a-marker-reconciliation.test.cjs tests/lp24447-marker-system.test.cjs
# 89 passed
node --test tests/lp2445-bare-texas-place-destination.test.mjs tests/lp2445c-consumer-visual-search-closure.test.mjs tests/lp2445c-owner-acceptance-correction.test.mjs
# 15 passed
node --test tests/lp2444-api36-first-launch-repair.test.mjs tests/poi-production-packaging.test.mjs tests/lp24433-google-play-compliance.test.cjs
# 19 passed
node tools/native-provider-config.mjs validate
npm run prepare:native
node tools/native-provider-config.mjs verify-staged
git diff --check
```

**123 tests pass. Configured preparation and verification pass completely.** No manifest, provider, asset or version-authority failure remains. The logged identity mismatch in the new negative test is intentional and asserted; the real configured gate passes.

Payload: **987 files, 237,086,526 bytes**, 86 certified POI shards and their 86 native aliases, current governed crossing/package data and native address projection. Digest:

`sha256:5a747088d6b9d0de9038416d105de690d8e27b3e268f0b62302ac6f54792d183`

Independent `output/lp24453/check-payload.mjs` checked every recorded file's hash and size and recomputed the bundle digest; all governed JS bytes except the intentionally composed provider file match source. That provider file exactly matches composition of the canonical config and owner-local input, without logging either value. Source index differs only by the three established vendor replacements. Source consumer manifest is byte-identical in the bundle. Native verification independently checks vendor assets, CSS references, data membership, certified POI/address bytes, prohibited files, size budget, submission contract and identity report.

- app.js SHA-256: `7f6780373492043f2655e1f24e678896465ef27acabaaaa88e281c7fec8bffcd`
- map visibility SHA-256: `c343d2d94a0c8b02e40b89172efbee92de933d7d2a4ab0bd8efe63711915fd38`
- 69 startup scripts carry queries, with 60 distinct revisions. A rewrite to LP244.33 would change 67 existing query identities; LP244.48 would change 68; package version would change all 69 (and invent identities for any additionally normalized unversioned entries). None was changed.

Preservation: tracked runtime/native/configuration diff is empty; recorded source hashes are unchanged. LP244.50A Alerts source-health and marker reconciliation tests pass. LP244.50A1 map visibility and ordered parity pass. LP244.51A deployment targets and SPM floor remain 16.4, bundle ID remains `com.gridlygo.gridly`, foreground-only permissions and plugin list remain unchanged. Opaque RGB icon hash remains `ca9ae7f238d2cc3bd41bf2f61a41d9f67788ab1df9eb579fea995443c506e6fd`. LP244.52A notification truthfulness is preserved through unchanged production app/index/CSS; no push delivery or reporting enabled.

Certification-only payload and identity report have been moved to ignored `output/lp24453/certification-web` and `certification-identity.json`. Any pre-existing default `www` and identity report were restored. The isolated payload is not a final launch candidate. The report's candidateGitSha records the baseline HEAD during the repaired working-tree certification; the tooling repair and test/document changes do not enter runtime payload bytes. Prior untracked launch evidence was not staged, edited or deleted.

## Mac handoff

The deterministic regression exercises the same platform-neutral native-web configured staging and verification entry points as the Mac failure. The one removed assumption is independent of Windows path syntax and line endings. On a Mac checkout containing this repair with its ignored owner-local configuration already in place, run:

```sh
node tools/native-provider-config.mjs validate
node --test tests/lp24453-native-version-authority.test.mjs
npm run prepare:native
node tools/native-provider-config.mjs verify-staged
```

Expected: current app/protocol queries accepted, exact source/manifest/order/hash checks retained, configured identity verified. Bundle digest can differ across checkout EOL conventions or owner configuration; compare each stage to its own current source and generated report. Actual Mac rerun and physical Android/iPhone acceptance remain pending. No Capacitor sync, Android build, iOS build, push or merge was performed here.
