import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const authority = css.slice(css.indexOf("/* LP185.6F"));
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
  assert.equal((css.match(/\/\* LP185\.6[A-E]?\b/g) || []).length, 0);
  assert.equal((css.match(/\/\* LP185\.6F\b/g) || []).length, 1);
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
  for (const selector of [".gridly-v2-location-awareness-panel", ".mobile-destination-command.is-awareness-panel,"])
    assert.match(ruleFor(selector), /--gridly-elevated[\s\S]*--gridly-shadow/);
  assert.doesNotMatch(authority, /mobile-destination-command\.is-awareness-panel[^{}]*\{[^{}]*linear-gradient/);
  assert.match(authority, /&\.gridly-mobile-awareness-panel-present \.map-card > \.mobile-destination-command/);
});

test("current runtime foreground owners use readable semantic roles", () => {
  const required = [
    ["Travel decision", /data-gridly-decision-role="interpretation"[\s\S]*--gridly-text-primary/],
    ["Travel support", /gridly-brief-context[\s\S]*--gridly-text-secondary/],
    ["Travel metadata", /gridly-travel-brief-source[\s\S]*--gridly-text-muted/],
    ["Search heading", /gridly-search-label, \.gridly-search-result-title\)[\s\S]*--gridly-text-primary/],
    ["Search status", /gridly-search-subtitle, \.gridly-search-results-status[\s\S]*--gridly-text-secondary/],
    ["Search placeholder", /gridly-search-input::placeholder[\s\S]*--gridly-text-muted/],
    ["Report prompt", /gridly-v2-report-prompt strong[\s\S]*--gridly-text-primary/],
    ["Report disabled", /gridly-v2-report-action\):disabled[\s\S]*--gridly-text-muted/],
    ["History body", /gridly-historical-intelligence-line[\s\S]*--gridly-text-secondary/],
    ["Settings title", /settings-list-title, label, select, input[\s\S]*--gridly-text-primary/],
    ["Dock descendants", /bottom-dock button :is\(\.dock-icon, span, em, svg\)[\s\S]*color: inherit !important/]
  ];
  for (const [name, pattern] of required) assert.match(authority, pattern, name);
});

test("foreground closure adds roles, not fixed pale generic copy or layout", () => {
  const closure = authority.slice(authority.indexOf("Foreground ownership is explicit"));
  assert.doesNotMatch(closure, /color:\s*(?:#fff(?:fff)?\b|rgba?\(2(?:0[02468]|2[02468]),\s*2(?:2[02468]|3[02468]|4[02468]))/i);
  assert.doesNotMatch(closure, /(?:^|[;{]\s*)(?:width|height|top|right|bottom|left|padding|margin)\s*:/m);
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
