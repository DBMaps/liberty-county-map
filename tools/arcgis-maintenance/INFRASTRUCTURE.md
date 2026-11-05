# Native diagnostic infrastructure — offline scope, November 5, 2026

This source is excluded from production native target membership and the consumer web allowlist. No build, sync, signing, installation, real candidate injection or provider request is authorized by this document. Production startup, native projects and version metadata remain unchanged.

## Evidence classes

| Required classification | Result and limit |
|---|---|
| `SYNTHETIC_GATE_VERIFIED` | PASS: existing executable Node gate/ledger tests plus simulated Android/iOS bridge cases. These are not execution of Java or Swift. |
| `ANDROID_NATIVE_ADAPTER_OFFLINE_VERIFIED` | Source-contract checks PASS; compiled-adapter behavior NOT VERIFIED. No Android compilation/build/installation occurred. |
| `IOS_NATIVE_ADAPTER_OFFLINE_VERIFIED` | Source-contract checks PASS; compiled-adapter behavior NOT VERIFIED. No Swift compilation, Xcode build or simulator/device execution occurred. |
| `ACTUAL_NATIVE_RUNTIME_NOT_VERIFIED` | Applies to both platforms. Actual cap, rendering, native logs and provider authorization are not certified. |
| Actual macOS permissions execution | `ENVIRONMENT_UNAVAILABLE` on this Windows host. Policy snapshots are explicitly simulations; the platform integration test skips. |

**NATIVE_TEST_INFRASTRUCTURE_PARTIAL.** Concrete native source and the Mac private-input implementation are prepared; required platform execution and disposable-host wiring remain separate gates. Do not interpret source checks or simulation passes as native certification.

## Audit of the installed Capacitor implementations

Android `Bridge` creates `BridgeWebViewClient`, assigns it and navigates during initialization. The client delegates intercepted requests to `WebViewLocalServer`. Attaching a diagnostic after `MainActivity.super.onCreate` is too late to prove zero initial traffic. [Android's documented callback](https://developer.android.com/reference/android/webkit/WebViewClient#shouldInterceptRequest(android.webkit.WebView,%20android.webkit.WebResourceRequest)) observes the first resource in a redirect chain, not subsequent redirects; returning null allows WebView networking. A counting callback that simply returns null cannot enforce the requested limit.

iOS `CAPBridgeViewController.prepareWebView` registers the local custom-scheme asset handler and creates WKWebView. `WebViewDelegationHandler` handles navigation; it is not a supported HTTPS subresource interceptor. [Apple explicitly rejects registering a handler for schemes WebKit already handles, including HTTPS](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/seturlschemehandler(_:forurlscheme:)). No swizzling, private API, global proxy or TLS exception is proposed.

## Android concrete source

`native/android/GridlyLabelDiagnostic.java` implements a diagnostic-only WebViewClient for an **exclusive disposable host**, before any Capacitor bridge/consumer document is constructed. It refuses a previously navigated WebView. Installation creates only the blank local fixture; it does not load Gridly, Leaflet, reporting or billing. All request callbacks return a response, never null or a Capacitor remote fallback. Service-worker network loads are blocked in that isolated host process, navigation is denied, and pause/stop/destruction/renderer/TLS/error events stop the diagnostic. Console forwarding and web debugging are disabled by this source. Actual OS log behavior still needs synthetic-marker testing.

Transport defaults OFF. A synthetic-only response callback requires a `SYNTHETIC_` candidate. The separate provider-selection method has no automatic call sites, rejects synthetic candidates and requires the exact additional owner live-test authorization string. That method must not be called during offline/synthetic certification. The native fixture must be provisioned with the same owner-bound run ID and ledger across recreation; initialization is explicit and refuses an existing file.

After arming, only the documented candidate Imagery Labels GET is eligible. A durable append-only reservation is fsynced before networking. Exclusive flight files prevent multiple controllers dispatching simultaneously; stale flight markers fail closed. No more than two reservations can be spent. Actual intercepted Referer/Origin values are forwarded unchanged when present and classified for evidence; no headers are invented. Document URL origin is observed on the UI thread and reported separately from HTTP headers.

The provider path uses one authenticated TLS stream and one HTTP request write. It uses system trust with [HTTPS endpoint identification](https://developer.android.com/reference/javax/net/ssl/SSLParameters#setEndpointIdentificationAlgorithm(java.lang.String)), not an automatically retrying HTTP client. It does not follow redirects, negotiate authentication, cache responses or retry failures. Other providers are never forwarded. PNG decoding checks512 dimensions before returning a WebResourceResponse. An explicit second image request is required; normal browser retries cannot escape the native reservation gate.

## iOS concrete source and HTTPS limitation

`native/ios/GridlyLabelDiagnostic.swift` exists only under `DEBUG && GRIDLY_ARCGIS_DIAGNOSTIC`. It creates a new nonpersistent WKWebView after compiling its HTTP(S)-blocking content rule; failure does not fall back to an unprotected view. JavaScript is disabled. A custom `capacitor` handler serves only a fixed blank local document. There is no ordinary HTTPS scheme-handler registration, consumer map or automatic satellite layer.

The explicit native action uses [Network.framework NWConnection](https://developer.apple.com/documentation/network/nwconnection) with system TLS trust/hostname verification, a fixed destination, one HTTP send, no HTTP-client retry/redirect machinery, serial execution, a timeout and durable pre-send reservations. TLS does not install or bypass trust evaluation; see [Apple's documented default trust behavior](https://developer.apple.com/documentation/network/creating-an-identity-for-local-network-tls). Stop/crash/exhaustion markers and exclusive flight files prevent rearming/reset or parallel controllers bypassing the budget. Provisioned ledgers are excluded from backups. Resigning active or WebKit termination stops/cancels the diagnostic.

This is a **bounded native transport probe, not interception or certification of ordinary WKWebView HTTPS images**. It sends no fabricated Referer/Origin, and evidence explicitly says `ABSENT_NATIVE_BOUND_PATH` / `EXPLICIT_NATIVE_TLS_NOT_WEBVIEW_HTTPS`. The UI's actual local document URL is separate evidence. Rendering a returned UIImage does not prove that the released Leaflet layer will authorize or render. The currently supplied provider referrers do not establish authorization for this path. Do not change restrictions or synthesize a permitted web referrer to obtain success.

Both provider transports intentionally accept only a single200 image/png response with explicit Content-Length and no content/transfer encoding. Unsupported framing, including chunked/compressed content, stops with no retry or fallback. This conservative parser's service compatibility is unverified; encountering unsupported framing is not permission to spend another request. TCP packet retransmission is distinct from another application-level HTTP request.

## Mac private candidate-input contract

`mac-private-path.mjs` is a read-only Darwin-only verifier. `tools/native-web.mjs` now forwards explicit `--maintenance-private-root` during maintenance staging and verification. The candidate must be exactly `<authorized-root>/native-provider-config.json`; no root/path default, original fallback or inferred approval exists. On Windows the original PowerShell5.1 ACL helper and module remain byte-identical, with the same protected-ACL delegation.

The Mac verifier rejects lexical traversal, symlink components, repository paths, known sync/cloud paths, broad modes, foreign ownership, hard-linked files, special bits and unsafe ancestors. It requires the current owner, file0600 and private root0700. Read-only `/bin/ls -ldeO` output is captured privately; ACL grants or unknown ACL output are rejected. Deny-only entries grant no additional access. Dataless/offline flags fail closed. Ancestors must be owner/root-owned directories without group/world write access or extra ACL grants. File identity/metadata and the mounted-volume table must remain unchanged through inspection.

Read-only `/sbin/mount` with **zero arguments** inventories volumes; it performs no mount operation. Device matching requires a local APFS/HFS volume, ownership enabled (no `noowners`), and no unsupported/read-only volume. Remote mounts are not probed. Unknown output/no matching proof fails closed. This matters because [macOS may grant access when volume ownership is disabled](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AuthenticationAndAuthorizationGuide/Permissions/Permissions.html), regardless of apparent POSIX bits. [ACLs also extend BSD permissions](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemDetails/FileSystemDetails.html).

Existing maintenance schema, ephemeral private comparison, candidate-versus-original difference, DriveTexas parity and canonical runtime checks remain mandatory. Verification emits only a boolean; command output and credential bytes are never returned or logged. No actual Mac candidate has been provisioned and no real candidate is supplied to these tests.

## Offline test commands

From either isolated maintenance worktree, using existing dependencies only:

```powershell
node --import ./tests/arcgis-maintenance/no-network.mjs --test --test-reporter ./tests/arcgis-maintenance/safe-reporter.mjs tests/arcgis-maintenance/contracts.test.mjs tests/arcgis-maintenance/diagnostic.test.mjs tests/arcgis-maintenance/infrastructure.test.mjs
python.exe -B tests/arcgis-maintenance/run-python-tests.py
powershell.exe -NoProfile -NonInteractive -File tests/arcgis-maintenance/private-path.tests.ps1
```

The new test file labels simulated permission checks and platform bridge simulations explicitly. Native source tests check critical ordering, membership exclusions, single-send sites, trust controls, default-OFF state and prohibited bypass/logging paths. They do not compile or execute native source. The reporter now emits `skip` for skipped cases, rather than a misleading individual pass label. Test summaries retain separate pass/skip counts. The offline subprocess guard additionally permits only the two exact read-only Mac metadata commands; network clients and generation/build commands remain blocked.

The actual Mac synthetic filesystem case can later run on an authorized Mac with Node and no key, under the same offline guard. It creates only a checked synthetic directory under the owner's home, verifies0600/0644 rejection and repository-path rejection, then removes that owned fixture. Do not call simulated mode tests real Mac ACL certification.

## Required next native test infrastructure

Owner approval is required before creating/integrating/building disposable diagnostic host targets. They must start the fixture before any normal Capacitor/application startup, use fresh isolated data, include these tools-only source files explicitly, and exclude all production endpoints/plugins/consumer documents. Production project files are not target-generation templates to edit casually.

The first native execution must use only synthetic tile data through `selectSyntheticTransport`, external networking denied, no real candidate, and no provider-transport authorization. Prove pre-arm/first/second/third behavior, competing controllers, durable filesystem reservations, stale/crash/corrupt state, navigation/process/background events, TLS/parser failure responses and absence of the synthetic marker in native logs/artifacts. Integrate counters/assertions in those native test targets; the JavaScript bridge simulations are not substitutes. Actual macOS ACL/volume tests also require a named Mac. No diagnostic-host build or device execution occurred here.

Only after those proofs should the owner consider a separately bounded live-test authorization and legitimate provider context. A native transport probe, especially iOS's absent-referrer path, is not sufficient evidence for ordinary released-app authorization. Retain the original key, explicit candidate inputs and two-request total per platform; do not reset spent live budgets, spoof headers or change provider/account settings.

## Preserved release gates

The November5 policy audit remains authoritative: current Apple/Google trader/account declarations, agreements, App Privacy/Data safety, operational public-UGC blocking/moderation and native signer/toolchain readiness require owner verification. Google trader deadline is February1,2027. Preserve API36, Billing9.1.0 and existing Xcode26 compatibility. No policy or store metadata change is included.

Website coming-soon copy remains a separate issue; production reporting availability is UNVERIFIED, not assumed disabled. No website change/deployment occurred. Notification Phase4E and consumer refinements remain excluded. Original key expiration November30,2026 is25 calendar days from November5; no deadline extension or store readiness is implied.

**NATIVE_TEST_INFRASTRUCTURE_PARTIAL — STOP FOR OWNER REVIEW.**
