const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(repoRoot, 'js', 'gridlyDirectionalRuntimeCandidatePrototype.js');
const servicePath = path.join(repoRoot, 'js', 'gridlyDirectionalServiceLayer.js');
const consumerPath = path.join(repoRoot, 'js', 'gridlyDirectionalServiceConsumer.js');
const awarenessPath = path.join(repoRoot, 'js', 'gridlyDirectionalAwarenessLayer.js');
const evidencePath = path.join(repoRoot, 'assets', 'directional-intelligence', 'evidence', 'v704-directional-awareness-layer-implementation.json');
const indexPath = path.join(repoRoot, 'index.html');

const elements = {
  gridlyV2TopStatusPrimary: { textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
  gridlyV2TopStatusSecondary: { textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }
};
const context = {
  window: { setTimeout: (fn) => fn() },
  document: {
    readyState: 'complete',
    getElementById: (id) => elements[id] || null,
    addEventListener: () => {}
  }
};
context.window.window = context.window;
context.window.document = context.document;
vm.createContext(context);
[runtimePath, servicePath, consumerPath, awarenessPath].forEach((file) => {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

assert.strictEqual(typeof context.window.gridlyDirectionalAwarenessAudit, 'function', 'awareness audit helper is available');
assert.strictEqual(typeof context.window.gridlyDirectionalAwarenessCards, 'function', 'awareness cards helper is available');
assert.strictEqual(typeof context.window.gridlyDirectionalAwarenessLayerTestHarness, 'function', 'awareness test harness is available');

const audit = context.window.gridlyDirectionalAwarenessAudit();
// V705 changed directional visibility semantics from internal candidate-based
// visibility to actual DOM-visible directional wording. V706 confirmed that
// directional awareness can render first, then be displaced by Awareness Brief
// ownership after incident/community awareness hydration. Candidate generation
// and user-visible rendering are therefore intentionally validated separately.
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit)), {
  enabled: true,
  visibleDirectionalCards: 0,
  candidateCount: 164,
  reviewExcludedCount: 81,
  containmentPass: true,
  bearingProtectionPass: true,
  failClosedPass: true,
  displayFormat: 'corridor-first',
  userVisible: false,
  domDirectionalTextMatches: [],
  visibleDirectionalTextSamples: [],
  visibilitySource: 'none',
  candidateVisibilityMismatch: true
});
assert(audit.candidateCount > 0, 'candidate generation remains functional');
assert(audit.reviewExcludedCount >= 0, 'review exclusion reporting remains functional');
assert.strictEqual(audit.enabled, true, 'directional service remains enabled');
assert.strictEqual(audit.containmentPass, true, 'containment protections remain active');
assert.strictEqual(audit.bearingProtectionPass, true, 'bearing protections remain active');
assert.strictEqual(audit.failClosedPass, true, 'fail-closed protections remain active');
assert.strictEqual(audit.visibleDirectionalCards, 0, 'visibility reflects no DOM-visible directional wording');
assert.strictEqual(audit.userVisible, false, 'no DOM-visible directional wording is user-visible');
assert.strictEqual(audit.candidateVisibilityMismatch, true, 'candidate/service presence does not imply user-visible rendering');

const cards = context.window.gridlyDirectionalAwarenessCards();
assert.strictEqual(cards.length, 4, 'awareness cards render');
assert.strictEqual(elements.gridlyV2TopStatusPrimary.textContent, 'US 90 Westbound', 'top awareness header renders corridor-first');
assert.strictEqual(elements.gridlyV2TopStatusSecondary.textContent, 'Traffic impacts reported near Dayton.', 'top awareness body renders approved body copy');

cards.forEach((card) => {
  assert(/^(?:US \d+[A-Z]?|I-\d+[A-Z]?|FM \d+[A-Z]?|TX \d+[A-Z]?) (?:Northbound|Southbound|Eastbound|Westbound)$/.test(card.header), `corridor-first format enforced for ${card.header}`);
  assert(!/\b(?:NB|SB|EB|WB|toward|inbound|outbound)\b/i.test(card.header), `abbreviated or bearing-like direction is blocked for ${card.header}`);
});

const serviceState = context.window.gridlyDirectionalServiceLayerTestHarness({
  activeCounty: 'Liberty County',
  totalSegments: 245,
  strongCandidates: 164,
  reviewRequiredCandidates: 81,
  blockedCandidates: 0,
  bearingOnlyCandidates: 0,
  confidencePresent: true,
  sourceTraceable: true,
  evidencePresent: true,
  countyContained: true,
  countyAmbiguous: false,
  leakageDetected: false,
  reviewBucketDistribution: {
    reversible_lane: 7,
    construction_segment: 8,
    hov_hot_lane: 10,
    missing_county: 36,
    missing_oneway: 3,
    missing_ref: 0,
    manual_review_required: 17
  }
});
const consumerState = context.window.gridlyDirectionalServiceConsumerTestHarness(serviceState);
const strongOnly = context.window.gridlyDirectionalAwarenessLayerTestHarness(consumerState);
assert.strictEqual(strongOnly.visibleDirectionalCards, 4, 'strong-candidate-only visibility is allowed');
assert.strictEqual(strongOnly.candidateCount, 164, 'strong candidate count is preserved');
assert.strictEqual(strongOnly.excludedCount, 81, 'review buckets remain excluded');
assert.deepStrictEqual(JSON.parse(JSON.stringify(strongOnly.reviewBuckets)), [
  'reversible_lane',
  'construction_segment',
  'hov_hot_lane',
  'missing_county',
  'missing_oneway',
  'missing_ref',
  'manual_review_required'
]);

const directionOnly = context.window.gridlyDirectionalAwarenessLayerTestHarness({
  audit: { serviceAvailable: true, safeForConsumerPhase: false, candidateCount: 164, reviewExcludedCount: 81, blockedCount: 0, countyContained: true, failClosedState: false },
  snapshot: { candidateCount: 164, containmentPass: true, failClosedPass: true }
});
assert.strictEqual(directionOnly.visibleDirectionalCards, 0, 'direction-only display blocked by consumer safety gate');
assert.strictEqual(directionOnly.userVisible, false, 'corridor-less display remains hidden');

const reviewEscape = context.window.gridlyDirectionalAwarenessLayerTestHarness({
  audit: { serviceAvailable: true, safeForConsumerPhase: false, candidateCount: 1, reviewExcludedCount: 81, blockedCount: 0, countyContained: true, failClosedState: false },
  snapshot: { candidateCount: 1, containmentPass: true, failClosedPass: true }
});
assert.strictEqual(reviewEscape.visibleDirectionalCards, 0, 'review buckets hidden');

const bearingOnlyService = context.window.gridlyDirectionalServiceLayerTestHarness({ ...serviceState.evidence, bearingOnlyCandidates: 1 });
const bearingOnly = context.window.gridlyDirectionalAwarenessLayerTestHarness(context.window.gridlyDirectionalServiceConsumerTestHarness(bearingOnlyService));
assert.strictEqual(bearingOnly.visibleDirectionalCards, 0, 'bearing-only hidden');
assert.strictEqual(bearingOnly.failClosedState, true, 'bearing-only fallback fails closed');

const containmentFailureService = context.window.gridlyDirectionalServiceLayerTestHarness({ ...serviceState.evidence, countyContained: false, countyAmbiguous: true, activeCounty: '' });
const containmentFailure = context.window.gridlyDirectionalAwarenessLayerTestHarness(context.window.gridlyDirectionalServiceConsumerTestHarness(containmentFailureService));
assert.strictEqual(containmentFailure.visibleDirectionalCards, 0, 'county containment enforced');
assert.strictEqual(containmentFailure.containmentPass, false, 'containment failure suppresses display');

[null, { audit: { serviceAvailable: false }, snapshot: {} }, context.window.gridlyDirectionalServiceConsumerTestHarness(context.window.gridlyDirectionalServiceLayerTestHarness({ ...serviceState.evidence, confidencePresent: false })), context.window.gridlyDirectionalServiceConsumerTestHarness(context.window.gridlyDirectionalServiceLayerTestHarness({ ...serviceState.evidence, sourceTraceable: false }))].forEach((state, index) => {
  const result = context.window.gridlyDirectionalAwarenessLayerTestHarness(state);
  assert.strictEqual(result.visibleDirectionalCards, 0, `fail-closed scenario ${index} shows zero directional cards`);
  assert.strictEqual(result.userVisible, false, `fail-closed scenario ${index} is not user-visible`);
});

const protectedState = context.window.gridlyDirectionalRuntimePrototypeProtectedState().protectedSystems;
assert.deepStrictEqual(JSON.parse(JSON.stringify(protectedState)), {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false
});

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.strictEqual(evidence.milestone, 'V704');
assert.strictEqual(evidence.renderedDirectionalCards, 4);
assert.strictEqual(evidence.candidateCount, 164);
assert.strictEqual(evidence.excludedCount, 81);
assert.strictEqual(evidence.containmentPass, true);
assert.strictEqual(evidence.bearingProtectionPass, true);
assert.strictEqual(evidence.failClosedPass, true);
assert.strictEqual(evidence.displayFormat, 'corridor-first');
assert.strictEqual(evidence.visibleToUsers, true);
assert.strictEqual(evidence.finalDetermination, 'DIRECTIONAL AWARENESS LAYER IMPLEMENTED WITH CONSTRAINTS');

const index = fs.readFileSync(indexPath, 'utf8');
assert(index.includes('js/gridlyDirectionalAwarenessLayer.js?v=704'), 'index loads V704 directional awareness layer');
assert(index.indexOf('js/gridlyDirectionalServiceConsumer.js?v=698') < index.indexOf('js/gridlyDirectionalAwarenessLayer.js?v=704'), 'awareness layer loads after service consumer');

console.log('V704 directional awareness layer implementation audit passed');
