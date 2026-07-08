# GRIDLY V907 Community Coverage Expansion Wave 3

## Mission

V907 continues the standardized community coverage expansion established in V905 and V906. This wave promotes the remaining East Texas operational counties from countywide-only awareness into the canonical County → Community awareness architecture.

This is a geographic coverage expansion only. Runtime behavior, protected awareness systems, reporting, alert generation, route behavior, crossing runtime, and production provider behavior are intentionally unchanged.

## Promoted Counties

- Jasper County
- Newton County
- Tyler County

## Communities Added

### Jasper County

- Jasper
- Buna
- Kirbyville
- Browndell
- Evadale
- Sam Rayburn
- Brookeland

### Newton County

- Newton
- Deweyville
- Bon Wier
- Burkeville
- South Toledo Bend

### Tyler County

- Woodville
- Chester
- Colmesneil
- Warren
- Doucette
- Spurger
- Ivanhoe

## Implementation Summary

- Extended the existing `GRIDLY_COUNTY_REGISTRY.defaultAwarenessAreas` source of truth for Jasper, Newton, and Tyler counties.
- Reused the existing registry-to-awareness bridge instead of adding a new registry.
- Added verified map-focus anchors and startup zoom values to the existing V905 community focus table.
- Preserved countywide fallback options through the existing operational countywide awareness area builder.
- Preserved Settings summary compatibility because the new communities flow through the same grouped awareness option model as prior V904/V905/V906 communities.

## Audit Helper

Run this helper in the browser console after a hard refresh:

```js
window.gridlyCommunityCoverageWave3Audit?.()
```

Expected core response:

```js
{
  available: true,
  version: "V907",
  safeForBeta: true,
  promotedCounties: ["Jasper County", "Newton County", "Tyler County"],
  promotedCommunityCounts: {
    jasper: 7,
    newton: 5,
    tyler: 7
  },
  missingMapFocusCommunities: [],
  missingStartupZoomCommunities: [],
  invalidCoordinateCommunities: [],
  duplicateCoordinateWarnings: [],
  unselectableCommunityPairsDetailed: [],
  countywideFallbackPreserved: true,
  crossingRuntimePreserved: true,
  protectedSystemsUnchanged: true
}
```

## Protected Systems

V907 does not intentionally modify:

- Reporting
- Alert generation
- Hazard lifecycle
- Awareness filtering
- Route Watch
- Search behavior
- Weather provider
- Community intelligence
- Supabase synchronization
- Crossing runtime
- Production crossing provider
- Crossing visibility policy
- Directional intelligence
- Desktop gate
- Landscape gate

## Crossing Runtime Confirmation

Crossing runtime remains unchanged by this coverage-only patch. Confirm with the existing smoke test:

```js
window.gridlySetAwarenessAreaForTest?.("Dayton")
window.gridlyCrossingRenderAudit?.()
```

Expected result: production crossing runtime remains intact and safe.

## Testing Checklist

1. Hard refresh the app.
2. Verify Jasper County exposes its community list.
3. Verify Newton County exposes its community list.
4. Verify Tyler County exposes its community list.
5. Select multiple communities in each promoted county.
6. Confirm map focus changes to the selected community.
7. Confirm persistence after refresh.
8. Confirm countywide fallback remains selectable for each promoted county.
9. Run `window.gridlyCommunityCoverageWave3Audit?.()` and confirm `safeForBeta: true`.
10. Run `window.gridlyCommunityCoverageWave2Audit?.()` and confirm `safeForBeta: true`.
11. Run `window.gridlyCommunityCoverageExpansionAudit?.()` and confirm `safeForBeta: true`.
12. Run `window.gridlyHierarchicalAwarenessSelectionAudit?.()` and confirm `safeForBeta: true`.
13. Run the crossing smoke test and confirm `window.gridlyCrossingRenderAudit?.()` remains safe.

## Merge Recommendation Placeholder

Merge V907 when static checks pass, the browser audit checklist returns `safeForBeta: true` for V904/V905/V906/V907 audits, and the crossing smoke test confirms the production crossing runtime remains intact.
