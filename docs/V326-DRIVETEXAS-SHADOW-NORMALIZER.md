# V326 — DriveTexas Flood / Closure Shadow Normalizer

## Executive Summary

V326 creates Gridly's first official-source roadway event normalization layer for future DriveTexas integration. It is a shadow architecture milestone only: no DriveTexas calls, no live ingestion, no production data dependency, no UI, no map markers, no alerts, no routing, and no Travel Confidence implementation.

The purpose is to teach Gridly how to translate representative DriveTexas-style official roadway events into recommended Gridly canonical incident types before any real integration occurs:

> Official Event → Gridly Canonical Incident Type

This keeps Gridly aligned with the mission: **Awareness Platform First, Route Intelligence Second**. Official roadway records should eventually become trusted awareness evidence, not automatic routing commands.

## Canonical Event Taxonomy

These canonical types are recommendations, not permanently locked mappings. Future DriveTexas field review, API terms, observed source values, and product policy may refine names or lifecycle rules.

| Canonical type | Purpose | Meaning | User value | Future UI usage |
|---|---|---|---|---|
| `road_closed` | Represent an official full roadway closure. | A roadway, bridge, ramp, or segment is closed to normal travel. | Identifies a high-impact passability issue from an official source. | Closure badge, avoid-area awareness copy, severe route-confidence evidence. |
| `flooded_roadway` | Represent official evidence of water on or over a roadway. | Roadway affected by flooding, standing water, or water-over-road language without necessarily declaring closure. | Warns users that passability may be reduced even before a closure appears. | Flood awareness card, official water-over-road label, high confidence-impact evidence. |
| `high_water` | Represent official high-water conditions. | High or rising water near a roadway, with uncertain passability. | Encourages caution where roadway conditions can change quickly. | High-water caution label and moderate/high Travel Confidence reducer. |
| `travel_advisory` | Represent official cautionary roadway guidance. | Advisory context without proof that a road is impassable. | Adds official context without overclaiming severity. | Advisory chip, narrative context, low/moderate confidence-impact evidence. |
| `construction` | Represent work-zone or maintenance activity. | Construction, maintenance, or work-zone activity; closure status should be preserved separately. | Distinguishes planned work from acute hazards. | Construction badge, planned-work narrative, lower-priority confidence evidence. |
| `crash` | Represent official crash or accident evidence. | Crash affecting a roadway location or segment. | Helps users understand short-lived disruptions. | Crash marker/card in a future integration with aggressive expiration. |
| `disabled_vehicle` | Represent an official disabled-vehicle incident. | Disabled vehicle with potential roadway impact. | Adds awareness for localized temporary disruption. | Disabled-vehicle incident type with short stale and expiration windows. |
| `lane_closure` | Represent official partial lane restrictions. | One or more lanes are closed while the road may remain passable. | Explains delay or reduced capacity without implying full closure. | Lane-closure chip and low/moderate confidence-impact evidence. |
| `detour` | Represent official detour context. | Official detour associated with a closure, construction zone, or advisory. | Signals alternate official movement without Gridly routing users. | Detour context label attached to parent incident. |
| `bridge_closure` | Represent bridge-specific closure evidence. | A bridge or structure is officially closed or impassable. | Highlights network-critical closures. | Bridge closure badge and severe confidence-impact evidence. |
| `other_official` | Preserve unmapped official events safely. | Official event exists, but Gridly has not assigned a specific type. | Allows review without inventing unsupported semantics. | Audit queue and taxonomy refinement. |

## Mapping Table

| DriveTexas-style source event | Recommended Gridly type | Confidence | Flood-related | Travel Confidence impact | Notes |
|---|---|---:|---:|---|---|
| Road Closed | `road_closed` | High | No, unless flood language is present | Severe | Strong official passability signal. |
| Flooded Roadway | `flooded_roadway` | High | Yes | High | Directly supports flood awareness. |
| High Water | `high_water` | High | Yes | High | Fast-changing condition; stale handling matters. |
| Travel Advisory | `travel_advisory` | Medium | Only when text says flood/high water | Moderate | Caution context, not closure proof. |
| Construction Closure | `construction` or `road_closed` | Medium/High | No | Moderate/Severe | Closure terms should outrank generic construction in future refinement. |
| Crash | `crash` | High | No | Moderate | Short-lived, aggressive expiration. |
| Disabled Vehicle | `disabled_vehicle` | High | No | Low | Localized, temporary disruption. |
| Lane Closure | `lane_closure` | High | No | Moderate | Reduced capacity, not full impassability. |
| Detour | `detour` | Medium | Inherits parent if applicable | Moderate | Context only; not routing. |
| Bridge Closed | `bridge_closure` | High | No, unless flood language is present | Severe | Network-critical structure closure. |
| Unknown official event | `other_official` | Low | No | None | Preserve for audit and review. |

## Trust Framework

Recommended trust labels are architecture-only. They should communicate source and recency without implying Gridly independently verified conditions.

| Trust label | Recommended use |
|---|---|
| Official Source | Active official DriveTexas-style record with no matching community confirmation requirement. |
| Official Source + Community Confirmed | Official record has matching recent community evidence by type, segment, geometry, and time window. |
| Official Source + Community Active | Official record and nearby community activity both exist, but exact confirmation is not yet proven. |
| Stale Official Source | Official record remains present but has exceeded type-specific freshness thresholds. |

Trust guardrails:

- Official source means the condition was published by the official source; it does not mean Gridly independently inspected the roadway.
- Absence of an official event must not be presented as proof that a road is clear.
- Community reports should remain first-class evidence, especially on non-state or local roads.
- Contradictions should reduce certainty or trigger review, not silently delete official/community evidence.

## Lifecycle Framework

Lifecycle recommendations remain shadow-only and should be refined after observing actual DriveTexas event fields.

| Lifecycle class | Activation | Refresh / stale threshold | Expiration | Closure handling |
|---|---|---|---|---|
| Flood closure | Official closure starts or status says closed with flood/high-water context. | Stale after 2–4 hours during active weather; 6–12 hours otherwise. | Official reopen/end time/source removal after reconciliation. | Do not auto-clear solely from one community “open” report. |
| Flooded roadway / high water | Official flood/high-water condition is active. | Stale after 1–2 hours. | Official clear/end/source removal after reconciliation. | If later changed to closure, normalize as closure with flood context. |
| Non-flood road closure | Official closure is active. | Stale after 6–12 hours unless schedule/end time is known. | Official reopen/end/removal. | Closure semantics should outrank generic event class. |
| Construction / planned work | Start time active and work-zone impact exists. | Stale after 24 hours; 24–48 hours for routine lane work. | End time passes or source removal persists. | Construction closure may map to `road_closed` plus work-zone context later. |
| Travel advisory | Advisory is current. | Stale after 2–6 hours depending on hazard type. | End time passes or source removal persists. | Advisory does not prove a segment is closed. |
| Crash | Official crash is active. | Stale after 30–90 minutes. | End time/source removal after short reconciliation. | Avoid stale crash clutter. |
| Disabled vehicle | Official disabled vehicle is active. | Stale after 30–60 minutes. | End time/source removal after short reconciliation. | Aggressive TTL. |
| Detour | Parent event is active. | Inherits parent lifecycle. | Expires with parent. | Present as context only, never route guidance. |

## Travel Confidence Framework

This milestone does not implement Travel Confidence. It only recommends future impact categories for a Travel Confidence consumer.

| Impact | Types / conditions |
|---|---|
| None | `other_official` when unmapped or informational only. |
| Low | `disabled_vehicle` and minor localized official events. |
| Moderate | `travel_advisory`, `construction`, `crash`, `lane_closure`, `detour`. |
| High | `flooded_roadway`, `high_water`. |
| Severe | `road_closed`, `bridge_closure`, flood closure combinations. |

Guardrails:

- Do not automatically reroute users.
- Do not claim a route is safe because DriveTexas has no incident.
- Treat official closures as strong avoid/very-low-confidence evidence for affected segments.
- Treat advisories as caution signals, not closure proof.
- Degrade confidence less when geometry is uncertain.

## Sample Mappings

The shadow helper `classifyDriveTexasEvent()` accepts representative DriveTexas-style event text/object data and returns:

```js
{
  normalizedGridlyType,
  confidence,
  trustLabel,
  lifecycleClass,
  floodRelated,
  travelConfidenceImpact,
  reason
}
```

Example outputs:

| Input | Output type | Reason summary |
|---|---|---|
| `{ eventType: "Road Closed" }` | `road_closed` | Closure language is a strong official passability signal. |
| `{ eventType: "Flooded Roadway" }` | `flooded_roadway` | Directly supports flood awareness. |
| `{ eventType: "High Water" }` | `high_water` | High water is flood-related and fast-changing. |
| `{ eventType: "Travel Advisory" }` | `travel_advisory` | Advisory is official caution context, not proof of impassability. |
| `{ eventType: "Construction Closure" }` | `construction` | Work-zone language remains distinct until a future source field proves full closure semantics. |
| `{ eventType: "Crash" }` | `crash` | Official crash events are short-lived roadway disruptions. |
| `{ eventType: "Disabled Vehicle" }` | `disabled_vehicle` | Localized official incident with short freshness windows. |
| `{ eventType: "Lane Closure" }` | `lane_closure` | Partial restriction language reduces capacity without implying full impassability. |

## Audit

V326 exposes an audit-only helper:

```js
window.gridlyDriveTexasShadowNormalizerAudit?.()
```

Expected audit characteristics:

- `available: true`
- versioned V326 response
- sample mappings present
- canonical types present
- confidence summary present
- lifecycle, trust, and Travel Confidence recommendations present
- no production behavior changes

## Risks

- **Source vocabulary drift:** Actual DriveTexas event labels may differ from representative terms.
- **Precedence ambiguity:** Phrases like “Lane Closure” and “Construction Closure” contain closure language but do not always mean full road closure.
- **Geometry uncertainty:** Point-only or descriptive route limits may reduce future confidence in route overlap.
- **Lifecycle uncertainty:** Official update cadence must be measured before final stale thresholds are locked.
- **Coverage gaps:** Official data may not cover all county, city, private, or neighborhood roads.
- **Overclaiming risk:** UI copy must avoid implying DriveTexas absence means safe travel.

## Future Integration Notes

Recommended next milestones:

1. **DriveTexas source vocabulary fixture review** — collect non-live representative samples and refine matching precedence without production ingestion.
2. **Official/community evidence clustering design** — define how official records and community reports coexist without overwriting each other.
3. **Geometry and route-limit normalization prototype** — shadow-only handling for points, lines, route limits, direction, county, and affected segment confidence.
4. **Lifecycle simulation fixtures** — test stale/expired/reopened behavior using static examples only.
5. **Travel Confidence consumer design** — consume normalized official evidence as weighted confidence input, not routing behavior.

## Non-Goals Confirmed

V326 does not call DriveTexas, ingest live data, create alerts, create markers, create flood layers, create map overlays, modify routing, implement Travel Confidence, change production UI, or add production data dependencies.
