const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V914-REGIONAL-AWARENESS-INTELLIGENCE-CERTIFICATION.md', 'utf8');

assert.match(app, /function gridlyRegionalAwarenessIntelligenceCertificationAudit/, 'V914 certification audit function exists');
assert.match(app, /window\.gridlyRegionalAwarenessIntelligenceCertificationAudit\s*=\s*gridlyRegionalAwarenessIntelligenceCertificationAudit/, 'V914 audit helper is exposed');
assert.match(app, /currentEvidenceState/, 'V914 audit reports current evidence state separately from capability');
assert.match(app, /normalized/, 'V914 forbidden technical terms include normalized');
assert.match(app, /schema/, 'V914 forbidden technical terms include schema');

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
  gridlyCommunityCoverageCompletionAudit: () => ({
    safeForBeta: true,
    operationalCountyCount: 28,
    communityAwareCountyCount: 28,
    configuredCommunityCount: 261,
    promotedCommunityCounts: { Liberty: 3, Hardin: 2, Jasper: 7, Newton: 5, Tyler: 7, Waller: 2, Austin: 2, Washington: 2, Brazos: 2, Grimes: 2, Wharton: 2, Colorado: 2, Fayette: 2, Lavaca: 2, Jackson: 2, Matagorda: 2, Calhoun: 2 }
  }),
  gridlyPortraitStabilitySmokeAudit: () => ({ available: true, isStrictPortraitMobile: true, majorProblems: ['transient-dom-condition'] }),
  gridlyPortraitSpatialOwnershipAudit: () => ({ available: true, pass: true, portraitSpatialOwnershipPass: true }),
  gridlyCommunityViewportCrossingStabilizationAudit: () => ({ safeForBeta: true })
};
sandbox.window = sandbox;
sandbox.window.gridlyDriveTexasConnector = { getNormalizedRecords: () => [] };
const start = app.indexOf('const GRIDLY_STORY_ENGINE_VERSION = "V910";');
const end = app.indexOf('function gridlyBriefInteractionBuildModel()');
vm.createContext(sandbox);
vm.runInContext(app.slice(start, end), sandbox, { filename: 'story-evidence-v914-slice.js' });

const audit = sandbox.gridlyRegionalAwarenessIntelligenceCertificationAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.version, 'V914');
assert.strictEqual(audit.safeForBeta, true);
assert.strictEqual(audit.operationalCountyCount, 28);
assert.strictEqual(audit.communityAwareCountyCount, 28);
assert.strictEqual(audit.configuredCommunityCount, 261);
assert.strictEqual(audit.storyEngineAvailable, true);
assert.strictEqual(audit.evidenceExperienceAvailable, true);
assert.strictEqual(audit.communityEvidenceAvailable, true);
assert.strictEqual(audit.weatherEvidenceAvailable, true);
assert.strictEqual(audit.transportationEvidenceAvailable, true);
assert.strictEqual(audit.railEvidenceAvailable, true);
assert.strictEqual(audit.consumerLanguagePass, true);
assert.strictEqual(audit.providerNamesSuppressed, true);
assert.strictEqual(audit.technicalTermsSuppressed, true);
assert.strictEqual(audit.multiEvidenceScenarioPass, true);
assert.strictEqual(audit.failClosedBehaviorPass, true);
assert.strictEqual(audit.mobilePortraitPass, true);
assert.strictEqual(audit.protectedSystemsUnchanged, true);
assert.strictEqual(audit.currentEvidenceState.weather.promotedToStory, false);
assert.strictEqual(audit.currentEvidenceState.weather.safelySuppressed, true);
assert.strictEqual(audit.currentEvidenceState.transportation.promotedToStory, false);
assert.strictEqual(audit.currentEvidenceState.transportation.safelySuppressed, true);

for (const section of ['Executive summary', 'Scope', 'Non-goals', 'Protected systems confirmation', 'Current regional baseline', 'Story Engine certification', 'Evidence Experience certification', 'Community evidence certification', 'Weather evidence certification', 'Transportation evidence certification', 'Rail/crossing evidence certification', 'Cross-county consistency review', 'Multi-evidence scenario review', 'Consumer language review', 'Confidence behavior review', 'Fail-closed behavior review', 'Mobile portrait review', 'Risks / observations', 'Final recommendation']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}

console.log('V914 regional awareness intelligence certification test passed');
