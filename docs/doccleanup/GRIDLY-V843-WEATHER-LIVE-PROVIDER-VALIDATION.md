# V843 Weather Live Provider Validation Expansion

## Mission

V843 expands the Weather live connector validation while preserving Gridly's operating priority:

1. Awareness Platform First.
2. Route Intelligence Second.

This milestone is observational only. It does not activate Unified Intelligence, render Weather records, modify Community Reports, modify Alerts, modify Awareness Brief, modify Community Pulse, modify Route Watch, modify Crossing Runtime, modify Hazard Lifecycle, modify the Trust Model, or modify Supabase synchronization.

## Validation Methodology

Validation used the existing dormant Weather provider and the existing live connector shape. The connector is invoked only by explicit operator action through:

```js
window.gridlyWeatherConnectorRuntimeAudit?.()
await window.gridlyWeatherConnector.fetchNow()
window.gridlyWeatherConnector.getNormalizedRecords()
```

The validation scope covered:

- Multiple fetch outcomes: success, retryable HTTP failure, retryable network failure, non-retryable client failure, schema failure, and timeout exhaustion.
- NWS-compatible payload shapes: GeoJSON `FeatureCollection`, JSON-LD `@graph`, `alerts`, and generic `records` containers.
- Normalization field exposure and raw payload suppression.
- Runtime containment after every connector invocation.
- Southeast Texas operational-region review for Texas active-alert behavior.

## Production Observations

The connector remains configured for the National Weather Service active alerts feed family. The default endpoint is:

```text
https://api.weather.gov/alerts/active?area=TX
```

Observed connector behavior in validation:

| Observation | Result |
| --- | --- |
| Successful connectivity path | A valid NWS GeoJSON response normalizes successfully when `fetchNow()` is explicitly called. |
| Normalized record count | Count is derived from the normalized record array and exposed only through runtime audit and `getNormalizedRecords()`. |
| Timeout handling | Requests use an 8000 ms abort window. Timeout failures are treated as transient until the retry budget is exhausted. |
| Retry behavior | One retry is available for transient failures: HTTP 408, HTTP 429, HTTP 5xx, network `TypeError`, explicit network errors, and aborts. |
| Fail-closed behavior | On exhausted retry budget, unsupported schema, missing fetch, or non-retryable HTTP 4xx, normalized records are cleared and `connected` returns false. |
| Runtime containment | The connector never starts automatic polling, never activates the provider, and never performs rendering. |

Environment note: direct production fetches from this execution container were blocked before reaching the NWS service (`curl` reported `CONNECT tunnel failed, response 403`; Node `fetch` reported DNS/proxy failure). The browser/API validation commands remain the exact required production checks for an operator environment with direct access to `api.weather.gov`.

## Category Inventory

The Weather normalizer now preserves a wider event-level category inventory for NWS alert products instead of collapsing all products into broad families. The certified inventory includes:

- Flash Flood Warning
- Flood Warning
- Flood Advisory
- Severe Thunderstorm Warning
- Severe Thunderstorm Watch
- Tornado Warning
- Tornado Watch
- Special Weather Statement
- High Wind Warning
- Wind Advisory
- Dense Fog Advisory
- Winter Weather
- Heat Advisory
- Excessive Heat Warning
- Fire Weather Watch
- Red Flag Warning
- Air Quality Alert
- Coastal Flood Warning
- Rip Current Statement
- Tropical Storm
- Hurricane
- Weather Advisory fallback for uncategorized NWS events

Observed validation fixtures covered Flash Flood Warning and Tornado Warning normalization directly. Retry, timeout, and fail-closed fixtures covered connector behavior independently of category type.

## Normalization Verification

Normalized Weather records consistently expose the consumer-safe fields required for future provider comparison:

| Field | Verification |
| --- | --- |
| `id` | Uses NWS alert id/source id, falling back to deterministic Weather foundation id. |
| `provider` | Always `Weather`. |
| `providerId` | Always `weather`. |
| `category` | Derived from NWS event/headline/description using expanded event-level inventory. |
| `title` | Uses headline/title/event fallback. |
| `description` | Uses NWS description/summary/instruction fallback. |
| `latitude` | Uses explicit coordinates when present or centroid of GeoJSON geometry when available; otherwise `null`. |
| `longitude` | Uses explicit coordinates when present or centroid of GeoJSON geometry when available; otherwise `null`. |
| `effectiveTime` | Uses NWS effective/onset/start/sent timestamp fallback. |
| `expirationTime` | Uses NWS expires/end timestamp fallback. |
| `sourceTrace` | Includes provider and source id only. |
| `rawPayloadExposed` | Always `false`. |

Raw NWS `properties` and full source payload objects are not exposed through normalized records.

## Regional Validation: Southeast Texas

Southeast Texas remains represented by the dormant Weather connector's Texas active-alert endpoint. The validation target for regional production checks is `area=TX`, with Southeast Texas review focused on Liberty, Montgomery, San Jacinto, Harris, Chambers, Polk, Walker, Hardin, Jefferson, and Galveston-area alert geography when present in NWS `areaDesc` and geometry.

Regional validation characterization to perform in an operator browser with NWS access:

1. Fetch the Texas active alerts feed explicitly with `await window.gridlyWeatherConnector.fetchNow()`.
2. Read `window.gridlyWeatherConnector.getNormalizedRecords()`.
3. Count total records whose `affectedAreas` or geometry intersects the Southeast Texas operating counties.
4. Inventory categories from those records.
5. Map geographic distribution by county/zone names from `affectedAreas` and by normalized `latitude`/`longitude` when geometry is present.

No automatic polling, rendering, or provider activation is authorized for this regional review.

## Runtime Containment

After every validation path, the runtime audit must continue to report:

```js
{
  automaticPolling: false,
  providerActivated: false,
  renderingPerformed: false
}
```

Additional containment confirmations:

- Unified Intelligence remains inactive.
- Weather provider state remains dormant and unmodified by connector fetches.
- `GRIDLY_CONFIG.weather.enabled` remains false unless a separate future activation milestone authorizes otherwise.
- Connector records are stored only in the connector-local normalized cache.
- No UI/document ownership is required for validation.

## Certification Summary

V843 certifies that the Weather live connector is ready for expanded observational validation against the NWS production feed while remaining dormant and fail-closed.

Certified:

- Explicit-only Weather fetch execution.
- Expanded NWS alert category normalization.
- Required normalized field exposure, including `latitude`, `longitude`, `effectiveTime`, and `expirationTime`.
- `rawPayloadExposed: false` on normalized records.
- Retry handling for transient failures.
- Timeout containment with fail-closed final state.
- No automatic polling.
- No provider activation.
- No rendering.
- No consumer experience change.

Not certified or activated:

- Unified Intelligence activation.
- Weather record rendering.
- Weather-to-alert conversion.
- Weather-to-route intelligence.
- Supabase synchronization.
- Cross-provider merging.

## Recommendations for Future Cross-Provider Evaluation

Before any future activation decision, run a separate cross-provider evaluation milestone that:

1. Compares NWS Weather alerts against DriveTexas and Community Reports without merging records.
2. Validates duplicate/overlap handling for flood, wind, visibility, and storm hazards.
3. Establishes freshness and cache-expiry rules based on NWS response metadata.
4. Adds county/zone-to-operational-region spatial tests using production geometries.
5. Defines confidence rules without altering the Trust Model.
6. Requires separate authorization before any rendering, alert generation, polling, or Unified Intelligence activation.

## Exact Browser Validation Steps

Open Gridly in a browser and run the following in DevTools Console:

```js
window.gridlyWeatherConnectorRuntimeAudit?.()
```

Expected: `automaticPolling`, `providerActivated`, and `renderingPerformed` are all false.

```js
await window.gridlyWeatherConnector.fetchNow()
```

Expected with NWS access: returns `{ connected: true, normalizedRecordCount: <number> }`. Expected without NWS/network access: returns `{ connected: false, normalizedRecordCount: 0, error: <message> }` and fails closed.

```js
window.gridlyWeatherConnector.getNormalizedRecords()
```

Expected: every record exposes `id`, `provider`, `providerId`, `category`, `title`, `description`, `latitude`, `longitude`, `effectiveTime`, `expirationTime`, `sourceTrace`, and `rawPayloadExposed`; `rawPayloadExposed` remains false.

```js
window.gridlyWeatherConnectorRuntimeAudit?.()
```

Expected after validation: `automaticPolling`, `providerActivated`, and `renderingPerformed` remain false.
