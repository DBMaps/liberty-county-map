# V325 — TxDOT DriveTexas Flood / Road Condition Integration Design

## Executive Summary

V325 defines a future architecture and product model for integrating TxDOT DriveTexas road-condition and flood-related data into Gridly. This milestone is design-only: it does not add production code, API calls, live ingestion, UI changes, routing changes, map behavior, alerts, route intelligence, or Travel Confidence implementation.

The recommended direction is to treat DriveTexas as Gridly's first official roadway-condition candidate because it is road-specific, Texas-wide, and aligned with the V323 flood-awareness principle that Gridly should remain an **awareness platform first** and **route intelligence second**. DriveTexas should not turn Gridly into a weather forecasting product. It should supply official road-condition evidence that coexists with community reports, rail crossings, hazards, flood awareness, and future Travel Confidence.

The core recommendation is an **evidence ownership model**: official TxDOT incidents and community reports remain separate source records, while Gridly creates a derived, user-facing awareness incident only after normalization, deduplication, trust labeling, and lifecycle evaluation. Official data should be authoritative for the fact that TxDOT published a condition, but it should not automatically suppress nearby community observations unless the community report is clearly duplicate, stale, or unsafe to present.

## Inputs and Constraints

### Prior findings used

- V323 recommends flood awareness as a mobility hazard layer, not a forecast layer.
- V323 identifies DriveTexas as the highest-priority statewide official road-condition candidate for Texas flood awareness.
- V323 emphasizes driver-actionable conditions: flooded roads, high water, impassable locations, flood-related closures, and official warning areas that materially reduce travel confidence.
- V288/V289 establish that the existing DriveTexas conditions feed conceptually includes route identity, event condition, direction, route limits, timing, county, delay/detour flags, description, and geometry, while WZDx is construction-specific.

### Non-goals honored

- No DriveTexas API calls.
- No live data ingestion.
- No production code.
- No UI, map, routing, alert, route intelligence, or Travel Confidence implementation.

## Event Taxonomy Mapping

DriveTexas events should be filtered by whether they are driver-actionable in Gridly's awareness model. The first implementation should focus on events that affect passability, immediate safety, or route confidence. Construction-only detail can be staged later unless it includes closures, detours, or severe lane impact.

### Inclusion decision table

| DriveTexas event / condition | V325 decision | Gridly canonical concept | Rationale |
|---|---:|---|---|
| Flooded roadway | Include | `flooded_roadway` | Directly matches Gridly flood awareness and driver passability concerns. |
| High water | Include | `flooded_roadway` or `high_water` evidence subtype | Mobility-critical; should reduce confidence even if closure is not declared. |
| Road closed | Include | `road_closed` | Strong official passability signal. |
| Road closed due to flooding | Include | `flood_closure` | Highest-priority flood condition because it combines official closure and flood cause. |
| Bridge closure | Include | `road_closed` with `structure=bridge` | High-impact network interruption; relevant to awareness and confidence. |
| Detour | Include | `detour` or `closure_with_detour` | Useful official mitigation signal; should not become turn-by-turn routing. |
| Travel advisory | Include | `travel_advisory` | Useful official caution context without implying closure. |
| Crash / accident | Include | `crash` | Existing Gridly hazard class; relevant to awareness and confidence. |
| Disabled vehicle | Include | `disabled_vehicle` | Existing hazard class; relevant when location is specific and current. |
| Lane closure | Future consideration | `lane_closure` / `construction` | Valuable when structured enough to affect confidence; avoid overinvesting before geometry and lifecycle are validated. |
| Construction closure | Include when closure/detour-impacting; otherwise future | `construction` or `road_closed` | Closures matter immediately; routine construction is lower priority. |
| Construction / maintenance | Future consideration | `construction` | Better handled after WZDx review if structured lane/work-zone semantics are needed. |
| Debris / damage | Include if exposed | `road_hazard` | Driver-actionable hazard if DriveTexas provides it. |
| Ice / winter weather road condition | Future consideration | `weather_road_condition` | Potentially valuable, but outside V325 flood-first focus. |
| Congestion / traffic delay only | Future consideration | `traffic_backup` or confidence context | Use only if official event-specific, not generic traffic speed. |
| Cameras / signs / static assets | Exclude | None | Not incidents; may be future context, not awareness events. |
| Forecast weather / radar / precipitation | Exclude | None | Outside Gridly's Know Before You Go roadway-condition scope. |

### Recommended DriveTexas-to-Gridly mapping

| DriveTexas source concept | Normalized Gridly incident type | Evidence subtype | Suggested severity | Notes |
|---|---|---|---|---|
| Road Closed | `road_closed` | `official_closure` | High / Critical | Preserve official source, affected route, limits, direction, start/end times, and description. |
| Flooded Roadway | `flooded_roadway` | `official_flooded_roadway` | High | Driver copy should avoid forecasting language and focus on water over roadway. |
| High Water | `flooded_roadway` | `official_high_water` | Moderate / High | If no closure exists, present as caution or avoid-area depending on recency and corroboration. |
| Road Closed Due To Flooding | `flood_closure` | `official_flood_closure` | Critical | Highest-priority flood event; can also satisfy road-closed awareness. |
| Travel Advisory | `travel_advisory` | `official_advisory` | Low / Moderate | Advisory does not prove a specific road is impassable. |
| Crash / Accident | `crash` | `official_crash` | Moderate / High | Deduplicate with community crash reports by route, geometry, and time. |
| Disabled Vehicle | `disabled_vehicle` | `official_disabled_vehicle` | Low / Moderate | Aggressive expiration if no official end time. |
| Lane Closure | `lane_closure` | `official_lane_closure` | Low / Moderate | Later milestone unless paired with road closure, detour, or major delay. |
| Construction Closure | `construction` or `road_closed` | `official_work_zone_closure` | Moderate / High | Closure state should outrank generic construction classification. |
| Construction / Maintenance | `construction` | `official_work_zone` | Low / Moderate | Prefer WZDx for future structured lane semantics. |
| Bridge Closure | `road_closed` | `official_bridge_closure` | High / Critical | Add bridge/structure context if source supports it. |
| Detour | `detour` | `official_detour` | Moderate | Present as official context, not route guidance. |

## Official Source Ownership Model

### Recommended model: source-separated evidence with derived awareness incidents

Gridly should not overwrite community reports with official records or collapse all evidence into a single mutable source. Instead, future architecture should use three layers:

1. **Source records** — immutable or append-only normalized records from DriveTexas and community reports.
2. **Evidence clusters** — internal grouping by road segment, geometry overlap, time window, direction, route name, and incident type.
3. **User-facing awareness incident** — derived presentation object with canonical type, severity, lifecycle state, trust labels, and supporting evidence counts.

### Ownership recommendations by scenario

| Scenario | Recommended ownership | Presentation behavior |
|---|---|---|
| Community only | Community owns the report evidence. | Show as community-reported with normal community lifecycle and confidence rules. |
| Official only | DriveTexas owns official source evidence. | Show as official source if active and not stale. Do not require community confirmation. |
| Official + Community match | Keep separate records; derive one combined incident. | Show official source plus community confirmed when reports match within distance, segment, type, and time rules. |
| Official contradicted by community | Keep official active; attach disagreement evidence. | Do not remove official incident because of community contradiction. Show community disagreement only after product/legal review. |
| Community contradicted by official | Keep community report unless stale, duplicate, or unsafe. | Do not label as false solely because no official record exists. Consider lower confidence or needs-confirmation state. |
| Duplicate official and community records | Preserve both as evidence; render one incident. | Avoid duplicate markers/cards by clustering and source labels. |
| Official closure with community “road open” report | Official remains authoritative for published closure. | Treat community report as possible receded/changed condition; require repeated recent confirmations before reducing severity. |
| Community flooded-road report with no official record | Community remains valuable. | Present as community-reported flooding; avoid implying official confirmation. |

### Ownership principles

- Official DriveTexas data is authoritative for TxDOT-published conditions on TxDOT-maintained roadways.
- Official data is not exhaustive for city, county, private, or neighborhood roads.
- Community reports are first-class evidence for localized, fast-changing conditions.
- Absence of an official incident must not be presented as proof that a road is clear.
- Conflicting evidence should reduce certainty, not silently delete one side.

## Trust Presentation Framework

Future labels should communicate source and recency without overclaiming precision.

| Label | Recommended use | Avoid |
|---|---|---|
| Community Reported | One or more active community reports without official confirmation. | Do not imply the condition is verified. |
| Community Confirmed | Multiple consistent community reports or a trusted confirmation workflow. | Do not use for a single unverified report. |
| Official Source | Active DriveTexas incident. | Do not imply Gridly independently verified the condition. |
| Official + Community Confirmed | Official incident with matching recent community evidence. | Do not use when reports are merely nearby but unrelated. |
| Recently Updated | Official or community evidence updated within a short freshness window. | Do not use if only the app refreshed stale data. |
| Stale / Check Official Source | Official incident passed freshness threshold but has not expired. | Do not hide critical closures solely because they are stale. |
| Conflicting Reports | Future consideration after policy review. | Avoid confusing or liability-heavy copy in first release. |

### Recommended first-release trust labels

1. `Official Source`
2. `Community Reported`
3. `Official + Community Confirmed`
4. `Recently Updated`
5. `Stale — Check Official Source`

## Lifecycle Recommendations

Lifecycle rules should be conservative for safety-critical closures and aggressive for fast-changing hazards such as high water or disabled vehicles.

### Common lifecycle states

| State | Meaning | User-facing behavior |
|---|---|---|
| Active | Source says the incident is current or start time has passed and no end/removal condition applies. | Eligible for display and confidence impact. |
| Scheduled | Source start time is in the future. | Future consideration; do not display as active hazard. |
| Recently updated | Source update/create time is within freshness window. | Can receive recency label. |
| Stale | Incident has not expired but update age exceeds type-specific threshold. | Show with caution label or lower confidence in source freshness. |
| Expired | End time passed or source removed after a reconciliation window. | Hide from default awareness views. |
| Suppressed duplicate | Same event represented by stronger cluster. | Do not render separately, but retain as evidence. |

### Type-specific recommendations

| Incident class | Active when | Stale when | Expire / hide when | Notes |
|---|---|---|---|---|
| Flood closure | Official source says closed or closure start time has arrived. | No update for 2–4 hours during active weather/flood context; 6–12 hours otherwise. | Official end time passes, source removes record after reconciliation, or official status changes to open. | Do not auto-clear solely from community “open” report. |
| Flooded roadway / high water | Official source says flooding/high water active. | No update for 1–2 hours. | End time passes, source removal persists, or receded/cleared status is official. | Fast-changing; stale label is important. |
| Road closure non-flood | Official active closure. | No update for 6–12 hours unless end time exists. | End time passes or official removal persists. | Construction closures may be long-lived. |
| Construction closure | Start time active and closure/detour impact present. | No update for 24 hours, unless near end time. | End time passes or official removal persists. | Use scheduled state for future closures. |
| Routine construction / lane closure | Start time active. | No update for 24–48 hours. | End time passes or source removal persists. | Lower first-release priority. |
| Travel advisory | Advisory active. | No update for 2–6 hours depending on hazard type. | End time passes or source removal persists. | Advisory should reduce confidence less than closure. |
| Crash | Official active. | No update for 30–90 minutes. | Source removal persists or end time passes. | Avoid stale crash clutter. |
| Disabled vehicle | Official active. | No update for 30–60 minutes. | Source removal persists or end time passes. | Aggressive TTL. |
| Detour | Active when tied to closure/construction. | Inherits parent incident. | Hide when parent expires. | Do not present as routing instruction. |

## Flood Awareness Integration

DriveTexas should support flood awareness as official road-condition evidence, not weather prediction.

### Recommended flood classifications

| Future Gridly class | DriveTexas evidence | Consumer meaning | Confidence impact candidate |
|---|---|---|---|
| `flood_closure` | Road closed + flooding/high-water cause or description | Road is officially closed due to flooding. | Very Low / Avoid for affected segment. |
| `flooded_roadway` | Flooded roadway condition | Water is reported on/over the roadway. | Low or Very Low depending on closure and corroboration. |
| `high_water` evidence subtype | High water condition/advisory | Water may affect travel; passability may be uncertain. | Moderate to Low. |
| `official_flood_advisory` | Travel advisory mentioning flooding/high water | Use caution; official flood-related context exists. | Moderate. |
| `low_water_crossing_context` | Known crossing inventory, not DriveTexas incident by itself | Location may be flood-prone, but not currently flooded. | Background risk only; no active incident unless paired with reports. |

### Integration rules

- Use DriveTexas flood/closure records as the strongest road-specific official flood source.
- Do not use DriveTexas advisory text to imply a specific low-water crossing is flooded unless the incident geometry or description supports it.
- Keep low-water crossing awareness separate from active flooding; a known crossing is risk context, not a live hazard.
- Community flood reports can corroborate official high-water records and can fill coverage gaps on non-state roads.
- Flood copy should use mobility language: “water over roadway,” “road closed due to flooding,” and “use caution.”

## Travel Confidence Considerations

This section is architecture-only. V325 does not implement Travel Confidence.

Future Travel Confidence should consume official incidents as weighted evidence, not as routing commands. Official incidents should reduce confidence based on severity, proximity/overlap with the watched route, freshness, geometry confidence, and corroboration.

| Future confidence level | Official-source conditions that could contribute |
|---|---|
| High | No active official or community hazard evidence overlapping the route; only stale/irrelevant advisories. |
| Moderate | Official travel advisory nearby, minor lane closure, distant high-water context, or unconfirmed community report near route. |
| Low | Official high water/flooded roadway near or overlapping route, active crash with route impact, closure near route, or multiple community reports. |
| Very Low | Official road closed, official flood closure, bridge closure, confirmed water over roadway on route, or official + community confirmed severe hazard. |

### Guardrails

- Do not automatically reroute users.
- Do not claim a route is safe because DriveTexas has no incident.
- Treat official road closure as a strong avoid/low-confidence signal for the affected segment.
- Treat travel advisories as confidence reducers, not closure proof.
- Degrade confidence less when geometry is point-only or route overlap is uncertain.

## User Experience Examples

These are future copy examples only and should not be implemented in V325.

### Official flood closure

- Title: `Road Closed`
- Badges: `Official Source`, `Recently Updated`
- Body: `US 90 closed due to flooding. Check official conditions before travel.`
- Confidence context: `Very Low for affected segment.`

### Official + community flooded roadway

- Title: `Flooded Roadway`
- Badges: `Official Source`, `Community Confirmed`
- Body: `Multiple reports indicate water over the roadway near this location.`
- Confidence context: `Low to Very Low depending on route overlap.`

### Travel advisory

- Title: `Travel Advisory`
- Badges: `Official Source`
- Body: `High water reported. Use caution and check official conditions.`
- Confidence context: `Moderate to Low depending on proximity.`

### Community-only flood report

- Title: `Flooded Roadway`
- Badges: `Community Reported`
- Body: `Water over roadway reported by the community. Not officially confirmed.`
- Confidence context: `Moderate to Low if recent and near route.`

### Official closure with possible community disagreement

- Title: `Road Closed`
- Badges: `Official Source`
- Body: `Official closure remains active. Recent community reports may indicate changing conditions.`
- Confidence context: `Very Low until official closure clears or policy-approved confirmation rules are met.`

## Risks & Constraints

### Data reliability risks

- DriveTexas may not cover county, city, private, or neighborhood roads.
- Human-entered official incidents may lag rapidly changing flood conditions.
- Descriptions may be inconsistent or too broad for precise consumer copy.
- Geometry may vary by condition type and may not always map cleanly to a Gridly route segment.

### Duplicate incident risks

- The same closure may appear as a road closure, flood condition, detour, and community report.
- Midpoint-only rendering can create duplicate-looking incidents for long segments.
- Route aliases and frontage roads can cause false matches.

### Community disagreement risks

- A user may report “clear” while an official closure remains active.
- A user may report flooding before TxDOT publishes a condition.
- Contradiction labels can confuse users or create liability concerns.

### Expiration risks

- Auto-expiring flood conditions too quickly can hide dangerous water.
- Keeping stale high-water reports too long can reduce trust.
- Construction closures require longer lifecycle windows than crashes or disabled vehicles.

### Trust risks

- “Official Source” can be misread as a real-time guarantee.
- “Community Confirmed” can be misread as professional verification.
- Absence of official data can be misread as an all-clear unless copy is careful.

### Attribution requirements

- Future implementation must preserve source attribution and any TxDOT/DriveTexas terms required by API approval.
- Consumer copy should identify official-source status without implying endorsement by TxDOT unless terms explicitly permit it.
- Raw source timestamps and update timestamps should be retained for auditability.

## Recommended Future Architecture

### Future data flow

```text
DriveTexas source feed
  -> Official source adapter
  -> Raw source record store
  -> Normalization layer
  -> Gridly official incident evidence
  -> Deduplication / clustering layer
  -> Derived awareness incident
  -> Future UI / alerts / Travel Confidence consumers

Community reports
  -> Community report store
  -> Community evidence normalization
  -> Deduplication / clustering layer
  -> Derived awareness incident
```

### Recommended canonical record fields

| Field group | Examples |
|---|---|
| Source identity | `source=txdot_drivetexas`, source event id, source URL/reference, attribution label. |
| Event taxonomy | original condition, normalized type, evidence subtype, severity candidate. |
| Location | route name, roadway, from/to limits, county, direction, geometry, bbox, midpoint fallback. |
| Timing | start time, end time, create time, update/refresh time, first seen, last seen. |
| Impact | closure flag, detour flag, delay flag, lane impact if available. |
| Lifecycle | active/stale/expired state, stale reason, expiration reason. |
| Trust | official/community source labels, corroboration status, conflict status. |
| Audit | raw property snapshot or hashed raw reference, normalization version, parser version. |

### Recommended future milestones after V325

1. **DriveTexas source contract review** — verify API terms, attribution, keys, allowed caching, rate limits, and display requirements without production ingestion.
2. **Sanctioned sample payload audit** — use an approved key or exported payload to enumerate actual event conditions, fields, and lifecycle behavior.
3. **Official incident normalization prototype** — non-production parser that maps conditions into Gridly canonical evidence and validates geometry handling.
4. **Deduplication design prototype** — cluster official and community reports without changing UI.
5. **Flood-first shadow mode** — log would-be official flood closures/high-water incidents without consumer display.
6. **Trust-label UX review** — validate labels, disclaimers, and attribution before UI work.
7. **Travel Confidence design integration** — consume official evidence as a confidence reducer only after normalization and dedupe are proven.

## Recommended First Implementation Candidate After V325

The recommended next implementation candidate is a **non-production DriveTexas flood/closure shadow normalizer**.

Scope should be limited to:

- Official flood closure.
- Official flooded roadway / high water.
- Official road closure.
- Official travel advisory when flood/high-water-related.
- Source attribution, timestamps, route identity, geometry preservation, lifecycle state, and dedupe keys.

It should not display incidents to users, change alerts, change routes, or affect Travel Confidence. Its purpose should be to validate source contracts, event mapping, stale/expiration rules, and official/community coexistence before any consumer-facing integration.
