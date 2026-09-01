import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h10bMarker = "/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY";
const h10cMarker = "/* LP243.H10C — presentation-only refinement";
const h10eMarker = "/* LP243.H10E — Option A premium landscape visual system";
const authority = css.slice(css.indexOf(h10bMarker));
const h10c = css.slice(css.indexOf(h10cMarker), css.indexOf(h10eMarker));
const matches = (width, height) => width > height && height <= 500;

test("H10C is confined to the frozen short-landscape authority", () => {
  assert.match(authority, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*LP243\.H10C/);
  assert.equal(matches(844, 390), true);
  assert.equal(matches(932, 430), true);
  for (const size of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matches(...size), false);
});

test("H10B grid, zero reserve, and overlay architecture stay frozen", () => {
  assert.match(authority, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(authority, /gridly-v2-bottom-region[\s\S]*position: fixed[\s\S]*translateY\(100%\)/);
  assert.match(authority, /gridly-h8-command-expanded[\s\S]*gridly-v2-bottom-region[\s\S]*translateY\(0\)/);
  assert.doesNotMatch(h10c, /grid-template-rows|app-shell[\s\S]{0,120}padding-bottom|transform:\s*scale\(/);
});

test("the refined disclosure has a smaller visual tab inside its 44px target", () => {
  assert.match(h10c, /gridly-landscape-command-handle \{[\s\S]*height: 44px[\s\S]*background: transparent/);
  assert.match(h10c, /gridly-landscape-command-handle::before[\s\S]*width: 38px[\s\S]*height: 18px/);
  assert.match(authority, /gridly-landscape-command-handle[\s\S]*pointer-events: auto/);
  assert.equal((html.match(/id="gridlyLandscapeCommandToggle"/g) || []).length, 1);
});

test("disclosure audit and fail-open lifecycle are unchanged", () => {
  for (const token of ["insideViewport", "hitTestPass", "pointerEvents", "lp243h10bBound"]) assert.match(app, new RegExp(token));
  assert.match(app, /classList\.toggle\("gridly-h9-command-fail-open", shortLandscape && !disclosureReady\)/);
});

test("one compact command surface reuses Location Context, Search, and dock owners", () => {
  assert.match(h10c, /gridly-v2-bottom-region[\s\S]*border-radius: 14px 14px 0 0/);
  assert.match(h10c, /mobile-destination-command[\s\S]*padding:[^;]*54px/);
  assert.match(h10c, /gridly-v2-control-rail[\s\S]*top: calc\(var\(--lp243h10b-top-height\) \+ 2px\)/);
  for (const id of ["mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  }
});

test("KBYG reuses its handle as a reachable integrated header and uses landscape width", () => {
  assert.equal((html.match(/id="gridlyBriefFoundationHandle"/g) || []).length, 1);
  assert.match(authority, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*position: fixed[\s\S]*width: 100vw[\s\S]*overflow-y: auto/);
  assert.match(h10c, /gridly-brief-foundation-handle[\s\S]*position:[^;]*fixed[\s\S]*width: 100vw[\s\S]*border-radius: 0/);
  assert.match(h10c, /gridly-travel-brief-item[\s\S]*grid-template-columns: minmax\(116px, 22%\) minmax\(0, 1fr\)/);
  assert.match(h10c, /gridly-travel-brief-list[\s\S]*overflow-x: hidden/);
  assert.doesNotMatch(authority, /720px|transform:\s*scale\(/);
});

test("Search, V2 sheets, Leaflet identity, and feature authority remain untouched", () => {
  assert.match(authority, /#gridlySearchShell:not\(\[hidden\]\),[\s\S]*#gridlyPortraitV2Sheet:not\(\[hidden\]\)/);
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.doesNotMatch(h10c, /fetch\(|Supabase|setView\(|appendChild|replaceChildren|Home Area|Awareness Area|DriveTexas/);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=243h10i-search-tray-containment/);
});
