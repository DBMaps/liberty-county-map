# LP243.E — Remaining Pre-Launch Owner Visual Sweep

**Mode:** audit only; observe first

**Authority:** current production consumer paths only

**Primary viewport:** mobile portrait

**Date:** 2026-08-31

LP243.A–D remain closed. This sweep does not reopen Alerts, Know Before You Go (KBYG), Location Context, POI data authority, Home Area transaction mechanics, reporting lifecycle mechanics, or popup mechanics. No launch blocker is established below. A visual concern becomes repair work only after current owner evidence confirms it, unless code alone establishes a clear consumer-facing defect.

## 1. Current remaining surfaces

| Surface | Production entry point | Current presentation authority | Exact owner action |
|---|---|---|---|
| Search / destination search | Search control from the portrait map / Location Context search action | `index.html` `#gridlySearchShell`; `showGridlySearchShell()`, `openGridlyDestinationSearchSurface()`, and `renderGridlySearchResults()` in `js/app.js`; late `.gridly-search-*` rules in `css/styles.css` | From the portrait map, tap **Search**. Enter a destination, inspect results, then tap one result. |
| Nearby Places | Embedded below destination Search when the certified POI gate is active | `js/gridlyPoiBrowserProvider.js` `ensureSurface()`, `refreshSurfaceContext()`, and `renderResults()`; `.gridly-poi-*` rules in `css/styles.css` | Open **Search**, scroll to **Nearby places**, choose radius/category, and tap **Find places**. Do not reassess provider activation or data authority. |
| Settings | Portrait bottom dock **Settings** | `buildSettingsSurfaceHtml()` and the shared `openGridlyPortraitV2Sheet()` lifecycle in `js/app.js`; Settings sheet rules in `css/styles.css` | Tap **Settings**; expand each section once, then close with the sheet close control. |
| Home Area picker | Settings → Awareness → Change/Choose Home Area | `openGridlyPrimaryHomeAreaChooser()`, `buildGridlySettingsAwarenessOptionsHtml()`, and `renderGridlyManualAwarenessAreaPicker()` in `js/app.js` | Open **Settings** → **Awareness** → **Change Home Area**. Search and select a candidate, but do not press **Use this Home Area** unless an actual change is intended. |
| Reporting flow | Portrait bottom dock **Report** | `buildReportHazardSurfaceHtml()`, `V2_REPORT_HAZARD_OPTIONS`, subtype options, and `bindV2SheetActions()` in `js/app.js`; shared Portrait V2 sheet/report CSS | Tap **Report**, choose a category (and subtype where shown), inspect both **Use my location** and **Tap the map** paths, and stop before final submission unless a live report is appropriate. |
| Community hazard popup | Community hazard marker on the map | `buildGridlyHazardPopupConsumerModel()` and the active hazard popup HTML writer in `js/app.js`; `.gridly-popup.gridly-premium-popup` rules | Tap a visible community hazard marker; inspect the popup without confirming or clearing it. |
| Crossing popup | Railroad-crossing marker on the map | `buildGridlyLeafletCrossingPopupConsumerModel()`, `buildPopup()`, and `buildGridlyCrossingPopupActionButtons()` in `js/app.js` | Pan/zoom to a visible crossing marker and tap it; do not submit **Report Blocked**, **Report Delay**, **Confirm Active**, or **Mark Cleared**. |
| Official roadway popup | DriveTexas / official-roadway marker on the map | `gridlyLp019OfficialPopupHtml()` and official marker publication in `js/app.js`; shared premium popup CSS | Tap a visible official-roadway marker and inspect title, roadway/location, description, official-source line, and freshness. |
| Empty / quiet states | Natural no-match/no-current-data paths in the surfaces above | Search and POI result writers; LP236 Alerts projection; current KBYG/Location Context presentation; reporting confirmation/status copy | Use a naturally unmatched Search query and POI category/radius. Capture Alerts/KBYG/Location Context only if the chosen area is naturally quiet; do not manufacture data or change Home Area solely to force quiet. |
| Landscape / wider view | The same current paths after viewport rotation/resize | Current loaded `index.html`, `js/app.js`, and responsive rules in `css/styles.css`; Portrait V2 remains portrait-only authority | After the portrait pass, rotate a phone, then inspect one tablet-ish and one wider viewport. Check only severe overlap, reachability, scroll, sheet sizing, and map presence. |

## 2. Owner walkthrough

This order keeps the current Home Area unchanged and minimizes repeated navigation.

1. **Start on the portrait map.** Capture the untouched map, top briefing, controls, and bottom dock.
2. **Search.** Open Search; inspect the initial hierarchy and map visibility. Enter a long valid destination name, inspect result wrapping/context/type labels and scrolling, select it, then verify close/back behavior and destination placement. Reopen Search and use a naturally unmatched query to capture no-results; observe the checking state during a real search if it remains visible long enough. Test keyboard open/dismiss and input/result scroll ownership.
3. **Nearby Places.** In the reopened Search surface, inspect its relationship to the current Gridly area, radius/category controls, category labels, card density, long/brand names, results scrolling, natural zero results, attribution, and close behavior.
4. **Map popups.** Close Search. Open, capture, and close one visible popup of each available kind in this order: community hazard, crossing, official roadway. Do not take report/confirm/clear actions.
5. **Reporting.** Tap **Report**. Inspect the initial category grid, one ordinary category, and **Other Hazard** plus subtype selection. Inspect selected states and button hierarchy. Exercise **Tap the map** through placement/confirmation but cancel before submission. Exercise **Use my location** only if comfortable granting location; stop before submission. Owner alone decides whether to complete a live test and capture its acknowledgement.
6. **Settings.** Close Reporting, open Settings, and capture the collapsed hierarchy. Expand Awareness, Travel, Notifications, Appearance, and Support one at a time; inspect control alignment, density, copy, scrolling, primary/secondary actions, any reset/destructive action that is actually visible, and close/focus return.
7. **Home Area picker without changing Home Area.** From Settings → Awareness, open **Change Home Area**. Search a long community name and a known canonical multi-county place. Select one candidate and capture that same result showing **Selected** with **Use this Home Area** directly below it. Do **not** confirm. Search a no-match term, test keyboard/scroll behavior, then return to Settings and verify the existing Home Area is unchanged.
8. **Natural quiet states.** Capture Search and Nearby zero results already visited. Capture Alerts, KBYG, Location Context, or a reporting quiet/acknowledgement state only when naturally available; do not reopen LP243.A–D or synthesize conditions.
9. **Bounded wider-view sanity.** Repeat only Search, one popup, Reporting, and Settings on a landscape phone; then spot-check Search and Settings at tablet-ish and desktop/wider widths. Stop if there is no severe breakage.

## 3. Current code-established concerns

| Classification | Current-path observation | Owner review boundary |
|---|---|---|
| **PRE-LAUNCH REVIEW** | Nearby Places result/status copy exposes implementation-oriented detail: result counts include “eligible,” zero results say the radius “was not widened,” failures mention that no alternate source was used, and result metadata derives a lowercase county identifier into a display string. These strings are in the active POI renderer; confirm what the certified production gate actually displays before creating work. | Capture populated, zero-result, and (only if naturally encountered) unavailable states. Check whether copy feels consumer-facing and whether county/category text is polished. |
| **PRE-LAUNCH REVIEW** | Active Settings and Reporting templates still mix action casing: **Change Home Area**, **Edit Home**, **Manage Places**, and **Send Feedback** coexist with **Show walkthrough again**, **Use my location**, and **Tap the map**. This is visual polish, not a functional defect. | Inspect adjacent actions in live Settings/Reporting screenshots. Repair only if the owner finds the inconsistency materially visible. |
| **PRE-LAUNCH REVIEW** | Static responsive rules establish bounded scroll owners for portrait Search and Settings, but code inspection cannot establish real keyboard compression, long-name wrapping quality, popup obstruction, or landscape sizing. | Device screenshots are the authority; look only for overlap, unreachable controls, broken scrolling, or loss of useful map area. |
| **POST-LAUNCH ENHANCEMENT** | Expanded Settings repeats local-device, location-use, and explanatory assurances. Its accordion presentation keeps the initial state restrained, so current code does not elevate this to pre-launch repair. | Note only if the expanded live view is meaningfully burdensome. |
| **POST-LAUNCH ENHANCEMENT** | Close controls still use more than one glyph treatment (`X` and `×`) across current reusable surfaces. Hit targets and accessible names are separately governed. | Park optical unification unless current evidence shows a usability problem. |
| **NO CURRENT CONCERN ESTABLISHED** | Search has explicit checking, unavailable, exact-address-not-confirmed, and no-match messages; results have title, context, type, selectable state, and a portrait single-scroll owner. | Verify visually; no repair is established by code. |
| **NO CURRENT CONCERN ESTABLISHED** | Home Area still renders one candidate presentation, selected state and CTA together, explicit confirmation, no automatic save, and one canonical result for a multi-county place. | Visual sweep only; LP242.1 remains closed. |
| **NO CURRENT CONCERN ESTABLISHED** | Reporting presents category/subtype selection before enabling map/location placement, and uses the shared sheet lifecycle. Popup writers provide title/location, trust or source, freshness, and relevant actions without exposing audit objects. | Visual sweep only; do not reopen certified mechanics. |
| **NO CURRENT CONCERN ESTABLISHED** | Current responsive code does not itself establish severe overlap, inaccessible controls, unusable sheets, broken scroll ownership, or map disappearance. | Complete the bounded viewport checks before acceptance. |

None of these items is classified as a launch blocker. **Observe first.**

## 4. Role-based casing review

LP243.A–D effectively resolved the meaningful current condition-label examples: official-roadway and KBYG condition labels, Alerts presentation, and **Community Reports Blocked** remain closed with no new contrary evidence.

One current inconsistency remains for owner review: **action-role casing** varies between title-style Settings actions and sentence-style Settings/Reporting actions (examples listed above). Headings such as **Settings**, **Awareness**, and **Nearby places** are coherent within their role; navigation labels are concise; condition labels have no newly established inconsistency; narrative and empty-state copy appropriately remain sentence case. All-caps travel/source eyebrows are a separate group-label role, not evidence that all UI should be transformed.

Do not apply a global text transform or create a universal casing project from this audit.

## 5. Post-launch parking lot

1. **Unified close-glyph treatment:** choose one code-native close icon treatment while retaining current accessible names, target size, close lifecycle, and focus restoration.
2. **Settings copy compression:** after launch usage evidence, reduce repeated local-storage/location explanations while preserving each essential assurance once in context.

These remain non-blocking enhancements unless current owner screenshots establish a meaningful usability issue.

## 6. Final owner checklist

Send one portrait screenshot set per numbered group; add landscape/wider screenshots only for severe or ambiguous results.

- [ ] **Search:** initial, keyboard open, checking (if observable), populated results, long name, selected destination, no results, close/back, useful map visible.
- [ ] **Nearby Places:** current-area context, categories/radius, populated cards, long/brand name, zero results, scrolling, attribution, close/back, consistency with Search.
- [ ] **Community popup:** title, location, condition, freshness/trust, actions, long text, map obstruction.
- [ ] **Crossing popup:** title/location, community-report wording, freshness/confidence, actions, long text, map obstruction.
- [ ] **Official popup:** title, roadway/location, condition narrative, **Official Source · DriveTexas**, freshness, spacing, map obstruction.
- [ ] **Reporting:** entry, category, subtype, selected state, map/location choice, placement/confirmation, cancel/back/close, keyboard/scroll, submit hierarchy; no live submission unless owner-approved.
- [ ] **Settings:** collapsed hierarchy, every expanded section, Home Area presentation, casing, alignment, density, scrolling, secondary/destructive actions if visible, no technical leakage, close return.
- [ ] **Home Area:** field, long name, canonical multi-county result, one selected result, adjacent **Use this Home Area**, no results, keyboard/scroll, return without unintended save.
- [ ] **Quiet states:** only naturally available Search, Nearby, Alerts, KBYG, Location Context, and reporting examples; concise, useful, non-diagnostic, and not falsely implying provider failure.
- [ ] **Landscape phone:** Search, one popup, Reporting, Settings—no severe overlap, inaccessible control, broken scroll, unusable sheet, or missing map.
- [ ] **Tablet-ish / wider:** Search and Settings spot-check—same severe-breakage criteria only; no desktop redesign review.
- [ ] Record each observation as **accepted**, **screenshot requested**, or **owner evidence confirms repair work**. Do not turn static-code possibilities into repairs by default.

**Inspect first:** **Search / destination search**, because it is the remaining map-first gateway and also leads directly into Nearby Places without changing Home Area or creating consumer data.
