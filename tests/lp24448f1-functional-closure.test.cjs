const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

test('empty, single-slot and full profiles do not mutate verified slots or invoke migration', async () => {
  const h = {};
  vm.createContext(h);
  vm.runInContext(fs.readFileSync('js/gridly-saved-address-integrity.js', 'utf8'), h);
  vm.runInContext(fs.readFileSync('js/gridly-saved-place-revalidation-ownership.js', 'utf8'), h);
  const integrity = h.GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT;
  const valid = { coordinateSource: 'geocode', address: 'Dayton, TX', lat: 30.04, lng: -94.88,
    resolutionStatus: 'success', validationStatus: 'passed' };
  for (const state of [{ home: null, work: null }, { home: valid, work: null },
    { home: null, work: valid }, { home: valid, work: valid }]) {
    const before = JSON.stringify(state);
    const controller = h.GRIDLY_SAVED_PLACE_REVALIDATION_OWNERSHIP_CONTRACT.createController({
      getState: () => state, saveState: () => assert.fail('Valid slots must not be saved again'),
      shouldRevalidate: integrity.needsLegacyRevalidation,
      revalidatePlace: () => assert.fail('Valid slots must not be revalidated')
    });
    await controller.revalidateSlots();
    assert.equal(JSON.stringify(state), before);
  }
  for (const invalid of [null, undefined, '', [], 1, { coordinateSource: 'geocode', address: 'Dayton, TX', lat: 'invalid', lng: -94.88 }]) {
    assert.equal(Boolean(integrity.needsLegacyRevalidation(invalid)), false);
  }
  const legacy = { coordinateSource: 'geocode', address: 'Dayton, TX', lat: 30.04, lng: -94.88 };
  assert.equal(Boolean(integrity.needsLegacyRevalidation(legacy)), true);
  const outcome = await integrity.revalidateLegacyPlace({ place: legacy, search: async () => ({ ok: false, results: [] }) });
  assert.equal(outcome.attempted, true);
  assert.equal(outcome.place.routeEligible, false);
  assert.notEqual(outcome.place.validationStatus, 'passed');
});

test('Alerts restores latest explicit open AND closed choices over stale replacement markup', () => {
  const h = { window: {}, document: {} };
  vm.createContext(h);
  vm.runInContext('const gridlyLP236AlertsState = { disclosure: { initialized:false } };\n' +
    section('  function gridlyLP236CaptureDisclosureState(', '  function gridlyLP236BuildModel('), h);
  const node = (key, kind, open) => ({ dataset: { gridlyDisclosureKey: key }, open,
    matches: selector => selector === `.gridly-lp236-${kind}` });
  const root = nodes => ({ dataset: {}, matches: () => true, addEventListener: () => {},
    querySelectorAll: selector => selector === 'details[data-gridly-disclosure-key]' ? nodes
      : nodes.filter(n => (!selector.includes('[open]') || n.open) && selector.includes(n.matches('.gridly-lp236-source') ? 'source' : n.matches('.gridly-lp236-group') ? 'group' : 'roadway-group')) });
  const existing = [node('community_report', 'source', true), node('community_report:debris', 'group', false), node('official:road', 'roadway-group', true)];
  h.window.gridlyLP236CaptureDisclosureState(root(existing));
  // A provider transition briefly removes every disclosure but does not close it.
  h.window.gridlyLP236CaptureDisclosureState(root([]));
  const replacement = existing.map(n => ({ ...n, open: !n.open }));
  h.window.gridlyLP236RestoreDisclosureState(root(replacement));
  assert.deepEqual(replacement.map(n => n.open), [true, false, true]);
  existing[0].open = false;
  h.window.gridlyLP236CaptureDisclosureState(root(existing));
  h.window.gridlyLP236RestoreDisclosureState(root(replacement));
  assert.equal(replacement[0].open, false);
});

test('Around Me info uses the existing portrait acknowledgement without enabling unrelated info', () => {
  const h = { isPortraitMode: () => true, document: { querySelector: () => 'status', getElementById: () => 'hidden' },
    els: {}, isGridlyElementVisiblyReadable: e => e === 'status' };
  vm.createContext(h);
  vm.runInContext(section('function shouldMirrorReportConfirmationToPortraitV2(', 'function setGridlyPortraitV2AcknowledgementTextIfChanged('), h);
  for (const message of ['Finding your location…', 'Location permission was denied.', 'Location timed out.', 'A fresh location is unavailable.', 'Around Me location has expired.']) {
    assert.equal(h.shouldMirrorReportConfirmationToPortraitV2(message, 'info', { source: 'around-me' }), true);
    assert.equal(h.shouldMirrorReportConfirmationToPortraitV2(message, 'info'), false);
  }
  assert.equal(h.shouldMirrorReportConfirmationToPortraitV2('Report received', 'success'), true);
});

test('shared freshness uses per-record timestamps, advances cached ages and agrees for nested records', () => {
  let now = Date.parse('2026-09-23T12:00:00Z');
  class Clock extends Date { static now() { return now; } }
  const h = { Date: Clock };
  vm.createContext(h);
  vm.runInContext(section('function getGridlyHazardFreshnessSource(', 'function getGridlyCommunityTrustPresentationModel('), h);
  const records = [0, 5, 12].map(age => ({ submittedAt: new Date(now - age * 60000).toISOString(), minutesAgo: age, minutesText: 'now' }));
  assert.deepEqual(records.map(r => h.getGridlyHazardPopupMinutesAgo(r)), [0, 5, 12]);
  now += 2 * 60000;
  assert.deepEqual(records.map(r => h.getGridlyHazardPopupMinutesAgo(r)), [2, 7, 14]);
  const updated = { ...records[2], updated_at: new Date(now - 60000).toISOString() };
  assert.equal(h.getGridlyHazardPopupMinutesAgo(updated), 1);
  assert.equal(h.formatGridlyHazardPopupFreshnessLine({ incident: records[1] }), h.formatGridlyHazardPopupFreshnessLine(records[1]));
  assert.equal(h.getGridlyHazardPopupMinutesAgo({ minutesAgo: 8 }), 8);
});

test('area activity copy does not imply incident corroboration', () => {
  const h = { gridlyTravelBriefCleanLine: x => x };
  vm.createContext(h);
  vm.runInContext(section('function gridlyStoryConfidence(', 'function gridlyStoryConditionIdentity('), h);
  vm.runInContext(section('function gridlyTravelBriefConfidenceLine(', 'function gridlyBuildTravelBriefDecisionSection('), h);
  const confidence = h.gridlyStoryConfidence([{ id: 'a' }, { id: 'b' }, { id: 'c' }], {});
  assert.equal(h.gridlyTravelBriefConfidenceLine({ confidence }), 'Multiple recent signals.');
  assert.doesNotMatch(h.gridlyTravelBriefConfidenceLine({ confidence }), /verified|confirmed|strong supporting/i);
  assert.equal(h.gridlyTravelBriefConfidenceLine({ confidence: 'Early signs point to this.' }), 'Developing conditions.');
});
