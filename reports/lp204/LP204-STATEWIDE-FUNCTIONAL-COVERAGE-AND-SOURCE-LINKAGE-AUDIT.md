# LP204 — Statewide Functional Coverage and Source Linkage Audit

> Audit-only, deterministic repository assessment. No production runtime or provider was changed.

## Executive summary

- **DriveTexas is not statewide operational.** Its statewide endpoint adapter is present but disabled by default; all-county county/PLACE ownership and consumer behavior are not certified.
- **Weather is not statewide as a complete function.** NWS alerts have an inactive Texas feed adapter. Observations/current conditions, point/grid forecasts, and derived metrics are not integrated.
- **Reports are statewide-capable but uncertified.** Canonical county/FIPS and PLACE metadata exist, while deployed Supabase policies, legacy rows, and live statewide round trips remain outside repository proof.
- **Road geometry is not statewide:** 28/254 counties are in the active runtime manifest.
- **Route Watch is not statewide-ready** because roadway, DriveTexas, and weather dependencies are incomplete.
- Crossings, county resolution, PLACE/CDP geography, and destination/location search are the certified statewide foundations.

## System matrix

| System | Classification | Consumer-capable counties | Runtime | Consumer path | Primary gap |
|---|---|---:|---|---|---|
| DriveTexas | SOURCE_PRESENT_RUNTIME_INACTIVE | 0/254 | DISABLED_BY_DEFAULT | yes | Provider defaults disabled and requires an API key; no repository evidence certifies deterministic county/PLACE ownership for all live records. |
| NWS weather alerts | SOURCE_PRESENT_RUNTIME_INACTIVE | 0/254 | DISABLED_BY_DEFAULT | yes | Texas-wide feed adapter exists but defaults disabled; ownership mixes polygon/zone/county text/radius and lacks all-county consumer certification. |
| Current weather / observations | MISSING | 0/254 | NOT_IMPLEMENTED | no/NA | No observation provider or station owner is integrated. |
| Point/grid forecast | MISSING | 0/254 | NOT_IMPLEMENTED | no/NA | Point/grid/zone adapter declarations exist, but no forecast source is available or integrated. |
| Weather metrics (temperature/precipitation/wind/visibility) | MISSING | 0/254 | NOT_IMPLEMENTED | no/NA | No live current-condition or grid-forecast pipeline supplies these metrics. |
| Community reports / hazards / Supabase | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Code carries county/FIPS and blocks cross-county reads, but repository evidence cannot certify deployed Supabase policies, legacy rows, or live round trips in every county. |
| County boundary / location resolution | STATEWIDE_CERTIFIED | 254/254 | ACTIVE | yes | No functional gap found. |
| PLACE/CDP awareness geography | STATEWIDE_CERTIFIED | 254/254 | ACTIVE | yes | Polygon-aware source ownership by external providers remains provider-specific. |
| Railroad crossings | STATEWIDE_CERTIFIED | 254/254 | ACTIVE | yes | No gap; positive control is 202 ACTIVE_POSITIVE, 52 ACTIVE_EMPTY, and 16,099 identities. |
| Road geometry / roadway names | LEGACY_COHORT_ONLY | 28/254 | ACTIVE | yes | Only 28/254 counties have manifest entries; 226 lack roadway geometry, nearest-road, and normalized road-name certification. |
| Hazard placement / reporting geography | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | County and PLACE ownership are statewide; exact road association is unavailable in 226 counties and live Supabase round trips are uncertified. |
| Awareness Brief | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Crossings and report geography are statewide, but disabled/absent DriveTexas and weather can make aggregate quiet-state completeness uncertified. |
| Community Pulse | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Statewide report filtering exists, but dominant-corridor output depends on 28-county road geometry and unavailable official sources. |
| Travel Brief | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Required DriveTexas/weather inputs are inactive or missing and road geometry covers only 28 counties. |
| Alerts / alert cards | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Consumer surface exists, but DriveTexas/weather alert owners are inactive and unified all-source county/PLACE behavior is not certified. |
| Route Watch | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Location and crossings are statewide; road geometry is 28-county-only and DriveTexas/weather dependencies are not active/certified. |
| Destination / location search | STATEWIDE_CERTIFIED | 254/254 | ACTIVE | yes | No county/PLACE/ZIP reachability gap found; free-form geocoder behavior remains external. |
| Saved places / home personalization | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | County/PLACE-capable storage exists, but multi-county PLACE restoration and live startup behavior lack a single statewide certification artifact. |
| Directional intelligence | INTENTIONALLY_INACTIVE | 0/254 | INTENTIONALLY_PAUSED | no/NA | Paused by product direction; do not treat absent NB/SB/EB/WB UI as a defect. |
| Notification preferences | STATEWIDE_PRESENT_BUT_UNCERTIFIED | 254/254 | ACTIVE | yes | Preference storage is not delivery certification. |
| Local/browser notification delivery | SOURCE_PRESENT_RUNTIME_INACTIVE | 0/254 | NOT_CERTIFIED_ACTIVE | no/NA | API capability is not evidence of active statewide alert delivery. |
| Push/background alert delivery | MISSING | 0/254 | NOT_IMPLEMENTED | no/NA | No certified push service, device-token pipeline, or background delivery infrastructure. |

## DriveTexas

The provider declares the statewide DriveTexas GeoJSON endpoint, normalizes provider geometry, retains a last-successful cache, and refilters it on awareness-area changes. It defaults to disabled and the API key is not repository configuration. Its ownership path can use provider geometry, point/radius, and text evidence, but there is no deterministic 254-county/1,859-PLACE accounting. Classification: **SOURCE_PRESENT_RUNTIME_INACTIVE**.

## Weather

- **NWS alerts:** **SOURCE_PRESENT_RUNTIME_INACTIVE**. The Texas feed exists; polygon, zone/county text, and radius ownership paths are mixed and uncertified statewide.
- **Current conditions/observations:** **MISSING**. Adapter placeholders explicitly report no source, station owner, or integration.
- **Point/grid forecast and zones:** **MISSING**. Adapter placeholders exist, but source availability and integration are false.
- **Temperature, precipitation, wind, visibility:** **MISSING** as live consumer data because neither observations nor grid forecast is integrated.

## Reports / Supabase

Submission code derives canonical county ID/FIPS from governed polygons and adds nearest governed PLACE identity. Read containment rejects cross-county records and county-scoped local persistence exists. This is **STATEWIDE_PRESENT_BUT_UNCERTIFIED**, not certified: repository code cannot prove deployed RLS/policies, historical rows without identity, or live remote round trips for every county.

## Road geometry / hazard placement

The production manifest contains **28/254** county sources. The other **226** counties resolve to a missing/blocked road source. Hazard county and PLACE placement is statewide-capable, but exact nearest-road association is unavailable outside that cohort.

## Awareness, Travel, Community Pulse, and alerts

These are composed consumer systems and are **STATEWIDE_PRESENT_BUT_UNCERTIFIED**. Crossings and geography are sound, but inactive DriveTexas/NWS alerts, missing weather products, and the roadway cohort prevent dependency-level certification. The P0 correctness risk is presenting aggregate “quiet” without clearly communicating unavailable upstreams.

## Route Watch

Location resolution and crossing inclusion are statewide. Road geometry is 28-county-only; DriveTexas is inactive; weather products are inactive/missing. Classification: **STATEWIDE_PRESENT_BUT_UNCERTIFIED**, not statewide-ready.

## Legacy cohort findings

1. **Active blocker:** the 28-entry roadway runtime manifest controls live source resolution.
2. **Harmless compatibility:** Liberty/Houston/Bexar awareness seeds remain, but runtime appends governed county-wide definitions.
3. **Historical/inactive:** regional directional assets do not control production because the feature is intentionally paused.

## County matrix summary

- Evaluated: **254**
- Fully functional under the complete LP204 dependency bar: **0**
- Partially functional (road cohort present, other gaps remain): **28**
- Materially missing at least roadway geometry plus weather/official inputs: **226**

Status codes: CERT+/CERT0 = certified positive/intentional-empty; CERT = certified; UNCERT = present but uncertified; INACTIVE = source adapter inactive; MISSING = absent; NO_ROAD = geographic placement works without roadway association.

## Classification counts

- STATEWIDE_CERTIFIED: **4**
- STATEWIDE_PRESENT_BUT_UNCERTIFIED: **9**
- STATEWIDE_SOURCE_PRESENT_NOT_GEO_LINKED: **0**
- STATEWIDE_GEO_LINKED_NOT_CONSUMER_CONNECTED: **0**
- REGIONAL_ONLY: **0**
- LEGACY_COHORT_ONLY: **1**
- SOURCE_PRESENT_RUNTIME_INACTIVE: **3**
- INTENTIONALLY_INACTIVE: **1**
- MISSING: **4**
- UNRESOLVED: **0**

## Dependency graph

- **Awareness Brief** → Community reports → Railroad crossings → DriveTexas → NWS weather alerts → trust/freshness
- **Community Pulse** → Community reports → road geometry → active county/PLACE
- **Travel Brief** → DriveTexas → weather → reports → crossings → destination context
- **Route Watch** → location resolution → road geometry → crossings → DriveTexas → weather → reports → alerts
- **Alerts** → source ownership → active county/PLACE → reports → crossings → DriveTexas → weather

## Priority gaps

- **P0:** Prevent aggregate Awareness/Travel/Alert quiet states from implying all-source quiet while DriveTexas/weather are inactive or missing.
- **P1:** Provide and certify roadway geometry for the 226 counties absent from the runtime manifest.
- **P1:** Implement current observations, point/grid forecasts, and temperature/precipitation/wind/visibility consumer pipelines.
- **P2:** Activate only through a separately authorized milestone and certify DriveTexas and NWS-alert county/PLACE ownership statewide.
- **P2:** Validate deployed Supabase policies, legacy row ownership, and submit/read/clear round trips across representative statewide counties.
- **P3:** Certify saved-place multi-county restoration and composed Route Watch/Brief/Alert refresh behavior.
- **P4:** Keep directional intelligence and push/background delivery deferred until explicitly authorized.

## Evidence limits and merge recommendation

This audit proves repository-controlled configuration and code paths, not production network availability, Supabase deployment state, external API credentials, device delivery, or a live record in every county. The evidence is safe to merge because only audit builder, tests, package scripts, and generated LP204 reports change; it does not authorize activation or repair.
