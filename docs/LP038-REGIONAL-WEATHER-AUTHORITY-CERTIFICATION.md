# LP038 — Regional Weather Authority Certification

## 1. Scope
LP038 is an investigation-and-certification-only review of Gridly weather ownership across the configured operational county registry, configured awareness communities, Houston-wide parent mode, and Houston child-region configuration. Static source review was performed for all configured areas; runtime certification is limited to already-loaded weather state exposed by passive helpers.

## 2. Non-goals
LP038 does not repair production weather behavior, source loading, filtering, copy, severity logic, alerts, markers, reporting, Route Watch, crossings, roadway runtime, county geometry, DriveTexas, onboarding, settings, Supabase, service worker, Capacitor packaging, or Houston regionalization.

## 3. Weather source inventory
Active weather source code consists of `gridlyWeatherProvider`, `gridlyWeatherLiveConnector`, and `gridlyWeatherConnectorEndpointAudit`. The provider default endpoint is `https://api.weather.gov/alerts/active?area=TX`, so the certified active external source is the National Weather Service / api.weather.gov active-alert feed. The endpoint audit also documents the Atom/CAP family as an alternate reference path. Development/test payloads may be injected into the provider `refresh({ payload })` path.

No active production source was found for point forecasts, forecast grids, forecast zones, observation stations, browser-geolocation weather, precipitation observations, temperature, wind, or visibility. Those products are therefore not certified as selected-area local weather in LP038.

## 4. Current-condition ownership
Current Conditions is not backed by a certified active observation adapter in the reviewed source inventory. There is no certified observation station, station coordinate, station freshness owner, or station-to-community containment contract. Any consumer current-condition claim would be `unknown` or `not_observed` unless a future runtime sample proves otherwise.

## 5. Forecast ownership
Forecast ownership is not certified. No active point-forecast, gridpoint, zone-forecast, or county-zone forecast adapter was found in the active weather path. Forecast copy cannot be certified as community-local from the current architecture.

## 6. Weather-alert ownership
Weather alerts are first owned by NWS provider records, then by Gridly provider normalization, then by the live connector when activated. The provider normalizes FeatureCollection features, alert-like arrays, and injected records into Gridly weather records with category, title, description, severity, affected areas, effective/expiration timestamps, coordinates inferred from explicit fields or geometry centroid, and source trace.

The live connector fetches the configured endpoint, normalizes records, keeps travel-impacting events, and filters by active awareness area using coordinate distance or text-term matching. This is not the same as certified selected-area polygon, NWS zone, county-zone, or Houston child-region intersection.

## 7. Freshness ownership
The provider records alert effective/expiration fields and a provider `lastRefresh`. The connector records `lastRequestAt`, request success, error state, normalized record count, and retry behavior. There is no certified consumer freshness authority for stale/current wording, and no active staleness threshold model for displayed weather.

## 8. Locality precision model
LP038 classifies weather precision as: exact selected area, polygon-intersecting selected area, countywide, forecast-zone-wide, nearby station, nearby area, regional, statewide, or unknown. Current active alert data starts as statewide NWS feed records; connector filtering can make records awareness-relevant by radius or text, but not yet certified as exact community or Houston-region ownership.

## 9. Quiet-state truth model
A quiet state can mean no loaded records, provider disabled, connector fetch failed, records filtered out, stale or missing data, or genuinely no active selected-area alerts. LP038 cannot certify “no weather issues” as truthful when it is caused by disabled provider state, missing runtime samples, stale data, or failed fetch.

## 10. Fallback inventory
Observed or potential fallback classes are: injected provider payloads for tests, empty normalized store after disabled/failure paths, text-term matching when coordinates are missing, radius matching when exact geometry is absent, active selected awareness area, home-town awareness anchor if selected awareness is unavailable, provider records when connector records are unavailable in official situation building, and generic quiet/empty states. No fallback is currently exposed as a locality disclaimer.

## 11. Count and summary owners
Raw alert count means loaded normalized weather records. Unique provider alert count means unique normalized IDs/source IDs. Selected-awareness alert count means connector-retained weather records when the connector is loaded. Unique consumer weather situation count is not separately modeled and currently can only approximate provider IDs. Awareness Brief weather evidence is generated when story input includes meaningful weather records. Travel Brief official situations can consume weather connector/provider records. Community Pulse weather ownership is not independently certified.

## 12. County certification summary
The runtime county registry currently exposes 26 operational/production-enabled counties in static source, while the mission text references 28 operational counties. LP038 reports the static code truth rather than fabricating two additional runtime-tested counties. All county modes are statically certified as having available county awareness configuration and county boundary paths where configured, but weather locality remains not certified beyond statewide-feed-to-runtime-filter behavior.

## 13. Community certification summary
Configured communities are statically enumerated from each county's `defaultAwarenessAreas`. Community weather ownership is not certified as exact local ownership because current weather alerts use statewide NWS active-alert source records filtered by radius/text, and current conditions/forecasts are not backed by active local adapters.

## 14. Houston certification
Houston-wide parent mode exists through Harris County / Houston awareness configuration. Houston child regions exist through LP035.1 region configuration and are available as selected awareness areas. Weather does not have a separate Houston weather behavior. Broad Harris or statewide alerts can appear across multiple Houston regions unless LP038.1 adds polygon/zone/certified ownership and deduplication. Pasadena remains a separate Harris community and should not be treated as a Houston child region.

## 15. Spring Branch findings
Spring Branch is represented as the Houston child region `houston-spring-branch` with seed 29.8044, -95.5200. No current-condition station or forecast point was certified for Spring Branch. Active alerts, when loaded, are included by connector radius/text matching rather than certified polygon/zone intersection. Current UI, Awareness Brief, Community Pulse, and Travel Brief may disagree because they do not share a single selected-awareness weather-situation authority. Locality wording is not certified as supported; fallback is not observed.

## 16. Dayton findings
Dayton is a configured Liberty County community. No local current-condition station or forecast point is certified. Alert inclusion can be radius/text based if active weather is loaded. Dayton-local wording is not certified unless future authority proves provider geometry/zone/station ownership for Dayton.

## 17. Livingston findings
Livingston is a configured Polk County community. No local current-condition station or forecast point is certified. Alert inclusion can be radius/text based if active weather is loaded. Livingston-local wording is not certified without a future selected-awareness authority.

## 18. Pasadena findings
Pasadena is a separately owned Harris awareness community, not a Houston child region. No local current-condition station or forecast point is certified. Harris-wide or Houston-region weather must not be presented as specifically Pasadena-owned unless LP038.1 proves intersection or certified ownership.

## 19. Ownership divergence
The first divergence stage is selected-awareness filtering. Source records start as NWS/statewide alert records; normalization preserves alert semantics but not selected-area ownership. The live connector then narrows records by travel-impacting classification and coordinate radius/text matching, which can lose or overstate locality precision.

## 20. Root-cause classifications
Findings map to: `source_scope_mismatch`, `selected_awareness_filter_missing`, `observation_station_distance`, `forecast_zone_overstatement`, `quiet_state_from_missing_data`, `fallback_not_disclosed`, `ui_count_owner_divergence`, `awareness_brief_owner_divergence`, `community_pulse_owner_divergence`, `travel_brief_owner_divergence`, and `mixed_behavior`.

## 21. Recommended weather authority
Option A, raw runtime weather records, is simple but weak for locality, freshness, duplicates, and trust. Option B, unique provider alerts plus latest selected observation, improves duplicate handling but still lacks selected-area geometry. Option C, selected-awareness weather situations after geographic ownership, freshness, and consumer eligibility, best supports locality truth, deduplication, runtime consistency, consumer trust, Texas scalability, and multi-state scalability, but requires implementation work. Option D, existing Awareness Brief weather model, is consumer-facing but downstream and incomplete as an authority. Option E, existing connector-retained weather records, is available but currently depends on radius/text matching rather than certified ownership.

LP038 recommends Option C as the product authority to design, not as a completed production repair.

## 22. Recommended product definition
The candidate definition is supported as a target, not by current production behavior: “Gridly weather for an awareness area consists of the freshest authoritative observation or forecast context applicable to that area, plus unique active weather situations whose polygons, zones, or certified geographic ownership intersect the selected awareness area.”

## 23. Recommended repair sequence
LP038.1 should add a weather authority layer; define alert polygon/zone/county ownership order; add current-condition and forecast source contracts; define freshness/stale/failed states; deduplicate provider alerts into consumer situations; expose fallback locality; and route Current UI, Awareness Brief, Community Pulse, Travel Brief, and Alerts through one certified count owner.

## 24. Whether LP038.1 is required
LP038.1 is required. `implementationReadyForLp0381` remains false in the passive helper because the audit identifies the desired authority and repair scope but does not supply live runtime samples for every county/community/region and does not implement the authority.

## Regional certification matrix summary
Every configured county/community/Houston region is returned by `window.gridlyLp038RegionalWeatherAuthorityCertificationAudit?.()` with static certification rows. Runtime count fields are marked `runtime_loaded_sample_only`, `not_observed`, or `unavailable_in_current_session` when data has not already been loaded.

## Browser validation
Load Gridly without starting weather polling, then run `window.gridlyLp038RegionalWeatherAuthorityCertificationAudit?.()` in DevTools. Expected invariants are `passive: true`, `noWrites: true`, `noStorageWrites: true`, `noRuntimeActivation: true`, `noMapMovement: true`, `noNetworkMutations: true`, all production weather/alert change flags false, and `implementationReadyForLp0381: false`.
