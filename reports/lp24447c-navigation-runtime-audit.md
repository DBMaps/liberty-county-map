# LP244.47C navigation runtime audit and inventory repair

Starting HEAD: 553de7716fefd2b7fe6b4567567e4648cb14605b
Branch: LP244.47-marker-system-unification. Starting worktree clean.

## RCA reported before repair
The owner's diagnostic requested files at the hazard root. Canonical navigation paths include /navigation/. The local application was already wired correctly, and no application rendering repair or asset relocation was needed. Previous tests checked the canonical files and rendered navigation factories; they did not validate the incorrectly assumed hazard-root URLs. This audit records actual app-generated image requests before performing a separate diagnostic URL/hash check.

A separate source/native inventory omission was found: consumer-script-manifest.json lacked gridlyHazardNormalization.js and gridlyMarkerRegistry.js and retained an old app.js query version. Native staging validates exact startup order against index.html and would reject the mismatched inventory. The narrow correction adds those two existing scripts in index order and updates the app URL. Native inventory validation now passes. No staging or native build was performed.

## Canonical navigation source paths and SHA-256
- assets/markers/approved/navigation/current-location.png
  b4476f48535f9aa2e1dd39eced8c6d624a43949b76a10d129c567f7a1845cf1b
- assets/markers/approved/navigation/trip-start.png
  3540830157c934303816f695ad4816d6d53752361a2d68bd4f14ec8497c17843
- assets/markers/approved/navigation/trip-destination.png
  608e370e0aae5235fdf6788adaee27a951b13a9afee67cace4d9cad2a11b0c5e

Owner source: C:/Users/gulfi/Downloads/gridly-approved-navigation-markers-2026-09-21.zip, entries under gridly-approved-navigation-markers-2026-09-21/. Files, ZIP bytes, prior Git bytes and HTTP-served bytes match. All 28 hazard PNGs also remain byte-identical.

## Exact runtime URLs
http://127.0.0.1:5500/assets/markers/approved/navigation/current-location.png
http://127.0.0.1:5500/assets/markers/approved/navigation/trip-start.png
http://127.0.0.1:5500/assets/markers/approved/navigation/trip-destination.png

## Source/render ownership
Literal PNG filenames are declared in js/gridlyMarkerRegistry.js navigation definitions; the shared navigationBasePath supplies assets/markers/approved/navigation/. tools/lp24447-png/preview.mjs names the three files in its existing assertions. Tests and reports contain supporting references; no additional app renderer embeds these filenames elsewhere.

Current Location: use-location control → requestGridlyUserLocationFromControl → refreshGridlyUserLocationAwarenessContext → renderUserLocationDot → getGridlyNavigationMarkerIcon(current_location).
Trip Start: Route Watch route publication → renderRoutePreviewLine → gridlyCreateRouteEndpointMarker(firstPoint, origin) → getGridlyNavigationMarkerIcon(trip_start).
Trip Destination: renderRoutePreviewLine → gridlyCreateRouteEndpointMarker(lastPoint, destination) → getGridlyNavigationMarkerIcon(trip_destination). Search destination also uses the same approved destination icon via setGridlyDestinationMarker.

All use Leaflet divIcon containers containing original PNG img elements. They do not use the old CSS drawing or an SVG substitute. Dedicated navigation lookup returns null for unknown navigation keys and does not use hazard fallback. Boxes are 48x48, current-location anchor [24,24], endpoint anchors [24,47.04]. Endpoint geographic coordinates equal the first/last actual route geometry points. The current-location dot and start pin can overlap when the route begins at the current position; this was not changed.

## Runtime evidence
Live Server at http://127.0.0.1:5500/. Disposable Edge portrait 390x844 with HTTP cache disabled (hard-refresh equivalent), backend-blocked routing, local dependency substitutions and read-only public OSRM route request. Browser-emulated Dayton geolocation was delivered through the actual Current Location button flow. The existing renderRoutePreviewLine app function fetched route geometry and published its actual endpoint layer. No diagnostic fetch or manually injected image was used to create navigation-request proof.

All three navigation network responses were resourceType=image and HTTP 200. DOM img elements loaded original PNGs at 48x48. Only after those assertions, a separate fetch/hash audit confirmed all 28 hazard URLs and 3 navigation URLs HTTP 200 and original SHA-256. Zero missing marker requests and zero uncaught app exceptions. Expected blocked backend/resource and service-worker-blocked harness console messages were recorded separately.

## Service worker and native inclusion
The current service worker does not precache navigation/marker artwork or the marker registry; they are ordinary local HTTP resources. No worker changes required. Native runtimePolicy.files includes assets/markers and copyGovernedRuntime copies it recursively. The corrected startup manifest includes the registry/normalization/app dependencies in exact HTML order. Current www, Android public and iOS public bundles do not yet contain these images; they were intentionally not restaged or built. Canonical source is ready for the later staging pass, not a claim that existing binaries were updated.

## Warnings
Accessibility: minimizePortraitV2Sheet sets aria-hidden before inert without first relocating focus. Its implementation, closePortraitV2Sheet and gridlyV927R1CloseAlertsSheetWithGate are byte-identical to pre-LP244.47 commit 9c9e082d. Classify as pre-existing focus-management code/follow-up; no accessibility changes in this pass.
Performance: gridlyAlertsScheduleBrowserYield is also unchanged from 9c9e082d. The owner's specific long rAF/timer warning was not reproduced/attributed in this run. Its cause remains unclassified; unchanged scheduling code does not prove equivalent runtime cost after artwork changes. Keep a separate profiling follow-up; there is no demonstrated LP244.47 cause warranting scope expansion.

## Tests and changed files
55 focused tests passed, 0 failed. Includes source/native inventory validation without staging.
74 existing broader tests passed, 0 failed.

Exact tracked changes:
- consumer-script-manifest.json
- tests/lp24447-marker-system.test.cjs
- reports/lp24447c-navigation-runtime-audit.md

Ignored local evidence: .artifacts/lp24447c-navigation-audit/{verify.mjs,runtime.json,navigation-runtime.png,focused.txt,broader.txt,warning-source-comparison.json}.

One local inventory-wiring repair commit: Wire approved navigation markers into runtime.
No approved artwork or app.js edits, backend writes, reporting activation, merge, push, native build, staging or deployment.
