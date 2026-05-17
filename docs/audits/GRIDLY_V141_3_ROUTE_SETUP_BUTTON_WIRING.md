# GRIDLY V141.3 — Route Setup Button Wiring

## Root cause
Route Setup button wiring only bound click handlers for elements with `data-v2-action` via `bindV2SheetActions()`. If a rendered Route Setup button used `data-action` or `data-route-action` aliases (for example `open-route-watch` / `view-route`), it would not be canonicalized consistently for handler routing.

## Exact mismatch found
- Handler map in `triggerV2DockAdapter(...)` is keyed to canonical actions:
  - `route-watch-open`
  - `route-preview-open`
- Route button binding path previously read only `button.dataset.v2Action`.
- Any button rendered with non-canonical/alternate selector naming (`data-action="open-route-watch"`, `data-action="view-route"`, `data-route-action=...`, camel-like `routeWatch`/`routePreview`) could fail to match the canonical handler path.

## Exact fix made
Smallest wiring fix at the action-resolution layer:
1. Added canonical alias resolution for route actions.
2. Updated `bindV2SheetActions()` to bind route actions from:
   - `data-v2-action`
   - `data-action`
   - `data-route-action`
3. Updated `triggerV2DockAdapter(...)` to canonicalize action names before bridge lookup.

Canonical mapping now includes:
- `open-route-watch` / `routewatch` / `route-watch` -> `route-watch-open`
- `view-route` / `routepreview` / `route-preview` -> `route-preview-open`

## Temporary passive helper
Added:
- `window.gridlyRouteSetupButtonAudit()`

Returns:
- `buttonsFound`
- per-button:
  - `text`
  - `id`
  - `className`
  - `dataset`
  - `disabled`
  - `matchedHandler`
  - `expectedAction`
  - `clickTargetReady`

Helper is passive and read-only; it does not modify UI state.

## Helper usage
1. Hard refresh.
2. Run `window.gridlyRouteSetupButtonAudit()`.
3. Open **Route Setup**.
4. Run `window.gridlyRouteSetupButtonAudit()` again.
5. Click **Open Route Watch**.
6. Click **View Route**.

## Validation checklist
- [ ] Route Setup audit finds route buttons.
- [ ] `matchedHandler: true` for Open Route Watch and View Route.
- [ ] Open Route Watch responds.
- [ ] View Route responds.
- [ ] No changes to Route Watch scoring/routing logic.
- [ ] No changes to Supabase/reports/hazards/crossings/geolocation/refresh ownership/desktop/landscape.
