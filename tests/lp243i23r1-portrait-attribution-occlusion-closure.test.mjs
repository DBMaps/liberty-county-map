import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const closure = css.slice(css.lastIndexOf("LP243.I2.3R1"));
const attribution = app.slice(app.indexOf("const GRIDLY_MAP_ATTRIBUTION"), app.indexOf("function initMap()"));
const initMap = app.slice(app.indexOf("function initMap()"), app.indexOf("function installLayerPickerDebugDiagnostics()"));

const protectedFiles = [
  "lp243i23-compact-map-attribution-closure.test.mjs",
  "lp243i22-layers-accessibility-lifecycle-closure.test.mjs",
  "lp243i21r1-location-context-roadway-wording.test.mjs",
  "lp243j-presentation-ownership-containment.test.mjs",
  "lp243j1-startup-readiness-handshake.test.mjs",
];

const protectedTests = await Promise.all(
  protectedFiles.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
);

test("portrait keeps Leaflet's visible attribution owner above the fixed dock", () => {
  assert.match(closure, /@media \(max-width: 760px\) and \(orientation: portrait\)/);
  assert.match(closure, /body\[data-layout-mode="portrait"\] #map \.leaflet-bottom\.leaflet-right/);
  assert.match(closure, /--gridly-portrait-attribution-clearance: calc\([\s\S]*var\(--gridly-portrait-dock-h, 78px\) \+ 24px \+ env\(safe-area-inset-bottom, 0px\)/);
  assert.match(closure, /bottom: var\(--gridly-portrait-attribution-clearance\) !important/);
  assert.doesNotMatch(closure, /display:\s*none|visibility:\s*hidden|opacity:\s*0(?:\D|$)/);
  assert.doesNotMatch(closure, /z-index/);
  assert.equal((initMap.match(/L\.control\.attribution/g) || []).length, 0);
});

test("attribution content and accessible Data disclosure remain unchanged", () => {
  assert.match(attribution, /Standard: "&copy; OpenStreetMap contributors"/);
  assert.match(attribution, /compact: '[^']*&copy; Esri \| <button[^']*>Data<\/button>'/);
  assert.match(attribution, /full: "Tiles © Esri, Sources:/);
  for (const provider of ["Esri", "TomTom", "Garmin", "FAO", "NOAA", "USGS", "OpenStreetMap contributors", "GIS User Community"]) {
    assert.ok(attribution.includes(provider));
  }
  assert.match(attribution, /aria-controls="gridlySatelliteAttributionDisclosure"/);
  assert.match(attribution, /event\.key === "Escape"/);
  assert.match(attribution, /trigger\.focus\(\)/);
});

test("closure is portrait-only and freezes protected geometry and integrations", () => {
  assert.doesNotMatch(closure, /orientation:\s*landscape|#map\s*\{[^}]*height|\.gridly-v2-bottom-(?:region|dock)\s*\{|location-awareness|Location Context|DriveTexas|weather|ArcGIS|tileLayer|setView|setZoom/);
  assert.match(initMap, /tile\.openstreetmap\.org/);
  assert.match(initMap, /World_Imagery\/MapServer\/tile/);
  assert.match(html, /css\/styles\.css\?v=243i23r2-visible-map-attribution-boundary/);
  assert.match(html, /js\/app\.js\?v=243i23r2-visible-map-attribution-boundary/);
});

test("LP243.I2.3, I2.2, I2.1R1, and J/J1 protections remain available", () => {
  protectedTests.forEach((source, index) => assert.match(source, /test\(/, `${protectedFiles[index]} remains a runnable protection`));
});
