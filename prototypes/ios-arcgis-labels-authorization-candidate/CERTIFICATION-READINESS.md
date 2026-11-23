# Gridly Stage 4C — authorization certification readiness

Date: November 23, 2026, America/Chicago. Readiness preparation only; no hosted run or consumer build was authorized or performed.

## A. Executive classification

**AUTHORIZATION_NATIVE_PARTIAL.** The source-provenance and Android artifact gaps from Stage 4B are now resolved to the extent described below. All 194 Stage 4B local regression checks passed again; three additional preparation checks passed. An iOS 16.4 / Capacitor 8.3.4 certification package, six native XCTest cases and an inert workflow template are prepared. Swift/Xcode compilation and native execution remain unavailable on this Windows host, so no native compile pass or physical-device acceptance is claimed.

## B. Verified source provenance

GitHub read-only inspection confirmed:

- Commit `891a8b14f262434995b96ed7380b1107ce296ab1`, tree `c172cb3b819839977c1516d6277bddced50b73ea`.
- [Run 43468734712](https://github.com/DBMaps/liberty-county-map/actions/runs/43468734712): completed successfully, first attempt, exact commit above, `workflow_dispatch`, workflow ID `372242032`, branch `codex/gridly-ios-label-integration-certification`.
- Successful job `132034715764`: source identity/inventory checks, Node/Deno tests, CryptoKit checks, unsigned simulator build and synthetic native delivery/rendering steps all succeeded. These summaries establish the historical run's result, not a new test of this authorization candidate.
- The existing certification branch still points to `891a8b14…`. Its six listed runs and the latest 20 repository-wide runs contain no newer certification. The prior successful foundation run is `43446641110` at `86ecf2b9…`; the successful integration run is `43288857874` at `2d3a36a…`. No newer run is assumed or fabricated.
- The run's artifact listing is empty now. No retained screenshot was re-reviewed and no rendering run was repeated.

The complete immutable Git tree was read without truncation. Of 93 copied prototype files, **90 match their exact Git blob identities** at the certified commit. All native implementation, fixed-path signing, gateway runtime/proof and existing test sources in that comparison match. The three exceptions are fully identified:

1. Local reference `certification-workflow.yml.in` lacks the certified workflow's `/package.json` sparse-checkout entry. This is the one-line metadata repair in the certified commit.
2. Its local `certification.sha256` consequently has the older workflow hash.
3. `STAGE-3F-HOSTED-PRIVACY-PLAN.md` is a later document absent from that certified tree.

These reference originals were not overwritten. The exact certified workflow and manifest were retained separately for provenance. There is no unexplained runtime/native source drift. `evidence/stage4c/certified-source-comparison.json` records every comparison, and `github-provenance.json` records run/job/tree metadata. No Git fetch, branch update, commit or dispatch was used.

Before any Stage 4C edits, **all 189 Stage 4B inventory entries matched their recorded SHA-256**. That inventory and the earlier TAP evidence were archived below `evidence/stage4c/`. The 141 reviewed source-copy relationships and 32 local certification-manifest entries still verify. Exact Build 18 reference source remains `8cb40f70fc29bcfb441245751b667790b0e9e6b2`, read from its existing standalone object database.

## C. Android AAB identity

**Identity VERIFIED; JAR verification succeeded with recorded tool warnings.**

Retained file:

`C:/Users/gulfi/AppData/Local/Gridly/r102a17-62a3d3a8/out/Gridly-1.0.2-versionCode17-release.aab`

| Property | Read-only result |
| --- | --- |
| Size | `116049539` bytes — exact owner-provided match |
| SHA-256 | `1941c1ddd1b4e807feffbb1d457e1edfc310317edaaab6427fa56fd32e8c33a7` — exact match |
| Package | `com.gridlygo.gridly` |
| Version name / code | `1.0.2` / `17` |
| Signature | JDK 21 `jarsigner -verify`: exit 0, `jar verified.` |
| Signer certificate SHA-256 | `84:FB:65:B7:E3:65:38:DD:1F:B9:57:27:B8:9E:46:44:BB:0C:F5:1A:1B:B2:70:C2:54:26:9D:CD:FC:F7:C8:A3` |
| After inspection | Size/hash unchanged |

Existing bundletool 1.18.1 inspected the manifest; no rebuild/resign occurred. Jarsigner reported a self-signed/untrusted certificate chain, no timestamp, ignored POSIX attributes and JarFile/JarInputStream manifest-order interpretation differences. The full diagnostic is preserved in `evidence/stage4c/aab-signature.log`; these warnings were not suppressed or treated as a fresh Play acceptance certification. Exact artifact identity matches the owner-provided release bytes. No Android release/testing state was queried or modified.

The initial normal searches omitted Git-ignored artifacts. A subsequent read-only `--no-ignore` owner-folder search located this retained output. The unrelated `Downloads/12.aab` and older worktree outputs were not substituted for version 17.

## D. Exact Stage 4B files reviewed

Product-source review covered:

- `native/GridlyLabelsAuthorizationAdapter.swift`, `GridlyStoreKitPlugin.swift`, `GridlyAppAttestPlugin.swift`, `HTTPSLabelTransport.swift`, `FixedPathTile.swift`, `LabelTileCore.swift`, `LabelsSchemeHandler.swift`, and `native/Tests/AuthorizationAdapterTests.swift`.
- `server/policy.mjs`, `labels-rpc-ports.mjs`, `labels-challenge-adapter.mjs`, `labels-attest-adapter.mjs`, `labels-paid-adapter.mjs`.
- Candidate `gateway/edge.mjs`, `consumer-runtime.mjs`, `index.ts`, runtime/config helpers and preserved lease/proof/state/provider/PNG modules.
- `sql/labels-auth.sql`, the exact copied subscription/key-registry fixtures, local test runner and four existing test modules.
- Stage 4B `REPORT.md`, `DESIGN.md`, source manifests and evidence.

The archived inventory supplies exact paths/hashes for all 189 prior files. Every existing product/reference source remains byte-identical. Only prior PostgreSQL evidence outputs were refreshed by the unchanged runner; original evidence is archived.

## E. Native compilation readiness

Added root `Package.swift`: Swift tools 5.9, Swift 5 language mode and iOS 16.4 deployment floor. It compiles the seven existing native source files as `GridlyLabelsAuthorizationCandidate`, with XCTest isolated in `native/Tests`. It has no shipping app target, signing entitlements or build metadata.

The two added XCTest files cover compiled Capacitor method contracts, reuse of the actual plugin instances and public CryptoKit/Node proof/binding parity. Combined with the three existing authorization cases, the prepared native count is **six**, all unexecuted here. Mock evidence ports are used for challenge tests; bridge tests only instantiate/read interfaces and do not call StoreKit or DeviceCheck APIs.

Source review found no confirmed native product defect warranting a change. In particular, labels requires the existing confirmed key; it cannot register/reset one; native helpers do not finish purchases; the same plugin state is retained; private tile keys stay native; and cancellation/generation checks prevent stale evidence return. Actual Swift isolation, lifecycle behavior and subscription-contention recovery still require execution on macOS.

## F. Capacitor compatibility

Reviewed the retained `@capacitor/ios` 8.3.4 package and its actual `CAPPlugin`, `CAPBridgedPlugin` and `CAPPluginMethod` headers. Existing identifiers, JS names and method lists remain unchanged. The candidate package links the same Capacitor and Cordova products used by the consumer's existing package.

The official [8.3.4 SwiftPM manifest](https://github.com/ionic-team/capacitor-swift-pm/blob/8.3.4/Package.swift) pins the binary checksums. The tag resolves to `992959f0467c781eb6a1637e69d87481238c3672`; the future gate requires that version/revision and byte-compares the resolved SDK manifest. Capacitor checksum: `ab16c1187895c9d15692fca2ad8e483adb89cd76803a4069a220ba934a3bb190`; Cordova: `700b28ca65630f512d03ecc13c855e870424ce2aa3030479c10ca6cbc1002d12`.

This establishes dependency/interface provenance and a compatible source-level target. It is not a successful framework link, simulator test or iOS 16.4 runtime acceptance result.

## G. Security and subscription regressions

| Rerun | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Stage 4B candidate checks | 16 | 0 | 0 |
| Disposable PostgreSQL checks | 25 | 0 | 0 |
| Existing protected subscription/paid-access tests | 114 | 0 | 0 |
| Existing gateway/fixed-path/fallback tests | 39 | 0 | 1 optional benchmark |
| New preparation checks | 3 | 0 | 0 |

**194 original checks passed again; 197 including preparation checks.** No protected regression failed. The exact Build 18 paid-report boundary still accepts production entitlement authority and rejects Sandbox Apple/labels-shaped capabilities. Independent PostgreSQL connections reverified the shared monotonic counter, cross-purpose races, replay and both-write rollback. The generated loopback-only database was stopped and removed; `.scratch` is empty.

Evidence is below `evidence/stage4c/`. The new public-vector checker was locally exercised with the already certified signature fixture and mutation rejection; a newly generated Swift/CryptoKit parity result remains pending. No synthetic test is claimed as genuine Apple or Esri verification. The 114 protected tests use the older current worktree, as Stage 4B explicitly documented; they are not full Build 18 consumer certification.

## H. Candidate-only corrections and additions

**No Stage 4B native/server/gateway/SQL or reference source was corrected or replaced.** There was no confirmed product defect. Added certification preparation only:

- `Package.swift`.
- `native/Tests/BridgeContractTests.swift`, `BindingParityTests.swift`.
- `certification/workflow.yml.in`, exact historical `certified-workflow.yml.in`, SDK manifest copy, portable source manifest/generator/verifier and public-vector checker.
- `tests/certification-readiness.test.mjs`.
- Stage 4C read-only provenance/artifact/preflight/final audit tools, this report and evidence.

The workflow template is inert inside this directory. No file under `.github/workflows/` was edited. No architecture, consumer bridge, authorization rule or signing entitlement changed.

## I. Remaining macOS certification requirements

The prepared workflow reuses the proven macOS-26 runner, pinned checkout/upload actions, branch/actor/repository/first-attempt/exact-SHA guards and scratch build locations. It deliberately omits the already completed WebKit/map-rendering experiment.

The future run must:

1. Verify the portable source manifest and exact reviewed SHA; checkout candidate sources only, with no persisted Git credentials.
2. Run 19 packaged Node candidate/preparation checks and 39 existing gateway checks.
3. Run the existing native integration/security package and fixed-path Swift package in separate scratch directories.
4. Resolve only Capacitor/Cordova 8.3.4 and verify the exact revision/checksums; copy the candidate to runner scratch before package resolution/build.
5. Compile/test the actual native framework/helpers and six XCTest cases for an available iPhone simulator with iOS deployment floor 16.4 and signing disabled.
6. Read the public CryptoKit vector from XCTest output; verify P-256 signature, fixed POST canonical bytes, mutation denial and consumer lease-binding parity in Node.
7. Retain synthetic logs/xcresult only; verify the source checkout stayed clean.

No Apple/Esri credentials, production database connection or live evidence are supplied. SDK acquisition uses GitHub; test evidence ports are mocks. The workflow/package have not been exercised by Xcode or GitHub in this stage. YAML was statically reviewed; no local YAML parser was available. Host/toolchain execution is the remaining validation gate. A simulator pass will not establish physical-iPhone acceptance or real provider policy/authorization.

## J. Exact next hosted-run authorization

Request owner approval for **one certification-only commit/push to the existing** `codex/gridly-ios-label-integration-certification` branch and **one first-attempt dispatch** of registered workflow ID `372242032` at the resulting exact reviewed SHA.

Before any write: recheck the remote branch parent (observed here as `891a8b14…`), review the portable manifest and exact staged inventory, and ensure only this candidate plus that certification branch's `.github/workflows/gridly-apple-build-9.yml` differ. Install `certification/workflow.yml.in` byte-for-byte on that branch only. Default-branch/production workflow and delivery tags must remain unchanged. The resulting commit SHA must be verified before dispatch; it cannot be named now because creating it is prohibited in Stage 4C.

Approval must remain limited to unsigned/mock-only native certification, existing native security regressions and synthetic artifacts. It must exclude registry access, real providers, consumer Build 19 integration, signing, upload, merge and release. No commit, push, branch/worktree creation or dispatch occurred here.

## K–L. Genuine-service dependencies and Build 19 readiness

Shared authoritative-registry execution access and counter writes still require separate approval. An isolated copy of the consumer counter is not acceptable. Real Apple verifier access/current paid evidence, Esri OAuth scope/bearer acceptance and paid-native relay terms, hosted log privacy, strict costs/limits and a bounded genuine-tile trial remain unresolved.

Build 19 is not created or ready for signing/TestFlight. After native certification and service gates, the later approved repair still needs consumer bridge/lifecycle assembly, preservation of the existing map/imagery/fallback and paid experience, consumer certification, separate signing/upload authorization and owner-iPhone testing.

## M. November 30 rollover risk

The documented November 30, 2026 original-key rollover exposure is unchanged. Neither installed binaries nor production credentials/services changed. No provider state was queried and no rollout date is promised.

## N. Worktree and Git preservation

Starting/current HEAD remains detached at `cf60e7a7158501b7229b31f1c970547180bf57a6`. All 41 worktree registrations and HEADs remain unchanged during Stage 4C. Local main stays `9c28c002…`; local origin/main stays `cf60e7a7…`. Tracked diff is empty; all additions are inside the existing candidate. Earlier untracked audit files remain in place.

The legacy Stage 4B `tools/verify.mjs` stops on its historical shared-ref hash comparison: Stage 4B recorded `02d6de2330224e9f4d55d2e9ca32ce6631465d48a7b6776d277d9564b3945c26`; Stage 4C began with `7530946a24200c1277b9576ee198e1282df61cd93c355d900fba80214efc4e31`. The latter stayed unchanged during this stage. The discrepancy predates Stage 4C. The old baseline stores a hash, not an individual ref map, so the precise intervening ref cannot be identified from that evidence. No old check was weakened, ref reset or historical baseline overwritten. This preservation finding is separate from the passing authorization/security regressions.

The Stage 4C final audit compares against its recorded preflight and records this limitation explicitly. All protected source-copy identities are rechecked. External worktree dirty/untracked-byte limitations remain as documented in Stage 4B; no external worktree was overwritten.

## O–P. Merge recommendation and production confirmation

No merge or release recommendation. Owner review and the narrowly authorized hosted native run are next.

Confirmed zero production source/database/migration/RPC/credential/deployment changes; zero Apple/Esri requests; no consumer Build 19, signing, TestFlight upload, Android change, Notifications/Dispatch/Route Watch/reporting change, commit, push, new branch/worktree, hosted run, merge or release. Android inspection was read-only and its hash remained unchanged. Only the generated disposable PostgreSQL cluster was written, stopped and removed outside the source/evidence preparation flow.
