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
const mediaEnd = css.indexOf("\n}\n\n@media (prefers-reduced-motion", h10jStart);
const h10b = css.slice(h10bStart, h10hStart);
const h10h = css.slice(h10hStart, h10iStart);
const h10i = css.slice(h10iStart, h10jStart);
const h10j = css.slice(h10jStart, mediaEnd);
const matchesShortLandscape = (width, height) => width > height && height <= 500;

test("H10J is short-landscape-only and leaves structural authorities frozen", () => {
  assert.ok(h10bStart >= 0 && h10hStart > h10bStart && h10iStart > h10hStart && h10jStart > h10iStart && mediaEnd > h10jStart);
  assert.match(css.slice(h10bStart, h10jStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10i, /grid-template-rows: var\(--lp243h10h-location-row-height\) var\(--lp243h10h-action-row-height\)/);
  assert.match(h10h, /--lp243h10h-rail-gap: 10px/);
  assert.doesNotMatch(h10j, /grid-template|--lp243h10h-|#map\s*\{|position:\s*(?:fixed|relative)|inset:/);
  for (const [w, h, expected] of [[932, 430, true], [844, 390, true], [320, 700, false], [390, 844, false], [430, 932, false], [1440, 900, false]]) {
    assert.equal(matchesShortLandscape(w, h), expected);
  }
});

test("Search is the unchanged owner and suppresses all command chrome", () => {
  assert.equal((html.match(/id="gridlySearchShell"/g) || []).length, 1);
  assert.match(h10j, /:has\(#gridlySearchShell:not\(\[hidden\]\)\)[\s\S]*:is\(#gridlyPortraitBottomRegion, #mobileDestinationCommandPanel,[\s\S]*#gridlyLandscapeCommandPanel, #gridlyLandscapeCommandToggle,[\s\S]*\.gridly-v2-bottom-dock\)[\s\S]*display: none !important;[\s\S]*visibility: hidden !important;[\s\S]*pointer-events: none !important/);
  assert.doesNotMatch(h10j, /addEventListener|provider|ranking|fetch\(|closeGridly|openGridly/);
  assert.match(app, /H10B always returns[\s\S]*gridlyLandscapeCommandExpanded = false[\s\S]*syncGridlyLandscapeCommandPanel/);
});

test("KBYG header contrast changes while geometry and body hierarchy stay frozen", () => {
  assert.equal((html.match(/id="gridlyBriefFoundationHandle"/g) || []).length, 1);
  assert.match(h10j, /#gridlyBriefFoundationHandle \{[\s\S]*color: #f7fbff !important;[\s\S]*font-weight: 760/);
  assert.match(h10j, /gridly-brief-foundation-handle-label[\s\S]*color: #f7fbff !important;[\s\S]*opacity: 1 !important/);
  assert.match(h10j, /gridly-brief-foundation-handle-icon[\s\S]*color: var\(--gridly-accent, #28c7c2\) !important;[\s\S]*opacity: 1 !important/);
  assert.match(h10b, /--lp243h10g-sheet-width: 90vw/);
  assert.match(h10b, /width: var\(--lp243h10g-sheet-width\)/);
  assert.match(h10b, /height: var\(--lp243h10g-sheet-height\)/);
  assert.match(css, /#gridlyBriefWeather[\s\S]*display: none !important/);
  for (const retainedCopy of ["Travel Brief", "Weather", "Why Gridly says this"]) assert.match(`${html}\n${app}`, new RegExp(retainedCopy));
  assert.doesNotMatch(h10j, /gridly-travel-brief|gridly-brief-weather|gridly-brief-interaction-panel|background:/);
});

test("legacy footer is presentation-suppressed without identity rewriting", () => {
  assert.match(h10j, /body\[data-layout-mode="portrait"\] \.app-footer \{[\s\S]*display: none !important;[\s\S]*pointer-events: none !important/);
  assert.match(html, /<footer class="app-footer"[^>]*>[\s\S]*Gridly Beta • Liberty County[\s\S]*<\/footer>/);
  assert.doesNotMatch(h10j, /Liberty|Dayton|county|awareness|home/i);
});

test("protected runtime, data, and asset authorities remain unchanged", () => {
  assert.match(app, /window\.gridlyLandscapeCommandDisclosureAudit = gridlyLandscapeCommandDisclosureAudit/);
  assert.match(app, /insideViewport && hitTestPass/);
  assert.match(app, /classList\.toggle\("gridly-h9-command-fail-open", shortLandscape && !disclosureReady\)/);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility|243i21s2-esri-imagery-labels)/);
  assert.doesNotMatch(h10j, /Leaflet|Supabase|DriveTexas|setView\(|zoomIn\(|zoomOut\(|feature|dataset/i);
});
