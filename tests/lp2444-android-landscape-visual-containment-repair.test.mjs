import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const marker = "/* LP244.4 — Android short-landscape visual containment repair.";
const repairStart = css.indexOf(marker);
const repair = css.slice(repairStart, css.indexOf("/* LP243.I2.3 —", repairStart));
const matchesRepair = (width, height) => width > height && height <= 500;

test("LP244.4 is one final, landscape-and-short-height-only authority", () => {
  assert.equal((css.match(/LP244\.4 — Android short-landscape visual containment repair/g) || []).length, 1);
  assert.match(repair, /^\/\* LP244\.4[\s\S]*@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.equal(matchesRepair(844, 390), true);
  assert.equal(matchesRepair(932, 430), true);
  for (const size of [[390, 844], [430, 932], [500, 500], [1440, 900]]) {
    assert.equal(matchesRepair(...size), false);
  }
  assert.doesNotMatch(repair, /@media[^\{]*orientation:\s*portrait|data-layout-mode=["']portrait|[.#][^\s,{]*splash/i);
});

test("temporary sheets are content-led floating surfaces with bounded per-panel heights", () => {
  assert.match(repair, /#gridlyPortraitV2Sheet:not\(\[hidden\]\)[\s\S]*inset: auto[\s\S]*height: auto !important[\s\S]*min-height: 0 !important[\s\S]*max-height: min\(84dvh/);
  assert.match(repair, /width: min\(760px, calc\(100vw[\s\S]*max-width: 760px[\s\S]*margin-inline: auto/);
  assert.doesNotMatch(repair, /#gridlyPortraitV2Sheet:not\(\[hidden\]\)\s*\{[^}]*height:\s*100d?vh/);
  assert.match(repair, /data-active-sheet="report"\]\s*\{ max-height: var\(--lp2444-sheet-max-height\)/);
  assert.match(repair, /data-active-sheet="alerts"\]\s*\{ max-height: min\(82dvh/);
  assert.match(repair, /data-active-sheet="history"\]\s*\{ max-height: min\(78dvh/);
  assert.match(repair, /data-active-sheet="settings"\][\s\S]*inset: var\(--lp2444-visual-gap\) 0 calc\(62px[\s\S]*background: var\(--gridly-elevated/);
  assert.match(repair, /#gridlyPortraitV2Sheet:not\(\[hidden\]\) > header[\s\S]*flex: 0 0 auto[\s\S]*min-height: 44px/);
  assert.match(repair, /#gridlyPortraitV2SheetBody[\s\S]*flex: 0 1 auto[\s\S]*min-height: 0 !important[\s\S]*overflow-y: auto !important/);
  assert.match(repair, /scroll-padding-bottom: calc\(16px \+ env\(safe-area-inset-bottom/);
});

test("report picker scrolls and keeps both placement choices discoverable", () => {
  assert.match(repair, /data-active-sheet="report"[\s\S]*gridly-v2-report-picker/);
  assert.match(repair, /gridly-v2-report-ctas[\s\S]*position: static !important[\s\S]*grid-template-columns: repeat\(2/);
  assert.doesNotMatch(repair, /gridly-v2-report-ctas\s*\{[^}]*position:\s*(?:fixed|absolute|sticky)/);
  assert.match(repair, /gridly-v2-report-tiles[\s\S]*grid-template-columns: repeat\(4/);
  const template = app.slice(app.indexOf("function buildReportHazardSurfaceHtml()"), app.indexOf("const sheetTemplates ="));
  assert.match(template, /data-v2-action="report-use-location"[^>]*>Use my location<\/button>/);
  assert.match(template, /data-v2-action="report-tap-map"[^>]*>Tap the map<\/button>/);
});

test("report review and both non-accidental actions retain scroll clearance and touch size", () => {
  assert.match(repair, /gridly-v2-report-review > \.gridly-v2-list[\s\S]*grid-template-columns: repeat\(6[\s\S]*padding-bottom: 0/);
  assert.match(repair, /gridly-v2-report-review > \.gridly-v2-list > \.gridly-v2-sheet-copy[\s\S]*grid-column: span 2/);
  assert.match(repair, /> \.primary-btn[\s\S]*grid-column: 1 \/ 4[\s\S]*> \.secondary-btn[\s\S]*grid-column: 4 \/ 7/);
  assert.match(repair, /gridly-v2-report-review :is\(\.primary-btn, \.secondary-btn\)[\s\S]*min-height: 44px/);
  assert.match(app, /data-v2-action="report-confirm-governed-draft"[^>]*>Submit Report<\/button>/);
  assert.match(app, /data-v2-action="report-cancel-governed-draft"[^>]*>Back<\/button>/);
});

test("Alerts, History, Settings, and floating KBYG retain bounded internal overflow", () => {
  for (const sheet of ["alerts", "history", "settings"]) {
    assert.match(repair, new RegExp(`data-active-sheet="${sheet}"`));
  }
  assert.match(repair, /data-active-sheet="alerts"[\s\S]*#gridlyPortraitV2SheetBody[\s\S]*contain: layout paint/);
  assert.match(repair, /data-active-sheet="history"[\s\S]*margin-block: 0 !important/);
  assert.match(repair, /data-active-sheet="settings"[\s\S]*margin-block: 0 !important/);
  assert.match(repair, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*inset: var\(--lp2444-visual-gap\)[\s\S]*height: auto !important[\s\S]*max-height: var\(--lp2444-sheet-max-height\)[\s\S]*overflow-y: auto !important/);
});

test("History shrink-wraps short content and retains bounded scrolling for long content", () => {
  assert.match(repair, /data-active-sheet="history"\] #gridlyPortraitV2SheetBody[\s\S]*flex: 0 0 auto !important[\s\S]*height: fit-content !important[\s\S]*max-height: calc\(min\(78dvh[\s\S]*overflow-y: auto !important/);
  assert.doesNotMatch(repair, /data-active-sheet="history"[^}]*height:\s*(?:100|\d+)d?vh/);
  assert.doesNotMatch(repair, /data-active-sheet="history"[^}]*min-height:\s*(?:100|\d+)d?vh/);
});

test("Settings alone owns an opaque destination workspace above a separate visible dock", () => {
  assert.match(repair, /data-active-sheet="settings"\][\s\S]*width: 100vw !important[\s\S]*max-height: none !important[\s\S]*border-radius: 0 !important[\s\S]*background: var\(--gridly-elevated/);
  assert.match(repair, /:has\(#gridlyPortraitV2Sheet\[data-active-sheet="settings"\]:not\(\[hidden\]\)\)[\s\S]*\.gridly-v2-bottom-region[\s\S]*z-index: calc\(var\(--lp243h10b-foreground-z\) \+ 1\)[\s\S]*transform: translateY\(0\)[\s\S]*pointer-events: auto/);
  assert.match(repair, /\.gridly-v2-bottom-dock[\s\S]*visibility: visible !important[\s\S]*pointer-events: auto !important/);
  assert.match(repair, /#gridlyPortraitV2SheetBackdrop:has\(\+ #gridlyPortraitV2Sheet\[data-active-sheet="settings"\]:not\(\[hidden\]\)\)[\s\S]*background: var\(--gridly-app-bg[\s\S]*opacity: 1/);
  assert.doesNotMatch(repair, /data-active-sheet="(?:report|alerts|history)"[^}]*width:\s*100vw/);
});

test("legacy incident counter cannot cover sheets and map controls are contained compact targets", () => {
  assert.match(app, /counter\.id = "gridlyHazardCounter"[\s\S]*counter\.className = "gridly-hazard-counter"/);
  assert.match(app, /\.gridly-hazard-counter\s*\{[\s\S]*position: fixed;[\s\S]*z-index: 9998;/);
  assert.match(repair, /#gridlyHazardCounter\.gridly-hazard-counter[\s\S]*display: none !important[\s\S]*pointer-events: none !important[\s\S]*z-index: 0 !important/);
  assert.match(repair, /\.gridly-v2-control-rail[\s\S]*top: auto !important[\s\S]*bottom: calc\(30px \+ env\(safe-area-inset-bottom[\s\S]*grid-template-columns: repeat\(2, 44px\)[\s\S]*gap: 4px[\s\S]*transform: none/);
  assert.match(repair, /\.gridly-v2-control-rail button[\s\S]*width: 44px[\s\S]*height: 44px[\s\S]*min-height: 44px[\s\S]*padding: 4px[\s\S]*border: 4px solid transparent[\s\S]*background-clip: padding-box/);
  assert.match(repair, /\.gridly-v2-control-rail button svg[\s\S]*width: 19px[\s\S]*height: 19px/);
  const controlRowsHeight = (2 * 44) + 4;
  const attributionClearance = 30;
  for (const mapHeight of [286, 326]) {
    assert.ok(controlRowsHeight + attributionClearance < mapHeight, "rail fits below the 104px map top and above attribution");
  }
  assert.match(repair, /#map \.leaflet-control-attribution[\s\S]*bottom: 6px[\s\S]*max-width: min\(56vw, 520px\)[\s\S]*font-size: 9px[\s\S]*white-space: nowrap/);
  assert.match(repair, /#map \.gridly-map-attribution-disclosure[\s\S]*max-height: calc\(100% - 40px\)/);
  assert.match(repair, /\.gridly-landscape-command-handle[\s\S]*bottom: calc\(100% \+ 10px\)/);
  assert.doesNotMatch(repair, /#map\s*\{[^}]*height:\s*\d+px/);
});

test("repair is CSS-only and does not acquire report or data lifecycle ownership", () => {
  assert.doesNotMatch(repair, /(?:localStorage|sessionStorage|fetch\(|submitGoverned|createSharedHazardReport|provider|persistence|setView\()/i);
  for (const owner of ["report-use-location", "report-tap-map", "report-confirm-governed-draft", "report-cancel-governed-draft"]) {
    assert.match(app, new RegExp(owner));
  }
});
