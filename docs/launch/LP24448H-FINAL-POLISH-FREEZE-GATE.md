# LP244.48H — final polish and UI freeze gate

23 September 2026. Isolated local Edge/Playwright audit. Evidence and screenshots: `.artifacts/lp24448h/`. This is a consumer UI audit, not native-device, accessibility, performance or statewide certification.

## A–E. Repository and assessment

**A. Branch:** `LP244.48-destination-quick-check-around-me`.

**B. Starting HEAD:** `8911cf0ce13f5beef632719e91f7ea82f51dfb64`. Exact branch, HEAD, clean status and requested recent commits were verified before editing.

**C. Final HEAD:** `8911cf0ce13f5beef632719e91f7ea82f51dfb64`.

**D. No Commit.** The freeze gate remains on HOLD. The bounded repairs and regression coverage are left reviewable in the working tree. No push, merge, native build or deployment.

**E. Executive assessment:** The portrait shell is substantially ready: the current consumer editors and Route Watch entry work, core surfaces are readable, and the prior containment repairs are preserved. This audit repaired genuine rail lifecycle and presentation defects. However, a separate existing rail-delay product-policy gap permits an active delay alongside “No active issues nearby” in Location Context. A final UI freeze cannot be approved while that contradiction remains. The authoritative policy explicitly calls this case undefined; this polish task does not invent the missing surface policy.

## F–H. Hazard glyphs

**F. Finding:** Flooding, debris and power line have different visible symbols. The yellow power-line warning is the fastest to recognize; flooding and debris require closer attention. Audited quiet and active maps at 320/360/390/440 widths, actual initial zoom 13 and adjacent zooms 12/14, plus supplemental 14/15 and a close-up. Nearby reports can overlap at the farther zoom because of geographic proximity. At normal portrait scale the individual car/water, debris and warning/pole shapes are readable, with category text available in popups and Alerts. This is a desktop visual judgment, not a user recognition study.

The three source images are 1192×1319. Each renders in the existing 64×64 shell with anchor `[32,62.72]`, `object-fit:contain`, no clipping mask and the existing contrast/saturation treatment. Shell and inner glyph are baked into the same PNG, so scaling that image also scales the shell. Selection and popup emphasis remain intact.

**G. Glyph repair:** None. No new CSS scaling, shell, anchor, target or family change was justified.

**H. Artwork required:** No demonstrated requirement. No approved PNG was edited. If later physical-device recognition testing requires independently enlarging the inner flood/debris glyphs, that would need a separate owner-approved artwork task.

## I–K. Openers

**I. Consumer entry results:** Search, Around Me, Report, Alerts, History, Settings, KBYG toggles, Home editor, Work editor, Manage Places, Change Home Area, selected Search result, route preview, Route Details, Start/Stop Route Watch, Show me, Confirm Still Active, Mark Cleared and crossing Report Blocked/Delay were exercised through their visible surfaces. Editors have the expected Set Home / Set Work / Manage Places titles and “Close saved places editor” accessible close name. Major sheets close cleanly; Stop Route Watch also closes Route Details by design. Crossing submission testing stops at the unaccepted consent gate.

**J. Exact defects:** Mark Cleared removed the canonical report but left the blocked marker and reopened popup stale. That is the rail update defect below. No additional broken current consumer opener was reproduced. Legacy direct helper calls still expose `openMobileRouteQuickPanel`'s unavailable `isMobileLayoutMode` reference and a problematic saved-place helper path; the tested consumer Settings and route flows use different working paths. Do not equate those legacy direct-call failures with a proven visible opener failure.

**K. Repairs:** The real report-change render suppression was repaired. No speculative legacy opener rewrite.

## L–O. Rail reproduction and bounded repairs

**L. Reproduction:** Crossing A is FRA-762785P, Winfree Street. Starting from cleared local fixtures: add blocked, settle, inspect canonical/grouped/unified state and all three surfaces; tap the actual popup Mark Cleared; settle; add delay; inspect again. A is repeated. Crossing B is FRA-762786W, Main Street, with a fresh delay and no previous blocked report. B is brought into the viewport before inspecting its marker. Fixture writes remain local.

The actual clear-action failure reproduced on the exact starting HEAD as well as the initial presentation patch. The marker remained asset 24 after 700ms, another 1500ms and another 3000ms, with zero active canonical reports and no deferred refresh. A later explicit diagnostic render changed it to asset 25. This was not merely a transitional frame. API-only clear without popup interaction had missed it.

**M. Classification: F — mixed.** Shared production render lifecycle suppression plus shared presentation errors. There is also a separate unresolved governed delay surface-policy gap.

**N. Repair:** Real report-data signature changes now pass the existing popup guards into the incremental crossing renderer. Selection/camera-only suppression remains. No new timer, observer, full-layer rebuild or route/camera ownership change. Presentation reads explicit crossing state ahead of stale legacy blocking prose, including the structured crossing identity retained in reduced route records. It corrects unified incident/Alerts/KBYG/Pulse/Route Details copy. A single rail report no longer counts as both a community and rail corroborating signal, or as two conditions because the route alert/report projections carry the same report ID. Source records, report payloads, severity and route scoring/geometry are unchanged.

**O. Parity evidence:** Repaired A transitions use blocked asset 24 → neutral asset 25 → delay asset 23. Delay has canonical legacy type `heavy`, grouped type `heavy`, unified type `rail_delay`, popup “Reported Crossing Delay”, Alerts delay wording and KBYG “Community reports indicate a crossing delay.” Fresh B has the same semantics. Clear removes the canonical/grouped/unified active incident and the delay/blocked popup wording. Final automated sequence results are recorded in `browser.json`; baseline failure, settle trace and route projection trace are retained separately. This does not certify Location Context's delay count; see AU.

## P–Z. Consumer surfaces

**P. Copy findings:** Delay was called blocked; a single report appeared corroborated; the configured Settings opener still advertised unlocking setup; crossing submission announced “Submitting” before consent. Secondary optional wording includes “Local awareness,” “Historical Intelligence” and uppercase section labels. None warranted a broad rewrite.

**Q. Copy repairs:** Explicit delay wording and single-report confidence; Settings now says “Manage your Home Area, saved places and preferences”; pre-consent status now says “Preparing your report”. Legal text is unchanged.

**R. Hierarchy:** Search, Around Me, Show me, Report and confirmation/clear actions are discoverable. KBYG has a full-width labeled toggle. Start/Stop Route Watch remain secondary to awareness; its selected-destination impact text is a weaker entry than Search, but works and does not require redesign. The consent acceptance control is visibly disabled until agreement.

**S. Quiet state:** Map remains the main surface, passive crossings are subdued and KBYG is calm. A blocked tile source produces an explicit imagery-unavailable notice rather than unexplained emptiness. Core controls remain usable. Do not confuse a deliberately unavailable provider with a proven quiet provider.

**T. Active state:** Hazard symbols outrank passive crossings; Alerts exposes distinct locations and per-report freshness; KBYG is compact and scrollable. Exact count/street evidence is below. The unresolved delay/Location Context contradiction is an exception to a clean active-state assessment.

**U. Around Me:** Search exposes the action; finding, success, denied, stale and timeout feedback are visible. Current Location and Return Home remain legible. Expanded KBYG hides/restores the rail; temporary context does not replace an active Route Watch.

**V. Search:** Input, Around Me, compact saved Home/Work roles and nearby results are readable. Selected destination checking remains primary, route preview secondary. The 390×500 proxy retains a reachable close/exit; it is not a physical keyboard certification.

**W. Settings/editor:** Groups, Change Home Area, Home/Work editors, Manage Places, appearance/theme/text-size and Support surfaces were inspected. Correct titles and close names; no persistence implementation change. Support/legal text and links remain intact.

**X. Route Watch:** Local routing-unavailable feedback is visible. A local synthetic OSRM response exercises successful preview, Route Details and Start/Stop. Origin/destination and ETA/distance are readable. No turn-by-turn language or navigation takeover. The actual Route Details pane had legacy pale text on its light card, unlike the previously audited legacy route panel. A scoped color-only repair now uses the existing primary/secondary/elevated/nested theme tokens, with an opaque sticky action footer and keyboard outline. All 20 theme/viewport cases pass, including scroll access to the final reason above the reduced-height footer. No layout, geometry or route ownership changes. Final delay wording and confidence checks cover the reduced route records, not just the popup model.

**Y. Reporting:** Picker categories, selected Flooding styling, placement choices, legal links and close/back are visible. Crossing Report Blocked/Delay reach consent; “Not now” exits. No acceptance, production submission or reporting activation. The reporting-status read RPC attempt is blocked. “Preparing” describes the pre-consent stage accurately.

**Z. History:** Empty History states that there is not enough local history, rather than fabricating events. “Historical Intelligence” is formal but understandable; renaming is optional later polish.

## AA–AB. Accessibility and runtime

**AA. Accessibility:** Close names, keyboard focus outline, hidden rail exclusion/restoration, filter targets, icon-only controls, light/dark and large-text wrapping were checked within the browser scope. F2 covers focus styling; G2 covers repeated Tab and programmatic focus exclusion while the rail is hidden. This is not a full WCAG or assistive-technology certification.

**AB. Runtime:** No application page exception in the passing protected browser runs. Service-worker registration is intentionally blocked by Playwright; external requests/realtime are also suppressed. No new interval/rAF scheduling code was added. No forced-reflow or long-rAF warning was captured in the recorded warning stream; this is not a measured physical-device performance budget. Legacy direct-helper errors are explicitly separated from the actual consumer paths. The passing final H interaction phase has zero page errors and two expected service-worker-block warnings. Its 159 console error messages are blocked-resource fetch failures plus the report-sync failed-fetch message; they are not represented as a clean console. Route theme and final G2 runs have zero page errors. No additional application exception was observed.

## AC–AT. Change list and regression evidence

**AC. Exact changed files:**

- `js/app.js` — bounded rail renderer guard and consumer presentation/copy.
- `css/styles.css` — scoped Route Details theme colors and focus outline.
- `tests/lp236-alerts-information-architecture.test.mjs` — load the presentation helper in its extracted VM and cover delay summary copy.
- `tests/lp24448h-freeze-presentation.test.cjs` — explicit states, ownership, mixed conditions, immutability and single-report route confidence.
- `tools/lp24448h/verify-browser.cjs` — local consumer/rail audit and screenshots.
- `tools/lp24448h/verify-route-colors.cjs` — actual consumer Route Details theme/viewport matrix.
- `docs/launch/LP24448H-FINAL-POLISH-FREEZE-GATE.md` — this report.

**AD. Three hazards:** Required flood/debris/power-line coordinates, three logical markers and 3/3/3/3 Location Context/Pulse/KBYG/Alerts. The final H interaction phase and final G2 run both return hazards/markers/Pulse/KBYG/Alerts = 3 and Location Context “3 roadway issues nearby”, with no `undefinedm`.

**AE. Streets/freshness:** Cook Street and Church Street; Winfree Street and Flowers Street; Hope Street and Nancy Street. F1 compares independent 0/5/12-minute fixtures, rendered Alerts and popup ages; no `undefinedm`.

**AF. Disclosure:** F1 preserves open/closed disclosures and scroll across three background refresh cycles, including ordinary scheduled updates.

**AG. Around Me:** F1 covers finding and success/denied/timeout/stale across all five viewport sizes. H captures finding/success; G2 checks expanded state.

**AH. Search/Return Home:** H visible Search/result/route path plus F1 Search/Return Home; G2 checks Search, Search→Home and Around Me expand/collapse without owner drift.

**AI. Home:** F1 byte-compares the five relevant persisted Home/settings/profile keys. H compares saved-place bytes across its flows. Appearance changes are isolated test-profile changes, not a persistence implementation edit.

**AJ. Route protection:** F1 rejects foreground Around Me and a late fix while Route Watch owns the context. H exercises real Start/Stop controls with a local route fixture.

**AK. Popup:** F2 passed all 30 popup cases at five viewports, pan/close/reopen and required content containment. The broader LP244.26 browser test also passed four physical portrait widths with left/right edge, close/reopen and pan checks after the renderer repair.

**AL. KBYG:** Final G2 passed 23 cycles across the five viewports and Search/Around Me contexts. At 390×844, filters end at 494px, painted map starts at 498px: 4px. It verifies the expanded 4px filter-to-map gap, rail hide/focus exclusion/restore, repeated cycles and unchanged map rect/camera/filter/owner.

**AM. Tiles:** F2 passed synthetic tile failure→recovery. G2 additionally covers recovery with KBYG expanded. Synthetic local tiles are explicitly labeled; no live provider was used.

**AN. Marker integrity:** All 31 approved PNGs, including subdirectories, SHA-256/byte-compare equal to the exact starting commit. `marker-integrity.json` contains all entries.

**AO. Focused tests:** H semantic tests, LP236 delay integration, route decision integration and destination coverage tests pass. `route-tests.txt`: 20/20.

**AP. Broader tests:** Final combined non-browser suite: 150/150 in `final-tests.txt`. Earlier combined run including the LP244.26 browser suite: 140/140 in `unit-tests.txt`. Syntax and `git diff --check` pass. No full repository-wide test claim.

**AQ. Viewports:** 320×844, 360×844, authoritative 390×844, 440×844 and reduced-height 390×500. H captures all four full-height widths and reduced Search; F1/F2/G2 cover their five-viewport interaction matrices.

**AR. Screenshots:** H inventory is in `screenshot-inventory.txt`. 131 H PNG captures include baseline, intermediate and final evidence. The final active Route Watch capture is `route-watch-final-390.png`. Required 390 set: quiet Home; active zoom 13 and close-up; the three `marker-*-normal.png` images; expanded KBYG; Alerts; Search; selected Search; Around Me; hazard/neutral/blocked/delay popups; Route Watch; Settings; Home/Work editors; Report and History. Representative 320/360/440 screens accompany them. `before-*`, the first-clear failure and exploratory captures are baseline/intermediate evidence, not final acceptance screenshots. The final Route Details images are `route-colors-*-390x844.png`; `route-details-before-colors.png` preserves the contrast defect. F2/G2 contain the protected popup/theme/gap/recovery matrices.

**AS. Backend writes:** The H/F1/F2/G2 contexts abort every non-GET/HEAD/OPTIONS request, block service workers/WebSockets and abort external services. Local JS/CSS, empty report reads, route and tile responses are fulfilled by the harness where explicitly needed. Zero production writes were transmitted. Do not claim zero attempts: the reporting-status RPC uses POST and was aborted before transmission. Reporting was never enabled.

**AT. Test interpretation:** The forced-unavailable report read can replace fixture cards with a truthful coverage-unavailable state after the read settles; an optional local empty-read experiment preserved the fixture overlay but the combined run still hit a Show me locator redraw timeout. Its failure is retained as `combined-read-refresh-failure.json`. The successful final H phase runs with `GRIDLY_H_FLOW_ONLY=1`, covering nine rail states, route controls, Around Me/Return Home, reduced-height Search and final three-hazard parity; it does not certify the full combined script. Earlier surface screenshots and the independent protected suites supply their own evidence. Separate unavailable-state evidence remains. A focus-outline assertion also raced a surface refresh in an initial concurrent F2 run; the full serial F2 run passed four theme combinations and all popup cases. The combined-run redraw is an unresolved acceptance/reproduction gap, not yet proven to be a production dead control. Do not certify the combined audit until it is distinguished from the deliberately simulated provider timing. These observations are not silently converted into product success claims.

## AU–BA. Remaining work and gate

**AU. FREEZE BLOCKER:** Rail delay (`heavy`) lacks defined governed eligibility for Location Context, Community Pulse and KBYG. `delay-policy-projection.json` shows `PRODUCT_CONTRACT_UNDEFINED`; Alerts/map/popup remain eligible. Legacy KBYG/Pulse can still describe the active delay while Location Context says no active issues. This is existing on the starting code and was exposed by the required delay audit. The missing product-contract decision is distinct from the repaired stale marker, incorrect blocked copy and Route Details contrast. The combined audit acceptance gap in AT must also be closed before certifying this patch as a whole. It must be resolved consistently before freeze; do not merely change the zero label or borrow a legacy count to conceal it.

**AV. PRE-LAUNCH FOLLOW-UPS:** Real-device glyph recognition, keyboard/screen-reader/large-text checks, live provider outage/recovery and physical-device performance. Reporting stays operationally off until separately certified. These do not substitute for resolving AU.

**AW. POST-LAUNCH POLISH:** Optional simplification of “Local awareness” / “Historical Intelligence” and the secondary Route Details entry affordance; no new features proposed. Legacy unreferenced opener cleanup only after reachability is established.

**AX. STATEWIDE-CERTIFICATION ITEMS:** Cross-county saved Work/selected destination transitions and route-source/coverage ownership, including the out-of-county synthetic Work profile observed during exploration. This audit does not certify all counties, live geocoding/routing or source completeness. Those ownership systems were not modified.

**AY. UI freeze recommendation: HOLD.**

**AZ. Merge recommendation:** Hold. Review the bounded repairs, resolve the delay-policy blocker in its governed contract, then rerun the final gate. No merge performed.

**BA. Git status:** Seven files are uncommitted: modified css/styles.css, js/app.js and tests/lp236-alerts-information-architecture.test.mjs; new report, H unit test and two H browser tools listed in AC. No staged changes. Starting HEAD and branch remain unchanged.

## Final acceptance completion

F1 final: PASS — 5 startup profiles, 3 background refresh cycles, 20 location outcomes across 5 viewports, exact streets/freshness, disclosure, Home bytes and Route Watch protection; zero page errors. F2: PASS — 4 theme combinations, 30 popup cases and tile recovery; zero page errors. G2 final: PASS — 23 cycles, 4px expanded gap, hidden-control focus exclusion/restoration, stable ownership/camera, expanded popup/pan and tile recovery; zero page errors. H flow-only: PASS — 9 rail states, corrected route delay/confidence, Start/Stop, Around Me/Return Home, reduced Search and three-hazard parity; zero page errors. Route theme matrix: PASS — 20 cases, plus a separate post-color Start/Stop pass and final Route Watch screenshot. Full combined H: NOT CERTIFIED — preserved redraw failure described in AT. Final combined non-browser tests: 150/150. All 31 marker bytes remain equal; syntax and diff checks pass. No production write, push, merge, build or deployment. The policy blocker and combined acceptance gap mean HOLD / NO COMMIT despite those passing checks.
