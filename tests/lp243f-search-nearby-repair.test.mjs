import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const poi = fs.readFileSync(new URL('../js/gridlyPoiBrowserProvider.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');

test('initial and reset states are neutral while completed empty searches retain feedback', () => {
  const open = app.slice(app.indexOf('function showGridlySearchShell'), app.indexOf('function openGridlyDestinationSearchSurface'));
  const init = app.slice(app.indexOf('function initGridlySearchUI'), app.indexOf('function showGridlySearchShell'));
  assert.match(open, /else clearGridlySearchResults\(\)/);
  assert.match(init, /else clearGridlySearchResults\(\)/);
  assert.match(app, /options\?\.state === "done" && options\?\.allowEmptyMessage === true/);
  assert.match(app, /runGridlyLiveDestinationSearch[\s\S]+allowEmptyMessage: true/);
});

test('governed context biases unqualified ranking without constraining explicit searches', () => {
  const anchor = app.slice(app.indexOf('function getGridlySearchAnchorContext'), app.indexOf('function buildGridlySearchDisplayLines'));
  assert.match(anchor, /gridlyGetCurrentGovernedLocationContext/);
  assert.match(anchor, /source: "governed_location_context"/);
  assert.match(app, /explicitRemoteIntent/);
  assert.match(app, /intent\.type === GRIDLY_DESTINATION_INTENTS\.EXPLICIT_DESTINATION/);
});

test('Nearby Places owns a contained picker and consumer-safe copy', () => {
  assert.doesNotMatch(poi, /<select id="gridlyPoiCategory"/);
  assert.match(poi, /gridlyPoiCategoryPicker/);
  assert.match(css, /max-height:min\(42vh,280px\);overflow-y:auto/);
  assert.doesNotMatch(poi, /nearby places \(\$\{result\.rawEligibleCount\} eligible\)/);
  assert.doesNotMatch(poi, /Radius was not widened|No alternate source was used/);
});

test('all POI cards use the shared destination adapter with intact identity fields', () => {
  assert.match(poi, /item\.addEventListener\("click", \(\) => selectResult\(poi\)\)/);
  for (const field of ['id', 'displayName', 'gridlyCategory', 'latitude', 'longitude', 'countyContextId']) assert.match(poi, new RegExp(`${field}: poi\\.${field}`));
  assert.match(app, /window\.gridlySelectNearbyPlace/);
  assert.match(app, /selectGridlySearchResult\(normalized, \{ reason: "nearby-place-selected" \}\)/);
});

test('protected authority and route implementation are not redefined by this repair', () => {
  assert.match(poi, /gridly\.poi\.runtime\.v2/);
  assert.match(poi, /lp24111-d5-standalone-2026-08-28/);
  assert.match(app, /runtimeSchemaVersion: "gridly\.poi\.runtime\.v2"/);
});
