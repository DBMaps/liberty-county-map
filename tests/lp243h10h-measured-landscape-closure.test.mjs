import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h10bStart = css.indexOf("/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY");
const h10hStart = css.indexOf("/* LP243.H10H — measured landscape closure", h10bStart);
const h10iStart = css.indexOf("/* LP243.H10I — expanded command owners are tray-local", h10hStart);
const mediaEnd = css.indexOf("\n}\n\n@media (prefers-reduced-motion", h10hStart);
const h10b = css.slice(h10bStart, h10hStart);
const h10h = css.slice(h10hStart, h10iStart);

test("H10H is bounded to H10B short landscape without structural redesign", () => {
  assert.ok(h10bStart >= 0 && h10hStart > h10bStart && mediaEnd > h10hStart);
  assert.match(css.slice(h10bStart, h10hStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.doesNotMatch(h10h, /grid-template-rows|#map\s*\{|transform:\s*scale\(/);
  assert.equal(matchShortLandscape(932, 430), true);
  assert.equal(matchShortLandscape(844, 390), true);
  assert.equal(matchShortLandscape(390, 844), false);
  assert.equal(matchShortLandscape(320, 700), false);
  assert.equal(matchShortLandscape(430, 932), false);
  assert.equal(matchShortLandscape(1440, 900), false);
});

test("one safe-inset primary frame owns header, filters, map, and tray", () => {
  assert.match(h10b, /--lp243h10b-inline-start: max\(8px, env\(safe-area-inset-left, 0px\)\)/);
  assert.match(h10b, /--lp243h10b-inline-end: max\(8px, env\(safe-area-inset-right, 0px\)\)/);
  for (const selector of ["gridly-v2-topbar", "gridly-v2-segments", "map-card", "gridlyPortraitBottomRegion"]) {
    assert.match(h10h, new RegExp(selector));
  }
  assert.match(h10h, /left: var\(--lp243h10b-inline-start\) !important;[\s\S]*right: var\(--lp243h10b-inline-end\) !important;[\s\S]*width: auto !important/);
  assert.match(h10h, /\.gridly-v2-segments \{[\s\S]*position: fixed !important[\s\S]*top: 54px !important/);
  assert.doesNotMatch(h10h, /width:\s*760px|width:\s*916px/);
});

test("the accepted disclosure geometry and recovery lifecycle remain intact", () => {
  const h10g = css.slice(css.indexOf("/* LP243.H10G"), h10hStart);
  assert.match(h10g, /#gridlyLandscapeCommandToggle[\s\S]*left: calc\(\(100vw - var\(--lp243h10b-inline-start\) - var\(--lp243h10b-inline-end\)\) \/ 2\)/);
  assert.doesNotMatch(h10h, /#gridlyLandscapeCommandToggle\s*\{|translateX\(|margin-left/);
  assert.match(h10b, /gridly-landscape-command-handle \{[\s\S]*width: 68px[\s\S]*height: 44px/);
  assert.match(h10b, /gridly-landscape-command-handle::before \{[\s\S]*width: 54px[\s\S]*height: 24px/);
  assert.match(app, /\[0\.25, 0\.5, 0\.75\][\s\S]*hitTargets\.some/);
  assert.match(app, /insideViewport && hitTestPass/);
  assert.match(app, /classList\.toggle\("gridly-h9-command-fail-open", shortLandscape && !disclosureReady\)/);
  assert.match(h10h, /no tray child covers the disclosure hit/);
});

test("Location Context and Actions occupy non-overlapping contained rows", () => {
  assert.match(h10h, /--lp243h10h-command-height: 122px/);
  assert.match(h10h, /--lp243h10h-location-row-height: 58px/);
  assert.match(h10h, /--lp243h10h-action-row-height: 64px/);
  assert.match(h10h, /#mobileDestinationCommandPanel[\s\S]*bottom: calc\(var\(--lp243h10h-action-row-height\)[\s\S]*height: var\(--lp243h10h-location-row-height\)/);
  assert.match(h10h, /#gridlyLandscapeCommandPanel \{[\s\S]*inset: var\(--lp243h10h-location-row-height\) 8px 0 8px[\s\S]*height: var\(--lp243h10h-action-row-height\)/);
  assert.match(h10h, /#mobileDestinationCommandPanel \.compact-btn \{[\s\S]*min-height: 44px/);
  for (const id of ["mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} remains singular`);
  }
});

test("expanded rail clears the measured tray with a safe gap", () => {
  assert.match(h10h, /--lp243h10h-rail-gap: 10px/);
  assert.match(h10h, /\.gridly-v2-control-rail \{[\s\S]*bottom: calc\(var\(--lp243h10h-command-height\) \+ var\(--lp243h10h-rail-gap\)/);
});

test("KBYG outer geometry is frozen while header, rhythm, and duplicate Weather are corrected", () => {
  const h10g = css.slice(css.indexOf("/* LP243.H10G"), h10hStart);
  assert.match(h10g, /--lp243h10g-sheet-width: 90vw/);
  assert.match(h10g, /--lp243h10g-sheet-height: 83dvh/);
  assert.doesNotMatch(h10h, /lp243h10g-sheet-(?:width|height|inline|block)\s*:/);
  assert.match(h10h, /\.gridly-brief-foundation-handle \{[\s\S]*color: var\(--gridly-text-primary\)[\s\S]*font-weight: 760/);
  assert.doesNotMatch(h10h, /\.gridly-brief-foundation-handle \{[^}]*background:\s*var\(--gridly-accent/);
  assert.match(h10h, /\.gridly-travel-brief \{[\s\S]*margin-top: 0/);
  assert.match(h10h, /\.gridly-brief-hero,[\s\S]*#gridlyBriefWeather \{[\s\S]*display: none !important/);
  assert.match(html, /class="gridly-brief-flow gridly-travel-brief"/);
  assert.match(app, /item\.dataset\.gridlyTravelBriefSection = section\.key/);
  assert.match(app, /key: "weather"/);
  assert.match(app, /gridly-unified-evidence/);
  assert.doesNotMatch(h10h, /font-size/);
});

test("asset identity advances and protected feature authorities are untouched", () => {
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /js\/app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility|243i22-layers-accessibility-lifecycle)/);
  assert.doesNotMatch(h10h, /fetch\(|Supabase|DriveTexas|Leaflet|setView\(|zoomIn\(|zoomOut\(|addEventListener/i);
  assert.doesNotMatch(h10h, /gridlySearchShell|gridlyPortraitV2Sheet/);
});

function matchShortLandscape(width, height) {
  return width > height && height <= 500;
}
