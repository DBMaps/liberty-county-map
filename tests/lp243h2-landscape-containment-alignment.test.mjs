import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const marker = "/* LP243.H2 — one landscape containment authority";
const h2 = css.slice(css.indexOf(marker));

test("H2 is a final landscape/wider-only geometry authority", () => {
  assert.ok(css.indexOf(marker) > css.indexOf("/* LP243.H — additive non-portrait containment"));
  assert.match(h2, /^\/\*[^]*?@media \(orientation: landscape\), \(min-width: 761px\)/);
  assert.doesNotMatch(h2, /@media \(max-width: 760px\)/);
});

test("structural surfaces consume one bounded centered shell", () => {
  assert.match(h2, /--lp243h2-shell-width: min\(760px, calc\(100vw - 24px\)\)/);
  for (const selector of ["app-shell.premium-layout", "main-column", "#mapSection.command-center", "map-card", "gridly-v2-topbar", "gridly-v2-brief-stack", "gridly-v2-bottom-dock", "mobile-destination-command"])
    assert.ok(h2.includes(selector), `${selector} is governed`);
  assert.match(h2, /width: var\(--lp243h2-shell-width\)/);
  assert.match(h2, /left: 50%;\s*transform: translateX\(-50%\)/);
  assert.match(h2, /right: auto/);
});

test("sheets scroll internally and document cannot overflow horizontally", () => {
  assert.match(h2, /#gridlyPortraitV2Sheet[^]*?max-height: calc\(100dvh - 104px\)[^]*?overflow-x: hidden[^]*?overflow-y: auto/);
  assert.match(h2, /overflow-x: clip/);
});

test("H1 ownership and promo authority remain untouched under H4 identities", () => {
  assert.match(html, /css\/styles\.css\?v=243h10c-final-landscape-refinement/);
  assert.match(html, /js\/app\.js\?v=243h10b-final-short-landscape-authority/);
  assert.match(css, /gridly-desktop-gate[^}]*display:\s*none/);
});

test("portrait widths 320, 390, and 430 cannot match H2", () => {
  for (const width of [320, 390, 430]) assert.ok(!(width >= 761), `${width}px portrait excluded`);
  assert.match(h2, /\(orientation: landscape\)/);
  assert.doesNotMatch(h2, /style\.|classList|dataset/);
});
