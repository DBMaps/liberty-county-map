# Gridly mock labels integration

The portable tests take URLs from the bundled Leaflet layer, translate them through an isolated scheme adapter, and invoke the existing Stage 2C Node gateway in the same process. Synthetic paid and integrity decisions issue a five-minute maximum lease. Node crypto creates an ephemeral P-256 key and signs each tile proof outside the Web map VM. The gateway verifies the proof, reserves quota, and returns the exact local 512 × 512 fixture. The fixture is transparent. Portable map lifecycle assertions exercise the map script with a simulated DOM and tile events.

The standalone SwiftUI app uses the certified WKWebView handler and the same Web files. Its native adapter holds a CryptoKit P-256 key in memory, obtains a lease from a Swift counterpart of the gateway, and signs canonical requests. The Swift gateway independently validates each request and reserves quota on the main actor. It checks PNGs before the WKWebView handler receives them. The provider uses the transparent bundled fixture away from label anchors and the certified local synthetic renderer near anchors so the visual test can show actual mock labels. The failure selector, WKWebView navigation policy, and cancellation queue come from the certified harness. The adapter logs one fixed delivery event per transport instance, with no request data.

Both implementations use the same request fields and canonical signing bytes. The shared wire vector contains an ephemeral public key and a public signature. It contains no private key. The Node gateway stays the reference for the portable suite. The iOS app runs the Swift fixture counterpart in process, with no Node runtime or HTTP listener. The simulated Swift decision path requires sandbox decisions. The Node tests exercise both mock environments. All keys, PNGs, decisions and usage budgets in this directory are local test material.

## Source identities

`source-copies.sha256` records the SHA-256 of each original file from the certified native harness at `ad80ba80631f04971faa1d3282b11e7389dbf572`, followed by the integration copy hash and relative path. Eleven copies are byte-identical. The app host selects the gateway transport, the Xcode project adds the Swift gateway, transport, and fixture resource and assigns the distinct `com.gridlygo.prototype.labeltiles.integration` ID, and the Swift package uses a distinct display name. The Web directory, native scheme handler, queue, fixture, and existing Swift tests retain their original bytes. Node imports the Stage 2C gateway in place.

## Local checks

Run from the repository root with Node 24.

```sh
node prototypes/ios-arcgis-labels-integration/verify-source.mjs
node --test prototypes/ios-arcgis-labels-gateway/gateway.test.mjs prototypes/ios-arcgis-labels/Tests/map.test.mjs prototypes/ios-arcgis-labels-integration/integration.test.mjs
node --expose-gc prototypes/ios-arcgis-labels-integration/integration.bench.mjs
```

## Proposed hosted certification

After separate approval, prepare an isolated certification commit and branch with the three prototype directories. Preserve the pinned file bytes when staging, including existing line endings. Use the established manually dispatched registered workflow path only on the isolated ref. Keep the existing actor, branch, event, attempt and exact immutable SHA guards, pinned checkout, read-only permissions, and no environment secrets. Use the established `macos-26` runner. Run the commands above and `swift test --package-path prototypes/ios-arcgis-labels-integration --scratch-path "$RUNNER_TEMP/label-swift"`. The package contains 11 inherited and six new Swift tests, including the wire vector and the signed fixture path.

Build `LabelTileHarness.xcodeproj` with scheme `LabelTileHarness`, configuration `Debug`, SDK `iphonesimulator`, destination `generic/platform=iOS Simulator`, and `CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=`. Use runner-private derived data and verify the app ID is `com.gridlygo.prototype.labeltiles.integration` with no embedded profile or signature directory. Boot an installed iPhone simulator, install and launch that app ID, and confirm the process remains running. Check the app-scoped `MOCK_GATEWAY_PNG_DELIVERED` log and capture the actual simulator screenshot. Inspect synthetic terrain and West Ridge, Cedar Lane, and Mill Creek. A screenshot and a successful delivery log establish baseline integration. Native interaction and background/resume still need direct evidence. Retain only the mock screenshot and sanitized status, verify the checkout is clean, and shut down the simulator opened by the job.
