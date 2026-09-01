import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const h10bStart = css.indexOf("/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY");
const h10lStart = css.indexOf("/* LP243.H10L — complete the existing status composition", h10bStart);
const mediaEnd = css.indexOf("\n}\n\n@media (prefers-reduced-motion", h10lStart);
const h10l = css.slice(h10lStart, mediaEnd);
const shortLandscape = (width, height) => width > height && height <= 500;

test("H10L is confined to the existing short-landscape authority", () => {
  assert.ok(h10bStart >= 0 && h10lStart > h10bStart && mediaEnd > h10lStart);
  assert.match(css.slice(h10bStart, h10lStart), /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  for (const [width, height, expected] of [[932, 430, true], [844, 390, true], [320, 700, false], [390, 844, false], [430, 932, false], [1440, 900, false]]) {
    assert.equal(shortLandscape(width, height), expected);
  }
});

test("existing status, primary, secondary, and trust owners are reused without copy rewriting", () => {
  for (const selector of ["gridly-v2-status-pill", "gridlyV2TopStatusPrimary", "gridlyV2TopStatusSecondary", "gridlyV2TopStatusTrust"]) {
    assert.equal((html.match(new RegExp(`(?:class=["'][^"']*\\b${selector}\\b|id=["']${selector}["'])`, "g")) || []).length, 1);
  }
  assert.doesNotMatch(h10l, /(?:^|\n)\s*content\s*:|Several conditions|Check your route|Community Pulse/);
});

test("primary and secondary form a compact vertically centered group while trust stays hidden", () => {
  assert.match(h10l, /\.gridly-v2-status-pill \{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*justify-content: center;/);
  assert.match(h10l, /#gridlyV2TopStatusPrimary \{[\s\S]*flex: 0 0 auto;/);
  assert.match(h10l, /#gridlyV2TopStatusSecondary \{[\s\S]*display: block !important;[\s\S]*margin-top: 2px;[\s\S]*font-size: 11\.5px !important;[\s\S]*font-weight: 560;[\s\S]*line-height: 1\.15 !important;[\s\S]*opacity: 0\.8;/);
  assert.match(h10l, /#gridlyV2TopStatusTrust \{\s*display: none !important;/);
});

test("frozen header, map, command, action-row, KBYG, Search, and feature authorities are untouched", () => {
  assert.doesNotMatch(h10l, /(?:^|\n)\s*(?:min-|max-)?height\s*:|grid-template|--lp243h10h-|#map\b|gridly-v2-topbar|gridly-v2-segments|gridlyPortraitBottomRegion|mobileDestinationCommand|DockButton|brief-foundation|SearchShell|Leaflet|provider|dataset|feature/i);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=(?:243h10i-search-tray-containment|243i1-shared-v2-sheet-landscape-eligibility|243i21s2-esri-imagery-labels|243i21s2-esri-imagery-labels)/);
});
