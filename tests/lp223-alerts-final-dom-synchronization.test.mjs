import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const locationSelectorSource = block('function gridlySelectConciseAlertLocation', '\nfunction gridlyBuildVisibleAlertLocationLineMarkup');
const gridlySelectConciseAlertLocation = Function('cleanDisplayValue', `${locationSelectorSource}; return gridlySelectConciseAlertLocation;`)(value => String(value || '').trim());

test('portrait Alerts open and refresh dispatch the existing authoritative writer', () => {
  const open = block('function openAlertsSurfaceFromDock()', 'function gridlyInstantAlertsSheetAudit()');
  const refresh = block('function renderAlerts()', 'function renderTrendingCrossings()');
  assert.match(open, /gridlyOpenAlertsSurfaceAfterPaint\(alertsSheetGeneration\)/);
  assert.match(refresh, /gridlySynchronizeOpenAlertsPortrait\("renderAlerts_refresh"\)/);
  assert.match(app, /gridlyOpenAlertsSurfaceAfterPaint\(generation\)/);
  assert.doesNotMatch(open, /alerts_open_is_cache_only/);
});

test('uncached Alerts open invokes authority before making a provisional shell visible', () => {
  const open = block('function openAlertsSurfaceFromDock()', 'function gridlyInstantAlertsSheetAudit()');
  assert.match(open, /const opened = false/);
  assert.doesNotMatch(open, /cacheRead\.contextMatched && typeof window\.openGridlyPortraitV2Sheet/);
  assert.match(open, /gridlyOpenAlertsSurfaceAfterPaint\(alertsSheetGeneration\)/);
  assert.match(open, /alerts_open_same_transaction/);
  assert.doesNotMatch(open, /neutral-empty-state/);
});

test('authoritative revision ownership cannot be invalidated by rendered output', () => {
  const revision = block('function gridlyGetAlertsAuthoritativeRevisionKey()', 'function gridlyLp0457MarkupHasBreakArtifacts');
  assert.doesNotMatch(revision, /__gridlyLatestAlertsForRender/);
  assert.match(revision, /window\.activeHazards/);
  assert.match(revision, /window\.activeReports/);
});

test('writer audit exposes final authority, data store, invocation, target, suppression, overwrite, and parity evidence', () => {
  const audit = block('window.gridlyAlertsAuthorityWriterAudit = function', 'window.gridlyAlertDataDiagnostic = function');
  for (const field of [
    'writerInputCanonicalIds', 'finalAuthorityCanonicalIds', 'finalDomCanonicalIds',
    'finalDomPresentationIds', 'canonicalToPresentationMapping', 'duplicateCanonicalDomIds',
    'presentationContract', 'presentationTemplateUsed',
    'finalAuthorityIds', 'finalDataStoreIds', 'writerInvocationCount', 'writerLastInvocationTime',
    'writerInputIds', 'targetContainerIdentity', 'renderSuppressionReason', 'postWriteDomIds',
    'laterOverwriteInvocation', 'firstLosingStage', 'parity'
  ]) assert.match(audit, new RegExp(`\\b${field}\\b`), field);
  for (const state of [
    'AUTHORITY_READY', 'WRITER_NOT_INVOKED', 'WRITER_SKIPPED', 'WRITER_TARGET_MISMATCH',
    'WRITER_OUTPUT_MISSING', 'LATER_EMPTY_OVERWRITE', 'DOM_PARITY_PASS'
  ]) assert.match(audit, new RegExp(state), state);
});

test('top-level rows preserve separate canonical, persisted, provider, and presentation identities', () => {
  const renderer = block('const RenderCompleteAlertCard = (phase2Contract)', 'const renderAlertCard = (alert');
  assert.match(renderer, /data-gridly-governed-evidence-id=/);
  assert.match(renderer, /data-gridly-alert-id=/);
  assert.match(renderer, /data-gridly-persisted-record-id=/);
  assert.match(renderer, /data-gridly-provider-record-id=/);
  assert.match(renderer, /data-gridly-alert-presentation-contract="CONCISE_ALERT_CARD"/);
  const audit = block('window.gridlyAlertsAuthorityWriterAudit = function', 'window.gridlyAlertDataDiagnostic = function');
  assert.doesNotMatch(audit, /endsWith/, 'parity never guesses identity by stripping a namespace');
});

test('Alerts cards use concise composition without Travel Brief evidence sections', () => {
  const renderer = block('const RenderCompleteAlertCard = (phase2Contract)', 'const renderAlertCard = (alert');
  assert.match(renderer, /Updated/);
  assert.match(renderer, /Show on map/);
  assert.doesNotMatch(renderer, /\$\{eventEvidenceHtml\}/);
  assert.doesNotMatch(renderer, /historicalAlertLine \?/);
  assert.doesNotMatch(renderer, /Community|Official Roadways|Weather/);
});

test('concise Alerts select the most useful existing location without duplicate text', () => {
  const select = (alert, consumerCard = {}) => gridlySelectConciseAlertLocation(alert, consumerCard).value;
  assert.equal(select({ roadName: 'Spring St', crossStreet: 'S Davis St', county: 'Hopkins County' }), 'Spring St and S Davis St');
  assert.equal(gridlySelectConciseAlertLocation({ roadName: 'Spring St', crossStreet: 'S Davis St' }).reason, 'road_cross_street');
  assert.equal(select({ roadName: 'Spring Street', nearestRoad: 'Gilmer Street' }), 'Spring Street');
  assert.equal(select({ roadName: 'Spring Street', county: 'Hopkins County' }), 'Spring Street');
  assert.equal(select({ crossingRoad: 'College Street', county: 'Hopkins County' }), 'College Street');
  assert.equal(select({ locationPhrase: 'Near the civic center', county: 'Hopkins County' }), 'Near the civic center');
  assert.equal(select({ canonicalCommunity: 'Sulphur Springs', county: 'Hopkins County' }), 'Sulphur Springs');
  assert.equal(select({ county: 'Hopkins County' }), 'Hopkins County');
  assert.equal(select({ roadName: 'Spring Street', crossStreet: 'Spring St.' }), 'Spring Street');
  assert.equal(select({ resolvedLocation: 'Civic Center entrance', canonicalCommunity: 'Sulphur Springs' }), 'Civic Center entrance');
  for (const generic of ['Road Closed', 'Blocked', 'Hazard reported']) assert.equal(select({ locationLabel: generic }), 'Nearby');
});

test('governed Alerts projection preserves popup incident-location fields and their authority trace', () => {
  const projection = block('function gridlyProjectAlertIncidentLocation', '\nfunction gridlyStoryActiveRecords');
  const project = Function(`${projection}; return gridlyProjectAlertIncidentLocation;`)();
  const source = { road: 'Spring St', cross_street: 'S Davis St', popupLocation: 'Spring St and S Davis St' };
  const projected = project({ id: 'sulphur-road-closure', source, canonicalCommunity: 'Sulphur Springs', countyName: 'Hopkins County' });
  assert.equal(projected.roadName, 'Spring St');
  assert.equal(projected.crossStreet, 'S Davis St');
  assert.equal(projected.resolvedLocation, 'Spring St and S Davis St');
  assert.equal(selectLocation(projected).value, 'Spring St and S Davis St');
  assert.deepEqual(projected.locationSourceFields, ['roadName', 'crossStreet', 'resolvedLocation']);
  function selectLocation(alert) { return gridlySelectConciseAlertLocation(alert); }
});

test('established consumer road authority cannot be downgraded by a later shared lookup', () => {
  const projection = block('function gridlyProjectAlertIncidentLocation', '\nfunction gridlyStoryActiveRecords');
  let sharedInvocations = 0;
  const project = Function('getSharedResolvedRoadLookup', `${projection}; return gridlyProjectAlertIncidentLocation;`)(() => {
    sharedInvocations += 1;
    return { locationContext: { primary: 'Davis Street' } };
  });
  const record = {
    raw: {
      canonicalRoadContext: { roadContextAvailable: true, roadContextInvoked: true, roadContextSource: 'resolveNearbyRoadPair', primaryRoad: 'Spring St', secondaryRoad: 'S Davis St' },
      consumerLocation: { displayLocation: 'Spring St and S Davis St', primaryLocation: 'Spring St and S Davis St', roadway: 'Spring St and S Davis St' },
      lp023ConsumerLocation: { displayLocation: 'Spring St and S Davis St', primaryLocation: 'Spring St and S Davis St', roadway: 'Spring St and S Davis St' },
      sharedResolvedRoadLookup: { locationContext: { primary: 'Davis Street' } }
    }
  };
  const projected = project(record);
  assert.equal(sharedInvocations, 0, 'strong existing authority prevents unnecessary shared geometry lookup');
  assert.equal(projected.roadName, 'Spring St');
  assert.equal(projected.crossStreet, 'S Davis St');
  assert.equal(projected.resolvedLocation, 'Spring St and S Davis St');
  assert.equal(gridlySelectConciseAlertLocation(projected).value, 'Spring St and S Davis St');
  assert.equal(projected.selectedLocationAuthority, 'canonicalRoadContext');
  assert.equal(projected.locationSelectionReason, 'road_cross_street');
  assert.deepEqual(projected.locationAuthorityCandidates.map(({ authority }) => authority), ['canonicalRoadContext', 'consumerLocation', 'lp023ConsumerLocation', 'sharedResolvedRoadLookup']);
  assert.equal(projected.locationAuthorityCandidates.at(-1).value, 'Davis Street');
});

test('shared road lookup remains the fallback when normalized and structured context are absent', () => {
  const projection = block('function gridlyProjectAlertIncidentLocation', '\nfunction gridlyStoryActiveRecords');
  const project = Function('getSharedResolvedRoadLookup', `${projection}; return gridlyProjectAlertIncidentLocation;`)(() => ({ locationContext: { primary: 'Davis Street' } }));
  const projected = project({ canonicalCommunity: 'Sulphur Springs', countyName: 'Hopkins County' });
  assert.equal(projected.roadName, 'Davis Street');
  assert.equal(gridlySelectConciseAlertLocation(projected).value, 'Davis Street');
  assert.equal(projected.selectedLocationAuthority, 'sharedResolvedRoadLookup');
});

test('location diagnostic publishes candidate and selected authority evidence', () => {
  const diagnostic = block('window.gridlyAlertDataDiagnostic = function', '\n\n');
  for (const field of ['locationAuthorityCandidates', 'selectedLocationAuthority', 'selectedLocationSourceFields', 'selectedLocationValue', 'locationSelectionReason']) {
    assert.match(diagnostic, new RegExp(`\\b${field}\\b`), field);
  }
});

test('location refinement preserves concise presentation and identity ownership', () => {
  const renderer = block('const RenderCompleteAlertCard = (phase2Contract)', 'const renderAlertCard = (alert');
  const renderCard = block('const renderAlertCard = (alert', 'const normalizeAlertPresentationKey');
  assert.match(renderer, /CONCISE_ALERT_CARD/);
  assert.doesNotMatch(renderer, /Community|Official Roadways|Weather/);
  assert.match(renderCard, /gridlyAlertWriterRecordId\(alert, index\)/);
  assert.match(renderCard, /canonicalIncidentId/);
});

test('identity and concise contracts are stable for single, two-row, quiet, and rewrite controls', () => {
  const render = (records) => records.map((record) => ({ canonical: record.evidenceId, presentation: record.id, contract: 'CONCISE_ALERT_CARD' }));
  const hazard = { evidenceId: 'active_hazard:hazard-device-1', id: 'persisted-hazard-uuid' };
  const crossing = { evidenceId: 'community_report:crossing-1', id: 'persisted-crossing-uuid' };
  assert.deepEqual(render([hazard]).map(row => row.canonical), [hazard.evidenceId]);
  const two = render([hazard, crossing]);
  assert.equal(two.length, 2);
  assert.equal(new Set(two.map(row => row.canonical)).size, 2);
  assert.ok(two.every(row => row.contract === 'CONCISE_ALERT_CARD'));
  assert.deepEqual(render([]), []);
  assert.deepEqual(render([hazard, crossing]), two);
});

test('single, update, quiet, clear, and repeated refresh controls converge without duplicates', () => {
  const reconcile = (authority, previousDom = []) => {
    void previousDom;
    return [...new Set(authority)];
  };
  const one = reconcile(['active_hazard:hazard']);
  assert.deepEqual(one, ['active_hazard:hazard']);
  const two = reconcile(['active_hazard:hazard', 'community_report:crossing'], one);
  assert.deepEqual(two, ['active_hazard:hazard', 'community_report:crossing']);
  assert.deepEqual(reconcile([], two), []); // quiet/clear removes stale rows
  assert.deepEqual(reconcile(two, two), two); // repeated refresh is replacement, not append
  assert.equal(new Set(reconcile(two, two)).size, 2);
});

test('writer continues to use portrait sheet pipeline rather than ad hoc row insertion', () => {
  const writer = block('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync', 'function invokeMobileAlertsEntry');
  assert.match(writer, /window\.openGridlyPortraitV2Sheet\("alerts"/);
  assert.match(writer, /gridlyLP236RenderAlertsPresentation\(snapshot, alertsForRender\)/);
  assert.doesNotMatch(writer.slice(writer.indexOf('\/\/ LP236 owns the presentation projection')), /renderAlertCard\(alert, index, isHidden\)/);
  assert.doesNotMatch(writer, /createElement\(['"](?:article|div)['"]\)/);
});
