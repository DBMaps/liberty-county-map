import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('js/gridlyAwarenessOfficialRoadwayPublisherRepair.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

function runtime({ official = [], reports = [], connected = true, error = null, areaId = 'place-4819000' } = {}) {
  const intervals = [];
  const baseSummary = () => ({ selectedAwarenessArea: { id: areaId }, awarenessAreaName: areaId, activeHazardsInArea: [], activeReportsInArea: reports.slice(), warnings: [], sourceBreakdown: {} });
  const window = {
    setInterval(fn) { intervals.push(fn); return intervals.length; }, clearInterval() {}, setTimeout(fn) { fn(); },
    gridlyDriveTexasConnector: { getNormalizedRecords: () => official, areaLifecycleAudit: () => ({ lastFetchError: error }) },
    gridlyDriveTexasProvider: { getNormalizedRecords: () => [], getRuntimeState: () => ({ connected, lastError: error }) },
    gridlyDriveTexasConnectorRuntimeAudit: () => ({ connected }),
    gridlySelectConsumerVisibleDriveTexasSituations: ({ records }) => ({ consumerVisibleSituations: records }),
    getGridlySelectedAwarenessArea: () => ({ id: areaId }),
    isGridlyRecordInAwarenessArea: record => record.areaId === areaId,
    isGridlyCrossingReportRecord: record => record.kind === 'crossing',
    buildGridlyCommunityAwarenessIntelligenceSummary: baseSummary
  };
  vm.runInNewContext(source, { window, console, Date, JSON, Object, Array, String, Boolean, Number, Set, Promise });
  intervals[0]();
  return { window, summary: () => window.buildGridlyCommunityAwarenessIntelligenceSummary() };
}

test('8 governed DriveTexas issues make broad shared awareness active', () => {
  const official = Array.from({ length: 8 }, (_, i) => ({ id: `dt-${i}`, areaId: 'place-4819000' }));
  const summary = runtime({ official }).summary();
  assert.equal(summary.sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
  assert.equal(summary.sharedActiveIssueContract.activeIssueCount, 8);
  assert.equal(summary.activityLevel, 'Elevated');
  assert.doesNotMatch(summary.awarenessStatusReason, /No active local issues/);
});

test('official and community/crossing evidence remain distinct and additive without double counting', () => {
  const official = Array.from({ length: 8 }, (_, i) => ({ id: `dt-${i}`, areaId: 'place-4819000' }));
  const reports = [...Array.from({ length: 4 }, (_, i) => ({ id: `community-${i}` })), { id: 'crossing-1', kind: 'crossing' }];
  const contract = runtime({ official, reports }).summary().sharedActiveIssueContract;
  assert.deepEqual(JSON.parse(JSON.stringify(contract)), { version: 'LP214_PHASE_2_2F', activeIssueCount: 13, activeOfficialRoadwayCount: 8, activeCommunityReportCount: 4, activeCrossingIssueCount: 1, activeOtherHazardCount: 0, officialRoadwaySourceStatus: 'HEALTHY_WITH_DATA', quietEligible: false, areaIdentity: 'place-4819000', countRule: 'distinct lifecycle-active, area-eligible records by governed source ownership' });
});

test('healthy empty permits quiet; failed empty creates uncertainty', () => {
  const healthy = runtime().summary().sharedActiveIssueContract;
  assert.equal(healthy.activeIssueCount, 0); assert.equal(healthy.quietEligible, true);
  const failedSummary = runtime({ connected: false, error: 'network failure' }).summary();
  assert.equal(failedSummary.sharedActiveIssueContract.activeIssueCount, 0);
  assert.equal(failedSummary.sharedActiveIssueContract.quietEligible, false);
  assert.equal(failedSummary.awarenessStatus, 'Status being confirmed');
});

test('community transitions and source refresh cannot leak the prior area count', () => {
  const official = [{ id: 'dallas', areaId: 'place-4819000' }, { id: 'houston', areaId: 'place-4835000' }];
  const dallas = runtime({ official, areaId: 'place-4819000' }).summary().sharedActiveIssueContract;
  const houston = runtime({ official, areaId: 'place-4835000' }).summary().sharedActiveIssueContract;
  assert.equal(dallas.activeIssueCount, 1); assert.equal(houston.activeIssueCount, 1);
  assert.notEqual(dallas.areaIdentity, houston.areaIdentity);
  assert.match(app, /officialRoadwayAwarenessRevision/);
});

test('Location Context uses the authoritative shared count and null evidence cannot pass certification', () => {
  assert.match(app, /const authoritativeSharedCount = Number\(sharedSummary\?\.sharedActiveIssueContract\?\.activeIssueCount/);
  assert.match(app, /Number\.isFinite\(authoritativeSharedCount\)[\s\S]*\? Math\.max\(0, authoritativeSharedCount\)/);
  assert.match(app, /Alerts remains[\s\S]*must not inflate this[\s\S]*count/);
  assert.match(app, /"CERTIFICATION_INDETERMINATE"/);
  assert.match(app, /const locationContextPass = locationContextCertificationStatus === "PASS"/);
});

test('official count and status come directly from one governed envelope snapshot', () => {
  const official = Array.from({ length: 8 }, (_, i) => ({ id: `snapshot-${i}`, areaId: 'place-4819000' }));
  const instance = runtime({ official });
  const envelope = instance.window.gridlyGetDriveTexasConsumerSourceStatusEnvelope();
  const contract = instance.summary().sharedActiveIssueContract;
  assert.equal(envelope.sourceStatus, 'HEALTHY_WITH_DATA');
  assert.equal(envelope.records.length, 8);
  assert.equal(contract.officialRoadwaySourceStatus, envelope.sourceStatus);
  assert.equal(contract.activeOfficialRoadwayCount, envelope.records.length);
  assert.match(source, /const officialRecords = officialInArea/);
});

test('DriveTexas refresh advances revision before shared consumer refresh without reselection', () => {
  const official = [];
  let revisionObservedByConsumer = null;
  const intervals = [];
  const window = {
    setInterval(fn) { intervals.push(fn); return intervals.length; }, clearInterval() {}, setTimeout(fn) { fn(); },
    gridlyDriveTexasConnector: { getNormalizedRecords: () => official, areaLifecycleAudit: () => ({ lastFetchError: null }) },
    gridlyDriveTexasProvider: { getNormalizedRecords: () => [], getRuntimeState: () => ({ connected: true }) },
    gridlyDriveTexasConnectorRuntimeAudit: () => ({ connected: true }),
    gridlySelectConsumerVisibleDriveTexasSituations: ({ records }) => ({ consumerVisibleSituations: records }),
    getGridlySelectedAwarenessArea: () => ({ id: 'place-4819000' }),
    isGridlyRecordInAwarenessArea: record => record.areaId === 'place-4819000',
    buildGridlyCommunityAwarenessIntelligenceSummary: () => ({ selectedAwarenessArea: { id: 'place-4819000' }, activeHazardsInArea: [], activeReportsInArea: [] }),
    gridlyOfficialProviderConsumerRefresh() { revisionObservedByConsumer = window.gridlyOfficialRoadwayAwarenessRevision; }
  };
  vm.runInNewContext(source, { window, console, Date, JSON, Object, Array, String, Boolean, Number, Set, Promise });
  intervals[0]();
  official.push(...Array.from({ length: 8 }, (_, i) => ({ id: `live-${i}`, areaId: 'place-4819000' })));
  window.gridlyOfficialProviderConsumerRefresh({ providerId: 'drivetexas', evidenceChanged: true, reason: 'fetch-success' });
  assert.equal(revisionObservedByConsumer, 1);
  assert.equal(window.buildGridlyCommunityAwarenessIntelligenceSummary().sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
});

test('retained failure preserves records while blocking quiet', () => {
  const official = Array.from({ length: 8 }, (_, i) => ({ id: `retained-${i}`, areaId: 'place-4819000' }));
  const summary = runtime({ official, connected: false, error: 'network failure' }).summary();
  assert.equal(summary.sharedActiveIssueContract.activeOfficialRoadwayCount, 8);
  assert.equal(summary.sharedActiveIssueContract.officialRoadwaySourceStatus, 'SOURCE_FAILED_WITH_RETAINED_DATA');
  assert.equal(summary.sharedActiveIssueContract.quietEligible, false);
  assert.match(summary.warnings.join(' '), /may be delayed/);
});

test('statewide canonical inventory uses one community-independent contract', () => {
  const inventory = JSON.parse(fs.readFileSync('data/generated/lp214-county-community-inventory.json', 'utf8'));
  assert.equal(inventory.summary.uniqueCanonicalCommunityCount, 1859);
  assert.equal(inventory.summary.multiCountyCommunityCount, 163);
  assert.doesNotMatch(source, /Dallas|Houston|place-4819000|county allowlist/i);
});
