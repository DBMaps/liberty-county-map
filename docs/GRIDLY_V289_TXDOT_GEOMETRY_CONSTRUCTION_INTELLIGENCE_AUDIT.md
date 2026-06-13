# Gridly V289 — TxDOT Geometry & Construction Intelligence Audit

Branch: `V289-TXDOT-GEOMETRY-AND-CONSTRUCTION-INTELLIGENCE-AUDIT`  
Audit date: 2026-06-13  
Scope: Audit only; no production code, alerts, hazard popups, Route Watch, map markers, reporting, Supabase, awareness systems, new feeds, directional display, or UI behavior changed.

## 1. Executive Summary

V289 confirms that TxDOT geometry and construction intelligence have **major practical product value** for Gridly, especially for Route Watch confidence, alert specificity, future directional capabilities, and construction awareness. The existing Gridly TxDOT service already proves that the standard DriveTexas GeoJSON feed is treated as a feature-based feed with LineString geometry and fields such as `route_name`, `travel_direction`, `from_limit`, `to_limit`, `delay_flag`, `detour_flag`, and `county_num`, but the normalized product model retains only a midpoint, a route/display name, direction, limits, timing, flags, county, and a simple confidence score.

The biggest gap is not whether TxDOT provides useful information; the gap is that Gridly currently collapses linear road events into a single midpoint. That is adequate for a marker or simple road-condition row, but it loses the geometry required to answer the higher-value product question: **does the actual affected segment overlap the user's route, corridor, or direction of travel?**

The WZDx construction feed is potentially the highest-value construction-specific source because its schema is designed around road events, LineString geometry, lane-level structures, vehicle-impact classifications, road/lane restrictions, beginning/ending cross streets, mileposts, verification flags, work type, worker presence, and feed metadata. TxDOT's DriveTexas API documentation states that WZDx is available as GeoJSON, refreshes on the same five-minute interval, and is sourced from the same DriveTexas conditions data but limited to `Construction` conditions. The official WZDx v4.2 schema also shows a richer construction model than the standard normalized Gridly TxDOT model.

Important audit caveat: direct terminal retrieval of `https://api.drivetexas.org/api/conditions.geojson` and `https://api.drivetexas.org/api/conditions.wzdx.geojson` was blocked in this environment by a proxy/CONNECT `403`, so V289 could not preserve a fresh raw payload sample in the repository. This audit therefore distinguishes between: (1) **repo-observed Gridly retention behavior**, (2) **DriveTexas API documented feed behavior**, and (3) **WZDx official schema capability**. The V288-established observed fields remain treated as the actual standard-feed field set under review.

Final recommendation: **A. TxDOT geometry and construction intelligence provide major product value and should be prioritized.** The recommended next milestone is **V290 — TxDOT Geometry Retention Prototype** with no directional display and no public UI until validation gates are passed.

## 2. TxDOT Geometry Inventory

### 2.1 Standard DriveTexas conditions GeoJSON

DriveTexas documents the standard conditions endpoint as `/api/conditions.{filetype}?key={api_key}`, with `geojson`, `csv`, and `kml` output options and a recommended refresh interval of five minutes or greater. Gridly's TxDOT service is configured against `https://api.drivetexas.org/api/conditions.geojson?key={api_key}`.

Observed/confirmed through Gridly's current service handling and V288 field findings:

| Geometry capability | Standard conditions feed status | Audit assessment |
| --- | --- | --- |
| Point geometry | Not the primary shape Gridly expects for current normalized handling. Gridly derives a point from the midpoint of a `LineString`. | Useful as a display fallback, but inferior to event segment geometry. |
| LineString geometry | Present and expected by Gridly's midpoint extractor. | Very high value. This is the core geometry currently being collapsed. |
| MultiLineString geometry | Not handled by current Gridly TxDOT normalization. | Unknown in standard feed from current code; should be accepted only after sampled feed verification. |
| Bounding boxes | V288 found `bbox` exists. Current Gridly TxDOT service does not retain it. | High value for fast route/corridor prefiltering and map viewport logic. |
| Segment geometry | Present when the feed represents the affected condition as a LineString. | Very high value for route overlap and construction length estimates. |
| Corridor geometry | Derivable from route_name + LineString + route extents, not retained as a first-class model. | High value for corridor-level awareness. |
| Work-zone geometry | Standard feed includes construction records, but construction-specific geometry semantics are richer in WZDx. | Moderate in standard feed; very high in WZDx. |

### 2.2 WZDx construction GeoJSON

DriveTexas documents `/api/conditions.wzdx.geojson?key={api_key}` as a GeoJSON-only WZDx feed refreshed on the same five-minute interval as the DriveTexas API and limited to source records whose type is `Construction`.

WZDx v4.2 schema capability inventory:

| Geometry capability | WZDx schema status | Audit assessment |
| --- | --- | --- |
| Point geometry | Road event geometry is not modeled as simple Point. | Not a primary work-zone geometry. |
| LineString geometry | Explicitly allowed for `RoadEventFeature.geometry`. | Very high value for work-zone route overlap. |
| MultiPoint geometry | Explicitly allowed for `RoadEventFeature.geometry`. | Useful for moving/planned moving or marker-like event representation, but less direct than LineString. |
| MultiLineString geometry | Not an allowed WZDx v4.2 `RoadEventFeature.geometry` option in the official schema reviewed. | Not available per schema. |
| Bounding boxes | Optional `bbox` exists both at collection and feature level. | High value for fast spatial filtering. |
| Segment geometry | A `RoadEventFeature` represents a road event; work-zone properties describe the impacted roadway segment. | Very high value. |
| Corridor geometry | Derivable from `core_details.road_names`, `core_details.direction`, LineString geometry, and related road events. | High value, especially when multiple related events describe one project. |
| Work-zone geometry | Native purpose of the feed. | Very high value. |

## 3. Geometry Retention Gap Analysis

Gridly currently retains enough TxDOT information to produce normalized road-condition records, but discards most of the spatial intelligence. The key product issue is that Route Watch and alert logic can only work from approximate point proximity unless future code retains geometry.

| Field/capability | Current Gridly status | What is discarded | Potential value | Potential use case |
| --- | --- | --- | --- | --- |
| `geometry` / `__geometry` | Extracted from GeoJSON into raw rows as `__geometry`, then passed into normalization. | Full geometry is not copied into the normalized event. | Very high. | Determine whether affected segment intersects a saved route rather than whether midpoint is near route. |
| LineString midpoint | Retained as `latitude` and `longitude`. | All other vertices and segment length are discarded. | Moderate as fallback; limited as intelligence. | Current marker placement / approximate event anchor. |
| `bbox` | Not retained by current service. | Feed/feature bounding boxes are unavailable after normalization. | High. | Cheap route-corridor prefilter before expensive line intersection. |
| Route extents | Partially retained through `fromLimit`, `toLimit`, and display variants. | Numeric/geometric extent is not retained as structured linear reference. | High. | Alert copy such as “from X to Y” and construction-length estimation. |
| `route_name` | Retained as `routeName`, `routeNameRaw`, and `routeNameDisplay`. | Multi-route semantics can be flattened for presentation. | High. | Corridor matching for TX 146, TX 321, US 90, FM corridors. |
| `roadway` | Retained as `roadName` fallback. | None obvious, except not linked to geometry. | Moderate. | User-facing road label and fallback matching. |
| `travel_direction` | Normalized and retained as `direction`. | Raw direction is not separately preserved; directional confidence is not scored. | High. | Future directional relevance, e.g. northbound work zone versus opposite direction. |
| `from_limit` / `to_limit` | Retained raw and humanized. | Not converted into structured cross-street/route reference objects. | High. | Better local wording and confidence around event endpoints. |
| Reference marker / milepost fields | V288 identified reference marker fields; current normalizer does not retain dedicated marker values. | Linear-reference precision. | Moderate to high. | Validate segment endpoints, disambiguate repeated route names, build “between markers” copy. |
| Delay flag | Retained as `delayFlag`. | No severity model tied to geometry/length/direction. | Moderate. | Rank alerts and Route Watch impact. |
| Detour flag | Retained as `detourFlag`. | No structured detour geometry in standard normalized model. | High when true. | “Avoid / alternate route” gating and alert escalation. |
| Construction lane details | Not structured in current standard normalized model. | Lane reductions, shoulder/ramp impacts, and restrictions if available only in WZDx are absent. | High. | More trustworthy construction alerts. |

## 4. Route Watch Geometry Value Assessment

Current Route Watch relevance is point-proximity based for incidents without crossing IDs: it checks the incident latitude/longitude against vertices in the active route polyline using a distance threshold. This is a safe fallback, but it cannot detect actual line overlap, partial overlap, travel-direction impact, or affected mileage.

Retaining TxDOT geometry would improve Route Watch in five ways:

1. **Route relevance** — A TxDOT LineString could be tested against the active route polyline instead of comparing only a midpoint to route vertices.
2. **Impact scoring** — A segment that overlaps 3 miles of the route should score higher than a segment whose midpoint is nearby but whose affected lanes do not touch the route.
3. **Confidence** — Geometry + route_name + travel_direction + from/to limits would provide stronger confidence than road name + midpoint alone.
4. **Awareness** — Route Watch could distinguish “near route,” “on route,” “parallel corridor,” and “opposite-direction likely not relevant” after future validation.
5. **False-positive reduction** — Bbox and LineString prefilters would reduce alerts caused by nearby but unrelated roadway segments.

Example contrast:

| Current model | Geometry-retention model |
| --- | --- |
| “Incident midpoint is within 0.8 miles of active route.” | “TxDOT affected LineString overlaps the active route corridor for N miles and is in the same route/direction candidate set.” |

Audit conclusion: geometry retention is **very high value** for Route Watch, but the first milestone should validate retained geometry and overlap calculations privately before directional display or user-facing copy changes.

## 5. Alert Geometry Value Assessment

Retaining geometry would materially improve alert quality without changing alert UI immediately.

Potential alert improvements:

| Alert quality dimension | Current limitation | Geometry-enabled improvement |
| --- | --- | --- |
| Specificity | “Construction on TX 146” can be too broad. | “Construction affecting the TX 146 segment from X to Y” or “about N miles” after validation. |
| Trust | Users may distrust broad road-level alerts if they do not encounter the event. | Geometry-backed alerts can explain why the alert is near/on route. |
| Relevance | Midpoint proximity can misclassify adjacent roads or frontage roads. | Line overlap and bbox filtering reduce irrelevant alerts. |
| Severity | A short shoulder event and a multi-mile lane closure can look similar. | Segment length + WZDx `vehicle_impact` + lane statuses can calibrate severity. |
| Timing | Standard normalized model keeps start/end time but does not tie it to construction validation fields. | WZDx verified start/end flags improve trust language. |

Audit conclusion: geometry retention has **high to very high alert value**, especially when combined with WZDx construction fields.

## 6. Construction Intelligence Inventory

### 6.1 Standard DriveTexas conditions feed fields currently recognized by Gridly

Gridly's TxDOT service currently recognizes these construction-relevant fields from standard conditions records:

| Field | Current retention | Construction intelligence value |
| --- | --- | --- |
| `condition` | Retained as normalized `type`; construction counted by regex matching `construct`, `maintenance`, `lane closure`, or `work zone`. | Identifies construction-like records, but broad. |
| `description` | Retained. | Semi-structured/free-text construction detail. |
| `route_name` | Retained. | Road/corridor context. |
| `roadway` | Retained as road fallback. | Road label fallback. |
| `travel_direction` | Retained as normalized direction. | Directional candidate signal. |
| `from_limit` | Retained raw and humanized. | Beginning extent / cross-reference. |
| `to_limit` | Retained raw and humanized. | Ending extent / cross-reference. |
| `start_time` | Retained. | Work/event start context. |
| `end_time` | Retained. | Work/event expected end context. |
| `delay_flag` | Retained. | Delay relevance signal. |
| `detour_flag` | Retained. | Detour relevance signal. |
| `county_num` | Retained. | Local filtering, including Liberty County. |
| `GLOBALID` | Retained as ID source. | Deduplication / stable identity. |

### 6.2 Construction-related capabilities not structured in current Gridly model

| Capability | Standard normalized status | WZDx expected status |
| --- | --- | --- |
| Lane closures | Not retained as structured fields. | `lanes[]` can encode status, type, order, and lane restrictions. |
| Lane reductions / merges / shifts | Not retained. | `vehicle_impact` and `lanes[].status` can encode closures, merges, shifts, alternating flow. |
| Shoulder closures | Not retained. | `lanes[].type = shoulder` with status can encode shoulder impacts. |
| Ramp closures | Not retained. | `lanes[].type` supports entrance/exit lanes and ramps. |
| Restrictions | Not retained. | `restrictions[]` supports roadway and lane restrictions. |
| Worker presence | Not retained. | `worker_presence` can encode whether workers are present and confidence/method. |
| Verification | Not retained. | WZDx has start/end date and position verification flags. |
| Work type | Not retained. | `types_of_work[]` can describe maintenance, surface work, barrier work, etc. |
| Mileposts/cross streets | Standard has from/to limits; no structured conversion. | WZDx has beginning/ending cross streets and mileposts. |

## 7. WZDx Construction Audit

DriveTexas WZDx endpoint under review:  
`https://api.drivetexas.org/api/conditions.wzdx.geojson?key=3976adf2-eedd-4a7d-8ea4-e91de3f95e89`

### 7.1 Schema structure

Official WZDx v4.2 Work Zone Feed structure:

- Top-level `type = FeatureCollection`.
- Top-level `features[]` contains WZDx road event `Feature` objects.
- Top-level feed metadata is provided through `feed_info` or legacy-compatible `road_event_feed_info`.
- Optional top-level `bbox` is supported.
- Each feature has `id`, `type = Feature`, `properties`, `geometry`, and optional feature `bbox`.
- Each feature's `properties.core_details` is required.
- WZDx work-zone features require `core_details`, `start_date`, `end_date`, `vehicle_impact`, and `location_method`, plus date/position verification or deprecated accuracy equivalents.

### 7.2 Geometry structure

WZDx `RoadEventFeature.geometry` allows:

- `LineString`
- `MultiPoint`

It does not allow `Point` or `MultiLineString` in the reviewed v4.2 road-event schema.

### 7.3 Directional fields

WZDx provides structured direction through `properties.core_details.direction`. The official core details definition describes this as the impacted road's digitization/travel-flow direction based on U.S. road naming, such as northbound.

### 7.4 Lane fields

WZDx lane-level structure is available through `properties.lanes[]` on a work-zone road event. Each lane can include:

- `order`
- `type`
- `status`
- optional `restrictions[]`
- deprecated `lane_number`

Lane status enumerations include `open`, `closed`, `shift-left`, `shift-right`, `merge-left`, `merge-right`, and `alternating-flow`. Lane type enumerations include `general`, `exit-lane`, `exit-ramp`, `entrance-lane`, `entrance-ramp`, `shoulder`, and other non-general lane categories.

### 7.5 Restriction fields

WZDx supports road-level and lane-level `restrictions[]`, where each restriction has:

- `type`
- optional `value`
- `unit` when a value is present

Restriction types include truck, width, height, length, weight, parking, local-access, passing, and oversize-load constraints.

### 7.6 Closure / impact fields

WZDx `vehicle_impact` provides structured construction impact classification, including:

- `all-lanes-closed`
- `some-lanes-closed`
- `all-lanes-open`
- `alternating-one-way`
- merge-left / merge-right impacts
- shift-left / shift-right impacts
- split impacts
- `flagging`
- `temporary-traffic-signal`
- `unknown`

This is substantially more actionable than a generic standard-feed `condition = Construction` label.

### 7.7 Metadata fields

WZDx feed and event metadata include:

- Feed info / publisher/contact/source metadata.
- `data_source_id` on core details.
- `creation_date` and `update_date` on core details.
- `related_road_events` for sequencing/relationship between events.
- `start_date`, `end_date`, and verification flags.
- `is_start_position_verified` and `is_end_position_verified`.
- `work_zone_type`, `location_method`, `worker_presence`, `types_of_work`, and reduced speed limit when applicable.

### 7.8 What WZDx provides that standard conditions normalization does not

| Capability | Standard Gridly normalized model | WZDx model value |
| --- | --- | --- |
| Construction-only feed | Construction is mixed with all conditions and counted heuristically. | Feed is construction-only per DriveTexas docs. |
| Native work-zone schema | Generic `condition` + description + flags. | Work-zone road event model. |
| Structured lane impact | Not retained. | `lanes[]`, lane status/type/order. |
| Vehicle impact | Not retained. | Explicit `vehicle_impact`. |
| Road/lane restrictions | Not retained. | `restrictions[]`. |
| Verified date/position flags | Not retained. | Verification booleans / accuracy equivalents. |
| Work type | Not retained. | `types_of_work[]`. |
| Worker presence | Not retained. | `worker_presence`. |
| Mileposts/cross streets | `from_limit` / `to_limit` are retained only as strings. | Beginning/ending cross street and milepost fields. |
| Related events | Not retained. | `related_road_events`. |

## 8. Lane-Level Intelligence Review

| Source/capability | Classification | Evidence / example |
| --- | --- | --- |
| Standard DriveTexas `description` text | C. Free text only | Descriptions can mention lane closures, maintenance, ramps, shoulders, or detours, but current Gridly handling does not parse lane structure. |
| Standard DriveTexas `condition` | B/C. Semi-structured to free text | `condition = Construction` or phrases like lane closure/work zone can indicate construction, but not lane order/status. |
| Standard DriveTexas `delay_flag` / `detour_flag` | B. Semi-structured | Useful binary impact signals, but not lane-level. |
| Standard DriveTexas `from_limit` / `to_limit` | B. Semi-structured | Strong location/extents signal, not lane-level. |
| WZDx `vehicle_impact` | A. Structured | Encodes all-lanes/some-lanes, merges, shifts, flagging, alternating one-way, temporary signal. |
| WZDx `lanes[]` | A. Structured | Encodes lane `order`, `type`, `status`, and optional lane restrictions. |
| WZDx `restrictions[]` | A. Structured | Encodes width/height/weight/truck/local-access/passing/oversize-load restrictions. |
| WZDx ramps/shoulders | A. Structured if present | Lane `type` supports exit/entrance lane/ramp and shoulder categories. |

Conclusion: lane-level intelligence is **not meaningfully available in Gridly's current normalized standard feed model**, but is **schema-available through WZDx** and should be treated as high-value pending live TxDOT payload sampling.

## 9. TX 146 Special Review

Gridly already treats TX 146 as a local corridor candidate in its TxDOT local focus defaults and community corridor definitions. The local OSM-derived road segment dataset contains TX 146 references, including combined `US 90;TX 146` segments and standalone `TX 146` segments. That makes TX 146 a strong validation corridor for geometry retention because it has overlap/duplex complexity and local routing importance.

| Question | Assessment |
| --- | --- |
| Would geometry retention improve awareness? | Yes — very high. TX 146 includes segments that can overlap or run near US 90 and local roads; retaining LineString geometry would reduce road-name ambiguity. |
| Would construction intelligence improve awareness? | Yes — high. Construction on TX 146 can affect major north/south local movement and can be materially different if it is a shoulder event versus a lane closure. |
| Would lane information improve awareness? | Yes — high. Lane closures, merges, shoulders, and ramp impacts would help distinguish “watch” from “avoid.” |
| Would work-zone information improve awareness? | Yes — very high. Work-zone extents, verified positions, and vehicle impact would make construction alerts more trustworthy. |
| Would retained geometry reduce ambiguity? | Yes — very high. It would distinguish actual TX 146 overlap from nearby or combined-route midpoint matches. |
| Would directional confidence improve? | Yes — high, but should remain internal until validated. `travel_direction`/WZDx direction plus segment bearing can support future directional confidence. |

TX 146 improvement assessment: **Very high value**. TX 146 should be one of the first private validation corridors for V290 because geometry, route extents, and direction would materially improve relevance and reduce false positives.

## 10. TX 321 Special Review

Gridly already treats TX 321 as a local corridor candidate in TxDOT local focus defaults and community corridor definitions. The local OSM-derived road segment dataset contains TX 321 and combined `TX 105 Business;TX 321` references, which creates similar ambiguity risks around route naming, shared alignments, and route-specific alerting.

| Question | Assessment |
| --- | --- |
| Would geometry retention improve awareness? | Yes — high. TX 321 route relevance would be stronger with segment overlap than midpoint proximity. |
| Would construction intelligence improve awareness? | Yes — high. Construction details would help Route Watch and awareness determine whether a TX 321 condition is locally meaningful. |
| Would lane information improve awareness? | Yes — moderate to high. TX 321 may have fewer lane alternatives in some areas, so lane closure details can be decision-critical. |
| Would work-zone information improve awareness? | Yes — high. WZDx work-zone extents and vehicle impact would improve confidence. |
| Would retained geometry reduce ambiguity? | Yes — high. It would separate true TX 321 impact from nearby roads or combined-route references. |
| Would directional confidence improve? | Yes — moderate to high. Directional confidence would improve after validating route segment bearing against TxDOT direction values. |

TX 321 improvement assessment: **High value**. TX 321 is an excellent second validation corridor because it tests a different local movement pattern from TX 146 and includes combined-route naming cases.

## 11. Gridly Value Assessment

Score scale: 0 = no value, 1 = low, 2 = moderate, 3 = high, 4 = very high, 5 = transformational.

| Capability | Score | Rationale |
| --- | ---: | --- |
| Geometry retention | 5 | Transforms TxDOT from approximate point awareness into segment-aware route intelligence. |
| Route extents | 4 | Enables “from/to” trust, affected segment wording, and construction-length estimates. |
| Travel direction | 4 | High future value for directional relevance; should be internal until validation gates pass. |
| Lane closures | 4 | Major construction-alert specificity improvement when WZDx lane arrays are populated. |
| Work zones | 5 | WZDx gives a dedicated road-event model with geometry, impact, lane, restrictions, verification, and metadata. |
| Reference markers | 3 | Useful for linear-reference validation and ambiguity reduction; value depends on feed completeness. |
| Bbox retention | 3 | Strong performance/filtering utility and low conceptual risk; less user-visible by itself. |

## 12. Prioritized Opportunity List

1. **Geometry retention** — Store raw geometry/bbox internally and validate overlap calculations without UI changes.
2. **Route Watch geometry validation** — Compare current midpoint proximity with LineString-vs-route overlap for active routes.
3. **Construction awareness via WZDx feasibility** — Sample live WZDx payloads, map schema to internal audit model, and verify TxDOT population of lane/impact fields.
4. **Route extents and reference markers** — Normalize from/to limits and marker/milepost fields into structured internal references.
5. **Lane intelligence** — Only after WZDx sampling confirms lane arrays are populated often enough to justify product dependence.
6. **Directional confidence gate** — Validate `travel_direction`/WZDx direction against geometry bearing and route direction internally; no display until confidence is proven.
7. **Alert specificity prototype** — Use retained geometry and construction fields to generate internal copy candidates; no production alert changes until language is approved.

## 13. Recommended Next Milestone

Recommended milestone:

**V290 — TxDOT Geometry Retention Prototype**

Recommended V290 boundaries:

- Documentation/prototype only or behind a hard internal audit flag.
- Retain raw `geometry`, `bbox`, route extents, and raw direction fields in an internal model.
- Compare current midpoint proximity against segment overlap for Route Watch routes.
- Include TX 146 and TX 321 as validation corridors.
- Do not implement directional display.
- Do not alter production alerts, hazard popups, Route Watch UI, markers, reporting, Supabase, or awareness systems.
- Treat WZDx as a parallel feasibility track unless/until live payload sampling confirms field population and reliability.

Why not make WZDx integration V290? WZDx is strategically valuable, but geometry retention is the foundational capability required to benefit from both the standard conditions feed and WZDx. Retention also carries less product risk than immediately adding a new feed.

## 14. Final Recommendation

**A. TxDOT geometry and construction intelligence provide major product value and should be prioritized.**

Rationale:

- The standard TxDOT feed already contains materially useful road-event geometry and direction/extent fields that Gridly currently collapses.
- Route Watch currently relies on point/vertex proximity for non-crossing incidents; retained LineString geometry would materially improve relevance and confidence.
- Alerts would become more specific and trustworthy when backed by affected segment extents and construction impact fields.
- WZDx provides the clearest path toward structured construction intelligence, including vehicle impact, lane status, restrictions, verification, and metadata.
- TX 146 and TX 321 are strong local validation corridors because route naming, combined references, and corridor ambiguity make geometry retention immediately useful.

The correct product path is to prioritize internal geometry retention and validation first, then WZDx construction feasibility, then lane/directional capabilities after evidence gates are passed.

## Audit Evidence and Source Notes

- Gridly TxDOT service endpoint template: `js/gridlyTxdotService.js`.
- Gridly standard-feed extraction behavior: GeoJSON features become raw records with `__geometry`.
- Gridly current normalization behavior: LineString midpoint becomes latitude/longitude; selected fields are retained; full geometry and bbox are not normalized.
- Gridly Route Watch relevance behavior: active route comparison currently uses incident point distance to route polyline vertices.
- DriveTexas API documentation reviewed via search result snippets for `/api/conditions.{filetype}`, five-minute refresh guidance, and WZDx endpoint behavior.
- Official WZDx v4.2 schema reviewed from USDOT JPO WZDx repository raw schema/spec files.
- Live terminal fetch attempts for DriveTexas standard and WZDx endpoints were blocked by proxy/CONNECT 403 on 2026-06-13, so no fresh raw payload sample was committed.
