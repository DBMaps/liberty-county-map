import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const initMap = app.slice(app.indexOf("function initMap()"), app.indexOf("function installLayerPickerDebugDiagnostics()"));
const layerAuthority = app.slice(app.indexOf("function installLayerPickerDebugDiagnostics()"), app.indexOf("function syncMapStyleAfterStateChange"));
const layersSurfaces = app.slice(app.indexOf("const openGridlyLayersSurface ="), app.indexOf("window.openGridlyLayersSurface = openGridlyLayersSurface;"));
const v2Templates = app.slice(app.indexOf("const sheetTemplates ="), app.indexOf("const v2DockAdapterState"));
const settingsRuntime = app.slice(app.indexOf("const GRIDLY_SETTINGS_DEFAULTS"), app.indexOf("function gridlyIsZipOnlyValue"));
const legacyMapStyleSelect = html.slice(html.indexOf('id="settingsMapStyleSelect"'), html.indexOf("</select>", html.indexOf('id="settingsMapStyleSelect"')));

test("production registry contains only the unchanged Standard and Satellite providers", () => {
  assert.doesNotMatch(app, /dark_all|const darkLayer|Dark: darkLayer/);
  assert.match(initMap, /https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png[\s\S]*?subdomains: "abc",[\s\S]*?maxZoom: 20,[\s\S]*?attribution: GRIDLY_MAP_ATTRIBUTION.Standard/);
  assert.match(initMap, /https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}[\s\S]*?maxZoom: 20,[\s\S]*?attribution: GRIDLY_MAP_ATTRIBUTION.Satellite.compact/);
  assert.match(initMap, /const baseLayers = \{\s*Standard: standardLayer,\s*Satellite: satelliteLayer\s*\}/);
  assert.doesNotMatch(initMap, /\bDark\s*:/);
  assert.match(app, /let currentMapStyle = "Satellite"/);
});

test("every production picker and map-style Settings surface offers only Standard and Satellite", () => {
  assert.match(v2Templates, /data-layer-name="Standard"[\s\S]*data-layer-name="Satellite"/);
  assert.doesNotMatch(v2Templates, /data-layer-name="Dark"/);
  assert.match(layersSurfaces, /\["Standard", "Satellite"\]/);
  assert.doesNotMatch(layersSurfaces, /"Dark"/);
  assert.doesNotMatch(app, /data-portrait-layer-option="dark"|data-layer-name="Dark"/);
  assert.doesNotMatch(legacyMapStyleSelect, /value="dark"|>Dark/);
  assert.doesNotMatch(app, /data-v2-settings-field="display\.mapStyle"[^\n]*value="dark"/);
});

test("legacy Dark persistence migrates deterministically without coercing arbitrary invalid names", () => {
  assert.match(app, /normalizeGridlyMapStyleName = \(name\) =>[\s\S]*?=== "Dark" \? "Standard"/);
  assert.match(initMap, /normalizeGridlyMapStyleName\(localStorage\.getItem\(MAP_STYLE_STORAGE_KEY\)\)/);
  assert.match(initMap, /=== "Dark"\) localStorage\.setItem\(MAP_STYLE_STORAGE_KEY, savedStyle\)/);
  assert.match(layerAuthority, /const normalizedName = normalizeGridlyMapStyleName\(layerName\)/);
  assert.match(settingsRuntime, /toLowerCase\(\) === "dark" \? "standard"/);
  assert.match(settingsRuntime, /localStorage\.setItem\(GRIDLY_SETTINGS_STORAGE_KEY, JSON\.stringify\(settings\)\)/);
});

test("shared Leaflet authority and baselayerchange persistence remain intact", () => {
  assert.match(layerAuthority, /const applyBaseLayerByName =/);
  assert.match(layerAuthority, /window\.applyMapStyle = function applyMapStyle\(name\)[\s\S]*?applyBaseLayerByName\(name/);
  assert.match(initMap, /L\.control\.layers\(baseLayers/);
  assert.match(initMap, /map\.on\("baselayerchange"[\s\S]*?localStorage\.setItem\(MAP_STYLE_STORAGE_KEY, selectedName\)/);
  assert.match(app, /"layers-select": \(\) => \{[\s\S]*?applyMapStyle\(requestedLayer\)/);
  assert.doesNotMatch(v2Templates, /mobileDockLayersBtn|\.click\(\)/);
});

test("no replacement renderer/provider or presentation change is introduced", () => {
  assert.doesNotMatch(app + html, /MapLibre|maplibre|OpenFreeMap|openfreemap/);
  assert.match(html, /css\/styles\.css\?v=243i23r1-portrait-attribution-clearance/);
  assert.match(html, /js\/app\.js\?v=243i23-compact-map-attribution/);
  assert.match(app, /GRIDLY_V2_PRESENTATION_OWNER_CLASS/);
  assert.match(app, /startupReadiness/);
  assert.match(app, /acceptedShortLandscapeApplicationOwner/);
});
