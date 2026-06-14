# Gridly V312.2 — Road Hazard Location Tier Scoring Review

## Scope

This review covers the shadow-mode road-hazard location audit only. It does not change live alert text, popup text, awareness headline text, production formatter behavior, crossing naming, crossing overrides, FRA data, hazard coordinates, route watch, active route context, route calculations, alert generation, Supabase sync, or data models.

Road-hazard incident types in scope are `road_closed`, `closure`, `construction`, `traffic_backup`, `crash`, `flooding`, `disabled_vehicle`, `downed_power_line`, `livestock`, `emergency_response`, and `other_hazard`.

## Current issue

The V312.1A shadow audit selected `candidateA` whenever both a primary road and any distinct reference road were available. That made the selected hierarchy tier `Tier 1 — True intersection` and produced an audit-only phrase such as `Road Closed on US 90 at Sawmill Road` even when the reference road came from coordinate proximity lookup rather than explicit intersection evidence.

That is over-permissive for product review because a nearby road candidate is not automatically a verified `at {cross street}` location. The audit should distinguish between a true intersection, a crossing landmark, a community-distance reference, and a nearest-road fallback before any future production wording work.

## Evidence from shadow audit logic

The reviewed shadow audit builds road candidates from record fields, generated road incidents, latest reports, unified incidents, parsed text, the TxDOT-style road-hazard candidate, and coordinate-based road lookup. Coordinate lookup can add reference roads from `resolveNearestRoadName()` or `resolveNearbyRoadPair()`.

Before V312.2 diagnostics, the highest-available candidate always won:

1. `candidateA` when `primaryRoad` and `referenceRoad` existed.
2. `candidateB` when a crossing-like reference existed.
3. `candidateC` when a community-distance anchor existed.
4. `candidateD` as the nearest-road fallback.

The key gap is that `candidateA` availability did not prove that the primary road and reference road physically intersected at the hazard coordinate. Resolver output and paired road samples are useful evidence, but they are proximity evidence unless paired with explicit cross-street, source, distance, or geometry confirmation.

## V312.2 audit-only diagnostics added

Each shadow audit row now reports additional review fields:

- `proposedSaferTier`
- `currentCandidateAPhrase`
- `tier1Supported`
- `tier1Evidence`
- `tier1RiskReason`
- `referenceRoadDistance`
- `primaryRoadDistance`
- `candidateSource`
- `referenceRoadAppearsProximityOnly`
- `communityDistanceMayBeSafer`
- `proposedSaferCandidate`

These fields are diagnostic only. They do not mutate live wording or production formatter behavior.

## US 90 / Sawmill / Waco analysis

For the runtime example:

- `primaryRoad`: `US 90`
- `referenceRoad`: `Sawmill Road`
- `primaryRoadSource`: `coordinate.resolveNearestRoadName`
- `referenceRoadSource`: `coordinate.resolveNearestRoadName`
- selected V312.1A tier: `Tier 1 — True intersection`

V312.2 should treat that source combination as proximity-only unless additional evidence is present. The audit does not currently verify that Sawmill Road intersects US 90 at the hazard coordinate. It only knows that coordinate road lookup returned US 90 and Sawmill Road as nearby or paired road evidence.

Recommended interpretation:

- Sawmill Road is not verified as a true intersection from the current audit evidence alone.
- Sawmill Road should be treated as a nearby road candidate unless an explicit cross-street field, reviewed landmark, tight-distance metric, or geometry intersection confirms it.
- `Road Closed on US 90 near Sawmill Road` is safer than `Road Closed on US 90 at Sawmill Road` when the evidence is proximity-only.
- `Road Closed on US 90, 1 mile west of Dayton` may be clearer on a long corridor when no verified intersection or reviewed crossing landmark exists and the nearest community anchor is accurate.
- A crossing reference should be used only when a nearby reviewed crossing is detected and the crossing is useful as a landmark. It should not be inferred from generic road proximity.

## Recommended safer tier rules

### Tier 1 — True intersection

Use only when the audit has strong intersection evidence, such as:

- An explicit source field named like `intersection`, `crossStreet`, `fromStreet`, `startStreet`, or another clearly cross-street-oriented field.
- Geometry-supported evidence that the primary road and reference road physically intersect at or extremely near the hazard coordinate.
- A very tight reference-road distance threshold plus source semantics that indicate an `at/cross street` relationship rather than generic nearest-road proximity.
- Resolver metadata that explicitly identifies an intersection, not just multiple nearby roads.

### Tier 2 — Crossing reference

Use only when a reviewed crossing is nearby and clearly useful as a landmark. A road hazard may be described near a crossing landmark, but this tier should not convert road hazards into crossing incidents or rely on crossing text matches alone.

### Tier 3 — Community-distance reference

Use when there is no verified intersection or reviewed crossing reference and the hazard is on a long corridor. Community-distance wording can be safer than a weak nearby-road phrase when it better orients the driver.

### Tier 4 — Nearest-road fallback

Use when the audit only has weak proximity road evidence. This includes coordinate resolver output with no explicit intersection, no geometry-supported intersection, no reviewed crossing landmark, and no reliable community-distance anchor.

## Future implementation guidance

A future production implementation should separate availability from support:

1. Build all candidate phrases in shadow mode.
2. Score each candidate with evidence provenance.
3. Select Tier 1 only when `tier1Supported` is true.
4. Downgrade unsupported `candidateA` to Tier 2, Tier 3, or Tier 4 depending on available evidence.
5. Keep `at` wording reserved for explicit or geometry-confirmed intersections.
6. Prefer `near` wording for proximity-only references.
7. Prefer community-distance wording for long corridors when nearby-road evidence may be misleading.
8. Keep crossings out of scope unless a reviewed crossing landmark is separately detected.

## Regression risks

- Over-downgrading a real intersection if source fields are not named explicitly and geometry support is unavailable.
- Under-reporting useful local references if distance metadata is missing from resolver diagnostics.
- Mistaking broad crossing text for a reviewed crossing landmark.
- Confusing audit-only proposed wording with production text if downstream consumers ignore `noProductionTextChanges`.
- Creating false confidence if coordinate resolver paired road samples are treated as intersections without physical geometry confirmation.

## Validation notes

Manual validation should run `window.gridlyRoadHazardLocationShadowAudit?.()` in the browser console and confirm:

- Production text is unchanged.
- Rows still populate.
- Road hazards remain retained.
- Unsupported Tier 1 rows now explain the risk through `tier1RiskReason`.
- Proximity-only references from coordinate lookup set `referenceRoadAppearsProximityOnly` to `true`.
