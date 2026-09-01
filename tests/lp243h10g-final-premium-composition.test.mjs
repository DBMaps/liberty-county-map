import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h10bStart = css.indexOf("/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY");
const h10gStart = css.indexOf("/* LP243.H10G — final premium composition correction", h10bStart);
const h10b = css.slice(h10bStart, css.indexOf("/* LP243.H10C", h10bStart));
const h10g = css.slice(h10gStart, css.indexOf("\n}", h10gStart));
const matches = (width, height) => width > height && height <= 500;

test("H10G is short-landscape only and preserves H10B structure", () => {
  assert.ok(h10bStart >= 0 && h10gStart > h10bStart);
  assert.match(css.slice(h10bStart, h10gStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.equal(matches(932, 430), true);
  assert.equal(matches(844, 390), true);
  for (const size of [[320, 700], [390, 844], [430, 932], [1440, 900]]) assert.equal(matches(...size), false);
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.match(h10b, /transform: translateY\(100%\)/);
  assert.doesNotMatch(h10g, /grid-template-rows|#map\s*\{[^}]*flex|transform:\s*scale\(/);
});

test("the existing disclosure is frame-centred without a corrective offset", () => {
  assert.equal((html.match(/id="gridlyLandscapeCommandToggle"/g) || []).length, 1);
  assert.match(h10g, /#gridlyLandscapeCommandToggle[\s\S]*left: calc\(\(100vw - var\(--lp243h10b-inline-start\) - var\(--lp243h10b-inline-end\)\) \/ 2\)/);
  assert.doesNotMatch(h10g, /translateX\([^)]*[-+]\s*\d|margin-left|left:\s*calc\([^)]*[+-]\s*\d+px/);
  assert.match(css.slice(css.indexOf("/* LP243.H10F"), h10gStart), /gridly-landscape-command-handle[\s\S]*height: 44px[\s\S]*min-height: 44px/);
  assert.match(css.slice(css.indexOf("/* LP243.H10F"), h10gStart), /gridly-landscape-command-handle::before[\s\S]*width: 54px[\s\S]*height: 24px/);
});

test("one full-frame overlay reuses Location Context, Search, and four actions", () => {
  for (const id of ["gridlyPortraitBottomRegion", "mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  }
  assert.match(h10b, /gridly-v2-bottom-region[\s\S]*position: fixed/);
  assert.match(h10g, /gridly-v2-bottom-region[\s\S]*width: auto !important[\s\S]*bottom-dock[\s\S]*right: 0 !important/);
  assert.equal((html.match(/id="gridlySettingsDockButton"/g) || []).length, 1);
  assert.match(h10g, /control-rail[\s\S]*bottom: calc\(var\(--lp243h10b-command-height\) \+ 12px/);
});

test("KBYG is a centred premium sheet with a dark integrated header", () => {
  for (const id of ["gridlyBriefFoundationHandle", "gridlyBriefInteractionPanel"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  assert.match(h10g, /--lp243h10g-sheet-width: 90vw/);
  assert.match(h10g, /--lp243h10g-sheet-height: 83dvh/);
  assert.match(h10g, /gridly-brief-interaction-panel[\s\S]*inset: var\(--lp243h10g-sheet-block\) var\(--lp243h10g-sheet-inline\)[\s\S]*border-radius: var\(--lp243h10e-radius\)/);
  assert.match(h10g, /gridly-brief-foundation-handle[\s\S]*background: var\(--gridly-elevated\)[\s\S]*gridly-brief-foundation-handle-icon[\s\S]*color: var\(--gridly-accent/);
  assert.doesNotMatch(h10g, /width:\s*100vw|height:\s*100dvh|background:\s*var\(--gridly-accent/);
});

test("H10F editorial hierarchy and KBYG subordination remain intact", () => {
  const h10f = css.slice(css.indexOf("/* LP243.H10F"), h10gStart);
  assert.ok(html.indexOf("TRAVEL BRIEF") < html.indexOf('id="gridlyPortraitBottomRegion"'));
  assert.match(h10f, /grid-template-columns: clamp\(144px, 21vw, 184px\) minmax\(0, 1fr\)/);
  assert.match(h10f, /font-size: 0\.9rem[\s\S]*font-size: 0\.98rem[\s\S]*font-size: 0\.75rem/);
  assert.match(h10g, /gridly-h9-brief-foreground::before[\s\S]*pointer-events: auto/);
  assert.match(css.slice(h10bStart, h10gStart), /gridly-h9-brief-foreground[\s\S]*#gridlyLandscapeCommandToggle[\s\S]*display: none !important/);
});

test("Search, V2 sheet, Leaflet, and feature/data authorities are untouched", () => {
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.match(app, /H10B always returns[\s\S]*gridlyLandscapeCommandExpanded = false[\s\S]*syncGridlyLandscapeCommandPanel/);
  assert.doesNotMatch(h10g, /fetch\(|Supabase|DriveTexas|addEventListener|setView\(|zoomIn\(|zoomOut\(|leaflet/i);
  assert.doesNotMatch(h10g, /gridlySearchShell|gridlyPortraitV2Sheet/);
});
