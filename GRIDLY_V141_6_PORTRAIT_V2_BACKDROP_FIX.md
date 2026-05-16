# GRIDLY V141.6 — Portrait V2 Backdrop Interception Fix

## Root cause
Portrait V2 had a containment override that assigned the **same z-index** to the shell, sheet, and backdrop (`#gridlyPortraitV2`, `#gridlyPortraitV2Sheet`, `#gridlyPortraitV2SheetBackdrop` all at `9500`).

When equal z-index siblings are in the same stacking context, paint order falls back to DOM order and state timing. During Route Setup transitions, the backdrop could end up effectively intercepting pointer hit-testing paths near/over the bottom sheet region, making Route actions feel dead.

## Exact stacking/interception issue
- Base layer intent was correct (`backdrop: 9001`, `sheet: 9002`), but containment mode flattened all three to `9500`.
- This removed deterministic layer separation while the sheet/backdrop rapidly open/close and mutate classes.
- Result: intermittent touch/click interception by backdrop in/near active sheet area.

## Selectors changed
- `body[data-layout-mode="portrait"].gridly-v2-surface-containment #gridlyPortraitV2`
- `body[data-layout-mode="portrait"].gridly-v2-surface-containment #gridlyPortraitV2SheetBackdrop`
- `body[data-layout-mode="portrait"].gridly-v2-surface-containment #gridlyPortraitV2Sheet`

Updated z-order:
- Shell: `9500`
- Backdrop: `9501`
- Active sheet: `9502`

## Why route buttons appeared dead
Route Setup controls (e.g., Manage Places / Open Route Watch / View Route) live in the active sheet body. When backdrop interception occurred, pointer hit-tests sometimes resolved to backdrop instead of button descendants, making taps seem ignored or unreliable.

## Audit helper
Added/updated runtime helper:
- `window.gridlyPortraitV2LayerAudit()`

Returns:
- backdrop `z-index`
- backdrop `pointer-events`
- active sheet `z-index`
- `elementFromPoint` at sheet center
- `elementFromPoint` at route buttons
- whether backdrop is covering sheet
- recommended status (`ok` / `needs-fix`)

## Validation checklist
1. Hard refresh.
2. Open **Route Setup** from Portrait V2.
3. Run `window.gridlyPortraitV2LayerAudit()`.
4. Confirm:
   - backdrop z-index < sheet z-index
   - backdrop not covering sheet center
   - route buttons resolve hit-tests to button/child
   - route panel scroll works
   - Manage Places opens
   - Open Route Watch works
   - View Route works
   - no startup geolocation warning
   - desktop unchanged
   - tactical landscape unchanged
