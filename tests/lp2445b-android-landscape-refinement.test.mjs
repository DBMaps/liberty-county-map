import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP244.5 Task B — physical Android landscape refinement.";
const repairStart = css.indexOf(marker);
const repair = css.slice(repairStart, css.indexOf("/* End LP244.5 Task B landscape refinement. */", repairStart));

test("refinement has one short-landscape boundary and explicitly excludes portrait", () => {
  assert.equal((css.match(/LP244\.5 Task B — physical Android landscape refinement/g) || []).length, 1);
  assert.match(repair, /^\/\* LP244\.5[\s\S]*@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.doesNotMatch(repair, /@media[^\{]*orientation:\s*portrait/);
});

test("first-run welcome separates brand and title into bounded columns", () => {
  assert.match(repair, /\.gridly-v950-welcome-page\s*\{[\s\S]*grid-template-columns: minmax\(132px,[\s\S]*grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(repair, /\.gridly-v950-welcome-logo\s*\{[\s\S]*grid-column: 1;[\s\S]*width: min\(22vw, 174px\)/);
  assert.match(repair, /\.gridly-v950-welcome-page \.gridly-v950-page-copy\s*\{[\s\S]*grid-column: 2/);
  assert.match(app, /Welcome to Gridly[\s\S]*Know Before You Go\./);
});

test("portrait onboarding authority remains untouched", () => {
  assert.doesNotMatch(repair, /max-width:\s*520px|@media[^\{]*orientation:\s*portrait/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.gridly-v950-welcome-logo/);
});

test("open Settings section spans both columns and scroll ownership remains intact", () => {
  assert.match(repair, /data-active-sheet="settings"[\s\S]*\.settings-list-section\[open\][\s\S]*grid-column: 1 \/ -1/);
  assert.match(repair, /data-active-sheet="settings"\] #gridlyPortraitV2SheetBody[\s\S]*scroll-padding-block:[\s\S]*padding-bottom/);
  assert.match(css, /data-active-sheet="settings"\] #gridlyPortraitV2SheetBody[\s\S]*overflow-y: auto !important/);
  assert.match(css, /data-active-sheet="settings"\] \.gridly-settings-sheet[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("Settings takeover and four-item dock remain protected", () => {
  assert.match(css, /:has\(#gridlyPortraitV2Sheet\[data-active-sheet="settings"\]:not\(\[hidden\]\)\)[\s\S]*\.gridly-v2-bottom-region[\s\S]*display: block !important/);
  assert.equal((html.match(/data-v2-sheet="(?:report|alerts|history|settings)"/g) || []).length, 4);
  assert.match(css, /data-active-sheet="settings"[\s\S]*#mobileDestinationCommandPanel[\s\S]*display: none !important/);
});

test("focused landscape search follows visualViewport and yields space to results", () => {
  assert.match(app, /visualViewport\?\.height[\s\S]*--gridly-visual-vh/);
  assert.match(app, /visualViewport\.addEventListener\("resize", setVisualViewportHeight/);
  assert.match(repair, /#gridlySearchShell:not\(\[hidden\]\):focus-within[\s\S]*bottom:[\s\S]*max-height: calc\(var\(--gridly-visual-vh/);
  assert.match(repair, /:focus-within \.gridly-search-results[\s\S]*flex: 1 1 auto[\s\S]*overflow-y: auto/);
  assert.match(repair, /:focus-within \.gridly-search-subtitle[\s\S]*display: none/);
  assert.match(html, /id="gridlyAddressSearchInput"[\s\S]*type="search"/);
});

test("keyboard close recovery is state-free and Alerts/KBYG containment stays intact", () => {
  assert.doesNotMatch(repair, /classList|localStorage|preventDefault|focus\(|blur\(/);
  assert.match(css, /data-active-sheet="alerts"[\s\S]*overflow-y: auto !important/);
  assert.match(css, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*overflow-y: auto !important/);
});
