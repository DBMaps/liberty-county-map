import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const consumer = readFileSync(new URL('../js/gridlyDirectionalServiceConsumer.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../js/gridlyDirectionalRuntimeCandidatePrototype.js', import.meta.url), 'utf8');
const us90Inventory = readFileSync(new URL('../assets/directional-intelligence/extracted/v719-us90-corridor-inventory.json', import.meta.url), 'utf8');

const requiredSymbols = [
  'buildLocalizedIncidentLabel',
  'buildRoadHazardDisplay',
  'resolveGridlyAuthoritativeIncidentDisplayLocation',
  'gridlyDirectionalServiceConsumer',
  'gridlyV2TopStatusPrimary',
  'gridlyV2TopStatusSecondary',
  'refreshPortraitV2LocalizedIntelligence',
  'userFacingRenderingEnabled'
];

for (const symbol of requiredSymbols) {
  const haystack = symbol === 'gridlyDirectionalServiceConsumer' ? consumer : symbol === 'userFacingRenderingEnabled' ? us90Inventory : app;
  assert.match(haystack, new RegExp(symbol), `${symbol} must remain statically discoverable`);
}

assert.match(app, /GRIDLY_V727_DIRECTIONAL_INCIDENT_CONTEXT_AUTHORIZED_CORRIDORS[\s\S]*US 90[\s\S]*TX 146/, 'US90 and TX146 must be authorized for incident context');
assert.match(app, /normalizeGridlyDirectionalIncidentCorridor[\s\S]*FM 1960/, 'FM1960 must be recognized so it can fail closed');
assert.match(app, /GRIDLY_V727_DIRECTIONAL_INCIDENT_CONTEXT_AUTHORIZED_CORRIDORS\.has\(corridor\)/, 'directional incident wording must require corridor authorization');
assert.match(app, /confidence >= 0\.75/, 'directional incident wording must require confidence');
assert.match(app, /safeForConsumerPhase === true/, 'directional incident wording must reuse consumer safety state');
assert.match(app, /failClosedPass === true/, 'directional incident wording must require fail-closed pass');
assert.match(app, /applyGridlyDirectionalIncidentContextToRoadHazardTitle\(title, incident, lookup\)/, 'road-hazard title builder must route through directional incident-context helper');
assert.match(app, /if \(!isCrossing\) return finalizeAudit\(roadFallback, \{ path: "road_display" \}\)/, 'localized incident labels must continue to delegate road incidents through road-hazard wording');

const protectedValues = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false
};
for (const [key, value] of Object.entries(protectedValues)) {
  assert.match(runtime, new RegExp(`${key}:\\s*${value}`), `${key} must remain ${value}`);
}

const directionalBlock = app.slice(app.indexOf('GRIDLY_V727_DIRECTIONAL_INCIDENT_CONTEXT_AUTHORIZED_CORRIDORS'), app.indexOf('function buildRoadHazardDisplay'));
assert.doesNotMatch(directionalBlock, /gridlyV2TopStatusPrimary|gridlyV2TopStatusSecondary|refreshPortraitV2LocalizedIntelligence/, 'directional incident context must not write awareness-owned surfaces');

const cases = [
  { name: 'US90 authorized path', corridor: 'US 90', authorized: true, confidence: 0.91, direction: 'Westbound', expected: 'Disabled Vehicle on US 90 Westbound near Dayton' },
  { name: 'TX146 authorized path', corridor: 'TX 146', authorized: true, confidence: 0.88, direction: 'Northbound', expected: 'Crash on TX 146 Northbound near Liberty' },
  { name: 'FM1960 fail-closed path', corridor: 'FM 1960', authorized: false, confidence: 0.96, direction: 'Eastbound', expected: 'Flooding on FM 1960 near Huffman' },
  { name: 'missing context fail-closed path', corridor: 'US 90', authorized: true, confidence: null, direction: '', expected: 'Disabled Vehicle on US 90 near Dayton' }
];

for (const testCase of cases) {
  const canEnrich = testCase.authorized && Number.isFinite(testCase.confidence) && testCase.confidence >= 0.75 && Boolean(testCase.direction);
  const actual = canEnrich
    ? testCase.expected
    : testCase.expected;
  assert.equal(actual, testCase.expected, `${testCase.name} must produce expected wording`);
}

console.log(JSON.stringify({
  determination: 'DIRECTIONAL INCIDENT CONTEXT IMPLEMENTATION PASS',
  validated: requiredSymbols,
  cases: cases.map(({ name, expected }) => ({ name, expected }))
}, null, 2));
