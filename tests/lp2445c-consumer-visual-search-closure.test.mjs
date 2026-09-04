import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const start = css.indexOf("/* LP244.5 Task B — physical Android landscape refinement.");
const landscape = css.slice(start, css.indexOf("/* End LP244.5 Task B landscape refinement. */", start));

test("short landscape map removes only its redundant frame while preserving map contracts", () => {
  assert.match(landscape, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(landscape, /app-shell\.premium-layout[\s\S]*padding-inline: 0 !important/);
  assert.match(landscape, /#mapSection\.command-center,[\s\S]*\.map-card,[\s\S]*\.map-frame,[\s\S]*#map[\s\S]*width: 100vw !important[\s\S]*border-radius: 0 !important/);
  assert.match(landscape, /leaflet-control-zoom,[\s\S]*leaflet-control-layers[\s\S]*display: none !important/);
  assert.match(css, /#map \.leaflet-control-attribution/);
  assert.match(app, /gridlyLandscapeCommandToggle/);
  assert.match(app, /Location Context/);
});

test("walkthrough composition no longer participates in short landscape", () => {
  assert.doesNotMatch(landscape, /\.gridly-v950-(?:feature|setup|welcome)-page/);
  assert.match(css, /data-gridly-walkthrough-orientation-gated="true"[\s\S]*\.gridly-v950-onboarding-pager[\s\S]*display: none !important/);
  assert.match(app, /onboardingPager\.inert = shouldGate/);
  assert.doesNotMatch(landscape, /orientation:\s*portrait/);
});

test("Home Area query and results share one accessible autocomplete surface", () => {
  assert.match(app, /class="settings-manual-autocomplete"/);
  assert.match(app, /data-gridly-manual-awareness-search/);
  assert.match(app, /class="settings-manual-results"/);
  assert.match(app, /settings-manual-results-label gridly-visually-hidden">Search results/);
  assert.match(css, /settings-manual-autocomplete > label:has\(\+ \.settings-manual-results\)[\s\S]*border-radius: 16px 16px 0 0/);
  assert.match(css, /settings-manual-autocomplete > \.settings-manual-results[\s\S]*margin-top: -1px[\s\S]*border-radius: 0 0 16px 16px/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /data-gridly-manual-awareness-county-id/);
  assert.match(app, /data-gridly-manual-awareness-apply/);
});

test("published destination outcomes take space before reflow and still recover on clear", () => {
  assert.match(app, /resultsContainer\.dataset\.searchPublication = options\?\.state === "searching" \? "searching" : "active"/);
  assert.match(app, /delete resultsContainer\.dataset\.searchPublication/);
  assert.match(landscape, /:has\(\.gridly-search-results\[data-search-publication="active"\]\)[\s\S]*max-height: calc\(var\(--gridly-visual-vh/);
  assert.match(landscape, /data-search-publication="active"[\s\S]*\.gridly-search-results[\s\S]*overflow-y: auto/);
  assert.match(app, /Best matches/);
  assert.match(app, /No matching destination found/);
  assert.match(landscape, /#gridlySearchShell:not\(\[hidden\]\):focus-within/);
});

test("asset identity invalidates the pre-gate browser shell", () => {
  assert.match(html, /css\/styles\.css\?v=2445-portrait-walkthrough-gate/);
  assert.match(html, /js\/app\.js\?v=2445-portrait-walkthrough-gate/);
  assert.match(sw, /GRIDLY_SW_VERSION = "lp244\.5d-bare-place-interactive-repair"/);
  assert.match(sw, /GRIDLY_CLOSURE_CACHE_NAME = "gridly-pwa-shell-lp2445d-v1"/);
  assert.match(sw, /cache: "no-store"/);
  assert.match(sw, /caches\.delete\(cacheName\)/);
});
