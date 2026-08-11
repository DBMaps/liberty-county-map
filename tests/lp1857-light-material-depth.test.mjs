import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const phase = css.slice(css.indexOf("/* LP185.7"));
const finishing = css.slice(css.indexOf("/* LP185.7 Phase 3"));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("LP185.7 is Light/System-Light only and keeps the seven governed roles", () => {
  assert.match(phase, /body\.gridly-theme-light, html\[data-gridly-effective-theme="light"\] body\.gridly-theme-system/);
  assert.doesNotMatch(phase, /gridly-theme-dark|effective-theme="dark"/);
  for (const role of ["app-bg", "panel", "elevated", "nested", "accent", "control-bg", "backdrop"])
    assert.match(css, new RegExp(`--gridly-${role}:`));
  assert.doesNotMatch(phase, /--gridly-(?:surface-strong|surface-soft):/);
});

test("Phase 3 preserves the authoritative tokens, roles, and shadow recipes", () => {
  const expected = new Map([
    ["app-bg", "#eef4f8"], ["panel", "#f2f7fa"], ["elevated", "#fbfdff"],
    ["nested", "#e3edf3"], ["control-bg", "#eaf2f6"], ["backdrop", "rgba(10, 30, 48, 0.4)"],
    ["accent", "#066b70"],
  ]);
  for (const [token, value] of expected)
    assert.match(css, new RegExp(`--gridly-${token}:\\s*${value.replace(/[().]/g, "\\$&")}`));
  assert.doesNotMatch(finishing, /--gridly-[\w-]+\s*:/);
  for (const declaration of finishing.matchAll(/(?:box-shadow|filter):\s*([^;]+)/g))
    assert.match(declaration[1], /^(?:none|var\()/);
  assert.match(css, /--gridly-recipe-a-shadow:\s*0 18px 46px rgba\(18, 42, 64, 0\.16\), 0 2px 8px rgba\(18, 42, 64, 0\.08\)/);
  assert.match(css, /--gridly-recipe-b-shadow:\s*0 8px 22px rgba\(18, 42, 64, 0\.12\), 0 1px 4px rgba\(18, 42, 64, 0\.07\)/);
});

test("Report keeps scoped CONTROL, ACCENT-SOFT selection, and ACCENT CTA ownership", () => {
  assert.match(finishing, /data-active-sheet="report"[\s\S]*report-action:not\([\s\S]*color-mix\(in srgb, var\(--gridly-control-bg\) 72%, var\(--gridly-nested\)\)[\s\S]*box-shadow:\s*none/);
  assert.match(finishing, /report-action:is\(\.is-selected, \[aria-pressed="true"\]\)[\s\S]*background:\s*var\(--gridly-accent-soft\)/);
  assert.match(css, /report-ctas [^{]*report-use-location[^}]*:not\(:disabled\)[^{]*\{[\s\S]*?background:\s*var\(--gridly-accent\)/);
});

test("populated Alerts owns one INSET list with transparent DIVIDER rows", () => {
  assert.match(finishing, /gridly-alerts-active > \.gridly-v2-list[\s\S]*background:\s*var\(--gridly-nested\)/);
  assert.match(finishing, /gridly-alert-row\.gridly-alert-intel-card[\s\S]*background:\s*transparent[\s\S]*var\(--gridly-divider\)[\s\S]*box-shadow:\s*none/);
  assert.doesNotMatch(finishing, /gridly-alert-(?:title|location-line|meta-line|trust-line)[\s\S]*color:/);
});

test("Historical subject is flat and intelligence groupings retain INSET", () => {
  assert.match(finishing, /historical-intelligence-subject[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/);
  assert.match(finishing, /historical-intelligence-typical-pattern[\s\S]*background:\s*var\(--gridly-nested\)/);
  assert.match(finishing, /historical-intelligence-details[\s\S]*background:\s*var\(--gridly-nested\)/);
  assert.match(finishing, /historical-intelligence-detail-title[\s\S]*border-top-color:\s*var\(--gridly-divider\)/);
  assert.match(finishing, /historical-intelligence-row[\s\S]*box-shadow:\s*none/);
  assert.doesNotMatch(finishing, /historical-intelligence-(?:subtitle|line|location|note|context-note)[\s\S]*color:/);
});

test("Settings is one grouped tonal region with flat divider-driven summaries", () => {
  assert.match(finishing, /data-active-sheet="settings"\] \.gridly-settings-sheet\s*\{[\s\S]*?background:\s*var\(--gridly-nested\)/);
  assert.match(finishing, /:is\(\.settings-list-section, \.settings-modal-section\)[\s\S]*background:\s*transparent[\s\S]*border-color:\s*transparent/);
  assert.match(finishing, /settings-list-summary[\s\S]*background:\s*transparent[\s\S]*var\(--gridly-divider\)/);
  assert.match(finishing, /:last-child > \.settings-list-summary[\s\S]*border-bottom-color:\s*transparent/);
  assert.match(finishing, /settings-list-detail[\s\S]*background:\s*var\(--gridly-nested\)/);
  assert.match(css, /:is\(input, select, textarea, \.settings-text-size-segment\)[\s\S]*?background:\s*var\(--gridly-input-bg\)/);
  assert.doesNotMatch(finishing, /\boption\b/);
});

test("Phase 3 is explicit Light/System-Light material-only closure", () => {
  assert.match(finishing, /^\/\*[\s\S]*:is\(body\.gridly-theme-light, html\[data-gridly-effective-theme="light"\] body\.gridly-theme-system\)/);
  assert.doesNotMatch(finishing, /gridly-theme-dark|effective-theme="dark"/);
  assert.doesNotMatch(finishing, /(?:width|height|margin|padding|gap|display|position|inset|top|right|bottom|left|overflow|font(?:-size|-family|-weight)?|line-height|letter-spacing)\s*:/);
  assert.doesNotMatch(finishing, /awareness|recipe-[ab]-shadow|travel-brief|location-context|route-context|destination|bottom-dock|control-rail|gridlySearch/);
  assert.match(css, /LP185\.6L[\s\S]*gridly-travel-brief-item h4[\s\S]*color:\s*var\(--gridly-accent\)/);
});

test("daylight shield and Awareness share governed Light materials", () => {
  assert.match(phase, /#gridlyPortraitV2::before[\s\S]*background:\s*var\(--gridly-app-bg\)/);
  assert.match(phase, /gridly-v2-awareness-brief-card[\s\S]*background-color:\s*var\(--gridly-panel\)/);
  assert.match(phase, /data-awareness-state[\s\S]*background-color:\s*var\(--gridly-panel\)/);
  assert.doesNotMatch(phase, /#(?:06101f|071622|081827|0b1929|0d1d2e)|rgba\(5,\s*13,\s*23/);
});

test("Awareness foreground hierarchy and KBYG accent are explicit", () => {
  assert.match(phase, /awareness-brief-card strong[\s\S]*--gridly-text-primary/);
  assert.match(phase, /awareness-brief-card > span[\s\S]*--gridly-text-secondary/);
  assert.match(phase, /awareness-trust-line[\s\S]*--gridly-text-muted/);
  assert.match(phase, /brief-foundation-handle[\s\S]*background:\s*var\(--gridly-accent\)/);
});

test("Recipe owners elevate once while children stay flat", () => {
  assert.match(phase, /gridlyPortraitV2Sheet[\s\S]*--gridly-recipe-a-shadow/);
  assert.match(phase, /gridly-search-card[\s\S]*--gridly-recipe-a-shadow/);
  assert.match(phase, /gridly-v2-control-rail[\s\S]*--gridly-recipe-b-shadow/);
  assert.match(phase, /bottom-dock[\s\S]*--gridly-recipe-b-shadow/);
  assert.match(phase, /report-action[\s\S]*box-shadow:\s*none/);
  assert.match(phase, /search-result-item[\s\S]*box-shadow:\s*none/);
});

test("accepted foreground constants and test command remain protected", () => {
  for (const value of ["#0d1b2a", "#3d5265", "#536a7f", "#066b70", "rgba(8, 127, 131, 0.13)", "#f7ffff"])
    assert.ok(css.includes(value), value);
  assert.equal(packageJson.scripts["test:lp1857"], "node --test tests/lp1857-light-material-depth.test.mjs");
});
