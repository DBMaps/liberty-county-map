import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const initMap = app.slice(app.indexOf("function initMap()"), app.indexOf("function installLayerPickerDebugDiagnostics()"));
const attributionAdapter = app.slice(app.indexOf("const GRIDLY_MAP_ATTRIBUTION"), app.indexOf("function initMap()"));

const providerNames = ["Esri", "TomTom", "Garmin", "FAO", "NOAA", "USGS", "OpenStreetMap contributors", "GIS User Community"];

test("only the frozen Standard and Satellite basemaps remain registered", () => {
  const registry = initMap.match(/const baseLayers = \{([\s\S]*?)\n  \};/)?.[1] || "";
  assert.deepEqual([...registry.matchAll(/^\s*(\w+):/gm)].map((match) => match[1]), ["Standard", "Satellite"]);
  assert.doesNotMatch(registry, /Dark|CARTO/i);
  assert.match(initMap, /Standard: standardLayer,[\s\S]*Satellite: satelliteLayer/);
});

test("one structured authority owns compact and full provider attribution", () => {
  assert.match(attributionAdapter, /Standard: "&copy; OpenStreetMap contributors"/);
  assert.match(attributionAdapter, /compact: '[^']*&copy; Esri \| <button[^']*>Data<\/button>'/);
  assert.match(attributionAdapter, /full: "Tiles © Esri, Sources:/);
  providerNames.forEach((name) => assert.ok(attributionAdapter.includes(name), `${name} remains disclosed`));
  assert.doesNotMatch(attributionAdapter.match(/compact: '([^']+)'/)?.[1] || "", /TomTom|Garmin|FAO|NOAA|USGS|GIS User Community/);
  assert.equal((initMap.match(/L\.control\.attribution/g) || []).length, 0, "no second attribution owner is added");
  assert.equal((attributionAdapter.match(/>Data<\/button>/g) || []).length, 1);
});

test("the disclosure is accessible, closable, focus-restoring, and basemap synchronized", () => {
  assert.match(attributionAdapter, /type=\"button\"[^>]*aria-label=\"Show satellite map data attribution\"[^>]*aria-controls=\"gridlySatelliteAttributionDisclosure\"[^>]*aria-expanded=\"false\"/);
  assert.match(attributionAdapter, /setAttribute\("role", "region"\)/);
  assert.match(attributionAdapter, /setAttribute\("aria-label", "Satellite map data attribution"\)/);
  assert.match(attributionAdapter, /event\.key === "Escape"/);
  assert.match(attributionAdapter, /trigger\.focus\(\)/);
  assert.match(attributionAdapter, /event\?\.name !== "Satellite"\) closeDisclosure\(\{ restoreFocus: false \}\)/);
  assert.match(initMap, /mapInstance|installGridlyCompactMapAttribution\(map\)/);
  assert.match(initMap, /map\.on\("baselayerchange"/);
});

test("bounded CSS protects portrait and short-landscape without changing map geometry", () => {
  assert.match(css, /#map \.leaflet-control-attribution[\s\S]*white-space: nowrap/);
  assert.match(css, /#map \.gridly-map-attribution-disclosure[\s\S]*width: min\(360px, calc\(100% - 16px\)\)[\s\S]*max-height: min\(180px, calc\(100% - 48px\)\)[\s\S]*overflow: auto/);
  assert.doesNotMatch(css.slice(css.lastIndexOf("LP243.I2.3")), /body\s*\{|#map\s*\{[^}]*height/);
  assert.match(html, /styles\.css\?v=243i23r2-visible-map-attribution-boundary/);
  assert.match(html, /app\.js\?v=243i23r2-visible-map-attribution-boundary/);
});

test("provider endpoints and protected accessibility and roadway wording remain intact", () => {
  assert.match(initMap, /https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(initMap, /World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/);
  assert.match(initMap, /imagery\/labels\/static\/tile\/\{z\}\/\{y\}\/\{x\}\?token=\{arcgisStaticBasemapApiKey\}/);
  assert.match(app, /role="radiogroup" aria-label="Map style"/);
  assert.match(app, /role="radio" aria-checked="false"/);
  assert.match(app, /`\$\{active\} roadway issue\$\{active === 1 \? "" : "s"\} nearby`/);
});
