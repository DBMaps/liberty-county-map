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
assert.match(app, /recencyCapabilityCertification/, 'V915 exposes audit-only recency capability certification');
assert.match(app, /requiresLiveProviderEvidence:\s*false/, 'V915 recency certification does not require live provider events');

const sandbox = {
  window: {},
  document: undefined,
  activeHazards: [],
  activeReports: [],
  safeDisplayText: (value, fallback = '') => String(value ?? fallback),
  getGridlyCanonicalAwarenessPresentationContext: () => ({ label: 'Liberty County' }),
  exposeGridlyAuditHelper: () => {},
  gridlyBriefInteractionText: (selector) => selector === '#gridlyV2TopStatusPrimary' ? 'Your area is clear right now' : '',
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
assert.strictEqual(audit.recencyCapabilityCertification.communityRecencySignal, true);
assert.strictEqual(audit.recencyCapabilityCertification.quietSuppressionSafe, true, 'quiet/routine suppression stays certified without live provider events');
assert.strictEqual(audit.recencyCapabilityCertification.requiresLiveProviderEvidence, false);
assert.strictEqual(audit.reinforcingEvidencePass, true);
assert.strictEqual(audit.conflictingEvidencePass, true);
assert.strictEqual(audit.singlePrimaryStoryPass, true);
assert.strictEqual(audit.consumerLanguagePass, true);
assert.strictEqual(audit.providerNamesSuppressed, true);
assert.strictEqual(audit.technicalTermsSuppressed, true);
assert.strictEqual(audit.protectedSystemsUnchanged, true);

assert.strictEqual(sandbox.activeHazards.length, 0, 'recency certification does not require live active hazards');
assert.strictEqual(sandbox.activeReports.length, 0, 'recency certification does not require live active reports');
assert.deepStrictEqual(sandbox.window.gridlyDriveTexasConnector.getNormalizedRecords(), [], 'recency certification does not require live transportation records');
assert.strictEqual(audit.scenarioTemplates.routineSuppressed, 'no_active_concerns', 'test covers quiet no-live-provider state rather than a narrow quiet_conditions template');

for (const key of ['communityOnly', 'weatherOnly', 'transportationOnly', 'railOnly', 'communityWeather', 'communityTransportation', 'communityRail', 'weatherTransportation', 'transportationRail', 'communityWeatherTransportation', 'allEvidence']) {
  assert.ok(audit.scenarioTemplates[key], `scenario template exists: ${key}`);
}

for (const section of ['Executive Summary', 'Scope', 'Non-goals', 'Current evidence sources', 'Current Story Engine ranking behavior', 'Evidence precedence analysis', 'Confidence interaction', 'Recency interaction', 'Multi-evidence interaction', 'Reinforcing evidence behavior', 'Conflicting evidence behavior', 'Consumer-language consistency', 'Risks / observations', 'Recommended canonical ranking model', 'Final recommendation']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}

console.log('V915 trust evidence ranking certification test passed');
