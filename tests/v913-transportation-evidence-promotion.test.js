const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/architecture/GRIDLY-TRANSPORTATION-EVIDENCE-PROMOTION-V1.md', 'utf8');

assert.match(app, /function gridlyStoryTransportationImpact/, 'meaningful transportation classifier exists');
assert.match(app, /window\.gridlyTransportationEvidencePromotionAudit\s*=\s*gridlyTransportationEvidencePromotionAudit/, 'V913 audit helper is exposed');
assert.match(app, /currentTransportationSuppressed/, 'audit reports current transportation suppression');
assert.match(app, /capabilityTransportationSuppressionPass/, 'audit reports capability transportation suppression');

const sandbox = {
  window: {},
  document: undefined,
  activeHazards: [],
  activeReports: [],
  safeDisplayText: (value, fallback = '') => String(value ?? fallback),
  getGridlyCanonicalAwarenessPresentationContext: () => ({ label: 'Liberty County' }),
  exposeGridlyAuditHelper: () => {},
  gridlyBriefInteractionText: () => '',
  gridlyBriefInteractionWeatherBridge: () => null,
  gridlyCommunityCoverageCompletionAudit: () => ({ safeForBeta: true }),
  gridlyCommunityViewportCrossingStabilizationAudit: () => ({ safeForBeta: true })
};
sandbox.window = sandbox;
const start = app.indexOf('const GRIDLY_STORY_ENGINE_VERSION = "V910";');
const end = app.indexOf('function gridlyBriefInteractionBuildModel()');
vm.createContext(sandbox);
vm.runInContext(app.slice(start, end), sandbox, { filename: 'story-evidence-v913-slice.js' });

const quiet = sandbox.buildGridlyAwarenessStory({ records: [], transportationRecords: [{ category: 'Routine maintenance', title: 'Minor shoulder work notice' }] });
assert.strictEqual(quiet.evidence.transportation, null, 'routine maintenance is suppressed from story evidence');
assert.strictEqual(sandbox.gridlyBuildEvidenceExperienceModel(quiet).sections.some((section) => section.category === 'transportation'), false, 'routine maintenance is suppressed from evidence model');

const closure = sandbox.buildGridlyAwarenessStory({ records: [], transportationRecords: [{ category: 'Road Closure', title: 'Road closed with detour nearby', routeName: 'US 90' }] });
assert.strictEqual(closure.situation, 'Road closure may affect nearby travel.');
assert.strictEqual(closure.recommendation, 'Expect detours.');
assert.strictEqual(closure.evidence.transportation.detail, 'Official roadway information supports this awareness.');
assert.strictEqual(sandbox.gridlyBuildEvidenceExperienceModel(closure).sections.some((section) => section.category === 'transportation' && section.line === 'Official roadway information supports this awareness.'), true);

const lane = sandbox.buildGridlyAwarenessStory({ records: [], transportationRecords: [{ category: 'Lane Closure', title: 'Right lane closed on highway' }] });
assert.strictEqual(lane.situation, 'Traffic may be slower nearby.');
assert.strictEqual(lane.recommendation, 'Allow extra travel time.');

const construction = sandbox.buildGridlyAwarenessStory({ records: [], transportationRecords: [{ category: 'Construction', title: 'Construction with lane restriction and delay' }] });
assert.strictEqual(construction.situation, 'Construction may affect travel.');
assert.strictEqual(construction.recommendation, 'Check your route before leaving.');

const audit = sandbox.gridlyTransportationEvidencePromotionAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.version, 'V913');
assert.strictEqual(audit.safeForBeta, true);
assert.strictEqual(audit.currentTransportationPromotedToStory, false);
assert.strictEqual(audit.currentTransportationPromotedToEvidence, false);
assert.strictEqual(audit.currentTransportationSuppressed, true);
assert.strictEqual(audit.currentTransportationEvidence, null);
assert.strictEqual(audit.capabilityTransportationPromotionPass, true);
assert.strictEqual(audit.capabilityTransportationEvidencePass, true);
assert.strictEqual(audit.capabilityTransportationSuppressionPass, true);
assert.strictEqual(audit.providerNamesExposed.length, 0);
assert.strictEqual(audit.technicalTermsDetected.length, 0);

for (const section of ['Mission', 'Transportation philosophy', 'Promotion rules', 'Suppression rules', 'Story examples', 'Evidence examples', 'Consumer wording', 'Future opportunities', 'Testing checklist', 'Merge recommendation placeholder']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}

console.log('V913 transportation evidence promotion test passed');
