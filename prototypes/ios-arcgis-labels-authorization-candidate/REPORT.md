# Gridly Stage 4B — isolated authorization implementation

November 23, 2026, America/Chicago. Target remains a future Gridly iOS 1.0.2 Build 19. No Build 19 was created.

## A. Executive classification

**AUTHORIZATION_IMPLEMENTATION_PARTIAL.** The JavaScript/server and PostgreSQL authorization candidate passes its available local checks, including real independent-connection SQL races/rollback and protected subscription regressions. Native adapter/plugin copies and three future XCTest cases exist, but Swift/Capacitor compilation and execution are unavailable on Windows. Exact immutable native-commit and signed Android 1.0.2 (17) AAB identity could not be independently re-established from the accessible local artifacts. These limitations prevent an unqualified implementation/certification PASS; no security regression is currently demonstrated.

## B. Starting HEAD and worktree

Workspace: `C:/Users/gulfi/.codex/worktrees/48e3/liberty-county-map`.

HEAD: `cf60e7a7158501b7229b31f1c970547180bf57a6`, detached. Existing dirty state consisted of the eight untracked files in `reports/build19-labels-authorization/`; tracked source was clean. The candidate directory did not exist. Stage 4A was reviewed from the approved chat design; its decisions are recorded in `DESIGN.md`. The preceding blocker report was read without alteration.

## C. Preservation evidence and limits

`evidence/preservation-before.json` and `preservation-after.json` match: HEAD, detached state, shared refs hash, all 41 worktree registrations and status outside this candidate are unchanged. Current-worktree tracked diff is empty. `tools/verify.mjs` checks this again.

`evidence/source-copies.json` pins 141 reviewed source copies; both their originals and copies were rehashed successfully. All 32 gateway certification manifest entries and six foundation copy relationships verify. No certified prototype original was modified. Read-only Git status inspection of other worktrees remains sandbox-restricted; no claim is made to have certified every external dirty/untracked byte. No command intentionally wrote to those worktrees.

Exact Build 18 source was read from the existing standalone Git object database at `C:/Users/gulfi/.codex/worktrees/f695/liberty-county-map/.artifacts/lk18s/.git`, commit `8cb40f70fc29bcfb441245751b667790b0e9e6b2`. The current worktree is older; five authorization/composition files differ, as the previous audit recorded. Tests against that older worktree are identified separately below.

Native commit `891a8b14f262434995b96ed7380b1107ce296ab1` was not available in the previously inspected local object databases. Run `43468734712` remains the user-supplied/existing-plan certification reference; no remote evidence was fetched or workflow rerun. Working-source parity with the gateway's pinned manifest is verified; immutable native-commit parity is not newly claimed.

No signed versionCode 17 AAB was located in the inspected artifact locations. A local versionCode 15 AAB was found and was explicitly not substituted for version 17. Android binary identity, Internal testing and public release state were not queried or changed. The exact version 17 artifact location/hash remains a handoff prerequisite.

Local `main`: `9c28c0020aa6ae57882328cf88f6bef40c80359e`. Local `origin/main`: `cf60e7a7158501b7229b31f1c970547180bf57a6`. Remote main was not contacted.

## D. Exact files created

Everything created is below `prototypes/ios-arcgis-labels-authorization-candidate/`. Complete paths and hashes are in `evidence/inventory.json`; original/copy identities are in `evidence/source-copies.json`.

- `sql/labels-auth.sql` — additive private schema and three procedures.
- `server/policy.mjs`, `labels-rpc-ports.mjs`, `labels-challenge-adapter.mjs`, `labels-attest-adapter.mjs`, `labels-paid-adapter.mjs` — narrow server ports/adapters.
- `gateway/consumer-runtime.mjs`, candidate `edge.mjs` and inert `index.ts`; byte-preserved gateway lease/proof/provider/state/PNG modules and existing config/runtime helpers.
- `native/GridlyLabelsAuthorizationAdapter.swift`, candidate copies of `GridlyStoreKitPlugin.swift`, `GridlyAppAttestPlugin.swift`, `HTTPSLabelTransport.swift`; unchanged `FixedPathTile.swift`, `LabelTileCore.swift`, `LabelsSchemeHandler.swift`.
- `native/Tests/AuthorizationAdapterTests.swift` — three prepared, unexecuted XCTest cases.
- `tests/fixtures.mjs`, `server.test.mjs`, `preservation-and-reporting.test.mjs`, `postgres.test.mjs`.
- `tools/prepare.mjs`, `assemble.mjs`, `verify.mjs`, `test-disposable-postgres.ps1`.
- `README.md`, `DESIGN.md`, this `REPORT.md` and the evidence files.
- `reference/` — 141 reviewed, byte-preserved files from the exact Build 18 commit and existing prototype working sources. These are reference copies, not new subscription/verifier implementations.

## E. SQL implementation and RPC details

Added private `labels_auth.challenges` with server UUID, fixed purpose, registered key FK, full pinned consumer identity, separate Sandbox StoreKit/production App Attest fields, tile fingerprint, paid-evidence digest, canonical binding, fixed gateway identity and bounded timestamps. RLS is enabled and there is no direct runtime/client table access.

Procedures:

1. `labels_auth.issue_challenge(uuid,text,text,text)` validates a registered production key, bounds storage, cleans at most 500 expired rows and creates a two-minute challenge. UUID comes from the trusted gateway, not the request body. A maximum of 1024 rows and 16 unconsumed challenges per key is enforced. It does not register/reset keys.
2. `labels_auth.read_challenge(uuid)` returns pending fixed context and its associated registered public key/counter to the trusted verifier only.
3. `labels_auth.consume_challenge(uuid,text,text,bigint)` locks challenge then existing key, rechecks database wall time after locks, validates owner/binding/policy and conditionally advances the existing counter while consuming the challenge.

The fixed purpose is `gridly-labels-lease-v1`. There is no caller-selected generic purpose/identity/environment parameter. Unknown fields and alternate purposes fail. The existing `native_challenges` constraint and all subscription RPC definitions/grants are unchanged fixtures.

`labels_auth_verifier` is NOLOGIN with private-schema usage and execution on only those three procedures. It has no direct table or subscription-RPC access. Existing client/service roles have no access to the labels schema/procedures. Definer functions have a fixed search path and schema-qualified references.

The new connection adapter sets transaction-local statement/lock deadlines of 2000/750 ms and has a 3000 ms caller deadline. Connection cancellation/destruction is an explicit required driver contract. No real registry driver or credentials are wired. The successful disposable tests use loopback `psql` with independent connections and the same statement/lock deadlines.

The paid digest is an evidence commitment at issuance. It becomes associated with verified eligibility only when the exact submitted JWS independently passes the existing Apple verifier before lease issuance; challenge issuance alone never establishes ownership.

## F. Shared App Attest counter behavior

The only authoritative counter is `subscription_ops.apple_app_attest_keys.assertion_counter`. No counter exists in `labels_auth`. Existing initial registration and subscription consumption remain unchanged. Labels requires an already registered production key and a fresh assertion. Both purposes serialize against the same existing row, accept increasing counter gaps, reject stale/equal counters and never rewind a committed counter.

The positive database/crypto integration test uses a locally generated synthetic registered key, the unchanged App Attest cryptographic verifier, the labels adapter and the unchanged subscription authorizer. Labels advances the persisted counter to 1; subscription subsequently advances that same key to 2. This is not genuine Apple registration/certification.

## G. Atomicity and replay evidence

Real independent-connection tests prove that a subscription/labels same-counter race has at most one success, duplicate labels submissions cannot both consume, and two labels challenges cannot reuse one counter. Higher-first delivery makes a lower counter reject; a subsequent subscription assertion can still advance.

Owner-only test triggers inject exceptions after the counter update and after the challenge update. Both records roll back in each case. An outer transaction error also rolls back both. No post-mutation false return is used as rollback. Lock-wait tests prove expiry is checked after the shared key lock is acquired; lock and statement deadlines leave state unchanged on abort.

Registry consumption and final labels admission are separate transactions. If a later paid verification, cancellation or lease operation fails, a counter/challenge can remain consumed without a lease. It is not a reusable grant. Obtain a new challenge/assertion; never restore the counter. Interruption between registry/local challenge issuance can leave an expiring orphan. Existing bounded cleanup handles it.

## H. Server adapters

- Challenge adapter strictly accepts `{keyId,spki,paidEvidenceHash}`, canonicalizes the key ID/SPKI and uses trusted registry issuance. No flags or client-selected policy are accepted.
- App Attest adapter imports the unchanged exact Build 18 cryptographic verifier. It checks stored owner, purpose, consumer identity, environments, gateway identity, binding and expiry; requires `apple_assertion`; consumes atomically; rechecks cancellation/expiry before returning a server-only verdict.
- Paid adapter calls the existing injected Apple provider with `sandbox/test`, requires current active/canceled-pending-expiry Apple ownership, future period end and fresh server verification. Existing `fingerprint()` requires the normalizer's private trusted-record brand, so a cloned/client success object is rejected. Purchase lineage remains an opaque keyed fingerprint. No second Apple verifier exists.
- Consumer gateway composition requires all reviewed dependencies. Missing dependencies stay closed. It uses the consumer identity and a bounded JSON challenge body; keeps the existing lease body, tile signing, quotas, replay, emergency disable, PNG checks and provider boundaries. Lease/proof/provider/state modules are byte-identical to the references. No unrestricted proxy or default provider fetch is installed.

## I. Identity and environment separation

Pinned App Attest identity: `2XSH6R7K37.com.gridlygo.gridly`. Labels binding app ID: `com.gridlygo.gridly`. The candidate accepts production App Attest and Sandbox StoreKit only; its Apple adapter maps labels `sandbox` to existing `sandbox/test`. It has no prototype identity fallback and no production-store switch.

Synthetic registered identities/verifier responses are constructor-injected test dependencies only. The production cryptographic verifier was not weakened. No bundle ID or signing entitlement changed.

## J. Native plugin integration

Native-only helpers operate on the same plugin instances/state used by Capacitor. Public bridge method lists are unchanged. Keychain service, install marker, confirmation and default registration path remain intact. The labels-only actor path requires confirmation and cannot generate/register a key. StoreKit evidence is transient; labels never finishes purchases or grants entitlement.

The adapter has injectable native evidence protocols for future XCTest, obtains the labels challenge, uses the existing canonical labels binding and returns the existing lease evidence type. Public SPKI/fingerprint is tied to the transport's native private key. The copied transport uses the existing certified fixed POST builder and existing receipt/expiry validation. Cancellation and generation invalidation prevent stale evidence return. Background/resume wiring into the actual consumer remains a later integration step.

## K. Disposable PostgreSQL results

PostgreSQL **17.10**: **25 passed, zero failed/skipped**. See `evidence/postgres.tap`.

Coverage includes all 30 requested categories grouped across the tests: original subscription issuance/consumption/registration, counter advancement, labels issuance/read/consumption, cross/unknown purpose, independent races, duplicate/out-of-order counters, post-lock expiry, owner/binding/policy rejection, both mutation failure points, outer rollback, grants/RLS, no table access/reset, replay, orphan cleanup, deadlines and unavailable state. Cryptographic integration across both actual authorizers and one database key is included.

Two initial expiry-fixture tests used timestamps violating the table's two-minute lifetime constraint. Their synthetic setup timestamps were corrected; no security check or protected test was relaxed. The first complete run passed 21/23; the final corrected/expanded run passed 25/25.

Restricted process-sandbox startup probes could not validate the local server. Successful runs used the owner-authorized outside-sandbox execution of the loopback-only disposable harness. No automatic approval rejection occurred. The harness verified its generated data-directory identity before fixture loading, stopped its own server, removed the generated cluster and restored process environment. `evidence/disposable-cleanup.txt` records cleanup; `.scratch` is empty. No existing/shared/Supabase database was contacted.

## L. Subscription and paid-report regressions

**114 passed**, zero failures/skips, in ten unchanged existing current-worktree suites: subscription entitlement/server verification, StoreKit, continuity, native authorization, App Attest, challenge gateway, Apple Node adapter, paid access and TestFlight admission. See `evidence/protected-regression.tap`. These run against the older current worktree; they are not full Build 18 consumer certification.

**16 candidate checks passed**, zero failures/skips, including unchanged exact Build 18 paid-report authority. Production entitlement proof is accepted; Sandbox Apple proof, fabricated capabilities and labels lease-shaped objects are denied, and denial cannot reach the synthetic writer. Actual reporting writer/database behavior was not changed or recertified.

The candidate checks also cover existing cryptographic verification of synthetic assertions, binding/identity/environment mutations, missing dependencies, forged flags, branded ownership, expiration/revocation, fixed POST PNG delivery, replay, disabled state, cancellation after counter consumption, source parity and native interface invariants. See `evidence/candidate.tap`. No protected regression failed.

## M. Gateway/fixed-path regressions

**39 passed**, zero failures, one optional benchmark skipped, using byte-preserved existing gateway Edge/foundation suites. See `evidence/gateway-regression.tap`. This includes fixed-path P1363 vector, method/body/origin binding, replay/expiry/revocation, quotas, outage/PNG/fallback, cancellation and no duplicate overlays. The new consumer composition also passed an injected-provider signed-POST PNG round trip. No new native map-rendering certification was run.

## N. Swift compilation status and exact later host requirements

No Swift/Xcode toolchain is available here. **No Swift source compilation, XCTest execution, simulator build or physical-device certification is claimed.** Three XCTest cases are prepared for request/binding construction, generation invalidation and prototype rejection.

A separately authorized macOS run must create a scratch iOS framework/test target named `GridlyLabelsAuthorizationCandidate`, include the seven `native/*.swift` files, link the existing pinned Capacitor 8.3.4 dependency and Foundation/CryptoKit/DeviceCheck/UIKit/WebKit, and compile for the existing supported iOS deployment floor. Include `native/Tests/AuthorizationAdapterTests.swift` in its XCTest target. Supply no Apple/provider credentials and block outbound traffic. Run those mocked tests, then add/execute native lease-expiry, cancellation during lease receipt, shared-plugin instance, unconfirmed-key denial, background/resume and subscription-priority/recovery cases. Cross-check a fresh CryptoKit fixed-POST signature with the existing JavaScript verifier/vector. Do not redo the completed map-rendering experiment.

Resolve any compiler/isolation/interface failure in the candidate before approving consumer integration. Consumer bridge assembly, lifecycle wiring and physical iPhone behavior remain later gates.

## O. Security findings

No demonstrated security or protected regression remains in tested JavaScript/SQL behavior. No actual private-key PEM or configured server secret was found by source review/pattern checks. Synthetic local database password material existed only in the disposable cluster setup and was removed; synthetic signing keys stay in test memory. Public trust anchors and synthetic fixtures are not genuine provider evidence.

Limitations: native code is uncompiled; runtime cancellation depends on a future reviewed DB driver's contract; hosted logging/coordinate privacy is unverified; genuine Apple latency may exceed the gateway's existing six-second operation budget; no live admission/provenance claim follows from these tests. Existing lease bounds do not imply instantaneous propagation of a newly discovered Apple revocation.

## P. Authoritative-registry requirements

A future genuine composition must use the existing authoritative registry and newly approved restricted procedures/connection. It cannot copy the consumer key/counter to an isolated database. Provisioning execution access and advancing the actual registry require separate explicit approval, even for a nonproduction labels gateway. No such access or credentials exist in this candidate.

## Q. Genuine Apple/Esri blockers

Real server-held Apple verifier access, current paid evidence and registered key state remain unconfigured. Esri OAuth scope/bearer acceptance and permission for the first-party paid-app relay, attribution/retention/benchmarking terms, hosted log privacy, request/spend limits and a bounded genuine-tile trial remain unresolved. No Apple or Esri request was made. The fabricated website Referer workaround remains excluded.

## R. Minimum Build 19 consumer changes

After approval/certification: integrate only the reviewed native helper/adapter and fixed-path transport; reuse existing plugin instances and register the scheme handler before WebView creation; replace only Satellite label construction; preserve Leaflet, Standard/World Imagery, 512/−1 alignment, attribution, fallback/recovery and paid experience. Wire lifecycle/entitlement invalidation and bounded recovery. Preserve the reporting recovery bridge and review Build 19's compatibility allowlist entry. Advance build metadata only in that later consumer scope, then certify the exact consumer SHA, sign/upload separately and test the owner's iPhone.

## S. November 30 exposure

The documented original-key rollover exposure on November 30, 2026 is unchanged. No installed binary, key or production service changed. Provider rollover state was not queried; this is the previously documented exposure, not a newly verified outage forecast. No Build 19 delivery is promised by local authorization tests.

## T–U. Git status and publication

Only the new candidate directory is added alongside the preserved prior audit files. No tracked source edits. No new branch/worktree, checkout, reset, clean, rebase, commit, push, fetch, merge, release, hosted workflow, signing or upload occurred. Shared refs/worktree inventory stayed unchanged.

## V–W. Next action and merge recommendation

Owner review of this isolated candidate, followed by separately authorized native/macOS verification and completion of immutable native/AAB artifact provenance. No merge or deployment recommendation yet. Do not authorize genuine registry/provider access until the native and hosting/security gates are explicitly reviewed.

## X. Zero production changes

Confirmed: no production source/RPC/migration/database/credential/deployment change, no real Apple/Esri traffic, no consumer Build 19 creation, no Android/Notifications/Dispatch/reporting/Route Watch modification, and no release operation. All implementation, tests, source copies and evidence are confined to this candidate directory. Only the generated local PostgreSQL cluster was started/written/stopped/removed.
