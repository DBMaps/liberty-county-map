import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyAwarenessAlertsCountSyncAudit()');
const end = app.indexOf('\nwindow.gridlyAwarenessAlertsCountSyncAudit', start);
const auditSource = app.slice(start, end);

function runAudit({ shared = 0, text = 'Map ready · 70 crossings watched', alerts = 0, mounted = true, selectedArea = 'place-4806128', surfaceArea = selectedArea, state = 'quiet', datasetCount = shared } = {}) {
  const panel = mounted ? {
    textContent: text,
    dataset: {
      activeAwarenessCount: String(datasetCount),
      awarenessAreaIdentity: surfaceArea,
      awarenessState: state
    }
  } : null;
  const textNode = { childElementCount: 0, textContent: text };
  const document = {
    querySelector(selector) {
      if (selector.includes('gridlyPortraitLocationAwarenessPanel') || selector.includes('data-v2-location-awareness="panel"')) return panel;
      if (selector.includes('gridlyPortraitV2SheetTitle')) return { textContent: alerts ? `${alerts} Active Alert${alerts === 1 ? '' : 's'}` : 'No Active Alerts' };
      if (selector === '[data-gridly-awareness-context]' || selector === '#geoFilterStatus') return textNode;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '*') return [textNode];
      return [];
    }
  };
  const countModel = { groupedAlertCount: alerts, rawAlertRecordCount: alerts, duplicateGroupCount: 0, communityReportCount: alerts };
  const window = { __gridlyLatestAlertsForRender: [] };
  const context = {
    document,
    window,
    getGridlySelectedAwarenessArea: () => ({ key: selectedArea, label: 'Test area' }),
    getAlertsSurfaceSnapshot: () => ({ alerts: [] }),
    getGridlyAlertsPresentationCountModel: () => countModel,
    gridlyCommunityPulseAuditState: { communityAwarenessSummary: { sharedActiveIssueContract: { areaIdentity: selectedArea, activeIssueCount: shared } } }
  };
  vm.runInNewContext(`${auditSource}; result = gridlyAwarenessAlertsCountSyncAudit();`, context);
  return context.result;
}

test('quiet governed zero certifies when numeric issue phrase is intentionally omitted', () => {
  const result = runAudit({});
  assert.equal(result.homeLocationContextIssueCount, 0);
  assert.equal(result.locationContextCertificationStatus, 'PASS');
  assert.equal(result.locationContextCountSource, 'AUTHORITATIVE_ZERO_QUIET_PRESENTATION');
});

test('explicit zero issue phrase certifies', () => {
  const result = runAudit({ text: '0 active issues nearby · 70 crossings watched' });
  assert.equal(result.homeLocationContextIssueCount, 0);
  assert.equal(result.locationContextCertificationStatus, 'PASS');
});

test('visible positive issue count fails against shared zero', () => {
  const result = runAudit({ text: '1 active issue nearby', alerts: 1 });
  assert.equal(result.homeLocationContextIssueCount, 1);
  assert.equal(result.locationContextCertificationStatus, 'FAIL');
});

test('visible positive issue count certifies against the same shared count', () => {
  const result = runAudit({ shared: 1, text: '1 active issue nearby', alerts: 1, state: 'active' });
  assert.equal(result.homeLocationContextIssueCount, 1);
  assert.equal(result.locationContextCertificationStatus, 'PASS');
});

test('missing Location Context remains indeterminate', () => {
  const result = runAudit({ mounted: false });
  assert.equal(result.homeLocationContextIssueCount, null);
  assert.equal(result.locationContextCertificationStatus, 'CERTIFICATION_INDETERMINATE');
});

test('stale Location Context identity fails closed', () => {
  const result = runAudit({ surfaceArea: 'place-4819000' });
  assert.equal(result.locationContextCertificationStatus, 'FAIL');
  assert.equal(result.identityCurrent, false);
});

test('crossing numerals never become active-issue counts', () => {
  const result = runAudit({ datasetCount: '' });
  assert.equal(result.homeLocationContextIssueCount, null);
  assert.equal(result.locationContextCertificationStatus, 'CERTIFICATION_INDETERMINATE');
});
