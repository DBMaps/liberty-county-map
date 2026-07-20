# LP034 — Consumer Road Context Completion

## Complete ownership chain

LP034 follows roadway detail from coordinate resolution through the consumer surfaces without changing the LP031/LP032 runtime, roadway packages, manifests, Supabase assets, cache architecture, bounded queue, or county-switching behavior.

| Stage | Owner | Incoming fields | Outgoing fields | LP034 result |
| --- | --- | --- | --- | --- |
| Coordinate | Report / provider coordinate | `lat`, `lng` | Same coordinate | Preserved. |
| Nearest Road | Roadway runtime resolver | Coordinate | `resolvedRoadName` / nearest road | Preserved through canonical road context. |
| Nearby Road | Roadway pair resolver | Coordinate + primary road | `secondaryRoad` candidate | Preserved when a distinct road exists. |
| Primary Road | Canonical road context | Runtime or trusted record fields | `primaryRoad`, `resolvedRoadName` | Preserved. |
| Secondary Road | Canonical road context | Nearby-road pair / structured context | `secondaryRoad` | Preserved. |
| Intersection | Canonical road context | Distinct road pair | `intersectionLabel`, `resolvedIntersection` | Preserved. |
| Structured Metadata | Report metadata | `canonicalRoadContext` plus display labels | Structured metadata object | Owner remains metadata evidence. |
| Normalized Report | `normalizeReports` | Structured metadata and raw row fields | `primaryRoad`, `secondaryRoad`, `roadName`, `nearestRoad`, `intersectionLabel`, `resolvedIntersection`, `canonicalRoadContext` | **Repaired.** |
| Canonical Incident | LP023 / LP025 canonical road context | Normalized report fields | `canonicalRoadContext`, `consumerLocation` | Preserved by shared consumer contract. |
| Consumer Adapters | LP023 | Canonical road context | Adapter-specific `displayLocation` | Preserved; no extra roadway scans per renderer. |
| Alerts | Alert card consumer model | LP023 `consumerLocation` | `locationLine` | Preserved. |
| Hazard Popups | LP023 community adapter | LP023 `displayLocation` | Popup location line | Preserved. |
| Official Popups / DriveTexas | LP023 official adapter | Provider fields + canonical road context | Roadway-preferred `displayLocation`; provider text retained as evidence | **Repaired.** |
| Travel Brief | Existing Travel Brief builders | Active alert / awareness models | Builder-owned wording | Audit exposes availability; no speculative wording changes. |
| Know Before You Go / Community Pulse | Existing awareness builders | Active awareness / alert models | Builder-owned wording | Audit exposes availability; no speculative wording changes. |

## Repaired boundaries

### Structured Metadata → Normalized Report

Before LP034, structured metadata could contain strong roadway ownership, but normalized reports did not explicitly carry the road pair and canonical road-context object forward. That made later canonical incidents and consumer adapters rely on weaker location labels or coordinate lookup.

After LP034, `normalizeReports` extracts `canonicalRoadContext` from structured metadata and persists primary road, secondary road, road name, nearest road, intersection label, resolved intersection, and the canonical context object. This preserves examples such as **US 90 and Waco Street** when metadata already owns that detail.

### DriveTexas Official Adapter label selection

Before LP034, the official adapter selected provider geographic prose before checking roadway-derived context. That allowed provider descriptions to become the consumer location even when stronger roadway context existed.

After LP034, the official adapter resolves canonical roadway context first and prefers roadway-derived labels. DriveTexas provider prose remains evidence in `_lp023.providerGeographicLocation`, and `_lp023.providerLocationDemotedByRoadContext` records when provider prose was kept as evidence but not promoted to canonical location ownership.

## Remaining boundaries

LP034 intentionally does not claim unconditional pass for Travel Brief, Know Before You Go, or Community Pulse wording. The passive audit reports the first observed detail-loss stage for the active runtime sample instead of inventing PASS values. If those builders are unavailable or do not receive a representative record in the browser session, the audit reports that actual unproven boundary.

## Representative examples

Representative validation should exercise these non-hardcoded patterns across Harris, Liberty, Jefferson, Polk, Montgomery, and one additional external runtime county:

- **US 90 and Waco Street** — proves primary + secondary + intersection survival.
- **FM 1960 near Humble** — proves official or community road + community context does not degrade to county-only wording.
- **1 mile west of Livingston** — proves community-relative fallback remains available only when stronger road context is absent.
- **Reported near Feagin Street** — proves a nearby road/reference survives normalized and consumer-adapter stages.

## Before / after ownership

| Boundary | Before | After |
| --- | --- | --- |
| Structured Metadata → Normalized Report | Strong road context could be present only in metadata/display labels. | Normalized reports expose explicit road fields and `canonicalRoadContext`. |
| DriveTexas provider location | Provider prose could outrank roadway context. | Roadway context is the preferred consumer location; provider prose remains evidence. |
| Crossings | Reviewed crossing labels already outranked generic private/county fallback. | Preserved; LP034 does not overwrite stronger reviewed crossing ownership. |

## Final authoritative ownership model

1. Reviewed crossing labels remain strongest for crossing records.
2. Canonical roadway context owns primary road, secondary road, and intersection when it exists.
3. Normalized reports must carry canonical road context forward rather than flattening it to generic text.
4. LP023 consumer adapters own final surface location contracts.
5. Provider advisory prose is evidence, not canonical location ownership, when stronger roadway context exists.
6. Community/county wording is fallback only when stronger roadway context is genuinely absent.

## Performance observations

LP034 reuses the existing LP025/LP023 canonical context and persists normalized road fields. It does not modify LP031, LP032, package loading, roadway manifests, Supabase assets, bounded caches, bounded queue behavior, county containment, duplicate suppression, or stale request protections. The official adapter still performs one shared canonical context resolution for the record and then reuses that context for rendering.

## Browser audit

Run in the browser console after loading the target county/runtime sample:

```js
window.gridlyLp034ConsumerRoadContextAudit?.()
```

The audit reports availability, active county, dataset state, nearest/primary/secondary/intersection availability, ownership at structured/normalized/canonical/alert/popup/Travel Brief/awareness stages, strongest produced/rendered locations, first detail-loss stage, provider safety, crossing safety, county containment, and certification status.

## Recommended next milestone

Recommended next milestone: browser-run LP034 representative certification with saved console audit outputs for Harris, Liberty, Jefferson, Polk, Montgomery, and one additional external runtime county, including screenshots of Alerts, hazard popups, official popups, Travel Brief, Know Before You Go, and Community Pulse where applicable.
