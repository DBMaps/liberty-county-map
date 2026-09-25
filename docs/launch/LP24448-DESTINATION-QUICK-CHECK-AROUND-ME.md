# LP244.48 — Destination Quick Check and Around Me

Gridly is awareness first. These modes inspect an area; they do not provide navigation instructions, new ETA guarantees, live train movement or background location tracking.

## Audit / RCA
Baseline: 7c79a649a820f9404133ca900c69bbd3fa25c90d, main's LP244.47 merge; work began on the existing clean LP244.48-destination-quick-check-around-me branch.

Destination Quick Check already used LP244.45's single context store, canonical PLACE membership, shared active-area consumers and LP244.45B's generation-guarded explicit camera focus. No confirmed Search/Home consumer leak required a parallel implementation. Settings correctly uses homeOnly.

Around Me existed only as a non-activating context snapshot. The location control called browser geolocation directly, drew the location icon and panned without selecting AROUND_ME or refreshing its awareness. Search-only visibility left Around Me without temporary controls. The 120-second freshness predicate existed but was not applied to a complete activation transaction. Search could also invalidate active route publication. These are the narrowly repaired gaps.

## One context owner
The existing gridlyAwarenessContextFoundation remains the sole temporary awareness store. HOME and NONE continue to come from existing persisted selection. SEARCH and AROUND_ME are ephemeral. ROUTE_WATCH is a read-only projection of the established active-trip flags/ID, retaining the prior temporary/Home context beneath it. Route geometry and corridor intelligence remain owned by the existing route pipeline.

| Transition | Result |
|---|---|
| Home → selected destination | SEARCH, county-qualified PLACE or truthful coordinate scope |
| Search A → Search B | New identity/generation, one explicit destination focus |
| Home/Search → Around Me | New foreground fix → AROUND_ME; prior area stays active until success |
| Around Me → Search | SEARCH replaces temporary location awareness |
| Search/Around Me → Return Home | Canonical persisted Home and its county restored |
| Active Route Watch → temporary selection request | Request does not mutate route or temporary state; consumer is told to stop Route Watch first |
| Stop Route Watch | Existing lifecycle is unchanged; prior temporary/Home view becomes current again |

Closing Search retains its selected context. No duplicate Selected Area panel or confirmation step is introduced. The existing Location Context card owns the temporary label and existing Return Home button. The map control has the accessible name Around Me — use my location.

## Home and multi-county protection
Temporary transitions do not write Home personalization, Home town, Settings or profile records. Settings remains on the Home-only adapter. PLACE selections use the existing canonical place Geoid and explicit operational county membership; there are no city-name-only shortcuts. Around Me is coordinate-only, resolved to a supported county from existing boundary authority; it does not pretend to be a named PLACE. Unknown county coverage fails without replacing Home or the prior context.

## Foreground location and freshness
Around Me explicitly invokes requestGridlyForegroundPosition, preserving the existing Capacitor GridlyGeolocation foreground bridge and browser fallback. It requests maximumAge=0 and a 10-second provider timeout, with an 11-second settlement watchdog. No watchPosition, background polling, Always permission, native manifest or packaging change is added.

A numeric fix timestamp must not be in the future and must be at most 120 seconds old. Coordinates must be valid and county-resolvable. Only then does activation commit AROUND_ME, publish the approved current-location PNG and refresh shared awareness consumers. One expiry timer marks that specific active context stale; it does not request another fix or move the camera. Stale Around Me hides its location marker, marks its area unavailable to governed weather, and asks the user to refresh. Another explicit activation reacquires a fix.

Duplicate taps during one pending request do not create extra requests. Every callback settles once. A newer context generation or active trip invalidates the callback, preventing delayed location results from replacing a newer Search/Home/trip choice.

Denied permission, timeout, missing bridge/browser API, invalid coordinates, stale fixes and unresolved county coverage retain the prior context and Home, with consumer-friendly feedback. An already stale Around Me remains clearly stale rather than claiming a new current position. No report is submitted or enabled by location activation.

## Consumer and camera behavior
The existing selected-area path drives Location Context, Alerts/KBYG, Weather identity, DriveTexas/official roadway projections, crossings and POI awareness refresh. Around Me uses existing coordinate-only weather support. Provider-unavailable states must not be interpreted as authoritative absence of hazards.

Explicit Search uses the existing guarded semantic camera; explicit Around Me centers once on its accepted fix. Expiry and incidental hydration do not request recentering. Return Home uses the existing canonical Home focus transaction. Existing Route Watch renderer, publication ownership, stop lifecycle, marker factory and endpoint anchors are unchanged.

## Marker, accessibility and performance protection
All 31 owner-approved PNGs and the registry remain byte-identical. Current Location uses assets/markers/approved/navigation/current-location.png. Trip start and destination retain their approved images and anchors.

The known Alerts focus/aria-hidden warning and the unattributed long-frame warning are separate follow-ups. This phase does not edit Alerts minimization or timer scheduling. The Around Me control retains focus and announces feedback through the existing confirmation surface. A single expiry timer and bounded request watchdog do not imply continuous tracking.

## Owner acceptance
Use local Gridly at http://127.0.0.1:5500 and Ctrl+F5; no native build is needed. Principal viewport: 390x844; also check 320, 360 and 440 portrait widths.

1. Confirm Home Area and county in Settings.
2. Search Crosby, close Search, then search Dayton. Verify Location Context and map follow each selection.
3. Return Home and confirm the original Home/county.
4. Open Search, tap Around Me, and allow foreground location. Verify the approved circular marker, Around Me context and Return Home.
5. Move between Search and Around Me; confirm Home remains unchanged.
6. Deny location or test an unavailable fix: prior context must remain with readable feedback.
7. Leave Around Me active for over two minutes; verify stale copy, then explicitly refresh.
8. Check Search with the on-screen keyboard, card readability and Return Home without scrolling.
9. Start an existing Route Watch. Verify both approved endpoints; temporary-mode requests must not replace the trip. Stop Route Watch and verify the prior/Home context.

Browser emulation's reduced-height viewport approximates keyboard occlusion; final physical keyboard/device acceptance remains an owner check. Local harness requests are backend-blocked, with only read-only basemap/routing access. Synthetic fixtures are not production reports.

Final counts, transition evidence, source inventory and known limitations are recorded in reports/lp24448-*. No push, merge, deployment, native staging/build or production write is authorized by this certification.

## Certification result
99 focused tests passed; 64 broader tests passed; zero failures. The browser completed 15 recorded stages at 390, 320, 360 and 440 portrait widths with zero uncaught errors. Fresh Around Me agreed across Location Context, nearby awareness, community summary, KBYG, DriveTexas and direct-coordinate weather identity. Home persisted as Cleveland / Liberty County; the actual Settings Home text remained Cleveland after expiry/reacquisition. Austin/Hays, Austin/Travis, Abilene/Jones and Abilene/Taylor assertions passed. Existing Route Watch geometry, both approved endpoint pins and stop restoration passed. All 31 PNGs matched the baseline Git bytes.

The full portrait pass was supplemented by a targeted final-code expiry-during-refresh test, confirming STALE → FRESH and Settings/Home retention. Exact file inventory and machine-readable results: reports/lp24448-certification.json. Screenshots: .artifacts/lp24448/.

## Targeted Area filter ownership repair
Starting repair HEAD: 5eb003a89189dcdcd3b2b599858967c44bf4ff1d.

The owner traced a working Dayton SEARCH context and Liberty crossing inventory while Area recentered to Cleveland. The portrait Area button delegates to the existing town pill and applyGeoFilterFromPill. getVisibleCrossingsForFilter previously preferred gridlyActiveGeographicPresentation; a retained Home presentation therefore selected Cleveland geography ahead of the temporary awareness anchor. fitMapToCrossingsForActiveFilter then fit those crossing coordinates, while its empty-set path also reused the retained presentation. This affects both Area evaluation and camera ownership. An isolated execution of the starting-HEAD selector confirmed Dayton context with Cleveland evaluation coordinates.

The repair adds one temporary Area target resolver, reading the current unified context. Fresh SEARCH and AROUND_ME contexts supply the Area selector and Area camera; canonical PLACE targets retain the existing governed camera authority, while Around Me uses its accepted coordinates. Area focuses its context even with an empty crossing set. HOME and ROUTE_WATCH retain their existing paths. No context, Home, county, provider, report, route, asset or persistence state is changed by this target resolution. Nearby, County and All branches are unchanged. The separate FRA-prefix identity inconsistency is not repaired here.

The earlier 99/64 certification did not establish filter camera ownership or crossing-render parity. Its synthetic-coordinate predicates and label assertions were insufficient. The updated browser harness uses the actual portrait filter controls, asserts centers for Dayton Nearby/Area/All, county-wide Liberty zoom, Crosby Area, Around Me Area and Cleveland Area after Return Home. It also checks Dayton's loaded inventory owner, attached crossing layer and a positive rendered crossing set near Dayton, without requiring every crossing to render. It preserves 320/360/390/440 coverage, Home storage comparisons and existing Route Watch checks.

The broader pass also includes the existing Area viewport, awareness coverage and statewide County ownership suites. Two fixture omissions reproduced at the starting HEAD: the viewport fixture lacked geographic presentation state, and one coverage-copy case omitted its evidence-completeness input. Their setup now supplies those inputs; the viewport fixture also loads the new target resolver with a HOME context. Existing assertions and production coverage behavior are unchanged.

The first full UI-search browser pass completed all portrait filter sequences but its final Route Watch check could not obtain a layer from the live routing dependency. The harness now supplies a deterministic OSRM-shaped local response for route lifecycle assertions. This tests geometry publication, endpoint identity, activation guards and stop restoration; it does not certify routing-service availability or route accuracy. Production routing code is unchanged.

Targeted repair certification: 106 focused / 82 broader tests passed, zero failures. Final browser run completed 15 snapshots and 36 filter checks at 320/360/390/440, with zero uncaught page exceptions. Dayton Area rendered four crossings at every width; its camera remained near 30.0473202, -94.8873913. Crosby Area remained near 29.91154, -95.0632549. Return Home Area restored Cleveland near 30.3414794, -95.0900115. Home storage stayed byte-identical. Route geometry, approved endpoint assets and stop restoration passed with the local routing fixture. All 31 approved PNGs match the repair starting HEAD. No production/backend/native changes or unrelated warning repairs.

## Targeted Search Around Me discovery repair
Starting repair HEAD: 7eeadc23394fb9dbcf6f8c455482e8ac1179eb5a.

The existing portrait rail had an icon-only use-location control with an Around Me accessible name, but Search had no visible location action. Other Use My Location controls belong to onboarding/report surfaces. The existing protected foreground transaction was already implemented; the missing seam was consumer Search invocation.

Search now exposes a native button labeled Around Me immediately below the input/action row, before saved Home/Work results and Nearby Places. It reuses secondary-btn destination-chip styling and has a 44px hit target. A button-scoped 44px minimum height fixes the existing chip style dropping to 40px at 440px width. No marker, provider or taxonomy changes were needed. The native button supplies visible accessible naming and keyboard/touch semantics; initialization guards against duplicate binding.

requestGridlyUserLocationFromSearch delegates to requestGridlyUserLocationFromControl with source search-around-me. Active Route Watch is checked before closing Search because closing a pending destination surface can clear a route preview. Duplicate pending acquisition also returns before closing. Otherwise Search closes and the existing confirmation surface displays Finding your location…; the existing foreground provider, activation, failure feedback, freshness and callback generation guards remain authoritative. aria-busy is applied to the invoking Search button and cleared on settlement.

Denial, timeout and unavailable fixes retain the prior context. Expiry after 120 seconds marks Around Me stale without tracking; an explicit new Search action reacquires. Home storage and Cleveland / Liberty Settings remain unchanged. Return Home, Dayton/Crosby Search, temporary Area ownership and Route Watch geometry/endpoints/stop restoration are regression gates.

The local browser harness invokes the visible Search button at 320/360/390/440 rather than calling the activation function directly. It checks role/name, visibility, enabled state, viewport bounds, 44px height, one Search field, Nearby Places presence, actual AROUND_ME activation and the loaded approved Current Location PNG. Reduced-height viewport checks approximate keyboard occlusion; physical device keyboard acceptance remains an owner check. The Route Watch guard is separately invoked through the same Search handler with a deterministic local routing fixture. External backend requests are blocked.

Search UI repair certification: 113 focused / 82 broader tests passed, zero failures. Final browser verification passed 15 lifecycle snapshots, 36 filter checks and 11 visible Search button invocations across 320/360/390/440. Every measured button met the 44px target. Home bytes and Cleveland Settings, current-location artwork, denial retention, stale/reacquire behavior, Route Watch geometry/endpoints/stop and Area parity passed. Zero uncaught page exceptions. All 31 approved PNGs match starting HEAD byte for byte. Console warnings are not exhaustively captured; unrelated pre-existing Alerts focus and long-frame warnings remain outside scope. Exact evidence and file inventory are in reports/lp24448-certification.json.
