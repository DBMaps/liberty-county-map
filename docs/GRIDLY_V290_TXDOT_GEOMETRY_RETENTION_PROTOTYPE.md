# Gridly V290 — TxDOT Geometry Retention Prototype

Audit date: 2026-06-13  
Branch: `V290-TXDOT-GEOMETRY-RETENTION-PROTOTYPE`  
Scope: prototype / audit only

## 1. Executive Summary

V290 confirms that Gridly should prioritize retaining full TxDOT road-event geometry before future directional display or WZDx work proceeds. The current TxDOT path successfully fetches DriveTexas GeoJSON, extracts feature properties, and normalizes each feature into a unified incident shape, but it collapses every `LineString` to a single midpoint. That midpoint is enough to put a marker on the map, but it is weak evidence for Route Watch, alert relevance, route-overlap confidence, and future direction validation.

The prototype added in this milestone is deliberately isolated in `js/gridlyTxdotGeometryRetentionPrototype.js`. It is not referenced by `index.html`, does not alter `gridlyTxdotService.js`, and does not change production rendering, alerts, Route Watch, popups, markers, reporting, Supabase, or awareness behavior. It defines a retained TxDOT geometry record and a prototype-only overlap scoring function so the product team can evaluate geometry value without shipping any user-visible directional behavior.

Primary finding: **geometry retention has high product value**. Segment overlap would materially improve route relevance, reduce midpoint false positives, improve confidence scoring, make TX 146 and TX 321 validation more trustworthy, and provide the geometry foundation needed for later WZDx or directional validation. V291 should be a **Route Watch Geometry Prototype** using retained geometry in a private comparison harness only.

## 2. Current Geometry Flow

### 2.1 Current path

```text
Raw TxDOT GeoJSON Feature
  ├─ feature.properties retained as a flattened raw record
  ├─ feature.geometry copied only into rawRecord.__geometry
  └─ feature.bbox not copied when bbox exists only at feature level
        ↓
extractRawRecords(payload)
  ├─ returns { ...properties, __geometry: feature.geometry }
  └─ discards feature-level bbox and full feature envelope
        ↓
normalizeIncident(rawRecord, rawRecord.__geometry)
  ├─ midpointFromLineString(featureGeometry)
  │    └─ selects coordinates[Math.floor(length / 2)]
  ├─ normalizes route_name, roadway, limits, flags, county, direction
  └─ returns unified incident with latitude/longitude only
        ↓
gridlyExternalRoadConditions
  ├─ production alerts / summaries consume normalized incident fields
  ├─ local TxDOT focus uses county number and text corridor matching
  └─ full geometry is no longer available in normalized records
```

### 2.2 Retained and discarded fields today

| TxDOT source element | Current Gridly handling | Retained? | Notes |
| --- | --- | --- | --- |
| `feature.geometry.type` | Used only if `LineString` during midpoint extraction. | Partially | Type is not preserved on normalized incident. |
| `feature.geometry.coordinates` | Collapsed to one midpoint coordinate. | No | Segment shape, length, and route overlap evidence are discarded. |
| `feature.geometry.bbox` | Not explicitly copied except if embedded in the geometry object. | No / incidental | GeoJSON commonly carries `bbox` on the feature, not inside geometry. |
| `feature.bbox` | Not copied by raw extraction. | No | Current raw record keeps properties and `__geometry` only. |
| `properties.from_limit`, `properties.to_limit` | Retained as raw and display strings. | Yes | Useful human-readable extents, but not geometry. |
| `properties.from_ref_marker`, `from_marker_disp`, `to_ref_marker`, `to_marker_disp` | Not retained in normalized incident. | No | Marker references are valuable for route-mile extent validation. |
| `properties.route_name`, `roadway` | Retained and displayed. | Yes | Useful route identity, but route identity alone cannot prove overlap. |
| `properties.travel_direction` | Normalized to `direction`. | Partially | Raw direction token is not retained for later validation. No directional display is introduced here. |
| `properties.county_num` | Retained. | Yes | Used by local-focus filtering. |

### 2.3 Current flow diagram

```text
┌───────────────────────────────┐
│ DriveTexas conditions.geojson │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ FeatureCollection.features[]  │
│ geometry + bbox + properties  │
└───────────────┬───────────────┘
                │ extractRawRecords()
                ▼
┌───────────────────────────────┐
│ Raw record                    │
│ properties retained           │
│ __geometry retained           │
│ feature bbox discarded        │
└───────────────┬───────────────┘
                │ normalizeIncident()
                ▼
┌───────────────────────────────┐
│ midpointFromLineString()      │
│ full line → one point         │
└───────────────┬───────────────┘
                ▼
┌───────────────────────────────┐
│ Unified incident              │
│ lat/lng + text fields + flags │
│ no retained line geometry     │
└───────────────┬───────────────┘
                ▼
┌───────────────────────────────┐
│ Existing production consumers │
│ markers / alerts / summaries  │
│ Route Watch / awareness       │
└───────────────────────────────┘
```

## 3. Geometry Retention Prototype Design

### 3.1 Isolation rules

The prototype is intentionally not wired into production. It is a standalone browser-safe module that exposes `gridlyTxdotGeometryRetentionPrototype` only when the file is explicitly loaded by a future private harness. The current app entry point does not include this file, and the production TxDOT service remains unchanged.

Non-goals explicitly preserved:

- No directional display.
- No NB/SB/EB/WB labels added.
- No production alert changes.
- No production hazard popup changes.
- No production Route Watch behavior changes.
- No marker, reporting, Supabase, or awareness changes.

### 3.2 Prototype retained record

The prototype-only retained model keeps the evidence that the production normalized incident currently loses:

```text
retained TxDOT geometry record
  ├─ prototypeOnly: true
  ├─ id / condition
  ├─ geometryType
  ├─ geometry clone
  ├─ normalized LineString coordinates
  ├─ bbox
  ├─ routeExtents
  │    ├─ fromLimit
  │    └─ toLimit
  ├─ rawTravelDirection
  ├─ markerReferences
  │    ├─ fromRefMarker
  │    ├─ fromMarkerDisplay
  │    ├─ toRefMarker
  │    └─ toMarkerDisplay
  ├─ routeReferences
  │    ├─ routeName
  │    ├─ roadway
  │    └─ countyNum
  └─ measuredLengthMeters
```

### 3.3 Retention rationale

| Retained field | Why it matters |
| --- | --- |
| Full geometry | Enables segment-overlap comparison instead of midpoint-only proximity. |
| BBox | Provides cheap first-pass spatial filtering before expensive overlap scoring. |
| Route extents | Preserves human-readable from/to scope for comparison and audit. |
| Raw `travel_direction` | Enables future validation against geometry without displaying direction now. |
| Marker references | Enables future mile-marker / reference-marker confidence checks. |
| Route references | Keeps `route_name`, `roadway`, and county identity attached to geometry evidence. |

## 4. Route Watch Comparison

### 4.1 Current model: midpoint proximity

Current Route Watch-style relevance can only ask whether a single TxDOT midpoint is near a candidate route or whether text fields mention a route/corridor. This creates three known weaknesses:

1. **Long-event distortion:** a long work zone may overlap the route for miles while its midpoint falls off the watched route or outside the user’s route slice.
2. **Near-road false positives:** a midpoint near a watched road can look relevant even when the actual event geometry follows a nearby parallel road, ramp, frontage road, or intersecting route.
3. **Duplex ambiguity:** roads with combined references, such as `US 90;TX 146`, cannot be confidently separated by one point and route text alone.

### 4.2 Prototype model: segment overlap

The prototype overlap scorer compares retained TxDOT event geometry to candidate route geometry. It estimates event length, samples event segments, measures distance to the route corridor, and returns overlap distance, overlap percentage, corridor confidence, route confidence, geometry confidence, and a combined confidence.

### 4.3 Would overlap produce better route relevance?

Yes. A watched route should care about whether the event line overlaps the route corridor, not just whether one coordinate is nearby. Overlap is better evidence for Route Watch because it ties relevance to shared roadway geometry.

Example outcomes:

- **True positive retained:** A TxDOT construction line on TX 146 overlaps a user route on TX 146 for 1.2 miles. Midpoint and overlap may both flag it, but overlap can say why and how much of the event is relevant.
- **False positive reduced:** A TxDOT event midpoint sits near TX 146 at an intersection, but the event line follows US 90 away from the watched TX 146 segment. Segment overlap would score low and reduce Route Watch relevance.
- **Confidence improved:** A closure line overlaps 70% of the watched route segment. Route Watch can treat that as higher confidence than a single midpoint within a radius.

## 5. Alert Relevance Comparison

### 5.1 Current alert relevance

Current external condition relevance is effectively “road condition near route / local corridor text / county.” This is useful for broad local awareness but ambiguous for route-specific alerts.

### 5.2 Prototype alert relevance

With retained geometry, a prototype alert relevance harness can ask:

- Does the event line overlap the selected route geometry?
- How much event distance overlaps the route?
- Does the route name agree with geometry overlap?
- Is the event only nearby, or actually on the route?
- Are limits/markers consistent with the overlapped segment?

### 5.3 Measurement expectations

| Dimension | Current midpoint/text model | Prototype retained-geometry model | Expected improvement |
| --- | --- | --- | --- |
| Confidence | Single coordinate + route text. | Overlap distance + route identity + geometry quality. | High. |
| Relevance | Can over-alert near intersections and parallel corridors. | Can distinguish overlapping from merely nearby. | High. |
| Ambiguity reduction | Weak on long events and duplex routes. | Stronger because line evidence remains available. | High. |
| User explanation | “Near your route.” | Future private explanation can say “overlaps your route segment” without changing current UI. | Moderate to high. |

## 6. TX 146 Findings

TX 146 is the strongest local validation corridor because the local road-segment dataset contains both standalone TX 146 references and combined `US 90;TX 146` references. The dataset audit found 87 local features containing `TX 146`, including 49 with `US 90;TX 146`. That means text-only or midpoint-only matching can confuse a shared alignment, a nearby route, or a true TX 146 event.

Findings:

- **Reduce ambiguity:** Yes, very high. Retained TxDOT LineString geometry can identify whether the event follows the TX 146 alignment, the US 90 shared segment, or a nearby connecting segment.
- **Improve route matching:** Yes, very high. Segment overlap can compare event geometry to route geometry instead of relying on the event midpoint and route name.
- **Improve alert relevance:** Yes, high. TX 146 is a meaningful local corridor; false positives at intersections or duplex segments would be more visible to users.
- **Improve future directional confidence:** Yes, high. Retained geometry plus raw `travel_direction` gives a future validation harness enough evidence to test whether the direction token is plausible along the corridor. This milestone does not display direction.

TX 146 conclusion: **retained geometry would materially improve Gridly’s TX 146 awareness and Route Watch confidence.**

## 7. TX 321 Findings

TX 321 is the second-best validation corridor because it tests a different route pattern and also includes combined-route references. The dataset audit found 40 local features containing `TX 321`, including 18 with `TX 105 Business;TX 321`.

Findings:

- **Reduce ambiguity:** Yes, high. Retained geometry would help separate TX 321 events from TX 105 Business shared alignments and nearby local street names such as East Houston Street.
- **Improve route matching:** Yes, high. Segment overlap would prove whether the event shares the user route geometry.
- **Improve alert relevance:** Yes, high. TX 321 may have fewer practical alternatives in places, so distinguishing actual overlap from nearby incidents matters.
- **Improve future directional confidence:** Yes, moderate to high. Geometry retention would allow later validation against route segment bearing, marker order, and raw `travel_direction` without adding any current directional display.

TX 321 conclusion: **retained geometry would materially improve TX 321 route relevance and is a strong second corridor after TX 146.**

## 8. Geometry Overlap Scoring Proposal

V290 proposes a private scoring model only. It should not drive production alerts or Route Watch until validated against archived TxDOT samples and local route geometries.

### 8.1 Candidate scoring dimensions

| Dimension | Prototype meaning | Recommended weight |
| --- | --- | --- |
| Overlap distance | Estimated meters of TxDOT event line within the watched route corridor tolerance. | High |
| Overlap percentage | Overlap distance divided by total retained event length. | High |
| Corridor confidence | Confidence that the event geometry is actually on the candidate route corridor. | High |
| Route confidence | Confidence from route identifiers such as `route_name`, `roadway`, and local route refs. | Medium |
| Geometry confidence | Confidence that geometry is usable: valid `LineString`, enough points, nonzero length, consistent bbox. | Medium |
| Marker confidence | Future check using from/to ref markers and marker displacements. | Medium |
| Extent confidence | Future check using from/to limits and route extents. | Medium |

### 8.2 Prototype score bands

| Combined score | Interpretation | Private action |
| --- | --- | --- |
| 0.80–1.00 | Strong overlap. | Candidate for future high-confidence route relevance. |
| 0.55–0.79 | Probable overlap. | Keep for review; compare with midpoint result. |
| 0.25–0.54 | Ambiguous / nearby. | Useful for false-positive reduction analysis. |
| 0.00–0.24 | Weak or no overlap. | Candidate midpoint false positive if current model flags it. |

### 8.3 Recommended validation metrics

- Count events where midpoint says relevant but overlap says weak/no overlap.
- Count events where midpoint says not relevant but overlap says strong/probable overlap.
- Compare confidence by corridor: TX 146, TX 321, US 90, FM 1960, FM 1409, FM 1008.
- Record event length distributions and bbox quality.
- Audit route-name agreement versus geometry agreement.

## 9. Future Directional Impact

Retained geometry would make future directional validation easier, but V290 does not implement directional display.

Potential future validation benefits:

- **Travel-direction validation:** Raw `travel_direction` can be compared with event segment bearing and route orientation.
- **Segment validation:** Direction can be tested at the affected segment level instead of inferred from a route name.
- **Corridor validation:** TX 146 and TX 321 can have corridor-specific direction confidence rules after geometry proves the event alignment.
- **Carriageway validation:** Future divided-highway support can compare geometry to separate carriageway shapes when available.
- **Marker-order validation:** From/to reference markers may help determine whether the event extent direction agrees with raw direction metadata.

Assessment: **geometry retention is a prerequisite for trustworthy future directional validation.** Directional display should remain paused until retained geometry, marker references, and route overlap confidence are validated privately.

## 10. WZDx Readiness Impact

Geometry retention would make future WZDx integration easier because WZDx is fundamentally event, road, lane, and work-zone geometry oriented. The same retained model can support construction intelligence without prematurely changing production alerts.

Readiness benefits:

- **Construction intelligence:** Full geometry preserves work-zone length and location, making construction impact more specific than a midpoint marker.
- **Lane intelligence:** Future lane-level data needs event extents and geometry to avoid treating lane restrictions as generic nearby incidents.
- **Work-zone intelligence:** WZDx feeds can include road-event geometry, lane impacts, restrictions, and temporal phases; a retained geometry model provides the storage and scoring concepts needed to compare those records against routes.
- **Cross-feed validation:** TxDOT retained geometry can become a baseline for comparing WZDx work-zone geometry, marker extents, and construction records.

Assessment: **yes, geometry retention materially improves WZDx readiness.** It should happen before deeper WZDx integration so Gridly does not repeat the midpoint-collapse problem with richer work-zone data.

## 11. Product Value Assessment

0 = none, 5 = transformational.

| Product area | Score | Rationale |
| --- | ---: | --- |
| Route Watch value | 5 | Segment overlap directly addresses route relevance, false positives, and confidence. |
| Alert value | 4 | Alerts become more relevant when private scoring distinguishes overlapping from nearby conditions. |
| Awareness value | 4 | TX 146, TX 321, and local corridor awareness benefit from reduced ambiguity. |
| Directional value | 4 | Retained geometry does not display direction, but it enables future validation. |
| Construction value | 5 | Construction and work-zone events often have meaningful extents; midpoint collapse loses their core value. |

Overall product value: **4.4 / 5**. Geometry retention is not a UI feature by itself, but it is a foundation for multiple high-value intelligence layers.

## 12. Recommended Next Milestone

Recommended milestone: **V291 — Route Watch Geometry Prototype**.

Why this is the best next step:

1. Route Watch is the clearest user-value test for retained geometry.
2. TX 146 and TX 321 provide strong validation corridors with known ambiguity patterns.
3. A private comparison harness can measure midpoint relevance versus segment-overlap relevance without changing production behavior.
4. It creates the evidence needed before directional validation or WZDx implementation.

V291 should remain prototype-only and should produce route-overlap comparison reports, not production route behavior changes.

## 13. Final Recommendation

**A. Geometry retention should be prioritized.**

Rationale:

- V290 confirms that the current midpoint model is insufficient for high-confidence route relevance.
- Retaining TxDOT geometry would materially improve Route Watch, alert relevance, route-overlap confidence, TX 146 awareness, TX 321 awareness, construction intelligence, and future directional validation.
- The prototype can remain fully isolated until private scoring proves the model is accurate enough for production planning.
- Directional display, WZDx integration, and production Route Watch changes should wait until retained geometry is validated.
