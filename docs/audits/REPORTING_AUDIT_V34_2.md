# V34.2 Reporting Architecture Audit (Map-First Readiness)

## Scope
This audit documents all currently active reporting entry points, execution paths, duplicated logic, and consolidation opportunities for a map-first reporting model without changing runtime behavior.

## 1) Active reporting entry points

### A. “Report Crossing Near Me” / “Report Issue Near Me” CTAs
- Desktop hero CTA (`#desktopReportNearMeBtn`) triggers `handleReportNearMe`.  
- Desktop left rail CTA (`#desktopReportNearMeBtnRail`) triggers `handleReportNearMe`.  
- Map shortcut button (`#mapReportShortcutBtn`) also triggers `handleReportNearMe`.  
- Mobile sticky CTA (`#mobileReportBtn`) triggers `handleSmartReportButton` (which either quick-clears or delegates to `handleReportNearMe`).
- Mobile “Report What You See” CTAs (`#mobileQuickReportBtn`, `#mobileQuickReportSmallBtn`) trigger `handleReportNearMe`.

### B. Quick report drawer flow
- `#reportSection` contains the primary quick-report instructions and confirmation/status surface (`#reportConfirmation`).
- Includes `#quickClearBtn` (“Mark Cleared Now”), which calls `createSharedReport(..., "cleared", ...)` when there is a prior submitted crossing.

### C. Manual crossing report flow (advanced)
- `#manualReportBtn` invokes `submitManualReport()`.
- Uses selected crossing (`#crossingSelect`) + report type (`#manualReportType`) and routes to:
  - `createSharedReport` (rail mode), or
  - `createSharedHazardReport` (road hazard mode).

### D. Popup marker reporting flow (crossings)
- Popup buttons in `buildPopup()` render per crossing (`Blocked`, `Delay`, `Cleared`, `Other`).
- `wirePopupReportButtons()` wires popup buttons and calls `window.reportCrossingFromPopup()`.
- `window.reportCrossingFromPopup()` resolves crossing and submits via `createSharedReport()`.

### E. Popup incident reporting flow (unified incidents)
- Unified incident popup actions are handled by delegated `data-unified-action` click/pointer handlers.
- `handleUnifiedIncidentAction()` routes:
  - rail confirm/clear -> `createSharedReport()`
  - hazard confirm -> `createSharedHazardReport()`
  - hazard clear -> `clearHazard()`

### F. Map click reporting
- Hazard map placement uses `openHazardPlacement()` + `pendingHazardPlacement` then `handleHazardPlacementMapClick(event)` submits via `createSharedHazardReport()`.
- Crossing map-click reporting is indirect: map click opens/targets marker popup, then popup button submits.

### G. Mobile report mode flows
- Mobile mode buttons (`#mobileCrossingReportBtn` / `#mobileHazardReportBtn`) toggle `setReportMode(REPORT_MODES.rail|roadHazard)` and relabel advanced manual report UI.
- Mobile sticky report button has dual behavior (report vs quick clear) using `handleSmartReportButton()` and prior state (`lastSubmittedCrossing`, `lastSubmittedReportType`).

### H. Desktop report mode flows
- Desktop uses same `handleReportNearMe` + map popup reporting path as mobile for crossing reports.
- Desktop also has injected hazard launcher/panel (`#gridlyHazardLauncher`, `#gridlyHazardPanel`) with “Use My Location” and map placement.

## 2) Responsibility map (functions)

- Opening report UI/state:
  - `activateReportMode()`
  - `openHazardPanel()` / `closeHazardPanel()`
  - `setReportMode()` for rail vs road-hazard manual mode
- Arming map placement:
  - `openHazardPlacement()` sets `pendingHazardPlacement` and selected hazard
  - `handleHazardPlacementMapClick()` consumes pending placement
  - `handleReportNearMe()` builds `nearbyReportCrossingIds`, zooms marker popup
- Hazard selection:
  - `setReportMode()` (manual mode context)
  - hazard panel grid click handling (`data-action="open-hazard-placement"`)
  - `selectedQuickHazardType`, `pendingHazardPlacement`
- GPS reporting:
  - `handleReportNearMe()` (crossing-near-me location)
  - `submitHazardNearMe()` (hazard GPS submit)
- Report submission:
  - Crossing: `createSharedReport()`
  - Hazard: `createSharedHazardReport()`
  - Hazard clear: `clearHazard()`
  - Popup crossing bridge: `reportCrossingFromPopup()`
  - Unified popup bridge: `handleUnifiedIncidentAction()`
- Supabase insert:
  - `createSharedReport()` -> `supabaseClient.from("reports").insert(row)`
  - `createSharedHazardReport()` -> same
  - `clearHazard()` -> same
- Route intelligence refresh:
  - `runPostSubmitRefresh()` calls `updateRouteIntelligence()` + movement/corridor refresh
  - `loadSharedReports()` also calls `updateRouteIntelligence()` after sync
- Map marker refresh:
  - `runPostSubmitRefresh()` -> `renderCrossings()` + `renderUnifiedIncidents()`
  - `loadSharedReports()` -> `renderCrossings()` + `renderUnifiedIncidents()`

## 3) Duplicated / overlapping logic

1. **Multiple reporting mode systems**
   - `activeReportMode` (rail vs road hazard manual mode)
   - `reportModeBanner` visibility state (map-first crossing mode)
   - hazard panel visibility and hazard selection state (`selectedQuickHazardType`, `pendingHazardPlacement`)

2. **Multiple open/close systems**
   - Drawer/details driven (`#reportSection`)
   - Injected hazard panel (`openHazardPanel/closeHazardPanel`)
   - Map-first activation (`activateReportMode`) not coupled to drawer/panel state

3. **Multiple hazard selection systems**
   - Manual select (`#manualReportType`) in road hazard mode
   - Hazard panel button selection (`.hazard-choice-grid button.selected`)
   - Unified popup incident actions mapped from incident type

4. **Multiple success/error messaging systems**
   - `setConfirmation(...)` for user-facing reporting status
   - `setSync(...)` for sync status
   - Button-local transient states (`is-submitting`, `is-success`, button text swapping)

5. **Refresh duplication**
   - `runPostSubmitRefresh()` and `loadSharedReports()` both trigger many of the same downstream rendering/intelligence functions.

## 4) Dead / legacy / secondary flows still mounted

- `#reportSection` is labeled “Primary flow” but also carries advanced/manual paths and mode switching; this creates mixed-primary UX.
- Injected hazard launcher/panel appears as parallel report surface, not integrated with map-first crossing report rail.
- Legacy quick-clear behavior on mobile sticky button (`handleSmartReportButton`) changes button semantics contextually (report vs clear), potentially conflicting with map-first expectations.
- Both direct popup button binding and delegated popup click handling are active in `wirePopupReportButtons()` (defensive but overlapping).

## 5) Reporting-related UI containers

- **Desktop:**
  - hero CTA(s), left-rail CTA, map shortcut CTA, report drawer (`#reportSection`)
- **Mobile:**
  - sticky report button (`#mobileReportBtn`), mobile quick report cards, report mode card inside report drawer
- **Floating panels / overlays:**
  - injected hazard launcher + counter + panel (`#gridlyHazardLauncher`, `#gridlyHazardCounter`, `#gridlyHazardPanel`)
- **Drawers / sheets / details:**
  - report drawer (`<details id="reportSection">`)
  - advanced manual reporting subsection (`<details class="report-tools-advanced">`)
- **Map popups:**
  - crossing popup action grid
  - unified incident popup action grid
- **Modals (adjacent, not reporting-primary):**
  - route setup modal, smart alerts modal (should remain out of reporting consolidation)

## 6) Safest single source of truth candidates

### Selected hazard type
Use a single `reportIntent` object (state only, no UI rewrite yet), with `reportIntent.hazardType` as canonical. Mirror to existing fields during migration.

### Pending map placement
Canonical should be `reportIntent.pendingPlacement` with enum-like values: `none | crossing-nearby | hazard-manual` and payload.

### Report mode active state
Canonical should be `reportIntent.mode` with explicit values: `rail` | `road_hazard`, replacing fragmented mode derivations (`activeReportMode` + banner + panel visibility inference).

### Submission state
Canonical should be `reportIntent.submission` with `idle|submitting|success|error` + metadata; existing button classes can subscribe to this state.

## Recommended consolidation strategy

1. **Unify orchestration, preserve submitters**
   - Keep `createSharedReport`, `createSharedHazardReport`, `clearHazard` intact.
   - Add one report-intent coordinator that all entry points call before submission.

2. **Normalize entry points into one dispatcher**
   - Introduce a thin `startReportFlow({source, mode, method})` wrapper.
   - Existing handlers (`handleReportNearMe`, popup actions, manual submit, hazard panel actions) call dispatcher first.

3. **Keep current UI containers, reduce state divergence**
   - Do not remove drawers/panels/buttons yet.
   - Make them projections of shared state to avoid behavior drift.

4. **Centralize post-submit effects**
   - Route all successful submits through one `onReportSubmitted(result)` that calls `runPostSubmitRefresh` and unified UX updates.

## Lowest-risk migration plan

1. **Phase 0 (now, safe): audit + instrumentation only**
   - Document all entry points and log source-tag usage consistently.

2. **Phase 1: state adapter (no UX change)**
   - Add `reportIntent` store.
   - Write adapter methods that set both new store and legacy vars.

3. **Phase 2: entry-point convergence**
   - Migrate each handler to dispatcher one-by-one, keeping old function signatures.

4. **Phase 3: message/feedback convergence**
   - Funnel reporting messages through a single notifier wrapper that still calls `setConfirmation`/`setSync` under the hood.

5. **Phase 4: optional cleanup (later)**
   - Remove duplicated state vars and redundant event paths only after parity verification.

## Which flows should remain

- Map-first nearest-crossing flow (`handleReportNearMe` -> popup action -> `createSharedReport`).
- Popup reporting from crossing markers.
- Manual advanced fallback flow (safety/edge cases).
- Hazard reporting support (GPS + map placement + clear) for parity with current capabilities.
- Unified incident popup confirm/clear actions.

## Which flows should be deprecated (eventually)

- Parallel/independent hazard panel state model (after consolidated intent state exists).
- Dual semantic mobile sticky button toggling report/clear without explicit mode indicator.
- Redundant popup handler duplication (direct + delegate) once event reliability is proven.

## What can be safely unified now

- Shared state model introduction (adapter style).
- Entry-point dispatcher for source/mode/method tagging.
- Centralized post-submit side-effects wrapper.
- Centralized reporting notifier wrapper.

## What should wait until later

- Removing visible UI surfaces (drawer/panel/button) or changing navigation architecture.
- Reworking Leaflet popup architecture.
- Supabase schema/query rewrites.
- Route-watch, route scoring, alternate-route logic internals.
