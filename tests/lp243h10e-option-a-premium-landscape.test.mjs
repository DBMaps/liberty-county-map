import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP243.H10E — Option A premium landscape visual system";
const h10e = css.slice(css.indexOf(marker));
const matches = (width, height) => width > height && height <= 500;

test("Option A is scoped by the frozen short-landscape authority", () => {
  assert.match(css.slice(css.indexOf("/* LP243.H10B FINAL")), /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*LP243\.H10E/);
  assert.equal(matches(932, 430), true);
  assert.equal(matches(844, 390), true);
  for (const size of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matches(...size), false);
});

test("H10B grid, flexible map, and collapsed zero-reserve contract are unchanged", () => {
  const h10b = css.slice(css.indexOf("/* LP243.H10B FINAL"), css.indexOf("/* LP243.H10C"));
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.match(h10b, /gridly-v2-bottom-region[\s\S]*position: fixed[\s\S]*translateY\(100%\)/);
  assert.doesNotMatch(h10e, /grid-template-rows:\s*var\(--lp243h10b-top-height\)|translateY\(100%\)|transform:\s*scale\(/);
});

test("the existing three header regions and segmented filter owners are reused", () => {
  for (const id of ["gridlyV2TopStatusPrimary", "gridlyBriefFoundationHandle"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  assert.equal((html.match(/class="gridly-v2-brand"/g) || []).length, 1);
  assert.equal((html.match(/data-v2-filter=/g) || []).length, 5);
  assert.match(h10e, /grid-template-columns: minmax\(0, 1fr\) clamp\(184px, 25vw, 238px\)/);
  assert.doesNotMatch(html.slice(html.indexOf('id="gridlyPortraitV2"'), html.indexOf('id="gridlyPortraitBottomRegion"')), /hamburger|menu|Settings/);
});

test("disclosure and expanded overlay reuse Location Context, Search, and four actions", () => {
  for (const id of ["gridlyLandscapeCommandToggle", "mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  assert.match(h10e, /gridly-v2-bottom-region[\s\S]*border-radius: var\(--lp243h10e-radius\)/);
  assert.match(h10e, /#mobileDestinationCommandPanel[\s\S]*background: transparent/);
  assert.equal((html.match(/id="gridlySettingsDockButton"/g) || []).length, 1);
});

test("KBYG, Search, V2 sheets, Leaflet, and feature authorities stay protected", () => {
  assert.equal((html.match(/id="gridlyBriefInteractionPanel"/g) || []).length, 1);
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.match(h10e, /gridly-h9-brief-foreground[\s\S]*gridly-brief-interaction-panel/);
  assert.match(html, /styles\.css\?v=243h10k-action-row-gap-closure/);
  assert.match(html, /app\.js\?v=243h10i-search-tray-containment/);
  assert.doesNotMatch(h10e, /fetch\(|Supabase|DriveTexas|Home Area|Awareness Area|addEventListener|setView\(|zoomIn\(|zoomOut\(/);
  assert.match(app, /H10B always returns[\s\S]*gridlyLandscapeCommandExpanded = false[\s\S]*syncGridlyLandscapeCommandPanel/);
});
