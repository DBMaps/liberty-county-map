# DIRECTIONAL_INTELLIGENCE_AUDIT_V1651

## Executive Summary

This is an **audit-only** deliverable for V165.1. No application behavior was changed.

Based on current Gridly data contracts and roadway source files, Gridly can already infer directional context at three distinct levels:

1. **High confidence** when route geometry + segment-level orientation are available (Route Watch active with polyline + matched roadway segment context).
2. **Medium confidence** when only corridor-level orientation is known (e.g., known primary orientation of US 90 / TX 146, etc.).
3. **Low confidence** when an incident is represented as an isolated point with no segment/route context.

For **V165.2 feasibility**: implementation is feasible without architecture changes, provided directional copy selection is gated by existing confidence tiers and strict fallbacks to non-directional phrasing.

---

## Current Direction Data Availability

### Unified incident shape and road association

Current unified incident generation and rendering paths operate on normalized incident/report/hazard candidates and include road/corridor derivation pathways such as:
- nearest-road lookup and derived location context
- segment candidate resolution during payload shaping
- directional token parsing from incident fields (e.g., `direction`, `lane`, `side`, `routeImpact`)

Evidence in code indicates road association is commonly available via:
- `resolveNearestRoadName(...)`
- derived field shaping around `segment_candidate_resolution`
- title-building branches that include `bestRoad`, `betweenA`, `betweenB`, and optional parsed direction

### Geometry/orientation availability by source type

- **Road segment source data** (`data/liberty-county-road-segments.geojson`) provides polyline geometries usable for orientation inference.
- **Route Watch** pathing uses route polyline geometry checks (`getRoutePolylineLatLngs()` references in audit docs and route relevance logic in app code).
- **Crossing data** provides point geometry but not directional vectors by itself.
- **Unified incidents** can be point-centric unless enriched by nearby segment or route context.

Conclusion: orientation inference capability exists, but confidence depends on whether an incident can be tied to segment/route geometry at runtime.

---

## Corridor Orientation Findings

Method used: static audit of `data/liberty-county-road-segments.geojson` features tagged by `ref` (and name where present), with coarse orientation inferred from line endpoint delta dominance (E/W vs N/S vs diagonal) across matched features.

### Results

- **US 90**
  - Predominant orientation: **East/West**
  - Confidence: **HIGH**
  - Basis: 127 of 127 matched segments classified E/W.
  - Source: roadway segment geometry + corridor ref tags.

- **TX 146**
  - Predominant orientation: **East/West overall in this local dataset, with notable N/S portions**
  - Confidence: **MEDIUM**
  - Basis: 53 E/W, 33 N/S, 1 diagonal (mixed corridor behavior in county footprint).
  - Source: roadway segment geometry + corridor ref tags.

- **FM 1409**
  - Predominant orientation: **North/South**
  - Confidence: **HIGH**
  - Basis: 9 N/S, 0 E/W, 0 diagonal.
  - Source: roadway segment geometry + corridor ref tags.

- **FM 1008**
  - Predominant orientation: **Mixed (slight E/W lean)**
  - Confidence: **LOW-MEDIUM**
  - Basis: 3 E/W, 2 N/S (small sample).
  - Source: roadway segment geometry + corridor ref tags.

- **TX 321**
  - Predominant orientation: **East/West with substantial N/S sections**
  - Confidence: **MEDIUM**
  - Basis: 26 E/W, 13 N/S, 1 diagonal.
  - Source: roadway segment geometry + corridor ref tags.

### Alignment with language spec

`GRIDLY_INCIDENT_LANGUAGE_SPEC_V1.md` documents expected corridor orientation usage and confidence fallback rules (geometry-first, corridor fallback, then non-directional/bidirectional-safe phrasing). Current data supports that strategy.

---

## Incident Geometry Findings

### 1) Active unified incidents: road association, geometry, orientation

For active unified incidents, current stack can often determine:

- **Associated road**: commonly available via nearest road resolution and/or normalized road fields.
- **Road geometry**: available when incident can be matched to roadway segments or route geometry context.
- **Orientation**: inferable when geometry exists (segment or route polyline); otherwise not reliably inferable.

Practical interpretation:
- Incidents with segment candidates and/or route relevance context can support directional phrasing.
- Incidents represented only as points should remain non-directional.

### 2) Hazard report payload capability

From existing model pathways and naming in app logic, existing hazard/report data already includes or can derive:

- **start/end coordinates**: available for route/watch geometry and segment polylines; hazard rows may still be point-based unless explicitly provided.
- **segment candidates**: explicitly present in derived-field timing paths (`segment_candidate_resolution`) and precompute index materialization.
- **route geometry**: available when Route Watch has an active route polyline.
- **nearby road pairs**: supported by nearby-pair resolution/index pathways.
- **route watch data**: present when Route Watch activated (`routeWatchActivated`, route relevance checks, route hazard assessment).
- **directional hints**: parser reads `direction|lane|side|routeImpact`, including both-directions normalization.

---

## Confidence Classification Findings

The requested three-tier confidence model is compatible with current data reality:

### HIGH

Conditions met when:
- route geometry available, and
- segment orientation available.

Status: **Supported now** for route-active and geometry-linked incidents.

### MEDIUM

Conditions met when:
- corridor orientation known.

Status: **Supported now** using corridor-level defaults from known orientation findings and language spec guardrails.

### LOW

Conditions met when:
- isolated point only.

Status: **Supported now** as fallback to non-directional copy.

---

## Missing Data / Risks

1. **Per-incident segment binding certainty is not always explicit**
   - Some incidents are only confidently point-based and may not map deterministically to a single roadway segment.

2. **Corridor orientation can be locally mixed**
   - TX 146 / TX 321 in county scope include mixed directional tendencies; corridor-default direction wording may overstate precision.

3. **Directional token quality varies by source reports**
   - Parsed direction fields are optional and potentially noisy (`lane`, `side`, free-form text).

4. **No universal carriageway-side model**
   - Current geometry supports axis orientation; it does not always imply true travel-side impact without stronger segment-to-incident linear reference.

5. **Runtime availability dependency**
   - High-confidence determination depends on route and segment context being present at render time, not just in static assets.

---

## Future Recommendations

1. **Adopt strict confidence gating in V165.2**
   - Emit directional language only for HIGH and approved MEDIUM cases.
   - Force neutral fallback for LOW.

2. **Add auditable per-incident directional provenance object**
   - Example fields: `directionConfidence`, `directionSource`, `segmentId`, `corridorDefaultUsed`, `routeGeometryUsed`.
   - Keep this additive and non-render-affecting until V165.2 behavior phase.

3. **Prefer segment-local bearing over corridor default when available**
   - Reduces error on winding/mixed corridors.

4. **Retain current “Both directions may be affected” safety fallback**
   - Especially for ambiguous or mixed-orientation cases.

5. **Introduce post-deploy directional QA sampling**
   - Randomly sample incidents by confidence tier and compare output phrasing against map geometry.

---

## Architecture Untouched Confirmation

Confirmed for V165.1 audit scope:

- No changes to `js/app.js` logic paths.
- No changes to alerts rendering.
- No changes to route logic.
- No changes to reporting.
- No changes to marker ownership/layer behavior.
- No changes to crossing context, road intelligence, quality filtering, segmentation, fallback references, Supabase flows, desktop/tactical landscape surfaces, popup ownership, or top strip behavior.

This deliverable is documentation-only.
