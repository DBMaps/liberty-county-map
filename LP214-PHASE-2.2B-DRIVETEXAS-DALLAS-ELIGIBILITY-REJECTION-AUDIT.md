# LP214 Phase 2.2B — DriveTexas Dallas eligibility rejection audit

## Decision

**Primary classification: `UNKNOWN`.** The supplied observation proves that eight
records entered the connector awareness view and that none passed LP039, but it
does not include the records' provider IDs, timestamps, geometry, retained flags,
or LP039 `recordProof`. Those values are the evidence that determines eligibility;
titles and representative coordinates cannot substitute for them. Consequently,
the current evidence does **not** establish either
`ALL_REJECTIONS_GOVERNED_AND_CORRECT` or a production defect.

`HEALTHY_EMPTY` is therefore **not yet certified truthful** for this capture. It is
not proven false either. No production repair is authorized until the read-only
browser diagnostic below captures all eight governed proofs.

## Governed decision chain

1. `gridlySelectConsumerVisibleDriveTexasSituations(input)` requests
   `gridlyGetDriveTexasAuthoritySnapshot(input)` and projects only
   `authority.consumerEligibleSituations`. It has no additional rejecting category,
   geography, freshness, migration-readiness, or duplicate gate.
2. The snapshot calls the LP039.2 `select(input)`. Explicit `records` are adapted by
   `gridlyAdaptDriveTexasRecordsForAuthority`; otherwise the complete connector
   cache is preferred over the connector awareness view. Adaptation normalizes
   identity, category, time fields, representative coordinates, and trusted Point,
   LineString, or MultiLineString geometry. It does not reject records.
3. `buildEligibilityProof` assigns a canonical event/provider/fallback identity and
   rejects later occurrences as `duplicate_identity`.
4. Retained/fallback-only evidence rejects as `retained_record_only_evidence`.
5. The category allow-list is Crash, Road Closure, Flooding, Construction, Lane
   Closure, Bridge Restriction, and Travel Advisory. Thus all three observed Dallas
   categories are allowed; a category outside the list rejects as
   `non_consumer_meaningful_category`.
6. The selected area must have a valid Texas center. Missing/invalid centers reject
   as `missing_selected_awareness_anchor`. The configured radius is used, defaulting
   to 7 miles.
7. Coordinate evidence rejects as `missing_coordinates`, `invalid_coordinates`, or
   `reversed_coordinate_suspect`. Trusted line geometry can satisfy coordinate
   authority even when its representative point cannot.
8. `gridlyQualifyDriveTexasGeometryAuthority` qualifies a point within the selected
   center radius (`valid_source_point_inside_awareness_radius_miles`) or a trusted
   line whose nearest segment is within that radius
   (`trusted_source_geometry_intersects_awareness_radius`). Failure rejects as
   `outside_awareness_radius_miles` or
   `trusted_geometry_outside_selected_awareness`.
9. This path does **not** test Census PLACE containment, county polygons, county
   text, Dallas's member-county list, roadway names, or a separate LP039 county gate.
   `countyIdsIntersected` is diagnostic output from the shared geometry helper and,
   because LP039 supplies no county inventory here, is not eligibility evidence.
10. `localFreshness` rejects unavailable provider/connector or a failed fetch;
    rejects missing all update/start/end timestamps; rejects a future start; rejects
    `endTime <= now`; and rejects `updateTime` older than six hours. Codes are
    `freshness_provider_unavailable`, `freshness_connector_unavailable`,
    `freshness_fetch_failed`, `freshness_missing_timestamp`,
    `freshness_future_effective`, `freshness_expired`, and `freshness_stale`.
11. Final eligibility is the conjunction of unique identity, non-retained evidence,
    allowed category, valid coordinate/geometry authority, valid awareness anchor,
    geographic qualification, and `freshnessStatus === "active"`. LP039 then
    suppresses duplicate eligible IDs while forming `consumerEligibleSituations`.
12. LP039.3 performs a one-for-one consumer projection and supplies the same array
    to marker, alert, and Travel Brief inputs. It does not contain a separate
    canonical-type filter, provider allow-list, readiness gate, or suppression rule.

## Candidate evidence available from the supplied capture

Dallas's governed focus is 32.7767, -96.7970. The distances below independently
check only the representative-point radius branch; they do not replace the governed
proof or establish current time eligibility. Every point is well inside the default
7-mile radius and every reported category is allow-listed.

| # | Provider/source ID | Reported title/category | Point distance | Time window / freshness | Geometry / ownership | Final proof |
|---:|---|---|---:|---|---|---|
| 1 | Not supplied | Bridge Restriction on IH0030 | 0.623 mi | Not supplied | Point would qualify | Not supplied |
| 2 | Not supplied | Bridge Restriction on IH0030 | 0.245 mi | Not supplied | Point would qualify | Not supplied |
| 3 | Not supplied | Lane Closure on SS0366 | 0.861 mi | Not supplied | Point would qualify | Not supplied |
| 4 | Not supplied | Bridge Restriction on IH0030 | 0.236 mi | Not supplied | Point would qualify | Not supplied |
| 5 | Not supplied | Lane Closure on IH0035E | 0.833 mi | Not supplied | Point would qualify | Not supplied |
| 6 | Not supplied | Road Closure on IH0030 | 0.796 mi | Not supplied | Point would qualify | Not supplied |
| 7 | Not supplied | Bridge Restriction on IH0030 | 0.650 mi | Not supplied | Point would qualify | Not supplied |
| 8 | Not supplied | Bridge Restriction on IH0030 | 0.542 mi | Not supplied | Point would qualify | Not supplied |

Accepted count observed: **0**. Rejected count observed: **8**. Exact governed
rejection-reason counts: **not present in the supplied evidence**. Since category
and representative-point distance do not explain the result, the remaining live
possibilities include freshness, retained-only evidence, identity duplication,
invalid normalized coordinate/geometry evidence, or a mismatch between the area
object used by the connector and the area object supplied to LP039.

## Exact owner console diagnostic

This block is read-only. It evaluates the current eight awareness records through
the existing selector/snapshot implementation and reports rejected proofs rather
than incorrectly mapping only the accepted projection.

```js
(() => {
  const connector = window.gridlyDriveTexasConnector;
  const area = window.getGridlySelectedAwarenessArea();
  const records = connector.getAwarenessRecords();
  const input = { records, selectedAwarenessArea: area };
  const snapshot = window.gridlyGetDriveTexasAuthoritySnapshot(input);
  const selection = window.gridlySelectConsumerVisibleDriveTexasSituations(input);
  const proof = snapshot.authority.recordProof;
  const byAuthorityId = new Map(proof.map(p => [p.authorityIdentity || p.sourceId, p]));
  const rows = snapshot.authority.records.map((record, index) => {
    const id = record.authorityIdentity || record.sourceId || record.providerId || record.id;
    const p = byAuthorityId.get(id) || proof[index] || {};
    return {
      providerSourceId: record.sourceProviderRecordId || record.globalId || record.eventId || record.id || null,
      authorityId: id,
      title: record.headline || record.title || null,
      category: record.category || null,
      startTime: record.startTime || null,
      updateTime: record.updateTime || record.updatedAt || null,
      endTime: record.endTime || null,
      freshnessStatus: p.freshnessStatus || null,
      freshnessTimestampUsed: p.freshnessTimestampUsed || null,
      freshnessEligible: p.freshnessStatus === "active",
      coordinateValidity: p.coordinateValidity || null,
      distanceMiles: p.distanceFromSelectedAwarenessMiles ?? null,
      radiusMiles: p.configuredAwarenessRadiusMiles ?? null,
      pointQualified: p.pointInsideAwarenessRadius === true,
      geometryType: p.sourceGeometryType || null,
      geometryValid: p.sourceGeometryValid === true,
      geometryDistanceMiles: p.closestGeometryDistanceToAwarenessMiles ?? null,
      geometryIntersects: p.sourceGeometryIntersectsSelectedAwareness === true,
      geographicOwnershipMethod: p.geographicOwnershipMethod || "not_established",
      selectedAwarenessMatch: p.selectedAwarenessMatch === true,
      county: record.county || null,
      city: record.city || null,
      consumerMeaningfulCategory: p.consumerMeaningfulCategory === true,
      duplicateStatus: p.duplicateStatus || null,
      finalEligibility: p.finalEligibility === true,
      ineligibilityReasons: [...(p.ineligibilityReasons || [])]
    };
  });
  const accepted = rows.filter(row => row.finalEligibility);
  const rejected = rows.filter(row => !row.finalEligibility);
  const rejectionReasonCounts = rejected.flatMap(row => row.ineligibilityReasons)
    .reduce((out, reason) => ((out[reason] = (out[reason] || 0) + 1), out), {});
  const result = {
    capturedAt: new Date().toISOString(),
    selectedAwarenessArea: area,
    connectorAwarenessCount: records.length,
    authorityEligibleCount: snapshot.authority.authorityEligibleRecordCount,
    consumerVisibleCount: selection.consumerVisibleSituationCount,
    accepted,
    rejected,
    rejectionReasonCounts
  };
  console.table(rows);
  console.log("DriveTexas Dallas governed rejection proof", result);
  return result;
})();
```

## Recommendation

Run and preserve the returned object in the same configured Dallas session. If all
eight rows show only truthful live-record conditions (for example, expired or stale
records under the existing policy), classify
`ALL_REJECTIONS_GOVERNED_AND_CORRECT` and certify `HEALTHY_EMPTY`. If any row should
be active under governed policy but fails normalization, ownership, freshness, or
projection, classify it by the prescribed defect category and authorize a separate
repair milestone. Do not patch LP039 on the incomplete evidence available here.
