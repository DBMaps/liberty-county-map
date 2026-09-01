import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP243.H10B FINAL SHORT-LANDSCAPE AUTHORITY";
const h10b = css.slice(css.indexOf(marker), css.indexOf("/* LP243.H10C — presentation-only refinement"));
const lifecycle = app.slice(app.indexOf("// LP243.H8 is presentation-local"), app.indexOf("const MOBILE_REPORT_ENTRY_SELECTORS"));
const matches = (width, height) => width > height && height <= 500;

test("one final authority has the exact short-landscape boundary", () => {
  assert.equal((css.match(/LP243\.H10B FINAL SHORT-LANDSCAPE AUTHORITY/g) || []).length, 1);
  assert.match(h10b, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.equal(matches(844, 390), true); assert.equal(matches(932, 430), true);
  for (const size of [[320,700], [390,844], [430,932], [1440,900]]) assert.equal(matches(...size), false);
});

test("collapsed command is a zero-reserve, reachable overlay", () => {
  assert.match(h10b, /app-shell\.premium-layout[\s\S]*?padding: 0 var\(--lp243h10b-inline-end\) 0 var\(--lp243h10b-inline-start\)/);
  assert.match(h10b, /gridly-v2-bottom-region[\s\S]*?position: fixed[\s\S]*?transform: translateY\(100%\)/);
  assert.match(h10b, /gridly-landscape-command-handle[\s\S]*?height: 44px[\s\S]*?pointer-events: auto/);
  assert.match(h10b, /bottom-dock,[\s\S]*?mobile-destination-command[\s\S]*?visibility: hidden[\s\S]*?pointer-events: none/);
  assert.doesNotMatch(h10b, /padding-bottom|grid-template-rows:[^;]*(?:command|dock|handle)|126px|128px/);
});

test("runtime disclosure validates the single native owner and fail-open is recovery only", () => {
  assert.equal((html.match(/id="gridlyLandscapeCommandToggle"/g) || []).length, 1);
  assert.match(html, /<button[^>]*id="gridlyLandscapeCommandToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileDestinationCommandPanel gridlyLandscapeCommandPanel"/);
  for (const token of ["insideViewport", "hitTestPass", "pointerEvents", "lp243h10bBound"]) assert.match(lifecycle, new RegExp(token));
  assert.match(lifecycle, /classList\.toggle\("gridly-h9-command-fail-open", shortLandscape && !disclosureReady\)/);
  assert.doesNotMatch(h10b, /gridly-h9-command-fail-open[^\{]*\{[^}]*display:\s*block/);
});

test("expanded workspace overlays without changing map geometry or owners", () => {
  assert.match(h10b, /gridly-h8-command-expanded[\s\S]*?gridly-v2-bottom-region[\s\S]*?translateY\(0\)/);
  assert.match(h10b, /gridly-h8-command-expanded[\s\S]*?mobile-destination-command[\s\S]*?position: fixed/);
  for (const id of ["mobileDestinationCommandPanel", "mobileDestinationCommandBtn", "gridlyLandscapeCommandPanel", "gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  assert.doesNotMatch(h10b, /gridly-h8-command-expanded[^\{]*\.app-shell/);
});

test("map receives flexible remainder and Leaflet identity is untouched", () => {
  assert.match(h10b, /grid-template-rows: var\(--lp243h10b-top-height\) minmax\(0, 1fr\)/);
  assert.match(h10b, /:is\(\.main-column, #mapSection\.command-center, \.map-card, \.map-frame, #map\)[\s\S]*?min-height: 0/);
  assert.match(h10b, /#map \{ flex: 1 1 0; \}/);
  assert.equal((html.match(/id="map"/g) || []).length, 1);
  assert.doesNotMatch(h10b + lifecycle, /transform:\s*scale\(|\.setView\(|(?:appendChild|replaceChildren)\([^)]*map/);
});

test("KBYG is a full foreground workspace and closes to collapsed", () => {
  assert.match(h10b, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*?position: fixed[\s\S]*?inset: 0[\s\S]*?width: 100vw[\s\S]*?max-width: none[\s\S]*?height: 100dvh[\s\S]*?overflow-y: auto/);
  assert.doesNotMatch(h10b, /720px/);
  assert.match(h10b, /gridly-h9-brief-foreground[\s\S]*?:is\(\.gridly-v2-topbar,[\s\S]*?visibility: hidden[\s\S]*?pointer-events: none/);
  assert.match(app, /H10B always returns[\s\S]*?gridlyLandscapeCommandExpanded = false[\s\S]*?syncGridlyLandscapeCommandPanel/);
});

test("Search and V2 sheets retain foreground lifecycle and internal scrolling", () => {
  assert.match(h10b, /#gridlySearchShell:not\(\[hidden\]\),[\s\S]*?#gridlyPortraitV2Sheet:not\(\[hidden\]\)[\s\S]*?position: fixed/);
  assert.match(h10b, /gridly-search-card,[\s\S]*?#gridlyPortraitV2SheetBody[\s\S]*?overflow-y: auto/);
  assert.match(app, /openGridlyDestinationSearchSurface/);
});

test("ownership, legacy suppression, protected authority, and rotation locality remain", () => {
  assert.match(css, /LP243\.H4 — current consumer-presentation ownership[\s\S]*?:is\(\.mobile-bottom-nav, #gridlyHazardLauncher\)/);
  assert.match(app, /let activeLayoutMode = "portrait"/);
  assert.match(lifecycle, /if \(!shortLandscape \|\| options\.entering === true\) gridlyLandscapeCommandExpanded = false/);
  assert.doesNotMatch(lifecycle, /localStorage|sessionStorage|fetch\(|Supabase|setView\(/);
  assert.doesNotMatch(h10b, /Home Area|Awareness Area|DriveTexas|coordinates|markers|layers/);
});

test("H5-H9 rejected geometry is documented as superseded, not final", () => {
  assert.match(css, /LP243\.H5-H9 — short-landscape geometry superseded/);
  assert.doesNotMatch(h10b, /--lp243h[56789]-(?:map-top-reserve|map-bottom-reserve|panel-height)|min\(720px/);
  assert.match(html, /styles\.css\?v=243h10l-landscape-status-composition/);
  assert.match(html, /app\.js\?v=243h10i-search-tray-containment/);
});
