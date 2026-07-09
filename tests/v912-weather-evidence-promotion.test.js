const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/architecture/GRIDLY-WEATHER-EVIDENCE-PROMOTION-V1.md', 'utf8');

assert.match(app, /function gridlyStoryWeatherMeaningfulImpact/, 'meaningful weather classifier exists');
assert.match(app, /window\.gridlyWeatherEvidencePromotionAudit\s*=\s*gridlyWeatherEvidencePromotionAudit/, 'V912 audit helper is exposed');
assert.match(app, /currentWeatherSuppressed/, 'audit reports current weather suppression');
assert.match(app, /capabilityWeatherSuppressionPass/, 'audit reports capability weather suppression');
assert.match(app, /providerNamesExposed/, 'audit reports provider name exposure');
assert.match(app, /technicalTermsDetected/, 'audit reports technical term exposure');

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
vm.runInContext(app.slice(start, end), sandbox, { filename: 'story-evidence-slice.js' });

const quiet = sandbox.buildGridlyAwarenessStory({ records: [], weather: { summary: 'Sunny and pleasant', temperature: '76' } });
assert.strictEqual(quiet.evidence.weather, null, 'quiet weather is suppressed from story evidence');
assert.strictEqual(sandbox.gridlyBuildEvidenceExperienceModel(quiet).sections.some((section) => section.category === 'weather'), false, 'quiet weather is suppressed from evidence model');

const heavyRain = sandbox.buildGridlyAwarenessStory({ records: [], weather: { summary: 'Heavy rain in the area' } });
assert.strictEqual(heavyRain.situation, 'Heavy rain may slow travel.');
assert.strictEqual(heavyRain.recommendation, 'Drive with caution.');
assert.strictEqual(heavyRain.evidence.weather.detail, 'Heavy rain may affect local travel.');
assert.strictEqual(sandbox.gridlyBuildEvidenceExperienceModel(heavyRain).sections.some((section) => section.category === 'weather' && section.line === 'Heavy rain may affect local travel.'), true);

const fog = sandbox.buildGridlyAwarenessStory({ records: [], weather: { summary: 'Dense fog expected' } });
assert.strictEqual(fog.situation, 'Dense fog may reduce visibility.');
assert.strictEqual(fog.recommendation, 'Allow extra travel time.');

const audit = sandbox.gridlyWeatherEvidencePromotionAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.version, 'V912R1');
assert.strictEqual(audit.safeForBeta, true);
assert.strictEqual(audit.currentWeatherPromotedToStory, false);
assert.strictEqual(audit.currentWeatherPromotedToEvidence, false);
assert.strictEqual(audit.currentWeatherSuppressed, true);
assert.strictEqual(audit.currentWeatherEvidence, null);
assert.strictEqual(audit.capabilityWeatherPromotionPass, true);
assert.strictEqual(audit.capabilityWeatherEvidencePass, true);
assert.strictEqual(audit.capabilityWeatherSuppressionPass, true);
assert.strictEqual(audit.weatherPromotedToStory, true);
assert.strictEqual(audit.weatherPromotedToEvidence, true);
assert.strictEqual(audit.weatherSuppressedWhenIrrelevant, true);
assert.strictEqual(audit.legacyFieldsRepresentCapabilitySelfTest, true);
assert.strictEqual(audit.providerNamesExposed.length, 0);
assert.strictEqual(audit.technicalTermsDetected.length, 0);

for (const section of ['Mission', 'Weather philosophy', 'Promotion rules', 'Suppression rules', 'Story examples', 'Evidence examples', 'Consumer wording', 'Audit state model', 'Current State', 'Capability Self-Test', 'Future opportunities', 'Testing checklist', 'Merge placeholder']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}

console.log('V912 weather evidence promotion test passed');
