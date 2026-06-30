# GRIDLY V836 — Official Provider Source Evaluation

## Quick Summary

V836 certifies the official upstream source strategy for the dormant DriveTexas and Weather providers. This is documentation and readiness only: no live service connection, no provider activation, no runtime rendering, and no consumer-facing system modification is authorized.

Gridly remains **Awareness Platform First** and **Route Intelligence Second**. Official provider data should enrich awareness context only after a later connector milestone implements isolated fetch, normalization, and fail-closed controls.

## Provider Source Certification

| Provider | Recommended source | Confidence | Integration complexity | Operational risks |
|---|---|---:|---|---|
| DriveTexas | TxDOT DriveTexas / TxDOT ITS road-condition and travel-impact services | High | Medium | Public endpoint shape and usage terms must be reverified at connector implementation; category labels may vary by feed/layer; rate/caching expectations must be respected; statewide records must be spatially filtered before Gridly consumption. |
| Weather | National Weather Service CAP / `api.weather.gov` active alerts | Very High | Low-to-Medium | NWS API requires cache-friendly polling and identifies clients through User-Agent; alert geometry and county/zone relationships need careful normalization; watches/advisories must not be over-promoted to warnings. |

## DriveTexas Official Source Evaluation

| Field | Evaluation |
|---|---|
| Official source name | DriveTexas / TxDOT ITS road-condition and travel-impact data |
| Official owner | Texas Department of Transportation (TxDOT) |
| Public availability | Public traveler-information website and public-facing map/service ecosystem; connector milestone must verify the specific production endpoint before implementation. |
| Access method | Expected ArcGIS Feature Service / REST / GeoJSON-style feature access depending on official feed selected for connector implementation. |
| Authentication requirements | Treat as unknown until connector implementation; do not assume no-key access. Any API key or token must remain server-side or build-time protected and must not be placed in browser runtime. |
| Licensing / usage considerations | TxDOT terms, disclaimer, attribution, redistribution, and caching requirements must be reviewed before production connector implementation. |
| Refresh recommendations | 2–5 minute polling for active incidents/closures after confirming official cache guidance; never more aggressive than source guidance; include backoff on failures. |
| Geographic coverage | Texas statewide roadway and traveler-information coverage, with Gridly connector filtering to supported operational counties/corridors. |
| Event categories available | Road closures, flooding/high water, construction/maintenance, lane closures, crashes/incidents, restrictions, advisories/detours. |
| Expected Gridly mapping | Normalize into existing dormant categories: Road Closure, Flooding, Construction, Lane Closure, Crash, Bridge Restriction, Travel Advisory. |

## Weather Official Source Evaluation

| Field | Evaluation |
|---|---|
| Official source name | National Weather Service CAP alerts and `api.weather.gov` active alerts |
| Official owner | NOAA National Weather Service (NWS) |
| Public availability | Public API and CAP alert products for watches, warnings, advisories, and related products. |
| Access method | REST JSON-LD via `https://api.weather.gov/alerts/active` and CAP v1.2 products where needed. |
| Authentication requirements | No API key expected; connector must provide a descriptive User-Agent/contact and respect NWS cache/rate guidance. |
| Licensing / usage considerations | Use official NWS/NOAA attribution and redistribution guidance; preserve alert identifiers, timestamps, severity, urgency, certainty, and source trace. |
| Refresh recommendations | Cache-aware polling no faster than official guidance; recommended 60–120 seconds for county/zone alert awareness unless cache headers require slower refresh. |
| Geographic coverage | United States NWS alert coverage; Gridly connector should filter to Texas counties/points/zones relevant to active Gridly communities. |
| Alert categories available | Warnings, watches, advisories, statements, and special weather products including flash flood, flood, severe thunderstorm, tornado, tropical, hurricane, fog, wind, winter, heat, fire weather, and air quality products. |
| Expected Gridly mapping | Normalize warning/advisory event names into existing dormant weather categories without activating rendering. |

## Provider Mapping Tables

### DriveTexas

| Official/source category or text | Gridly normalized category |
|---|---|
| Road Closure / Closed / Road Closed | Road Closure |
| Flooding / High Water / Water Over Roadway | Flooding |
| Construction / Maintenance / Work Zone | Construction |
| Lane Closure / Lane Blocked / Shoulder Closure | Lane Closure |
| Crash / Accident / Collision | Crash |
| Bridge Restriction / Weight Restriction / Height Restriction | Bridge Restriction |
| Detour / Travel Alert / Road Condition Advisory | Travel Advisory |

### Weather

| Official NWS alert event | Gridly normalized category |
|---|---|
| Flash Flood Warning | Flash Flood Warning |
| Flood Warning | Flood Warning |
| Severe Thunderstorm Warning | Severe Thunderstorm Warning |
| Tornado Warning | Tornado Warning |
| Tropical Storm Warning / Watch | Tropical Storm |
| Hurricane Warning / Watch | Hurricane |
| Dense Fog Advisory | Dense Fog |
| High Wind Warning / Wind Advisory | High Wind |
| Winter Storm Warning / Winter Weather Advisory / Ice Storm Warning | Winter Weather |
| Extreme Heat Warning / Excessive Heat Warning / Heat Advisory | Extreme Heat |
| Red Flag Warning / Fire Weather Watch | Fire Weather |
| Air Quality Alert | Air Quality |

## Connector Requirements

| Requirement | DriveTexas connector | Weather connector |
|---|---|---|
| Refresh cadence | Start at 2–5 minutes, then tune to official cache/rate guidance. | Start at 60–120 seconds or cache-header-expiry, whichever is slower. |
| Timeout policy | 4-second request timeout; connector returns empty normalized set on timeout. | 4-second request timeout; connector returns empty normalized set on timeout. |
| Retry policy | One retry with jittered backoff only after transient network/5xx failures. | One retry with jittered backoff only after transient network/5xx failures. |
| Fail-closed behavior | Do not render stale or partial official records; preserve existing community awareness behavior. | Do not render stale or partial official records; preserve existing community awareness behavior. |
| Normalization responsibility | Connector owns raw-to-normalized category mapping, source trace, spatial filter, and raw payload suppression. | Connector owns event-name mapping, severity/urgency/certainty preservation, county/zone filtering, source trace, and raw payload suppression. |
| Provider ownership boundaries | Provider supplies normalized read-only records only; it does not own Community Reports, Alerts, Route Watch, trust, lifecycle, notifications, Supabase, or UI. | Provider supplies normalized read-only records only; it does not own Community Reports, Alerts, Awareness Brief, Community Pulse, trust, lifecycle, notifications, Supabase, or UI. |

## Runtime Protection Statement

V836 does not connect to DriveTexas or NWS, does not download external data during runtime, does not activate the dormant providers, does not modify Unified Intelligence behavior, does not render incidents, and does not change protected consumer systems.

## Merge Recommendation

Merge V836 as a source-certification and connector-readiness milestone. The next milestone should be a connector architecture/implementation gate that revalidates official endpoint terms immediately before any code path can perform network access.

## Exact Browser Validation Commands

```js
window.gridlyOfficialProviderSourceAudit?.()
```

Expected readiness shape:

```js
{
  audit: "Official Provider Source Evaluation",
  driveTexasSourceCertified: true,
  weatherSourceCertified: true,
  runtimeIntegrationPerformed: false,
  providerActivationPerformed: false,
  connectorImplementationRequired: true,
  readyForConnectorMilestone: true
}
```
