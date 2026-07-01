# Gridly V312.1 Road Hazard Location Resolver Shadow Audit

## Audit purpose

V312.1 adds an audit-only helper for evaluating future road-hazard location-description strategies without changing production wording, alert cards, awareness headlines, hazard popups, crossing popups, crossing names, review overrides, FRA data, coordinates, placement, Route Watch, Active Route Context, alert generation, Supabase sync, or data models.

The helper is exposed as:

```js
window.gridlyRoadHazardLocationShadowAudit?.()
```

It is shadow mode only. The helper returns side-by-side candidates and logs them to the console; it does not feed candidate wording back into any live formatter or renderer.

## Scope

Included road hazards:

- Road Closed
- Crash
- Flooding
- Construction
- Disabled Vehicle
- Downed Power Line
- Livestock
- Emergency Response
- Other Hazard

Crossing and rail incidents are explicitly filtered out before candidate generation.

## Candidate generation

For each active road hazard, the audit records the current production wording first. It then builds four shadow candidates:

1. **Candidate A — True Intersection**: `{Hazard} on {primary road} at {reference road}`
2. **Candidate B — Crossing Reference**: `{Hazard} on {primary road} near the {reference road} crossing`
3. **Candidate C — Community Distance**: `{Hazard} on {primary road} {distance} miles {direction} of {community}`
4. **Candidate D — Nearest-Road Fallback**: `{Hazard} on {primary road} near {reference road}` or `{Hazard} on {primary road}`

The audit uses existing runtime evidence only: current rendered text, active hazard fields, render-cache alert fields, the existing road-hazard candidate parser, existing road normalization helpers, hazard coordinates, and existing awareness-area community anchors.

## Evidence recorded

Each row includes:

- incident id
- incident type
- coordinates
- current production wording
- primary road
- reference road
- crossing candidate
- community candidate
- distance candidate
- direction candidate
- selected hierarchy tier
- confidence
- evidence used
- candidate scores
- recommended candidate
- reasoning

## Scoring

Every generated phrase receives scores for:

- clarity
- local usefulness
- traveler usefulness
- awareness value

Scores are intentionally simple and deterministic so the helper can compare candidate families without changing live behavior. Unavailable candidates receive zeroes. Available candidates receive the highest baseline for their intended use case:

- True intersection: strongest clarity/local usefulness when a distinct reference road is present.
- Crossing reference: strong local usefulness when crossing-like reference wording is plausible.
- Community distance: stronger traveler usefulness for broader corridor awareness.
- Nearest-road fallback: lowest-risk baseline when richer evidence is unavailable.

## Waco / Sawmill analysis

The audit includes `wacoSawmillDiagnostics` for rows where:

- the primary road resolves as US 90,
- Waco evidence exists, and
- Sawmill evidence exists.

For matching rows the diagnostic reports current wording, candidate wording, recommended wording, and `liveTextChanged: false`. This directly supports the known Waco / Sawmill review question while preserving production text.

## Aggregate findings

The audit returns `aggregateFindings` with counts for:

- incidents supporting intersection wording,
- incidents supporting crossing wording,
- incidents supporting community-distance wording,
- incidents requiring nearest-road fallback.

These counts are based on the highest available shadow hierarchy tier per incident, not on any production formatter output.

## Recommendations

Use V312.1 to collect runtime evidence across real active road hazards before implementing a resolver change. Treat `recommendedCandidate` as a research signal only. Do not use it directly in live alert or popup text until a later milestone explicitly approves production resolver behavior changes.

Recommended next steps:

1. Run the helper during real active road-hazard periods.
2. Compare `currentProductionWording` against all candidate phrases.
3. Review low-confidence rows manually before promoting any hierarchy.
4. Pay special attention to Waco / Sawmill diagnostics on US 90.
5. Keep crossing systems separate; do not reuse crossing popup naming or review overrides for road-hazard wording without a dedicated follow-up design.

## Manual validation

Run these helpers in the browser console:

```js
window.gridlyRoadHazardLocationShadowAudit?.()
window.gridlyReferenceRoadEvidenceAudit?.()
window.gridlyRoadNameResolverDebug?.()
```

Verify:

- current wording remains unchanged,
- candidate wording is generated,
- Waco / Sawmill comparison appears when applicable,
- no alert text changes,
- no popup text changes,
- no crossing changes,
- no route changes.
