import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const required = [
  'gridlyV734RefreshReuseState',
  'gridlyV734BuildRefreshReuseSignature',
  'v734SharedModelReuseApplied',
  'portrait-localized-intelligence-reuse',
  'localizedFallbackSignature',
  'v734RenderReuseApplied',
  'refreshGridlyCommunityPulseSharedModel',
  'refreshPortraitV2LocalizedIntelligence',
  'renderUnifiedIncidents'
];
for (const token of required) assert(app.includes(token), `missing ${token}`);

assert.match(app, /if \(gridlyV734RefreshReuseState\.communityPulseSignature === signature && gridlyV734RefreshReuseState\.communityPulseModel\)/, 'Community Pulse shared model must reuse unchanged signature');
assert.match(app, /refreshGridlyCommunityPulseSharedModel\(\{ reason: "portrait-localized-intelligence-reuse"/, 'portrait localized intelligence must consume shared model');
assert.match(app, /gridlyV734RefreshReuseState\.localizedFallbackSignature === fallbackSignature/, 'category-only fallback cache must be signature-gated');
assert.match(app, /existingLayerCount > 0/, 'renderUnifiedIncidents skip must require existing marker layer content');

const protectedExpectations = [
  ['historicalReadsEnabled', /historicalReadsEnabled:\s*false/],
  ['historyUiEnabled', /historyUiEnabled:\s*false/],
  ['DriveTexasPaused', /DriveTexasPaused:\s*true/],
  ['TransportationIntelligenceEnabled', /TransportationIntelligenceEnabled:\s*false/],
  ['TransportationIntelligenceDisplay', /TransportationIntelligenceDisplay:\s*false/],
  ['TransportationIntelligenceActivation', /TransportationIntelligenceActivation:\s*false/]
];
for (const [name, pattern] of protectedExpectations) assert.match(app, pattern, `${name} protected flag changed or missing`);

const doc = fs.readFileSync('GRIDLY-V734-LIBERTY-REFRESH-PERFORMANCE-REUSE-FIX.md', 'utf8');
assert(doc.includes('LIBERTY REFRESH PERFORMANCE REUSE FIX'), 'determination heading missing');
assert(doc.includes('PASS WITH OBSERVATIONS'), 'determination must be recorded');

const evidence = JSON.parse(fs.readFileSync('assets/county-implementation/liberty/evidence/v734-liberty-refresh-performance-reuse-fix.json', 'utf8'));
assert.equal(evidence.version, 'V734');
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.countyBoundaries.Liberty, 'Launch Focus');
assert.equal(evidence.determination, 'PASS WITH OBSERVATIONS');

console.log('V734 Liberty refresh performance reuse validation passed');
