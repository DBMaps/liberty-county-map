# V838 Weather Connector Endpoint Validation

V838 certifies the official National Weather Service (NWS) endpoint family required for a future Gridly Weather connector. This milestone is endpoint validation, connector architecture, and browser audit visibility only. It performs no runtime networking, makes no live weather requests, activates no provider, and renders no weather alerts.

Gridly remains **Awareness Platform First** and **Route Intelligence Second**.

## Official endpoint validation

| Field | V838 certification |
| --- | --- |
| Primary endpoint | `https://api.weather.gov/alerts/active?area={state}` |
| CAP-compatible endpoint | `https://api.weather.gov/alerts/active.atom?area={state}` |
| Endpoint type | Official NWS HTTPS alerts API for active watches, warnings, advisories, and similar products. |
| Request method | `GET` only in a future activation milestone. |
| Response format | Default alerts API payload is GeoJSON / JSON-LD FeatureCollection. Alert products can also be retrieved through documented GeoJSON, JSON-LD, Atom, and CAP XML representations. |
| Authentication | No API key or OAuth credential is required. Future connector requests must include an identifying User-Agent / contact header required by NWS API guidance. |
| Usage guidance | Use `api.weather.gov` active alert endpoints as the canonical weather-alert source. CAP/Atom access is a compatibility and source-verification path, not a separate provider. |
| Caching expectations | The NWS API is designed to be cache-friendly and expires content based on the information lifecycle. Future connector must honor HTTP cache metadata and avoid aggressive polling. |
| Update frequency | Active alert data is event-driven; V838 certifies no fixed polling interval. Future activation must choose a conservative refresh cadence constrained by NWS cache headers and Gridly fail-closed behavior. |
| Availability expectations | Public operational NWS API endpoint. Future connector must fail closed on endpoint unavailability, schema mismatch, stale cache, spatial uncertainty, or source-policy uncertainty. |

Reference sources reviewed for V838:

- NWS API Web Service documentation: `https://www.weather.gov/documentation/services-web-api`
- NWS Alerts Web Service documentation: `https://www.weather.gov/documentation/services-web-alerts`
- NWS CAP overview: `https://vlab.noaa.gov/web/nws-common-alerting-protocol`
- NWS Service Change Notice examples documenting `https://api.weather.gov/alerts/active.atom?area=<state abbreviation>` as the replacement path for legacy CAP state feeds.

## Endpoint suitability

The official NWS active alerts endpoint is suitable for the future Weather connector because NWS alerts expose event names, severity/urgency/certainty, affected areas, timestamps, geometry/area references, source identifiers, and CAP-compatible alert-product semantics.

| Required category | V838 suitability | Normalization notes |
| --- | --- | --- |
| Flash Flood Warning | Certified | Match NWS `event` / CAP event text to `Flash Flood Warning`. |
| Flood Warning | Certified | Match `Flood Warning` and related flood warning event text without collapsing flash-flood-specific records. |
| Severe Thunderstorm Warning | Certified | Preserve severity, certainty, and affected geometry / zones. |
| Tornado Warning | Certified | Preserve onset/effective/expires and instruction fields for future awareness records. |
| Tropical Storm | Certified | Normalize tropical storm watches/warnings/statements into the tropical-storm category when event text matches. |
| Hurricane | Certified | Normalize hurricane watches/warnings/statements into the hurricane category when event text matches. |
| Dense Fog | Certified | Normalize dense fog advisories/warnings from event/headline text. |
| High Wind | Certified | Normalize high wind warnings/advisories and related wind events. |
| Winter Weather | Certified | Normalize winter weather, snow, ice, freeze, blizzard, and sleet alert events. |
| Extreme Heat | Certified | Normalize extreme/excessive heat warnings, watches, and advisories. |
| Fire Weather | Certified | Normalize fire weather watches and red flag warnings. |
| Air Quality | Certified | Normalize air quality alerts/advisories when distributed as NWS alert products. |

## Connector Specification

| Requirement | V838 specification |
| --- | --- |
| Request method | Future connector uses `GET`; V838 performs no request. |
| Timeout policy | 8,000 ms maximum wall-clock timeout per request attempt in a future activation milestone. |
| Retry policy | At most one retry for transient 5xx, 429, or network timeout responses with jittered backoff. Do not retry 4xx validation, auth/header, policy, schema, unsupported-content, or spatial-filter failures. |
| Cache expectations | Honor NWS HTTP cache headers and retain only short-lived active-alert connector cache entries. V838 creates no cache and performs no runtime fetch. |
| Normalization responsibility | Connector maps NWS Feature `properties` and/or CAP `info` fields into Gridly weather awareness records; raw payloads remain connector-internal and must not be exposed directly to consumer UI. |
| Source tracing | Every normalized record must retain provider (`National Weather Service`), endpoint family, alert id, event name, sent/effective/onset/expires timestamps, source geometry or zone basis, and retrieval timestamp. |
| Spatial filtering | Filter by state, zone, point, or bounding box at the request/connector boundary, then intersect NWS alert geometry or affected zones with Gridly coverage areas before any downstream emission. |
| Fail-closed behavior | Return zero weather records and preserve dormant provider state when networking is disabled, provider activation is absent, endpoint validation fails, response schema changes, cache is stale, spatial filtering is uncertain, or source-policy validation fails. |

## Expected payload and important fields

Future connector implementation should expect an active-alert collection containing alert features whose important fields include:

- `id`: stable source URL/id for source tracing.
- `geometry`: polygon or multipolygon geometry when supplied.
- `properties.@id` / `properties.id`: alert product id.
- `properties.areaDesc`: human-readable affected area description.
- `properties.geocode`: SAME/UGC geography keys for zone/county matching.
- `properties.event`: event name used for category normalization.
- `properties.severity`, `properties.certainty`, `properties.urgency`: priority and confidence indicators.
- `properties.headline`, `properties.description`, `properties.instruction`: human-readable content for future awareness records.
- `properties.sent`, `properties.effective`, `properties.onset`, `properties.expires`, `properties.ends`: lifecycle timestamps.

CAP XML products should map equivalent CAP `alert` and `info` content into the same normalized model if a future milestone authorizes CAP retrieval.

## Normalization mapping

| NWS/CAP source field | Gridly connector responsibility |
| --- | --- |
| `event` / CAP event | Map to one of the certified weather categories or future `Weather Advisory` fallback. |
| `severity`, `urgency`, `certainty` | Preserve as priority metadata; do not invent severity. |
| `headline`, `description`, `instruction` | Store in connector-normalized record fields for downstream awareness use. |
| `areaDesc`, `geocode`, `geometry` | Drive spatial filtering and affected-area summaries. |
| `sent`, `effective`, `onset`, `expires`, `ends` | Populate lifecycle timestamps and cache-validity checks. |
| `id`, `@id`, CAP identifier | Populate source tracing and de-duplication keys. |

## Browser audit

V838 exposes:

```js
window.gridlyWeatherConnectorEndpointAudit?.()
```

Expected audit shape:

```json
{
  "audit": "V838 Weather Connector Endpoint Validation",
  "endpointDocumented": true,
  "endpointValidated": true,
  "authenticationKnown": true,
  "runtimeNetworkingPerformed": false,
  "providerActivated": false,
  "connectorReady": true
}
```

The audit is static and must never call `fetch()`, connect to `api.weather.gov`, connect to CAP feeds, activate the Weather provider, render weather alerts, or modify protected systems.

## Operational risks

- NWS schema, headers, or endpoint policies can change; future connector activation must revalidate official documentation immediately before enabling networking.
- Alert geometry may be absent or broad; connector must use geocode/zone fallback and fail closed when spatial confidence is insufficient.
- CAP/Atom and JSON representations may expose equivalent products with different structures; normalization must prove source-id de-duplication before activation.
- Cache headers and alert lifecycles must control refresh cadence; Gridly must not poll aggressively.
- Air quality and specialty products may vary by office and event naming; category mapping must remain explicit and auditable.

## Future connector milestone

A later milestone may implement a dormant connector behind an explicit activation gate. That milestone must separately authorize networking, revalidate NWS documentation, implement cache/header handling, implement schema validation, add source tracing, add spatial filtering, and prove fail-closed behavior before any provider activation or consumer rendering.

## Non-goals certified

V838 does not call `fetch()`, does not connect to `api.weather.gov`, does not connect to CAP feeds, does not activate providers, does not display weather alerts, and does not modify Unified Intelligence, Community Reports, consumer UI, Alerts, Route Watch, Trust, Supabase, Crossing runtime, Reporting, or Community Pulse.
