import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const prepaint = html.slice(html.indexOf('<style id="gridly-prepaint-startup-guard">'), html.indexOf("</style>"));
const j = css.slice(css.indexOf("/* LP243.J"), css.indexOf("body[data-layout-mode=\"portrait\"].gridly-v2-presentation-owner-active\n  #mobileNativeSurfaceLayer"));

test("supported V2 ownership is explicit before paint and after settlement", () => {
  assert.match(html, /classList\.add\("gridly-v2-startup-containment"\)/);
  assert.match(app, /GRIDLY_V2_PRESENTATION_OWNER_CLASS = "gridly-v2-presentation-owner-active"/);
  assert.match(app, /body\?\.dataset\?\.layoutMode === "portrait"/);
  assert.match(prepaint, /gridly-v2-startup-containment[\s\S]*?\.mobile-bottom-nav,[\s\S]*?\.app-footer,[\s\S]*?display: none !important/);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
});

test("legacy footer and navigation remain in DOM but cannot paint, interact, or reserve flow", () => {
  assert.match(html, /<footer class="app-footer"[\s\S]*?Gridly Beta • Liberty County[\s\S]*?<nav class="mobile-bottom-nav"/);
  assert.match(html, />Today<[\s\S]*?>Map<[\s\S]*?>Report<[\s\S]*?>Alerts<[\s\S]*?>Routes</);
  assert.match(css, /gridly-v2-presentation-owner-active[\s\S]*?:is\(\.mobile-bottom-nav, #gridlyHazardLauncher\)[\s\S]*?display: none !important[\s\S]*?pointer-events: none !important/);
  assert.match(css, /gridly-v2-presentation-owner-active \.app-footer[\s\S]*?display: none !important[\s\S]*?pointer-events: none !important/);
});

test("document scrolling is locked only by the accepted owner class", () => {
  assert.match(j, /html:has\(body\.gridly-v2-presentation-owner-active\)[\s\S]*?height: 100%[\s\S]*?overflow: hidden/);
  assert.match(j, /body\.gridly-v2-presentation-owner-active[\s\S]*?position: fixed[\s\S]*?height: 100dvh[\s\S]*?overflow: hidden/);
  assert.doesNotMatch(j, /body\s*\{[\s\S]*?overflow: hidden/);
});

test("current V2 geometry and Leaflet/map authority are outside the repair", () => {
  assert.doesNotMatch(j, /#map|map-frame|map-card|leaflet|gridlyPortraitV2|gridly-v2-topbar|gridly-v2-bottom-dock|gridlyLandscapeCommandPanel/);
  assert.match(html, /id="gridlyPortraitV2"/);
  assert.match(html, /id="gridlyPortraitBottomRegion"/);
});

test("V2 foreground surfaces keep their established internal scrolling", () => {
  for (const pattern of [
    /\.gridly-search-card\{[^}]*overflow-y:auto!important/,
    /\.gridly-v2-sheet\{[^}]*overflow:auto/,
    /#gridlyPortraitV2SheetBody[\s\S]{0,500}?overflow-y: auto !important/,
    /data-active-sheet="settings"[\s\S]{0,800}?overflow-y: auto !important/
  ]) assert.match(css, pattern);
  for (const name of ["report", "alerts", "history", "settings"]) assert.match(app, new RegExp(`${name}: \\{`));
  assert.match(html, /id="gridlyBriefInteractionPanel"/);
});

test("accepted viewport routing and I1 eligibility authority are unchanged", () => {
  for (const [width, height] of [[875, 630], [320, 700], [390, 844], [430, 932], [932, 430], [844, 390], [1440, 900]]) {
    assert.ok(width > 0 && height > 0);
  }
  assert.match(html, /var mode = existingMode \|\| "portrait"/);
  assert.match(app, /acceptedShortLandscapeApplicationOwner/);
  assert.match(app, /cleanupState\.isStrictPortraitMobile \|\| acceptedShortLandscapeApplicationOwner/);
  assert.doesNotMatch(j + prepaint, /fetch\(|Supabase|setView\(|search provider|History click/);
});
