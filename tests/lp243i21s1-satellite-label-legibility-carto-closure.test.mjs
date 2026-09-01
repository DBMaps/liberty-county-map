import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const initMap = app.slice(app.indexOf("function initMap()"), app.indexOf("function installLayerPickerDebugDiagnostics()"));
const layerAuthority = app.slice(app.indexOf("function installLayerPickerDebugDiagnostics()"), app.indexOf("function ensureMapStylePersistence"));
const layersSurface = app.slice(app.indexOf("const openGridlyLayersSurface ="), app.indexOf("window.openGridlyLayersSurface = openGridlyLayersSurface;"));
const v2Templates = app.slice(app.indexOf("const sheetTemplates ="), app.indexOf("const v2DockAdapterState"));

const esriUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const standardUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

test("Satellite is the unchanged Esri World Imagery layer and Standard is unchanged", () => {
  assert.match(initMap, new RegExp(esriUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(initMap, /const satelliteImageryLayer = L\.tileLayer\([\s\S]*?maxZoom: 20,[\s\S]*?attribution: "Tiles &copy; Esri"/);
  assert.match(initMap, new RegExp(standardUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(initMap, /const standardLayer = L\.tileLayer[\s\S]*?subdomains: "abc",[\s\S]*?maxZoom: 20,[\s\S]*?attribution: "&copy; OpenStreetMap contributors"/);
  assert.match(initMap, /const baseLayers = \{\s*Standard: standardLayer,\s*Satellite: satelliteLayer\s*\}/);
});

test("the selectable basemap contract is exactly Standard and logical Satellite", () => {
  const registry = initMap.match(/const baseLayers = \{([\s\S]*?)\n  \};/)?.[1] || "";
  assert.deepEqual([...registry.matchAll(/^\s*(\w+):/gm)].map((match) => match[1]), ["Standard", "Satellite"]);
  assert.match(v2Templates, /data-layer-name="Standard"[\s\S]*data-layer-name="Satellite"/);
  assert.match(layersSurface, /\["Standard", "Satellite"\]/);
  assert.doesNotMatch(initMap + v2Templates + layersSurface, /\bDark\s*:|data-layer-name="Dark"/);
});

test("CARTO labels, tile requests, panes, lifecycle operations, and attribution remain absent", () => {
  assert.doesNotMatch(initMap, /light_only_labels|satLabelsPane|cartocdn|carto\.com|CARTO/);
  assert.doesNotMatch(layerAuthority, /light_only_labels|satLabelsPane|cartocdn|carto\.com|CARTO/);
  assert.doesNotMatch(app, /light_only_labels|cartocdn|carto\.com|CARTO/);
});

test("persistence, direct V2 authority, and shared Leaflet owner remain intact", () => {
  assert.match(app, /const MAP_STYLE_STORAGE_KEY = "gridlyMapStyleV1"/);
  assert.match(app, /normalizeGridlyMapStyleName = \(name\) =>[\s\S]*?=== "Dark" \? "Standard"/);
  assert.match(initMap, /=== "Dark"\) localStorage\.setItem\(MAP_STYLE_STORAGE_KEY, savedStyle\)/);
  assert.match(layerAuthority, /window\.applyMapStyle = function applyMapStyle\(name\)[\s\S]*?applyBaseLayerByName\(name/);
  assert.match(app, /"layers-select": \(\) => \{[\s\S]*?applyMapStyle\(requestedLayer\)/);
  assert.doesNotMatch(v2Templates, /mobileDockLayersBtn|\.click\(\)/);
  assert.match(initMap, /map = L\.map\("map"/);
});

test("Gridly overlays, controls, geometry, and protected surfaces remain governed", () => {
  for (const authority of ["gridlyCountyBoundaryOverlayLayer", "crossingLayer", "savedRouteLayer", "destinationRoutePreviewLayer", "corridorIntelLayer", "unifiedIncidentLayer", "gridlyDriveTexasOfficialLayer"]) {
    assert.match(initMap, new RegExp(`${authority} = L\\.layerGroup\\(\\)\\.addTo\\(map\\)`));
  }
  assert.match(initMap, /L\.control\.zoom\(\{ position: "bottomright" \}\)\.addTo\(map\)/);
  assert.match(initMap, /L\.control\.layers\(baseLayers, null, \{ position: "bottomright", collapsed: true \}\)\.addTo\(map\)/);
  assert.match(css, /@media[^\{]*max-width:\s*390px|@media[^\{]*max-width:\s*430px/);
  assert.match(app, /gridlyHistoryDockButton/);
  assert.match(app, /acceptedShortLandscapeApplicationOwner/);
  assert.match(app, /startupReadiness/);
});

test("closure retains CSS and geometry while the authorized Esri provider identity advances", () => {
  assert.doesNotMatch(initMap, /MapLibre|OpenFreeMap|mapbox|google/i);
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /js\/app\.js\?v=243i21r1-location-context-roadway-wording/);
});
