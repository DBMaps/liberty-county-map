const test = require('node:test');
const assert = require('node:assert/strict');
const governed = require('../js/governed-awareness.js');

const NOW = Date.parse('2026-08-24T12:00:00Z');
const incident = (overrides = {}) => ({
  sourceKind: 'official_roadway', providerId: 'txdot-fm0529-1', providerRecordId: 'txdot-fm0529-1',
  category: 'Lane Closure', roadway: 'FM0529', latitude: 29.87412353353783, longitude: -95.91808992841244,
  geographicEligible: true, status: 'active', expiresAt: '2026-08-25T12:00:00Z', ...overrides
});

const DALLAS_TARGET = '0D47C4E8-4B4D-48E9-ADCF-508432056A1F';

test('relevant current DriveTexas identity reaches every governed awareness projection once', () => {
  const row = incident();
  const projection = governed.buildConsumerProjection({ records: [row, { ...row }], nowMs: NOW, canonicalCommunity: 'Katy', canonicalKey: '4838476' });
  const id = 'official_roadway:txdot-fm0529-1';
  assert.equal(projection.lineage.length, 1);
  assert.equal(projection.lineage[0].governedEvidenceId, id);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygOfficialRoadways']) {
    assert.deepEqual(projection.surfaces[surface].map(item => item.evidenceId), [id]);
  }
  assert.equal(projection.surfaces.kbygCommunity.length, 0, 'official evidence retains official-roadway source semantics');
});

test('lifecycle and geographic authority remain fail closed', () => {
  for (const row of [
    incident({ status: 'cleared' }), incident({ status: 'stale' }), incident({ active: false }),
    incident({ expiresAt: '2026-08-23T12:00:00Z' }), incident({ geographicEligible: false })
  ]) {
    const projection = governed.buildConsumerProjection({ records: [row], nowMs: NOW });
    assert.equal(projection.surfaces.locationContext.length, 0);
    assert.equal(projection.surfaces.alerts.length, 0);
  }
});

test('production wiring admits the existing geographic projection without county or town branches', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const boundary = app.slice(app.indexOf('function gridlyGetGovernedConsumerProjection'), app.indexOf('function gridlyProjectAlertIncidentLocation'));
  assert.match(boundary, /gridlyStoryTransportationConnectorRecords/);
  assert.match(boundary, /sourceKind: "official_roadway"/);
  assert.doesNotMatch(boundary, /Katy|harris-tx|fort-bend-tx|waller-tx|county\s*===/i);
  assert.doesNotMatch(boundary, /setInterval|setTimeout|fetch\s*\(/);
  assert.match(app, /gridlyLP234DriveTexasGovernedPropagationAudit/);
  assert.match(app, /preDedupCollectionCardinality: productionCandidates\.length/);
  assert.match(app, /providerRecordId: record\?\.providerRecordId \|\| record\?\.sourceProviderRecordId/);
  assert.doesNotMatch(app, new RegExp(DALLAS_TARGET));
});

test('Dallas LP039.3 fixture preserves 23 provider identities through lifecycle, policy, and dedup', () => {
  const records = Array.from({ length: 23 }, (_, index) => incident({
    providerId: `provider:${index === 0 ? DALLAS_TARGET : `DALLAS-${index}`}`,
    providerRecordId: index === 0 ? DALLAS_TARGET : `DALLAS-${index}`,
    roadway: index === 0 ? 'SH0078' : `SH${String(index).padStart(4, '0')}`
  }));
  const projection = governed.buildConsumerProjection({ records: [...records, { ...records[0] }], nowMs: NOW });
  const targetId = `official_roadway:${DALLAS_TARGET}`;
  assert.equal(projection.lineage.length, 23);
  assert.equal(projection.snapshot.duplicateEvidenceIds.filter(id => id === targetId).length, 1);
  assert.equal(projection.lineage.filter(row => row.lifecycleEligible).length, 23);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygOfficialRoadways']) {
    assert.equal(projection.surfaces[surface].length, 23);
    assert.equal(projection.surfaces[surface].filter(row => row.evidenceId === targetId).length, 1);
  }
  assert.equal(projection.surfaces.kbygCommunity.length, 0);
});

test('LP039.3 publishes the raw provider record identity for governed admission', () => {
  const fs = require('node:fs');
  const integration = fs.readFileSync(require.resolve('../js/gridlyDriveTexasAuthoritySourceIntegration.js'), 'utf8');
  assert.match(integration, /providerRecordId: record\.providerRecordId \|\| record\.sourceProviderRecordId/);
  assert.doesNotMatch(integration, /providerRecordId:\s*(?:record\.)?routeName/);
});

test('LP234 joins governed Alerts identity through the LP223 writer mapping without changing presentation', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const audit = app.slice(app.indexOf('window.gridlyLP234DriveTexasGovernedPropagationAudit'), app.indexOf('/* LP221:'));
  assert.match(audit, /gridlyAlertsAuthorityWriterAudit/);
  assert.match(audit, /alertsCanonicalToPresentationMapping/);
  assert.match(audit, /identity\.canonicalId === governed\?\.evidenceId/);
  assert.match(audit, /authoritative_governed_to_presentation_mapping/);
  assert.match(audit, /alertsPresentationIncidentId/);
  assert.match(audit, /alertsDomPresentationIds\.includes\(alertsPresentationIncidentId\)/);
  assert.doesNotMatch(audit, /textContent|innerHTML|outerHTML|MutationObserver|setTimeout|setInterval/,
    'passive proof neither scrapes markup nor schedules/mutates the DOM');
  assert.doesNotMatch(audit, /renderCompleteAlertCard|gridlyRecordAlertsWriterInvocation|\.appendChild|\.setAttribute/,
    'LP234 does not enter the Alerts writer');
});

test('LP234 classifies Location Context collection/count divergence instead of forcing equality', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const audit = app.slice(app.indexOf('window.gridlyLP234DriveTexasGovernedPropagationAudit'), app.indexOf('/* LP221:'));
  assert.match(audit, /locationContextPostDedupItems/);
  assert.match(audit, /locationContextUncountedItems/);
  assert.match(audit, /entry\?\.matchStatus === "MATCHED_GOVERNED"/);
  assert.match(audit, /retained diagnostic collection member is not governed active count evidence/);
  assert.doesNotMatch(audit, /locationContextPostDedupCardinality === result\.locationContextProductionCount/);
  assert.match(audit, /result\.firstLosingStage === null/);
  assert.match(audit, /!result\.alertsDomMounted \|\| result\.targetPresentInAlertsDom/,
    'a closed sheet is not a propagation failure, while mounted DOM must prove the mapped target');
});
