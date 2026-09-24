# LP244.48H1 — final freeze-blocker closure

23 September 2026. Local Edge/Playwright audit. This report supersedes the H gate decision; the original H report is preserved as historical evidence. Browser evidence and screenshots are in `.artifacts/lp24448h1/`. No physical Android/iOS, screen-reader, live-provider or statewide certification is implied.

## A–E. Starting point and assessment

**A. Branch:** `LP244.48-destination-quick-check-around-me`.

**B. Starting HEAD:** `8911cf0ce13f5beef632719e91f7ea82f51dfb64`.

**C. Starting status:** three modified tracked files and four untracked H files; nothing staged. Branch and HEAD matched exactly. No reset, restore, stash, checkout, rebase or discarded work.

**D. Starting dirty inventory:** `css/styles.css`, `js/app.js`, `tests/lp236-alerts-information-architecture.test.mjs`, `docs/launch/LP24448H-FINAL-POLISH-FREEZE-GATE.md`, `tests/lp24448h-freeze-presentation.test.cjs`, `tools/lp24448h/verify-browser.cjs`, `tools/lp24448h/verify-route-colors.cjs`. Full copies, tracked diff, status and diff stat were saved under `.artifacts/lp24448h1/start/` before H1 edits.

**E. Assessment:** Both freeze blockers are closed by bounded, reproduced repairs. The additional Settings native-select issue is repaired through the existing choice-control and save/apply paths. All required regression runs pass. UI FREEZE: **APPROVE** within this local browser audit's scope.

## F–K. Delay policy and state matrix

**F. RCA:** The normalized crossing delay is a community crossing report with legacy `type: heavy`, an explicit crossing ID and normal timestamps. The governed policy did not classify that value as a crossing delay. Its fallback allowed Alerts/map/popup but left Location Context/Pulse/KBYG undefined. Meanwhile legacy crossing projections actively warned about the delay. The default governed input also consumed every raw crossing report, unlike the existing marker/grouped-incident latest-state selector. Adding eligibility alone would permit multiple reports about one crossing to inflate a condition count.

**G. Existing semantics:** Blocked crossings and current road hazards are active local issues. Rail delay already produced an active grouped incident, delay marker, popup, Alerts item, KBYG travel warning and route-awareness reason. Existing current/expired/cleared lifecycle rules separate active conditions from history. There was no communicated product distinction that justified calling a warned-about crossing delay “No active issues nearby.” Existing canonical ordering selects the newest condition per crossing, with clear winning equal-time ties; raw reports remain evidence rather than independent crossing conditions.

**H. Final policy:** An in-scope, current, active community crossing delay is one active local issue. It uses the blocked-crossing surface eligibility and crossing-specific map/popup ownership. It is not official roadway evidence. An inactive, expired or cleared crossing is excluded from active counts. Existing cleared-history semantics remain. No confidence, expiry, severity, storage or report payload is changed.

**I. Trace and affected surfaces:**

| Stage/surface | Source and classification | Inclusion/count | Wording, freshness and trust | Clear behavior |
| --- | --- | --- | --- | --- |
| Local fixture → normalized report | Local `reported-crossing-delay` becomes `activeReports` crossing `heavy` with report/crossing IDs | Existing local fixture and normalization | Original timestamps, community provenance and confidence remain | Existing local clear action removes/retires active evidence |
| Canonical crossing state | `getLatestReportStateByLocation` / `getLatestReportsByCrossing` | Latest nonexpired report per crossing key | Recency and clear tie-break unchanged | Latest clear cannot be active |
| Grouped rail incident | `getConsolidatedIncidents` retains report evidence and canonical latest report | One group per crossing, report count is evidence count | Latest `heavy` remains delay | Latest clear makes group inactive |
| Active incident projection | `getUnifiedIncidents`, `rail_delay` | One active rail incident per crossing | “Reported crossing delay”; community slow-traffic description | Clear has cleared status, excluded from active rows |
| Governed projection | Canonical latest crossing rows + hazards + existing provider records | Explicit `crossing_delay`; geography + current lifecycle + surface policy | Same source timestamps and trust fields; no fabricated corroboration | Active eligibility false; history is separate |
| Location Context | Governed `locationContext` | One issue per active delay | “1 roadway issue nearby”; no false quiet claim | Count returns to zero without unrelated issues |
| Community Pulse | Governed active-awareness rows and existing story | One delay contribution | “Crossing delays reported”; existing early/developing evidence semantics | Active contribution removed |
| KBYG | Governed `kbygCommunity` and existing brief evidence | One community issue; zero official roadway contribution | “Community reports indicate a crossing delay”; source freshness retained | No stale active delay mention |
| Alerts | Current community surface rows; governed membership, existing writer identity | One card per current crossing condition | “Reported Crossing Delay”, original freshness, truthful read-health warning | No stale cleared card |
| Map | Existing canonical crossing marker owner | One crossing marker; infrastructure is not a counted issue | Approved delay asset 23; no asset/size change | Neutral asset 25 replaces active indication |
| Popup | Existing crossing-specific popup owner | One current selected crossing condition | “Reported Crossing Delay”, awaiting additional reports; no single-report “confirmed” | Reopened popup reflects cleared/neutral state |

**J. Repair performed:** Yes. `js/governed-awareness.js` adds explicit delay classification, eligibility and crossing ownership. Legacy `heavy` requires explicit crossing ownership, so road-heavy records are not relabeled rail. `js/app.js` uses the existing latest-per-crossing selector for default governed input. Raw reports and explicit projection-input semantics remain unchanged.

**K. Required matrix:** Each browser checkpoint records Location Context/Pulse text and count, KBYG text, Alerts DOM/model IDs, governed rows, canonical reports, grouped/unified incidents, marker assets and active popup text. H additionally tests actual popup Mark Cleared and neutral reopening.

| State | Expected active issues across Location/Pulse/KBYG/Alerts |
| --- | --- |
| A quiet | 0 |
| B blocked | 1 |
| C delay | 1 |
| D blocked + unrelated hazard | 2 |
| E delay + unrelated hazard | 2 |
| F blocked cleared | 0 |
| G delay cleared | 0 |
| H blocked → clear → delay | 1 → 0 → 1 |
| I delay → clear | 1 → 0 |
| J two independent delays | 2 |

The fixture harness correctly rejects a second active fixture on the same crossing. Integration tests separately supply duplicate raw aliases and mixed blocked/delay/clear reports to the actual canonical selector and governed projection; one latest condition survives without mutating the input report array.

## L–Q. Alerts reproduction and closure

**L. Reproduction:** Before repair, three current hazard rows remained in `getAlertsSurfaceSnapshot().alerts`, but the DOM had zero cards. The read owner changed from the old unset-area owner to Dayton; community coverage became `UNAVAILABLE` / `not_started`. The renderer retained known rows during `LOADING` only. The deterministic combined test uses quiet → three hazards → open/expand/refresh → close → blocked → clear → delay → reopen → Search → Home → Around Me → Home → reopen/refresh → manual disclosure close/reopen → five Show me/reopen cycles. Baseline evidence: `before-alerts.json`.

**M. RCA:** LP236 presentation eligibility conflated live-read availability with the existence of current governed community evidence. A failed/unstarted/stale read suppressed valid rows, leaving the combined audit's Show me locator with no card. This was a repeatable shared presentation defect, not proof that the underlying current incident records disappeared.

**N. Classification: E — shared consumer model defect.** Specifically, the shared Alerts presentation model/renderer gated current governed rows on provider read health. The underlying source snapshot was correct. No DOM ownership or render scheduler rewrite was justified. During H1 test development a writer-ID assertion and a second-crossing camera wait were corrected in the harness; those were separate test issues, not the reproduced H failure.

**O. Repair performed:** Yes. Retain positive current community rows in `LOADING`, `UNAVAILABLE` and `STALE` states, while preserving coverage-incomplete status and respectively “Checking live community reports,” “Live community updates unavailable,” or “Live community updates delayed.” The governed lifecycle/geography still decides membership. Zero known rows are not converted into an all-clear statement when coverage is unavailable.

**P. Combined proof:** `browser-<width>.json` records 12 matrix and 13 combined checkpoints per width. Each includes visible/open state, source disclosures, DOM and model IDs/counts, governed rail/hazard types, canonical/grouped state, owner, read health, observed DOM render revision and page errors. The existing snapshot has no generation field; `modelGeneration: null` is recorded honestly. The revision observer is test-only. Closed sheets may retain hidden DOM until reopened; reopening must match current IDs. No production observer, timer or redraw workaround was added. The full original H combined script is also rerun unchanged with neither flow-only nor rail-only overrides.

**Q. Separate proof:** LP236 unit coverage explicitly tests all three uncertain read states and clear-to-zero. F1 independently exercises scheduled refresh/disclosure/scroll preservation; the full H consumer flow tests Show me and real entry controls. Final run totals are below.

## R–S. Exact change inventory and H preservation

**R. Final intended inventory (12 files):**

| File | Origin/change |
| --- | --- |
| `css/styles.css` | H Route Details colors/focus retained; H1 scoped Settings choice presentation |
| `js/app.js` | H renderer/state/copy/trust repairs retained; H1 canonical governed input, Alerts uncertainty eligibility, Settings markup/controller binding |
| `js/governed-awareness.js` | H1 crossing-delay policy/classification/ownership |
| `tests/lp236-alerts-information-architecture.test.mjs` | H delay integration retained; H1 uncertain-read retention test |
| `tests/lp24448h-freeze-presentation.test.cjs` | Original H, byte-identical to starting snapshot |
| `tools/lp24448h/verify-browser.cjs` | Original H, byte-identical |
| `tools/lp24448h/verify-route-colors.cjs` | Original H, byte-identical |
| `docs/launch/LP24448H-FINAL-POLISH-FREEZE-GATE.md` | Original historical H report, byte-identical |
| `tests/lp24448h1-freeze-closure.test.cjs` | H1 canonical/policy integration coverage |
| `tools/lp24448h1/verify-browser.cjs` | H1 state matrix and combined Alerts sequence |
| `tools/lp24448h1/verify-settings.cjs` | H1 saved-state/reload/keyboard/viewport audit |
| `docs/launch/LP24448H1-FREEZE-BLOCKER-CLOSURE.md` | This report |

**S. Preservation:** Four original H-only files are byte-identical. H1 makes bounded additions to the three shared H files. The original marker-update guard repair, delay/corroboration corrections, route theme repair, Settings guidance and pre-consent Preparing wording remain. No route logic, Home storage, temporary context, reporting protocol, backend, retention, statewide package or marker artwork edits.

## Settings native-select closure

**RCA and exact controls:** Portrait Appearance used `select[data-v2-settings-field="display.mapStyle"]` and `select[data-v2-settings-field="display.theme"]`. Open native-select menus are owned by the browser/OS and need not inherit the Settings surface's typography, dimensions or containment. CSS on the closed select cannot reliably make that system popup match Gridly. The repair removes only those visible portrait native selects.

**Repair performed:** Yes. The existing segmented-choice button classes and `installGridlyGovernedChoiceControls` now render Map Style as Standard / Satellite and Theme as Device / Light / Dark. Hidden value inputs retain the exact `data-v2-settings-field` binding. No dropdown overlay, dependency, new settings system or persistence key.

**Values, handlers and side effects:** Map Style stores `standard` / `satellite`; Theme stores `system` / `light` / `dark` (Device is the visible label for `system`). Fresh profile observed `standard`, `system`, text size `large`. Existing `saveV2SettingsFromControl` → `saveGridlySettingsPreferences` → `applyGridlySettingsDisplayPreferences` remains the save/apply chain. Existing `gridlySettingsV1.display` and the `gridlyMapStyleV1` Standard/Satellite mirror are retained. The original theme attributes/classes/color scheme and device-media listener remain; map changes still switch the existing base layer through the existing handler. Exactly one selected map base layer is asserted.

**Persistence/reload proof:** Seven saved-state steps cover Standard → Satellite → Standard and Device → Light → Dark → Device. Each step checks persisted JSON, in-memory preferences, effective theme/map layer and legacy map mirror, then closes/reopens Settings and reloads the page. Device mode also follows emulated dark/light preference changes. Home-related persisted bytes remain unchanged.

**Accessibility proof:** Two named `radiogroup`s; buttons expose `radio`, accurate `aria-checked`, one selected/tabbable choice per group, and native button Space/Enter activation. Existing arrow navigation wraps; Home/End support was added to the shared controller. Browser tests exercise Right, Left wrap, Home, End and Space, along with click activation. All choices have at least 44×44 CSS-pixel targets, clear selected styling and existing focus treatment. This verifies browser DOM and keyboard behavior, not a screen-reader certification.

**Viewport proof:** 320/360/390/440×844 with standard/large/compact text, 12 cases. No clipped/horizontally overflowing choices; two equal Map Style columns and three Theme columns. Screenshots and measured rectangles are in `settings.json` and `settings-<width>-<text>.png`.

**Native/WebView assumptions:** DOM buttons/radio semantics and localStorage use existing web mechanisms and avoid the native select popup. Android WebView and iOS WKWebView are expected to support those mechanisms, but no native build/device test was performed. Touch, VoiceOver/TalkBack, physical keyboard, OS text scaling and native startup restoration remain device-validation assumptions, not claimed results.

## T–AS. Final verification and gate

**T. Three-hazard parity:** Protected local fixtures use flood 30.047253308692213/-94.88737106323242 age 0, debris 30.0505/-94.8890 age 5, and power line 30.0435/-94.8815 age 12. Full H returns three fixtures/markers and Location Context/Pulse/KBYG/Alerts all three. H1 combined starts with that baseline and adds/removes exactly one rail condition.

**U. Street/freshness parity:** Cook Street and Church Street; Winfree Street and Flowers Street; Hope Street and Nancy Street. F1 compares the independent fixture ages with popup/Alerts labels, including a production-shaped seven-minute record. Elapsed audit time naturally advances minute labels; source ages are not reset on redraw. No `undefinedm`.

**V. Blocked proof:** One canonical active crossing, one governed issue/card, blocked wording and asset 24. Actual popup Mark Cleared passes in the unchanged H harness.

**W. Delay proof:** Legacy `heavy` → governed `crossing_delay` → unified `rail_delay`; one issue/card, delay asset 23, “Reported Crossing Delay,” no blocked wording or single-report confirmation. The full H Route Details output says a reported crossing delay may affect the trip, “Developing conditions,” and “1 community report nearby.”

**X. Cleared proof:** Active rows/counts disappear; marker reverts to neutral asset 25 and reopened popup is no longer blocked/delay. Unrelated hazards remain. H1 checks both blocked and delay clear transitions plus blocked → clear → delay.

**Y. No-double-count proof:** Actual canonical selector integration covers repeated raw aliases, older blocked + newer delay, latest clear, and two independent crossings. One condition per crossing; report evidence arrays remain intact. Infrastructure is absent from active inputs/counts. H's single-report route corroboration correction remains covered.

**Z. Disclosure proof:** F1 checks three background refresh cycles; H1 checks open disclosure preservation, manual close across refresh/reopen, sheet remaining closed, current data on reopening and repeated Show me. The repeated Show me loop waits for the existing focus operation to settle before reopening; the first 320px immediate-state assertion is retained as intermediate evidence, not a passing result.

**AA. Search/Return Home:** H1 records SEARCH → HOME with current governed parity. Full H checks visible search/result/selected destination/route entry and reduced-height Search.

**AB. Around Me:** H1 records AROUND_ME → HOME through the foreground-position callback boundary. F1 separately tests finding/success/denied/stale/timeout at its five viewports.

**AC. Home persistence:** F1 compares relevant Home/settings/profile storage bytes; full H compares saved places. Settings verification separately confirms Home-related keys remain byte-identical while only appearance preferences change.

**AD. Route Watch:** F1 checks active Route Watch ownership and rejection of foreground/late location takeover. Full H uses local synthetic routing to exercise real preview, details and Start/Stop controls. Route calculation and ownership code are unchanged.

**AE. Popup containment:** F2 rerun results recorded below; covers hazard/neutral/blocked/delay popups, edge containment and close/reopen/pan across its five viewports.

**AF. KBYG controls/gap:** G/G1/G2 rerun results recorded below. Existing expanded control hiding, keyboard exclusion, restore, map/camera/filter/context ownership and intentional 4px filter-to-painted-map gap remain protected.

**AG. Tile recovery:** F2 and G2 simulate unavailable tiles and then labeled local recovery tiles, including expanded KBYG. No live tile availability claim.

**AH. Marker integrity:** All 31 approved PNGs, including nested directories, byte-equal to starting HEAD; SHA-256 inventory in `marker-integrity.json`. No marker artwork/size/anchor edits.

**AI. Focused tests:** 75/75 passed: H1 policy/canonical integration, LP236 Alerts information architecture and LP223 crossing policy. Evidence: `focused-tests.txt`.

**AJ. Broader tests:** 176/176 passed in `broader-tests.txt`: H/H1, unified awareness, LP236, F1/F2, shared active-issue contract, crossing control/popup diagnostics, route decision/refinement/coverage, LP223 and crossing consumer presentation/scope. `node --check` passes app, governed module and H1 scripts/tests; `git diff --check` passes. No full repository-wide test claim.

**AK. Browser results:** All passed on the final production code:

| Run | Final proof |
| --- | --- |
| F1 | Five startup profiles; three background refresh cycles; 20 location outcomes; street/freshness, disclosure, Home bytes and Route Watch protection |
| F2 | Four theme combinations; 30 popup cases at five viewports; synthetic tile recovery |
| G | Density/marker and consumer-surface smoke, including all four full-height widths |
| G1 | Expanded-control hide/restore, stable ownership/camera, pointer pan and marker tap |
| G2 | 23 cycles; 4px expanded gap; hidden-control focus exclusion/restoration; pan/popup/tile recovery |
| Full H | Unchanged complete combined consumer + nine rail states; real openers, Show me, report consent boundary, Search/Around Me/Home and route controls |
| H route themes | 20 theme/viewport cases and final Start/Stop Route Watch |
| H1 | All A–J states (12 checkpoints) and 13 combined checkpoints at 320/360/390/440×844; five settled Show me/reopen cycles at each width |
| Settings | 39 checks: defaults, seven save/reload cycles, close/reopen, keyboard, device-theme following and 12 width/text-size cases |

390×844 is authoritative; F1/F2/G1/G2/route additionally cover the 390×500 reduced-height proxy where implemented. Final evidence copies are `f1.json`, `f2.json`, `g.json`, `g1.json`, `g2.json`, `full-h.json`, `route-colors.json`, `browser-320/360/390/440.json` and `settings.json`. `final-results.json` aggregates those results. Screenshot inventory is `screenshot-inventory.txt`; representative final Settings images are `settings-320-large.png`, `settings-390-large.png` and `settings-saved-theme-dark.png`. Delay/combined images use their checkpoint name and width. Baseline `before-*` and `show-me-immediate-assertion-320.json` are explicitly intermediate evidence.

**AL. Runtime errors/warnings:** Zero page exceptions across all 12 final browser result files. Warnings are intentional service-worker blocks. Recorded console-error counts: full H 358, route themes 121, H1 widths 139/148/154/154, Settings 465. These are blocked resource fetch failures, report-sync failed-fetch logging and the H report attempt's expected `terms_required` refusal. F1/F2/G/G1/G2 record page errors and warnings but do not collect the full console-error stream. This is not a clean-console claim or a physical-device performance certification.

**AM. Backend-write proof:** Every browser context blocks non-GET/HEAD/OPTIONS methods, service workers and WebSockets; external services are aborted or explicitly fulfilled locally. Local fixture changes never reach production. Zero production writes transmitted. Reporting-status RPC/geocode POST attempts, when present, are aborted rather than described as zero attempts. No consent acceptance or production reporting activation.

**AN. Remaining freeze blockers:** None in the audited scope. Physical Android/iOS, assistive-technology, live-provider and statewide operational checks remain outside this UI freeze certification. Reporting remains disabled/uncertified operationally; no production activation is implied.

**AO. UI FREEZE: APPROVE.**

**AP. Commit:** The passing gate authorizes the requested single local commit containing all 12 H + H1 files. Commit creation and clean-status verification are the final delivery step.

**AQ. Commit identity:** `Close final Gridly UI freeze blockers`; this report is included in that commit. Its resulting hash is supplied in the task's final response, avoiding a self-referential hash inside the commit's own contents.

**AR. Merge recommendation:** Ready for owner review/merge on the audited UI scope. No push, merge, native build or deployment performed.

**AS. Final status:** Exact 12-file inventory verified with no unrelated drift; syntax and diff checks passed before staging. The task's delivery confirms the post-commit status. Starting H work is preserved; no artifact or marker asset is included as an accidental change.
