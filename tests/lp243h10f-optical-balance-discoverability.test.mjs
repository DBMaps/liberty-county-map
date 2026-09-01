import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h10bStart = css.indexOf("/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY");
const h10cStart = css.indexOf("/* LP243.H10C", h10bStart);
const h10fStart = css.indexOf("/* LP243.H10F — final optical balance and discoverability", h10cStart);
const h10gStart = css.indexOf("/* LP243.H10G — final premium composition correction", h10fStart);
const h10b = css.slice(h10bStart, h10cStart);
const h10f = css.slice(h10fStart, h10gStart);
const matches = (width, height) => width > height && height <= 500;

test("H10F is contained by the frozen short-landscape authority", () => {
  assert.ok(h10bStart >= 0 && h10cStart > h10bStart && h10fStart > h10cStart);
  assert.match(css.slice(h10bStart, h10fStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.equal(matches(932, 430), true);
  assert.equal(matches(844, 390), true);
  for (const size of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matches(...size), false);
});

test("H10B grid, flexible map, and zero-reserve collapsed model are unchanged", () => {
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.match(h10b, /gridly-v2-bottom-region[\s\S]*position: fixed[\s\S]*transform: translateY\(100%\)/);
  assert.doesNotMatch(h10f, /grid-template-rows|#map\s*\{[^}]*flex|translateY\(100%\)|transform:\s*scale\(/);
});

test("existing header owners gain the approved optical hierarchy without duplication", () => {
  assert.equal((html.match(/class="gridly-v2-brand"/g) || []).length, 1);
  assert.equal((html.match(/id="gridlyBriefFoundationHandle"/g) || []).length, 1);
  assert.equal((html.match(/id="gridlyV2TopStatusPrimary"/g) || []).length, 1);
  assert.match(h10f, /max-height: 40px !important/);
  assert.match(h10f, /font-weight: 520/);
  assert.match(html, /Loading Community Pulse…/);
  assert.doesNotMatch(html.slice(html.indexOf('id="gridlyPortraitV2"'), html.indexOf('id="gridlyPortraitBottomRegion"')), /hamburger|menu|Settings/);
});

test("disclosure remains accessible while its visible tab becomes discoverable", () => {
  assert.equal((html.match(/id="gridlyLandscapeCommandToggle"/g) || []).length, 1);
  assert.match(html, /id="gridlyLandscapeCommandToggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls=/);
  assert.match(h10f, /gridly-landscape-command-handle[\s\S]*height: 44px[\s\S]*min-height: 44px/);
  assert.match(h10f, /gridly-landscape-command-handle::before[\s\S]*width: 54px[\s\S]*height: 24px/);
  assert.match(h10f, /font-size: 21px[\s\S]*font-weight: 800/);
});

test("expanded command is one frame-width overlay with reused Search and four actions", () => {
  for (const id of ["gridlyPortraitBottomRegion", "mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  }
  assert.match(h10b, /gridly-v2-bottom-region[\s\S]*position: fixed/);
  assert.match(h10f, /gridly-v2-bottom-region[\s\S]*left: var\(--lp243h10b-inline-start\)[\s\S]*right: var\(--lp243h10b-inline-end\)/);
  assert.match(h10f, /mobileDestinationCommandPanel[\s\S]*width: calc\(44%/);
  assert.equal((html.match(/id="gridlySettingsDockButton"/g) || []).length, 1);
});

test("KBYG stays a full foreground with Travel Brief first and readable editorial rows", () => {
  assert.equal((html.match(/id="gridlyBriefInteractionPanel"/g) || []).length, 1);
  assert.ok(html.indexOf("gridly-travel-brief") < html.indexOf('id="gridlyPortraitBottomRegion"'));
  assert.match(h10b, /gridly-h9-brief-foreground[\s\S]*position: fixed !important[\s\S]*width: 100vw !important[\s\S]*height: 100dvh !important/);
  assert.match(h10f, /grid-template-columns: clamp\(144px, 21vw, 184px\) minmax\(0, 1fr\)/);
  assert.match(h10f, /font-size: 0\.9rem[\s\S]*font-size: 0\.98rem[\s\S]*font-size: 0\.75rem/);
  assert.doesNotMatch(h10f, /gridly-brief-weather[^}]*border-radius|gridly-brief-weather[^}]*box-shadow/);
});

test("Search, V2, Leaflet, feature, and data authorities remain untouched", () => {
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.match(html, /styles\.css\?v=243h10j-foreground-ownership-closure/);
  assert.match(html, /app\.js\?v=243h10i-search-tray-containment/);
  assert.match(app, /H10B always returns[\s\S]*gridlyLandscapeCommandExpanded = false[\s\S]*syncGridlyLandscapeCommandPanel/);
  assert.doesNotMatch(h10f, /fetch\(|Supabase|DriveTexas|Home Area|Awareness Area|addEventListener|setView\(|zoomIn\(|zoomOut\(|leaflet/i);
});
