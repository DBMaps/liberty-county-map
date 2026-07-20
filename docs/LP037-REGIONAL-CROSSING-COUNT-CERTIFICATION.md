# LP037 — Regional Crossing Count Certification

## Scope

LP037 is certification-only. It does not change crossing packages, crossing counts, marker visibility, awareness boundaries, community assignment, runtime loading, reporting, alerts, route watch, roadway runtime, or county geometry.

The audit covers the operational county registry, configured awareness areas, Harris community options, and Houston child regions. The browser helper is passive and reports the currently loaded runtime state plus registry/configuration summaries.

## Methodology

1. Inventory each production crossing package and count FRA IDs, duplicate IDs, and current FRA-derived classifications.
2. Compare the current runtime count owner (`getVisibleCrossingsForFilter`) with the consumer policy owner (`getGridlyPolicyVisibleCrossings`) and Awareness Brief/bottom-panel owner (`getGridlyBottomPanelAwarenessCrossingCount`).
3. Measure awareness-area distances from the selected awareness anchor for runtime-selected crossings.
4. Report unassigned/community-missing signals from loaded crossing metadata without rewriting metadata.
5. Expose `window.gridlyLp037RegionalCrossingCountCertificationAudit?.()` for in-browser confirmation of the active county/area state.

## County Summary

Static package inventory found 3,771 crossings across production crossing packages. No duplicate FRA IDs were found in those package inventories. The current consumer policy treats `PUBLIC_ROADWAY` as the reportable/consumer-visible class; private roads, industrial/private-industry, rail-yard, and temporary-access records are excluded from consumer certification unless a future product policy explicitly changes that rule.

| County package | Inventory | Public roadway | Private road | Private industry | Industrial | Rail yard | Duplicate FRA IDs |
|---|---:|---:|---:|---:|---:|---:|---:|
| Austin | 101 | 39 | 36 | 4 | 7 | 15 | 0 |
| Brazoria | 157 | 54 | 27 | 30 | 36 | 10 | 0 |
| Brazos | 86 | 61 | 13 | 1 | 4 | 7 | 0 |
| Calhoun | 74 | 5 | 15 | 32 | 16 | 6 | 0 |
| Chambers | 15 | 3 | 4 | 5 | 2 | 1 | 0 |
| Colorado | 109 | 47 | 29 | 15 | 16 | 2 | 0 |
| Fayette | 152 | 73 | 70 | 2 | 5 | 2 | 0 |
| Fort Bend | 175 | 83 | 37 | 25 | 19 | 11 | 0 |
| Galveston | 144 | 60 | 28 | 27 | 20 | 9 | 0 |
| Grimes | 109 | 57 | 39 | 1 | 5 | 7 | 0 |
| Hardin | 82 | 37 | 28 | 3 | 5 | 9 | 0 |
| Harris | 1,159 | 579 | 132 | 142 | 194 | 112 | 0 |
| Jackson | 74 | 36 | 37 | 0 | 1 | 0 | 0 |
| Jasper | 106 | 53 | 46 | 2 | 4 | 1 | 0 |
| Jefferson | 378 | 100 | 85 | 78 | 58 | 57 | 0 |
| Lavaca | 39 | 29 | 9 | 0 | 0 | 1 | 0 |
| Liberty | 115 | 68 | 32 | 4 | 0 | 11 | 0 |
| Matagorda | 80 | 42 | 27 | 1 | 4 | 6 | 0 |
| Montgomery | 170 | 116 | 34 | 8 | 2 | 10 | 0 |
| Newton | 26 | 13 | 10 | 3 | 0 | 0 | 0 |
| Orange | 149 | 53 | 43 | 26 | 21 | 6 | 0 |
| Polk | 64 | 36 | 22 | 1 | 1 | 4 | 0 |
| San Jacinto | 12 | 6 | 6 | 0 | 0 | 0 | 0 |
| Tyler | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Walker | 36 | 17 | 9 | 0 | 8 | 2 | 0 |
| Waller | 46 | 24 | 2 | 7 | 9 | 4 | 0 |
| Washington | 41 | 26 | 3 | 0 | 0 | 12 | 0 |
| Wharton | 72 | 54 | 18 | 0 | 0 | 0 | 0 |

## Community Summary

Configured awareness areas come from the operational county registry and `GRIDLY_AWARENESS_AREA_DEFINITIONS`. Countywide modes intentionally use county ownership. Community modes use configured awareness anchors and existing runtime selection. When a community has no assigned crossings, current runtime behavior can fall back to nearest crossings, while consumer policy filtering can return a smaller count or zero.

## Houston Findings

Harris is operational and selectable with a Harris crossing package. Houston also has child-region seeds, including Spring Branch. LP037 finds Houston child regions are configuration/anchor regions, not repaired crossing ownership regions. The current Harris crossing package contains many records with no consumer community ownership metadata; therefore a Houston child region can select nearby/unassigned crossings by runtime fallback rather than by authoritative Spring Branch ownership.

## Spring Branch Findings

Spring Branch is the key discrepancy case. The observed `46 crossings watched` is consistent with the current runtime owner returning 46 unique Harris crossings for the active town/awareness filter. It is not certified as the consumer count when `getGridlyPolicyVisibleCrossings()` returns zero and the Awareness Brief count owner returns zero.

Certification object expected from the helper when Spring Branch is active:

- county inventory: Harris active package inventory
- runtime selected crossings: current `getVisibleCrossingsForFilter()` count
- consumer visible crossings: current `getGridlyPolicyVisibleCrossings()` count
- private/industrial exclusions: current loaded non-public-roadway classification count
- duplicate IDs: duplicate FRA IDs in the active loaded inventory
- distance statistics: min/max/median/p95 miles from the selected awareness anchor
- ownership method: reported as community/proximity fallback when runtime count exceeds consumer policy count
- displayed count correctness: false if displayed count does not equal consumer-certified count
- first incorrect stage: `getVisibleCrossingsForFilter` when runtime selection diverges before UI display

## Root Causes

Truthful classifications for current findings:

- `mixed_behavior`: runtime, UI, and Awareness Brief can use different count owners.
- `visibility_policy_not_applied`: runtime/community count can include records not returned by the consumer policy helper.
- `proximity_fallback`: community mode can return nearest crossings when no direct community assignment is available.
- `missing_assignment_metadata`: Harris/Spring Branch records can be unassigned by city/region ownership even when geographically near the awareness anchor.
- `correct_behavior`: county inventory totals and duplicate-FRA-ID counts are correct as static package facts.

## Recommended Repair Sequence

1. LP037.1 should decide the product authority for consumer count copy: policy-visible crossings, Awareness Brief crossings, or runtime-selected crossings.
2. Repair or explicitly document Harris community ownership metadata before changing counts.
3. If Spring Branch should own crossings, add/validate authoritative area ownership metadata or geometry containment in a repair milestone.
4. Apply the consumer visibility policy at the selected count owner only after ownership is authoritative.
5. Add regression tests that assert Spring Branch displayed count, runtime count, consumer policy count, and Awareness Brief count either match by design or report a documented exception.

## Recommended LP037.1

Create LP037.1 as a repair-design milestone, not an immediate data mutation. Its goal should be to choose the single public count owner and produce a safe migration plan for Harris community crossing ownership, then update tests before changing production counts.

## Passive Browser Validation

Run the helper in a loaded browser session without moving the map or activating runtime paths:

```js
window.gridlyLp037RegionalCrossingCountCertificationAudit?.()
```

The helper returns `available`, county/community/Houston counts, active runtime/UI/consumer counts, duplicate/unassigned/private/industrial counts, distance statistics, fallback indicators, root-cause classifications, certification status, recommended repair strategy, and `springBranchDetail`.
