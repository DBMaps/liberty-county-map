# LP214 — Statewide DriveTexas final owner certification

## Certification boundary

The automated artifact is the statewide proof; browser checks are lifecycle controls, not city exceptions or a substitute denominator. All canonical communities use the shared canonical PLACE → LP201 focus → connector geography → LP039.2 snapshot → LP039.3 projection → source envelope → shared awareness → consumer surfaces → marker publication path. Overlapping Leaflet markers remain separate rendered outcomes: `renderedMarkerCount`, not visually distinct icon count, is authoritative. No coordinate offset or decluttering behavior is authorized here.

## Reusable owner console block

Run after selecting any canonical community and allowing the current DriveTexas refresh to settle. It contains no community identity or incident-count literal and evaluates the mutable same-snapshot count `N`.

```js
(() => {
  const call = (name) => { try { return typeof window[name] === "function" ? window[name]() : null; } catch (error) { return { auditError: error.message }; } };
  const first = (...values) => values.find(value => value !== undefined && value !== null);
  const count = value => Number(value || 0);
  const connector = call("gridlyDriveTexasConnectorRuntimeAudit") || {};
  const authority = call("gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit") || {};
  const projection = call("gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit") || {};
  const publisher = call("gridlyAwarenessOfficialRoadwayPublisherRepairAudit") || {};
  const marker = call("gridlyLp214OfficialRoadwayMarkerPublicationAudit") || {};
  const source = publisher.sourceStatusEnvelope || {};
  const summary = window.gridlyCommunityPulseAuditState?.communityAwarenessSummary || publisher.lastEnrichment?.summary || null;
  const shared = summary?.sharedActiveIssueContract || {};
  const pulseSummary = window.gridlyCommunityPulseAuditState?.communityAwarenessSummary || null;
  const microlineSummary = window.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary || null;
  const selected = first(connector.lastFilterContext, connector.awarenessContext, projection.selectedAwarenessArea, authority.selectedAwarenessArea, source.canonicalContext, {});
  const focus = first(selected.canonicalFocus, selected.focus, selected.anchor, selected);
  const records = Array.isArray(source.records) ? source.records : [];
  const outcomes = Array.isArray(marker.outcomes) ? marker.outcomes : [];
  const N = count(first(source.authorityEligibleCount, projection.authorityEligibleRecordCount, authority.authorityEligibleRecordCount));
  const projectionInput = count(first(source.lp0393ProjectionInputCount, source.projectionInputCount, projection.lp0393ConsumerProjectionInputCount));
  const projected = count(first(source.lp0393ProjectedCount, source.consumerVisibleCount, projection.consumerVisibleSituationCount));
  const envelopeCount = count(first(source.consumerEnvelopeCount, publisher.sourceEnvelopeCount, records.length));
  const geographicState = first(source.geographicEvaluationState, selected.geographicEvaluationState, connector.geographicEvaluationState);
  const sourceStatus = source.sourceStatus;
  const markerReadyCount = records.filter(record => window.gridlyOfficialRoadwayMarkerPublication?.coordinate?.(record)).length;
  const official = records.filter(record => first(record.sourceOwnership, "OFFICIAL_ROADWAY") === "OFFICIAL_ROADWAY");
  const ownershipViolations = records.filter(record => record.sourceOwnership && record.sourceOwnership !== "OFFICIAL_ROADWAY");
  const falseCrossing = records.filter(record => /crossing blocked/i.test(String(first(record.consumerTitle, record.title, ""))) && record.sourceOwnership === "OFFICIAL_ROADWAY");
  const semanticSummary = records.reduce((result, record) => { const key = first(record.semanticType, record.category, record.consumerTitle, "Travel Advisory"); result[key] = count(result[key]) + 1; return result; }, {});
  const countConverged = N === projectionInput && projectionInput === projected && projected === envelopeCount;
  const statusPass = N > 0
    ? sourceStatus === "HEALTHY_WITH_DATA" && source.healthyEmpty === false && source.quietEligible === false
    : geographicState === "AVAILABLE" && countConverged && sourceStatus === "HEALTHY_EMPTY" && source.healthyEmpty === true;
  const canonicalKey = first(selected.canonicalKey, selected.key, shared.areaIdentity);
  const authorityName = first(selected.focusAuthority, focus.authority);
  const focusPass = /^place-48\d{5}$/.test(String(canonicalKey || "")) && Number.isFinite(Number(first(focus.lat, focus.latitude))) && Number.isFinite(Number(first(focus.lng, focus.longitude))) && authorityName === "LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1";
  const locationNode = document.querySelector('[data-v2-location-awareness="panel"]');
  const governedLocationCount = count(shared.activeIssueCount);
  const presentedLocationCount = locationNode?.dataset?.activeAwarenessCount == null ? null : Number(locationNode.dataset.activeAwarenessCount);
  const locationContextPass = presentedLocationCount == null ? null : presentedLocationCount === governedLocationCount;
  const currentArea = first(publisher.publisherAreaIdentity, shared.areaIdentity, canonicalKey);
  const stalePriorAreaIdentity = Boolean(publisher.previousAreaIdentity && publisher.previousAreaIdentity !== currentArea && [publisher.publisherAreaIdentity, publisher.pulseAreaIdentity, publisher.microlineAreaIdentity].includes(publisher.previousAreaIdentity));
  const result = {
    identity: { canonicalKey, consumerLabel: first(selected.consumerLabel, selected.label, selected.community), countyId: selected.countyId, placeGeoid: first(selected.placeGeoid, String(canonicalKey || "").replace(/^place-/, "")) },
    lp201Focus: { lat: first(focus.lat, focus.latitude), lng: first(focus.lng, focus.longitude), radius: first(focus.radiusMiles, focus.radius), authority: authorityName },
    driveTexas: { statewideNormalizedCount: first(connector.normalizedRecordCount, connector.allNormalizedRecordCount), currentGeographicCandidateCount: first(connector.geographicRecordCount, connector.awarenessRecordCount, connector.lastFilterTrace?.outputCount), geographicEvaluationState: geographicState, directLp039AuthorityInput: first(authority.authorityInputCount, authority.inputRecordCount), directLp039Eligible: first(authority.authorityEligibleRecordCount, N), envelopeAuthorityInput: first(source.authorityInputCount, source.directAuthorityInputCount), envelopeAuthorityEligible: N, lp0393ProjectionInput: projectionInput, lp0393Projected: projected, consumerVisible: projected, consumerEnvelope: envelopeCount, countConverged, evaluationRevision: first(source.evaluationRevision, publisher.awarenessRevision), sourceStatus, connected: source.connected, healthyEmpty: source.healthyEmpty, quietEligible: source.quietEligible },
    sharedAwareness: { activeOfficialRoadwayCount: count(shared.activeOfficialRoadwayCount), activeCommunityReportCount: count(shared.activeCommunityReportCount), activeCrossingIssueCount: count(shared.activeCrossingIssueCount), activeOtherHazardCount: count(shared.activeOtherHazardCount), activeIssueCount: governedLocationCount, pulseAreaIdentity: pulseSummary?.sharedActiveIssueContract?.areaIdentity, microlineAreaIdentity: microlineSummary?.sharedActiveIssueContract?.areaIdentity, sameSummaryReference: Boolean(summary && pulseSummary === summary && (!microlineSummary || microlineSummary === summary)) },
    locationContext: { governedCount: governedLocationCount, visiblePresentationCount: presentedLocationCount, certificationStatus: locationContextPass === null ? "INDETERMINATE_NO_PRESENTATION_COUNT" : locationContextPass ? "PASS" : "FAIL", locationContextPass },
    alerts: { officialRoadwayRecordCount: official.length, officialRoadwayOwnershipViolations: ownershipViolations, falseCrossingBlockedViolations: falseCrossing, semanticClassificationSummary: semanticSummary },
    markers: { sourceRecordCount: marker.sourceRecordCount, markerReadyCount, eligibleMarkerModelCount: marker.eligibleMarkerModelCount, renderedMarkerCount: marker.renderedMarkerCount, governedAggregatedCount: marker.governedAggregatedCount, explicitlySuppressedCount: marker.explicitlySuppressedCount, silentDropCount: marker.silentDropCount, representedRecordCount: marker.representedRecordCount, publicationRevision: marker.publicationRevision, outcomes },
    transition: { previousAreaIdentity: publisher.previousAreaIdentity, currentPublisherAreaIdentity: currentArea, stalePriorAreaIdentity },
    classifications: {}
  };
  Object.assign(result.classifications, {
    focusPass,
    authorityParityPass: count(first(authority.authorityInputCount, N)) === count(first(source.authorityInputCount, source.directAuthorityInputCount, authority.authorityInputCount, N)) && count(first(authority.authorityEligibleRecordCount, N)) === N,
    projectionPass: countConverged,
    sourceStatusPass: statusPass,
    sharedAwarenessPass: count(shared.activeOfficialRoadwayCount) === envelopeCount && result.sharedAwareness.sameSummaryReference,
    locationContextPass,
    alertSemanticsPass: ownershipViolations.length === 0 && falseCrossing.length === 0,
    markerPublicationPass: count(marker.silentDropCount) === 0 && count(marker.representedRecordCount) === records.length,
    transitionPass: !stalePriorAreaIdentity
  });
  result.classifications.overallPass = Object.values(result.classifications).every(value => value === true);
  console.log("LP214 reusable statewide DriveTexas owner certification", result);
  console.table(outcomes.map(({ consumerSituationId, sourceOwnership, category, markerPublicationEligible, suppressionReason, markerModelIdentity, aggregationIdentity, representedConsumerSituationIds, outcome, renderedMarkerIdentity }) => ({ consumerSituationId, sourceOwnership, category, markerPublicationEligible, suppressionReason, markerModelIdentity, aggregationIdentity, representedConsumerSituationIds: representedConsumerSituationIds?.join(","), outcome, renderedMarkerIdentity })));
  return result;
})();
```

A `null` Location Context result is indeterminate rather than a pass. Any divergence must remain non-quiet and classify as `PROJECTION_DEFECT` (or the governed equivalent).

## Representative owner matrix

Use the exact same block, in order: Dallas; Houston; Liberty; Talco; El Paso; McAllen; Amarillo; a deterministically observed small/rural canonical community with current data; a deterministically observed legitimate `HEALTHY_EMPTY` community; and a multi-county canonical PLACE other than Dallas/Houston. Discover the two feed-dependent controls from the live mutable feed; do not freeze their identities in production or certification code.

## Fresh-browser control

1. Close all application tabs and DevTools contexts, then create a new browser profile/incognito context (not merely reload).
2. Open the deployed application directly and select a non-Dallas representative canonical community.
3. Wait for startup hydration and one DriveTexas evaluation to finish; do not visit another community first.
4. Run the reusable block once. Save its object and marker table.
5. Require canonical identity and LP201 focus, connected governed source state, same-snapshot count convergence, shared-summary reference convergence, Location Context equality, correct official-roadway semantics, zero silent marker drops, and no previous-area identity reported as current evidence.
6. Treat missing presentation evidence as indeterminate and any stale area, projection divergence, or silent marker drop as failure. Do not repair the selected city; repair the shared boundary and rerun the statewide artifact.
