import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');

const requiredTokens = [
  'active_condition_intelligence.hazard_count_consistency_model',
  'active_condition_intelligence.location_card_count_model',
  'localized_intelligence_build.category_only_fallback',
  'awareness_narrative_story_assembly.evidence_ownership',
  'road_crossing_location_lookup.route_context',
  'dom_sync.location_awareness_panel',
  'awarenessHazardCountSignature',
  'v735SignatureReuseApplied',
  'v735HazardCountModelReuseApplied',
  'portrait-localized-intelligence-reuse'
];
for (const token of requiredTokens) assert(app.includes(token), `missing V735 implementation token: ${token}`);

assert.match(app, /gridlyV734RefreshReuseState\.awarenessHazardCountSignature === signature && gridlyV734RefreshReuseState\.awarenessHazardCountModel/, 'hazard count consistency model must be signature-reused');
assert.match(app, /refreshGridlyPortraitLocationAwarenessPanel\(\{ \.\.\.textModel, breakdownSections: sections \}\)/, 'location awareness panel must contribute nested timing sections');
assert.match(app, /buildGridlyPortraitSharedLocalizedIntelligenceSnapshot\(\{[\s\S]*breakdownSections: sections,[\s\S]*breakdownCounts: counts[\s\S]*\}\)/, 'shared localized intelligence builder must receive timing/count sinks');

const forbiddenDispatchBoardChange = /Dispatch Board.*V735|V735.*Dispatch Board/i;
assert.doesNotMatch(app, forbiddenDispatchBoardChange, 'V735 must not modify Dispatch Board behavior');

const protectedExpectations = [
  ['historicalReadsEnabled', /historicalReadsEnabled:\s*false/],
  ['historyUiEnabled', /historyUiEnabled:\s*false/],
  ['DriveTexasPaused', /DriveTexasPaused:\s*true/],
  ['TransportationIntelligenceEnabled', /TransportationIntelligenceEnabled:\s*false/],
  ['TransportationIntelligenceDisplay', /TransportationIntelligenceDisplay:\s*false/],
  ['TransportationIntelligenceActivation', /TransportationIntelligenceActivation:\s*false/]
];
for (const [name, pattern] of protectedExpectations) assert.match(app, pattern, `${name} protected flag changed or missing`);

const report = fs.readFileSync('GRIDLY-V735-LIBERTY-PORTRAIT-LOCALIZED-INTELLIGENCE-PERFORMANCE-ISOLATION.md', 'utf8');
for (const heading of [
  'Final determination',
  'Root cause found',
  'Exact slow nested section',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Performance expectation',
  'Browser/physical-device validation steps for Denise',
  'Merge recommendation'
]) assert(report.includes(`## ${heading}`), `missing report section: ${heading}`);

const evidence = JSON.parse(fs.readFileSync('assets/evidence/v735-liberty-portrait-localized-intelligence-performance-isolation.json', 'utf8'));
assert.equal(evidence.version, 'V735');
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);
assert.equal(evidence.optimization.signatureReuseTarget, 'buildGridlyAwarenessHazardCountConsistencyModel');
assert.equal(evidence.launchReadinessClaimed, false);

console.log('V735 Liberty portrait localized intelligence performance isolation validation passed');
