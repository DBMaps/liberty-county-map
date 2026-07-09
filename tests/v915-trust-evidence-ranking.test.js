const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V915-TRUST-EVIDENCE-RANKING.md', 'utf8');

assert.match(app, /function gridlyTrustEvidenceRankingAudit/, 'V915 audit function exists');
assert.match(app, /window\.gridlyTrustEvidenceRankingAudit\s*=\s*gridlyTrustEvidenceRankingAudit/, 'V915 audit helper is exposed');
assert.match(app, /singlePrimaryStoryPass/, 'V915 validates one primary story');
assert.match(app, /reinforcingEvidencePass/, 'V915 validates reinforcing evidence');
assert.match(app, /conflictingEvidencePass/, 'V915 validates conflicting evidence');

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
  gridlyCommunityViewportCrossingStabilizationAudit: () => ({ safeForBeta: true }),
  gridlyPortraitStabilitySmokeAudit: () => ({ available: true, isStrictPortraitMobile: true, pass: true }),
  gridlyPortraitSpatialOwnershipAudit: () => ({ available: true, pass: true })
};
sandbox.window = sandbox;
sandbox.window.gridlyDriveTexasConnector = { getNormalizedRecords: () => [] };
const start = app.indexOf('const GRIDLY_STORY_ENGINE_VERSION = "V910";');
const end = app.indexOf('function gridlyBriefInteractionBuildModel()');
vm.createContext(sandbox);
vm.runInContext(app.slice(start, end), sandbox, { filename: 'story-evidence-v915-slice.js' });

const audit = sandbox.gridlyTrustEvidenceRankingAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.version, 'V915');
assert.strictEqual(audit.safeForBeta, true);
assert.strictEqual(audit.storyEngineAvailable, true);
assert.strictEqual(audit.evidenceExperienceAvailable, true);
assert.strictEqual(audit.communityRankingAvailable, true);
assert.strictEqual(audit.weatherRankingAvailable, true);
assert.strictEqual(audit.transportationRankingAvailable, true);
assert.strictEqual(audit.railRankingAvailable, true);
assert.strictEqual(audit.confidenceRankingPass, true);
assert.strictEqual(audit.recencyRankingPass, true);
assert.strictEqual(audit.reinforcingEvidencePass, true);
assert.strictEqual(audit.conflictingEvidencePass, true);
assert.strictEqual(audit.singlePrimaryStoryPass, true);
assert.strictEqual(audit.consumerLanguagePass, true);
assert.strictEqual(audit.providerNamesSuppressed, true);
assert.strictEqual(audit.technicalTermsSuppressed, true);
assert.strictEqual(audit.protectedSystemsUnchanged, true);

for (const key of ['communityOnly', 'weatherOnly', 'transportationOnly', 'railOnly', 'communityWeather', 'communityTransportation', 'communityRail', 'weatherTransportation', 'transportationRail', 'communityWeatherTransportation', 'allEvidence']) {
  assert.ok(audit.scenarioTemplates[key], `scenario template exists: ${key}`);
}

for (const section of ['Executive Summary', 'Scope', 'Non-goals', 'Current evidence sources', 'Current Story Engine ranking behavior', 'Evidence precedence analysis', 'Confidence interaction', 'Recency interaction', 'Multi-evidence interaction', 'Reinforcing evidence behavior', 'Conflicting evidence behavior', 'Consumer-language consistency', 'Risks / observations', 'Recommended canonical ranking model', 'Final recommendation']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}

console.log('V915 trust evidence ranking certification test passed');
