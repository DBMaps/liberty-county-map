import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memberships = JSON.parse(read('data/runtime/canonical-crossing-memberships-v1.json'));
const recordAsset = JSON.parse(read('data/runtime/canonical-crossing-records-v1.json'));
const app = read('js/app.js');
const controls = { '4805000':154, '4819000':415, '4838476':11, '4817000':59, '4801000':49, '4848072':15, '4870904':36, '4842568':17, '4827348':0, '4873493':40 };

test('canonical PLACE search publishes one identity row and county behavior remains separate', () => {
  assert.match(app, /a governed membership is not a search-result identity/);
  assert.match(app, /canonicalGroups\.push/);
  assert.doesNotMatch(app, /occurrences\.forEach\(\(\{ group, community \}\) => canonicalGroups\.push/);
  assert.match(app, /countyLabel: "City"/);
  assert.match(app, /community\.countyWide \? `Watch all of/);
});

test('same-name identity is never the dedup key', () => {
  assert.match(app, /occurrencesByPlaceGeoid/);
  assert.match(app, /community\.placeGeoid/);
  assert.doesNotMatch(app, /collapsedNames|occurrencesByName/);
});

test('multi-county controls retain identical membership independent of selected county', () => {
  for (const geoid of ['4805000','4819000','4838476','4817000','4801000','4848072']) {
    const ids = memberships.places[geoid].x.map(row => row[0]);
    assert.ok(memberships.places[geoid].m.length > 1, geoid);
    for (const _membership of memberships.places[geoid].m) assert.deepEqual(memberships.places[geoid].x.map(row => row[0]), ids);
  }
});

test('LP233 IDs and single-county controls remain unchanged and all resolve exactly', () => {
  for (const [geoid,count] of Object.entries(controls)) {
    const ids = memberships.places[geoid].x.map(row => row[0]);
    assert.equal(ids.length,count,geoid);
    assert.equal(ids.filter(id => recordAsset.records[id]).length,count,geoid);
  }
  assert.equal(Object.keys(recordAsset.records).length,9094);
});

test('browser runtime resolves exact canonical records and fails closed', async () => {
  const context={window:{},fetch:async url=>({ok:true,json:async()=>url.includes('records')?recordAsset:memberships})};
  vm.runInNewContext(read('js/gridlyCanonicalCrossingRuntime.js'),context);
  await context.window.gridlyCanonicalCrossingRuntime.load();
  const d=context.window.gridlyCanonicalCrossingRuntime.resolveRecords({canonicalKey:'place-4819000'});
  assert.equal(d.membership.certifiedCrossingCount,415); assert.equal(d.records.length,415); assert.equal(d.authorityAvailable,true);
  assert.equal(context.window.gridlyCanonicalCrossingRuntime.resolveRecords({label:'Dallas'}),null);
});

test('map bridge preserves viewport and representative policy instead of county inventory', () => {
  assert.match(app, /canonicalResolution\?\.authorityAvailable[\s\S]*canonicalResolution\.records/);
  assert.match(app, /getGridlyPolicyVisibleCrossings/);
  assert.match(app, /visibilityPolicy\.useViewport/);
  assert.match(app, /visibilityPolicy\.markerLimit/);
  assert.match(app, /renderMode !== "representative"/);
  assert.doesNotMatch(app, /canonicalResolution[\s\S]{0,300}setActiveCounty/);
});

test('provider and consumer authorities remain protected and fail closed', () => {
  assert.match(app, /gridlyLP235CanonicalCommunityScopeAudit/);
  assert.match(app, /active local reports do not expose certified PLACE attribution/);
  assert.match(app, /provider point\/zone authority unavailable/);
  assert.match(app, /LP233 exact crossing IDs -> governed runtime record index -> existing viewport/);
  assert.match(app, /alertsUnaccountedIds/);
  assert.match(app, /allGovernedEvidenceAccountedFor/);
  assert.doesNotMatch(app.slice(app.indexOf('// LP235 is passive')), /setInterval|setTimeout|pointInPolygon|setActiveCounty/);
});

test('LP235.1 reuses observed LP234 DriveTexas authority and never manufactures false zero', () => {
  const lp235 = app.slice(app.indexOf('// LP235 is passive'), app.indexOf('/* LP221: Val Verde'));
  assert.match(lp235, /driveTexasAudit\.driveTexasRelevantCount/);
  assert.match(lp235, /driveTexasAudit\?\.lifecycleCounts\?\.activeAfterLifecycle/);
  assert.match(lp235, /driveTexasAuthorityAvailable[\s\S]*\? driveTexasAudit\.driveTexasRelevantCount : null/);
  assert.doesNotMatch(lp235, /relevantCount \|\| driveTexasAudit\.canonicalRelevantCount \|\| 0/);
  assert.doesNotMatch(lp235, /governedActiveCount \|\| driveTexasAudit\.governedCount \|\| 0/);
  assert.match(app, /LP039\.3 gridlyStoryTransportationConnectorRecords consumer-visible situations/);
  assert.match(app, /LP234 governed projection official_roadway lifecycle-eligible lineage/);
});

test('LP235.2 county fragmentation requires final, identity-backed removal', () => {
  assert.match(app, /Never diagnose county removal for an identity proven downstream/);
  assert.match(app, /!presentation && !areaRow/);
  assert.match(app, /alertsRemovedIds\.length/);
  assert.match(app, /removedGovernedIds: alertsRemovedIds/);
  assert.match(app, /finallyUnaccountedIds: finallyUnaccountedAlertIds/);
  assert.match(app, /INTERMEDIATE_SNAPSHOT_NOT_AUTHORITATIVE/);
  assert.match(app, /countyFragmentationEvidence\.filter/);
  assert.match(app, /areaRemovedIds\.some\(\(id\) => unaccountedGovernedIds\.includes\(id\)\)/);
  assert.doesNotMatch(app, /selectedMembership being present/);
});

test('LP235.2 reconciles crossing identity coverage including explicit cluster lineage', () => {
  for (const field of ['canonicalInputIds', 'visibleIds', 'representativeCandidateIds', 'crossingSelectedMarkerIds', 'crossingRenderedMarkerIds', 'crossingDuplicateRenderedIds', 'crossingLegacyCountyOnlyRenderedIds', 'crossingSelectedIdentityCount', 'crossingRenderedIdentityCoverageCount', 'crossingRenderedVisualMarkerCount', 'crossingUnrepresentedSelectedIds', 'crossingMarkerRepresentationLineage', 'crossingPublicationDisposition', 'crossingRenderCountInvariantPass']) {
    assert.match(app, new RegExp(field));
  }
  assert.match(app, /REPRESENTED_BY_CLUSTER/);
  assert.match(app, /crossingUnrepresentedSelectedIds\.length === 0/);
  assert.doesNotMatch(app, /crossingRenderedLayerCount === crossingSelectedMarkerCount/);
  assert.match(app, /crossingSelectedMarkerCount <= Number\(lastRender\.hardCapLimit\)/);
  assert.match(app, /canonicalResolution\?\.authorityAvailable[\s\S]*canonicalResolution\.records/);
});

test('LP235.2 reads existing governed consumer authorities without DOM-zero coercion', () => {
  const lp235 = app.slice(app.indexOf('// LP235 is passive'), app.indexOf('/* LP221: Val Verde'));
  assert.match(lp235, /consumerProjection\?\.surfaces/);
  assert.match(lp235, /consumerSurfaces\?\.kbygOfficialRoadways/);
  assert.match(lp235, /consumerSurfaces\?\.kbygCommunity/);
  assert.match(lp235, /gridlyGetGovernedActiveAwarenessRows/);
  assert.match(lp235, /consumerSurfaces\?\.communityPulse/);
  assert.doesNotMatch(lp235, /querySelector[^\n]*kbyg/);
  assert.doesNotMatch(lp235, /kbygOfficialCount \|\| 0/);
});

test('LP235.2 does not hardcode owner crossing controls or community branches', () => {
  const production = app.slice(0, app.indexOf('/* LP221: Val Verde'));
  for (const id of ['441023Y', '972547B', '763663N']) assert.doesNotMatch(production, new RegExp(id));
  const lp235 = app.slice(app.indexOf('// LP235 is passive'), app.indexOf('/* LP221: Val Verde'));
  assert.doesNotMatch(lp235, /Dallas|4819000|Austin|Katy|Corpus Christi/);
});

test('LP235.1 remains passive and does not alter protected production authorities', () => {
  const lp235 = app.slice(app.indexOf('// LP235 is passive'), app.indexOf('/* LP221: Val Verde'));
  assert.doesNotMatch(lp235, /fetch\(|setInterval|setTimeout|requestAnimationFrame|renderCrossings\(|setActiveCounty|pointInPolygon/);
  assert.doesNotMatch(lp235, /Dallas|4819000/);
});

test('LP235.3 exposes exact canonical Alerts source and disposition lineage', () => {
  const lp2353 = app.slice(app.indexOf('// LP235.3:'), app.indexOf('// LP235 is passive'));
  assert.match(lp2353, /gridlyLP235AlertsCanonicalSourceAudit/);
  for (const field of [
    'alertsSourceCollections', 'alertsStageAudit', 'governedToAlertsDisposition',
    'finalAlertsPresentations', 'writerInputs', 'extraFinalPresentationIds',
    'extraFinalProviderIds', 'extraFinalDisposition', 'unaccountedGovernedIds',
    'countyFragmentationPredicate', 'stalePriorGenerationRows',
    'legacyCollectionMixingDetected', 'countLabelMeaning'
  ]) assert.match(lp2353, new RegExp(field), field);
  for (const disposition of [
    'DIRECT_PRESENTATION', 'GROUPED_INTO_PRESENTATION',
    'INTENTIONALLY_NOT_ALERTS_ELIGIBLE', 'PROPAGATION_LOSS', 'UNACCOUNTED'
  ]) assert.match(lp2353, new RegExp(disposition), disposition);
});

test('LP235.3 grouping, county fragmentation, and extras require identity proof', () => {
  const lp2353 = app.slice(app.indexOf('// LP235.3:'), app.indexOf('// LP235 is passive'));
  assert.match(lp2353, /representedGovernedIds\.length > 1/);
  assert.match(lp2353, /__gridlyPresentationEvidenceRows/);
  assert.doesNotMatch(lp2353, /governed\.length\s*>\s*finalRows\.length[^;]*(GROUPED|COUNTY)/);
  assert.match(lp2353, /disposition === "COUNTY_FRAGMENTED"/);
  assert.match(lp2353, /countyFragmentationPredicate: null/);
  assert.match(lp2353, /validCurrentEquivalentLineage: false/);
  assert.match(lp2353, /LEGACY_ALERTS_ONLY_DRIVETEXAS_COLLECTION/);
});

test('LP235.3 canonical PLACE source repair is bounded before LP223', () => {
  const snapshotBoundary = app.slice(app.indexOf('// A canonical PLACE projection'), app.indexOf('const activeIncidentCount', app.indexOf('// A canonical PLACE projection')));
  assert.match(snapshotBoundary, /canonicalPlaceAlertsAuthority/);
  assert.match(snapshotBoundary, /CANONICAL_GOVERNED_PLACE_ONLY/);
  assert.match(snapshotBoundary, /NON_PLACE_LEGACY_FALLBACK/);
  assert.match(snapshotBoundary, /canonicalPlaceAlertsAuthority[\s\S]*areaFilteredAlertItems\.slice\(\)/);
  assert.match(snapshotBoundary, /canonicalPlaceAlertsAuthority[\s\S]*mergeGridlyOfficialSituationAlerts/);
  assert.doesNotMatch(snapshotBoundary, /render|innerHTML|querySelector|fetch\(|setInterval|setTimeout/);

  const lp2353 = app.slice(app.indexOf('// LP235.3:'), app.indexOf('// LP235 is passive'));
  assert.doesNotMatch(lp2353, /getAlertsSurfaceSnapshot\s*\(/, 'audit must not rebuild/refetch Alerts');
  assert.doesNotMatch(lp2353, /document\.|querySelector|innerHTML|fetch\(|setInterval|setTimeout/, 'audit does not scrape or mutate DOM and never polls');
  assert.doesNotMatch(lp2353, /Dallas|Austin|Katy|Corpus Christi|4819000/, 'no town-specific production branch');
});

test('LP235.3 leaves protected systems and LP223 writer implementation untouched', () => {
  const changedBoundary = app.slice(app.indexOf('// A canonical PLACE projection'), app.indexOf('// LP235 is passive'));
  assert.doesNotMatch(changedBoundary, /crossingCertifiedCount|kbygOfficialCount|topAwarenessActive|communityPulseActive/);
  assert.match(app, /window\.gridlyAlertsAuthorityWriterAudit = function/);
  assert.match(app, /firstLosingStage = "DOM_PARITY_PASS"/);
});
