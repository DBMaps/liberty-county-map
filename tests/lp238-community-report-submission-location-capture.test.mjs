import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const governedModule = await import('../js/governed-awareness.js');
const governedApi = governedModule.default || globalThis.GridlyGovernedAwareness;

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = app.indexOf('{', app.indexOf(')', start));
  let depth = 0;
  for (let index = body; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}' && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`could not parse ${name}`);
}

const builderSource = functionSource('gridlyBuildRoadHazardSubmissionLocationPayload');
const selectorSource = functionSource('gridlySelectHazardRoadNameCandidate');
const selectRoad = Function('normalizeGridlyUserFacingRoadText', 'gridlyRoundAuditMeters', 'roadwayDatasetLoaded',
  `${selectorSource}; return gridlySelectHazardRoadNameCandidate;`)(
  value => String(value || '').replace(/\s+/g, ' ').trim(),
  value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : null,
  false
);
const build = Function('safeDisplayText', 'gridlyCoordinateFromRecord', 'gridlyCoordinateDeltaMeters', 'gridlyPickRoadHazardLocationIdentityFields',
  `${builderSource}; return gridlyBuildRoadHazardSubmissionLocationPayload;`)(
  value => String(value || '').trim(),
  value => value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng)) ? { lat: Number(value.lat), lng: Number(value.lng) } : null,
  () => 0,
  source => Object.fromEntries(['roadName', 'routeName', 'street', 'streetName', 'primaryRoad', 'nearestRoad', 'crossStreet', 'referenceRoadA', 'locationName', 'knownLocation', 'locationLabel'].filter(key => source[key]).map(key => [key, source[key]]))
);

for (const fixture of [
  ['Flooding roadName', { roadName: 'South Congress Avenue' }, 'South Congress Avenue', 'roadName'],
  ['Flooding street', { street: 'Barton Springs Road' }, 'Barton Springs Road', 'street'],
  ['Road Closed routeName', { routeName: 'US 183' }, 'US 183', 'routeName'],
  ['Blocked Crossing metadata', { crossStreet: 'McNeil Drive', referenceRoadA: 'Howard Lane' }, 'McNeil Drive', 'crossStreet'],
  ['Debris shared path', { primaryRoad: 'Broadway Street' }, 'Broadway Street', 'primaryRoad']
]) {
  test(`LP238 captures ${fixture[0]} through the global payload builder`, () => {
    const result = build(fixture[1]);
    assert.equal(result.payload.roadName, fixture[2]);
    assert.equal(result.payload[fixture[3]], fixture[2]);
    assert.equal(result.audit.payloadPass, true);
  });
}

test('LP238 deterministic precedence retains selected road then crossing authority', () => {
  assert.equal(build({ selectedRoadName: 'Selected Road', roadName: 'Generic Road', crossStreet: 'Cross Road' }).payload.roadName, 'Selected Road');
  const crossing = build({ referenceRoadA: 'Reference Road' });
  assert.equal(crossing.payload.roadName, 'Reference Road');
  assert.equal(crossing.audit.selectedRoadAuthority, 'selected_crossing_reference_road');
  assert.equal(build({ locationName: '2 miles south of Austin' }).audit.selectedRoadAuthority, 'NO_STRUCTURED_ROAD_AUTHORITY');
});

test('LP238 submission, accepted-local, persistence and authoritative normalization preserve metadata', () => {
  const submit = functionSource('createSharedHazardReport');
  assert.match(submit, /appendGridlyStructuredMetadata[\s\S]*detailLocationMetadata/);
  assert.match(submit, /gridlyLP238PatchSubmissionCapture\(\{ submissionId: row\.crossing_id \}\)/);
  assert.match(submit, /successfulSubmissionObserved = true;[\s\S]*gridlyLP238PatchSubmissionCapture\(\{ persistedRoadValue:/);
  assert.match(submit, /gridlyLP238PatchSubmissionCapture\(\{ acceptedLocalRoadValue:/);
  const normalize = functionSource('normalizeReports');
  for (const field of ['roadName', 'routeName', 'street', 'streetName', 'primaryRoad', 'crossStreet', 'referenceRoadA', 'resolvedLocation']) assert.match(normalize, new RegExp(`${field}:`));
});

test('LP238 successful map and GPS submissions share a generation-stable bounded capture owner', () => {
  const submit = functionSource('createSharedHazardReport');
  const bounded = functionSource('gridlyLP238BoundedRoadSelectionTrace');
  const audit = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  assert.match(app, /window\.__gridlyLP238SubmissionCaptureAuthority/);
  assert.match(submit, /gridlyLP238WriteSubmissionCapture/);
  assert.match(submit, /successfulSubmissionObserved = true/);
  assert.match(submit, /submissionId: row\.crossing_id/);
  for (const field of ['roadSelectionAttempted', 'roadSelectionAuthorityAvailable', 'roadSelectionAuthorityName', 'roadSelectionCandidateCount', 'roadSelectionEligibleCandidateCount', 'roadSelectionSearchRadius', 'roadSelectionNearestCandidateDistance', 'roadSelectionWinningCandidateFound', 'roadSelectionWinningCandidateName', 'roadSelectionSelectedRoadName', 'roadSelectionFailureReason']) assert.match(bounded, new RegExp(field));
  assert.match(audit, /SUBMISSION_CAPTURE_UNAVAILABLE/);
  assert.doesNotMatch(bounded, /waypoints|provider|geometry|candidates/);
});

test('LP238 capture only resets explicitly, on reload, or canonical town selection', () => {
  const reset = functionSource('gridlyLP238ResetSubmissionCapture');
  const invalidate = functionSource('invalidateGridlySelectedAwarenessAreaResolutionCache');
  assert.match(reset, /lastSubmission = null/);
  assert.match(app, /window\.gridlyLP238ResetCommunityReportSubmissionLocationAudit/);
  assert.match(invalidate, /gridlyLP238ResetSubmissionCapture/);
  for (const survivor of ['loadSharedReports', 'openAlertsSurfaceFromDock', 'gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply']) {
    const source = functionSource(survivor);
    assert.doesNotMatch(source, /gridlyLP238ResetSubmissionCapture/);
  }
});

test('LP238 governed evidence, Alerts and LP236 retain road-over-resolved priority', () => {
  const projection = functionSource('gridlyProjectAlertIncidentLocation');
  const resolver = functionSource('gridlyResolveCommunityTravelerLocation');
  assert.match(projection, /roadName.*routeName.*street.*streetName.*primaryRoad/);
  assert.ok(resolver.indexOf('"governed_road"') < resolver.indexOf('"governed_resolved_location"'));
  assert.ok(resolver.indexOf('"governed_resolved_location"') < resolver.indexOf('"county_fallback"'));
});

for (const [label, type] of [
  ['debris', 'debris'],
  ['flooding', 'flooding'],
  ['road closed', 'road_closed'],
  ['blocked crossing', 'blocked']
]) {
  test(`LP238.4 ${label} street survives active hazard, governed evidence and Alerts projection`, () => {
    const id = `hazard-device-lp2384-${type}`;
    const activeHazard = {
      id, persistedReportId: id, source: 'user', reportKind: 'hazard', type,
      roadName: 'San Antonio Street', resolvedLocation: '2 miles south of Austin',
      structuredMetadata: { roadName: 'San Antonio Street' },
      gridlyStructuredMetadata: { roadName: 'San Antonio Street' },
      canonicalRoadContext: { primaryRoad: 'San Antonio Street', roadContextAvailable: true }
    };
    const projection = governedApi.buildConsumerProjection({ records: [activeHazard], nowMs: Date.now() });
    assert.equal(projection.lineage.length, 1, 'canonical identity is not duplicated');
    const evidence = governedApi.buildSnapshot({ records: [activeHazard], nowMs: Date.now() }).evidence[0];
    assert.equal(evidence.persistedReportId, id);
    assert.equal(evidence.roadName, 'San Antonio Street');
    assert.equal(evidence.structuredMetadata.roadName, 'San Antonio Street');
    assert.equal(evidence.gridlyStructuredMetadata.roadName, 'San Antonio Street');
    assert.equal(evidence.canonicalRoadContext.primaryRoad, 'San Antonio Street');
    const alert = projection.surfaces.alerts[0];
    assert.equal(alert.evidenceId, `active_hazard:${id}`);
    assert.equal(alert.record.roadName, 'San Antonio Street');
    assert.equal(alert.record.governedEvidence.roadName, 'San Antonio Street');
    assert.equal(alert.record.resolvedLocation, '2 miles south of Austin');
  });
}

test('LP238.4 governed location projection is bounded and leaves identity, county and source ownership unchanged', () => {
  const record = { id: 'fixture-id', source: 'user', reportKind: 'hazard', type: 'debris', countyId: 'travis-tx', roadName: 'Named Road', resolvedLocation: 'provider phrase' };
  const projected = governedApi.buildConsumerProjection({ records: [record] }).surfaces.alerts[0];
  assert.equal(projected.evidenceId, 'active_hazard:fixture-id');
  assert.equal(projected.record.id, 'fixture-id');
  assert.equal(projected.record.countyId, 'travis-tx');
  assert.equal(projected.record.source, 'user');
  assert.equal(projected.record.governedEvidence.roadName, 'Named Road');
  assert.deepEqual(Object.keys(projected.record.governedEvidence).sort(), ['resolvedLocation', 'roadName']);
});

test('LP238 audit is bounded, passive and fail-closed at every location boundary', () => {
  const audit = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  for (const field of ['authorityAvailable', 'authorityReason', 'canonicalCommunityAuthority', 'selectedMembershipCounty', 'selectedMembershipAuthority', 'authoritativeMembershipCounty', 'authoritativeMembershipAuthority', 'activeCountyAuthority', 'contextAlignmentPass', 'structuredRoadAuthorityAvailable', 'payloadRoadValue', 'acceptedLocalRoadValue', 'persistedRoadValue', 'normalizedRoadValue', 'activeHazardRoadValue', 'governedRoadValue', 'alertsRoadValue', 'lp236SelectedLocationValue', 'lp236SelectedLocationAuthority', 'firstLocationLosingStage', 'submissionLocationCapturePass', 'persistenceLocationPass', 'governedLocationPass', 'overallPass', 'NO_STRUCTURED_ROAD_AUTHORITY']) assert.match(audit, new RegExp(field));
  assert.doesNotMatch(audit, /fetch\(|setTimeout|setInterval|reverse.?geocod/i);
});

test('LP238 preflight uses governed canonical community without inheriting a stale runtime county', () => {
  const auditSource = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  const audit = Function('gridlyLP238SubmissionCaptureAuthority', 'gridlyGovernedAwarenessAudit', 'getGridlySelectedAwarenessArea', 'gridlyExtractStructuredMetadata', 'activeHazards',
    `${auditSource}; return gridlyLP238CommunityReportSubmissionLocationAudit;`)(
    { lastSubmission: null, successfulSubmissionObserved: false, writeReached: false, lastResetReason: 'page_load' },
    () => ({ available: true, canonicalCommunity: 'Austin', countyId: null, evidence: [] }),
    () => ({ label: 'Austin', countyId: null, canonicalMultiCountyPlace: true }),
    () => ({}),
    []
  );
  const result = audit();
  assert.equal(result.authorityAvailable, true);
  assert.equal(result.canonicalCommunity, 'Austin');
  assert.equal(result.canonicalCommunityAuthority, 'gridlyGovernedAwarenessAudit.canonicalCommunity');
  assert.equal(result.activeCounty, null);
  assert.equal(result.selectedMembershipCounty, null);
  assert.equal(result.authoritativeMembershipCounty, null);
  assert.equal(result.contextAlignmentPass, true);
  assert.equal(result.lastSubmission, null);
  assert.equal(result.submissionLocationCapturePass, null);
  assert.equal(result.overallPass, null);
  assert.equal(result.status, 'NOT_TESTED');
  assert.doesNotMatch(auditSource, /gridlyGetActiveCountyId/);
});

test('LP238 context mismatch fails closed while membership and active county remain separate', () => {
  const auditSource = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  const audit = Function('gridlyLP238SubmissionCaptureAuthority', 'gridlyGovernedAwarenessAudit', 'getGridlySelectedAwarenessArea', 'gridlyExtractStructuredMetadata', 'activeHazards',
    `${auditSource}; return gridlyLP238CommunityReportSubmissionLocationAudit;`)(
    { lastSubmission: null, successfulSubmissionObserved: false, writeReached: false, lastResetReason: 'page_load' },
    () => ({ available: true, canonicalCommunity: 'Canonical Place', countyId: null, evidence: [] }),
    () => ({ label: 'Canonical Place', countyId: null }),
    () => ({}),
    []
  );
  const result = audit({ selectedMembershipCounty: 'selected-tx', authoritativeMembershipCounty: 'authoritative-tx', submissionContextValue: 'Different Place' });
  assert.equal(result.selectedMembershipCounty, 'selected-tx');
  assert.equal(result.authoritativeMembershipCounty, 'authoritative-tx');
  assert.equal(result.activeCounty, null);
  assert.equal(result.contextAlignmentPass, false);
  assert.equal(result.overallPass, false);
  assert.equal(result.status, 'CONTEXT_MISMATCH');
});

test('LP238 production submission context is coordinate-scoped and does not consume runtime active county', () => {
  const submit = functionSource('createSharedHazardReport');
  assert.match(submit, /gridlyResolveCountyIdForCoordinate\(lat, lng\)/);
  assert.match(submit, /gridlyGetReportSubmissionCountyScopedMetadata\(lat, lng\)/);
  assert.match(submit, /gridlyGetReportSubmissionCommunityMetadata\(countyScopedReportMetadata\.county_id, lat, lng\)/);
  assert.match(submit, /canonicalCommunitySource: "gridlyGetReportSubmissionCommunityMetadata\.communityName"/);
  assert.match(submit, /activeCountySource: "gridlyGetReportSubmissionCountyScopedMetadata\.county_id"/);
  assert.doesNotMatch(submit, /gridlyGetActiveCountyId/);
});

test('LP238 adds no coordinate-to-road inference, provider fetch, polling, or town branch', () => {
  const captureContract = builderSource + functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  assert.doesNotMatch(captureContract, /fetch\(|setTimeout|setInterval|reverse.?geocod|Austin|San Antonio|Corpus Christi/i);
  assert.doesNotMatch(builderSource, /lat.*roadName|lng.*roadName/i);
});

test('LP238 map placement and GPS invoke one shared snap contract and forward its selected road', () => {
  const mapPlacement = functionSource('handleHazardPlacementMapClick');
  const gpsStart = app.indexOf('window.submitHazardNearMe = function');
  const gpsEnd = app.indexOf('\n};', gpsStart) + 3;
  const gps = app.slice(gpsStart, gpsEnd);
  for (const source of [mapPlacement, gps]) {
    assert.match(source, /await snapHazardToRoad\(.*lat.*lng/s);
    assert.match(source, /selectedRoadName: snapped\.selectedRoadName/);
    assert.match(source, /createSharedHazardReport/);
  }
});

test('LP238 deterministic authority selects and normalizes the nearest valid named road', () => {
  const result = selectRoad({
    localCandidates: [{ roadName: '  South   Congress Avenue ', ref: 'FM 1', distanceFromTapMeters: 12 }],
    osrmCandidates: [{ name: 'Barton Springs Road', distance: 8 }],
    searchRadiusMeters: 75,
    localAuthorityReady: true
  });
  assert.equal(result.selectedRoadName, 'Barton Springs Road');
  assert.equal(result.trace.roadSelectionCandidateCount, 2);
  assert.equal(result.trace.roadSelectionEligibleCandidateCount, 2);
  assert.equal(result.trace.roadSelectionNearestCandidateDistance, 8);
  assert.deepEqual(result.trace.roadSelectionWinningCandidateRawNameFields, { name: 'Barton Springs Road' });
});

test('LP238 current radius and distance boundary reject distant roads without fabricating unnamed roads', () => {
  assert.equal(selectRoad({ osrmCandidates: [{ name: 'Boundary Road', distance: 75 }], searchRadiusMeters: 75 }).selectedRoadName, 'Boundary Road');
  const distant = selectRoad({ osrmCandidates: [{ name: 'Distant Road', distance: 75.1 }], searchRadiusMeters: 75 });
  assert.equal(distant.selectedRoadName, null);
  assert.equal(distant.trace.roadSelectionFailureReason, 'NO_VALID_ROAD_NEAR_SUBMISSION');
  const unnamed = selectRoad({ osrmCandidates: [{ name: '', hint: 'opaque-routing-hint', distance: 2 }], searchRadiusMeters: 75 });
  assert.equal(unnamed.selectedRoadName, null);
  assert.equal(unnamed.trace.roadSelectionFailureReason, 'CANDIDATE_NAME_NORMALIZATION_EMPTY');
  assert.match(functionSource('snapHazardToRoad'), /const snapAttemptRadii = \[75, 150\]/);
});

test('LP238 distinguishes authority-not-ready, empty authority, and truthful no-nearby-road', () => {
  assert.equal(selectRoad({ osrmCandidates: null, localAuthorityReady: false }).trace.roadSelectionFailureReason, 'ROAD_AUTHORITY_NOT_READY');
  assert.equal(selectRoad({ osrmCandidates: [], localAuthorityReady: false }).trace.roadSelectionFailureReason, 'ROAD_CANDIDATE_COLLECTION_EMPTY');
  assert.equal(selectRoad({ osrmCandidates: [{ name: 'Far Road', distance: 151 }], searchRadiusMeters: 150 }).trace.roadSelectionFailureReason, 'NO_VALID_ROAD_NEAR_SUBMISSION');
});

test('LP238 road selection uses existing deterministic sources and no added provider behavior', () => {
  assert.match(selectorSource, /active roadwaySegmentFeatures/);
  assert.match(selectorSource, /OSRM_NEAREST_API\.waypoints/);
  assert.doesNotMatch(selectorSource, /fetch\(|setTimeout|setInterval|reverse.?geocod|Austin/i);
  const snap = functionSource('snapHazardToRoad');
  assert.match(snap, /gridlyGeometryAwarePlacementDecision/);
  assert.match(snap, /gridlySelectHazardRoadNameCandidate/);
  assert.equal((snap.match(/fetch\(/g) || []).length, 1);
});

test('LP238 audit publishes bounded road-selection pass and failure semantics', () => {
  const audit = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  for (const field of ['roadSelectionAttempted', 'roadSelectionAuthorityAvailable', 'roadSelectionAuthorityName', 'roadSelectionCandidateCount', 'roadSelectionEligibleCandidateCount', 'roadSelectionSearchRadius', 'roadSelectionNearestCandidateDistance', 'roadSelectionWinningCandidateFound', 'roadSelectionWinningCandidateName', 'roadSelectionSelectedRoadName', 'roadSelectionFailureReason', 'roadSelectionPass', 'NO_VALID_ROAD_NEAR_SUBMISSION', 'ROAD_SELECTION_PIPELINE_FAILURE']) assert.match(audit, new RegExp(field));
});

test('LP238 freezes lifecycle identity, Show me, official roadways, weather and multi-county ownership', () => {
  const submit = functionSource('createSharedHazardReport');
  assert.match(submit, /gridlyRegisterAcceptedLocalHazard\(localHazardEntry, row\.crossing_id\)/);
  assert.doesNotMatch(submit, /canonicalReportId\s*=/);
  assert.match(app, /gridlyResolveAlertShowOnMapTarget/);
  assert.match(app, /focusGridlyAlertIncident/);
  assert.match(app, /sourceKind === "official_roadway"/);
  assert.match(app, /gridlyWeather/);
  assert.match(app, /canonicalMultiCountyPlace/);
  assert.doesNotMatch(builderSource, /county/i);
});
