import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const requiredSource = app.match(/const GRIDLY_DESTINATION_REQUIRED_QUIET_SOURCES[\s\S]*?\n\]\);/)?.[0];
const reducerSource = app.match(/function buildGridlyDestinationCoverageState\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
const authoritySource = app.match(/function buildGridlyDestinationSourceAuthority\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(requiredSource && reducerSource && authoritySource, 'coverage contract is present');
const context = {};
vm.runInNewContext(`${requiredSource}\n${reducerSource}\n${authoritySource}\nthis.reduceCoverage = buildGridlyDestinationCoverageState; this.buildAuthority = buildGridlyDestinationSourceAuthority;`, context);
const required = ['destination_alerts', 'official_roadways', 'destination_weather', 'route_community_reports', 'route_hazards', 'statewide_crossings'];

test('A: all required destination and route authorities permit complete coverage', () => {
  assert.equal(context.reduceCoverage({ completedSourceFamilies: required }).coverageState, 'COVERAGE_COMPLETE');
  assert.match(app, /quietAllowed = quiet && coverageSnapshot\.coverageState === "COVERAGE_COMPLETE"/);
});

test('B/C: missing destination Alerts or unavailable required Weather cannot support quiet', () => {
  const alertsMissing = context.reduceCoverage({ completedSourceFamilies: required.filter((family) => family !== 'destination_alerts') });
  assert.equal(alertsMissing.coverageState, 'COVERAGE_PARTIAL');
  assert.deepEqual([...alertsMissing.missingSourceFamilies], ['destination_alerts']);
  const weatherFailed = context.reduceCoverage({ completedSourceFamilies: required.filter((family) => family !== 'destination_weather'), failedSourceFamilies: ['destination_weather'] });
  assert.equal(weatherFailed.coverageState, 'COVERAGE_UNAVAILABLE');
  assert.deepEqual([...weatherFailed.failedSourceFamilies], ['destination_weather']);
  assert.match(app, /Route conditions are still being checked\./);
});

test('D: impact decision remains independent of incomplete coverage', () => {
  assert.match(app, /state: quietAllowed \? "quiet" : quiet \? "incomplete" : multiple \? "multiple" : "active"/);
  assert.match(app, /if \(quiet && !quietAllowed\)/);
});

test('E/F/G: destination coverage observes county identity without mutating awareness', () => {
  const coverage = app.slice(app.indexOf('function getGridlyDestinationCoverageState'), app.indexOf('function buildGridlyDestinationDecisionPresentation'));
  assert.match(authoritySource, /destinationCountyId === awarenessCountyId/);
  assert.doesNotMatch(coverage, /saveGridlyHomeTownPreference|gridlyApplyConfirmedHomePersonalization|syncGridlyAwarenessAreaSurfacesImmediately/);
  assert.match(app, /destinationCountyId,/);
  assert.match(app, /currentAwareness: Object\.freeze/);
});

test('H: statewide crossings remain a completed route-corridor family', () => {
  assert.match(authoritySource, /family: "statewide_crossings"[\s\S]*?state: "completed"/);
  assert.match(app, /crossings: "statewide crossings route-corridor matches"/);
  assert.match(app, /\.\.\.summarizeEvidence\(intelligence\?\.matchedCrossings, "crossings"\)/);
});

test('I: Dayton to Chambers cannot promote Liberty collections into cross-county authority', () => {
  const authority = context.buildAuthority({
    awarenessCountyId: 'liberty-tx',
    destinationCountyId: 'chambers-tx',
    alertsAvailable: true,
    communityReportsAvailable: true,
    hazardsAvailable: true,
    familyState: { officialRoadwaysState: 'QUIET', weatherState: 'QUIET' }
  });
  assert.deepEqual([...authority.routeCountyIds], ['liberty-tx', 'chambers-tx']);
  const states = Object.fromEntries(authority.sourceFamilyAuthority.map(({ family, state }) => [family, state]));
  assert.deepEqual(states, {
    destination_alerts: 'missing',
    official_roadways: 'missing',
    destination_weather: 'missing',
    route_community_reports: 'missing',
    route_hazards: 'missing',
    statewide_crossings: 'completed'
  });
  const coverage = context.reduceCoverage({
    completedSourceFamilies: authority.sourceFamilyAuthority.filter(({ state }) => state === 'completed').map(({ family }) => family),
    failedSourceFamilies: authority.sourceFamilyAuthority.filter(({ state }) => state === 'failed').map(({ family }) => family)
  });
  assert.equal(coverage.coverageState, 'COVERAGE_PARTIAL');
  assert.match(app, /interpretation = coverageSnapshot\.coverageState === "COVERAGE_UNAVAILABLE"[\s\S]*?: "Route conditions are still being checked\."/);
});

test('J: same-county acquired families can complete and provider failure is unavailable', () => {
  const sameCounty = context.buildAuthority({
    awarenessCountyId: 'liberty-tx', destinationCountyId: 'liberty-tx', alertsAvailable: true,
    communityReportsAvailable: true, hazardsAvailable: true,
    familyState: { officialRoadwaysState: 'QUIET', weatherState: 'ACTIVE' }
  });
  assert.ok(sameCounty.sourceFamilyAuthority.every(({ state }) => state === 'completed'));
  const complete = context.reduceCoverage({ completedSourceFamilies: sameCounty.sourceFamilyAuthority.map(({ family }) => family) });
  assert.equal(complete.coverageState, 'COVERAGE_COMPLETE');

  const failed = context.buildAuthority({
    awarenessCountyId: 'liberty-tx', destinationCountyId: 'liberty-tx', alertsAvailable: true,
    communityReportsAvailable: true, hazardsAvailable: true,
    familyState: { officialRoadwaysState: 'QUIET', weatherState: 'UNAVAILABLE' }
  });
  const failedCoverage = context.reduceCoverage({
    completedSourceFamilies: failed.sourceFamilyAuthority.filter(({ state }) => state === 'completed').map(({ family }) => family),
    failedSourceFamilies: failed.sourceFamilyAuthority.filter(({ state }) => state === 'failed').map(({ family }) => family)
  });
  assert.equal(failedCoverage.coverageState, 'COVERAGE_UNAVAILABLE');
});

test('K: audit exposes scope, required and observed authority, and completion reason per family', () => {
  for (const field of ['scopeType', 'requiredAuthority', 'requiredCountyIds', 'observedAuthority', 'observedCountyIds', 'completionReason', 'state']) {
    assert.match(authoritySource, new RegExp(`\\b${field}\\b`));
  }
  assert.match(app, /sourceFamilyAuthority: coverage\.sourceFamilyAuthority/);
});
