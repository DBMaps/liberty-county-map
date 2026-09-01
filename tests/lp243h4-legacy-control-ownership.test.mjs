import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP243.H4 — current consumer-presentation ownership.";
const h4 = css.slice(css.indexOf(marker), css.indexOf("/* LP243.H6"));
const reconciliation = app.slice(
  app.indexOf("const GRIDLY_V2_PRESENTATION_OWNER_CLASS"),
  app.indexOf("\nfunction activateGridlyPortraitV2StartupOwner")
);

test("V2 dock remains the accepted current consumer authority", () => {
  assert.match(html, /id="gridlyPortraitV2"[\s\S]*?class="gridly-v2-bottom-dock"[\s\S]*?>Report<[\s\S]*?>Alerts<[\s\S]*?>History<[\s\S]*?>Settings</);
  assert.doesNotMatch(h4, /gridly-v2-bottom-dock/);
});

test("retired legacy navigation and duplicate Report/Alerts are suppressed and inert", () => {
  assert.match(html, /class="mobile-bottom-nav"[\s\S]*?>Today<[\s\S]*?>Map<[\s\S]*?>Report<[\s\S]*?>Alerts<[\s\S]*?>Routes</);
  assert.match(h4, /:is\(\.mobile-bottom-nav, #gridlyHazardLauncher\)[\s\S]*?display: none !important[\s\S]*?pointer-events: none !important/);
  assert.match(reconciliation, /GRIDLY_V2_RETIRED_CONSUMER_SURFACE_SELECTOR = "\.mobile-bottom-nav, #gridlyHazardLauncher"/);
  assert.match(reconciliation, /toggleAttribute\("inert", ownsPresentation\)/);
});

test("hazard launcher is classified as a retired duplicate without removing reporting", () => {
  assert.match(app, /launcher\.id = "gridlyHazardLauncher"[\s\S]*?launcher\.addEventListener\("click", openHazardPanel\)/);
  assert.match(html, /data-v2-sheet="report"/);
  assert.doesNotMatch(reconciliation, /remove\(|removeChild|createSharedHazardReport|submit/);
});

test("mobile native surface stays shared infrastructure and closed geometry is certified absent", () => {
  assert.match(reconciliation, /remains shared fallback infrastructure for Area\/Layers\/Alerts/);
  assert.match(reconciliation, /!nativeSurface\.classList\.contains\("is-open"\)/);
  assert.match(h4, /#mobileNativeSurfaceLayer:is\(\[hidden\], \[aria-hidden="true"\]\):not\(\.is-open\)/);
  assert.match(app, /openPortraitV2Sheet\("layers"\)/);
  assert.match(app, /function renderMobileNativeAlertsCenter\(\)/);
});

test("presentation suppression is orientation-independent while strict cleanup stays protected", () => {
  assert.match(reconciliation, /body\?\.dataset\?\.layoutMode === "portrait"/);
  assert.doesNotMatch(h4, /@media/);
  assert.match(app, /const isStrictPortraitMobile = Boolean\(layoutMode === "portrait" && mobileWidth && portraitMedia\)/);
  assert.match(app, /if \(layoutMode !== "portrait"\)/);
});

test("H1 ownership, H2 containment, H3 Location Context, and portrait geometry remain intact", () => {
  assert.match(app, /let activeLayoutMode = "portrait"/);
  assert.match(css, /--lp243h2-shell-width: min\(760px, calc\(100vw - 24px\)\)/);
  assert.match(css, /--lp243h3-location-bottom-inset: calc\(/);
  assert.doesNotMatch(h4, /mobile-destination-command|#map|app-shell|main-column|gridly-v2-topbar|gridly-v2-bottom-dock/);
  assert.match(html, /css\/styles\.css\?v=243h10h-measured-landscape-closure/);
  assert.match(html, /js\/app\.js\?v=243h10h-measured-landscape-closure/);
});

test("no data, route, search, alert, report, map, or Supabase authority is changed", () => {
  assert.doesNotMatch(`${reconciliation}\n${h4}`, /localStorage|Supabase|createShared|routeNavSection|applyGeoFilter|search|setView|fetch\(|renderAlerts/);
});
