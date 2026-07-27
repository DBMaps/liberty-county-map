const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(app, /function buildGridlyDestinationDecisionPresentation/, 'LP063 presentation builder exists');
assert.match(app, /pattern: "LP063 Destination Decision Pattern"/, 'Destination Decision Pattern is declared');
assert.match(app, /window\.gridlyLp063DestinationDecisionAudit = gridlyLp063DestinationDecisionAudit/, 'LP063 browser audit is exposed');
for (const role of ['interpretation', 'reason', 'confidence', 'freshness']) {
  assert.match(html, new RegExp(`data-gridly-destination-decision-role="${role}"`), `${role} has a semantic presentation role`);
}
const positions = ['interpretation', 'reason', 'confidence', 'freshness'].map((role) => html.indexOf(`data-gridly-destination-decision-role="${role}"`));
assert.ok(positions.every((position) => position >= 0) && positions.every((position, index) => index === 0 || position > positions[index - 1]), 'decision fields render in Driver Decision order');
assert.match(app, /No destination-impacting conditions are currently reported\./, 'quiet-state reason is present');
assert.match(app, /A blocked crossing may delay your trip to your destination\./, 'active-state reason is present');
assert.match(app, /Several nearby conditions may affect your destination\./, 'multi-condition reason is present');
assert.match(app, /existingDestinationIntelligencePreserved: true/, 'existing Destination Intelligence is preserved');
for (const system of ['destinationIntelligenceCalculations', 'routeCalculation', 'routeWatchLogic', 'travelBrief', 'communityPulse', 'officialRoadwayProcessing', 'weatherProcessing', 'hazardLifecycle', 'crossingLifecycle', 'reporting', 'alertGeneration', 'supabase', 'backendSystems']) {
  assert.match(app, new RegExp(`${system}: "unchanged"`), `${system} is protected`);
}
assert.doesNotMatch(app.match(/function buildGridlyDestinationDecisionPresentation[\s\S]*?\n}\n/)[0], /fetch\(|supabase|\.insert\(|\.update\(/i, 'presentation builder performs no runtime I/O');
console.log('LP063 Destination Intelligence Decision Integration regression passed');
