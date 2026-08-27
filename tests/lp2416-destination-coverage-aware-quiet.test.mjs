import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const requiredSource = app.match(/const GRIDLY_DESTINATION_REQUIRED_QUIET_SOURCES[\s\S]*?\n\]\);/)?.[0];
const reducerSource = app.match(/function buildGridlyDestinationCoverageState\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(requiredSource && reducerSource, 'coverage contract is present');
const context = {};
vm.runInNewContext(`${requiredSource}\n${reducerSource}\nthis.reduceCoverage = buildGridlyDestinationCoverageState;`, context);
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
  const coverage = app.slice(app.indexOf('function getGridlyDestinationCoverageState'), app.indexOf('if (typeof window !== "undefined") window.gridlyBuildDestinationCoverageState'));
  assert.match(coverage, /destinationCountyId === awarenessCountyId/);
  assert.doesNotMatch(coverage, /saveGridlyHomeTownPreference|gridlyApplyConfirmedHomePersonalization|syncGridlyAwarenessAreaSurfacesImmediately/);
  assert.match(app, /destinationCountyId,/);
  assert.match(app, /currentAwareness: Object\.freeze/);
});

test('H: statewide crossings remain a completed route-corridor family', () => {
  assert.match(app, /const completed = \["statewide_crossings"\]/);
  assert.match(app, /crossings: "statewide crossings route-corridor matches"/);
  assert.match(app, /\.\.\.summarizeEvidence\(intelligence\?\.matchedCrossings, "crossings"\)/);
});
