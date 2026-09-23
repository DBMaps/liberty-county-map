# LP244.48F2 visibility and popup closure

23 September 2026. Local isolated Edge/Playwright audit. Evidence directory: .artifacts/lp24448f2 (ignored local artifacts). F1 browser evidence: .artifacts/lp24448f1/browser.json.

## A–E: delivery

A. Branch: LP244.48-destination-quick-check-around-me.
B. Starting HEAD: 5bf61ff7cec95d57b2a5f5e261dbe18c5fc64abe. Exact branch, HEAD, recent history and clean worktree verified before edits.
C. Final HEAD: the single commit containing this report; exact hash supplied in delivery response (a commit cannot contain its own hash).
D. One local commit, subject: Fix surface visibility and popup containment. No push.
E. Legacy backgrounds and later theme foregrounds were incompatible. Scoped token pairs repair the affected surfaces. Existing Leaflet popups now use measured unobscured bounds. A transient tile-failure notice distinguishes missing map imagery from incident availability. Final screenshot review shortened that notice to avoid attribution overlap without changing popup geometry.

## F–M: surface ownership and readability

Specificity below is (IDs, classes/attributes/pseudo-classes, elements). Source references are css/styles.css unless stated. New ownership is confined to the F2 block beginning at line 29837. No theme preference is saved by the audit.

| Surface / container | Original incompatible rule / inherited color | Final title, body, metadata, action ownership | Specificity / theme |
|---|---|---|---|
| Alerts: #gridlyPortraitV2Sheet[data-active-sheet="alerts"] .gridly-lp236-condition-item and .gridly-lp236-header | Legacy [data-gridly-alert-row="true"] at 24235 applies near-black rgba(22,36,54,.78)→rgba(9,18,31,.72) gradient !important while theme sheet supplies dark rgb(13,27,42). Legacy strong at 21998 separately forces near-white. Header also retains dark background. Time opacity .62 compounds the mismatch. | Nested background, primary inherited/title/strong; secondary small/location/summary/time at opacity 1; Show Me input background + primary; source/group/status elevated background. Coverage, official/community/weather disclosures and unavailable labels retain their content. | Row/header (1,3,1), !important, later wins tied legacy row rule. Strong (1,4,1) wins legacy strong (1,3,2). Token values follow existing theme owner. |
| KBYG: #gridlyPortraitV2 #gridlyBriefInteractionPanel .gridly-travel-brief-lines p | At 25606 #gridlyPortraitV2 .gridly-travel-brief-lines p forces rgba(247,252,255,.94), but panel is theme-elevated/light. Community count and provider text disappear. | Paragraphs primary; existing panel elevated background, titles/disclosures/actions otherwise retain existing token ownership. No structure or trust wording change. | New (2,1,1) !important beats original (1,1,1). |
| History: #gridlyPortraitV2Sheet[data-active-sheet="history"] .gridly-historical-intelligence-empty | 14936 white translucent gradient + #edf7ff; strong #fff at 14997, paragraph rgba(222,236,250,.82) at 15032, on light sheet. | Nested + primary; strong primary; paragraph and subject secondary. Existing historical/current/unavailable distinction retained. | Container (1,2,0), strong/paragraph (1,2,1), !important. |
| Search: #gridlySearchShell | Secondary close/reset background at 24857 remains dark rgba(8,24,39,.86); later theme rule at 27152 changes text to dark secondary. | .gridly-search-close-btn, .gridly-search-clear-btn, #gridlySearchAroundMeBtn and #gridlyDestinationChangeBtn use input background + primary + neutral border. Input/results/saved rows/category/radius retain existing theme tokens. | Scoped :is selector (2,1,1), !important wins legacy background and theme foreground. |
| Route Watch: #gridlyMobileRouteQuickPanel | Injected app.js style around 87213 and CSS around 9913 use dark gradients; inherited title dark. | Panel/head elevated + primary; label/.route-quick-field/#mobileRouteQuickMeta secondary; selects/buttons input + primary. [data-action="start-route-watch-quick"] accent + accent foreground. Manage Places and close follow button pair. | Panel (1,1,1), child rules (1,2,1) or ID-containing :is (2,1,1), !important. |
| Settings saved-place editor: #routeSetupModal .route-setup-modal-card | Legacy dark card against themed dark heading/inherited text. | Card/groups elevated + primary; h2/h3/strong/label primary; p/small/.eyebrow/.route-setup-hint/.route-setup-subtitle secondary; button/input/select input + primary. Settings travel surface otherwise retains existing theme rules. | Card (1,2,1); heading/action (1,1,2); scoped !important. No modal geometry change. |

G. Exact selector declarations are in the bounded F2 CSS block; app.js has only the bounds delegation and module installation additions. No global typography or theme replacement.
H. Isolated system-light, system-dark, explicit-light with dark system, and explicit-dark with light system captures and computed styles are recorded in surfaces.json. Actual measured solid color pairs: light primary rgb(13,27,42) on rgb(227,237,243) = 14.639:1; secondary rgb(61,82,101) = 6.815:1. Dark primary rgb(244,248,252) on rgb(18,38,58) = 14.427:1; secondary rgb(197,211,224) = 10.093:1. These are specific computed pairs, not a whole-app accessibility certification.
I. Alerts header/coverage, categories, cards, locations, summary, ages and Show Me have coherent token pairs. All three reports retained.
J. Expanded KBYG count/provider paragraphs now use primary text. Collapsed bar and trust wording retained.
K. History empty/takeaway text uses primary/secondary on nested background, without replacing unavailable evidence with current claims.
L. Search action labels have explicit paired backgrounds; Saved Places geometry and selection behavior untouched.
M. Route presentation repaired. Exact starting-HEAD browser replay (baseline-openers.txt) confirms the saved-Home editor opener also recurses with "Maximum call stack size exceeded". Editor color fixtures therefore use configureRouteSetupModal/openModal directly and do not claim opener closure. A pre-existing direct legacy opener throws "isMobileLayoutMode is not defined" after mounting; the audit catches and records it to inspect colors. Its function is unchanged from starting HEAD. Active Route Watch protections are separately tested by F1. This is not a claim of a new end-to-end route-start certification.

Focus/hover/active: existing theme-selected states remain in force. Scoped button/input/select/summary/link :focus-visible adds a 3px accent inset outline; keyboard-focused Show Me computed outline is asserted solid in all four themes. New paired !important action backgrounds outrank the legacy Search hover background, preserving readable labels through hover/press. No click/disclosure handlers changed. Editor captures wait for the modal transition to finish; its geometry and stacking rules are unchanged. This is not a full accessibility milestone.

## N–S: popup closure

N. Old crossing bounds used map rectangle and bottom dock without actual top stack/right controls/context. At 390, map starts at y84 but fixed top stack ends at y214; old top bound y92 let the title sit beneath the header. Legacy content minimum width 238 also defeated narrow Leaflet sizing.
O. js/gridly-map-visibility.js measures visible topbar/status/brief handle/expanded brief/segments, bottom context/dock, right control rail, visual viewport and map rectangle. Hidden elements reserve no room. Existing Leaflet content gets scoped max width/height, with scrolling when needed. Opening is corrected synchronously and checked once after its opening pan (420ms); resize schedules one frame. No move listener or repeated pan loop, new popup system, or permanent ownership writer. Leaflet autoPan option is restored after layout; its global behavior is not disabled. The passive notice uses 2px clearance; interactive fixed UI uses 8px.
P–R. Browser evidence records six types (flooding, debris, downed power line, neutral, blocked, delay) at 320/360/390/440×844 and 390×500. Each checks popup/title/location/close against actual bounds, location clipping, title/close hit testing, actual close interaction, and stable camera after settling. 390 is authoritative. Reduced height is viewport simulation, not a real mobile keyboard test.
S. Existing touch crossing suite checks left/right edges, close/reopen, panning, marker attachment and selection at 360×800,375×812,390×844,411×914. F1 protects Search/Around Me/Return Home/Home/Route Watch. Module has no persistent context, saved-place or route writer. Current-location/trip/marker rendering is unchanged.

## T–V: map background availability

T. Existing tile-error handling diagnoses satellite labels, but provides no consumer map-background explanation. Denied audit network is not evidence of production outage.
U. Base Standard and Satellite imagery tile events track failures/success per active layer. A noninteractive role=status / aria-live=polite notice says "Map imagery unavailable" It is small, theme-paired and does not cover/control markers. Successful tiles and inactive-layer changes clear it automatically.
V. Failure is simulated by aborted tiles; recovery uses locally served SVG fixture tiles with actual browser image-load events. Notice disappearance, loaded image dimensions and three-incident parity are asserted. This proves local recovery lifecycle, not real provider connectivity.

## W: exact changed files

- css/styles.css
- index.html
- js/app.js
- js/gridly-map-visibility.js
- tests/lp24448f2-map-visibility.test.cjs
- tools/lp24448f2/verify-browser.cjs
- tools/lp24448f1/verify-browser.cjs
- docs/launch/LP24448F2-VISIBILITY-POPUP-CLOSURE.md

## X–AD: protected functional evidence

X. F1 browser acceptance: hazards=3, logical markers=3, Location Context=3, Pulse=3, KBYG=3, Alerts=3 across three background refreshes and all four widths. F2 repeats final parity after popup/recovery fixtures.
Y. Exact locations: Flooding Cook Street and Church Street; Debris Winfree Street and Flowers Street; Power Line Hope Street and Nancy Street. Per-incident times remain distinct and popup/snapshot comparisons are preserved. No undefinedm. The old harness compared hidden, closed Alerts DOM after time advanced; starting HEAD reproduces that failure. The one-line harness correction only omits stale DOM rows when the sheet is hidden; open-sheet assertions remain.
Z. Three background refreshes preserve disclosure and scroll; manual close also retained.
AA. Twenty Around Me cases: denied/stale/timeout/error/success at four widths, visible feedback, temporary ownership.
AB. Search destination and Return Home browser assertions pass.
AC. Empty/home/work/full/partial profile startup and saved Home byte preservation pass.
AD. Active Route Watch state/geometry protection passes; no origin/source/route architecture changes.

## AE–AK: validation and evidence

AE. Five F2 unit tests cover measured bounds/hidden UI, tile failure/recovery/inactive layers, bounded popup correction, closed/replaced popup protection and desktop/no-owner-write scope. Focused F1/Alerts/F2 run: 68 passed.
AF. Broader relevant suite: 167 tests, 165 pass and two pre-existing confirmed-place-camera-precedence.test.mjs failures (statewide PLACE zoom13; manual Dayton missing gridlySynchronizeActiveCountyForOperationalContext in extracted harness). Exact starting HEAD comparison reproduces both; baseline-protected-tests.txt. Existing touch popup suite separately rerun after final timing correction: all five tests pass. Not a fully green repository suite.
AG. See browser.json (30/30 popup cases) and surfaces.json (24 theme/surface captures), both passed with zero uncaught errors. final-review.json repeats all four editor themes and the tightest 390×500 Debris case after shortening the notice and pairing editor small text; passed. Commands: node tools/lp24448f2/verify-browser.cjs; optional GRIDLY_F2_POPUPS_ONLY=1 or GRIDLY_F2_SURFACES_ONLY=1 split the same matrix. node tools/lp24448f1/verify-browser.cjs passed. Syntax and git diff --check also checked.
AH. Screenshot inventory in .artifacts/lp24448f2: before-alerts/kbyg/history/search/route/hazard-popup.png; after-{alerts,kbyg,history,search,route,editor}-{system-light,system-dark,light-dark,dark-light}-390.png; popup-{flooding,debris,other_hazard,neutral,blocked,delay}-{320x844,360x844,390x844,440x844,390x500}.png; alerts-fit-{320,360,390,440}.png; search-fit-{320,360,390,440}.png; map-unavailable-390.png; map-recovered-local-fixture-390.png. Earlier exploratory captures are not authoritative when a final named matrix capture exists.
AI. Browser blocks all non-GET/HEAD/OPTIONS requests and closes WebSockets; external GETs also denied except local dependency/tile fulfillment. No production writes, deploy, push, merge or native build.
AJ. All 31 approved PNG SHA-256 hashes compared to pre-edit manifest and final raw bytes compared directly with git show at starting HEAD; no artwork/size/current-location styling edits.
AK. No uncaught page errors in acceptance runs. Service-worker blocking warning is expected harness behavior. Legacy Route opener exception is caught and disclosed above. No changed-surface aria-hidden/focus warning observed in captured warnings; no full assistive-technology certification.

## AL–AO: disposition

AL. Rail delay is used only as an isolated popup positioning fixture, then cleared. Rail lifecycle and unresolved wording/KBYG parity follow-up remain unchanged and audit-only.
AM. LP244.48G retains Saved Places compaction, KBYG/Alerts density, marker redesign and broader visual unification. No density work in this patch. Legacy Route/editor openers and unrelated baseline camera harness failures remain separate follow-up items.
AN. Accept only the scoped visibility, popup containment and local map-failure recovery repairs. Real mobile keyboard and live tile-provider validation remain outside this local run.
AO. Final clean git status and exact commit hash are supplied in the delivery response.
