import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const app = read("js/app.js");
const css = read("css/styles.css");
const pkg = JSON.parse(read("package.json"));

test("configured owner staging deterministically manufactures approved launcher artwork", () => {
  assert.match(pkg.scripts["build:native-web:configured"], /^node tools\/native-assets\.mjs && node tools\/native-web\.mjs /);
  assert.match(read("tools/native-assets.mjs"), /icon: 'assets\/store\/icons\/gridly-icon-master-1024\.png'/);
});

test("portrait Location Context collapses only absent optional rows and preserves Search target", () => {
  const closure = css.slice(css.indexOf("/* Android physical-launch closure:"));
  assert.match(closure, /mobile-destination-command\.is-awareness-panel/);
  assert.match(closure, /min-height: 76px !important/);
  assert.match(closure, /\[hidden\][\s\S]*?display: none !important/);
  assert.match(closure, /\.compact-btn[\s\S]*?min-height: 44px !important/);
  assert.doesNotMatch(closure, /is-destination-panel|orientation: landscape|gridly-v2-bottom-dock/);
});

test("Satellite retains governed imagery and configured ArcGIS reference labels", () => {
  assert.match(app, /World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/);
  assert.match(app, /static-basemap-tiles-service\/v1\/arcgis\/imagery\/labels/);
  assert.match(app, /satelliteLayer = L\.layerGroup\(\[satelliteImageryLayer\]\)/);
  assert.match(app, /satelliteLayer\.addLayer\(satelliteLabelsLayer\)/);
  assert.match(app, /GRIDLY_MAP_ATTRIBUTION\.Satellite\.compact/);
});

test("bounded map diagnostic reports composition, cleanup, moves, and gesture ownership", () => {
  assert.match(app, /gridlyAndroidMapAcceptanceDiagnostic/);
  for (const field of ["activeBasemapStyle", "activeLogicalLayers", "activeTileLayers", "activeReferenceLayers", "duplicateLogicalLayers", "satelliteLabelStatus", "moveRenderInvocations", "customMapTouchHandlers", "leafletGestureOwner"]) {
    assert.match(app, new RegExp(field));
  }
  assert.match(app, /filter\(\(\[, layer\]\) => map\.hasLayer\(layer\)\)/);
});

test("custom layer touch activation never cancels a non-cancelable event", () => {
  const handler = app.slice(app.indexOf("const handleLayerToggleInteraction"), app.indexOf("optionButtons.forEach", app.indexOf("const handleLayerToggleInteraction")));
  assert.match(handler, /event\.cancelable !== false/);
  assert.equal((handler.match(/addEventListener\(eventName/g) || []).length, 1);
});
