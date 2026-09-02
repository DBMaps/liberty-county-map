import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const app = read('js/app.js');
const poi = read('js/gridlyPoiBrowserProvider.js');
const stage = read('tools/native-web.mjs');
const edge = read('supabase/functions/gridly-geocode/index.ts');
const html = read('index.html');
const css = read('css/styles.css');

test('canonical PLACE search precedes POI and geocoder while retaining memberships', () => {
  const body = app.slice(app.indexOf('async function gridlySearchAddress'), app.indexOf('async function gridlyBuildRoutePreview'));
  assert.ok(body.indexOf('resolveGridlyAwarenessAreaQuery(rawQuery)') < body.indexOf('searchGridlyRuntimePoiCandidates'));
  assert.ok(body.indexOf('resolveGridlyAwarenessAreaQuery(rawQuery)') < body.indexOf('fetchGridlyNominatimSearch'));
  assert.match(body, /RESOLVED_CANONICAL_MULTI_COUNTY_PLACE/);
  assert.match(body, /countyMemberships/);
});

test('native POI alias preserves all certified gzip bytes behind servable extension', () => {
  assert.match(poi, /Capacitor\?\.isNativePlatform/);
  assert.match(poi, /native\/.*\.bin/);
  assert.match(stage, /nativeAliases\.length !== 86/);
  assert.match(stage, /nativeBytes\.equals\(sourceBytes\)/);
  for (const id of ['tx-29-095','tx-29-096','tx-30-095','tx-30-096']) assert.match(stage, new RegExp(id));
  assert.doesNotMatch(poi, /filler/i);
});

test('geocoder permits exact Capacitor origin without wildcarding CORS', () => {
  assert.match(edge, /https:\/\/localhost/);
  assert.match(edge, /if \(!origins\.has\(origin\)\)/);
  assert.doesNotMatch(edge, /Access-Control-Allow-Origin["']:\s*["']\*/);
  assert.match(edge, /https:\/\/gridly\.app/);
});

test('Appearance selects cannot open native surfaces and have accessible owned controls', () => {
  for (const id of ['settingsMapStyleSelect','settingsThemeSelect','settingsTextSizeSelect']) {
    assert.match(html, new RegExp(`id="${id}" class="gridly-governed-select-source"`));
    assert.match(html, new RegExp(`role="radiogroup"[^>]+data-gridly-select="${id}"`));
  }
  assert.match(app, /ArrowLeft.*ArrowRight.*ArrowUp.*ArrowDown/s);
  assert.match(css, /min-height:\s*44px/);
});

test('portrait density remains component bounded and Standard root is untouched', () => {
  assert.match(css, /max-width:\s*400px[\s\S]+orientation:\s*portrait/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('Physical Android closure')), /html\s*\{[^}]*font-size/);
  assert.match(css, /min-height:\s*44px/);
});

test('satellite labels remain active through individual errors with safe diagnostics', () => {
  assert.doesNotMatch(app, /tileerror[\s\S]{0,180}removeLayer\(satelliteLabelsLayer\)/);
  for (const field of ['labelConfigured','labelLayerCreated','labelTileAttempted','labelTileResult','labelFailureReason','labelHostPath','labelLayerAdded']) assert.match(app, new RegExp(field));
  assert.match(app, /activeReferenceLayers/);
  assert.doesNotMatch(app, /labelHostPath:[^\n]+token=/);
});

test('launcher roles use deterministic adaptive safe-zone geometry', () => {
  const assets = read('tools/native-assets.mjs');
  assert.match(assets, /ic_launcher_foreground\.xml/);
  assert.match(assets, /android:drawable="@drawable\/ic_launcher_mark" android:inset="18%"/);
  assert.match(assets, /obsoleteOutputs[\s\S]+ic_launcher_foreground\.png/);
  assert.match(assets, /ic_launcher_round\.png/);
  assert.match(read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), /@drawable\/ic_launcher_foreground/);
});

test('touch ownership adds no app preventDefault or global suppression', () => {
  const map = app.slice(app.indexOf('function initMap()'), app.indexOf('function gridlyGetConsumerCrossingFraId'));
  assert.doesNotMatch(map, /touch(?:start|move)[\s\S]{0,160}preventDefault/);
  assert.doesNotMatch(app, /Event\.prototype\.preventDefault|monkey.?patch/i);
  assert.match(map, /dragstart zoomstart/);
});
