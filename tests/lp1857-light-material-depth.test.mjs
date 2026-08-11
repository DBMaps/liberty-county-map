import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const phase = css.slice(css.indexOf("/* LP185.7"));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("LP185.7 is Light/System-Light only and keeps the seven governed roles", () => {
  assert.match(phase, /body\.gridly-theme-light, html\[data-gridly-effective-theme="light"\] body\.gridly-theme-system/);
  assert.doesNotMatch(phase, /gridly-theme-dark|effective-theme="dark"/);
  for (const role of ["app-bg", "panel", "elevated", "nested", "accent", "control-bg", "backdrop"])
    assert.match(css, new RegExp(`--gridly-${role}:`));
  assert.doesNotMatch(phase, /--gridly-(?:surface-strong|surface-soft):/);
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
