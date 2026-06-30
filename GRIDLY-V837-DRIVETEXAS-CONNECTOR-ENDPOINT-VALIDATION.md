# V837 DriveTexas Connector Endpoint Validation

## Quick Summary

V837 certifies the official DriveTexas connector endpoint architecture for a future Gridly connector. This milestone documents endpoint suitability, connector behavior, and audit visibility only. It does not activate DriveTexas, does not perform runtime networking, and does not fetch DriveTexas data during normal application execution.

Gridly remains **Awareness Platform First** and **Route Intelligence Second**.

## Official Endpoint

| Field | Certified value |
| --- | --- |
| Endpoint URL | `https://api.drivetexas.org/api/conditions.geojson?key={api_key}` |
| Endpoint type | HTTPS REST API feed |
| Request method | `GET` |
| Response format | GeoJSON `FeatureCollection` road-condition payload |
| Authentication | API key required through the `key` query parameter; key provisioning must be completed with TxDOT/DriveTexas before activation. |
| Usage policy | Use only for TxDOT DriveTexas road-condition awareness on state-maintained Texas roadways; honor TxDOT/DriveTexas terms, attribution, and operational guidance before production use. |
| Rate limits | No public numeric rate limit was certified in V837. Future connector must apply conservative cache and retry limits until TxDOT confirms limits. |
| Update frequency | TxDOT public DriveTexas materials describe information as near real time / as close to real time as possible. No fixed polling interval is certified in V837. |
| Availability expectation | Public DriveTexas traveler-information service. Gridly must fail closed if endpoint, credentials, schema, policy, or availability cannot be verified. |

Reference sources reviewed for V837:

- DriveTexas API root: `https://api.drivetexas.org/`
- TxDOT DriveTexas public traveler information page/archive describing road closures, construction zones, flooding, damage, accidents, and near-real-time operational updates.
- ArcGIS Online public item `DriveTexas_Lines`, item id `d245fe22c72a4e389ebffbd9f3752fcd`, identifying a TxDOT DriveTexas road-conditions service layer for current TxDOT line roadway conditions.

## Endpoint Suitability

The endpoint is suitable for a future connector because the DriveTexas source family is documented around current road conditions on Texas state-maintained roadways and public DriveTexas materials identify these event families:

| Capability | V837 suitability |
| --- | --- |
| Statewide incidents | Supported for statewide DriveTexas awareness scope. |
| Roadway events | Supported through current road-condition features. |
| Closures | Supported. |
| Flooding | Supported. |
| Lane closures | Supported as a roadway-impact category expected by connector normalization. |
| Construction | Supported. |
| Travel advisories | Supported as the fallback awareness category for road-condition notices, detours, delays, and operational advisories. |

## Payload Expectations

The future connector should expect a GeoJSON response shaped like:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point" },
      "properties": {}
    }
  ]
}
```

Expected fields may vary by TxDOT schema version. The connector must tolerate aliases and map fields conservatively.

## Fields Expected

| Gridly concept | Expected source aliases |
| --- | --- |
| Source id | `GLOBALID`, `globalId`, `id`, `event_id`, `eventId` |
| Category/type | `condition`, `event_type`, `eventType`, `type`, `category` |
| Road/route | `route_name`, `routeName`, `roadway`, `road`, `highway` |
| Description | `description`, `summary`, `title`, `headline` |
| Start time | `start_time`, `startTime`, `start`, `beginDate` |
| End time | `end_time`, `endTime`, `end`, `endDate` |
| Geometry | GeoJSON `geometry`, point coordinates, line midpoint, or explicit `latitude`/`longitude` aliases if present |

## Normalization Mapping

| Source signal | Gridly category |
| --- | --- |
| flood, high water, water over roadway, standing water | Flooding |
| closed, closure, blocked, shutdown | Road Closure |
| lane closure, lane blocked, shoulder, left lane, right lane | Lane Closure |
| construction, maintenance, work zone, road work, repair | Construction |
| crash, accident, collision, wreck | Crash |
| bridge, weight limit, height limit, restriction | Bridge Restriction |
| advisory, alert, delay, detour, condition, incident, unclassified event | Travel Advisory |

Normalization remains connector-owned. Consumer UI, alerts, reports, route watch, trust, Supabase, and unified intelligence must not be modified by this milestone.

## Connector Specification

| Requirement | V837 specification |
| --- | --- |
| Request method | `GET` |
| Timeout policy | 8,000 ms connector timeout before fail-closed response. |
| Retry policy | At most one retry for transient 5xx/network timeout responses with jittered backoff; no retry for 4xx/auth/schema failures. |
| Cache expectations | Short-lived connector cache is required; no normal runtime fetch is enabled in V837. |
| Normalization responsibility | Future connector converts GeoJSON features into Gridly awareness records and never exposes raw payloads to consumer UI. |
| Source tracing | Every normalized record must retain provider, endpoint, source id, request timestamp, and source update timestamp when present. |
| Fail-closed behavior | Return no incidents and preserve dormant provider state when endpoint validation, auth, schema validation, cache freshness, or policy checks fail. |

## Browser Audit

V837 exposes:

```js
window.gridlyDriveTexasConnectorEndpointAudit?.()
```

The audit is static and must never perform a network request. Expected result includes:

```json
{
  "audit": "V837 DriveTexas Connector Endpoint Validation",
  "endpointDocumented": true,
  "endpointValidated": true,
  "authenticationKnown": true,
  "runtimeNetworkingPerformed": false,
  "providerActivated": false,
  "connectorReady": true
}
```

## Risks

- Public documentation does not certify a numeric rate limit; future activation must obtain or confirm TxDOT usage guidance.
- API key provisioning is required before production activation.
- GeoJSON property names may change; connector schema validation must support aliases and fail closed on unknown critical shape.
- Availability and incident freshness are source-owned; Gridly must avoid implying guaranteed coverage beyond DriveTexas/TxDOT published scope.

## Future Connector Milestone

A future milestone may implement a dormant connector module behind an explicit activation gate. That milestone must separately authorize networking, secrets handling, cache policy, schema validation, source attribution, monitoring, and fail-closed behavior.
