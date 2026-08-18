const assert = require('node:assert/strict');
const test = require('node:test');

const {
  reconcileGridlyActiveAwarenessWithSharedContract,
  recordGridlyActiveAwarenessWrite,
  gridlyActiveAwarenessWriterAudit
} = require('../js/gridlyActiveAwarenessConvergence.js');

function summary({ active = 0, crossing = 0, reports = 0, hazards = 0, official = 0, crossings = 70, area = 'place-4806128' } = {}) {
  return {
    crossingsInArea: Array.from({ length: crossings }, (_, id) => ({ id: `crossing-${id}` })),
    sourceBreakdown: null,
    sharedActiveIssueContract: {
      version: 'LP214_PHASE_2_2H', areaIdentity: area, activeIssueCount: active,
      activeOfficialRoadwayCount: official, activeCommunityReportCount: reports,
      activeCrossingIssueCount: crossing, activeOtherHazardCount: hazards,
      officialRoadwaySourceStatus: 'HEALTHY_EMPTY', quietEligible: active === 0
    }
  };
}

const legacyRail = {
  loaded: true, version: 'V179.5', runtimeMode: 'lightweight_only', activeAwarenessCount: 1,
  headline: 'Train blocking crossing.', subline: 'Allow extra travel time.', resolvedCategory: 'rail',
  topAwarenessSelectedRawDetail: { item: { id: 'legacy-rail-signal', type: 'rail' }, lifecycleClassification: { lifecycleStage: 'active' } }
};

test('quiet with 70 watched crossings cannot become an active issue or rail-blocking narrative', () => {
  const result = reconcileGridlyActiveAwarenessWithSharedContract(legacyRail, summary());
  assert.equal(result.activeIssueCount, 0);
  assert.equal(result.activeAwareness.activeAwarenessCount, 0);
  assert.equal(result.activeAwareness.rawLightweightActiveAwarenessCount, 1);
  assert.equal(result.activeAwareness.lightweightSuppressedByGovernedContract, true);
  assert.doesNotMatch(`${result.activeAwareness.headline} ${result.activeAwareness.subline}`, /Train blocking crossing/i);
  assert.equal(result.activeAwareness.ownershipClassification, 'SECONDARY_PRESENTATION_MODEL');
});

test('a governed active crossing issue permits the matching active presentation count', () => {
  const result = reconcileGridlyActiveAwarenessWithSharedContract(legacyRail, summary({ active: 1, crossing: 1 }));
  assert.equal(result.activeAwareness.activeAwarenessCount, 1);
  assert.match(result.activeAwareness.headline, /Train blocking crossing/i);
});

test('crossing inventory is preserved but never counted as an active issue', () => {
  const governed = summary({ crossings: 17 });
  const result = reconcileGridlyActiveAwarenessWithSharedContract({ activeAwarenessCount: 0 }, governed);
  assert.equal(governed.crossingsInArea.length, 17);
  assert.equal(result.activeIssueCount, 0);
});

test('community transition replaces a prior active condition with current canonical quiet truth', () => {
  const activeA = reconcileGridlyActiveAwarenessWithSharedContract(legacyRail, summary({ active: 1, crossing: 1, area: 'place-4835000' }));
  const quietB = reconcileGridlyActiveAwarenessWithSharedContract(activeA.activeAwareness, summary({ area: 'place-4806128' }));
  assert.equal(quietB.contract.areaIdentity, 'place-4806128');
  assert.equal(quietB.activeAwareness.activeAwarenessCount, 0);
  assert.doesNotMatch(quietB.activeAwareness.headline, /Train blocking crossing/i);
});

test('canonical PLACE ownership is unchanged for a multi-county community', () => {
  const result = reconcileGridlyActiveAwarenessWithSharedContract(legacyRail, summary({ area: 'place-4819000', crossings: 250 }));
  assert.equal(result.contract.areaIdentity, 'place-4819000');
  assert.equal(result.activeAwareness.activeAwarenessCount, 0);
});

test('post-portrait and scheduled late writers preserve raw evidence but cannot regain consumer ownership', () => {
  const governed = summary();
  let consumer = reconcileGridlyActiveAwarenessWithSharedContract(legacyRail, governed).activeAwareness;
  for (const writer of ['post-portrait-refresh', 'timer-refresh', 'request-animation-frame']) {
    const proposed = { ...legacyRail, rawLightweightActiveAwarenessCount: 1 };
    const result = reconcileGridlyActiveAwarenessWithSharedContract(proposed, governed);
    recordGridlyActiveAwarenessWrite({ writer, previousValue: consumer.activeAwarenessCount, nextValue: result.activeIssueCount, canonicalAreaIdentity: result.contract.areaIdentity, sharedActiveIssueCount: result.activeIssueCount, rawLightweightCount: result.activeAwareness.rawLightweightActiveAwarenessCount, sourceType: 'rail_inventory', sourceIdentity: 'legacy-rail-signal', revision: 7, reason: 'deterministic late writer control' });
    consumer = result.activeAwareness;
    assert.equal(consumer.activeAwarenessCount, 0);
    assert.equal(consumer.rawLightweightActiveAwarenessCount, 1);
    assert.doesNotMatch(`${consumer.headline} ${consumer.subline}`, /Train blocking crossing/i);
  }
  const history = gridlyActiveAwarenessWriterAudit();
  assert.equal(history.at(-1).writer, 'request-animation-frame');
  assert.equal(history.at(-1).sharedActiveIssueCount, 0);
  assert.equal(history.at(-1).rawLightweightCount, 1);
  assert.ok(Object.isFrozen(history));
});
