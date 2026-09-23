# LP244.48G2 — expanded KBYG dead-space closure

23 September 2026. Local Edge/Playwright audit; all external services and writes blocked in isolated browser profiles. Evidence: .artifacts/lp24448g2/.

## A–D. Repository

A. Branch: LP244.48-destination-quick-check-around-me.
B. Starting HEAD: 2076061af16ce2bc18635e05fc1731909416a02b. Exact branch, HEAD and clean status verified before editing.
C. Final HEAD: the single commit containing this report; the full hash is supplied in the delivery response because a commit cannot contain its own hash.
D. One local commit: Remove expanded KBYG map dead space. No push, merge, native build, deployment or production write.

## E–I. Finding, cause and patch

E. Confirmed painted dead space beneath expanded filters. The control rail is fixed-position and display:none under G1, so it reserves no flow space. The map already extends behind the header. This defect is the header shield painting too far down, not a displaced map canvas.

F. Exact RCA: the fixed #gridlyPortraitV2::before background shield still estimates the expanded Brief using an older clamp(300px, 39svh, 396px). G reduced the actual expanded panel to min(250px, 36vh). The shield estimate and real filter edge therefore disagree. At 390×844, the shield ends at 525.156px and filters at 494px. Its legacy dark shadow extends the visual weight further.

G. Exact rule chain in css/styles.css:

- Line 14622: body[data-layout-mode="portrait"].gridly-v2-surface-containment #gridlyPortraitV2::before is fixed at top:0 with height:var(--gridly-v2-top-shield-height), pointer-events:none.
- Line 21149: the containment-qualified root sets --gridly-v2-top-shield-height:calc(var(--gridly-v2-filter-strip-bottom) + 12px). Its specificity beats later unqualified root estimates.
- Line 25507: expanded --gridly-brief-interaction-extra:clamp(300px, 39svh, 396px).
- Line 26672: --gridly-v2-filter-strip-bottom:calc(var(--gridly-v2-header-top) + 178px + var(--gridly-brief-interaction-extra, 0px)).
- At this viewport: 6 + 178 + 329.16 + 12 = 525.16px.
- Line 30042: G's actual panel max-height:min(250px,36vh). Actual stack top 44 + status 68 + handle 42 + three gaps 14 + panel 250 + filters 48 = 494px.

The filter's V866S margin-block-end:18px!important (line 23902) extends its transparent stack to y512. The stack has pointer-events:auto: before correction, elementFromPoint at filter+5 and filter+10 hits the stack instead of the map. This is a second reservation, affecting hit testing rather than paint. It is reduced to 4px only while expanded, aligning the stack bottom with the shield. Stack padding is zero, min-height is zero, and its pseudo-elements have no content. The map rect, wrapper, safe-area input and rail top/height properties do not need changing.

H. Yes: 15 appended CSS lines, three operative declarations. The existing expanded-state root overrides only --gridly-v2-top-shield-height with calc(var(--gridly-v2-awareness-card-top) + 200px + min(250px,36vh) + 4px). The 200px is the existing status/handle/gaps/filter total documented beside the rule. The same expanded shield has box-shadow:none, and the expanded filter margin-block-end is 4px!important. Scope is max-width:760px and physical portrait. The safe-area-derived stack top is retained. Collapse automatically returns to the exact former cascade. No new JavaScript, observer, timer, camera call, DOM reparenting or layout resizing. G1's rule is unchanged.

I. Exact changed files:

- css/styles.css
- tools/lp24448g2/verify-browser.cjs
- docs/launch/LP24448G2-KBYG-DEAD-SPACE-CLOSURE.md

## J–O. Measurements and state proof

J/K. Authoritative 390×844 quiet and active expanded measurements; rects are (x,y,width,height) CSS pixels:

| Measurement | Starting HEAD | Patched |
|---|---:|---:|
| Filter bottom | 494 | 494 |
| Visible map top / painted shield edge | 525.156 | 498 |
| Filter-to-map gap | 31.156 | 4 |
| Map container | (0,84,390,844) | (0,84,390,844) |
| Expanded KBYG | (10,182,370,250) | (10,182,370,250) |
| Bottom Location Context | (12,699,366,62) | (12,699,366,62) |
| Dock | (13,771.40625,364,60.59375) | (13,771.40625,364,60.59375) |

Visible map top here is the lower edge of the top chrome, not the Leaflet container's top. The map already exists under that chrome. geometry-comparison.json compares all 20 common quiet/active baseline cycles: no rectangle differences for filters, map, brief, context, dock or rail in collapsed, expanded or restored states.

L. Collapsed filter bottom 214; shield bottom 196; visible map begins at filter bottom 214 (gap 0), exactly as before. Rail visible and focusable. The expanded selector does not match.
M. Expanded filter bottom 494; shield edge 498; gap 4; the first pixel below the shield belongs to the map in hit testing. Rail hidden with zero rendered width, excluded from programmatic focus and twelve successive Tab presses. Brief remains 250px tall. No overlap of painted map over the filter strip.
N. Restore returns exact filter, map, rail, context and dock rectangles and original gap. Rail buttons accept focus again.
O. 23 settled expand/collapse cycles: three quiet cycles at each of five viewports, one active cycle per viewport, and Search, Search→Home, Around Me. Camera center, zoom, selected filter and awareness owner remain unchanged by toggling. No accumulating offset or map-size drift was measured. Existing animation timing is retained.

## P–S. Interaction protection

P. Around Me keeps AROUND_ME ownership and the full 48×48 current-location marker, measured at (171,574,48,48), within the expanded exposed area. Return Home remains 44px tall. Around Me context remains (12,639,366,104); dock unchanged. The harness deliberately pans the accepted location into the exposed map before toggling; it does not claim the initial map-center point remains uncovered by KBYG. No automatic recenter was added.
Q. Three hazards = three markers = Location Context 3 = KBYG 3 = Alerts 3. No undefinedm. Quiet and three-hazard expanded geometry agree.
R. Real pointer dragging while expanded moves the map intentionally. A real pointer click opens the expected road-flooding-30.0473--94.8874 marker popup. Marker coordinates and hitboxes are unchanged.
S. The unchanged F2 smoke passes 30 popup cases (six types × five viewport sizes), including popup/title/location/close bounds, hit testing, closing and no repeated pan loop. The focused G2 run also measures the actual tapped hazard popup while KBYG is expanded. Initial collapsed 320 flooding placement failed at y107.139 versus safe top222; an exact starting-HEAD replay passed 30/30, and the patched rerun passed 30/30. The initial result is retained as popup-first-run.json and is not classified as a reproduced baseline defect. Popup runtime code was not changed.

## T–U. Viewports and screenshots

T. Quiet and active layouts pass at 320×844,360×844,390×844,440×844: filter 494, previous shield 525.156, patched shield 498, gap 4. At 390×500: filter 424, previous shield 496, patched shield 428, gap 72→4. The reduced-height proxy retains its pre-existing crowding: context 355–417 and dock 427.406–488 leave no useful central map area below the expanded filters. This audit verifies shield geometry, controls, restoration and camera stability there; useful expanded-map panning is certified at 390×844, not claimed for the 500px proxy. No brief/dock redesign was made.

U. Local screenshot inventory, all under .artifacts/lp24448g2/:

- before-{quiet,active}-{320x844,360x844,390x844,440x844,390x500}-{collapsed,expanded,restored}.png
- {quiet,active}-{320x844,360x844,390x844,440x844,390x500}-{collapsed,expanded,restored}.png
- before-expanded-390.png; after-expanded-390.png; after-expanded-dark-390.png
- search-390x844-{collapsed,expanded,restored}.png
- search-return-home-390x844-{collapsed,expanded,restored}.png
- around-me-390x844-{collapsed,expanded,restored}.png; around-me-expanded-390.png
- expanded-popup-390.png; expanded-recovered-390.png

The baseline and patched 390 captures plus representative 320/440 captures are retained. Visual review covers both light and dark expanded screenshots. Tile-recovery imagery is an explicitly synthetic local fixture.

## V–Z. Protected behavior

V. Search selects Dayton using the existing UI and preserves SEARCH through toggles. Return Home restores HOME. Return Home also works while Around Me KBYG stays expanded; controls remain hidden until collapse.
W. F1 browser acceptance confirms saved Home bytes remain unchanged across temporary-context operations; all five starting saved-place profiles passed.
X. F1 confirms protected Route Watch rejects both the foreground location request and late fix, with temporary state unchanged. No route logic or persistence code was edited.
Y. F2 passes tile failure→recovery with local synthetic tile images and a real tile-load event. The expanded G2 test additionally checks that the unavailable notice clears when imagery recovers while KBYG is open. No live tile/network service is used.
Z. All 31 approved marker PNGs compare byte-for-byte with git show 2076061a; marker-integrity.json records each file. No marker, app.js, index.html or map-visibility module changes.

## AA–AD. Validation and delivery

AA. Passed:

- G2 focused browser: 23 cycles at five viewports, 4px expanded gap, new-edge hit testing at all 844px heights, exact restoration, camera/owner/filter stability, Search/Around Me/Return Home, real pointer drag and hazard tap, expanded popup containment/no pan loop, expanded tile recovery, 3/3/3/3 parity.
- G1 unchanged browser verifier:23 cycles passed in the final patched run. Its first patched run timed out while clicking Return Home; exact starting-HEAD replay and final patched rerun both passed 23. Retained g1-first-run.json, g1-baseline.json, g1-final.json. This is a non-reproduced test timeout, not a claimed baseline application defect.
- F1 browser: five profiles, three refresh cycles, 20 location outcomes, manual disclosure close/scroll preservation, Show Me, Search/Return Home, Home byte persistence, Route Watch protection and production-shaped freshness.
- F2 smoke: 30/30 popup cases plus failed/recovered tiles and count parity. Initial failure and exact baseline/final comparison are described under S.
- Relevant G presentation smoke: unchanged brief/filter dimensions across four widths, current-location visibility, 31 PNG integrity and visual light/dark review. The standalone G whole-surface browser suite was not rerun for this narrow change.
- 127/127 contract checks: lp24445-unified-awareness-context, lp236-alerts-information-architecture, lp24448f1-functional-closure, lp24448f2-map-visibility, lp214-shared-active-issue-contract, county-runtime/v867ControlRailStability.
- 5/5 legacy lp24426-crossing-popup-portrait-containment checks: 360×800,375×812,390×844,411×914.
- node --check tools/lp24448g2/verify-browser.cjs; git diff --check; raw git byte comparison for all 31 PNGs.

The isolated baseline loader serves app.js/styles.css/index.html from 2076061a without replacing working files. Geometry comparison contains 20 common baseline/patched cycle pairs and zero protected-rectangle differences. Earlier non-passing test outcomes remain in the evidence; no production popup or context workaround was introduced.
AB. Zero page runtime errors in the final G2, G1, F1 and F2 browser runs. Expected warning: Service Worker registration blocked by Playwright. External services, WebSockets and non-read HTTP methods are blocked deliberately. The initial popup assertion and Return Home test timeout are disclosed under S/AA; both exact baseline replays and final patched reruns passed.
AC. Recommend accepting this narrow presentation correction after the recorded checks. The formula follows the approved current brief density; future changes to its heights/gaps should update the shield and retain this geometry verifier. No wider visual redesign is part of G2.
AD. Clean worktree after the single local commit; exact final hash/status supplied with delivery.
