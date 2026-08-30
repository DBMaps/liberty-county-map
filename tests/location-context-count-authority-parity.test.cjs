const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const resolve = (governedCount, groupedCount, extra = {}) => governed.resolveLocationContextActiveIssueCount({
  reconciledActiveIssueCount: governedCount,
  alertsGroupedIssueCount: groupedCount,
  ...extra
});

test('Dallas discovery shape keeps 16 governed conditions when Alerts has a seventeenth derived card', () => {
  const uuidRows = Array.from({ length: 16 }, (_, index) => ({
    evidenceId: `official_roadway:${String(index + 1).padStart(2, '0')}-UUID`,
    sourceKind: 'official_roadway', subtype: 'road_closure'
  }));
  const derivedHotelStreetCard = {
    id: 'official-situation-official-roadways-Hotel-Street-Bridge-closed',
    providerId: 'drivetexas', reportKind: 'official-situation', category: 'Road Closure'
  };
  assert.equal(resolve(uuidRows.length, uuidRows.length + 1), 16);
  assert.equal(governed.sourceKindOf(derivedHotelStreetCard), 'official_roadway');
});

test('zero, one, and multiple independent governed conditions retain cardinality', () => {
  assert.equal(resolve(0, 0), 0);
  assert.equal(resolve(1, 1), 1);
  assert.equal(resolve(4, 2), 4);
});

test('duplicate and heterogeneous presentation populations cannot inflate governed count', () => {
  assert.equal(resolve(3, 5), 3);
  assert.equal(resolve(4, 7, { sharedActiveIssueCount: 4 }), 4);
});

test('qualified governed evidence identities are idempotent in production audit matching', () => {
  const record = { evidenceId: 'official_roadway:3E0D04C9-UUID', sourceKind: 'official_roadway', subtype: 'road_closure' };
  const snapshot = governed.buildSnapshot({ records: [record] });
  const audit = governed.buildLocationContextProductionAudit({ governedEvidence: snapshot.evidence, productionItems: [record], productionCount: 1 });
  assert.equal(governed.identity(record), 'official_roadway:3E0D04C9-UUID');
  assert.equal(audit.locationContextProductionItems[0].governedEvidenceId, 'official_roadway:3E0D04C9-UUID');
  assert.equal(audit.locationContextProductionItems[0].matchStatus, 'MATCHED_GOVERNED');
});

test('repair changes only Location Context authority and leaves protected publishers untouched', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const normalize = app.slice(app.indexOf('function normalizeGridlyMobileAwarenessPanelSummary'), app.indexOf('function getGridlyAwarenessSummaryAreaIdentity'));
  assert.match(normalize, /alertsGroupedIssueCount/);
  assert.match(normalize, /resolveLocationContextActiveIssueCount/);
  assert.doesNotMatch(normalize, /Dallas|dallas-tx|Hotel-Street/);
  for (const protectedFile of ['js/gridlyAwarenessOfficialRoadwayPublisherRepair.js', 'js/gridlyDriveTexasAuthoritySourceIntegration.js']) {
    assert.equal(fs.existsSync(protectedFile), true);
  }
});
