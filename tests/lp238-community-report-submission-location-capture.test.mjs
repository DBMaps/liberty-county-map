import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

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
  assert.match(submit, /persistencePayload = \{ \.\.\.row \}/);
  assert.match(submit, /acceptedLocal = \{ \.\.\.localHazardEntry \}/);
  const normalize = functionSource('normalizeReports');
  for (const field of ['roadName', 'routeName', 'street', 'streetName', 'primaryRoad', 'crossStreet', 'referenceRoadA', 'resolvedLocation']) assert.match(normalize, new RegExp(`${field}:`));
});

test('LP238 governed evidence, Alerts and LP236 retain road-over-resolved priority', () => {
  const projection = functionSource('gridlyProjectAlertIncidentLocation');
  const resolver = functionSource('gridlyResolveCommunityTravelerLocation');
  assert.match(projection, /roadName.*routeName.*street.*streetName.*primaryRoad/);
  assert.ok(resolver.indexOf('"governed_road"') < resolver.indexOf('"governed_resolved_location"'));
  assert.ok(resolver.indexOf('"governed_resolved_location"') < resolver.indexOf('"county_fallback"'));
});

test('LP238 audit is bounded, passive and fail-closed at every location boundary', () => {
  const audit = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  for (const field of ['authorityAvailable', 'authorityReason', 'canonicalCommunityAuthority', 'selectedMembershipCounty', 'selectedMembershipAuthority', 'authoritativeMembershipCounty', 'authoritativeMembershipAuthority', 'activeCountyAuthority', 'contextAlignmentPass', 'structuredRoadAuthorityAvailable', 'payloadRoadValue', 'acceptedLocalRoadValue', 'persistedRoadValue', 'governedRoadValue', 'firstLocationLosingStage', 'submissionLocationCapturePass', 'persistenceLocationPass', 'governedLocationPass', 'overallPass', 'NO_STRUCTURED_ROAD_AUTHORITY']) assert.match(audit, new RegExp(field));
  assert.doesNotMatch(audit, /fetch\(|setTimeout|setInterval|reverse.?geocod/i);
});

test('LP238 preflight uses governed canonical community without inheriting a stale runtime county', () => {
  const auditSource = functionSource('gridlyLP238CommunityReportSubmissionLocationAudit');
  const audit = Function('gridlyLP238LastSubmissionLocation', 'gridlyGovernedAwarenessAudit', 'getGridlySelectedAwarenessArea', 'gridlyExtractStructuredMetadata', 'activeHazards',
    `${auditSource}; return gridlyLP238CommunityReportSubmissionLocationAudit;`)(
    null,
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
  const audit = Function('gridlyLP238LastSubmissionLocation', 'gridlyGovernedAwarenessAudit', 'getGridlySelectedAwarenessArea', 'gridlyExtractStructuredMetadata', 'activeHazards',
    `${auditSource}; return gridlyLP238CommunityReportSubmissionLocationAudit;`)(
    null,
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
