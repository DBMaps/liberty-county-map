import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const auditDoc = fs.readFileSync('LP241.6-DESTINATION-AWARENESS-AUTHORITY-AUDIT.md', 'utf8');

test('destination selection remains independent of governed awareness selection', () => {
  const selection = app.slice(app.indexOf('function selectGridlySearchResult'), app.indexOf('function getGridlyLiveDestinationSearchOptions'));
  assert.match(selection, /state\.selectedDestination = normalized/);
  assert.match(selection, /buildGridlyDestinationRoutePreview/);
  assert.doesNotMatch(selection, /gridlyApplyConfirmedHomePersonalization|saveGridlyHomeTownPreference|syncGridlyAwarenessAreaSurfacesImmediately/);
});

test('audit helper exposes independent authorities and route-corridor evidence', () => {
  assert.match(app, /window\.gridlyDestinationAuthorityAudit = function/);
  assert.match(app, /authority: "origin-to-destination route corridor"/);
  assert.match(app, /corridorWidthFeet: intelligence\?\.corridorWidthFeet/);
  assert.match(app, /matchedEvidence/);
  assert.match(app, /current activeHazards collection/);
  assert.match(app, /officialRoadways: "not directly queried by Destination Intelligence"/);
  assert.match(auditDoc, /destination-authority\/coverage defect/);
  assert.match(auditDoc, /Do not require destination selection to mutate awareness/);
  assert.match(auditDoc, /Do not declare Chambers PASS/);
});

test('direct authority reducer requires both Liberty and Chambers coverage', () => {
  const start = app.indexOf('function buildGridlyDestinationSourceAuthority');
  const end = app.indexOf('function getGridlyDestinationCoverageAuthorityContext', start);
  const context = {};
  vm.runInNewContext(`${app.slice(start, end)}; this.buildAuthority = buildGridlyDestinationSourceAuthority;`, context);
  const authority = context.buildAuthority({
    awarenessCountyId: 'liberty-tx',
    destinationCountyId: 'chambers-tx',
    alertsAvailable: true,
    communityReportsAvailable: true,
    hazardsAvailable: true,
    familyState: { officialRoadwaysState: 'ACTIVE', weatherState: 'ACTIVE' }
  });
  assert.deepEqual([...authority.routeCountyIds], ['liberty-tx', 'chambers-tx']);
  assert.deepEqual(
    [...authority.sourceFamilyAuthority.filter((family) => family.state === 'missing').map((family) => family.family)],
    ['destination_alerts', 'official_roadways', 'destination_weather', 'route_community_reports', 'route_hazards']
  );
  assert.equal(authority.sourceFamilyAuthority.find((family) => family.family === 'statewide_crossings').state, 'completed');
});

test('coverage cache is keyed by the complete semantic authority signature', () => {
  const cacheKey = app.slice(app.indexOf('function getGridlyDestinationRouteCacheKey'), app.indexOf('function getCachedGridlyDestinationRouteIntelligenceAudit'));
  assert.match(cacheKey, /destinationCoverageAuthoritySignature/);
  assert.match(app, /destinationIdentity, destinationCountyId, routeOriginAuthority, routeDestination, requiredCoverageScope/);
  assert.match(app, /destination coverage authority signature changed/);
  assert.match(app, /semantic authority signature unchanged/);
  for (const field of [
    'snapshotBuiltAt', 'snapshotGeneration', 'snapshotBuildReason',
    'snapshotAwarenessCountyId', 'snapshotDestinationCountyId', 'snapshotRouteCountyIds',
    'authorityReducerInput', 'authorityReducerOutput', 'snapshotPreserved',
    'snapshotPreservationReason', 'snapshotInvalidatedAt', 'snapshotInvalidationReason'
  ]) assert.match(app, new RegExp(field));
});

test('destination county resolution precedes coverage snapshot construction', () => {
  const contextBuilder = app.slice(app.indexOf('function getGridlyDestinationCoverageAuthorityContext'), app.indexOf('function getGridlyDestinationCoverageState'));
  assert.match(contextBuilder, /gridlyResolveCountyIdForCoordinate/);
  assert.match(contextBuilder, /selected\?\.countyId \|\| selected\?\.raw\?\.countyId \|\| coordinateCounty/);
});
