# LP214 Phase 2.2D — DriveTexas Dallas geographic authority audit

## Decision and root cause

**Primary classification: `AWARENESS_RADIUS_DEFECT`. Repair authorized.** The
canonical Dallas PLACE object supplies `lat`/`lng` but no radius. LP039's
`selectedAnchor` correctly applies its governed 7-mile default. It then formerly
passed the *raw* radius-less object to the shared geometry authority, whose
`normalizeCommunity` deliberately rejects an area without a finite radius. The
result was an invalid active geometry anchor and `geometryQualified: false` for
every trusted geometry. The first semantic divergence was therefore radius
normalization, not coordinate order or segment distance.

The focused repair passes LP039's already-normalized anchor and 7-mile radius to
the shared evaluator. It does not widen the radius, bypass trusted geometry, or
add Dallas/county behavior. Trusted LineString/MultiLineString geometry continues
to take precedence over representative-point proximity and genuinely outside
geometry continues to fail closed.

## Geographic path comparison

| Concern | Connector awareness view | LP039 shared authority after repair |
|---|---|---|
| anchor | selected `lat`, `lng` | governed `selectedAnchor` `lat`, `lng` |
| radius | configured radius + 2; 35 miles if absent | configured radius, or governed 7-mile default; no +2 |
| units/comparison | miles, inclusive `<=` | miles, inclusive `<=` |
| source | representative provider coordinate | trusted GeoJSON first; representative point only without trusted line geometry |
| Point | representative haversine | trusted Point/representative haversine |
| Line/MultiLine | midpoint only | minimum existing point-to-segment distance over every member |
| coordinate order | distance arguments lat/lng; provider midpoint extracted from `[lon,lat]` | strict GeoJSON `[lon,lat]`; swapped/malformed pairs invalid |
| selected shape | connector-derived area context | canonical PLACE shape enriched only with governed anchor/radius |

The connector's eight matches are not final authority: its permissive diagnostic
scope uses `radius + 2` and line midpoints. In this case, however, LP039 was still
wrong because a valid missing-radius PLACE shape was inconsistently accepted by
`selectedAnchor` and rejected at the immediately following shared boundary.

## Eight-record evidence boundary

The owner evidence supplied eight distinct active records and the representative
distances below, but did not include provider incident IDs or coordinate arrays.
Those values cannot be truthfully reconstructed in-repository. The regression
fixture therefore uses eight unique, bounded Dallas shapes matching the reported
types/policies and distance band; the owner retest below prints exact live IDs,
first coordinates, and governed geometry distances for certification.

| Row | incident ID in supplied evidence | category | representative distance | before | after fixture |
|---:|---|---|---:|---|---|
| 1 | not supplied | Bridge Restriction | 0.623 mi | outside / not established | inside |
| 2 | not supplied | Bridge Restriction | 0.245 mi | outside / not established | inside |
| 3 | not supplied | Lane Closure | 0.861 mi | outside / not established | inside |
| 4 | not supplied | Bridge Restriction | 0.236 mi | outside / not established | inside |
| 5 | not supplied | Lane Closure | 0.833 mi | outside / not established | inside |
| 6 | not supplied | Road Closure | 0.796 mi | outside / not established | inside |
| 7 | not supplied | Bridge Restriction | 0.650 mi | outside / not established | inside |
| 8 | not supplied | Bridge Restriction | 0.542 mi | outside / not established | inside |

Expected browser transition: **8 candidates → geographyPass 0 →
`trusted_geometry_outside_selected_awareness` ×8 → finalEligible 0 →
`HEALTHY_EMPTY`** becomes **8 candidates → governed geometry evaluated with the
7-mile radius → geographyPass N → finalEligible N → envelopeRecordCount N →
`HEALTHY_WITH_DATA`**. `N` remains subject to all other governed predicates.

## Exact owner browser retest

```js
(() => {
  const connector = window.gridlyDriveTexasConnector;
  const area = window.getGridlySelectedAwarenessArea();
  const statewide = connector.getAllNormalizedRecords();
  const candidates = connector.getAwarenessRecords();
  const input = { records: candidates, selectedAwarenessArea: area };
  const snapshot = window.gridlyGetDriveTexasAuthoritySnapshot(input);
  const proof = snapshot.authority.recordProof || [];
  const envelope = window.gridlyGetDriveTexasConsumerSourceStatusEnvelope();
  const reasons = proof.flatMap(p => p.ineligibilityReasons || [])
    .reduce((out, reason) => ((out[reason] = (out[reason] || 0) + 1), out), {});
  const result = {
    statewideCount: statewide.length,
    awarenessCandidateCount: candidates.length,
    proofCount: proof.length,
    categoryPass: proof.filter(p => p.consumerMeaningfulCategory).length,
    geographyPass: proof.filter(p => p.selectedAwarenessMatch).length,
    freshnessActive: proof.filter(p => p.freshnessStatus === "active").length,
    unique: proof.filter(p => p.duplicateStatus === "unique").length,
    finalEligible: proof.filter(p => p.finalEligibility).length,
    rejectionReasons: reasons,
    envelopeRecordCount: envelope.records.length,
    sourceStatus: envelope.sourceStatus,
    connected: envelope.connected,
    healthyEmpty: envelope.healthyEmpty,
    quietEligible: envelope.quietEligible,
    geometryRows: snapshot.authority.records.map((record, i) => ({
      incidentId: record.sourceProviderRecordId || record.globalId || record.eventId || record.id,
      geometryType: proof[i]?.sourceGeometryType,
      representativeLat: record.latitude,
      representativeLng: record.longitude,
      firstGeometryCoordinate: record.sourceGeometry?.type === "MultiLineString"
        ? record.sourceGeometry.coordinates?.[0]?.[0]
        : record.sourceGeometry?.coordinates?.[0],
      coordinateOrder: proof[i]?.coordinateOrderUsed || "GeoJSON [longitude, latitude]",
      connectorDistanceMiles: window.getDistanceMiles(area.lat, area.lng, record.latitude, record.longitude),
      lp039GeometryDistanceMiles: proof[i]?.closestGeometryDistanceToAwarenessMiles,
      awarenessRadiusMiles: proof[i]?.configuredAwarenessRadiusMiles,
      connectorInside: candidates.includes(record) || candidates.some(r => r.id === record.id),
      lp039Inside: proof[i]?.selectedAwarenessMatch,
      ownershipMethod: proof[i]?.geographicOwnershipMethod,
      rejectionReason: proof[i]?.ineligibilityReasons?.join('; ') || null
    }))
  };
  console.table(result.geometryRows);
  console.log("LP214 Phase 2.2D Dallas owner certification", result);
  return result;
})();
```

Owner browser certification remains mandatory; do not merge on repository tests
alone.
