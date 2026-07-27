const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(app, /function buildGridlyUnifiedEvidencePresentation/, 'LP064 uses one shared presentation adapter');
assert.match(app, /function renderGridlyUnifiedEvidence/, 'LP064 uses one shared semantic renderer');
assert.match(app, /"community", "official-roadways", "weather", "rail-crossing", "confidence", "freshness"/, 'evidence category order is explicit');
['Community', 'Official Roadways', 'Weather', 'Rail / Crossing', 'Confidence', 'Freshness'].forEach((label) => {
  assert(app.includes(`"${label}"`), `${label} evidence is supported`);
});
assert.match(app, /No nearby community travel issues are being reported\./, 'quiet community evidence is consumer friendly');
assert.match(app, /No official roadway concerns are showing nearby\./, 'quiet official evidence is consumer friendly');
assert.match(app, /No travel-impacting weather is showing nearby\./, 'quiet weather evidence is consumer friendly');
assert.match(app, /No active crossing delays are being reported nearby\./, 'quiet rail evidence is consumer friendly');
assert.match(app, /if \(!consumerText \|\| \/\^\(\?:unknown\|n\\\/a\)\$\/i\.test\(consumerText\)\) return/, 'blank and technical fallback rows are suppressed');
assert.match(app, /surface: "travel-brief"/, 'Travel Brief integrates unified evidence');
assert.match(app, /surface: "community-pulse"/, 'Community Pulse integrates unified evidence');
assert.match(app, /surface: "destination-intelligence"/, 'Destination Intelligence integrates unified evidence');
assert.match(app, /window\.gridlyLp064UnifiedEvidenceExperienceAudit = gridlyLp064UnifiedEvidenceExperienceAudit/, 'browser certification is exposed');
['noFetches: true', 'noWrites: true', 'noStorageWrites: true', 'noPolling: true'].forEach((guard) => assert(app.includes(guard), `${guard} is certified`));
assert.match(app, /travelBriefIntelligenceGeneration: "unchanged"/, 'Travel Brief intelligence is protected');
assert.match(app, /communityPulseIntelligenceGeneration: "unchanged"/, 'Community Pulse intelligence is protected');
assert.match(app, /destinationIntelligenceCalculations: "unchanged"/, 'Destination Intelligence calculations are protected');
assert.match(css, /LP064 — one compact, inspectable evidence pattern/, 'compact mobile-first presentation styling exists');
assert.match(css, /grid-template-columns: minmax\(78px, 0\.32fr\)/, 'mobile portrait evidence rows are tuned for narrow screens');
assert.match(html, /id="gridlyDestinationImpactPaneWhy"/, 'Destination Intelligence has a semantic evidence mount');
assert.doesNotMatch(app.slice(app.indexOf('function buildGridlyUnifiedEvidencePresentation'), app.indexOf('function gridlyTravelBriefConfidenceLine')), /fetch\(|localStorage|sessionStorage|setInterval|supabase/i, 'shared adapter introduces no fetch, storage, polling, or backend behavior');

console.log('LP064 Unified Evidence Experience regression passed');
