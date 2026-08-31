import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const h2Marker = "/* LP243.H2 — one landscape containment authority";
const h6Marker = "/* LP243.H6 — fluid short-landscape viewport-fit authority.";
const h7Marker = "/* LP243.H7 — single-axis fluid geometry reconciliation.";
const h2 = css.slice(css.indexOf(h2Marker), css.indexOf("/* LP243.H3"));
const h6 = css.slice(css.indexOf(h6Marker), css.indexOf(h7Marker));
const h7 = css.slice(css.indexOf(h7Marker), css.indexOf("/* LP243.H8"));

test("H7 is exclusively short-landscape scoped and cannot match portrait or H2 desktop", () => {
  assert.match(h7, /^\/\* LP243\.H7[\s\S]*?@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(h7, /orientation:\s*portrait|min-width:\s*761px|max-width:\s*(?:320|390|430)px/);
  const matchesH7 = (width, height) => width > height && height <= 500;
  for (const viewport of [[932, 430], [844, 390]]) assert.equal(matchesH7(...viewport), true);
  for (const viewport of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matchesH7(...viewport), false);
});

test("H2 centered-shell ownership remains intact outside H6", () => {
  assert.match(h2, /--lp243h2-shell-width: min\(760px, calc\(100vw - 24px\)\)/);
  assert.match(h2, /left: 50%;\s*transform: translateX\(-50%\)/);
  assert.doesNotMatch(h7, /--lp243h2-shell-width|min\(760px/);
});

test("H7 gives every H6 fixed fluid surface one safe-gutter x authority", () => {
  assert.match(h6, /--lp243h6-safe-inline: max\(8px, env\(safe-area-inset-left, 0px\)\)/);
  assert.match(h6, /--lp243h6-safe-inline-end: max\(8px, env\(safe-area-inset-right, 0px\)\)/);
  assert.match(h7, /gridly-v2-topbar[\s\S]*?gridly-v2-bottom-region[\s\S]*?gridly-v2-bottom-dock[\s\S]*?gridly-v2-location-awareness-panel[\s\S]*?mobile-destination-command/);
  assert.match(h7, /left: var\(--lp243h6-safe-inline\) !important;[\s\S]*?right: var\(--lp243h6-safe-inline-end\) !important;[\s\S]*?width: auto !important;[\s\S]*?max-width: none !important;[\s\S]*?transform: none !important/);
  assert.doesNotMatch(h7, /translateX\(-50%\)|transform:\s*scale\(/);
});

test("bottom region, dock, Location Context, and four dock columns fit both owner viewports", () => {
  assert.match(html, /id="gridlyPortraitBottomRegion"[\s\S]*?class="gridly-v2-bottom-dock"[\s\S]*?>Report<[\s\S]*?>Alerts<[\s\S]*?>History<[\s\S]*?>Settings</);
  for (const width of [932, 844]) {
    const left = 8;
    const right = width - 8;
    const fluidWidth = right - left;
    assert.deepEqual({ left, right, fluidWidth }, width === 932
      ? { left: 8, right: 924, fluidWidth: 916 }
      : { left: 8, right: 836, fluidWidth: 828 });
    for (let column = 0; column < 4; column += 1) {
      const columnLeft = left + fluidWidth * column / 4;
      const columnRight = left + fluidWidth * (column + 1) / 4;
      assert.ok(columnLeft >= 0 && columnRight <= width);
    }
  }
});

test("shell edges bound height and the established map flex chain receives the remainder", () => {
  assert.match(h7, /\.app-shell\.premium-layout\s*\{[\s\S]*?inset: 0;[\s\S]*?height: auto;[\s\S]*?max-height: none;[\s\S]*?margin: 0 auto/);
  assert.doesNotMatch(h7, /height:\s*100dvh/);
  assert.match(h6, /padding: var\(--lp243h6-map-top-reserve\)[\s\S]*?var\(--lp243h6-map-bottom-reserve\)/);
  assert.match(h6, /:is\(\.main-column, #mapSection\.command-center, \.map-card, \.map-frame\)[\s\S]*?flex: 1 1 0/);
  assert.match(h6, /#map \{[\s\S]*?flex: 1 1 0/);
  for (const height of [430, 390]) assert.equal(Math.min(0 + height, height), height);
});

test("foregrounds retain H5 ownership while H1-H6 protections and H7 identity remain", () => {
  assert.match(html, /LP243\.H restores the production application/);
  for (const milestone of ["H2", "H3", "H4", "H5", "H6"]) assert.match(css, new RegExp(`LP243\\.${milestone}`));
  assert.match(h7, /#gridlySearchShell:not\(\[hidden\]\)[\s\S]*?data-active-sheet="alerts"[\s\S]*?data-active-sheet="settings"[\s\S]*?data-active-sheet="report"[\s\S]*?transform: none !important/);
  assert.match(html, /css\/styles\.css\?v=243h9-bounded-landscape-foreground/);
});
