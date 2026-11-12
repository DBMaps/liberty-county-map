# Gridly iOS mock label tile harness

Standalone SwiftUI and WKWebView prototype based on the Imagery Labels contract from Gridly Build 18 (`8cb40f70fc29bcfb441245751b667790b0e9e6b2`). Its bundle ID is `com.gridlygo.prototype.labeltiles`. The harness uses WebKit directly at Gridly's iOS 16.4 floor and bundles the same Leaflet 1.9.4 version. It has no Capacitor dependency. Its local page is loaded with `loadFileURL`; there is no app-wide origin or networking override.

The map uses a bundled synthetic terrain SVG. A separate Leaflet tile layer requests transparent mock PNGs over the single custom scheme `gridly-label://mock/tile/{level}/{row}/{column}`. The 512-pixel grid and zoom offset of −1 match the consumer tile contract. The renderer projects fixed fictional label anchors through Web Mercator at each tile level. The overlay pane is above the local imagery and does not receive input. The page's button toggles the same layer instance.

The handler accepts only canonical GETs to the exact scheme, host and path, with levels 0–19 and in-range row and column. It rejects query strings, fragments, extra URL components and alternate authorities. It only calls the local synthetic renderer, so there is no upstream connection, redirect, credential, or request URL logging. The page's Content Security Policy limits resources to the bundle and the mock image scheme.

The queue defaults to four active tiles, 24 active or queued tiles, 48 listeners, and a one-second deadline. Identical tiles share one work item. Cancelled listeners receive no callback. A cancelled or expired work item occupies its slot until the mock transport acknowledges cancellation. The queue holds no completed image cache. PNGs are size- and structure-checked, and Apple platforms also check decoding through ImageIO.

## Local verification

Run from this directory:

```sh
node --test Tests/map.test.mjs
swift test
```

The Node suite runs the bundled Leaflet URL and projection code and uses a simulated map for layer lifecycle. The Swift package tests the shared parser, PNG checks, deadlines, cancellation and queue with a deterministic mock. These tests do not exercise WKWebView on iOS.

With Xcode installed, open `LabelTileHarness.xcodeproj`, select the **LabelTileHarness** scheme, choose a local iPhone simulator, and Run. For a separately authorized physical-device check, select a development team for this distinct bundle ID. Use a local development build of this harness.

1. Select **Success** and check that West Ridge, Cedar Lane and Mill Creek are visible above the local terrain at the initial view.
2. Pan and zoom over those anchors. Check that the labels remain geographically anchored, including near tile edges, and that no stale tiles or duplicate labels remain.
3. Turn **Mock labels** off, pan and zoom, and verify the base remains visible. Turn labels on and verify they return.
4. Select **Failure**, **Timeout**, then **Invalid PNG**. Each mode should show a label error while leaving the terrain visible and interactive. Return to **Success** and confirm recovery.
5. Repeat the overlay toggles during a pan and check that stopped WebKit tasks produce no late callbacks. Use only counts and bounded status codes in native diagnostics.

The synthetic fixture is an offline test image, and live provider authorization is outside this prototype. A macOS/Xcode run is required to certify project compilation, scheme delivery, and visual behavior.
