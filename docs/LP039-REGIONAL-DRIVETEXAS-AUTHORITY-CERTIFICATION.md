# LP039 — Regional DriveTexas Authority Certification

LP039 is investigation-only. It does not change DriveTexas endpoints, polling, provider activation, connector activation, normalization, markers, alerts, Awareness Brief, Community Pulse, Travel Brief, selected-awareness filtering, county geometry, Houston regionalization, storage, service worker behavior, or consumer copy.

## Source inventory and source path

Active/available code components are `gridlyDriveTexasProvider`, `gridlyDriveTexasConnector`, `gridlyAwarenessOfficialRoadwayPublisherRepair`, `gridlyBuildTravelBriefModel`, and legacy/passive DriveTexas audits in `app.js`. The active endpoint owner in both provider and connector is `https://api.drivetexas.org/api/conditions.geojson?key={api_key}`. The connector owns fetch lifecycle with `fetchNow`, `startPolling`, `stopPolling`, retry, timeout, retained complete records, and derived awareness records. The provider owns raw extraction and normalization. The official roadway publisher reads connector records first, provider records second, and retained last-successful connector records as fallback.

## Normalization contract and field preservation

Preserved fields include provider ID, inferred category, rebuilt title, description/headline text, route/roadway, coordinates, start time, end time, and source trace. Lost or not normalized fields include subtype, status/severity, update time, county, city, district, closure type, lane impact, detour, travel impact, provider URL, complete source metadata, and full line geometry after midpoint selection. Overwritten fields include title, category, and line geometry ownership because category is inferred and title is rebuilt from category plus roadway.

## Geographic ownership

Current production code does not establish selected-awareness DriveTexas authority. Coordinates are used for radius matching. If coordinates are absent, text terms from selected awareness area are matched against record title, description, route, locality, city, county, and affected areas. Certified county geometry, community polygons, Houston child-region polygons, roadway geometry intersection, and map bounds are not used as DriveTexas ownership authority. County text, city text, broad route names, radius, and text matching are fallback/ambiguous evidence, not precise ownership.

## County, community, and Houston certification

Dayton/Liberty, Livingston/Polk, Woodville/Tyler, Pasadena/Harris, Spring Branch, Houston parent, and Houston child regions are all served by the same connector awareness view model. No inspected DriveTexas path proves separate Houston child-region polygon ownership, Pasadena-specific Harris partition ownership, or county/community geometry containment. Countywide mode expands coordinate matching to 35 miles, which can include broad county/nearby records without proving selected-awareness ownership.

## Freshness, lifecycle, and expiration

The connector owns request timestamps, last successful fetch timestamp, source-record update timestamp, derived awareness-view timestamp, and last fetch error. Normalized records preserve start and end times, but the provider does not compute active, expired, stale, future-effective, or missing-timestamp classifications. The publisher has a lifecycle-active gate that excludes obvious cleared/expired/inactive/resolved statuses when present. No final DriveTexas consumer contract distinguishes true quiet from disabled provider, disabled connector, fetch failed, stale retained records, missing timestamps, all records expired, all records outside awareness, or no active selected-area situations.

## Deduplication and situation identity

Provider identity is source ID or generated `drivetexas-foundation-{index}`. The connector retains normalized records and does not deduplicate them into unique consumer situations. The publisher deduplicates additions against existing active hazards using ID/incident/report ID or title/category plus location fallback. Travel Brief consolidates some roadway lines for presentation. These are fragmented deduplication paths, not one situation-identity authority.

## Consumer eligibility and surface owners

There is no shared DriveTexas consumer eligibility contract. Connector inclusion is radius/text fallback. Publisher inclusion adds lifecycle-active filtering and downstream awareness-area filtering. Travel Brief reads connector/provider records through the story transportation connector path. Map markers, marker popups, alert rows, Awareness Brief, Community Pulse, Travel Brief, Know Before You Go, county/community summaries, Houston summaries, top headline/status, quiet state, and mobile condensed cards are presentation or downstream owners; none is certified as the final selected-awareness DriveTexas authority.

## Count ownership

Counts can diverge across raw source records, normalized provider records, retained connector records, awareness connector records, official roadway enrichment, markers, alert rows, Awareness Brief, Community Pulse, Travel Brief, county/community summaries, Houston summaries, compatibility audits, and debug audits. LP039 finds no single final consumer count owner for unique active selected-awareness DriveTexas situations.

## Divergence stage and root causes

The first divergence occurs after endpoint-scope acquisition and provider normalization, when connector awareness derivation filters by coordinate radius or text fallback instead of certified selected-awareness geographic ownership. Supported root causes are `source_scope_mismatch`, `selected_awareness_filter_divergence`, `county_scope_overstatement`, `community_scope_overstatement`, `houston_child_region_overstatement`, `roadway_corridor_overstatement`, `radius_fallback_overstatement`, `text_fallback_overstatement`, `stale_retained_records`, `expiration_owner_missing`, `deduplication_owner_divergence`, `situation_identity_divergence`, `awareness_brief_owner_divergence`, `community_pulse_owner_divergence`, `travel_brief_owner_divergence`, `count_owner_divergence`, `quiet_state_from_missing_data`, `fallback_not_disclosed`, and `mixed_behavior`.

## Authority candidates

A raw DriveTexas records model is rejected because it lacks awareness ownership. Unique normalized provider records preserve provider authority but lack certified geography, freshness, deduplication, and consumer eligibility. Connector-retained records are useful source cache, not selected-area authority. Existing official situations are presentation/enrichment, not authority. Roadway-associated active records are promising but not currently sufficient because roadway geometry ownership is not proven. Existing Awareness Brief/Travel Brief behavior is fragmented. The recommended target is selected-awareness DriveTexas situations after provider normalization, geographic ownership, freshness/lifecycle, deduplication, consumer eligibility, and unique consumer-situation selection.

## Recommended product definition and repair strategy

LP039 accepts the proposed definition only as a target, with one revision: Gridly DriveTexas information for an awareness area should consist of unique, active, authoritative roadway situations whose source geometry, certified roadway/location ownership, or explicitly disclosed fallback evidence establishes selected-awareness impact. This authority is fragmented, not already present. LP039.1 should create a passive selector/authority contract and deterministic certification harness before any production consumer repair. Implementation readiness for LP039.1 is evidence-based and currently false until live source-field semantics and final selector scope are resolved.

## Deterministic test-only fixture coverage

The LP039 regression test includes fixtures for active crash, closure, flooding, construction, lane closure, bridge restriction, travel advisory, duplicate provider ID, expired, stale, missing timestamp, future-effective, outside-awareness, county-only, geometry-owned, roadway-owned, radius fallback, text fallback, same title with distinct IDs, long roadway crossing areas, Houston parent, Houston child, Pasadena, Spring Branch, Dayton, Livingston, Woodville, no loaded records, connector disabled, provider unavailable, fetch failed, and all records filtered outside awareness. Fixtures remain in the test file only and never enter production runtime state.

## Known unknowns

Known unknowns include live DriveTexas payload completeness, official update/end timestamp semantics, full marker and alert deduplication under live data, and the eventual Houston child-region roadway/polygon authority design.
