import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const continuation = between('let governedRoadHazardReportDraft = null;', 'window.submitHazardNearMe = function');
const visibleUseLocation = between('window.submitHazardNearMe = function', 'function getGridlyForegroundLocationProvider');
const tapMap = between('async function handleHazardPlacementMapClick', 'function gridlyRoundAuditMeters');

test('visible Flooding > Use My Location path retains the governed draft and opens review without submitting', async () => {
  const updates = [];
  const mapViews = [];
  const opened = [];
  const context = {
    console,
    Date,
    Object,
    window: {
      openGridlyPortraitV2Sheet: (name) => opened.push(name)
    },
    map: { setView: (...args) => mapViews.push(args) },
    gridlyCoordinateFromRecord: (value) => value && Number.isFinite(value.lat) && Number.isFinite(value.lng) ? { lat: value.lat, lng: value.lng } : null,
    gridlyResolveCountyIdForCoordinate: () => ({ countyId: 'liberty-tx', source: 'boundary' }),
    gridlyGetReportSubmissionCountyScopedMetadata: () => ({ county_id: 'liberty-tx', state: 'TX' }),
    gridlyGetReportSubmissionCommunityMetadata: () => ({ communityName: 'Dayton', placeGeoid: '4819600' }),
    updateReportingState: (patch) => updates.push(patch),
    syncHazardPickerUiState: () => {},
    createSharedHazardReport: () => { throw new Error('Use My Location crossed the submission boundary'); }
  };
  vm.createContext(context);
  vm.runInContext(`${continuation}\nthis.buildDraft = buildGovernedRoadHazardReportDraft; this.continueToReview = continueGovernedRoadHazardDraftToReview;` , context);

  const draft = context.buildDraft('flooding', { lat: 30.0466, lng: -94.8852 }, {
    finalPlacementCoordinate: { lat: 30.047, lng: -94.884 },
    snappedRoadCoordinate: { lat: 30.047, lng: -94.884 },
    selectedRoadName: 'US 90',
    placementMode: 'projected_point_used'
  });
  context.continueToReview(draft);

  assert.equal(draft.hazardType, 'flooding');
  assert.deepEqual({ ...draft.rawCoordinate }, { lat: 30.0466, lng: -94.8852 });
  assert.deepEqual({ ...draft.finalCoordinate }, { lat: 30.047, lng: -94.884 });
  assert.equal(draft.selectedRoadName, 'US 90');
  assert.equal(draft.countyResolution.countyId, 'liberty-tx');
  assert.equal(draft.communityMetadata.communityName, 'Dayton');
  assert.equal(draft.reviewState, 'ready');
  assert.equal(opened.at(-1), 'report');
  assert.equal(JSON.stringify(mapViews.at(-1)), JSON.stringify([[30.047, -94.884], 16]));
  assert.equal(updates.at(-1).selectedHazardType, 'flooding');
  assert.equal(updates.at(-1).submissionInProgress, false);
});

test('visible action snaps once and continuation owns success while denial, timeout, and browser fallback remain', () => {
  assert.match(app, /"report-use-location": \(\) =>[\s\S]*window\.submitHazardNearMe\(resolvedHazardType\)/);
  assert.equal((visibleUseLocation.match(/await snapHazardToRoad\(/g) || []).length, 1);
  assert.match(visibleUseLocation, /buildGovernedRoadHazardReportDraft\(selectedType, \{ lat, lng \}, \{/);
  assert.match(visibleUseLocation, /continueGovernedRoadHazardDraftToReview\(draft\)/);
  assert.doesNotMatch(visibleUseLocation, /await createSharedHazardReport\(/);
  assert.match(visibleUseLocation, /finishLocationFailure\("Location is taking too long/);
  assert.match(visibleUseLocation, /Location permission was denied/);
  assert.match(app, /kind: "browser", plugin: navigator\.geolocation/);
});

test('shared submission stays behind explicit draft confirmation and Tap Map keeps its existing submit owner', () => {
  assert.match(continuation, /async function submitGovernedRoadHazardDraft\(\)[\s\S]*return createSharedHazardReport\(/);
  assert.equal((tapMap.match(/await snapHazardToRoad\(/g) || []).length, 1);
  assert.equal((tapMap.match(/await createSharedHazardReport\(/g) || []).length, 1);
  assert.match(tapMap, /confidence === "tap map placement"|"tap map placement"/);
  assert.match(app, /continuingGovernedReportReview[\s\S]*!continuingGovernedReportReview/);
});
