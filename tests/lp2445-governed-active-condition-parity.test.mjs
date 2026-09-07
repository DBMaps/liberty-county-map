import test from 'node:test';
import assert from 'node:assert/strict';
import parity from '../js/gridlyGovernedActiveConditionParity.js';
import { readFile } from 'node:fs/promises';

const ID = '0f798ec4-b48a-4452-be2f-105c0d1af859';
const report = (id, extra = {}) => ({ id, status: 'active', source: 'user', countyId: 'liberty-tx', community: 'Dayton', title: 'Blocked Crossing', road: 'Main Street', ...extra });
const representation = (item, sourceKind) => ({ item, sourceKind });

test('LP244.5 Governed Active Condition Parity: Dayton crossing representations converge everywhere', () => {
  const governed = report(ID, { governedEvidenceId: `community_report:${ID}`, crossingId: 'FRA-762786W' });
  const crossing = report('', { id: undefined, raw: { id: ID }, crossingId: 'FRA-762786W' });
  const audit = parity.audit({
    selectedArea: { name: 'Dayton', countyId: 'liberty-tx' },
    governed: [governed], alerts: [{ ...governed, evidenceId: `alert:${ID}`, governedEvidenceId: undefined }],
    kbyg: [governed], communitySummary: [governed],
    topAwarenessRepresentations: [representation(governed, 'activeHazard'), representation(crossing, 'activeReport')],
    awarenessBriefState: 'moderate', locationContextCount: 1
  });
  assert.equal(audit.rawRepresentationCount, 2);
  assert.equal(audit.canonicalConditionCount, 1);
  assert.equal(audit.duplicateSuppressionCount, 1);
  assert.deepEqual(audit.governedConditionIds, [`community_report:${ID}`]);
  assert.equal(audit.overallPass, true);
});

test('LP244.5 contract preserves two genuinely distinct reports', () => {
  assert.equal(parity.reconcile([report('report-a'), report('report-b')]).canonicalConditionCount, 2);
});

test('LP244.5 contract never deduplicates by equal display text', () => {
  const result = parity.reconcile([report('report-a'), report('report-b')]);
  assert.equal(result.canonicalConditionCount, 2);
  assert.deepEqual(result.canonicalIds, ['community_report:report-a', 'community_report:report-b']);
});

test('LP244.5 contract excludes cleared history and stale records', () => {
  assert.equal(parity.reconcile([report('cleared', { status: 'cleared' })]).canonicalConditionCount, 0);
  assert.equal(parity.reconcile([report('stale', { lifecycleState: 'stale' })]).canonicalConditionCount, 0);
});

test('LP244.5 crossing association uses persisted community report identity', () => {
  const result = parity.reconcile([report(ID), { crossingId: 'FRA-762786W', latestReport: { id: ID }, status: 'active' }]);
  assert.equal(result.canonicalConditionCount, 1);
  assert.equal(result.duplicateSuppressionCount, 1);
});

test('LP244.5 official and community conditions remain independently countable', () => {
  const result = parity.reconcile([report('community-a'), { id: 'txdot-a', source: 'DriveTexas', providerRecordId: 'txdot-a', status: 'active' }]);
  assert.equal(result.canonicalConditionCount, 2);
  assert.deepEqual(result.canonicalIds, ['community_report:community-a', 'official:txdot-a']);
});

test('LP244.5 county-qualified governed input cannot acquire wrong-county membership', () => {
  const selected = [report('liberty-a'), report('harris-a', { countyId: 'harris-tx' })].filter((row) => row.countyId === 'liberty-tx');
  const audit = parity.audit({ selectedArea: { name: 'Dayton', countyId: 'liberty-tx' }, governed: selected, alerts: selected, kbyg: selected, communitySummary: selected, topAwarenessRepresentations: selected, awarenessBriefState: 'active' });
  assert.deepEqual(audit.governedConditionIds, ['community_report:liberty-a']);
  assert.equal(audit.overallPass, true);
});

test('LP244.5 set-in-stone assertions detect surface and quiet-state divergence', () => {
  const governed = [report('only')];
  const missingSummary = parity.audit({ governed, alerts: governed, kbyg: governed, communitySummary: [], topAwarenessRepresentations: governed, awarenessBriefState: 'quiet' });
  assert.equal(missingSummary.countParityPass, false);
  assert.equal(missingSummary.identityParityPass, false);
  assert.equal(missingSummary.briefParityPass, false);
  assert.equal(missingSummary.overallPass, false);
});

test('LP244.5 parity contract is wired into production summary, Top Awareness, Brief, and owner audit', async () => {
  const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /gridlyGovernedActiveConditionParity\.js\?v=2445/);
  assert.match(source, /governedCommunityReports/);
  assert.match(source, /topAwarenessCanonicalIds/);
  assert.match(source, /governedActiveCount === 0/);
  assert.match(source, /function gridlyGovernedActiveConditionParityAudit/);
  assert.match(source, /window\.gridlyGovernedActiveConditionParityAudit/);
});
