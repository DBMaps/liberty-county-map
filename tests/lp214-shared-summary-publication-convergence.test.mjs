import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('js/gridlyAwarenessOfficialRoadwayPublisherRepair.js', 'utf8');

function harness() {
  let records = [];
  let connected = true;
  let error = null;
  let area = { key: 'place-4819000', label: 'Dallas' };
  const intervals = [];
  const baseSummary = () => ({
    selectedAwarenessArea: area,
    activeHazardsInArea: [],
    activeReportsInArea: [],
    sourceBreakdown: {},
    warnings: []
  });
  const window = {
    setInterval(fn) { intervals.push(fn); return intervals.length; },
    clearInterval() {},
    setTimeout(fn) { fn(); },
    getGridlySelectedAwarenessArea: () => area,
    gridlyDriveTexasConnector: {
      getNormalizedRecords: () => records,
      areaLifecycleAudit: () => ({ lastFetchError: error, lastSuccessfulFetchTimestamp: '2026-08-18T00:00:00.000Z' })
    },
    gridlyDriveTexasProvider: { getNormalizedRecords: () => [], getRuntimeState: () => ({ connected, lastError: error }) },
    gridlyDriveTexasConnectorRuntimeAudit: () => ({ connected }),
    gridlySelectConsumerVisibleDriveTexasSituations: ({ records: input }) => ({ consumerVisibleSituations: input }),
    buildGridlyOfficialSituationAlert(record) {
      // The production presentation projection does not carry lifecycle or
      // governed consumer identity unless the publisher preserves it.
      return { id: `display-${record.id || record.category}`, providerId: record.providerId, category: record.category, title: record.headline, description: record.description };
    },
    getGridlyAwarenessLifecycleActiveHazards(input) {
      // Reproduces the incompatible raw-hazard expectation that caused the
      // live governed consumer records (which have no lifecycleState) to be
      // rejected before Phase 2.2J.
      return input.filter((record) => record.lifecycleState === 'active');
    },
    buildGridlyCommunityAwarenessIntelligenceSummary: baseSummary,
    gridlyCommunityPulseAuditState: { communityAwarenessSummary: baseSummary() },
    gridlyTopAwarenessMicrolineState: { communityAwarenessSummary: baseSummary() },
    gridlyOfficialProviderConsumerRefresh() {
      // Production refresh replaces the former Pulse summary with a newly
      // built object before the publisher convergence callback runs.
      window.gridlyCommunityPulseAuditState = { communityAwarenessSummary: window.buildGridlyCommunityAwarenessIntelligenceSummary() };
    },
    gridlyPublishAuthoritativeCommunityAwarenessSummary(summary, publication) {
      window.gridlyCommunityPulseAuditState.communityAwarenessSummary = summary;
      window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary = summary;
      window.locationContextCount = summary.sharedActiveIssueContract.activeIssueCount;
      window.lastPublication = publication;
      // Reproduce the production portrait normalization that used to leave
      // the microline with an equal-but-distinct post-publication copy.
      window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary = { ...summary };
      return summary;
    }
  };
  vm.runInNewContext(source, { window, console, Date, JSON, Object, Array, String, Boolean, Number, Set, Promise });
  intervals[0]();
  const publish = (nextRecords, next = {}) => {
    records = nextRecords;
    connected = next.connected ?? true;
    error = next.error ?? null;
    if (next.area) area = next.area;
    window.gridlyOfficialProviderConsumerRefresh({ providerId: 'drivetexas', reason: next.reason || 'fetch-success' });
    return window.gridlyCommunityPulseAuditState.communityAwarenessSummary;
  };
  return { window, publish };
}

test('governed snapshot is published as one Pulse, microline and Location Context reference', () => {
  const h = harness();
  const stale = h.window.gridlyCommunityPulseAuditState.communityAwarenessSummary;
  const governedDallasRecords = Array.from({ length: 8 }, (_, index) => ({
    consumerSituationId: `drivetexas:dallas:${index + 1}`,
    providerId: 'drivetexas',
    category: 'Construction',
    headline: `Dallas roadway condition ${index + 1}`,
    description: 'Governed consumer-visible roadway condition.'
  }));
  const summary = h.publish(governedDallasRecords);
  assert.notEqual(summary, stale);
  assert.equal(summary.sharedActiveIssueContract.areaIdentity, 'place-4819000');
  assert.equal(summary.sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
  assert.ok(summary.sharedActiveIssueContract.activeIssueCount >= 8);
  assert.equal(h.window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary, summary);
  assert.equal(h.window.locationContextCount, summary.sharedActiveIssueContract.activeIssueCount);
  const audit = h.window.gridlyAwarenessOfficialRoadwayPublisherRepairAudit();
  assert.equal(audit.sourceEnvelopeCount, 8);
  assert.equal(audit.officialNormalizationInputCount, 8);
  assert.equal(audit.officialNormalizedCount, 8);
  assert.equal(audit.officialLifecycleActiveCount, 8);
  assert.equal(audit.officialInAreaCount, 8);
  assert.equal(audit.sharedContractOfficialInputCount, 8);
  assert.equal(audit.sharedContractOfficialUniqueCount, 8);
  assert.equal(audit.enrichedSummaryOfficialCount, 8);
  assert.equal(audit.publishedPulseOfficialCount, 8);
  assert.equal(audit.publishedMicrolineOfficialCount, 8);
  assert.equal(audit.sameSummaryReference, true);
  assert.equal(audit.authoritativeSummaryAreaIdentity, 'place-4819000');
  assert.equal(audit.lastReferenceDivergenceReason, null);
});

test('cold start, refresh, healthy empty, failure retention and community transitions republish', () => {
  const h = harness();
  assert.equal(h.publish([]).sharedActiveIssueContract.activeOfficialRoadwayCount, 0);
  assert.equal(h.publish(Array.from({ length: 8 }, (_, i) => ({ id: `d-${i}` }))).sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
  assert.equal(h.publish(Array.from({ length: 3 }, (_, i) => ({ id: `d2-${i}` }))).sharedActiveIssueContract.activeOfficialRoadwayCount, 3);
  assert.equal(h.publish([]).sharedActiveIssueContract.officialRoadwaySourceStatus, 'HEALTHY_EMPTY');
  h.publish(Array.from({ length: 8 }, (_, i) => ({ id: `retained-${i}` })));
  const retained = h.publish([], { connected: false, error: 'network failure', reason: 'fetch-failure' });
  assert.equal(retained.sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
  assert.equal(retained.sharedActiveIssueContract.quietEligible, false);
  const houston = h.publish([{ id: 'houston' }], { area: { key: 'place-4835000', label: 'Houston' } });
  assert.equal(houston.sharedActiveIssueContract.areaIdentity, 'place-4835000');
  assert.equal(houston.sharedActiveIssueContract.activeOfficialRoadwayCount, 1);
  const dallas = h.publish([{ id: 'dallas-current' }], { area: { key: 'place-4819000', label: 'Dallas' } });
  assert.equal(dallas.sharedActiveIssueContract.areaIdentity, 'place-4819000');
  assert.equal(dallas.sharedActiveIssueContract.activeOfficialRoadwayCount, 1);
});

test('Dallas 8 -> Houston 0 -> Dallas 8 atomically replaces identity, counts and references', () => {
  const h = harness();
  const dallasRecords = Array.from({ length: 8 }, (_, i) => ({ id: `dallas-${i}` }));
  const dallas = h.publish(dallasRecords);
  assert.equal(dallas.sharedActiveIssueContract.activeOfficialRoadwayCount, 8);

  const houston = h.publish([], { area: { key: 'place-4835000', label: 'Houston' } });
  assert.equal(houston.sharedActiveIssueContract.areaIdentity, 'place-4835000');
  assert.equal(houston.sharedActiveIssueContract.activeOfficialRoadwayCount, 0);
  assert.equal(houston.sharedActiveIssueContract.activeIssueCount, 0);
  assert.equal(h.window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary, houston);
  assert.equal(h.window.locationContextCount, 0);
  let audit = h.window.gridlyAwarenessOfficialRoadwayPublisherRepairAudit();
  assert.equal(audit.enrichedSummaryOfficialCount, 0);
  assert.equal(audit.publishedPulseOfficialCount, 0);
  assert.equal(audit.publishedMicrolineOfficialCount, 0);
  assert.equal(audit.sameSummaryReference, true);
  assert.equal(audit.previousAreaIdentity, 'place-4819000');
  assert.equal(audit.transitionRevision, 1);

  const dallasAgain = h.publish(dallasRecords, { area: { key: 'place-4819000', label: 'Dallas' } });
  assert.equal(dallasAgain.sharedActiveIssueContract.areaIdentity, 'place-4819000');
  assert.equal(dallasAgain.sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
  assert.equal(h.window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary, dallasAgain);
  audit = h.window.gridlyAwarenessOfficialRoadwayPublisherRepairAudit();
  assert.equal(audit.sameSummaryReference, true);
  assert.equal(audit.previousAreaIdentity, 'place-4835000');
});

test('area transition never treats prior-area retained records as current evidence', () => {
  const h = harness();
  h.publish(Array.from({ length: 8 }, (_, i) => ({ id: `dallas-${i}` })));
  const failedHouston = h.publish([], {
    area: { key: 'place-4835000', label: 'Houston' },
    connected: false,
    error: 'network failure',
    reason: 'fetch-failure'
  });
  assert.equal(failedHouston.sharedActiveIssueContract.areaIdentity, 'place-4835000');
  assert.equal(failedHouston.sharedActiveIssueContract.activeOfficialRoadwayCount, 0);
  assert.equal(failedHouston.sharedActiveIssueContract.officialRoadwaySourceStatus, 'SOURCE_FAILED_NO_RETAINED_DATA');
});

test('zero-to-zero and nonzero-to-nonzero transitions still replace canonical identity', () => {
  const h = harness();
  const dallasZero = h.publish([]);
  const houstonZero = h.publish([], { area: { key: 'place-4835000', label: 'Houston' } });
  assert.notEqual(dallasZero.sharedActiveIssueContract.areaIdentity, houstonZero.sharedActiveIssueContract.areaIdentity);
  assert.notEqual(dallasZero, houstonZero);
  assert.equal(h.window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary, houstonZero);
  const communityA = h.publish([{ id: 'houston-1' }, { id: 'houston-2' }]);
  const communityB = h.publish([{ id: 'dallas-1' }], { area: { key: 'place-4819000', label: 'Dallas' } });
  assert.equal(communityA.sharedActiveIssueContract.activeOfficialRoadwayCount, 2);
  assert.equal(communityB.sharedActiveIssueContract.activeOfficialRoadwayCount, 1);
});

test('publication bridge is shared and fails closed when evidence is absent', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /function gridlyPublishAuthoritativeCommunityAwarenessSummary/);
  assert.match(app, /communityAwarenessSummary: summary/);
  assert.match(app, /const authoritativeCommunityAwarenessSummary = gridlyCommunityPulseAuditState\?\.communityAwarenessSummary/);
  assert.match(app, /communityAwarenessSummary: authoritativeCommunityAwarenessSummary/);
  assert.match(app, /refreshPortraitV2LocalizedIntelligence/);
  assert.match(app, /locationContextCertificationStatus = sharedActiveIssueCount === null \|\| homeLocationContextIssueCount === null/);
  assert.match(app, /locationContextDatasetCount \?\? parseLeadingCount\(visibleHomeCountText\)/);
  assert.match(app, /hasAuthoritativeSharedCount \? "" : mobileOwnership\?\.meta/);
  assert.match(app, /"CERTIFICATION_INDETERMINATE"/);
  assert.doesNotMatch(source, /Dallas|Houston|place-4819000|place-4835000/);
  const inventory = JSON.parse(fs.readFileSync('data/generated/lp214-county-community-inventory.json', 'utf8'));
  assert.equal(inventory.summary.uniqueCanonicalCommunityCount, 1859);
});

test('stable post-publication portrait and provider refreshes preserve the authoritative reference', async () => {
  const h = harness();
  const austinRecords = Array.from({ length: 21 }, (_, index) => ({
    consumerSituationId: `drivetexas:austin:${index + 1}`,
    id: `austin-${index + 1}`
  }));
  const authoritative = h.publish(austinRecords, {
    area: { key: 'place-4805000', label: 'Austin' },
    reason: 'initial-fetch-success'
  });

  // Model the later requestAnimationFrame/portrait callback: presentation is
  // copied, but its shared-summary field is resolved from authoritative Pulse.
  await Promise.resolve();
  const copiedPresentationModel = { communityAwarenessSummary: { ...authoritative } };
  h.window.gridlyTopAwarenessMicrolineState = {
    ...h.window.gridlyTopAwarenessMicrolineState,
    presentationModel: copiedPresentationModel,
    communityAwarenessSummary: h.window.gridlyCommunityPulseAuditState.communityAwarenessSummary
  };
  assert.notEqual(copiedPresentationModel.communityAwarenessSummary, authoritative);
  assert.equal(h.window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary, authoritative);

  const refreshed = h.publish(austinRecords, { reason: 'subsequent-provider-refresh' });
  await new Promise(resolve => h.window.setTimeout(resolve, 0));
  assert.equal(h.window.gridlyCommunityPulseAuditState.communityAwarenessSummary, refreshed);
  assert.equal(h.window.gridlyTopAwarenessMicrolineState.communityAwarenessSummary, refreshed);
  assert.equal(h.window.gridlyAwarenessOfficialRoadwayPublisherRepairAudit().sameSummaryReference, true);
});
