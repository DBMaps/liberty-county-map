import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP243.H3 — landscape primary-control vertical containment.";
const h3 = css.slice(css.indexOf(marker), css.indexOf("/* LP243.H5"));
const commandMarkup = html.slice(
  html.indexOf('<article id="mobileDestinationCommandPanel" class="mobile-destination-command"'),
  html.indexOf('<article class="mobile-live-command"')
);

const dock = { bottomInset: 9, height: 69 };
const location = { height: 67, gap: 8 };
const briefBottom = 227;

function geometry(viewportHeight) {
  const dockTop = viewportHeight - dock.bottomInset - dock.height;
  const locationBottom = dockTop - location.gap;
  const locationTop = locationBottom - location.height;
  return { dockTop, locationBottom, locationTop, usableMapHeight: locationTop - briefBottom };
}

test("H3 is a final landscape/wider authority that cannot match protected portrait", () => {
  assert.ok(css.indexOf(marker) > css.indexOf("/* LP243.H2 — one landscape containment authority"));
  assert.match(h3, /^\/\*[^]*?@media \(orientation: landscape\), \(min-width: 761px\)/);
  assert.doesNotMatch(h3, /@media \(max-width: 760px\)|orientation:\s*portrait/);
  for (const [width, height] of [[320, 700], [390, 844], [430, 932]]) {
    assert.equal(width > height || width >= 761, false);
  }
});

test("Location Context owns one explicit dock-relative landscape vertical contract", () => {
  assert.match(h3, /--lp243h3-dock-bottom-inset: calc\(9px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(h3, /--lp243h3-dock-height: 69px/);
  assert.match(h3, /--lp243h3-location-dock-gap: 8px/);
  assert.match(h3, /\.map-card > \.mobile-destination-command[^]*?position: fixed !important[^]*?top: auto !important[^]*?bottom: var\(--lp243h3-location-bottom-inset\) !important[^]*?margin-block: 0 !important/);
  assert.match(h3, /#mapSection\.command-center[^]*?transform: none !important[^]*?will-change: auto !important/);
});

test("Search remains a naturally positioned child of Location Context", () => {
  assert.match(commandMarkup, /id="mobileDestinationCommandBtn"/);
  assert.doesNotMatch(h3, /#mobileDestinationCommandBtn|gridlySearch|poi|eventListener/i);
});

test("representative short landscapes keep Location Context above the dock and retain map", () => {
  for (const height of [430, 390]) {
    const result = geometry(height);
    assert.ok(result.locationTop >= 0, `${height}px Location Context is onscreen`);
    assert.equal(result.locationBottom + location.gap, result.dockTop, `${height}px gap is exact`);
    assert.ok(result.usableMapHeight > 0, `${height}px usable map region remains`);
    assert.ok(result.dockTop < height && result.dockTop >= 0, `${height}px dock remains reachable`);
  }
});

test("H1 runtime ownership and H2 horizontal shell remain unchanged under H4 identities", () => {
  assert.match(app, /let activeLayoutMode = "portrait"/);
  assert.match(html, /js\/app\.js\?v=243h10b-final-short-landscape-authority/);
  const h2 = css.slice(css.indexOf("/* LP243.H2 — one landscape containment authority"), css.indexOf(marker));
  assert.match(h2, /--lp243h2-shell-width: min\(760px, calc\(100vw - 24px\)\)/);
  assert.match(h2, /left: 50%;\s*transform: translateX\(-50%\)/);
  assert.match(html, /css\/styles\.css\?v=243h10e-option-a-premium-landscape/);
});

test("orientation return restores untouched Portrait geometry and no Search runtime changed", () => {
  const beforeH3 = css.slice(0, css.indexOf(marker));
  assert.match(beforeH3, /@media \(max-width: 760px\) and \(orientation: portrait\)/);
  assert.doesNotMatch(h3, /style\.|classList|dataset/);
  assert.equal(app.includes("LP243.H3"), false);
});
