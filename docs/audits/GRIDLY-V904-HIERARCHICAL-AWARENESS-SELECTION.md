# GRIDLY V904 — Hierarchical Awareness Selection

## Purpose
Replace the long flat awareness-area picker with a scalable county-first, community-second selector for Settings and first-run setup.

## Beta feedback summary
Large-county beta users reported that a single flat list of communities does not scale as Gridly expands beyond Liberty County into larger counties such as Harris County.

## Problem statement
Awareness Platform First requires users to choose what Gridly watches before route intelligence. The old Settings picker exposed every awareness area at once, creating a crowded mobile portrait experience.

## Scope
- Reuse the existing awareness-area definitions and storage values.
- Add a reusable county-grouped awareness option helper.
- Update Settings to show County and Community controls.
- Preserve the existing first-run county/community pattern and back it with the same grouped model.

## User experience change
Settings now opens an Awareness Area section with:
1. County selector
2. Community selector scoped to the selected county
3. Summary copy: `Watching [Community], [County]`

## Files changed
- `js/app.js`
- `css/styles.css`
- `docs/audits/GRIDLY-V904-HIERARCHICAL-AWARENESS-SELECTION.md`

## Runtime behavior statement
Selecting a community still saves the same awareness-area storage value through `saveGridlyHomeTownPreference`. Existing awareness filtering, map identity, and active county synchronization continue to consume the existing selected awareness-area model.

## Protected systems statement
No alert generation, hazard lifecycle, reporting submission, Supabase synchronization, Route Watch, search logic, weather provider, community intelligence, crossing runtime, directional intelligence, desktop gate, or landscape gate logic was changed.

## Backward compatibility statement
Saved values such as Dayton, Liberty, Conroe, and Harris County resolve through the existing awareness definitions. Unknown saved values fail safely by resolving to the current active/default county and do not block Settings or onboarding rendering.

## Mobile Portrait statement
The selector uses full-width native select controls with large tap targets, dark styling, consumer labels, and no default giant flat list.

## Desktop / landscape gate statement
Desktop and landscape gating remain unchanged. This milestone only changes awareness selection UI inside the existing gated app experience.

## Audit helper
Run in the browser console:

```js
window.gridlyHierarchicalAwarenessSelectionAudit?.()
```

Expected fields include selector detection, flat-list suppression, saved-area resolution, gate preservation, option counts, selected county/community, stored awareness area, and beta safety.

## Human validation checklist
- Open Settings.
- Confirm County selector appears.
- Select Liberty County.
- Confirm Dayton, Liberty, Cleveland, etc. appear.
- Select Dayton.
- Confirm app watches Dayton.
- Select Montgomery County.
- Confirm Conroe, The Woodlands, Willis, etc. appear.
- Select Conroe.
- Confirm app watches Conroe.
- Select Harris County if available.
- Confirm Harris communities appear if configured.
- Confirm no giant flat list is shown by default.
- Refresh app.
- Confirm saved selection persists.
- Run `window.gridlyHierarchicalAwarenessSelectionAudit?.()`.
- Confirm desktop remains gated.
- Confirm landscape remains gated.

## Merge recommendation
Merge after the static checks pass and mobile portrait human validation confirms the two-step selection flow persists correctly.
