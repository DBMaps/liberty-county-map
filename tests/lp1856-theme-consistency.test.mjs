import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const lp1855Protection = readFileSync(new URL("lp1855-route-watch-start-location-recenter.test.mjs", import.meta.url), "utf8");
const lp1854Protection = readFileSync(new URL("lp185/incident-location-identity.test.mjs", import.meta.url), "utf8");
const neutralContract = css.slice(css.indexOf("/* LP185.6 — neutral"), css.indexOf("/* LP185.6A"));

test("saved theme is resolved safely before paint without becoming settings authority", () => {
  const early = html.slice(html.indexOf('id="gridly-early-theme"'), html.indexOf('id="gridly-prepaint-startup-guard"'));
  assert.match(early, /localStorage\.getItem\("gridlySettingsV1"\)/);
  assert.match(early, /candidate === "light" \|\| candidate === "dark" \|\| candidate === "system"/);
  assert.match(early, /catch \(error\)/);
  assert.doesNotMatch(early, /setItem|Route Watch|initializeMap/);
  assert.ok(html.indexOf('id="gridly-early-theme"') < html.indexOf('id="gridly-prepaint-startup-guard"'));
});

test("neutral contract covers explicit light, dark and effective system light", () => {
  for (const token of ["app-bg", "elevated", "panel", "surface-strong", "surface-soft", "border-neutral", "text-primary", "text-secondary", "text-muted", "control-bg", "input-bg", "backdrop", "shadow", "disabled"])
    assert.match(css, new RegExp(`--gridly-${token}:`));
  assert.match(css, /body\.gridly-theme-light[\s\S]*?color-scheme: light/);
  assert.match(css, /prefers-color-scheme: light[\s\S]*?body\.gridly-theme-system[\s\S]*?color-scheme: light/);
  assert.match(css, /body\.gridly-theme-dark[\s\S]*?color-scheme: dark/);
});

test("late native-control and Leaflet rules consume neutral tokens", () => {
  const contract = neutralContract;
  assert.match(contract, /:is\(input, select, textarea, \.gridly-premium-select\)/);
  assert.match(contract, /body\.gridly-theme-light \.settings-select-grid select[\s\S]*?color-scheme: light !important/);
  assert.match(contract, /\.leaflet-popup-content-wrapper/);
  assert.match(contract, /\.leaflet-control-layers/);
  assert.match(contract, /\.leaflet-popup-tip/);
});

test("dynamic update and alert presentation follows CSS theme ownership", () => {
  assert.match(app, /notice\.className = "gridly-pwa-update-notice"/);
  assert.doesNotMatch(app.slice(app.indexOf("function gridlyEnsurePwaUpdateNotice"), app.indexOf("function gridlyShowPwaUpdateAvailable")), /notice\.style\.cssText/);
  assert.match(neutralContract, /\.gridly-alert-title/);
  assert.match(css, /--gridly-text-secondary/);
});

test("theme and map style remain separately normalized and system is not rewritten", () => {
  assert.match(app, /if \(GRIDLY_SETTINGS_MAP_STYLE_LABELS\[normalizedStyle\]\) base\.display\.mapStyle = normalizedStyle/);
  assert.match(app, /if \(GRIDLY_SETTINGS_VALID_THEMES\.has\(normalizedTheme\)\) base\.display\.theme = normalizedTheme/);
  assert.match(app, /normalized\.theme === "system"/);
  assert.doesNotMatch(html.slice(html.indexOf('id="gridly-early-theme"'), html.indexOf('id="gridly-prepaint-startup-guard"')), /mapStyle/);
});

test("semantic and provider contracts are not redefined by LP185.6", () => {
  const contract = css.slice(css.indexOf("/* LP185.6 — neutral"));
  assert.doesNotMatch(contract, /tileLayer|route-geometry|crossing-marker|hazard-marker|incident-severity/);
  for (const provider of ["OpenStreetMap", "CARTO", "Esri"]) assert.match(app, new RegExp(provider, "i"));
});

test("LP185.6A closes the cascade on the mounted portrait V2 owners", () => {
  const closure = css.slice(css.lastIndexOf("/* LP185.6A"));
  const activeOwners = [
    ".gridly-v2-topbar",
    ".gridly-v2-awareness-brief-card",
    ".gridly-brief-interaction-panel",
    ".gridly-v2-segments",
    ".gridly-v2-control-rail .gridly-v2-map-control",
    ".gridly-v2-location-awareness-panel",
    ".gridly-v2-bottom-dock",
    ".gridly-travel-brief-list",
    "#gridlyPortraitV2Sheet",
    '[data-active-sheet="report"]',
    ".gridly-v2-report-action",
    '[data-active-sheet="settings"]',
    ".settings-list-summary"
  ];
  for (const selector of activeOwners) assert.ok(closure.includes(selector), `missing active portrait owner ${selector}`);
  assert.match(closure, /background: var\(--gridly-(?:panel|elevated|control-bg)\) !important/);
  assert.match(closure, /color: var\(--gridly-text-primary\) !important/);
  assert.match(closure, /border-color: var\(--gridly-border-neutral\) !important/);
  assert.ok(css.indexOf("/* LP185.6A") > css.indexOf("/* LP185.6"), "closure must follow the base token contract");
});

test("active portrait closure serves explicit and effective system light without styling tiles", () => {
  const closure = css.slice(css.lastIndexOf("/* LP185.6A"));
  assert.match(closure, /:is\(\.gridly-theme-light, \.gridly-theme-dark, \.gridly-theme-system\)/);
  assert.match(css, /@media \(prefers-color-scheme: light\)[\s\S]*body\.gridly-theme-system[\s\S]*--gridly-panel: #eef5fa/);
  assert.doesNotMatch(closure, /leaflet-tile|tile-layer|map-style|setUrl|mapStyle/);
});

test("LP185.6B closes the remaining real-iPhone runtime owners", () => {
  const closure = css.slice(css.indexOf("/* LP185.6B"));
  for (const owner of [
    ".gridly-v2-location-awareness-panel",
    ".gridly-brief-foundation-handle",
    ".gridly-v2-control-rail",
    ".gridly-v2-bottom-dock button",
    '[data-active-sheet="alerts"]',
    ".gridly-alert-empty-state",
    '[data-active-sheet="settings"]',
    ".settings-list-summary::after",
    ".gridly-travel-brief-item",
    '[data-active-sheet="report"]',
    ".gridly-v2-report-action:is(.is-selected",
    ".gridly-historical-intelligence-row"
  ]) assert.ok(closure.includes(owner), `missing LP185.6B owner ${owner}`);
});

test("LP185.6B hierarchy is token governed and preserves semantic/product boundaries", () => {
  const closure = css.slice(css.indexOf("/* LP185.6B"));
  for (const token of ["nested", "accent", "accent-soft", "accent-foreground"])
    assert.match(css, new RegExp(`--gridly-${token}:`));
  assert.match(closure, /background: var\(--gridly-elevated\) !important/);
  assert.match(closure, /background: var\(--gridly-nested\) !important/);
  assert.match(closure, /border-color: var\(--gridly-border-neutral\) !important/);
  assert.match(closure, /color: var\(--gridly-text-secondary\) !important/);
  assert.match(closure, /background: var\(--gridly-accent-soft\) !important/);
  assert.doesNotMatch(closure, /route-geometry|destination-routing|hazard-lifecycle|tile-provider|map-style/);
});

test("LP185.6B dark-mode protection comes from parallel hierarchy token definitions", () => {
  const contractStart = css.indexOf("/* LP185.6 — neutral");
  const darkStart = css.indexOf("body.gridly-theme-dark", contractStart);
  const lightStart = css.indexOf("body.gridly-theme-light", darkStart);
  const systemLightStart = css.indexOf("@media (prefers-color-scheme: light)", lightStart);
  const dark = css.slice(darkStart, lightStart);
  const light = css.slice(lightStart, systemLightStart);
  for (const token of ["nested", "accent", "accent-soft", "accent-foreground"]) {
    assert.match(dark, new RegExp(`--gridly-${token}:`));
    assert.match(light, new RegExp(`--gridly-${token}:`));
  }
});

const finalClosure = css.slice(css.indexOf("/* LP185.6C"));

test("LP185.6C targets the active Location Context owner for explicit and effective system Light", () => {
  assert.match(finalClosure, /html\[data-gridly-effective-theme="light"\] body\.gridly-theme-system/);
  for (const owner of [
    ".gridly-v2-location-awareness-panel",
    ".gridly-v2-location-awareness-kicker",
    ".gridly-v2-location-awareness-title",
    ".gridly-v2-location-awareness-status",
    ".gridly-v2-location-awareness-meta",
    ".gridly-v2-location-awareness-route"
  ]) assert.ok(finalClosure.includes(owner), `missing Location Context owner ${owner}`);
});

test("active destination search shell, input, actions, results and state presentation are Light-owned", () => {
  for (const owner of [
    "#gridlySearchShell .gridly-search-card",
    ".gridly-search-label",
    ".gridly-search-subtitle",
    ".gridly-search-close-btn",
    ".gridly-search-input-row",
    ".gridly-search-input",
    "#gridlyRemoteSearchBtn:not(:disabled)",
    ".gridly-search-results-status",
    ".gridly-search-result-item",
    ".gridly-search-result-title",
    ".gridly-search-result-meta",
    ":disabled"
  ]) assert.ok(finalClosure.includes(owner), `missing Destination Search owner ${owner}`);
});

test("KBYG, Settings closed controls and Travel Brief retain a token-governed Light hierarchy", () => {
  assert.match(finalClosure, /\.gridly-brief-foundation-handle[\s\S]*?linear-gradient[\s\S]*?--gridly-accent-soft/);
  assert.match(finalClosure, /data-active-sheet="settings"[\s\S]*?settings-select-grid :is\(select, \.settings-text-size-segments, \.settings-text-size-segment\)/);
  assert.match(finalClosure, /settings-text-size-segment:is\(\.is-selected, \[aria-checked="true"\]\)/);
  assert.match(finalClosure, /\.gridly-travel-brief[\s\S]*?--gridly-panel[\s\S]*?--gridly-elevated[\s\S]*?--gridly-nested/);
});

test("Portrait V2 logo uses the existing dark and light asset contract", () => {
  const brand = html.slice(html.indexOf('<div class="gridly-v2-brand"'), html.indexOf("</div></div>", html.indexOf('<div class="gridly-v2-brand"')));
  assert.match(brand, /data-gridly-theme-logo/);
  assert.match(brand, /data-gridly-dark-logo="assets\/store\/branding\/Logos\/gridly-logo-horizontal\.png"/);
  assert.match(brand, /data-gridly-light-logo="assets\/store\/branding\/Logos\/gridly-logo-vertical\.png"/);
  const inventory = readdirSync(new URL("../assets/store/branding/Logos/", import.meta.url)).sort();
  assert.deepEqual(inventory, ["gridly-logo-horizontal.png", "gridly-logo-vertical.png"]);
});

test("theme application swaps logo ownership live for Dark, Light and effective System appearance", () => {
  const apply = app.slice(app.indexOf("function applyGridlySettingsDisplayPreferences"), app.indexOf("function updateGridlySettingsMapStyleLabel"));
  assert.match(apply, /effectiveTheme === "light" \? logo\.dataset\.gridlyLightLogo : logo\.dataset\.gridlyDarkLogo/);
  assert.match(apply, /logo\.setAttribute\("src", nextAsset\)/);
  assert.match(apply, /normalized\.theme === "system"/);
  assert.match(apply, /matchMedia\("\(prefers-color-scheme: light\)"\)/);
  assert.match(apply, /appearanceQuery\.addEventListener\?\.\("change"/);
});

test("LP185.6C is presentation-only and protects map style, layout, LP185.5 and LP185.4", () => {
  assert.doesNotMatch(finalClosure, /(?:width|height|top|right|bottom|left|padding|margin)\s*:/);
  assert.doesNotMatch(finalClosure, /route-geometry|destination-routing|hazard-lifecycle|tile-provider|map-style|setUrl/);
  assert.match(lp1855Protection, /focusGridlyRouteWatchStartOnce/);
  assert.match(lp1854Protection, /getGridlyIncidentLocationPresentation/);
});
