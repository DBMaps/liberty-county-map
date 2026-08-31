import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

const applySource = app.slice(app.indexOf("function applyLayoutMode("), app.indexOf("\nconst GRIDLY_PORTRAIT_DUPLICATE_ROOTS"));
const resolverSource = app.slice(app.indexOf("function resolveLayoutMode("), app.indexOf("\nfunction evaluateLayoutMode()"));
const activationSource = app.slice(app.indexOf("function activateGridlyPortraitV2StartupOwner("), app.indexOf("\nconst GRIDLY_PORTRAIT_RETIRED_SURFACES"));

test("prepaint and runtime share portrait-derived application ownership", () => {
  assert.match(html, /var mode = existingMode \|\| "portrait"/);
  assert.match(app, /let activeLayoutMode = "portrait"/);
  assert.match(resolverSource, /nextMode: "portrait"/);
  assert.match(applySource, /activeLayoutMode = "portrait"/);
  assert.doesNotMatch(applySource, /activeLayoutMode = "desktop"/);
});

test("startup activation is not incorrectly gated to strict phone portrait", () => {
  assert.match(activationSource, /if \(layoutMode !== "portrait"\)/);
  assert.doesNotMatch(activationSource, /if \(!cleanupGate\.portraitCleanupGateActive\)/);
  assert.match(activationSource, /shell\.removeAttribute\("hidden"\)/);
});

test("startup, resize, visual viewport resize, and orientation use one synchronizer", () => {
  assert.match(app, /DOMContentLoaded[\s\S]*?syncAuthoritativeLayoutMode\(\)/);
  assert.match(app, /addEventListener\("resize", scheduleAuthoritativeLayoutModeSync/);
  assert.match(app, /visualViewport\?\.addEventListener\("resize", scheduleAuthoritativeLayoutModeSync/);
  assert.match(app, /addEventListener\("orientationchange", scheduleAuthoritativeLayoutModeSync/);
});

test("promo remains retained, hidden, inert, and outside current ownership", () => {
  assert.match(html, /id="gridlyDesktopGate"/);
  assert.match(css, /\.gridly-desktop-gate \{\s*display: none;/);
  assert.match(applySource, /developmentGate\?\.setAttribute\("inert", ""\)/);
  assert.match(applySource, /setAttribute\("aria-hidden", "true"\)/);
});

test("layout synchronization does not mutate Home Area, map, search, alerts, or sheet state", () => {
  assert.doesNotMatch(`${resolverSource}\n${applySource}`, /localStorage|selectedHome|activeGeoFilter|setView|flyTo|searchState|renderAlerts|data-active-sheet/);
  assert.match(app, /let activeLayoutMode = "portrait"/);
});

test("protected portrait CSS stays outside LP243.H containment and CSS identity is unchanged", () => {
  const scoped = css.slice(css.indexOf("/* LP243.H — additive non-portrait containment"), css.indexOf("/* GRIDLY V272.2"));
  assert.match(scoped, /@media \(orientation: landscape\), \(min-width: 761px\)/);
  assert.doesNotMatch(scoped, /320px|390px|430px|max-width:\s*760px\) and \(orientation:\s*portrait\)/);
  assert.match(html, /css\/styles\.css\?v=243h2-landscape-containment/);
  assert.match(html, /js\/app\.js\?v=243h1-runtime-ownership/);
});

test("representative landscape, tablet, wide, and portrait signals retain live owner", () => {
  const resolve = Function(`${resolverSource}; return resolveLayoutMode;`)();
  for (const [viewportWidth, viewportHeight] of [[932, 430], [768, 1024], [1440, 900], [390, 844], [844, 390], [390, 844]]) {
    const orientationLandscape = viewportWidth > viewportHeight;
    assert.equal(resolve({ viewportWidth, viewportHeight, coarsePointer: !orientationLandscape, finePointer: orientationLandscape, hoverNone: !orientationLandscape, orientationLandscape }).nextMode, "portrait");
  }
});
