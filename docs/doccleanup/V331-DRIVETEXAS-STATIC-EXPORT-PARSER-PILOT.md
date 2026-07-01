# V331 — DriveTexas Sanctioned Static Export Parser Pilot

## Executive Summary

V331 validates an audit-only parser path for representative DriveTexas-style static exports. The milestone remains intentionally non-production: no live DriveTexas connection, no API calls, no production ingestion, no alerts, no markers, no routing, no map changes, no UI changes, and no Travel Confidence implementation.

The pilot confirms that representative export shapes can be transformed into the V330 shadow-ingestion contract:

Raw Export → Parser → Schema Validation → Normalization → Lifecycle → Trust → Shadow Awareness Incident

The runtime audit entry point is:

```js
window.gridlyDriveTexasStaticExportParserAudit?.()
```

It returns parser availability, version, sample counts, parse failures, schema findings, normalization results, lifecycle results, trust results, geometry results, recommendations, and per-record parser diagnostics.

## Sample Export Review

The pilot uses sanctioned static examples only. The representative shapes are:

- GeoJSON-style feature with `properties` plus `geometry`.
- Flat export row with `globalId`, `condition`, `event_state`, `updated`, `latitude`, and `longitude`.
- Segment row with start/end coordinates.
- Area advisory with roadway/county context but no marker-grade geometry.
- Removed crash record.
- Reopened bridge closure record.

These samples are documentation-derived and fixture-approved structures, not live DriveTexas data.

## Schema Validation

### Required Fields

The parser treats these as required for reliable static-export validation:

- Stable source identifier: `GLOBALID`, `globalId`, `id`, `objectid`, or `OBJECTID`.
- Event type: `event_type`, `condition`, `category`, or `type`.
- Lifecycle status: `status`, `event_state`, or `state`.
- Update timestamp: `last_updated`, `updated`, `updateTime`, or `modified`.

### Optional / Recommended Fields

These fields are not required to parse, but materially improve downstream reliability:

- Title or headline.
- Description/details.
- Roadway or route name.
- County.
- TxDOT district.
- Explicit geometry or coordinates.
- Community active/confirmed counts for trust simulation.

### Missing / Unsupported Findings

The pilot currently reports no unsupported field families. Missing recommended fields are counted by audit output rather than failing the record. This keeps the parser useful for export-shape comparison while ensuring required contract fields remain strict.

## Parser Findings

The parser can read multiple static export styles without remote calls. It supports:

- Top-level records.
- GeoJSON `Feature.properties` records.
- Alternate identifier aliases.
- Alternate event/status/timestamp aliases.
- Explicit `geometry` objects.
- Latitude/longitude coordinate pairs.
- Start/end segment coordinate pairs.
- Roadway-plus-county area records when geometry is absent.

Parser reliability is strongest when records include a stable source ID, explicit event type, explicit lifecycle status, update timestamp, roadway/county context, and marker-grade geometry.

## Normalization Findings

Parsed records are validated against the V330/V326 canonical DriveTexas shadow taxonomy:

- `road_closed`
- `flooded_roadway`
- `high_water`
- `travel_advisory`
- `construction`
- `crash`
- `disabled_vehicle`
- `lane_closure`
- `detour`
- `bridge_closure`
- `other_official`

The parser preserves the normalized type returned by `classifyDriveTexasEvent()` and does not create production incidents.

## Lifecycle Findings

The pilot validates lifecycle interpretation for exported statuses:

- `active`
- `updated`
- `stale`
- `removed`
- `reopened`
- `expired`

Lifecycle status remains schema-driven and audit-only. Removed, expired, and reopened records remain parser evidence only; they do not trigger production behavior.

## Trust Findings

Trust validation remains compatible with V330 trust labels:

- Official Source
- Official Source + Community Active
- Official Source + Community Confirmed
- Stale Official Source

Community counts are accepted only as static sample fields for trust simulation. They do not connect to production community reports and do not alter displayed behavior.

## Geometry Findings

The parser classifies geometry into four quality bands:

1. `explicit_geometry` — official Point or LineString geometry is present.
2. `coordinate_pair` — latitude/longitude fields can produce a Point.
3. `derived_segment` — start/end coordinates can produce a LineString.
4. `road_county_only` — route/county context exists, but no marker-grade coordinates are available.

Minimum future awareness geometry should require one of:

- Official point geometry.
- Official line/segment geometry.
- Latitude/longitude pair.
- Start/end segment coordinates.

Road-and-county-only records may support broad awareness context in a future pilot, but they are not marker-ready and should not be used for routing or placement.

## Risks

- Representative samples may not cover every sanctioned export alias.
- Area-level advisories may be useful for awareness but insufficient for precise placement.
- Static exports may omit removal semantics available in a live feed.
- Timestamp freshness and stale thresholds must be validated against real exported cadence before any non-live ingestion pilot.
- Parser alias flexibility can hide source inconsistency unless export-specific contracts are documented.

## Future Integration Notes

Recommended next milestone: **V332 — DriveTexas Sanctioned Export Bundle Replay Pilot**.

V332 should use a larger approved, non-live export bundle and replay records through the parser over simulated time. It should measure duplicate identity stability, update cadence, lifecycle transitions, geometry completeness, and V330 shadow incident compatibility. It should remain non-production and must not add alerts, markers, routing, map behavior, or Travel Confidence UI.
