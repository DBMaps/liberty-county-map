import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const h10bStart = css.indexOf("/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY");
const h10hStart = css.indexOf("/* LP243.H10H — measured landscape closure", h10bStart);
const h10iStart = css.indexOf("/* LP243.H10I — expanded command owners are tray-local", h10hStart);
const h10jStart = css.indexOf("/* LP243.H10J — foreground ownership closure", h10iStart);
const h10kStart = css.indexOf("/* LP243.H10K — close the measured 17px action-row displacement", h10jStart);
const h10lStart = css.indexOf("/* LP243.H10L — complete the existing status composition", h10kStart);
const mediaEnd = css.indexOf("\n}\n\n@media (prefers-reduced-motion", h10lStart);
const h10b = css.slice(h10bStart, h10hStart);
const h10h = css.slice(h10hStart, h10iStart);
const h10i = css.slice(h10iStart, h10jStart);
const h10j = css.slice(h10jStart, h10kStart);
const h10k = css.slice(h10kStart, h10lStart);
const shortLandscape = (width, height) => width > height && height <= 500;

test("H10K is confined to expanded short landscape", () => {
  assert.ok(h10bStart >= 0 && h10hStart > h10bStart && h10iStart > h10hStart && h10jStart > h10iStart && h10kStart > h10jStart && h10lStart > h10kStart && mediaEnd > h10lStart);
  assert.match(css.slice(h10bStart, h10hStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(h10k, /body\[data-layout-mode="portrait"\]:is\(\.gridly-h8-command-expanded, \.gridly-h9-command-fail-open\)/);
  for (const [width, height, expected] of [[932, 430, true], [844, 390, true], [320, 700, false], [390, 844, false], [430, 932, false], [1440, 900, false]]) {
    assert.equal(shortLandscape(width, height), expected);
  }
});

test("tray-local residues are zero while the 122px 58px 64px architecture is frozen", () => {
  assert.match(h10h, /--lp243h10h-command-height: 122px/);
  assert.match(h10h, /--lp243h10h-location-row-height: 58px/);
  assert.match(h10h, /--lp243h10h-action-row-height: 64px/);
  assert.match(h10i, /grid-template-rows: var\(--lp243h10h-location-row-height\) var\(--lp243h10h-action-row-height\)/);
  assert.match(h10k, /#gridlyPortraitV2 #gridlyPortraitBottomRegion \{\s*gap: 0;\s*row-gap: 0;/);
  assert.match(h10k, /#gridlyPortraitBottomRegion > #mobileDestinationCommandPanel \{\s*margin-bottom: 0;/);
  assert.doesNotMatch(h10k, /height:|min-height:|max-height:|padding:|compact-btn/);
});

test("Search and all four action owners and sizing remain unchanged", () => {
  for (const id of ["mobileDestinationCommandBtn", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} remains singular`);
  }
  assert.match(h10i, /#mobileDestinationCommandPanel \.compact-btn \{[\s\S]*min-height: 44px/);
  assert.doesNotMatch(h10k, /gridlySearchShell|compact-btn|DockButton|addEventListener|onclick|handler/);
  assert.match(html, /app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility)/);
});

test("rail, disclosure, fail-open, KBYG, foreground, and footer authorities are untouched", () => {
  assert.match(h10h, /--lp243h10h-rail-gap: 10px/);
  assert.match(app, /window\.gridlyLandscapeCommandDisclosureAudit = gridlyLandscapeCommandDisclosureAudit/);
  assert.match(app, /insideViewport && hitTestPass/);
  assert.match(app, /classList\.toggle\("gridly-h9-command-fail-open", shortLandscape && !disclosureReady\)/);
  assert.match(h10j, /:has\(#gridlySearchShell:not\(\[hidden\]\)\)/);
  assert.match(h10j, /body\[data-layout-mode="portrait"\] \.app-footer/);
  assert.doesNotMatch(h10k, /rail|disclosure|brief|KBYG|SearchShell|app-footer/i);
});

test("H10K changes no JavaScript, feature, data, or tall-wide authority", () => {
  assert.doesNotMatch(h10k, /script|JavaScript|Supabase|DriveTexas|Leaflet|provider|ranking|dataset|feature|1440/i);
  assert.doesNotMatch(h10k, /gridlyLandscapeCommandToggle|#map\s*\{|gridly-v2-topbar|gridly-v2-segments/);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility)/);
});
