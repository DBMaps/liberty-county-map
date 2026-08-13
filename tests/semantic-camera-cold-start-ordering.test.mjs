import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8'));

function body(name, next = 'function ') {
  const start = app.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = app.indexOf(`\n\n${next}`, start + 1);
  return app.slice(start, end < 0 ? app.length : end);
}

test('cold-start PLACE identities all resolve to governed zoom-13 targets', () => {
  for (const displayName of ['San Antonio', 'El Paso', 'Laredo', 'Dallas', 'Palestine', 'Liberty']) {
    const communities = projection.communities.filter((community) => community.displayName === displayName);
    assert.equal(communities.length, 1, `${displayName} has one canonical PLACE identity`);
    const target = presentation.places[communities[0].placeGeoid];
    assert.ok(Number.isFinite(target?.lat) && Number.isFinite(target?.lon), `${displayName} has a governed camera target`);
  }
  const init = body('initMap', 'function gridlyGetConsumerCrossingFraId');
  assert.match(init, /gridlyStartupSemanticContext\?\.area \|\| getGridlyHomeTownAwarenessAnchor\(\)/);
  assert.match(init, /gridlyDispatchSemanticCamera\([^;]+source: "initial_map_construction"/);
  assert.match(init, /if \(!startupCameraIssued\) map\.setView\(defaultCenter, 13\)/);
  assert.ok(init.indexOf('gridlyDispatchSemanticCamera') < init.indexOf('baseLayers[initialStyle].addTo(map)'), 'camera exists before Leaflet adds tiles');
});

test('persisted El Paso Countywide waits for authoritative geometry before map construction', () => {
  const bootstrap = app.slice(app.indexOf('document.addEventListener("DOMContentLoaded", async () => {'), app.indexOf('setInterval(() => {', app.indexOf('document.addEventListener("DOMContentLoaded", async () => {')));
  const presentationLoad = bootstrap.indexOf('"statewide PLACE presentation loading"');
  const identityRead = bootstrap.indexOf('gridlyResolvePersistedSemanticContextForStartup()');
  const geometryLoad = bootstrap.indexOf('"startup authoritative county geometry loading"');
  const mapInit = bootstrap.indexOf('"map initialization"');
  const restore = bootstrap.indexOf('gridlyRestoreHomePersonalizationOnStartup?.()');
  const crossingLoad = bootstrap.indexOf('"crossing package loading and initial marker rendering"');
  assert.ok(presentationLoad < identityRead && identityRead < geometryLoad && geometryLoad < mapInit && mapInit < restore && restore < crossingLoad);
  assert.match(body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection'), /gridlyGetAuthoritativeCountyGeometryFocusBounds/);
});

test('startup restore is read/hydrate-only and crossing activation is gated', () => {
  const restoreStart = app.indexOf('function gridlyRestoreHomePersonalizationOnStartup');
  const restore = app.slice(restoreStart, app.indexOf('\nfunction gridlyLp0516PreviewSelection', restoreStart));
  assert.match(restore, /gridlyHydratePersistedSemanticContextOnStartup/);
  assert.doesNotMatch(restore, /gridlyApplyConfirmedHomePersonalization|localStorage\.setItem|saveGridlyHomeTownPreference/);
  const hydrate = body('gridlyHydratePersistedSemanticContextOnStartup', 'const GRIDLY_LP0361_PASSIVE');
  assert.match(hydrate, /persisted: false/);
  assert.match(hydrate, /mapFocused: gridlyPrimaryMapCameraInitialized/);
  assert.match(body('gridlySetActiveCountyContext', 'function resyncGridlyActiveCountyVisibleSurfaces'), /if \(gridlyStartupContextFinalized\) ensureGridlyActiveCountyCrossingInventory/);
});

test('no persisted semantic state retains the safe product startup camera', () => {
  const init = body('initMap', 'function gridlyGetConsumerCrossingFraId');
  assert.match(init, /if \(!startupCameraIssued\) map\.setView\(defaultCenter, 13\)/);
  assert.match(init, /gridlyPrimaryMapCameraInitialized = Boolean\(map\.getCenter/);
});
