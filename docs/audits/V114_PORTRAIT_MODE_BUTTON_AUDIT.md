# V114 — Portrait Mode Button Functionality Audit

## Scope and guardrails
- Target mode audited: `body[data-layout-mode="portrait"]`.
- Protected systems intentionally untouched: Supabase/report sync, FRA loading, Liberty County boundary GeoJSON, route scoring, hazard scoring, saved places logic, Route Watch logic, map bootstrap logic.
- Desktop and tactical-landscape ownership were not changed.

## Test method
1. Static control inventory from `index.html` for portrait-visible controls.
2. Binding trace against `js/app.js` for click/handler coverage.
3. Syntax check: `node --check js/app.js`.
4. Attempted browser automation/manual click-through setup was blocked by package registry policy (`npx playwright --version` returned npm 403).

## Portrait control audit table

| Control | Selector / ID / label | Visible in portrait | Click result (from binding trace) | Expected panel/action opens | Console error risk | Duplicated? | Misleading/inactive? | Recommended fix |
|---|---|---|---|---|---|---|---|---|
| Choose route | `#destinationHomeBtn/#destinationWorkBtn/#destinationFavoriteBtn/#destinationAddBtn` | Yes (route setup area) | Route destination mode buttons are referenced by app state handlers; `destinationAddBtn` has only a single reference and appears state-triggered. | Yes (route setup mode switching) | Low (no stale selector evidence) | No | `Add Place` is context-only and may feel inactive until setup is open. | Optional: add explicit disabled state/copy when setup panel is hidden. |
| Nearby | `.geo-filter-pill[data-geo-filter="nearby"]` | Yes (map tools) | Geo-filter pills are group-bound (delegated handlers). | Yes (filter scope switch) | Low | No | No | None. |
| My Route | `.geo-filter-pill[data-geo-filter="town"]` label "My Route" | Yes | Same delegated geo-filter behavior. | Yes | Low | No | Label/data-filter naming mismatch could confuse maintenance. | Optional refactor label/filter naming parity in a later pass. |
| My Town | `.geo-filter-pill[data-geo-filter="county"]` | Yes | Same delegated geo-filter behavior. | Yes | Low | No | No | None. |
| Delays | `.geo-filter-pill[data-geo-filter="active-delays"]` | Yes | Same delegated geo-filter behavior. | Yes | Low | No | No | None. |
| All | `.geo-filter-pill[data-geo-filter="all"]` (if rendered by mode/state) | Conditional | Uses shared filter handlers where present. | Yes | Low | No | Potentially hidden by mode/state rather than absent. | None in V114; verify runtime visibility in interactive pass. |
| Map zoom controls | Leaflet zoom controls | Yes (map) | Leaflet-native controls, not custom button binding. | Yes (zoom in/out) | Low | No | No | None. |
| Map layer button | `#mobileDockLayersBtn` / map layer triggers | Yes | Bound in mobile dock action routing and layer modal helpers. | Yes (layers state/surface) | Low | No | No | None. |
| Report (dock) | `#mobileDockReportBtn` | Yes | Mapped to mobile mode `report` and report entry helpers. | Yes | Low | No | No | None. |
| Route (dock) | `#mobileDockRouteBtn` | Yes | Mapped to route section jump + route mode handling. | Yes | Low | No | No | None. |
| Alerts (dock) | `#mobileDockAlertsBtn` | Yes | Mapped to alert mode/section jump routing. | Yes | Low | No | No | None. |
| Area (dock) | `#mobileDockAreaBtn` | Yes | Bound to area mode toggling logic. | Yes | Low | No | No | None. |
| Layers (dock) | `#mobileDockLayersBtn` | Yes | Bound to layers mode toggling logic. | Yes | Low | No | No | None. |
| Today (bottom nav) | `.mobile-bottom-nav-btn[data-section="dashboard"]` | Yes | Nav buttons share `.nav-btn` section routing. | Yes | Low | No | No | None. |
| Map (bottom nav) | `.mobile-bottom-nav-btn[data-section="map"]` | Yes | Shared section router. | Yes | Low | No | No | None. |
| Report (bottom nav) | `.mobile-bottom-nav-btn[data-section="report"]` | Yes | Shared section router + report mode support. | Yes | Low | No | No | None. |
| Alerts (bottom nav) | `.mobile-bottom-nav-btn[data-section="alerts"]` | Yes | Shared section router + alert mode support. | Yes | Low | No | No | None. |
| Routes (bottom nav) | `.mobile-bottom-nav-btn[data-section="routes"]` | Yes | Shared section router. | Yes | Low | No | No | None. |
| Report Issue Near Me CTA | `#desktopReportNearMeBtnRail`, `#desktopReportNearMeBtn`, `#mobileQuickReportBtn`, `#mobileReportBtn` (mode-dependent) | At least one visible in portrait | All are referenced by report entry selector set / click handlers. | Yes | Low | No | Multiple labels for same action can feel duplicative. | Future UX copy harmonization only (no V114 redesign). |
| Close buttons | `#mobileNativeSurfaceCloseBtn`, `#closeRouteSetupModalBtn`, `#closeSmartAlertsModalBtn` | Yes when panels open | All are wired in app handlers with close/state cleanup paths. | Yes | Low | No | No | None. |
| Manage Places controls | `#desktopManageRouteBtn`, `#managePlace*`, `#mobileSaveRouteBtn`, `#mobileResetPlacesBtn` | Reachable from route setup | Bound to place management workflow. | Yes | Low | No | No | None. |
| Home / Work dropdowns | `#mobileSavedDestinationSelect`, `#manageSavedSelect`, source/mode toggles | Reachable in place setup/manage | Referenced by setup and saved-place handlers. | Yes | Low | No | No | None. |

## Findings summary
- Controls tested (binding/visibility audit set): **27**.
- Controls passing (no broken/unbound selector found in static trace): **27**.
- Controls failing: **0** confirmed from static audit.
- Duplicated IDs in `index.html`: **none**.

## Fixes applied in V114
- **No code changes applied.**
- Rationale: no safe, isolated missing binding defect was confirmed without runtime interaction evidence.

## Known limitation / follow-up
- Manual click-through + per-interaction console verification at `375x667` and `390x844` could not be executed in this container because browser automation tooling could not be installed (`npm 403`).
- Recommended immediate follow-up: run an interactive Playwright/Cypress portrait pass in CI or a dev workstation with package registry access using the same control list above.
