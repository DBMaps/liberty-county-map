import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const layersTrigger = html.match(/<button type="button" data-v2-control="layers"[^>]*>/)?.[0] || "";
const layersTemplate = app.match(/layers: \{ title: "Map Layers", html: `([^`]+)` \}/)?.[1] || "";
const closeLifecycle = app.slice(app.indexOf("function closePortraitV2Sheet(){"), app.indexOf("const gridlyLiveServerRuntimeRecoveryState"));
const layersOwner = app.slice(app.indexOf("const openGridlyLayersSurface ="), app.indexOf("window.openGridlyLayersSurface = openGridlyLayersSurface;"));

test("visible Layers trigger owns an honest shared-dialog relationship", () => {
  assert.ok(layersTrigger, "the single visible V2 Layers trigger exists");
  assert.match(layersTrigger, /aria-haspopup="dialog"/);
  assert.match(layersTrigger, /aria-controls="gridlyPortraitV2Sheet"/);
  assert.match(layersTrigger, /aria-expanded="false"/);
  assert.equal((html.match(/data-v2-control="layers"/g) || []).length, 1);
  assert.match(app, /trigger\?\.setAttribute\("aria-expanded", String\(layersOpen\)\)/);
  assert.match(app, /sheetName === "layers"[\s\S]*sheet\.dataset\.activeSheet === "layers"/);
  assert.match(closeLifecycle, /syncGridlyLayersAccessibilityState\(""\)/);
});

test("Layers reuses the one named modal sheet and has deterministic focus", () => {
  assert.equal((html.match(/id="gridlyPortraitV2Sheet"/g) || []).length, 1);
  assert.match(html, /id="gridlyPortraitV2Sheet"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="gridlyPortraitV2SheetTitle"/);
  assert.match(html, /<h3 id="gridlyPortraitV2SheetTitle"[^>]*>Panel<\/h3>/);
  assert.match(app, /layers: \{ title: "Map Layers"/);
  assert.match(app, /title\.textContent = template\.title/);
  assert.match(app, /sheet\.setAttribute\("data-active-sheet", sheetName\)/);
  assert.match(app, /sheetName === "layers"\) document\.getElementById\("gridlyPortraitV2SheetClose"\)\?\.focus/);
  assert.match(html, /id="gridlyPortraitV2SheetClose"[^>]*aria-label="Close panel"/);
  assert.doesNotMatch(app, /mobileDockLayersBtn[\s\S]{0,160}\.click\(\)/);
  assert.match(layersOwner, /openPortraitV2Sheet\("layers"\)/);
});

test("close and Escape share lifecycle and restore the exact Layers opener", () => {
  assert.match(app, /closeBtn\.addEventListener\("click",closePortraitV2Sheet\)/);
  assert.match(app, /\["alerts", "layers"\]\.includes\(sheet\?\.dataset\?\.activeSheet\)/);
  assert.match(app, /event\.preventDefault\(\);\s*closePortraitV2Sheet\(\)/);
  assert.match(closeLifecycle, /sheet\.hidden = true/);
  assert.match(closeLifecycle, /sheet\.removeAttribute\("data-active-sheet"\)/);
  assert.match(closeLifecycle, /gridlyLayersLastActivationOpener\?\.isConnected/);
  assert.match(closeLifecycle, /gridlyLayersLastActivationOpener\.focus\(\)/);
  assert.doesNotMatch(closeLifecycle, /location\.reload|map\.setView|map\.setZoom|applyMapStyle|applyBaseLayerByName/);
});

test("Standard and Satellite form one synchronized, keyboard-native radio group", () => {
  assert.match(layersTemplate, /role="radiogroup" aria-label="Map style"/);
  assert.equal((layersTemplate.match(/role="radio"/g) || []).length, 2);
  assert.equal((layersTemplate.match(/aria-checked="false"/g) || []).length, 2);
  assert.match(layersTemplate, /gridly-v2-report-action[^>]*data-layer-name="Standard"[^>]*type="button" role="radio"/);
  assert.match(layersTemplate, /gridly-v2-report-action[^>]*data-layer-name="Satellite"[^>]*type="button" role="radio"/);
  assert.doesNotMatch(layersTemplate, /aria-selected|aria-pressed/);
  assert.match(app, /normalizeGridlyMapStyleName\(activeBaseLayerName \|\| currentMapStyle\)/);
  assert.match(app, /button\.setAttribute\("aria-checked", String\(selected\)\)/);
  assert.match(app, /button\.classList\.toggle\("is-selected", selected\)/);
  assert.match(app, /"layers-select": \(\) => \{[\s\S]*applyMapStyle\(requestedLayer\);[\s\S]*syncGridlyLayersAccessibilityState\("layers"\)/);
  assert.match(app, /syncGridlyLayersAccessibilityState\(sheetName\)/);
});

test("canonical two-style persistence and all existing style surfaces remain intact", () => {
  assert.match(app, /const MAP_STYLE_STORAGE_KEY = "gridlyMapStyleV1"/);
  assert.match(app, /localStorage\.setItem\(MAP_STYLE_STORAGE_KEY, selectedName\)/);
  assert.match(app, /if \(localStorage\.getItem\(MAP_STYLE_STORAGE_KEY\) === "Dark"\) localStorage\.setItem/);
  assert.match(app, /const baseLayers = \{\s*Standard: standardLayer,\s*Satellite: satelliteLayer\s*\}/);
  assert.equal((layersTemplate.match(/data-layer-name=/g) || []).length, 2);
  assert.doesNotMatch(layersTemplate, /Dark|CARTO|OpenFreeMap|MapLibre/i);
  assert.match(app, /const applyBaseLayerByName = \(layerName, source\) =>/);
  assert.match(app, /window\.applyMapStyle = function applyMapStyle/);
  assert.match(app, /gridly-mobile-layer-menu-list[\s\S]*Standard[\s\S]*Satellite/);
  assert.match(layersOwner, /\["Standard", "Satellite"\]/);
});

test("provider, roadway wording, shared surfaces, responsive, and startup contracts are protected", () => {
  assert.match(app, /arcgis\/imagery\/labels\/static\/tile\/\{z\}\/\{y\}\/\{x\}/);
  assert.match(app, /tileSize: 512,[\s\S]*zoomOffset: -1/);
  assert.match(app, /`\$\{active\} roadway issue\$\{active === 1 \? "" : "s"\} nearby`/);
  for (const owner of ["report", "alerts", "history", "settings"]) assert.match(app, new RegExp(`${owner}: \\{ title:`));
  assert.match(app, /suppressLegacySettingsSurfaceForPortraitV2Settings/);
  assert.match(app, /gridlyAlertsLastActivationOpener\.focus\(\)/);
  assert.match(app, /gridlySettingsLastActivationOpener\.focus\(\)/);
  assert.match(app, /acceptedShortLandscapeApplicationOwner/);
  assert.match(app, /startupReadiness/);
  assert.match(css, /LP243\.H/);
  assert.match(html, /js\/app\.js\?v=243i23-compact-map-attribution/);
});
