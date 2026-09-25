# LP244.48G1 — expanded KBYG map-control containment

23 September 2026. Local isolated Edge/Playwright audit. Evidence directory: .artifacts/lp24448g1/ (ignored local artifacts).

## A–D. Repository and delivery

A. Branch: LP244.48-destination-quick-check-around-me.
B. Starting HEAD: 0263aadf24b260913be1ae62fc40637c7570fc7d. Exact branch, HEAD and clean worktree verified before audit/edit.
C. Final HEAD: the single commit containing this report; exact hash supplied in delivery response (a commit cannot contain its own hash).
D. One local commit: Hide map controls under expanded KBYG. No push.

## E–H. Finding and ownership

E. Confirmed: the portrait Gridly utility rail was deliberately visible in both brief states, and existing spatial synchronization moved it downward to follow the filter strip. At settled 390×844, baseline quiet and active measurements both show rail y230 → y510 → y230 on expand/collapse.
F. Exact RCA:

- js/app.js:5529 gridlyBriefInteractionSetExpanded sets the root state attribute, body expanded/collapsed classes, handle aria-expanded and panel data-gridly-brief-expanded. It schedules the existing spatial synchronization on the next animation frame and again at 340ms; the collapsing panel is hidden after 310ms.
- js/app.js:5734 gridlyPortraitSpatialOwnershipSync keeps the existing rail in place and writes its CSS top variable from max(188, mapRect.top+18, filterRect.bottom+16). Expansion lowers the filter strip, so it also lowers the rail.
- css/styles.css:23922 explicitly includes expanded and collapsed selectors in the same rule: position:fixed, top:var(--gridly-v2-control-rail-top), display:flex!important, opacity:1, visibility:visible, pointer-events:auto, z-index650. There was no applicable portrait expanded-state hide override.
- Existing DOM-ready, resize and orientation-change paths resynchronize this same owner. Separate existing map ResizeObserver logic remains untouched; no observer is needed for this repair.
- Later short-landscape rules have separate visibility/navigation ownership. The new rule is physically portrait-gated so those rules remain untouched.

G. Smallest reliable signal: #gridlyPortraitV2[data-gridly-brief-state="expanded"], already written by the actual KBYG owner. No new class bridge, event listener, polling or state storage.
H. Container: #gridlyPortraitV2 .gridly-v2-control-rail, declared in index.html:888. It is Gridly's wrapper, with four existing buttons in order: Layers; Around Me — use my location (arrow icon); Zoom in; Zoom out. It is not the Leaflet attribution or marker pane. Native Leaflet control visibility remains governed by existing CSS.

## I–J. Patch and files

I. Yes. Seven appended CSS lines, with one operative declaration:

    @media (orientation: portrait) {
      body[data-layout-mode="portrait"] #gridlyPortraitV2[data-gridly-brief-state="expanded"] .gridly-v2-control-rail {
        display: none !important;
      }
    }

The selector matches only the existing portrait rail while expanded. Collapsing removes the match automatically. No positioning, order, map geometry, camera, KBYG content, density, ownership, reporting, persistence or runtime logic changed. Display:none also removes the controls from hit testing and keyboard focus. Existing popup bounds already ignore display:none elements, so no popup code change is needed.

J. Exact changed files:

- css/styles.css
- tools/lp24448g1/verify-browser.cjs
- docs/launch/LP24448G1-KBYG-MAP-CONTROL-CONTAINMENT.md

## K–P. State and interaction proof

K. Collapsed rail remains visible at its existing dimensions/position. Reference measurements use the existing spatial synchronizer after layout settles; this avoids comparing a cold-start intermediate offset with a settled layout.
L. Expanded rail has computed display:none and zero rendered width. The map, attribution, filter strip, markers, Search, Location Context, Return Home and KBYG handle are outside the selector.
M. Collapse restores the exact measured x/y/width/height of the rail, with tolerance 0.1px. Normal focusability returns.
N. Targeted matrix covers 23 expansion/restoration cycles: quiet state three times at each of five viewports; active state once at each; Search, Search→Return Home and Around Me. Each compares map rectangle, map center, zoom, awareness-owner type and selected filter before/after. Hiding/restoring controls does not move the camera. Expanded map dragging remains enabled; an actual pointer drag changes the center intentionally.
O. Around Me uses the existing foreground request callback fixture. Accepted AROUND_ME ownership, current-location layer, Location Context • Around Me and Return Home remain. The test intentionally pans geography into the exposed area before toggling and checks the full 48px location-marker box fits there; this pan is user input, not a hiding-induced camera correction. Existing brief occlusion of geography behind it is unchanged.
P. Search selects Dayton through the existing search UI; expansion/restoration preserves SEARCH ownership. Return Home restores HOME, with correct rail state both when collapsing afterward and when returning while still expanded. F1 additionally verifies Home storage bytes and protected Route Watch behavior.

## Q–S. Accessibility, viewports and screenshots

Q. While hidden, focusing a rail button programmatically cannot focus it, and twelve successive Tab presses per cycle never focus a rail descendant. After collapse the same button accepts focus normally. No aria-hidden bridge or tabindex rewriting is introduced. This is a focused containment check, not a full accessibility certification.
R. Quiet and active checks at 320×844,360×844,390×844,440×844,390×500;390 is authoritative. At 500px height the existing expanded brief/filter/dock occupy most of the viewport. Rail visibility and restore are verified there; no claim of useful exposed-map pan space or physical-keyboard equivalence. Actual exposed-map dragging and marker tapping are tested at 390×844. Map dimensions and center remain unchanged by the visibility rule.
S. Screenshot inventory:

- before-{quiet,active}-390x844-{collapsed,expanded,restored}.png
- quiet-{320x844,360x844,390x844,440x844,390x500}-{collapsed,expanded,restored}.png
- active-{320x844,360x844,390x844,440x844,390x500}-{collapsed,expanded,restored}.png
- search-390x844-{collapsed,expanded,restored}.png
- search-return-home-390x844-{collapsed,expanded,restored}.png
- around-me-390x844-{collapsed,expanded,restored}.png
- around-me-expanded-390.png

All are in .artifacts/lp24448g1/. browser.json records geometry/state/focus/pan/marker evidence; baseline.json records the starting behavior. Screenshots follow keyboard testing, so a visible focus outline on another control is expected.

## T–Y. Regressions, tests and limits

T. Three exact local hazard fixtures retained. Hazards=logical markers=Pulse=KBYG=Alerts=3, Location Context says 3 roadway issues nearby, no undefinedm. F1 verifies exact Cook Street and Church Street / Winfree Street and Flowers Street / Hope Street and Nancy Street identities, distinct per-incident freshness, three background-refresh disclosure/scroll cycles and manual close persistence. KBYG content and 250px density styling are unchanged.
U. Touch crossing suite: 5/5 pass, including narrow edges, close/reopen, pan and attachment. F2 starting-HEAD replay: 30/30 popup cases plus recovery passed. The first patched smoke attempt had a 320px collapsed flooding-popup containment failure (y107 vs safe top222); the new expanded-state rule was inactive. Exact starting-HEAD comparison did not reproduce it, and app.js / gridly-map-visibility.js are byte-equivalent to starting HEAD after line-ending normalization. No unrelated popup patch was made. Final patched F2 rerun: all 30/30 popup cases and tile failure/recovery passed; zero uncaught page errors. The initial isolated timing failure is not represented as a proven baseline defect because the starting-HEAD replay passed.
V. Tile-failure/recovery code unchanged; F2 uses blocked imagery and local synthetic recovered tiles with real browser image-load events. Notice clearing and three-hazard parity are asserted. This is not live provider reliability certification.
W. F1 tests empty/home/work/full/partial profile startup, 20 Around Me outcomes, Search/Return Home, Home byte preservation, production-shaped freshness and Route Watch rejection of temporary-owner steals. Final F1 browser acceptance passed.
X. All 31 approved PNGs byte-identical to starting HEAD using raw git-show comparisons. Marker registry/artwork/dimensions/z-order untouched in this task.
Y. Focused broader relevant suite: 127/127 pass (awareness ownership, Alerts, F1/F2, shared active issue contract and V867 rail stability). Final G1 browser acceptance passed all 23 cycles plus actual exposed-map pan/marker tapping; the opened popup retained the tapped incident ID. G browser smoke also passed all four widths. F1, F2, G and G1 final runs each recorded zero uncaught page errors. Results are retained in browser.json, f1-browser.json, f2-browser.json and g-browser.json, with run logs. Browser contexts block all non-GET/HEAD/OPTIONS requests, external service reads except local dependency/tile fulfillment, and WebSockets; no production writes. Expected service-worker-blocking warning is harness-generated. Initial smoke timing failure and fixture adjustments are retained in evidence instead of silently erased. G's caught legacy Route opener error remains unchanged and outside this task. No full repository or native build claim.

## Z–AA. Recommendation and status

Z. Accept the narrow state-driven containment repair: all final targeted, F1/F2/G browser and relevant test checks passed. It addresses the owner screenshot finding without relocating controls or changing KBYG/map ownership. Short-height expanded-map crowding and existing unrelated application defects remain outside scope.
AA. Final exact commit hash and clean git status supplied in delivery response. No push, merge, native build or deployment.
