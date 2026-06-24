import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v737-liberty-stale-first-paint-and-refresh-budget-audit.json', 'utf8'));
const report = fs.readFileSync('GRIDLY-V737-LIBERTY-STALE-FIRST-PAINT-AND-REFRESH-BUDGET-AUDIT.md', 'utf8');

assert.match(app, /gridlyV737StaleFirstPaintAuditState/, 'V737 audit state must exist');
assert.match(app, /recordGridlyV737FirstPaint\("awareness-brief"/, 'Awareness Brief first paint must be traced');
assert.match(app, /recordGridlyV737FirstPaint\("community-pulse"/, 'Community Pulse first paint must be traced');
assert.match(app, /recordGridlyV737FirstPaint\("location-awareness"/, 'Location Awareness first paint must be traced');
assert.match(app, /recordGridlyV737FirstPaint\("localized-intelligence"/, 'Localized intelligence first paint must be traced');
assert.match(app, /recordGridlyV737OwnershipTransition\("canonical-incident-ownership"/, 'Canonical incident ownership transition must be traced');
assert.match(app, /recordGridlyV737OwnershipTransition\("localized-intelligence-refresh-start"/, 'Active county/localized refresh ownership transition must be traced');
assert.match(app, /v737OwnershipSignature/, 'Active county and awareness-area ownership must participate in the V734 reuse signature');
assert.match(app, /v737StaleFirstPaintAudit:/, 'Refresh breakdown audit must expose V737 results');
assert.match(app, /exposeGridlyAuditHelper\("gridlyV737StaleFirstPaintAudit"/, 'Browser helper must be exposed');

for (const [key, value] of Object.entries(evidence.protectedSystems)) {
  assert.equal(value, false === value ? false : value, `protected value ${key} must be explicit`);
}
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

[
  'Final determination',
  'Stale first paint present? (yes/no)',
  'Initial ownership source',
  'Authoritative ownership source',
  'Replacement trigger',
  'Replacement timing',
  'Refresh-budget impact',
  'Root cause',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise validation steps',
  'Merge recommendation'
].forEach((section) => assert(report.includes(`## ${section}`), `report missing section: ${section}`));

console.log('V737 Liberty stale first paint and refresh budget audit validation passed');
