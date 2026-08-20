import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyDriveTexas, compareStale, currentOptionContextMatches, evaluateAlerts, evaluateExpectedEmptyRail, evaluateSeedSettlement, exactIdParity, checkpointPayload, resumeIndex, TERMINAL_STATES } from '../tools/lp215/live-certifier-core.mjs';

const report = JSON.parse(fs.readFileSync('reports/lp215/statewide-consumer-wiring-certification.json', 'utf8'));

test('live itinerary is exactly the committed 254 unique counties', () => {
  assert.equal(report.rows.length, 254);
  assert.equal(new Set(report.rows.map(row => row.countyFips)).size, 254);
  assert.equal(new Set(report.rows.map(row => row.countyId)).size, 254);
  assert.deepEqual(report.rows.map(row => row.sequence), Array.from({ length: 254 }, (_, index) => index + 1));
});

test('checkpoint resumes only the contiguous committed itinerary prefix', () => {
  const checkpoint = checkpointPayload(report.rows.slice(0, 17), '2026-08-20T00:00:00.000Z');
  assert.equal(resumeIndex(report.rows, checkpoint), 17);
  checkpoint.results[3] = { countyFips: 'wrong' };
  assert.equal(resumeIndex(report.rows, checkpoint), 3);
  assert.equal(resumeIndex(report.rows, null), 0);
});

test('DriveTexas terminal classifications are bounded and fail closed', () => {
  assert.deepEqual(TERMINAL_STATES, ['HEALTHY_WITH_DATA','HEALTHY_EMPTY','STALE_RETAINED','FAILED','UNAVAILABLE','TIMEOUT','NOT_AVAILABLE_IN_RUNTIME']);
  assert.equal(classifyDriveTexas({ sourceStatus: 'HEALTHY_WITH_DATA' }), 'HEALTHY_WITH_DATA');
  assert.equal(classifyDriveTexas({ sourceStatus: 'SOURCE_FAILED_WITH_RETAINED_DATA' }), 'STALE_RETAINED');
  assert.equal(classifyDriveTexas({ sourceStatus: 'SOURCE_FAILED_NO_RETAINED_DATA' }), 'FAILED');
  assert.equal(classifyDriveTexas({ sourceStatus: 'SOURCE_UNAVAILABLE' }), 'UNAVAILABLE');
  assert.equal(classifyDriveTexas(null, true), 'TIMEOUT');
  assert.equal(classifyDriveTexas(null), 'NOT_AVAILABLE_IN_RUNTIME');
});

test('DriveTexas zero is not HEALTHY_EMPTY without successful fetch contract', () => {
  assert.equal(classifyDriveTexas({ sourceStatus: 'HEALTHY_EMPTY', currentAreaRecordCount: 0 }), null);
  assert.equal(classifyDriveTexas({ sourceStatus: 'HEALTHY_EMPTY', currentAreaRecordCount: 0, requestCompleted: true }), 'HEALTHY_EMPTY');
  assert.equal(classifyDriveTexas({ sourceStatus: 'HEALTHY_EMPTY', currentAreaRecordCount: 0, quietEligible: true }), 'HEALTHY_EMPTY');
});

test('expected-empty rail handling requires exact live zero', () => {
  assert.deepEqual(evaluateExpectedEmptyRail('ACTIVE_EMPTY', 0, 0), { classification: 'RAIL_EXPECTED_EMPTY', pass: true });
  assert.equal(evaluateExpectedEmptyRail('ACTIVE_EMPTY', 0, 1).pass, false);
  assert.equal(evaluateExpectedEmptyRail('ACTIVE_POSITIVE', 2, 2).pass, true);
});

test('Alerts permits governed zero eligible and rejects unexplained empty', () => {
  assert.equal(evaluateAlerts({ eligibleCount: 0, displayedCount: 0, emptyReason: 'NO_ELIGIBLE_RECORDS', ownershipState: 'PRODUCTION_ALERTS_CONTRACT' }).pass, true);
  assert.equal(evaluateAlerts({ eligibleCount: 0, displayedCount: 0, emptyReason: null, ownershipState: 'PRODUCTION_ALERTS_CONTRACT' }).pass, false);
  assert.equal(evaluateAlerts({ eligibleCount: 2, displayedCount: 2, emptyReason: null, ownershipState: 'PRODUCTION_ALERTS_CONTRACT' }).pass, true);
});

test('rail parity compares exact normalized ID sets, not counts', () => {
  assert.equal(exactIdParity(['b','a'], ['a','b'], ['b','a']).pass, true);
  assert.equal(exactIdParity(['a','b'], ['a','c'], ['a','b']).pass, false);
});

test('stale state comparison keeps every ownership surface independent', () => {
  const previous = { selectedCommunity:'place-old', activeCounty:'old-tx', roadwaySourceCounty:'old-tx', driveTexasRecordIds:['d1'], railSourceCounty:'old-tx', railMarkerIds:['r1'], alertCardIds:['a1'], awarenessRecordIds:['w1'] };
  const clean = compareStale(previous, { selectedCommunity:'place-new', activeCounty:'new-tx', roadwaySourceCounty:'new-tx', driveTexasRecordIds:['d2'], railSourceCounty:'new-tx', railMarkerIds:['r2'], alertCardIds:[], awarenessRecordIds:[] });
  assert.equal(clean.pass, true);
  const stale = compareStale(previous, { selectedCommunity:'place-new', activeCounty:'new-tx', roadwaySourceCounty:'new-tx', driveTexasRecordIds:['d1'], railSourceCounty:'new-tx', railMarkerIds:[], alertCardIds:[], awarenessRecordIds:[] });
  assert.equal(stale.pass, false); assert.equal(stale.checks.driveTexasRecordIds, false);
});

test('Fredericksburg is the explicit expected-empty control', () => {
  const row = report.rows.find(row => row.countyId === 'gillespie-tx');
  assert.equal(row.representativeCommunity, 'Fredericksburg'); assert.equal(row.placeGeoid, '4827348');
  assert.deepEqual(row.semanticCameraTarget, { lat:30.2752011, lng:-98.8719843, zoom:13 });
  assert.equal(row.roadwayFeatureCount, 3725); assert.equal(row.railManifestStatus, 'ACTIVE_EMPTY'); assert.equal(row.railGovernedCount, 0);
});

const seedRow = report.rows[253];
const settledSeed = (overrides = {}) => ({
  selectedCommunity: seedRow.canonicalKey, activeCounty: seedRow.countyId,
  mapCenter: { lat: seedRow.semanticCameraTarget.lat, lng: seedRow.semanticCameraTarget.lng }, mapZoom: 13,
  roadwayCounty: seedRow.countyId, roadwayLoaded: true, driveState: 'HEALTHY_EMPTY',
  officialRoadwaySettled: true, alertsSettled: true, railSourceCounty: seedRow.countyId,
  railInventoryCount: 0, railRenderCalls: 9, railFilterCalls: 0, staleCleanupComplete: true,
  ...overrides
});

test('predecessor community, county, camera, and consumer generations settle independently', () => {
  const result = evaluateSeedSettlement(seedRow, settledSeed());
  assert.equal(result.settled, true); assert.deepEqual(result.unsatisfied, []);
});

test('terminal DriveTexas failure and empty Alerts do not block the seed', () => {
  const result = evaluateSeedSettlement(seedRow, settledSeed({ driveState: 'FAILED', officialRoadwaySettled: false, alertsSettled: false }));
  assert.equal(result.settled, true);
  assert.equal(result.conditions.driveTexasLifecycleTerminal, true);
  assert.equal(result.conditions.alertsConsumerSettled, true);
});

test('authoritative expected-empty rail settles without inventory or filter calls', () => {
  const result = evaluateSeedSettlement(seedRow, settledSeed({ railInventoryCount: 0, railRenderCalls: 9, railFilterCalls: 0 }));
  assert.equal(result.settled, true);
  assert.equal(result.conditions.railInventoryTerminal, true);
  assert.equal(result.conditions.railPresentationTerminal, true);
});

test('nonterminal predecessor context remains unsettled and reports every condition', () => {
  const result = evaluateSeedSettlement(seedRow, settledSeed({ activeCounty: 'dimmit-tx', driveState: null, railRenderCalls: 0 }));
  assert.equal(result.settled, false);
  assert.deepEqual(result.unsatisfied, ['activeCountyMatchesExpected', 'driveTexasLifecycleTerminal', 'railInventoryTerminal', 'railPresentationTerminal']);
});

test('live certifier calls the same highest-level production action used by Settings without picker choreography', () => {
  const source = fs.readFileSync('tools/lp215/lp215-live-browser-certifier.js', 'utf8');
  const production = fs.readFileSync('js/app.js', 'utf8');
  const selection = source.slice(source.indexOf('async function selectThroughCanonicalProductionAction'), source.indexOf('\n  function snapshot'));
  assert.match(production, /function selectGridlySettingsAwarenessArea\([\s\S]*?saveGridlyHomeTownPreference\(saveValue, \{ source \}\)/);
  assert.match(selection, /global\.selectGridlySettingsAwarenessArea\(row\.canonicalKey, 'lp215_live_certification', null\)/);
  assert.doesNotMatch(source, /mobileDockSettingsBtn|settingsChooseCommunityManuallyBtn|data-gridly-manual-awareness-search|data-gridly-manual-awareness-value|data-gridly-manual-awareness-apply/);
});

test('current PLACE option uses authoritative GEOID and county rather than its registry key', () => {
  const expected = { canonicalKey: 'place-4803008', placeGeoid: '4803008', countyId: 'zavala-tx' };
  const runtime = {
    awarenessAreaKey: 'zavala-tx-amaya',
    selectedPlaceGeoid: '4803008',
    selectedCountyId: 'zavala-tx',
    activeCountyId: 'zavala-tx'
  };
  assert.equal(currentOptionContextMatches(runtime, expected), true);
  assert.equal(currentOptionContextMatches({ ...runtime, selectedPlaceGeoid: '4899999' }, expected), false, 'matching label or runtime key cannot replace PLACE identity');
  assert.equal(currentOptionContextMatches({ ...runtime, awarenessAreaKey: expected.canonicalKey, selectedPlaceGeoid: '4899999' }, expected), false, 'matching canonical-looking picker key cannot override the wrong GEOID');
  assert.equal(currentOptionContextMatches({ ...runtime, selectedCountyId: 'dimmit-tx' }, expected), false, 'PLACE ownership must match');
  assert.equal(currentOptionContextMatches({ ...runtime, activeCountyId: 'dimmit-tx' }, expected), false, 'operational active county must match');
  assert.equal(currentOptionContextMatches({ ...runtime, selectedPlaceGeoid: null, selectedCommunityId: null }, expected), false, 'missing authoritative PLACE identity fails closed');
});

test('legacy current options retain exact key and active-county identity', () => {
  const expected = { canonicalKey: 'legacy-community', countyId: 'legacy-tx' };
  assert.equal(currentOptionContextMatches({ awarenessAreaKey: 'legacy-community', activeCountyId: 'legacy-tx' }, expected), true);
  assert.equal(currentOptionContextMatches({ awarenessAreaKey: 'other-community', activeCountyId: 'legacy-tx' }, expected), false);
});

test('Amaya/Zavala seed and county 001 advance use production selection with no direct state mutation', () => {
  const source = fs.readFileSync('tools/lp215/lp215-live-browser-certifier.js', 'utf8');
  const selection = source.slice(source.indexOf('async function selectThroughCanonicalProductionAction'), source.indexOf('\n  function snapshot'));
  const seed = source.slice(source.indexOf('async function seedWraparoundPredecessor'), source.indexOf('\n  async function run'));
  const run = source.slice(source.indexOf('async function run'), source.indexOf('\n  function payload'));
  assert.doesNotMatch(selection, /GRIDLY_ACTIVE_COUNTY_ID\s*=|activeCounty(Id)?\s*=|selectedCommunity\s*=|localStorage\.|sessionStorage\.|gridlyDispatchSemanticCamera\s*\(/);
  assert.match(seed, /const row=state\.itinerary\[253\]/);
  assert.match(seed, /currentOptionContextMatches\(current,row\)/);
  assert.match(seed, /else await selectThroughCanonicalProductionAction\(row\)/);
  assert.match(run, /const row=state\.itinerary\[state\.index\]/);
  assert.match(run, /await selectThroughCanonicalProductionAction\(row\)/);
  assert.equal(report.rows[253].representativeCommunity, 'Amaya');
  assert.equal(report.rows[253].countyId, 'zavala-tx');
  assert.equal(report.rows[0].countyFips, '48001');
  assert.match(selection, /CANONICAL_PRODUCTION_SELECTION_ACTION_NOT_AVAILABLE/);
  assert.match(selection, /CANONICAL_PRODUCTION_SELECTION_ACTION_REJECTED/);
});
