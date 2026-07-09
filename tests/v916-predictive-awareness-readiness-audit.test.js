const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V916-PREDICTIVE-AWARENESS-READINESS-AUDIT.md', 'utf8');

assert.match(app, /function gridlyPredictiveAwarenessReadinessAudit/, 'V916 audit function exists');
assert.match(app, /window\.gridlyPredictiveAwarenessReadinessAudit\s*=\s*gridlyPredictiveAwarenessReadinessAudit/, 'V916 audit helper is exposed');
assert.match(app, /predictionNotImplemented\s*=\s*true/, 'V916 confirms prediction behavior is not implemented');
assert.match(app, /storyEngineSingleOwner/, 'V916 confirms Story Engine ownership');
assert.match(app, /secondaryPredictiveDashboardAdded:\s*false/, 'V916 does not add a predictive dashboard');
assert.match(app, /competingPredictiveAlertsAdded:\s*false/, 'V916 does not add competing predictive alerts');

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
vm.runInContext(app.slice(start, end), sandbox, { filename: 'story-evidence-v916-slice.js' });

const audit = sandbox.gridlyPredictiveAwarenessReadinessAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.version, 'V916');
assert.strictEqual(audit.safeForBeta, true);
assert.strictEqual(audit.storyEngineAvailable, true);
assert.strictEqual(audit.evidenceExperienceAvailable, true);
assert.strictEqual(audit.trustRankingAvailable, true);
assert.strictEqual(audit.sufficientEvidenceForFuturePrediction, true);
assert.strictEqual(audit.recencyFoundationReady, true);
assert.strictEqual(audit.confidenceFoundationReady, true);
assert.strictEqual(audit.multiEvidenceFoundationReady, true);
assert.strictEqual(audit.consumerTrustPreserved, true);
assert.strictEqual(audit.predictionNotImplemented, true);
assert.strictEqual(audit.providerNamesSuppressed, true);
assert.strictEqual(audit.technicalTermsSuppressed, true);
assert.strictEqual(audit.protectedSystemsUnchanged, true);
assert.strictEqual(audit.storyEngineSingleOwner, true);
assert.strictEqual(audit.secondaryPredictiveDashboardAdded, false);
assert.strictEqual(audit.competingPredictiveAlertsAdded, false);

for (const key of ['heavyRainApproachingArea', 'increasingCommunityReports', 'multipleIndependentConfirmations', 'roadClosureWithReinforcingWeather', 'railCrossingRepeatedlyReportedBlocked', 'rapidIncreaseInRoadwayHazards']) {
  assert.strictEqual(audit.futureCandidateScenarios[key].architectureCouldSupportFutureEvaluation, true, `candidate ready for future evaluation: ${key}`);
  assert.strictEqual(audit.futureCandidateScenarios[key].predictionGenerated, false, `no prediction generated: ${key}`);
}

for (const phrase of ['Bridge is probably open.', 'Train has likely cleared.', 'Road is likely safe.', 'Any statement requiring unsupported certainty.']) {
  assert.ok(audit.neverPredictiveSituations.includes(phrase), `never-predictive phrase included: ${phrase}`);
}

for (const section of ['Executive Summary', 'Scope', 'Non-goals', 'Current Awareness Intelligence foundation', 'Current evidence quality', 'Trust considerations', 'Predictive readiness criteria', 'Data sufficiency review', 'Recency evaluation', 'Confidence evaluation', 'Multi-evidence readiness', 'Consumer communication risks', 'Situations appropriate for future predictive awareness', 'Situations that should never become predictive', 'Recommended governance', 'Final recommendation']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}

assert.ok(/does not|do not/i.test(doc), 'doc reinforces audit-only posture');
assert.ok(doc.includes('window.gridlyPredictiveAwarenessReadinessAudit?.()'), 'doc includes audit command');

console.log('V916 predictive awareness readiness audit test passed');
