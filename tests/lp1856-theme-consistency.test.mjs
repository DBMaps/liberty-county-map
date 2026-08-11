import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const authority = css.slice(css.indexOf("/* LP185.6E"));
const lp1855 = readFileSync(new URL("lp1855-route-watch-start-location-recenter.test.mjs", import.meta.url), "utf8");
const lp1854 = readFileSync(new URL("lp185/incident-location-identity.test.mjs", import.meta.url), "utf8");
const roleTokens = ["app-bg", "panel", "elevated", "nested", "accent", "accent-soft", "accent-foreground", "control-bg", "backdrop"];

function ruleFor(selectorFragment) {
  const at = authority.indexOf(selectorFragment);
  assert.notEqual(at, -1, `missing ${selectorFragment}`);
  const open = authority.indexOf("{", at);
  return authority.slice(open + 1, authority.indexOf("}", open));
}

test("one consolidated LP185.6 family authority remains", () => {
  assert.equal((css.match(/\/\* LP185\.6[A-D]?\b/g) || []).length, 0);
  assert.equal((css.match(/\/\* LP185\.6E\b/g) || []).length, 1);
});

test("explicit and effective System themes share complete seven-role contracts", () => {
  assert.match(authority, /:is\(body\.gridly-theme-light, html\[data-gridly-effective-theme="light"\] body\.gridly-theme-system\)/);
  assert.match(authority, /:is\(body\.gridly-theme-dark, html\[data-gridly-effective-theme="dark"\] body\.gridly-theme-system\)/);
  for (const token of roleTokens) assert.equal((authority.match(new RegExp(`--gridly-${token}:`, "g")) || []).length, 2, token);
  assert.doesNotMatch(authority, /--gridly-(?:surface-strong|surface-soft):/);
});

test("elevation belongs only to approved shells and clusters", () => {
  const shadowOwners = [...authority.matchAll(/([^{}]+)\{[^{}]*box-shadow:\s*var\(--gridly-shadow\)/g)].map(match => match[1]);
  assert.ok(shadowOwners.length > 0);
  for (const owner of shadowOwners) assert.match(owner, /brief-interaction-panel|location-awareness-panel|mobile-destination-command|control-rail|gridlyPortraitV2Sheet\s*$|gridly-search-card/);
});

test("dock, filter and map-control children use non-elevated CONTROL hierarchy", () => {
  for (const selector of [".gridly-v2-bottom-dock button", ".gridly-v2-segments :is(button", ".gridly-v2-control-rail :is(button"])
    assert.match(ruleFor(selector), /box-shadow:\s*none !important/);
  assert.match(ruleFor(".gridly-v2-control-rail :is(button"), /--gridly-control-bg/);
});

test("Travel Brief rows and evidence children are not nested cards", () => {
  for (const selector of [".gridly-travel-brief :is(.gridly-brief-flow", ".gridly-travel-brief-item {", ".gridly-unified-evidence-item {"])
    assert.match(ruleFor(selector), /background:\s*transparent !important[\s\S]*box-shadow:\s*none !important/);
  assert.match(ruleFor(".gridly-unified-evidence {"), /--gridly-nested/);
});

test("Destination Search has one elevated shell and flat result rows", () => {
  assert.match(ruleFor("#gridlySearchShell .gridly-search-card"), /--gridly-elevated[\s\S]*--gridly-shadow/);
  assert.match(ruleFor("#gridlySearchShell .gridly-search-result-item {"), /background:\s*transparent[\s\S]*box-shadow:\s*none/);
  const search = authority.slice(authority.indexOf("#gridlySearchShell"), authority.indexOf("/* Light compromise"));
  assert.equal((search.match(/box-shadow:\s*var\(--gridly-shadow\)/g) || []).length, 1);
});

test("sheet rows stay flat while expanded Settings and Historical details are INSET", () => {
  const rows = ruleFor('#gridlyPortraitV2Sheet[data-active-sheet="settings"] :is(.settings-list-section');
  assert.match(rows, /background:\s*transparent[\s\S]*box-shadow:\s*none/);
  assert.match(authority, /settings-list-summary\),\s*#gridlyPortraitV2Sheet :is\(\.gridly-historical-intelligence-row/);
  assert.match(ruleFor("#gridlyPortraitV2Sheet :is(.settings-list-detail"), /--gridly-nested[\s\S]*box-shadow:\s*none/);
});

test("both Location Context owners are normalized without a Light navy gradient", () => {
  for (const selector of [".gridly-v2-location-awareness-panel", ".mobile-destination-command.is-awareness-panel {"])
    assert.match(ruleFor(selector), /--gridly-elevated[\s\S]*--gridly-shadow/);
  assert.doesNotMatch(authority, /mobile-destination-command\.is-awareness-panel[^{}]*\{[^{}]*linear-gradient/);
});

test("existing logo assets are retained and no artwork was added", () => {
  assert.match(html, /data-gridly-dark-logo="assets\/store\/branding\/Logos\/gridly-logo-horizontal\.png"/);
  assert.match(html, /data-gridly-light-logo="assets\/store\/branding\/Logos\/gridly-logo-vertical\.png"/);
  assert.deepEqual(readdirSync(new URL("../assets/store/branding/Logos/", import.meta.url)).sort(), ["gridly-logo-horizontal.png", "gridly-logo-vertical.png"]);
  assert.match(authority, /existing vertical bitmap is clipped to its complete mark/);
});

test("theme remains independent of map/provider and protected behavior", () => {
  assert.doesNotMatch(authority, /tileLayer|map-style|mapStyle|setUrl|route-geometry|destination-routing|hazard-lifecycle/);
  assert.match(app, /normalized\.theme === "system"/);
  assert.match(lp1855, /focusGridlyRouteWatchStartOnce/);
  assert.match(lp1854, /getGridlyIncidentLocationPresentation/);
});

test("consolidation introduces no layout geometry declarations", () => {
  assert.doesNotMatch(authority, /(?:^|[;{]\s*)(?:width|height|top|right|bottom|left|padding|margin)\s*:/m);
});
