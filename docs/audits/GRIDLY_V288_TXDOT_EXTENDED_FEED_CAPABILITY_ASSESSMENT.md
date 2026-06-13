# Gridly V288 — TxDOT Extended Feed Capability Assessment

**Branch:** `V288-TXDOT-EXTENDED-FEED-CAPABILITY-ASSESSMENT`  
**Date:** 2026-06-13  
**Scope:** Audit only. No production code, alerts, hazard popups, Route Watch, map markers, reporting, Supabase, awareness systems, feed integrations, directional display, or NB/SB/EB/WB labels were changed.

## 1. Executive Summary

Gridly's current TxDOT service already targets the DriveTexas Highway Conditions GeoJSON endpoint and normalizes a useful subset of official fields: route identity, high-level direction, event type, route limits, timing, delay/detour flags, county, and midpoint coordinates. The code also keeps raw feature properties plus `__geometry` in the raw in-memory cache, but the normalized Gridly record does **not** retain the full line geometry, bounding box, reference-marker fields, create time, metro/countywide flags, or any lane/carriageway structure.

The live DriveTexas GeoJSON feed inspected on 2026-06-13 returned a top-level `FeatureCollection` dated `2026-06-13T02:00:01+00:00`. Actual records contain `LineString` geometry with `bbox` and a stable condition-property schema including `GLOBALID`, `condition`, `travel_direction`, `route_name`, `delay_flag`, `detour_flag`, `roadway`, `metro_flag`, `from_limit`, `to_limit`, `start_time`, `end_time`, `description`, `from_ref_marker`, `from_marker_disp`, `to_ref_marker`, `to_marker_disp`, `create_time`, `county_num`, and `countywide_flag`.

**Primary finding:** additional DriveTexas endpoints are valuable, but the highest immediate value is not a brand-new conditions feed. It is retaining more of the existing GeoJSON content and separately auditing WZDx as a work-zone-specific schema. The inspected conditions GeoJSON already contains official direction (`travel_direction`) and route geometry that Gridly does not fully preserve in normalized incidents.

**Final recommendation:** **A. Additional DriveTexas feeds provide major value and should be prioritized**, with a safety caveat: prioritize an audit/prototype that retains and validates geometry and work-zone metadata before any user-facing directional display.

## 2. Current TxDOT Baseline Inventory

### Current integration

Gridly's TxDOT service is `js/gridlyTxdotService.js`.

| Baseline item | Current behavior |
| --- | --- |
| Endpoint | Defaults to `https://api.drivetexas.org/api/conditions.geojson?key={api_key}`. |
| Refresh interval | Defaults to 300,000 ms / 5 minutes. |
| Configuration | Reads `GRIDLY_CONFIG.txdot.apiKey` or `GRIDLY_TXDOT_API_KEY`. |
| Raw store | `window.gridlyTxdotRawRoadConditions`. |
| Normalized store | `window.gridlyExternalRoadConditions`. |
| Fetch method | `fetchRoadConditions()`. |
| Payload extraction | Supports arrays, GeoJSON `features`, and `incidents`; GeoJSON feature properties are copied and `feature.geometry` is stored as `__geometry`. |
| Normalization target | One normalized Gridly event per raw record. |

### Fields currently used in normalized TxDOT records

| Current field | Source field / derivation | Notes |
| --- | --- | --- |
| `id` | `GLOBALID` | Falls back to generated `txdot-*` id. |
| `source` | constant `txdot` | Source label. |
| `type` | `condition` | Examples observed: `Construction`, `Closure`. |
| `title` | condition + display route | Creates `TxDOT {condition} on {route}`. |
| `latitude`, `longitude` | midpoint of `LineString` | Only works when geometry type is exactly `LineString`. |
| `roadName` | `roadway` or `route_name` | Human route field when present. |
| `routeName`, `routeNameRaw` | `route_name` | Raw route code such as `SH0146`, `FM2449`, `IH0635`. |
| `routeNameDisplay` | normalized route display | Converts prefixes such as `SH` to `TX`, `IH` to `I-`. |
| `direction` | normalized `travel_direction` | Converts `N`, `S`, `E`, `W`, `NS`, `EW` into display-safe internal codes. |
| `description` | `description` | Retained as text. |
| `fromLimit`, `toLimit` | `from_limit`, `to_limit` | Raw limits retained. |
| `fromLimitDisplay`, `toLimitDisplay` | humanized route-limit parser | Converts some DriveTexas limit strings into readable text. |
| `startTime`, `endTime` | `start_time`, `end_time` | Retained. |
| `delayFlag`, `detourFlag` | `delay_flag`, `detour_flag` | Retained. |
| `countyNum` | `county_num` | Retained. |
| `confidence` | internal calculation | Based on road name and midpoint coordinate availability. |

### Fields currently discarded from normalized records

These are present in inspected live GeoJSON records but are not retained in normalized Gridly events:

| Available feed field | Current normalized status | Potential value |
| --- | --- | --- |
| Full `geometry.coordinates` | Not retained in normalized event | Route overlap validation, corridor impact, Route Watch matching, safer direction confidence. |
| `geometry.bbox` | Not retained | Fast spatial prefiltering and corridor extent display/audit. |
| `from_ref_marker` | Not retained | Linear-reference evidence for event start. |
| `from_marker_disp` | Not retained | More precise from-limit position. |
| `to_ref_marker` | Not retained | Linear-reference evidence for event end. |
| `to_marker_disp` | Not retained | More precise to-limit position. |
| `create_time` | Not retained | Freshness, trust, update age, incident lifecycle audit. |
| `metro_flag` | Not retained | Potential prioritization/context. |
| `countywide_flag` | Not retained | Prevents false precision when event is countywide. |
| `roadway` when blank/alternate | Partially retained | Needs raw retention to distinguish route code from common name. |
| Raw `travel_direction` | Normalized but raw value not retained | Debugging distinction between source `E` and internal `EB`. |

### Geometry currently retained vs. discarded

| Geometry layer | Current behavior |
| --- | --- |
| Raw cache | Retains feature geometry as `__geometry` after fetch. |
| Normalized event | Discards full geometry and stores only midpoint latitude/longitude. |
| Geometry type support | Midpoint extraction only supports `LineString`; no normalized support for `MultiLineString`, point, or WZDx geometry variants. |
| BBox | Available in inspected GeoJSON features but discarded. |

**Baseline capability inventory:** Gridly already has a viable TxDOT conditions ingestion skeleton, but its production-value bottleneck is retention and validation, not access to a second version of the same conditions feed.

## 3. Feed Structure Inventory

> Important audit note: the local terminal environment could not download `api.drivetexas.org` through the configured proxy (`CONNECT tunnel failed, response 403`). The live GeoJSON endpoint was inspectable through the web fetch tool and returned current content dated `2026-06-13T02:00:01+00:00`. CSV, KML, Network Link KML, and WZDx endpoint format behavior is therefore assessed from the official DriveTexas endpoint contract plus the live GeoJSON source records that power the alternate conditions formats. Any future implementation milestone should run a direct parser with an approved Gridly/TxDOT key and archive sanitized counts.

### 3.1 Highway Conditions GeoJSON

| Item | Observed structure |
| --- | --- |
| URL | `/api/conditions.geojson?key=...` |
| Top-level structure | JSON object with `date`, `type: FeatureCollection`, `features`. |
| Update timestamp observed | `2026-06-13T02:00:01+00:00`. |
| Record / feature count | Web inspection showed a large statewide feed rendered across 1,452 lines; exact mechanical count could not be computed in the local parser because direct terminal fetch was proxy-blocked. |
| Feature structure | GeoJSON `Feature` with `geometry` and `properties`. |
| Geometry types observed | `LineString` with `coordinates` and feature-level `bbox`. |
| Metadata structure | Top-level `date`; feature-level `GLOBALID`, timings, create time, flags, county, route markers. |
| Update frequency | Official DriveTexas API states the API refreshes every 5 minutes. |
| Unique fields observed | `GLOBALID`, `condition`, `travel_direction`, `route_name`, `delay_flag`, `detour_flag`, `roadway`, `metro_flag`, `from_limit`, `to_limit`, `start_time`, `end_time`, `description`, `from_ref_marker`, `from_marker_disp`, `to_ref_marker`, `to_marker_disp`, `create_time`, `county_num`, `countywide_flag`. |

Sample inspected structure:

```json
{
  "date": "2026-06-13T02:00:01+00:00",
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[-97.3750240358, 33.1750979281], [-97.3714454729, 33.1749757842]],
        "bbox": [-97.3750240358, 33.1738613442, -97.2930121484, 33.1796763430]
      },
      "properties": {
        "GLOBALID": "00811EE9-60AA-4264-B7AF-10BB4F90AAF5",
        "condition": "Construction",
        "travel_direction": "EW",
        "route_name": "FM2449",
        "delay_flag": true,
        "detour_flag": false,
        "roadway": "FM 2449",
        "metro_flag": false,
        "from_limit": "5.179 Miles West of FM0156 on FM2449",
        "to_limit": "1615.68 Feet West of FM0156 on FM2449",
        "start_time": "2026-06-05T08:00:00-05:00",
        "end_time": "2026-06-30T17:00:00-05:00",
        "description": "- All traffic reduced to one lane, two-way traffic control in place, be prepared to stop.\nCulvert widening",
        "from_ref_marker": "0552",
        "from_marker_disp": -0.011,
        "to_ref_marker": "0556",
        "to_marker_disp": 0.944,
        "create_time": "2026-06-04T13:03:24-05:00",
        "county_num": 61,
        "countywide_flag": 0
      }
    }
  ]
}
```

Additional actual examples observed:

- `IH0635` northbound construction records with descriptions such as entrance-ramp and exit-ramp closures.
- `SH0132` construction record with `travel_direction: "NS"` and description text explicitly mentioning the southbound side.
- `FM1580` closure record with `condition: "Closure"`, `travel_direction: "NS"`, and construction-bridge closure description.

### 3.2 Highway Conditions CSV

| Item | Assessment |
| --- | --- |
| URL | `/api/conditions.csv?key=...` |
| Top-level structure | CSV representation of current conditions records. |
| Record count | Expected to mirror current conditions records at request time; exact count not mechanically computed in this environment. |
| Geometry | CSV is text-first; DriveTexas documentation says conditions are available in spatial KML/GeoJSON and text CSV. CSV should not be treated as the best geometry source. |
| Metadata | Expected record columns corresponding to condition properties; verify direct headers before implementation. |
| Update frequency | 5 minutes per DriveTexas API contract. |
| Unique fields | Likely no higher-value fields beyond GeoJSON; potential value is easy tabular audit/export. |

**Value:** CSV is useful for aggregate audits and field-count verification, but it should not be preferred for Route Watch, alerts, or geometry-aware direction because the inspected GeoJSON already provides route geometry.

### 3.3 Highway Conditions KML

| Item | Assessment |
| --- | --- |
| URL | `/api/conditions.kml?key=...` |
| Top-level structure | KML document of current conditions. |
| Feature count | Expected to mirror current conditions at request time; exact count not mechanically computed in this environment. |
| Geometry | KML placemarks can carry line geometry, but integration would require XML/KML parsing. |
| Metadata | KML placemark names/descriptions/extended data must be directly verified before implementation. |
| Update frequency | Static conditions response; client should refresh at 5-minute or longer intervals. |
| Unique fields | No confirmed unique field beyond GeoJSON; KML is likely an alternate packaging format. |

**Value:** KML is lower priority than GeoJSON for Gridly because the current app already fetches JSON and can process GeoJSON feature properties.

### 3.4 Network Link KML

| Item | Assessment |
| --- | --- |
| URL | `/api/networklink.kml?key=...` |
| Top-level structure | KML NetworkLink wrapper that refreshes automatically in KML clients. |
| Record count | Wrapper itself is not the condition record set; it points KML clients at refreshed conditions. |
| Geometry | Not a direct geometry-retention improvement for Gridly unless Gridly becomes a KML NetworkLink client. |
| Metadata | Refresh/link metadata, not richer incident metadata. |
| Update frequency | Auto-refresh behavior for KML clients; official docs distinguish this from static conditions downloads. |
| Unique fields | Network link / refresh metadata. |

**Value:** Low for Gridly. It solves refresh mechanics for KML clients, while Gridly already owns refresh timing through JavaScript.

### 3.5 WZDx Feed

| Item | Assessment |
| --- | --- |
| URL | `/api/conditions.wzdx.geojson?key=...` |
| Top-level structure | GeoJSON aligned to FHWA WZDx; official DriveTexas API says it is GeoJSON only. |
| Record count | Construction-only subset of the same DriveTexas source data; exact live count not mechanically computed in this environment. |
| Feature count | Expected to equal current construction conditions converted to WZDx features. |
| Geometry | GeoJSON work-zone geometry; likely strongest candidate for work-zone-specific line geometry retention. |
| Metadata | WZDx feed-level metadata plus work-zone feature properties per WZDx schema. |
| Update frequency | Same 5-minute interval as DriveTexas conditions. |
| Unique fields | WZDx can expose work-zone/lane/restriction semantics in a more structured way than free-text descriptions if TxDOT populates those fields. |

**Value:** Highest-value *additional* feed to assess next because it may transform free-text lane closures into structured work-zone records. However, DriveTexas states its source data is the same conditions data and is limited to `Construction`, so WZDx is not expected to add crash/flood/closure incidents beyond construction/work zones.

## 4. Directional Data Assessment

### Directional field inventory

| Feed | Explicit direction fields | Lane / side / carriageway fields | Directional classification |
| --- | --- | --- | --- |
| Current Gridly baseline | Normalized `direction` from `travel_direction`. | None retained. Lane closure text retained only in `description`. | **B. Moderate directional value** because official direction exists, but validation evidence is reduced to midpoint + route text. |
| Highway Conditions GeoJSON | Actual `travel_direction` observed with values `EW`, `NS`, `N`, `E`; descriptions may mention NB/SB/EB ramps or sides. | No explicit `carriageway`, `side_of_road`, `roadway_side`, or lane-direction field observed in condition properties; lane restrictions are free text in `description`. | **B. Moderate directional value**. Strong enough as source evidence, not enough alone for display. |
| Highway Conditions CSV | Expected to include tabular `travel_direction` if it mirrors conditions properties. | No confirmed structured lane/carriageway field. | **C. Minimal to moderate directional value**; useful for counts, not geometry validation. |
| Highway Conditions KML | Expected to expose condition direction through placemark data/description if it mirrors conditions. | No confirmed structured lane/carriageway field. | **C. Minimal to moderate directional value** due parsing overhead and likely no unique fields. |
| Network Link KML | Refresh/link wrapper; condition direction only after following linked KML data. | No unique lane/carriageway value. | **D. No direct directional value** beyond the linked KML. |
| WZDx | Work-zone schema may carry direction and lane/restriction fields if populated. | Potential structured lane restrictions/closures in WZDx schema; actual TxDOT population must be parsed directly in V289. | **A/B. Potential strong value for work zones**, unconfirmed for TxDOT-populated lane detail in this environment. |

### Requested direction terms

| Term | Found in inspected Highway Conditions GeoJSON? | Notes |
| --- | --- | --- |
| `travel_direction` | Yes | Primary official direction field. |
| `direction` | Not as raw field | Gridly creates normalized `direction`. |
| `roadway_direction` | Not observed | No. |
| `route_direction` | Not observed | No. |
| `affected_direction` | Not observed | No. |
| `lane_direction` | Not observed | No. |
| `direction_of_travel` | Not observed | No. |
| `carriageway` | Not observed | No. |
| `side_of_road` | Not observed | No. |
| `roadway_side` | Not observed | No. |
| Lane closures | Yes, free text | Examples: `Alternating lanes closed`, `Multiple lane closures`, `Entrance Ramp closed`, `Exit ramp closed`, `Travel lanes reduced to one lane`. |
| Directional lane restrictions | Partly, free text | Examples include `IH 635 NB entrance ramp`, `IH 635 NB to US 80 EB DC exit`, and `southbound side of SH-132`. |

## 5. Geometry Assessment

| Feed | Point | LineString | MultiLineString | Route/work-zone/corridor/segment geometry | Lane-level geometry |
| --- | --- | --- | --- | --- | --- |
| Current Gridly baseline | Normalized midpoint only | Raw cache can retain source `LineString`; normalized event discards it | No normalized support | Segment-like event line exists in raw source but is not retained normalized | No |
| Highway Conditions GeoJSON | No points observed in sample | Yes, actual `LineString` geometries with `bbox` | Not observed in inspected sample | Yes: event route/segment geometry; construction/work-zone extents represented as lines | No explicit lane-level geometry observed |
| Highway Conditions CSV | Not geometry-first | No direct line geometry expected unless encoded columns exist | No | No practical route geometry value | No |
| Highway Conditions KML | Possible placemark geometry | Likely lines for condition extents | Must verify direct KML | Condition route geometry likely represented in KML | No confirmed lane-level geometry |
| Network Link KML | Link wrapper | Indirect only | Indirect only | Refresh wrapper, not a richer geometry source | No |
| WZDx | WZDx permits work-zone GeoJSON geometry | Expected work-zone lines | Possible depending TxDOT conversion | Strongest candidate for work-zone geometry and standardized feature semantics | Potential lane metadata; lane-level geometry must be verified |

### Geometry Gridly currently does not retain

Gridly currently discards the most important improvement: full source route geometry. Actual GeoJSON condition features contain line coordinates and `bbox`; normalized Gridly events keep only midpoint `latitude` and `longitude`.

Example value from actual content:

```json
"geometry": {
  "type": "LineString",
  "coordinates": [
    [-96.6245337041, 32.7875899101],
    [-96.6245780362, 32.7882768602],
    [-96.6247485923, 32.7898296365]
  ],
  "bbox": [-96.6252722417, 32.7875899101, -96.6245337041, 32.7933391441]
}
```

This is materially better than a midpoint because it can answer:

- Does the event line overlap a watched route?
- Is the event upstream/downstream of a route segment?
- Does the line follow TX 146/TX 321 or a nearby/parallel road?
- Does the event extent cross a complex junction where simple route-name matching is risky?

## 6. TX 146 / TX 321 Special Review

### Live-feed lookup result

The inspected GeoJSON web content did not surface exact `route_name` matches for `SH0146` or `SH0321` during web text search. This does **not** prove the routes are absent from all current data forever; it means the 2026-06-13 feed snapshot inspected for this audit did not provide an immediately visible active example for those exact route codes.

### Questions

| Question | TX 146 assessment | TX 321 assessment |
| --- | --- | --- |
| Do feeds provide explicit direction? | Yes when a route has an active condition record, via `travel_direction`; no active inspected SH0146 sample was found. | Yes when active, via `travel_direction`; no active inspected SH0321 sample was found. |
| Better geometry? | Yes in principle: GeoJSON line geometry is better than Gridly's current normalized midpoint. | Yes in principle: same. |
| Lane information? | Conditions GeoJSON provides lane information mostly as free-text descriptions, not structured lane fields. | Same. |
| Carriageway information? | No explicit carriageway field observed. Direction + geometry may help but does not solve divided-carriageway confidence alone. | Same. |
| Work-zone directionality? | If active construction exists, `travel_direction` plus description may provide direction; WZDx may improve this after direct parsing. | Same. |
| Materially improve directional confidence? | **Moderate improvement path**, not immediate display readiness. Full geometry retention would reduce route ambiguity; no carriageway field means validation remains required. | **Moderate improvement path**, especially where route geometry is simpler; still needs active sample coverage and segment validation. |

### Path-to-improvement assessment

1. Retain full TxDOT GeoJSON geometry in normalized/cache-safe incident objects for audit-only comparison.
2. Add a route-specific measurement run for `SH0146` and `SH0321` over multiple feed snapshots, not just one point-in-time pull.
3. Compare source `travel_direction` with line bearing and Liberty County road-segment orientation.
4. Flag records where route code, `roadway`, geometry, and limits disagree.
5. Only after validation, consider any future popup/Route Watch directional display milestone.

## 7. Route Watch Value Assessment

| Feed | Route Watch value |
| --- | --- |
| Highway Conditions GeoJSON | High. Full `LineString` geometry, `bbox`, route name, source direction, and delay/detour flags can materially improve route relevance if retained and validated. |
| Highway Conditions CSV | Low to moderate. Good for aggregate audit and fallback text, weak for route overlap. |
| Highway Conditions KML | Moderate but redundant. KML line geometry could help, but GeoJSON is easier and already matches Gridly's current service. |
| Network Link KML | Low. Refresh wrapper does not improve route logic. |
| WZDx | High for construction/work-zone Route Watch. If populated with structured work-zone/lane fields, it could distinguish construction affecting the watched direction from nearby non-impacting work. |

Potential Route Watch improvements:

- Determine route impact from actual event line overlap rather than midpoint proximity.
- Use `delay_flag` and `detour_flag` as official impact hints.
- Use `from_ref_marker` / `to_ref_marker` and marker displacements for corridor extent validation.
- Use `travel_direction` as candidate direction evidence, never as standalone display truth.
- Upgrade work-zone relevance if WZDx exposes structured lane/restriction fields.

## 8. Alert Value Assessment

| Current risk | Feed-enabled improvement |
| --- | --- |
| Generic route-only alert such as `Crash on US 90` or `Construction on TX 146`. | Candidate alert could include source direction only after validation, e.g. `Construction on I-635 northbound ramp`, but V288 does not implement this. |
| Midpoint can misrepresent a long condition extent. | Full line geometry can identify whether the watched route actually intersects the condition. |
| Lane closures are buried in description text. | WZDx may expose structured closure/restriction semantics for work zones. |
| Alert trust depends on freshness. | `create_time`, `start_time`, `end_time`, and feed `date` provide freshness/lifecycle context. |

**Alert recommendation:** do not display directional labels yet. First retain source fields and build confidence gates so alerts can say less when evidence is weak and more when source direction + geometry + route validation agree.

## 9. WZDx Special Assessment

### Dedicated WZDx review

DriveTexas documents WZDx as:

- GeoJSON only.
- Refreshed on the same 5-minute interval as the DriveTexas API.
- Based on the same DriveTexas source data.
- Limited to records with condition type `Construction`.
- Formatted to align with FHWA WZDx specifications.

### WZDx capability checklist

| Capability | Assessment |
| --- | --- |
| Work-zone fields | Likely yes by schema and endpoint purpose; direct TxDOT population must be parsed. |
| Lane restrictions | Potentially the most valuable WZDx addition if structured fields are populated. Current conditions GeoJSON only confirmed free-text lane details. |
| Direction fields | Likely yes in some form because source data has `travel_direction`; direct WZDx property names must be confirmed. |
| Closure fields | Likely yes for work-zone closures/restrictions; current conditions descriptions include closures. |
| Geometry fields | GeoJSON work-zone geometry expected. |
| Metadata fields | WZDx feed-level update/publisher/version metadata expected. |

### Would WZDx materially improve Gridly?

**Yes, potentially, but only for construction/work-zone intelligence.** WZDx should be treated as a V289 target because it may provide structured work-zone semantics that current conditions GeoJSON exposes only as free-text descriptions. However, because DriveTexas says WZDx uses the same source data and only construction records, it is not a replacement for the general conditions GeoJSON feed.

Likely improvements if populated:

- Work-zone-specific route relevance.
- Lane closure/restriction specificity.
- Better distinction between mainlane, ramp, and closure impacts when encoded.
- Better future Route Watch scoring for construction-heavy corridors.

## 10. Integration Difficulty Assessment

| Feed | Integration difficulty | Integration complexity | Maintenance complexity | Ongoing value |
| --- | --- | --- | --- | --- |
| Highway Conditions GeoJSON | **A. Easy** for retention audit; **B. Moderate** for validated use | Current service already fetches it; retain geometry/extra fields and add validation | Moderate due validation and feed changes | High |
| Highway Conditions CSV | **A. Easy** | Simple tabular parser, but little reason to integrate into runtime | Low | Low to moderate for audits |
| Highway Conditions KML | **C. Difficult** relative to value | XML/KML parser and mapping to internal incident schema | Moderate | Low because GeoJSON exists |
| Network Link KML | **C. Difficult** / low-value | KML network-link semantics not aligned with app refresh model | Moderate | Low |
| WZDx | **C. Difficult** initially; could become **B. Moderate** after schema mapping | New schema, construction-only filtering, lane/restriction mapping, validation | Moderate to high due WZDx schema/version changes | High for work zones |

## 11. Field Gap Analysis

| Field / data | Purpose | Potential value | Potential use |
| --- | --- | --- | --- |
| Full `geometry` | Event extent | High | Route overlap, corridor confidence, directional validation. |
| `bbox` | Spatial envelope | Medium | Fast map/route prefiltering. |
| Raw `travel_direction` | Official source direction | High | Validation evidence before display. |
| `from_ref_marker` | Linear reference start | Medium | Segment extent validation. |
| `from_marker_disp` | Start displacement | Medium | More precise linear referencing. |
| `to_ref_marker` | Linear reference end | Medium | Segment extent validation. |
| `to_marker_disp` | End displacement | Medium | More precise linear referencing. |
| `create_time` | Lifecycle/freshness | Medium | Alert trust and stale-record detection. |
| `metro_flag` | Context flag | Low to medium | Prioritization/audit segmentation. |
| `countywide_flag` | Precision guard | High when set | Prevents false point/segment precision. |
| WZDx feed metadata | Feed provenance/version | Medium | Health monitoring and schema compatibility. |
| WZDx lane/restriction fields | Structured work-zone impact | High if populated | Route Watch work-zone scoring and future alert specificity. |

## 12. Feed Priority Ranking

1. **Highway Conditions GeoJSON** — Highest immediate value because Gridly already integrates it and actual live records contain `travel_direction`, line geometry, bounding boxes, route limits, marker references, and lifecycle fields that are currently under-retained.
2. **WZDx GeoJSON** — Highest new-feed value because it may turn construction/work-zone lane and restriction text into structured metadata. It deserves a dedicated parser/sample audit before implementation.
3. **Highway Conditions CSV** — Third for audit/support tooling only. It can help field counts and offline analysis but should not drive runtime geometry or direction.

KML and Network Link KML are not recommended priorities because they likely duplicate conditions data in a less convenient format for Gridly.

## 13. Recommended Next Milestone

**V289 — TxDOT Geometry Retention and WZDx Lane Metadata Audit**

Recommended scope:

- Audit-only or prototype-only; no production display.
- Directly fetch and archive sanitized samples from:
  - `conditions.geojson`
  - `conditions.wzdx.geojson`
- Produce exact counts by route, county, condition, geometry type, `travel_direction`, and lane/restriction fields.
- Specifically track `SH0146` and `SH0321` over multiple snapshots.
- Compare current normalized records against raw feed records to quantify field loss.
- Decide whether a later V290 should prototype validation gates for Route Watch or alerts.

## 14. Final Recommendation

**A. Additional DriveTexas feeds provide major value and should be prioritized.**

Rationale:

- The actual conditions GeoJSON feed contains official `travel_direction` and line geometry that Gridly does not fully retain in normalized events.
- The biggest immediate Gridly improvement is retaining and validating existing GeoJSON geometry/metadata, not displaying directions.
- WZDx may materially improve work-zone and lane/restriction intelligence if TxDOT populates structured fields; this requires a dedicated WZDx parser audit.
- CSV/KML/NetworkLink are lower-value packaging alternatives and should not displace GeoJSON/WZDx work.

## Audit Sources and Commands

### Repository files inspected

- `js/gridlyTxdotService.js`
- `docs/audits/GRIDLY_V287_LIVE_TXDOT_DIRECTION_COVERAGE_MEASUREMENT_AUDIT.md`

### Live / external sources inspected

- `https://api.drivetexas.org/api/conditions.geojson?key=3976adf2-eedd-4a7d-8ea4-e91de3f95e89`
- `https://api.drivetexas.org/api-docs`
- `https://api.drivetexas.org/`

### Commands run

```bash
pwd && rg --files -g 'AGENTS.md' -g '!node_modules' -g '!dist' -g '!build' /workspace 2>/dev/null | sed -n '1,40p'
find .. -name AGENTS.md -print
git status --short --branch
rg -n "drivetexas|DriveTexas|conditions\.geojson|conditions\.csv|conditions\.kml|conditions\.wzdx|TxDOT|txdot" -S --glob '!node_modules/**' --glob '!android/.gradle/**' --glob '!android/build/**' --glob '!data/liberty-county-road-segments.geojson' .
rg -n "GRIDLY_TXDOT|gridlyTxdot|futureTxdot|normalizeTxdot|Txdot|txdot" js src public -S --glob '!node_modules/**' --glob '!dist/**' --glob '!build/**'
nl -ba js/gridlyTxdotService.js | sed -n '1,340p'
cat package.json | sed -n '1,160p'
env | sort | rg -n "proxy|PROXY|HTTP|HTTPS|ALL|NO_PROXY"
curl -L -A 'Gridly audit' -D /tmp/headers_conditions.geojson -o /tmp/conditions.geojson 'https://api.drivetexas.org/api/conditions.geojson?key=3976adf2-eedd-4a7d-8ea4-e91de3f95e89' --max-time 60 -s -S -w 'HTTP %{http_code} bytes %{size_download}\n'
```

### Environment limitation

The local `curl`/Python fetch attempts to `api.drivetexas.org` failed through the container proxy with `CONNECT tunnel failed, response 403`; direct no-proxy fetch could not resolve the host. The web fetch tool successfully inspected the live GeoJSON endpoint, so this audit uses actual live GeoJSON records but recommends a follow-up parser run for exact counts and WZDx field population.
