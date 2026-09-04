import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP244.5 Task B — physical Android landscape refinement.";
const landscape = css.slice(css.indexOf(marker), css.indexOf("/* End LP244.5 Task B landscape refinement. */"));

test("map starts at the compact header boundary without legacy framing", () => {
  assert.match(landscape, /--lp243h10b-top-height:\s*100px/);
  assert.match(css, /#mapSection\.command-center[\s\S]*\.map-card[\s\S]*\.map-frame[\s\S]*#map[\s\S]*margin-block: 0 !important;[\s\S]*padding-block: 0 !important/);
  assert.match(landscape, /:is\(#mapSection\.command-center,[\s\S]*#map\)[\s\S]*width: 100vw !important/);
  assert.match(css, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*gridly-portrait-attribution-clearance/);
});

test("map navigation is contextual and never restores the permanent rail", () => {
  assert.match(landscape, /\.gridly-v2-control-rail,[\s\S]*leaflet-control-zoom,[\s\S]*leaflet-control-layers[\s\S]*display: none !important/);
  assert.match(landscape, /gridly-h8-command-expanded[\s\S]*\.gridly-v2-control-rail[\s\S]*display: grid !important[\s\S]*grid-template-columns: repeat\(4, 44px\)/);
  assert.match(landscape, /\.gridly-v2-control-rail[\s\S]*background: transparent !important[\s\S]*box-shadow: none !important/);
  assert.match(landscape, /right: max\(16px, env\(safe-area-inset-right, 0px\)\) !important/);
  assert.match(landscape, /bottom: calc\(var\(--lp243h10h-command-height\) \+ 32px \+ env\(safe-area-inset-bottom, 0px\)\) !important/);
  assert.match(landscape, /grid-template-rows: 44px !important/);
  for (const label of ["Layers", "Use my location", "Zoom in", "Zoom out"]) assert.match(html, new RegExp(`aria-label="${label}"`));
  const railMarkup = html.slice(html.indexOf('<div class="gridly-v2-control-rail"'), html.indexOf('<div id="gridlyPortraitBottomRegion"'));
  assert.equal((railMarkup.match(/<button /g) || []).length, 4);
  assert.ok(html.indexOf('<div class="gridly-v2-control-rail"') < html.indexOf('<div id="gridlyPortraitBottomRegion"'));
});

test("Location Context Search is bounded and its surface cannot bleed", () => {
  assert.match(landscape, /#mobileDestinationCommandPanel\s*\{[\s\S]*box-sizing: border-box !important;[\s\S]*max-width: 100% !important;[\s\S]*overflow: clip !important;[\s\S]*contain: paint/);
  assert.match(landscape, /#mobileDestinationCommandPanel::before\s*\{[\s\S]*content: none !important;[\s\S]*display: none !important/);
  assert.match(landscape, /#mobileDestinationCommandPanel \.compact-btn[\s\S]*width: 88px !important;[\s\S]*min-height: 44px !important;[\s\S]*font-size: 0\.78rem !important;[\s\S]*font-weight: 600 !important/);
});

test("explicit results have compact typography and precede retained Nearby Places", () => {
  assert.match(landscape, /\.gridly-search-label[\s\S]*font-size: clamp\(1\.05rem, 2\.5vw, 1\.22rem\)/);
  assert.match(landscape, /\.gridly-search-subtitle[\s\S]*display: none/);
  assert.match(landscape, /data-explicit-result-count[\s\S]*\.gridly-search-results[\s\S]*order: 1/);
  assert.match(landscape, /data-explicit-result-count[\s\S]*\.gridly-poi-nonproduction[\s\S]*order: 2/);
  assert.match(app, /delete resultsContainer\.dataset\.searchPublication/);
  assert.match(app, /resultsContainer\.dataset\.explicitResultCount = String\(list\.children\.length\)/);
  assert.match(app, /Best matches/);
});

test("the final correction remains landscape-only and does not touch governed publication", () => {
  assert.doesNotMatch(landscape, /orientation:\s*portrait/);
  assert.doesNotMatch(landscape, /resolveGridlyGovernedBareTexasPlaceQuery|gridly_canonical_place|placeGeoid/);
});
