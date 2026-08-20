import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('js/app.js', 'utf8');
const functionSource = name => source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))?.[0] || '';
const saveSource = functionSource('saveGridlyHomeTownPreference');
const canonicalSaveSource = functionSource('gridlySaveCanonicalMultiCountyPlaceHome');
const synchronizerSource = functionSource('gridlySynchronizeActiveCountyForOperationalContext');

function exitRuntime({ oldPlaceGeoid, oldLabel, oldCountyId, nextPlaceGeoid, nextLabel, nextCountyId }) {
  const storage = new Map([['home-record', JSON.stringify({
    identityType: 'PLACE_GEOID', countyId: null, communityKey: oldPlaceGeoid,
    awarenessAreaKey: `place-${oldPlaceGeoid}`, consumerLabel: oldLabel
  })]]);
  const areas = {
    [nextLabel]: { key: `place-${nextPlaceGeoid}`, label: nextLabel, storageValue: nextLabel, placeGeoid: nextPlaceGeoid, countyId: nextCountyId }
  };
  const state = { activeCounty: oldCountyId, roadwayCounty: oldCountyId, railCounty: oldCountyId, settings: {}, profile: {}, generation: 12 };
  const trace = [];
  const context = {
    GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY: 'home-record', activeGeoFilter: 'town', crossingRenderFilterVersion: 0,
    localStorage: { removeItem(key) { trace.push(['retire-owner', key, state.generation]); storage.delete(key); } },
    gridlyReadHomePersonalizationRecord: () => storage.has('home-record') ? JSON.parse(storage.get('home-record')) : null,
    invalidateGridlySelectedAwarenessAreaResolutionCache: reason => trace.push(['invalidate', reason, state.generation]),
    resolveGridlyAwarenessArea: value => areas[value] || null,
    gridlyResolveCanonicalPlaceGeoid: area => area?.placeGeoid || null,
    gridlyResolveCountyIdForAwarenessArea: value => areas[value]?.countyId,
    gridlySetActiveCountyContext(countyId) { trace.push(['county', state.activeCounty, countyId, state.generation]); state.activeCounty = countyId; state.roadwayCounty = countyId; state.railCounty = countyId; state.generation += 1; return countyId; },
    getGridlySettingsPreferences: () => state.settings,
    saveGridlySettingsPreferences: value => { state.settings = value; trace.push(['settings', value.community.awarenessAreaKey, state.generation]); },
    gridlySafeLocalStorageSet: (key, value) => storage.set(key, value),
    saveGridlyUserProfile: value => { state.profile = { ...state.profile, ...value }; trace.push(['profile', value.awarenessAreaKey, state.generation]); },
    applyGridlyHomeTownAwarenessContext: () => { trace.push(['semantic-camera', `place-${nextPlaceGeoid}`, state.generation]); return true; },
    scheduleRenderCrossings() {}, updateMobileWatchHeader() {},
    invalidateGridlyPortraitAwarenessSnapshotsForAreaChange() {}, syncGridlyAwarenessAreaSurfacesImmediately() {}
  };
  vm.runInNewContext(`${saveSource};this.save=saveGridlyHomeTownPreference`, context);
  return { saved: context.save(nextLabel, { source: 'multi-county-exit' }), storage, state, trace };
}

function assertCleanExit(fixture) {
  const result = exitRuntime(fixture);
  assert.equal(result.saved, fixture.nextLabel);
  assert.equal(result.storage.has('home-record'), false, 'superseded canonical owner is removed');
  assert.equal(result.state.settings.community.awarenessAreaKey, `place-${fixture.nextPlaceGeoid}`);
  assert.equal(result.state.profile.awarenessAreaKey, `place-${fixture.nextPlaceGeoid}`);
  assert.equal(result.state.activeCounty, fixture.nextCountyId);
  assert.equal(result.state.roadwayCounty, fixture.nextCountyId);
  assert.equal(result.state.railCounty, fixture.nextCountyId);
  assert.ok(result.trace.findIndex(row => row[0] === 'retire-owner') < result.trace.findIndex(row => row[0] === 'county'));
  return result;
}

test('Baytown on a non-first governed county exits cleanly to Chester', () => {
  assertCleanExit({ oldPlaceGeoid: '4806128', oldLabel: 'Baytown', oldCountyId: 'chambers-tx', nextPlaceGeoid: '4814584', nextLabel: 'Chester', nextCountyId: 'tyler-tx' });
});

test('second real multi-county control exits Wildwood to Palestine', () => {
  assertCleanExit({ oldPlaceGeoid: '4879204', oldLabel: 'Wildwood', oldCountyId: 'tyler-tx', nextPlaceGeoid: '4854708', nextLabel: 'Palestine', nextCountyId: 'anderson-tx' });
});

test('multi-county A to multi-county B retains only B canonical authority', () => {
  const result = exitRuntime({ oldPlaceGeoid: '4806128', oldLabel: 'Baytown', oldCountyId: 'chambers-tx', nextPlaceGeoid: '4879204', nextLabel: 'Wildwood', nextCountyId: 'tyler-tx' });
  assert.equal(result.saved, 'Wildwood');
  assert.equal(result.storage.has('home-record'), false);
  assert.equal(result.state.settings.community.awarenessAreaKey, 'place-4879204');
  assert.equal(result.state.activeCounty, 'tyler-tx');
});

test('old deferred multi-county operations are guarded by the shared transition generation', () => {
  assert.match(canonicalSaveSource, /cameraGeneration = gridlyActiveCountyTransitionGeneration/);
  assert.match(canonicalSaveSource, /cameraGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.match(synchronizerSource, /retryGeneration = gridlyActiveCountyTransitionGeneration/);
  assert.match(synchronizerSource, /retryGeneration !== gridlyActiveCountyTransitionGeneration/);
});

test('ordinary save retires the old canonical owner before the active-county setter', () => {
  assert.ok(saveSource.indexOf('localStorage.removeItem(GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY)') < saveSource.indexOf('gridlySetActiveCountyContext(resolvedCountyId'));
});
