import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h10bMarker = "/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY";
const h10cMarker = "/* LP243.H10C — presentation-only refinement";
const h10dMarker = "/* LP243.H10D — premium foreground cleanup only";
const h10eMarker = "/* LP243.H10E — Option A premium landscape visual system";
const authority = css.slice(css.indexOf(h10bMarker));
const h10b = css.slice(css.indexOf(h10bMarker), css.indexOf(h10cMarker));
const h10c = css.slice(css.indexOf(h10cMarker), css.indexOf(h10dMarker));
const h10d = css.slice(css.indexOf(h10dMarker), css.indexOf(h10eMarker));
const matches = (width, height) => width > height && height <= 500;

test("H10D matches only 844x390 and 932x430 short landscape controls", () => {
  assert.match(authority, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*LP243\.H10D/);
  assert.equal(matches(844, 390), true);
  assert.equal(matches(932, 430), true);
  for (const size of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matches(...size), false);
});

test("H10B grid and H10C collapsed zero-reserve geometry are untouched", () => {
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /gridly-v2-bottom-region[\s\S]*position: fixed[\s\S]*translateY\(100%\)/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.match(h10c, /gridly-landscape-command-handle \{[\s\S]*height: 44px/);
  assert.doesNotMatch(h10d, /grid-template-rows|app-shell|translateY\(100%\)|gridly-landscape-command-handle::before/);
});

test("expanded command remains one overlay surface with its existing Search and action owners", () => {
  assert.match(h10d, /gridly-h8-command-expanded[\s\S]*gridly-v2-bottom-region[\s\S]*padding-inline: 6px/);
  assert.match(h10d, /#mobileDestinationCommandPanel[\s\S]*border: 0[\s\S]*background: transparent/);
  assert.match(h10c, /gridly-v2-bottom-dock[\s\S]*border-top: 1px solid var\(--gridly-border-neutral\)/);
  assert.match(h10b, /gridly-h8-command-expanded[\s\S]*mobile-destination-command[\s\S]*position: fixed/);
  for (const id of ["mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
});

test("the existing map rail separates from only expanded or fail-open command state", () => {
  assert.match(h10d, /:is\(\.gridly-h8-command-expanded, \.gridly-h9-command-fail-open\)[\s\S]*\.gridly-v2-control-rail[\s\S]*top: auto[\s\S]*bottom: calc\(var\(--lp243h10b-command-height\) \+ 8px/);
  assert.doesNotMatch(h10d, /addEventListener|data-v2-control|setView\(|zoomIn\(|zoomOut\(/);
});

test("KBYG alone owns the full workspace and suppresses all underlying chrome", () => {
  assert.match(h10b, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*position: fixed[\s\S]*inset: 0[\s\S]*overflow-y: auto/);
  for (const selector of ["gridly-v2-topbar", "gridly-v2-segments", "gridly-v2-control-rail", "#gridlyLandscapeCommandToggle", "#gridlyLandscapeCommandPanel", "#mobileDestinationCommandPanel", "#gridlyPortraitBottomRegion", "gridly-v2-bottom-dock"]) assert.match(h10d, new RegExp(selector.replaceAll(".", "\\.")));
  assert.match(h10d, /display: none !important;[\s\S]*visibility: hidden !important;[\s\S]*pointer-events: none !important/);
});

test("KBYG keeps its existing integrated header and internal scrolling lifecycle", () => {
  assert.equal((html.match(/id="gridlyBriefFoundationHandle"/g) || []).length, 1);
  assert.equal((html.match(/id="gridlyBriefInteractionPanel"/g) || []).length, 1);
  assert.match(h10c, /gridly-brief-foundation-handle[\s\S]*position: fixed[\s\S]*width: 100vw/);
  assert.match(h10b, /gridly-brief-interaction-panel[\s\S]*overflow-y: auto[\s\S]*overscroll-behavior: contain/);
  assert.match(app, /H10B always returns[\s\S]*gridlyLandscapeCommandExpanded = false[\s\S]*syncGridlyLandscapeCommandPanel/);
});

test("Travel Brief is first, greeting hero is suppressed, and Weather uses a full-width row", () => {
  assert.match(h10d, /\.gridly-travel-brief \{[\s\S]*order: 1[\s\S]*width: 100%/);
  assert.match(h10d, /\.gridly-brief-hero \{[\s\S]*order: 2/);
  assert.match(h10d, /\.gridly-brief-identity \{[\s\S]*display: none !important/);
  assert.match(h10d, /\.gridly-brief-weather:not\(\[hidden\]\)[\s\S]*grid-template-columns: minmax\(116px, 22%\) minmax\(0, 1fr\)[\s\S]*width: 100% !important[\s\S]*max-width: none !important/);
  assert.match(h10d, /gridly-brief-weather-label[\s\S]*grid-column: 1/);
  assert.match(h10d, /gridly-brief-weather-summary[\s\S]*grid-column: 2/);
  assert.match(h10c, /gridly-travel-brief-item[\s\S]*grid-template-columns: minmax\(116px, 22%\) minmax\(0, 1fr\)/);
  assert.match(h10c, /gridly-travel-brief-list[\s\S]*overflow-x: hidden/);
});

test("Search, sheets, Leaflet, data authority, and asset identity remain protected", () => {
  assert.match(h10b, /#gridlySearchShell:not\(\[hidden\]\),[\s\S]*#gridlyPortraitV2Sheet:not\(\[hidden\]\)/);
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility|243i21s1-imagery-only-satellite)/);
  assert.doesNotMatch(h10d, /fetch\(|Supabase|Home Area|Awareness Area|DriveTexas|appendChild|replaceChildren|transform:\s*scale\(/);
});
