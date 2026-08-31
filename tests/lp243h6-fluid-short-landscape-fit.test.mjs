import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP243.H6 — fluid short-landscape viewport-fit authority.";
const h6 = css.slice(css.indexOf(marker));

test("H6 matches only short landscape and cannot match portrait", () => {
  assert.match(h6, /^\/\* LP243\.H6[\s\S]*?@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(h6, /orientation:\s*portrait|max-width:\s*(?:320|390|430)px/);

  const matchesH6 = (width, height) => width > height && height <= 500;
  assert.equal(matchesH6(932, 430), true);
  assert.equal(matchesH6(844, 390), true);
  assert.equal(matchesH6(768, 1024), false);
  assert.equal(matchesH6(1440, 900), false);
  for (const [width, height] of [[320, 700], [390, 844], [430, 932]]) {
    assert.equal(matchesH6(width, height), false);
  }
});

test("H6 replaces the inherited 760px cap with one safe-gutter viewport width", () => {
  assert.match(css, /--lp243h2-shell-width: min\(760px, calc\(100vw - 24px\)\)/);
  assert.match(h6, /--lp243h6-shell-width: calc\(100vw - var\(--lp243h6-safe-inline\) - var\(--lp243h6-safe-inline-end\)\)/);
  assert.match(h6, /:is\(\.app-shell\.premium-layout, \.main-column, #mapSection\.command-center, \.map-card\)[\s\S]*?width: var\(--lp243h6-shell-width\);[\s\S]*?max-width: none/);
  assert.match(h6, /gridly-v2-topbar[\s\S]*?mobile-destination-command[\s\S]*?width: var\(--lp243h6-shell-width\);[\s\S]*?max-width: none/);
  assert.doesNotMatch(h6, /min\(760px|width:\s*760px/);
});

test("the short-landscape root owns 100dvh and the map consumes flex remainder", () => {
  assert.match(h6, /body\[data-layout-mode="portrait"\][\s\S]*?min-height: 100dvh;[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden/);
  assert.match(h6, /\.app-shell\.premium-layout[\s\S]*?display: flex;[\s\S]*?flex-direction: column;[\s\S]*?height: 100dvh;[\s\S]*?padding: var\(--lp243h6-map-top-reserve\)/);
  assert.match(h6, /:is\(\.main-column, #mapSection\.command-center, \.map-card, \.map-frame\)[\s\S]*?flex: 1 1 0;[\s\S]*?overflow: hidden/);
  assert.match(h6, /#map \{[\s\S]*?flex: 1 1 0;[\s\S]*?width: 100% !important/);
  assert.doesNotMatch(h6, /transform:\s*scale\(/);
});

test("Location Context, dock and all requested foreground workspaces share the fluid viewport", () => {
  assert.match(html, /class="mobile-destination-command"[\s\S]*?class="gridly-v2-bottom-dock"/);
  assert.match(h6, /\.map-card > \.mobile-destination-command[\s\S]*?width: var\(--lp243h6-shell-width\)/);
  assert.match(h6, /\.gridly-v2-bottom-region[\s\S]*?left: var\(--lp243h6-safe-inline\) !important;[\s\S]*?right: var\(--lp243h6-safe-inline-end\) !important/);
  assert.match(h6, /#gridlySearchShell:not\(\[hidden\]\)[\s\S]*?data-active-sheet="alerts"[\s\S]*?data-active-sheet="settings"[\s\S]*?data-active-sheet="report"[\s\S]*?inset: max\(8px,[\s\S]*?width: auto !important;[\s\S]*?max-width: none !important/);
  assert.match(h6, /gridly-search-card[\s\S]*?#gridlyPortraitV2SheetBody[\s\S]*?overflow-y: auto !important/);
});

test("H1-H5 runtime, containment, Location Context and ownership contracts remain intact", () => {
  assert.match(app, /nextMode: "portrait"/);
  assert.match(css, /LP243\.H2 — one landscape containment authority/);
  assert.match(css, /--lp243h3-location-bottom-inset: calc\(/);
  assert.match(css, /LP243\.H4 — current consumer-presentation ownership/);
  assert.match(css, /LP243\.H5 — bounded short-landscape composition authority/);
  assert.match(html, /css\/styles\.css\?v=243h9-bounded-landscape-foreground/);
  assert.doesNotMatch(h6, /fetch\(|setView|localStorage|classList/);
});
