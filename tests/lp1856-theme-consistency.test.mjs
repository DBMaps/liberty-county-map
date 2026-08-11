import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

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
  const contract = css.slice(css.lastIndexOf("/* LP185.6"));
  assert.match(contract, /:is\(input, select, textarea, \.gridly-premium-select\)/);
  assert.match(contract, /body\.gridly-theme-light \.settings-select-grid select[\s\S]*?color-scheme: light !important/);
  assert.match(contract, /\.leaflet-popup-content-wrapper/);
  assert.match(contract, /\.leaflet-control-layers/);
  assert.match(contract, /\.leaflet-popup-tip/);
});

test("dynamic update and alert presentation follows CSS theme ownership", () => {
  assert.match(app, /notice\.className = "gridly-pwa-update-notice"/);
  assert.doesNotMatch(app.slice(app.indexOf("function gridlyEnsurePwaUpdateNotice"), app.indexOf("function gridlyShowPwaUpdateAvailable")), /notice\.style\.cssText/);
  assert.match(css.slice(css.lastIndexOf("/* LP185.6")), /\.gridly-alert-title/);
  assert.match(css, /--gridly-text-secondary/);
});

test("theme and map style remain separately normalized and system is not rewritten", () => {
  assert.match(app, /if \(GRIDLY_SETTINGS_MAP_STYLE_LABELS\[normalizedStyle\]\) base\.display\.mapStyle = normalizedStyle/);
  assert.match(app, /if \(GRIDLY_SETTINGS_VALID_THEMES\.has\(normalizedTheme\)\) base\.display\.theme = normalizedTheme/);
  assert.match(app, /normalized\.theme === "system"/);
  assert.doesNotMatch(html.slice(html.indexOf('id="gridly-early-theme"'), html.indexOf('id="gridly-prepaint-startup-guard"')), /mapStyle/);
});

test("semantic and provider contracts are not redefined by LP185.6", () => {
  const contract = css.slice(css.lastIndexOf("/* LP185.6"));
  assert.doesNotMatch(contract, /tileLayer|route-geometry|crossing-marker|hazard-marker|incident-severity/);
  for (const provider of ["OpenStreetMap", "CARTO", "Esri"]) assert.match(app, new RegExp(provider, "i"));
});
