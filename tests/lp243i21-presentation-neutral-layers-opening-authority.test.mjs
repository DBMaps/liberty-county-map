import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const bindV2Start = app.indexOf("function bindV2(){");
const bindV2 = app.slice(bindV2Start, bindV2Start + 5_000);
const v2LayersBindingStart = bindV2.indexOf("#gridlyPortraitV2 [data-v2-control='layers']");
const v2LayersBinding = bindV2.slice(v2LayersBindingStart, v2LayersBindingStart + 300);
const sharedAction = app.slice(
  app.indexOf("const openGridlyLayersSurface ="),
  app.indexOf("window.openGridlyLayersSurface = openGridlyLayersSurface;")
);
const tacticalBinding = app.slice(
  app.indexOf('document.getElementById("mobileDockLayersBtn")?.addEventListener'),
  app.indexOf("const bindDestinationCommandButton")
);

test("V2 Layers remains one native owner and the existing sheet remains singular", () => {
  assert.equal((html.match(/data-v2-control="layers"/g) || []).length, 1);
  assert.match(html, /<button type="button" data-v2-control="layers"/);
  assert.equal((html.match(/id="gridlyPortraitV2Sheet"/g) || []).length, 1);
  assert.equal((html.match(/id="mobileDockLayersBtn"/g) || []).length, 1);
});

test("V2 Layers calls the presentation-neutral action without querying or activating the relay", () => {
  assert.match(v2LayersBinding, /#gridlyPortraitV2 \[data-v2-control='layers'\][\s\S]*?openGridlyLayersSurface\?\.\(\{ presentation: "v2", source: "v2-control" \}\)/);
  assert.doesNotMatch(v2LayersBinding, /mobileDockLayersBtn/);
  assert.doesNotMatch(v2LayersBinding, /querySelector\("#mobileDockLayersBtn"\)|\.click\(\)/);
});

test("shared action selects only the existing V2 or tactical presentation", () => {
  assert.match(app, /const openGridlyLayersSurface = \(\{ presentation = "v2", source = "unknown" \} = \{\}\) =>/);
  assert.match(sharedAction, /openPortraitV2Sheet\("layers"\)/);
  assert.match(sharedAction, /presentation !== "tactical"/);
  assert.match(sharedAction, /openTacticalDockSheet\("layers", "Map Layers"/);
  assert.doesNotMatch(sharedAction, /createElement|appendChild|insertAdjacentHTML|map\.addLayer|map\.removeLayer|L\.tileLayer/);
});

test("mounted tactical owner uses the same action and retains its picker behavior", () => {
  assert.match(tacticalBinding, /openGridlyLayersSurface\(\{/);
  assert.match(tacticalBinding, /isTacticalLandscapeDockMode\(\) \? "tactical" : "v2"/);
  assert.match(sharedAction, /\["Standard", "Satellite"\]/);
  assert.match(sharedAction, /applyMapStyle\(btn\.dataset\.layerName \|\| "Satellite"\)/);
  assert.match(sharedAction, /closeTacticalDockSheet\(\)/);
});

test("existing V2 selection router and basemap authority remain in place", () => {
  assert.match(app, /"layers-select": \(\) => \{[\s\S]*?applyMapStyle\(requestedLayer\)/);
  assert.match(app, /function applyMapStyle\(/);
  assert.match(app, /const applyBaseLayerByName = \(/);
  assert.match(app, /mapBaseLayersByName/);
  assert.match(app, /activeBaseLayerName/);
  assert.match(app, /currentMapStyle/);
  assert.match(app, /gridlyMapStyleV1/);
  assert.match(app, /baselayerchange/);
  assert.match(app, /data-v2-action="layers-select" data-layer-name="Standard"[\s\S]*?data-layer-name="Satellite"/);
});

test("I2.1 changes no styles, geometry, or unrelated presentation contracts", () => {
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /js\/app\.js\?v=243i21s1-imagery-only-satellite/);
  assert.doesNotMatch(sharedAction + bindV2 + tacticalBinding, /featureLayer|KBYG|fetch\(|localStorage|sessionStorage/);
  assert.match(css, /LP243\.H/);
  assert.match(app, /acceptedShortLandscapeApplicationOwner/);
  assert.match(app, /GRIDLY_V2_PRESENTATION_OWNER_CLASS/);
  assert.match(app, /startupReadiness/);
});
