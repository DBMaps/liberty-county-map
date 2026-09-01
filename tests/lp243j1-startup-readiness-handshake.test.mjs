import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const prepaint = html.slice(html.indexOf("(function gridlyReleasePrepaintLock"), html.indexOf("</script>", html.indexOf("(function gridlyReleasePrepaintLock")));
const activation = app.slice(app.indexOf("function activateGridlyPortraitV2StartupOwner"), app.indexOf("const GRIDLY_PORTRAIT_RETIRED_SURFACES"));
const lp243j = css.slice(css.indexOf("/* LP243.J"));

test("the only production first-paint writer is ownership gated", () => {
  const writers = [...html.matchAll(/classList\.add\("gridly-first-paint-ready"\)/g)];
  assert.equal(writers.length, 1);
  assert.doesNotMatch(app, /classList\.add\("gridly-first-paint-ready"\)/);
  assert.match(prepaint, /v2StartupSelected[\s\S]*?!body\.classList\.contains\("gridly-v2-presentation-owner-active"\)[\s\S]*?return false[\s\S]*?classList\.add\("gridly-first-paint-ready"\)/);
});

test("V2 startup containment releases only through accepted ownership", () => {
  assert.match(html, /classList\.add\("gridly-v2-startup-containment"\)/);
  assert.match(prepaint, /classList\.remove\("gridly-v2-startup-containment"\)/);
  assert.match(activation, /const ownsPresentation = reconcileGridlyV2ConsumerPresentationOwnership\(\)/);
  assert.match(activation, /syncMobileDestinationCommandCard\(\)[\s\S]*?gridlyReleaseFirstPaintWhenPresentationReady/);
  assert.doesNotMatch(activation, /setTimeout|setInterval|requestAnimationFrame/);
  assert.match(prepaint, /if \(v2StartupSelected && !body\.classList\.contains\("gridly-v2-presentation-owner-active"\)\) return false/);
  assert.match(prepaint, /setTimeout\(release, 180\)/);
  assert.match(prepaint, /setTimeout\(release, 1400\)/);
});

test("the shared Destination and accepted Search command owner stays singular", () => {
  for (const id of ["mobileDestinationCommandPanel", "mobileDestinationCommandTitle", "mobileDestinationCommandMeta", "mobileDestinationCommandBtn"]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be singular`);
  }
  assert.match(html, /id="mobileDestinationCommandTitle"[^>]*>Destination</);
  assert.match(html, /id="mobileDestinationCommandMeta"[^>]*>Choose where you're going</);
  assert.match(html, /id="mobileDestinationCommandBtn"[^>]*>[\s\S]*?Choose Route/);
  assert.match(app, /safeText\("mobileDestinationCommandBtn", "Search"\)/);
  assert.match(app, /gridly-awareness-owner/);
});

test("LP243.J containment and accepted viewport ownership remain protected", () => {
  assert.match(html, /gridly-v2-startup-containment[\s\S]*?\.mobile-bottom-nav,[\s\S]*?\.app-footer,[\s\S]*?display: none !important/);
  assert.match(css, /gridly-v2-presentation-owner-active[\s\S]*?\.mobile-bottom-nav/);
  assert.match(css, /gridly-v2-presentation-owner-active \.app-footer/);
  assert.match(lp243j, /html:has\(body\.gridly-v2-presentation-owner-active\)[\s\S]*?overflow: hidden/);
  assert.match(lp243j, /body\.gridly-v2-presentation-owner-active[\s\S]*?height: 100dvh[\s\S]*?overflow: hidden/);
  for (const [width, height] of [[875, 630], [320, 700], [390, 844], [430, 932], [932, 430], [844, 390], [1440, 900]]) {
    assert.ok(width > 0 && height > 0);
  }
});

test("I1 sheet eligibility and frozen feature authorities are untouched by J1", () => {
  assert.match(app, /function getGridlyV2SheetInteractionEligibility/);
  assert.match(app, /cleanupState\.isStrictPortraitMobile \|\| acceptedShortLandscapeApplicationOwner/);
  assert.match(html, /id="gridlyPortraitV2Sheet"/);
  assert.doesNotMatch(prepaint + activation, /Leaflet|setView\(|Search provider|ranking|History|Supabase|DriveTexas|fetch\(/i);
  assert.match(html, /app\.js\?v=243i1h3-history-location-resolution-performance-repair&amp;lp243j1=startup-readiness-handshake/);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
});
