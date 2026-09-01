import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const config = readFileSync(new URL("../js/gridlyRuntimeEnvironmentConfig.js", import.meta.url), "utf8");
const release = readFileSync(new URL("../LP243.I2.1S2-ESRI-IMAGERY-LABELS-ACTIVATION.md", import.meta.url), "utf8");
const initMap = app.slice(app.indexOf("function initMap()"), app.indexOf("function installLayerPickerDebugDiagnostics()"));
const authority = app.slice(app.indexOf("function installLayerPickerDebugDiagnostics()"), app.indexOf("function ensureMapStylePersistence"));

test("Standard, World Imagery, and the two-choice Satellite identity are preserved", () => {
  assert.match(initMap, /https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(initMap, /https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/);
  assert.match(initMap, /const baseLayers = \{\s*Standard: standardLayer,\s*Satellite: satelliteLayer\s*\}/);
  assert.doesNotMatch(app + html, /cartocdn|carto\.com|light_only_labels|MapLibre|OpenFreeMap/i);
  assert.doesNotMatch(initMap, /\bDark\s*:/);
});

test("the governed public-client key is blank and credentials are absent from tracked app entry points", () => {
  assert.match(config, /arcgisStaticBasemapApiKey:\s*""/);
  assert.doesNotMatch(app, /arcgisStaticBasemapApiKey\s*=\s*["'][^"']{12,}["']/);
  assert.doesNotMatch(html, /arcgisStaticBasemapApiKey|static-map-tiles-api|token=/);
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: new URL("..", import.meta.url), encoding: "utf8" }).split("\0").filter(Boolean);
  for (const path of tracked) {
    const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    assert.doesNotMatch(text, /arcgisStaticBasemapApiKey\s*[:=]\s*["'][^"']{12,}["']/, path);
  }
  assert.equal(execFileSync("git", ["check-ignore", "js/gridly.local.js"], { cwd: new URL("..", import.meta.url), encoding: "utf8" }).trim(), "js/gridly.local.js");
});

test("ArcGIS static labels use authorized endpoint, row ordering, and 512px scale alignment", () => {
  assert.match(initMap, /static-map-tiles-api\.arcgis\.com\/arcgis\/rest\/services\/static-basemap-tiles-service\/v1\/arcgis\/imagery\/labels\/static\/tile\/\{z\}\/\{y\}\/\{x\}\?token=\{arcgisStaticBasemapApiKey\}/);
  assert.match(initMap, /tileSize:\s*512[\s\S]*?zoomOffset:\s*-1/);
  assert.match(release, /premium:user:staticbasemaptiles/);
  assert.match(release, /level \/ row \/ column/);
  assert.match(release, /PNG, 512 x 512/);
});

test("labels are conditional, non-interactive, above imagery, and fail closed", () => {
  assert.match(initMap, /if \(arcgisStaticBasemapApiKey\) \{[\s\S]*?const satelliteLabelsLayer = L\.tileLayer/);
  assert.match(initMap, /createPane\("arcgisImageryLabelsPane"\)[\s\S]*?zIndex = 250[\s\S]*?pointerEvents = "none"/);
  assert.match(initMap, /const satelliteLayer = L\.layerGroup\(\[satelliteImageryLayer\]\)/);
  assert.match(initMap, /satelliteLabelsLayer\.once\("tileerror"[\s\S]*?satelliteLayer\.removeLayer\(satelliteLabelsLayer\)/);
});

test("switch lifecycle, persistence, Dark migration, and direct V2 authority remain intact", () => {
  assert.match(authority, /Object\.entries\(mapBaseLayersByName\)[\s\S]*?map\.removeLayer\(layer\)[\s\S]*?map\.addLayer\(mapBaseLayersByName\[normalizedName\]\)/);
  assert.match(app, /const MAP_STYLE_STORAGE_KEY = "gridlyMapStyleV1"/);
  assert.match(app, /=== "Dark" \? "Standard"/);
  assert.match(authority, /window\.applyMapStyle = function applyMapStyle\(name\)/);
  assert.match(app, /"layers-select": \(\) => \{[\s\S]*?applyMapStyle\(requestedLayer\)/);
  assert.match(html, /js\/app\.js\?v=243i22-layers-accessibility-lifecycle/);
  assert.match(html, /gridlyRuntimeEnvironmentConfig\.js\?v=243i21s2-arcgis-static-basemap-contract/);
});
