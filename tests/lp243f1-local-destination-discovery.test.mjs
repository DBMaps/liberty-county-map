import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');

test('LP243.F7 has a unique production app asset identity in the expected script position', () => {
  const appAsset = '<script src="js/app.js?v=243f7-canonical-runtime-handoff"></script>';
  assert.deepEqual(index.match(/<script src="js\/app\.js\?v=[^"]+"><\/script>/g), [appAsset]);
  assert.ok(index.indexOf('js/gridlyAlertsWeatherAuthorityHandoff.js?v=2401g3') < index.indexOf(appAsset));
  assert.ok(index.indexOf(appAsset) < index.indexOf('js/gridlyDriveTexasGeometryAuthority.js?v=044'));
  assert.doesNotMatch(worker, /["']\.\/js\/app\.js/);
});

test('LP243.F1 acquires only textually relevant runtime-v2 POIs for unqualified business searches', () => {
  assert.match(app, /gridlyQueryAllowsRuntimePoiAcquisition[\s\S]*BUSINESS_PLACE[\s\S]*!gridlySearchQueryHasDestinationIndicator/);
  assert.match(app, /gridlyRuntimePoiMatchesQuery[\s\S]*queryTerms\.every\(\(term\) => candidateTerms\.has\(term\)\)/);
  assert.match(app, /requestForCurrentContext\(25\)/);
  assert.match(app, /provider:\s*"gridly\.poi\.runtime\.v2"/);
  assert.match(app, /runtimeSchemaVersion:\s*"gridly\.poi\.runtime\.v2"/);
});

test('LP243.F1 preserves explicit remote intent and blends before governed ranking and dedupe', () => {
  const classifier = app.slice(app.indexOf('function classifyGridlyDestinationSearchIntent'), app.indexOf('function getGridlySelectedHomeTownAnchor'));
  assert.match(classifier, /businessIntent && explicitDestination[\s\S]*business_with_destination_indicator/, 'explicit geography overrides an otherwise-business query');
  const pipeline = app.slice(app.indexOf('async function gridlySearchAddress'), app.indexOf('window.gridlyAggregateAddressVariantOutcomes'));
  assert.ok(pipeline.indexOf('searchGridlyRuntimePoiCandidates') < pipeline.indexOf('prioritizeGridlySearchResults'), 'candidate acquisition precedes ranking');
  assert.ok(pipeline.indexOf('prioritizeGridlySearchResults') < pipeline.indexOf('dedupeGridlySearchResults'), 'existing ranking and governed dedupe remain authoritative');
});

test('LP243.F1 internal diagnostics certify candidate stage counts without consumer copy', () => {
  for (const field of ['generalProviderCandidateCount', 'localPoiCandidateCount', 'mergedCandidateCount', 'deduplicatedCandidateCount', 'finalDisplayedCandidateCount']) {
    assert.match(app, new RegExp(`diagnostics\\.${field}`));
  }
});

test('LP243.F1 does not change route, state, or runtime-v2 materialization authority', () => {
  const bridge = app.slice(app.indexOf('function gridlyQueryAllowsRuntimePoiAcquisition'), app.indexOf('function buildGridlySearchQueryVariants'));
  assert.doesNotMatch(bridge, /buildGridlyDestinationRoutePreview|setGridlySelectedAwarenessArea|GRIDLY_ACTIVE_COUNTY_ID|manifest|shard|taxonomy|materializ/i);
});
