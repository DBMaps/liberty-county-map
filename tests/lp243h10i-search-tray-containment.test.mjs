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
const mediaEnd = css.indexOf("\n}\n\n@media (prefers-reduced-motion", h10iStart);
const h10b = css.slice(h10bStart, h10hStart);
const h10h = css.slice(h10hStart, h10iStart);
const h10i = css.slice(h10iStart, h10jStart);

function shortLandscape(width, height) { return width > height && height <= 500; }

 test("H10I is short-landscape-only and preserves H10B structure and controls", () => {
  assert.ok(h10bStart >= 0 && h10hStart > h10bStart && h10iStart > h10hStart && mediaEnd > h10iStart);
  assert.match(css.slice(h10bStart, h10hStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.doesNotMatch(h10i, /#map\s*\{|gridlyLandscapeCommandToggle\s*\{/);
  for (const [w, h, expected] of [[932,430,true],[844,390,true],[320,700,false],[390,844,false],[430,932,false],[1440,900,false]]) assert.equal(shortLandscape(w,h), expected);
});

test("the outer tray owns deterministic 58px and 64px local rows", () => {
  assert.match(h10h, /--lp243h10h-command-height: 122px/);
  assert.match(h10i, /#gridlyPortraitBottomRegion \{[\s\S]*display: grid !important;[\s\S]*grid-template-rows: var\(--lp243h10h-location-row-height\) var\(--lp243h10h-action-row-height\)/);
  assert.match(h10i, /#gridlyPortraitBottomRegion > #mobileDestinationCommandPanel \{[\s\S]*position: relative !important;[\s\S]*grid-row: 1;[\s\S]*inset: auto !important;[\s\S]*transform: none !important;[\s\S]*width: 100% !important;[\s\S]*height: var\(--lp243h10h-location-row-height\)/);
  assert.match(h10i, /#gridlyPortraitBottomRegion > #gridlyLandscapeCommandPanel \{[\s\S]*position: relative !important;[\s\S]*grid-row: 2;[\s\S]*inset: auto !important;[\s\S]*width: 100% !important;[\s\S]*height: var\(--lp243h10h-action-row-height\)/);
  assert.doesNotMatch(h10i, /position: fixed|width:\s*760px/);
});

test("Search is contained, tappable, and not covered by either tray surface", () => {
  assert.match(app, /tray\.insertBefore\(locationContext, actionPanel\)/);
  assert.match(h10i, /#mobileDestinationCommandPanel \.compact-btn \{[\s\S]*z-index: 1;[\s\S]*min-height: 44px;[\s\S]*pointer-events: auto/);
  assert.match(h10i, /#mobileDestinationCommandPanel \{[\s\S]*pointer-events: auto/);
  assert.ok(html.indexOf('id="mobileDestinationCommandBtn"') > html.indexOf('id="mobileDestinationCommandPanel"'));
  assert.doesNotMatch(h10i, /overflow:\s*hidden/);
});

test("existing owners remain singular and action/search lifecycles are unchanged", () => {
  for (const id of ["gridlyPortraitBottomRegion","mobileDestinationCommandPanel","mobileDestinationCommandBtn","gridlyLandscapeCommandPanel","gridlyReportDockButton","gridlyAlertsDockButton","gridlyHistoryDockButton","gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} is singular`);
  }
  assert.doesNotMatch(h10i, /addEventListener|gridlySearchShell|gridlyPortraitV2Sheet|fetch\(/);
});

test("collapsed, portrait, and tall-wide restore Location Context to its original owner", () => {
  assert.match(app, /if \(expanded\) \{[\s\S]*tray\.insertBefore\(locationContext, actionPanel\)[\s\S]*return;[\s\S]*parent\.insertBefore\(locationContext, nextSibling\)/);
  assert.match(app, /const expanded = shortLandscape && \(gridlyLandscapeCommandExpanded \|\| !disclosureReady\);[\s\S]*syncGridlyLandscapeTrayLocalOwner\(locationContext, actionPanel, expanded\)/);
  assert.doesNotMatch(h10i, /gridly-brief|Weather|KBYG|font-size|1440|portraitV2Sheet/i);
});

test("disclosure, fail-open recovery, and rail clearance contracts remain", () => {
  assert.match(app, /window\.gridlyLandscapeCommandDisclosureAudit = gridlyLandscapeCommandDisclosureAudit/);
  assert.match(app, /insideViewport && hitTestPass/);
  assert.match(app, /classList\.toggle\("gridly-h9-command-fail-open", shortLandscape && !disclosureReady\)/);
  assert.match(h10h, /--lp243h10h-rail-gap: 10px/);
  assert.match(h10h, /bottom: calc\(var\(--lp243h10h-command-height\) \+ var\(--lp243h10h-rail-gap\)/);
  assert.doesNotMatch(h10i, /gridlyLandscapeCommandToggle/);
});

test("asset identity advances without feature or data authority changes", () => {
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility)/);
  assert.doesNotMatch(h10i, /Supabase|DriveTexas|Leaflet|setView\(|zoomIn\(|zoomOut\(|provider|ranking/i);
  assert.doesNotMatch(app.slice(app.indexOf("// LP243.H10I"), app.indexOf("function gridlyLandscapeCommandDisclosureAudit")), /Supabase|DriveTexas|Leaflet|search|sheet/i);
});
