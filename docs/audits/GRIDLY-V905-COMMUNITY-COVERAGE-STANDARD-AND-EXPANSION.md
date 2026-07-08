# Gridly V905 — Community Coverage Standard & Regional Expansion

## Mission
Establish a repeatable, statewide-ready community coverage standard and expand community awareness coverage while preserving protected runtime systems and the V904 canonical hierarchical Awareness Area model.

## Community Inclusion Standard
Community coverage should be added in this order:

1. **Priority 1:** incorporated cities and incorporated towns.
2. **Priority 2:** census-designated places where appropriate.
3. **Priority 3:** regionally significant unincorporated communities that users would reasonably identify with.
4. **Priority 4:** communities already referenced by Gridly data, including search, routing, crossings, reports, awareness data, and weather/location context.

Every community record must support:

- canonical display name
- county id
- latitude
- longitude
- startup zoom
- countywide fallback compatibility
- optional aliases only if the existing structure supports them safely

If a community cannot be confidently verified, it should remain deferred and be listed as a candidate or missing item rather than guessed.

## Current Complete Counties
- Liberty County
- Montgomery County
- San Jacinto County
- Chambers County
- Jefferson County
- Harris County

## Countywide-Only Counties Inventoried
After the V905 priority expansion, the remaining countywide-only operational counties are:

- Jasper County
- Newton County
- Tyler County
- Galveston County
- Brazoria County
- Fort Bend County
- Waller County
- Austin County
- Washington County
- Brazos County
- Grimes County
- Wharton County
- Colorado County
- Fayette County
- Lavaca County
- Jackson County
- Matagorda County
- Calhoun County

## Priority Expansion Counties
V905 expands these priority counties first:

### Hardin County
Added: Kountze, Silsbee, Lumberton, Sour Lake, Pinewood Estates, Rose Hill Acres, Saratoga, Batson, Thicket, Village Mills.

### Orange County
Added: Orange, Bridge City, Vidor, West Orange, Pinehurst, Rose City, Mauriceville, Little Cypress, Orangefield.

### Polk County
Added: Livingston, Onalaska, Corrigan, Goodrich, Seven Oaks, Indian Springs, West Livingston, Leggett, Moscow, Blanchard.

### Walker County
Added: Huntsville, New Waverly, Riverside, Dodge, Phelps, Crabbs Prairie.

## Prepared Structure for Next Counties
V905 records candidate inventory fields for:

- Galveston County
- Brazoria County
- Fort Bend County

These counties remain countywide-only until their community map-focus records are promoted with verified coordinates and startup zooms.

## Implementation Summary
- The existing `GRIDLY_COUNTY_REGISTRY.defaultAwarenessAreas` remains the source that drives hierarchical county/community selection.
- V905 adds verified map-focus data through `GRIDLY_V905_COMMUNITY_MAP_FOCUS` and consumes it through the existing registry community bridge.
- Countywide fallback entries are still created from existing countywide awareness behavior.
- No second community model was introduced.

## Audit Helper
Run this helper in the browser console:

```js
window.gridlyCommunityCoverageExpansionAudit?.()
```

Compatibility helper retained:

```js
window.gridlyHierarchicalAwarenessSelectionAudit?.()
```

## Protected Systems Confirmation
V905 does not intentionally modify behavior for reporting, alert generation, hazard lifecycle, awareness filtering logic, Route Watch, search behavior, weather provider, community intelligence scoring, Supabase synchronization, crossing runtime, directional intelligence, desktop gate, or landscape gate.

## Known Gaps / Deferred Communities
- Galveston, Brazoria, and Fort Bend counties have candidate inventory structure but remain deferred for map-focus promotion.
- Remaining operational counties outside the V905 priority set remain countywide-only until future audited expansion.
- Any uncertain community should be added to audit documentation as a candidate rather than configured as selectable.

## Testing Checklist
1. Hard refresh the app.
2. Open Settings / Awareness Area.
3. Select Hardin, Orange, Polk, and Walker counties.
4. Confirm each community dropdown/list populates.
5. Select several communities in each expanded county.
6. Confirm the map focuses correctly.
7. Refresh.
8. Confirm selected county/community persists.
9. Select countywide fallback.
10. Confirm countywide mode still works.
11. Run `window.gridlyCommunityCoverageExpansionAudit?.()`.
12. Run `window.gridlyHierarchicalAwarenessSelectionAudit?.()`.

## Merge Recommendation Placeholder
Merge recommendation: pending browser-console validation on the target deployment build.
