# LP042 — DriveTexas Connector Awareness Filter Certification

## 1. Executive conclusion

Repository and LP041 live evidence support a mixed root cause: `filterAwarenessRecords(records, awareness)` keeps only records that match either a normalized point/midpoint radius test or a substring text fallback. The provider normalizer reduces `LineString` geometry to one midpoint coordinate before the connector filter runs, and full source line geometry is not available to the production connector filter. LP041 live evidence then showed 739 normalized input records, 0 point-radius matches, 0 text-fallback matches, and 0 connector output records for Dayton.

The safest future architecture is to keep complete normalized source records available to LP039 and treat connector filtering as diagnostic/legacy source-view scoping only. LP042 does not implement that repair.

## 2. Live evidence baseline

LP041 browser validation reported: raw provider features 739, parsed features 739, normalized records 739, complete normalized cache 739, normalization failures 0, connector filter input 739, connector filter output 0, excluded records 739, point-radius matches 0, text-fallback matches 0, US 90 raw diagnostic candidates 14, US 90 normalized candidates 6, US 90 complete-cache candidates 6, US 90 candidates after connector filtering 0, and first disappearance at `connector-awareness-filter`.

Provider inventory from the same validation reported 736 `LineString` features and 3 `MultiLineString` features, with route, timestamp, and provider ID present for all records and county/city/district/limits absent for all records.

## 3. Connector filter decision tree

Function signature: `filterAwarenessRecords(records, awareness)`.

Decision tree:

1. Convert `records` to `[]` unless it is an array.
2. For each normalized record, read `latitude` and `longitude` only.
3. Read awareness `lat`, `lng`, `radiusMiles`, and `countyWide`.
4. Compute `allowedMiles` as `35` for county-wide or missing radius, otherwise `radiusMiles + 2`.
5. Geographic branch succeeds only when record coordinate, awareness anchor, and `getDistanceMiles` are valid and distance is `<= allowedMiles`.
6. Text branch builds `recordText(record)` from title, description, routeName, locality, city, county, and affectedAreas.
7. Text fallback succeeds when any `awareness.textFallbackTerms` substring appears in record text.
8. The returned set is the union of geographic branch and text fallback because the filter delegates the final include decision to `matchesAwarenessArea(record, awareness)`.
9. There is no explicit deduplication in the connector filter. Input order is preserved.
10. Missing awareness, missing anchor, missing distance function, invalid record coordinates, and absent text fail closed unless text fallback independently matches.

Default values and assumptions: no array input becomes empty; missing or non-numeric radius becomes a 35-mile county-style threshold; the connector assumes one normalized point can represent the incident; the connector assumes provider text contains selected awareness words when the point branch fails.

## 4. Awareness context trace

The connector creates awareness context from `getGridlySelectedAwarenessArea()` or `getGridlyHomeTownAwarenessAnchor()`. It passes county ID, label/community, storage value, key, latitude, longitude, radius, county-wide mode, and lowercase text fallback terms derived from label, storage value, key, and county ID with `-tx` and trailing ` county` stripped.

For Dayton live validation, the selected context is expected to be Dayton with an approximately eight-mile configured radius. The LP042 audit reports selected county ID/label, awareness ID/label, storage value, anchor, radius, aliases, text tokens, and a passive comparison flag when LP039.3 context audit is loaded. Stale context is possible only through existing selected-awareness runtime state; LP042 adds no storage writes, fetches, map movement, or state mutation.

## 5. Record input shape

The connector filter receives normalized records from `allNormalizedRecords`. The production normalized model preserves id, provider, providerId, category, title, description, routeName, latitude, longitude, startTime, endTime, sourceTrace, and `rawPayloadExposed: false`.

It does not see full source geometry, geometry coordinate arrays, limits, county/city/district from the live provider, or raw provider properties beyond normalized fields. For `LineString`, the provider picks `coordinates[Math.floor(length / 2)]`; for `Point`, it reads GeoJSON `[longitude, latitude]`; for other geometry such as `MultiLineString`, it falls back to scalar coordinate fields, which are normally absent.

## 6. Geographic branch findings

The distance function is `globalScope.getDistanceMiles(areaLat, areaLng, lat, lng)`, with arguments in latitude/longitude order and units in miles. GeoJSON source order is handled before this by the provider normalizer, which reads `[longitude, latitude]` and stores normalized latitude/longitude.

The geographic threshold is inclusive: distance `<= allowedMiles`. For a normal area, `allowedMiles = radiusMiles + 2`, so Dayton's eight-mile awareness radius becomes a ten-mile connector source-scope threshold. LP042 does not widen this threshold.

Full source LineString/MultiLineString geometry is ignored by the current connector filter. Every record is measured from a single normalized coordinate. For `LineString`, that coordinate is the array midpoint, not the nearest point, not a clipped segment, and not an intersection test. Therefore a line can cross or approach the awareness radius while its midpoint lies outside and the connector will reject it.

For the six live normalized US 90 candidates, LP041 already proved each candidate was present in the complete cache and absent after connector filtering. LP042's browser audit reports each loaded candidate's source ID, category, route, extracted coordinate, distance from Dayton anchor, point-radius result, text-fallback result, and exclusion reasons. Full line intersection evidence is reported as unavailable unless bounded LP041 raw diagnostic geometry is available, because production normalized cache does not retain full raw geometry.

## 7. Text fallback findings

Production text fallback searches normalized title, description, routeName, locality, city, county, and affectedAreas. Awareness terms come from selected label, storage value, key, and county ID after simple lowercase cleanup. Matching is substring-based; production does not perform route-number normalization, token-aware matching, alias expansion beyond those selected fields, or HTML stripping in `recordText()`.

LP041 live provider field availability showed route, timestamp, and provider ID for every feature but no county/city/district/limits. If provider descriptions do not contain `dayton`, `liberty`, or related selected awareness terms, text fallback cannot match route-only US 90 records. Route name alone is not a locality proof and must not be promoted to authority.

## 8. US 90 candidate trace

LP041 live evidence found 14 raw US 90 diagnostic candidates and 6 normalized US 90 candidates. All 6 were in the complete normalized cache; 0 survived connector filtering. LP042's `window.gridlyLp042DriveTexasConnectorFilterRecordTrace?.("US 90")` returns up to 50 compact candidate records with source ID, route, category, extracted midpoint coordinate, distance from Dayton, point result, text fields, awareness tokens, text result, connector inclusion, exclusion reasons, full-geometry evidence status, and first rejection branch.

## 9. Zero-output root cause

Classification: `mixed_root_cause` consisting of `source_geometry_reduced_to_midpoint`, `full_geometry_ignored`, `awareness_text_absent_from_provider`, `text_fallback_contract_unusable_for_provider_shape`, and `connector_filter_is_obsolete_pre_authority_gate`.

Supporting evidence: the connector filter uses only point radius OR text fallback; the provider reduces LineString to midpoint; LP041 live evidence showed 739 input and 0 output with 0 point/text matches; route-only US 90 records cannot match locality text; and connector-filtered awareness records remain a pre-authority view even though LP039 can prefer the complete source cache.

Confidence is high for the repository mechanics and LP041 count evidence. The unresolved question is per-candidate full line intersection without a sanctioned retained full-geometry diagnostic.

## 10. Pipeline ownership findings

`allNormalizedRecords` is the retained complete normalized source cache. `awarenessNormalizedRecords` is the connector-filtered selected-awareness view. `gridlyDriveTexasConnector.getNormalizedRecords()` and `getAwarenessRecords()` return the filtered view. `gridlyDriveTexasConnector.getAllNormalizedRecords()` returns the complete normalized cache.

LP039.2 source integration prefers `gridlyDriveTexasConnector.getAllNormalizedRecords()` before `getNormalizedRecords()`, so the current LP039 adapter path can consume complete records when that method exists. However, duplicate ownership is still present because the connector also derives and publishes a filtered awareness view, legacy readers can consume filtered records, and LP041 identified connector filtering as the first pre-authority removal stage for that view.

## 11. Architecture option comparison

### Option A — Keep connector filter as current gate

Rejected as final authority gate. It is vulnerable to midpoint false negatives, lacks full geometry, depends on locality text the provider does not supply, and is incompatible with LP039 authority ownership.

### Option B — Pass complete normalized source cache to LP039

Preferred future direction. Connector filtering remains diagnostic/legacy only; LP039 becomes the sole selected-awareness authority gate. Memory impact is already accepted because `allNormalizedRecords` is retained. Regression risk is manageable if consumer surfaces continue using LP039 authority output and not route-name-only matching.

### Option C — Geometry-aware connector filter

Deferred. It could reduce false negatives but duplicates authority logic and creates two geographic ownership systems before LP039.

### Option D — Remove text fallback but keep point filter

Rejected. It avoids misleading text retention but preserves midpoint false negatives.

### Option E — Layered source scoping

Potential later optimization only if it is broader than final LP039 authority, non-authoritative, traceable, geometry-aware enough to avoid obvious false negatives, and never hardcoded to a road, community, county, or corridor.

## 12. Recommended future contract

LP039 should receive complete normalized DriveTexas source records. Connector awareness filtering should be explicitly diagnostic/legacy and must not be treated as certified authority. Any future source scoping must be broad, non-authoritative, fully traceable, and must preserve enough geometry evidence to avoid midpoint-only loss.

## 13. Explicit non-recommendations

Do not widen radius, hardcode Dayton, hardcode Liberty County, hardcode US 90, use route-name-only authority, change LP039 authority behavior during LP042, alter consumer wording, retain full raw payloads, expose the API key, or implement a production repair in this milestone.

## 14. Merge implications

DO NOT MERGE until live browser evidence is reviewed and the next production repair is separately approved. LP042 adds passive diagnostics, documentation, and tests only.

## 15. Suggested next milestone

LP043 — production repair contract to demote connector filtering from any authority input gate and certify LP039 complete-cache consumption across all relevant runtime and legacy paths without consumer wording or radius changes.
