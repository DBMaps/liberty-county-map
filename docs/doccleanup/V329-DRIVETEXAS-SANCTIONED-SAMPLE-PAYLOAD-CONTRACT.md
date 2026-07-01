# V329 — DriveTexas Sanctioned Sample Payload Lifecycle Contract

## Executive Summary

V329 validates representative DriveTexas-style payload structures against Gridly's future official-source architecture without making API calls, ingesting live data, changing production behavior, building alerts, adding markers, changing routing, altering the map, implementing Travel Confidence, changing UI, or adding dependencies.

This milestone moves the V323-V328 work from vocabulary and lifecycle simulation into a payload contract. The recommended contract is intentionally conservative: Gridly should require enough official-source identity, lifecycle, location, and descriptive evidence to normalize an event safely, while preserving unmapped official records as `other_official` for audit instead of inventing meaning.

The minimum future shadow-ingestion candidate is a record with stable official identity, source attribution, event type/condition, lifecycle status or timestamp evidence, roadway identity, usable location, and human-readable title or description. The preferred future candidate adds county, district, direction, limits, start/end times, geometry, detour/delay flags, closure cause, and lane details.

## Required Field Contract

### Required before any future shadow ingestion prototype

| Field | Purpose | Required reason | If missing |
| --- | --- | --- | --- |
| `source_record_id` | Stable official id such as `GLOBALID`. | Needed for dedupe, update, removal, and reopened-record matching. | Do not lifecycle-manage as an official incident; audit only. |
| `source_name` | Official source label, e.g. DriveTexas / TxDOT. | Needed for trust and attribution. | Do not label as `Official Source`. |
| `event_type_or_condition` | Source condition/category. | Primary normalization evidence. | Map to `other_official` only if source is still trusted. |
| `status_or_event_state` | Active, updated, cleared, removed, closed, reopened, or equivalent. | Needed to interpret active/removed/reopened state. | Require stronger timestamp/feed-presence lifecycle evidence. |
| `last_updated_or_observed_at` | Official update time or Gridly observation time. | Needed for stale rules. | Do not present as current. |
| `roadway_or_route_name` | Road identity. | Needed to make awareness road-specific. | Area advisory only; no route-specific incident. |
| `location_geometry_or_coordinate` | Point, LineString, polygon/bbox, or coordinate pair. | Needed to place incident or evaluate route relevance. | County/area context only unless limits are strong. |
| `description_or_title` | Human-readable official text. | Needed for fallback normalization, auditability, and ambiguity review. | Keep as low-confidence official record only if structured fields are complete. |

### Recommended field tiers

| Tier | Fields | Decision |
| --- | --- | --- |
| Required | `source_record_id`, `source_name`, `event_type_or_condition`, `status_or_event_state`, `last_updated_or_observed_at`, `roadway_or_route_name`, `location_geometry_or_coordinate`, `description_or_title` | Minimum contract for future official-source shadow ingestion. |
| Recommended | `start_time`, `end_time`, `county`, `district`, `travel_direction`, `from_limit`, `to_limit`, `detour_flag`, `delay_flag`, `closure_state`, `lane_detail`, `cause_or_hazard` | Needed for high-quality lifecycle, geography, flood, detour, lane, and trust interpretation. |
| Optional | `severity`, `confidence_hint`, `reference_markers`, `metro_flag`, `countywide_flag`, `external_url`, `operator_notes` | Useful for review, attribution, and future product decisions; not enough alone to normalize. |
| Unavailable / not assumed | Turn-by-turn detour path, water depth, road owner coverage completeness, safety guarantee, real-time passability guarantee, user-specific routing impact | Do not infer these from representative payloads. |

## Optional Field Contract

Optional fields should be retained in raw/audit payloads, not used as sole normalization evidence:

- `reference_markers` and marker display fields can improve route segment matching.
- `metro_flag` and `countywide_flag` can explain broad records but cannot replace coordinates.
- `external_url` can support attribution if allowed by source terms.
- `operator_notes` can help review but should not silently override structured fields.
- `severity` or `confidence_hint` may inform future prioritization only after source semantics are verified.

## Lifecycle Contract

A future official-source record should expose lifecycle through both source fields and Gridly observation metadata.

### Source-facing fields

| Field | Meaning |
| --- | --- |
| `source_record_id` | Stable official id for continuity. |
| `status` | Source active/updated/cleared/removed/reopened/closed text. |
| `event_state` | If supplied, explicit official event state. |
| `closure_state` | Open, closed, partial, lane-restricted, detour, or unknown. |
| `start_time` | Official effective or reported start. |
| `last_updated` | Official last-update timestamp. |
| `end_time` | Official expected or actual clear/end time. |

### Gridly-normalized lifecycle fields

| Normalized field | Recommended values | Interpretation |
| --- | --- | --- |
| `lifecycle_state` | `active`, `updated`, `stale`, `removed`, `reopened`, `expired` | Current official-source interpretation. |
| `last_official_seen_at` | ISO timestamp | Last Gridly observation where the official record appeared. |
| `source_updated_at` | ISO timestamp | Source-provided update timestamp. |
| `removal_observed_at` | ISO timestamp or null | When previously active source id disappeared or explicit removed state arrived. |
| `reopened_from_record_id` | Source id or null | Link to prior lifecycle episode when a matching official record returns. |
| `stale_after` | ISO timestamp or policy duration | Derived from canonical type and lifecycle class. |
| `expires_after` | ISO timestamp or policy duration | Derived expiration or review point. |

### Lifecycle rules

- **Active:** source status indicates active/open current condition, or the record appears in the current official feed inside its valid time window.
- **Updated:** same `source_record_id` appears with newer `last_updated`, changed text, changed geometry, changed limits, or changed closure/lane/flood state.
- **Stale:** active official record misses its expected refresh window and has no clearing evidence.
- **Removed:** explicit cleared/removed/open status arrives, `end_time` has passed with no active refresh, or a previously observed id disappears under validated feed-diff rules.
- **Reopened:** same official id or strong identity match reappears after removal within the class-specific reopen window.

## Trust Contract

Gridly trust should describe evidence, not guarantee safety.

| Trust label | Required metadata | Meaning |
| --- | --- | --- |
| `Official Source` | `source_name`, `source_record_id`, `source_observed_at`, non-stale lifecycle state | Official source published the condition. |
| `Official Source + Community Active` | Official source metadata plus active nearby/community report(s) that have not yet met confirmation policy | Community evidence is currently active near the official condition. |
| `Official Source + Community Confirmed` | Official source metadata plus qualifying confirmed community report(s), timestamps, and match relationship | Community evidence confirms active impact under Gridly policy. |
| `Stale Official Source` | Official source metadata plus stale lifecycle state and `last_official_seen_at` | Official evidence exists but is past the recommended freshness window. |

Recommended normalized trust metadata:

```json
{
  "sourceName": "DriveTexas / TxDOT",
  "sourceRecordId": "sample-id",
  "sourceUrl": null,
  "sourceUpdatedAt": "2026-06-15T09:00:00Z",
  "sourceObservedAt": "2026-06-15T09:05:00Z",
  "communityActiveCount": 0,
  "communityConfirmedCount": 0,
  "communityLastConfirmedAt": null,
  "trustLabel": "Official Source",
  "stalenessState": "fresh"
}
```

## Flood Contract

Flood records should separate **condition**, **closure state**, **cause**, and **location context**.

| Future payload concept | Canonical fields | Normalized result |
| --- | --- | --- |
| Flooded roadway | `condition=flooded_roadway`, `hazard=flooding`, `water_present=true`, no full closure | `flooded_roadway` |
| High water | `condition=high_water`, `hazard=high_water`, `passability=unknown_or_caution`, no full closure | `high_water` |
| Road closed due to flooding | `condition=road_closed`, `closure_state=closed`, `cause=flooding` | `road_closed` with `floodRelated=true` |
| Low water crossing | `location_context=low_water_crossing`, `flood_prone=true`; active flood only with flood/high-water condition | Context only unless paired with active flood evidence |

Flood precedence: explicit full closure due to flooding maps to `road_closed` while preserving `floodRelated=true`; high water and flooded roadway remain separate when no full closure is stated.

## Geographic Contract

| Location form | Suitability | Decision |
| --- | --- | --- |
| Road + coordinates/geometry | Strong | Preferred minimum for shadow ingestion. |
| Road + LineString + limits | Strongest | Best for route overlap and future confidence analysis. |
| Coordinates only | Weak | Review-only unless roadway can be safely resolved. |
| Road name only | Weak to moderate | Accept for broad awareness or audit; insufficient for precise incident placement. |
| County only | Area context | Not suitable for route-specific awareness. |
| Countywide flag + advisory | Contextual | May normalize to `travel_advisory`; no marker-grade incident. |

## Sample Payload Fixtures

All fixtures are representative and sanctioned for contract design only. They are not live DriveTexas data.

### 1. Flood closure

Raw payload:

```json
{
  "GLOBALID": "sample-flood-closure-001",
  "condition": "Road Closed",
  "status": "Active",
  "closure_state": "closed",
  "cause": "Flooding",
  "route_name": "FM 1409",
  "roadway": "FM 1409",
  "description": "Road closed due to flooding at low water crossing.",
  "start_time": "2026-06-15T08:00:00Z",
  "last_updated": "2026-06-15T09:00:00Z",
  "end_time": null,
  "county": "Liberty",
  "district": "Beaumont",
  "geometry": { "type": "Point", "coordinates": [-94.8, 30.05] }
}
```

Normalized: `road_closed`, `floodRelated=true`, lifecycle `active`, trust `Official Source`.

### 2. High water

Normalized from `condition=High Water` to `high_water`, `floodRelated=true`, active event-driven lifecycle, official trust. Stale review should be fast because water/passability can change quickly.

### 3. Road closure

Normalized from `condition=Road Closed` to `road_closed`, `floodRelated=false` unless cause/description supplies flooding. Expire on official clear/end/removal.

### 4. Crash

Normalized from `condition=Crash` or crash/collision/accident text to `crash`. Short-duration lifecycle: stale around 30 minutes and expire aggressively after removal or missed refresh.

### 5. Construction

Normalized from `condition=Construction`, maintenance, or work-zone text to `construction` unless stronger full-closure terms apply. Long-duration lifecycle should use `start_time`, `end_time`, and periodic refresh.

### 6. Disabled vehicle

Normalized from disabled/stalled vehicle text to `disabled_vehicle`. Very short lifecycle: stale in 15-30 minutes and expire/remove quickly.

### 7. Bridge closure

Normalized from bridge closure text to `bridge_closure`. Bridge-specific closures outrank generic road closures because structures can be network-critical.

### 8. Travel advisory

Normalized from advisory text to `travel_advisory`. Countywide or geometry-null advisories are contextual; they should not become marker-grade route incidents.

### 9. Lane closure

Normalized from lane-closure text to `lane_closure`, not `road_closed`, unless the payload explicitly states full closure. Lane detail is recommended.

### 10. Detour

Normalized from detour/alternate route text to `detour`. It should attach to a parent closure/work-zone/advisory when possible and must not become turn-by-turn routing.

## Normalization Examples

| Source evidence | Expected Gridly type | Notes |
| --- | --- | --- |
| `Road Closed` | `road_closed` | Full-closure semantics. |
| `Road Closed` + `cause=Flooding` | `road_closed` + `floodRelated=true` | Closure wins; flood relationship retained. |
| `Flooded Roadway` / `Water Over Road` | `flooded_roadway` | No full closure implied. |
| `High Water` | `high_water` | Caution/passability-uncertain flood evidence. |
| `Travel Advisory` | `travel_advisory` | Official caution only. |
| `Construction` / `Maintenance` / `Work Zone` | `construction` | Unless full closure or lane-only detail is stronger. |
| `Crash` / `Accident` / `Collision` | `crash` | Short-duration. |
| `Disabled Vehicle` / `Stalled Vehicle` | `disabled_vehicle` | Very short-duration. |
| `Right Lane Closed` | `lane_closure` | Partial restriction. |
| `Detour` / `Alternate Route` | `detour` | Context; no routing. |
| `Bridge Closed` | `bridge_closure` | Outranks generic closure. |
| Unmapped official condition | `other_official` | Preserve for review. |

## Audit Extension

`window.gridlyDriveTexasShadowNormalizerAudit?.()` now exposes V329 contract data under:

- `payloadContractReview`
- `requiredFields`
- `recommendedFields`
- `optionalFields`
- `lifecycleFields`
- `trustFields`
- `geographicFields`
- `floodContract`
- `fixturePayloads`
- `normalizationExamples`

## Risks

- Representative fixtures may not match all future sanctioned DriveTexas payload values.
- Source removal semantics require validation before any feed-diff logic is trusted.
- Countywide or advisory records can be overlocalized if geometry rules are too permissive.
- Flood descriptions can mix closure, water, caution, and low-water-crossing context; precedence rules must avoid overclaiming.
- Official-source trust can be misread as a safety guarantee; product copy must avoid that implication.
- Some local/county roads may not be covered by DriveTexas even if nearby official highways are covered.

## Future Integration Notes

Before any shadow ingestion prototype, Gridly should obtain a sanctioned static export or approved sample bundle and verify:

1. Actual official id stability.
2. Timestamp names and timezone behavior.
3. Explicit removed/cleared/open values versus disappearance-only removal.
4. Flood/high-water/closure vocabulary variants.
5. Geometry type distribution and countywide/advisory behavior.
6. Terms for attribution, caching, display, and API key handling.

## Recommended Next Milestone After V329

**V330 — DriveTexas Sanctioned Static Export Schema Validation.** Use an approved, non-live exported sample bundle to mechanically validate field presence, enum values, timestamp parsing, geometry completeness, lifecycle transitions, and normalization coverage without production ingestion or UI behavior.
