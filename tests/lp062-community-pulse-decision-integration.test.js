const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /function buildGridlyCommunityPulseDecisionPresentation/, 'LP062 Community Pulse decision presentation builder exists');
assert.match(app, /pattern: "LP062 Community Pulse Decision Pattern"/, 'Community Decision Pattern is declared');
assert.match(app, /headline: interpretation/, 'Interpretation is the first visible Community Pulse decision line');
assert.match(app, /subline: `\$\{reason\} \$\{confidence\} · \$\{freshness\}\.`/, 'Reason, confidence, and freshness are ordered after interpretation');
assert.match(app, /dataset\.gridlyCommunityDecisionRole = "interpretation"/, 'Community Pulse DOM labels interpretation role');
assert.match(app, /dataset\.gridlyCommunityDecisionRole = "reason-confidence-freshness"/, 'Community Pulse DOM labels reason/confidence/freshness role');
assert.match(app, /existingCommunityPulseIntelligencePreserved: true/, 'Existing Community Pulse intelligence is explicitly preserved');
assert.match(app, /selectedCommunityCount/, 'Existing selected Community Pulse count remains part of the model');
assert.match(app, /buildCommunityPresenceDataset\(options\)/, 'Existing Community Pulse intelligence generation path is preserved');
assert.match(app, /buildGridlyLightweightActiveAwareness\(options\)/, 'Existing active-awareness source is preserved');
assert.match(app, /window\.gridlyLp062CommunityPulseDecisionAudit = gridlyLp062CommunityPulseDecisionAudit/, 'LP062 browser audit is exposed');
assert.match(app, /communityPulseIntelligenceGeneration: "unchanged"/, 'LP062 audit protects Community Pulse intelligence generation');
assert.match(app, /travelBrief: "unchanged"/, 'LP062 audit protects Travel Brief');
assert.match(app, /routeWatch: "unchanged"/, 'LP062 audit protects Route Watch');
assert.match(app, /destinationIntelligence: "unchanged"/, 'LP062 audit protects Destination Intelligence');
assert.match(app, /officialRoadwayProcessing: "unchanged"/, 'LP062 audit protects official roadway processing');
assert.match(app, /weatherProcessing: "unchanged"/, 'LP062 audit protects weather processing');
assert.match(app, /hazardLifecycle: "unchanged"/, 'LP062 audit protects hazard lifecycle');
assert.match(app, /crossingLifecycle: "unchanged"/, 'LP062 audit protects crossing lifecycle');
assert.match(app, /reporting: "unchanged"/, 'LP062 audit protects reporting');
assert.match(app, /alertGeneration: "unchanged"/, 'LP062 audit protects alert generation');
assert.match(app, /supabase: "unchanged"/, 'LP062 audit protects Supabase');

const helperBlock = app.slice(app.indexOf('function gridlyCommunityPulseDecisionFreshnessLine'), app.indexOf('function syncGridlyCommunityPulseCopyFromModel'));
const context = { Object, Array, Number, Math, Date, RegExp, String, console };
vm.createContext(context);
vm.runInContext(`
function safeDisplayText(value, fallback = '') { return String(value || fallback || '').trim(); }
${helperBlock}
`, context);

const quiet = context.buildGridlyCommunityPulseDecisionPresentation({ selectedCommunityCount: 0, activeAwareness: { activeAwarenessCount: 0 } });
assert.strictEqual(quiet.headline, 'Travel normally.', 'Quiet-state interpretation is first');
assert.match(quiet.subline, /No nearby community travel issues are being reported\. Quiet community activity · Checked just now\./, 'Quiet-state wording is validated');

const active = context.buildGridlyCommunityPulseDecisionPresentation({ selectedCommunityCount: 4, mobilityPressureCategory: 'building', activeAwareness: { activeAwarenessCount: 4, activeAwarenessSamples: [{ updatedAt: new Date().toISOString() }] } });
assert.strictEqual(active.headline, 'Check before leaving.', 'Active-state interpretation is first');
assert.match(active.subline, /Recent community reports suggest changing travel conditions\. Multiple recent reports · Updated just now\./, 'Active-state wording is validated');

const cleared = context.buildGridlyCommunityPulseDecisionPresentation({ selectedCommunityCount: 0, renderedPulseHeadline: 'Conditions improving.', renderedPulseSubline: 'Recently updated.', activeAwareness: { activeAwarenessCount: 0 } });
assert.strictEqual(cleared.headline, 'Stay aware.', 'Recently-cleared interpretation is first');
assert.match(cleared.subline, /Recent community reports suggest conditions may be improving\. Recently updated · Checked just now\./, 'Recently-cleared wording is validated without overstatement');
assert.doesNotMatch(`${quiet.headline} ${quiet.subline} ${active.headline} ${active.subline} ${cleared.headline} ${cleared.subline}`, /safe|guaranteed|all clear|certain/i, 'LP062 avoids overstating certainty');

console.log('LP062 Community Pulse Decision Integration regression passed');
