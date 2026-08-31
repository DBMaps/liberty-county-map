import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP243.H5 — bounded short-landscape composition authority.";
const h5 = css.slice(css.indexOf(marker));

test("H5 is explicitly short-landscape scoped and cannot match portrait", () => {
  assert.match(h5, /^\/\* LP243\.H5[\s\S]*?@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(h5, /orientation: portrait/);
  assert.match(html, /css\/styles\.css\?v=243h7-fluid-geometry-reconciliation/);
});

test("compact base retains identity, KBYG disclosure, tabs, map controls, Location Context and dock", () => {
  assert.match(html, /class="gridly-v2-topbar"[\s\S]*?id="gridlyBriefFoundationHandle"[\s\S]*?class="gridly-v2-segments"[\s\S]*?class="gridly-v2-control-rail"/);
  assert.match(html, /class="mobile-destination-command"[\s\S]*?aria-controls="gridlySearchShell"/);
  assert.match(html, /class="gridly-v2-bottom-dock"[\s\S]*?>Report<.*?>Alerts<.*?>History<.*?>Settings</s);
  assert.match(h5, /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(h5, /gridly-v2-status-pill[\s\S]*?max-height: 40px/);
  assert.match(h5, /gridly-v2-segments[\s\S]*?min-height: 32px/);
  assert.match(h5, /gridly-v2-control-rail[\s\S]*?top: 132px/);
  assert.match(h5, /--lp243h5-dock-height: 56px/);
});

test("existing KBYG content stays available through its current collapse lifecycle", () => {
  assert.match(html, /id="gridlyBriefFoundationHandle" aria-expanded="false" aria-controls="gridlyBriefInteractionPanel"/);
  assert.match(html, /id="gridlyBriefInteractionPanel"[\s\S]*?Know Before You Go[\s\S]*?gridlyTravelBriefList/);
  assert.match(app, /function gridlyBriefInteractionSetExpanded\(expanded, options\)[\s\S]*?gridly-brief-collapsed/);
  assert.match(h5, /gridly-brief-expanded[\s\S]*?overflow-y: auto/);
});

test("actual major-surface owners and lifecycles are explicit", () => {
  assert.match(html, /<div id="gridlySearchShell"[^>]*hidden/);
  for (const owner of ["alerts", "settings", "report"]) {
    assert.match(html, new RegExp(`data-v2-sheet="${owner}"`));
    assert.match(h5, new RegExp(`data-active-sheet="${owner}"`));
  }
  assert.match(html, /id="gridlyPortraitV2Sheet"[^>]*hidden[\s\S]*?id="gridlyPortraitV2SheetClose"/);
  assert.match(app, /sheet\.removeAttribute\("data-active-sheet"\)/);
});

test("one foreground tier covers chrome and scrolls active workspace internally", () => {
  assert.match(h5, /--lp243h5-foreground-z: 10000/);
  assert.match(h5, /#gridlySearchShell:not\(\[hidden\]\)[\s\S]*?z-index: var\(--lp243h5-foreground-z\)/);
  assert.match(h5, /#gridlyPortraitV2Sheet:not\(\[hidden\]\):is\([\s\S]*?z-index: var\(--lp243h5-foreground-z\)/);
  assert.match(h5, /:has\(#gridlySearchShell:not\(\[hidden\]\)\)[\s\S]*?visibility: hidden !important[\s\S]*?pointer-events: none !important/);
  assert.match(h5, /gridly-search-card[\s\S]*?overflow-y: auto !important/);
  assert.match(h5, /#gridlyPortraitV2SheetBody[\s\S]*?overflow-y: auto !important/);
});

test("close and orientation return rely on current lifecycle with no sticky H5 state", () => {
  assert.doesNotMatch(h5, /classList|localStorage|data-gridly-brief-state\s*=/);
  assert.match(app, /sheet\.hidden = true;[\s\S]*?sheet\.removeAttribute\("data-active-sheet"\)/);
  assert.match(h5, /#gridlySearchShell:not\(\[hidden\]\)/);
});

test("H1 through H4 contracts and feature/data authority remain intact", () => {
  assert.match(app, /nextMode: "portrait"/);
  assert.match(css, /--lp243h2-shell-width: min\(760px, calc\(100vw - 24px\)\)/);
  assert.match(css, /--lp243h3-location-bottom-inset: calc\(/);
  assert.match(css, /LP243\.H4 — current consumer-presentation ownership/);
  assert.doesNotMatch(h5, /fetch\(|setView|localStorage|Supabase|createShared|routeNavSection|applyGeoFilter|renderAlerts|query intent|ranking/);
});
