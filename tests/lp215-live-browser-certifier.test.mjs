import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyDriveTexas, compareStale, evaluateAlerts, evaluateExpectedEmptyRail, exactIdParity, checkpointPayload, resumeIndex, TERMINAL_STATES } from '../tools/lp215/live-certifier-core.mjs';

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

test('live certifier calls the same highest-level production action used by Settings without picker choreography', () => {
  const source = fs.readFileSync('tools/lp215/lp215-live-browser-certifier.js', 'utf8');
  const production = fs.readFileSync('js/app.js', 'utf8');
  const selection = source.slice(source.indexOf('async function selectThroughCanonicalProductionAction'), source.indexOf('\n  function snapshot'));
  assert.match(production, /function selectGridlySettingsAwarenessArea\([\s\S]*?saveGridlyHomeTownPreference\(saveValue, \{ source \}\)/);
  assert.match(selection, /global\.selectGridlySettingsAwarenessArea\(row\.canonicalKey, 'lp215_live_certification', null\)/);
  assert.doesNotMatch(source, /mobileDockSettingsBtn|settingsChooseCommunityManuallyBtn|data-gridly-manual-awareness-search|data-gridly-manual-awareness-value|data-gridly-manual-awareness-apply/);
});

test('live run starts directly at row 001 and makes 253 controlled predecessor comparisons', () => {
  const source = fs.readFileSync('tools/lp215/lp215-live-browser-certifier.js', 'utf8');
  const run = source.slice(source.indexOf('async function run'), source.indexOf('\n  function payload'));
  const start = source.slice(source.indexOf('global.gridlyLp215Start='));
  assert.doesNotMatch(source, /seedWraparoundPredecessor|SEED_SOURCE_TIMEOUT_MS|seedSettlement|selectedCommunityMatchesExpected/);
  assert.match(run, /const row=state\.itinerary\[state\.index\]/);
  assert.match(run, /await selectThroughCanonicalProductionAction\(row\)/);
  assert.match(source, /'NOT_APPLICABLE_FIRST_ROW'/);
  assert.match(source, /controlledStaleTransitions:Math\.max\(0,state\.results\.length-1\)/);
  assert.match(start, /state\.previous=state\.index>0\?previousFrom\(state\.results\[state\.index-1\]\):null/);
  assert.equal(report.rows[0].sequence, 1);
  assert.equal(report.rows[0].countyFips, '48001');
  assert.equal(report.rows[253].sequence, 254);
});

test('optional 254 to 001 wraparound is separate, post-completion, and non-blocking', () => {
  const source = fs.readFileSync('tools/lp215/lp215-live-browser-certifier.js', 'utf8');
  const helper = source.slice(source.indexOf('global.gridlyLp215OptionalWraparound='), source.indexOf('\n  global.gridlyLp215Start='));
  assert.match(helper, /state\.index!==254/);
  assert.match(helper, /nonBlocking:true/);
  assert.match(helper, /catch\(error\)/);
  assert.doesNotMatch(source.slice(source.indexOf('async function run'), source.indexOf('\n  function payload')), /OptionalWraparound/);
});

test('county rows use production selection with no direct state mutation', () => {
  const source = fs.readFileSync('tools/lp215/lp215-live-browser-certifier.js', 'utf8');
  const selection = source.slice(source.indexOf('async function selectThroughCanonicalProductionAction'), source.indexOf('\n  function snapshot'));
  assert.doesNotMatch(selection, /GRIDLY_ACTIVE_COUNTY_ID\s*=|activeCounty(Id)?\s*=|selectedCommunity\s*=|localStorage\.|sessionStorage\.|gridlyDispatchSemanticCamera\s*\(/);
  assert.match(selection, /CANONICAL_PRODUCTION_SELECTION_ACTION_NOT_AVAILABLE/);
  assert.match(selection, /CANONICAL_PRODUCTION_SELECTION_ACTION_REJECTED/);
});
