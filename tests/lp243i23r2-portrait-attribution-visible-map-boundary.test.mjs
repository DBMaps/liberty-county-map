import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const r2Css = css.slice(css.indexOf("/* LP243.I2.3R2"));
const boundaryStart = app.indexOf("const GRIDLY_PORTRAIT_ATTRIBUTION_CLEARANCE_PROPERTY");
const boundaryEnd = app.indexOf("function reconcileGridlyV2ConsumerPresentationOwnership", boundaryStart);
const boundary = app.slice(boundaryStart, boundaryEnd);
const attribution = app.slice(app.indexOf("const GRIDLY_MAP_ATTRIBUTION"), app.indexOf("function initMap()"));
const protectedTests = [
  "lp243i23-compact-map-attribution-closure.test.mjs",
  "lp243i23r1-portrait-attribution-occlusion-closure.test.mjs",
  "lp243i22-layers-accessibility-lifecycle-closure.test.mjs",
  "lp243i21r1-location-context-roadway-wording.test.mjs",
  "lp243j-presentation-ownership-containment.test.mjs",
  "lp243j1-startup-readiness-handshake.test.mjs",
  "lp243h-responsive-app-availability.test.mjs",
];

const protections = await Promise.all(protectedTests.map((file) => readFile(new URL(file, import.meta.url), "utf8")));

test("R2 supersedes R1's map-bottom-relative dock inset with measured visible-boundary clearance", () => {
  assert.match(css, /LP243\.I2\.3R1[\s\S]*LP243\.I2\.3R2/);
  assert.match(r2Css, /--gridly-portrait-map-attribution-bottom-clearance/);
  assert.match(boundary, /mapElement\.getBoundingClientRect\(\)/);
  assert.match(boundary, /foregroundPanel\.getBoundingClientRect\(\)/);
  assert.match(boundary, /mapRect\.bottom - foregroundRect\.top \+ breathingGap/);
  assert.doesNotMatch(r2Css + boundary, /703px|225px|230px/);
});

test("runtime authority is presentation-only, portrait-only, responsive, and ephemeral", () => {
  assert.match(boundary, /dataset\?\.layoutMode === "portrait"/);
  assert.match(boundary, /max-width: 760px[\s\S]*orientation: portrait/);
  assert.match(boundary, /removeProperty\(GRIDLY_PORTRAIT_ATTRIBUTION_CLEARANCE_PROPERTY\)/);
  assert.match(boundary, /ResizeObserver|visualViewport/);
  assert.match(boundary, /window\.addEventListener\("resize"/);
  assert.doesNotMatch(boundary, /localStorage|sessionStorage|fetch\(|setView\(|setZoom\(|\.style\.height|z-index/);
  assert.doesNotMatch(r2Css, /orientation:\s*landscape|z-index|#map\s*\{[^}]*height|mobileDestinationCommandPanel\s*\{|gridly-v2-bottom-region\s*\{/);
});

test("Leaflet ownership, legal copy, providers, and disclosure behavior remain unchanged", () => {
  assert.equal((app.slice(app.indexOf("function initMap()"), app.indexOf("function installLayerPickerDebugDiagnostics()")).match(/L\.control\.attribution/g) || []).length, 0);
  assert.match(attribution, /Standard: "&copy; OpenStreetMap contributors"/);
  assert.match(attribution, /compact: '[^']*&copy; Esri \| <button[^']*>Data<\/button>'/);
  assert.match(attribution, /full: "Tiles © Esri, Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community"/);
  assert.match(attribution, /event\.key === "Escape"/);
  assert.match(attribution, /trigger\.focus\(\)/);
  assert.match(r2Css, /gridly-map-attribution-disclosure/);
  assert.doesNotMatch(r2Css + boundary, /tileLayer|ArcGIS|DriveTexas|weather/);
});

test("protected LP243 milestones remain runnable and asset identities advance together", () => {
  protections.forEach((source, index) => assert.match(source, /test\(/, protectedTests[index]));
  assert.match(html, /css\/styles\.css\?v=243i23r2-visible-map-attribution-boundary/);
  assert.match(html, /js\/app\.js\?v=243i23r2-visible-map-attribution-boundary/);
});
