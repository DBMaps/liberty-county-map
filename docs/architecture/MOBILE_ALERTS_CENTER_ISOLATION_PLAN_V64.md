# MOBILE ALERTS CENTER ISOLATION PLAN (V64)

## 1) Current behavior summary

- The Alerts Center UI is currently the `#alertsSection` aside, which is also marked as `.desktop-command-panel` in `index.html`.
- On desktop, navigation scrolls to `#alertsSection` and users interact directly with the drawer cards (`Rail Pulse`, `Impact Score`, etc.).
- On mobile (`max-width: 760px` logic), selecting alerts primarily changes `data-mobile-mode` to `alert` via `setMobileUiMode("alert")` and does not scroll to section content.
- The Daily Panel’s **Open Alerts Center** action currently closes `#mobileNativeSurfaceLayer`, then calls `setMobileUiMode("alert")` and `scrollToSection("alertsSection")`.
- Because mobile `scrollToSection()` short-circuits and only flips mode state, mobile “open alerts center” behavior is state-driven but still semantically targeted at desktop `#alertsSection`.

## 2) Current dependency chain

Current chain for Daily Panel “Open Alerts Center”:

1. `bindDailyPanel()` handles `[data-mobile-surface-action="open-alerts-center"]`.
2. `closeSurface(action, { nextMode: "alert" })` hides `#mobileNativeSurfaceLayer` and sets mobile mode.
3. Post-close block logs/queries `document.getElementById("alertsSection")` and computed style.
4. Calls `setMobileUiMode("alert")`.
5. Calls `scrollToSection("alertsSection")`.
6. On mobile, `scrollToSection()` does not scroll and only re-applies `setMobileUiMode("alert")`.

Navigation coupling chain:

- `routeNavSection("alerts")` maps to `navTargets.alerts = "alertsSection"`.
- On mobile it toggles mobile mode (`alert` or back to `live` if already alert), then calls `scrollToSection("alertsSection")`.
- `scrollToSection("alertsSection")` is mode-only on mobile, real scroll on desktop.

## 3) Why `.desktop-command-panel` coupling is risky

- `#alertsSection` is a desktop-oriented container (`aside.side-panel.desktop-command-panel`) that currently doubles as a mobile semantic target.
- Mobile flow relies on desktop DOM identity (`alertsSection`) even when no actual scroll/render transition is needed in mobile.
- Future desktop structural changes (renaming/moving/removing `.desktop-command-panel` or `#alertsSection`) can silently break mobile open-alert transitions.
- Daily Panel logs visibility/style of desktop alerts container during mobile action; this creates brittle assumptions around display/visibility classes that are not true mobile contract requirements.

## 4) Dedicated mobile Alerts Center surface target

Recommended dedicated surface for V65:

- Host mobile Alerts Center content in `#mobileNativeSurfaceLayer` (`#mobileNativeSurfaceBody`) as a first-class `alerts-center` view.
- Keep existing `alerts` Daily Panel “Operational Feed” quick summary as-is, but make **Open Alerts Center** open a dedicated mobile alerts-center content template inside the same native layer.
- This isolates mobile interactions to mobile-owned container IDs/selectors and removes dependency on desktop aside structure.

## 5) Existing functions/helpers to reuse

Reuse without behavior rewrite:

- `setMobileUiMode()` for state transitions (`live`, `alert`, etc.).
- `closeSurface()` pattern for consistent modal/sheet close behavior and mode reset.
- Existing incident and presentation builders used by desktop alerts:
  - `getConsolidatedIncidents()`
  - `getUnifiedIncidents()`
  - `buildRailIncidentDisplay()`
  - `buildRoadHazardDisplay()`
  - `buildAlertFocusDataset()`
  - label helpers (`getCrossingConfidenceLabel`, `getFreshnessLabel`, `getDriverConfirmationLabel`, `getReportStateLabel`)
- Existing escape/sanitization (`sanitizeText`).
- Existing focus/interaction pathway already used by alert rows (`data-alert-focus` handlers).

## 6) Existing markup/data to reuse

Reusable data sources and UI semantics:

- Alerts data currently rendered to `#alertsList` via `renderAlerts()`.
- Road hazard data currently rendered to `#roadHazardsList` via `renderRoadHazards()`.
- Trending data currently rendered to `#trendingList` via `renderTrendingCrossings()`.
- Mobile Daily Panel `alerts` view already reads summary text from:
  - `#crossingSummary`
  - `#hazardSummary`
  - `#corridorSummaryDetail`
  - `#freshestReportReason`

For V65 isolation, data logic should be shared; only target container/surface should differ between desktop and mobile.

## 7) What NOT to duplicate

Do **not** duplicate:

- Incident query logic (`getUnifiedIncidents`, `getConsolidatedIncidents`) and sorting/severity logic.
- Alert card semantics (focus dataset, severity chip labels, freshness/confirmation logic).
- Report, route, and Supabase pipelines.
- Routing/nav ownership of desktop panels.

Instead, extract/shared-render helpers should support multiple targets (desktop list containers and mobile surface containers).

## 8) Proposed V65 implementation steps (smallest-safe sequence)

1. **Introduce mobile alerts-center surface action only (no desktop changes).**
   - Add a new mobile surface action key (e.g., `open-alerts-center-native`) handled entirely in daily panel surface logic.
2. **Create mobile alerts-center renderer using existing incident helpers.**
   - Build HTML for mobile sheet body from existing alert/hazard/trending data functions.
   - Keep class naming aligned with existing alert row styling where possible.
3. **Switch Daily Panel “Open Alerts Center” to native action.**
   - Remove direct dependency on `document.getElementById("alertsSection")` from mobile open flow.
4. **Preserve desktop fallback path.**
   - Keep `routeNavSection("alerts") -> "alertsSection"` for desktop unchanged.
5. **Add guarded fallback for mobile failure case.**
   - If native renderer fails or surface unavailable, fallback to current mode toggle (`setMobileUiMode("alert")`) without breaking existing behavior.
6. **De-risk with minimal selector contract.**
   - Define one mobile-owned selector contract: `#mobileNativeSurfaceLayer`, `#mobileNativeSurfaceBody`, optional data attributes for alerts-center actions.

## 9) Rollback plan

- Feature-flag or boolean-guard the new native mobile alerts-center open path.
- If any regression appears, revert action binding to current behavior:
  - `closeSurface(action, { nextMode: "alert" })`
  - `setMobileUiMode("alert")`
  - `scrollToSection("alertsSection")`
- Desktop path remains untouched, so rollback scope is limited to daily panel mobile action handler and mobile view template logic.

## 10) Testing checklist (for V65 implementation)

Pre/post checks:

- Mobile Daily Panel → Rail Pulse → Open Alerts Center opens expected surface.
- Mobile Alerts mode state (`data-mobile-mode="alert"`) remains consistent.
- Tapping alert rows still triggers focus behavior (`data-alert-focus`).
- Desktop left/nav alerts still scroll/open `#alertsSection` with no visual or functional change.
- `routeNavSection("alerts")` behavior unchanged for desktop.
- `closeSurface()` from new mobile alerts center returns user to correct mode.
- No regressions in report submission flow.
- No regressions in route watch flow.

## 11) Regression risks

- Divergent rendering between desktop alerts list and mobile alerts-center if templates fork too much.
- Event binding duplication for alert-row click/focus semantics if mobile builds incompatible markup.
- Mode desync risk if `closeSurface()` and `setMobileUiMode()` are called in conflicting order.
- Hidden dependency on desktop IDs in analytics/debug logs could mask breakages unless removed/updated intentionally.

## 12) Desktop/mobile separation notes (explicit)

- **Does desktop behavior depend on mobile state?**
  - Largely no for core rendering; desktop uses scroll/sections directly. Some shared nav functions touch mobile mode conditionally.
- **Does mobile behavior depend on desktop containers?**
  - Yes, currently mobile open-alert flow references `#alertsSection` (desktop panel container), even though mobile scroll handler does not need it.
- **Are shared selectors/functions intentional?**
  - Shared data/render logic is intentional and good. Shared container selector (`alertsSection`) between desktop and mobile interaction is the risky part.
- **Is current reuse temporary or acceptable?**
  - Shared incident/data helpers are acceptable long-term. Mobile dependency on desktop container should be considered temporary and removed in V65.
- **Recommended final architecture**
  - Shared domain/render utilities + separate presentation targets:
    - Desktop target: `#alertsSection` (`.desktop-command-panel`) remains desktop-owned.
    - Mobile target: `#mobileNativeSurfaceLayer` dedicated alerts-center view remains mobile-owned.

---

## Required answers

1. **Where does Alerts Center content currently come from?**
   - Dynamic incident pipelines (`getConsolidatedIncidents`, `getUnifiedIncidents`) rendered into `#alertsList`, `#roadHazardsList`, `#trendingList`; plus summary fields read by mobile operational feed.
2. **Is it rendered dynamically or static markup?**
   - Core alert/hazard/trending lists are dynamic. Container scaffolding is static HTML.
3. **Which existing data/render functions can power a mobile-native version?**
   - `renderAlerts`/`renderRoadHazards`/`renderTrendingCrossings` logic and upstream helper functions listed above.
4. **Can the mobile surface layer host Alerts Center content safely?**
   - Yes. `#mobileNativeSurfaceLayer` already hosts route/report/alerts operational views and has close/backdrop/action handling.
5. **What state should open/close it?**
   - Open with `setMobileUiMode("alert")`; close to `live` (or prior explicit mode if preserving context is needed).
6. **How should Open Alerts Center transition work after isolation?**
   - Trigger mobile-native alerts-center action, render in surface layer, avoid `alertsSection` dependency.
7. **How should old desktop fallback be preserved?**
   - Keep existing desktop nav and `scrollToSection("alertsSection")` behavior unchanged.
8. **What exact files would V65 likely modify?**
   - `js/app.js` (daily panel action handling + mobile alerts-center rendering helpers), optionally `index.html` only for minor action attribute naming if needed.
9. **What is the smallest safe first implementation?**
   - Replace only Daily Panel open-alert action path on mobile to native surface rendering; keep all desktop and global routing logic intact.
10. **What should be tested before and after?**
   - Alerts, route, report, map focus interactions, desktop alerts panel behavior, and mobile mode transitions.
