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

test("sheet owns bounded viewport space, a fixed close header, and internal scrolling", () => {
  assert.match(repair, /#gridlyPortraitV2Sheet:not\(\[hidden\]\)[\s\S]*display: flex !important[\s\S]*flex-direction: column[\s\S]*max-height: calc\(100dvh/);
  assert.match(repair, /#gridlyPortraitV2Sheet:not\(\[hidden\]\) > header[\s\S]*flex: 0 0 auto[\s\S]*min-height: 44px/);
  assert.match(repair, /#gridlyPortraitV2SheetBody[\s\S]*flex: 1 1 auto[\s\S]*min-height: 0 !important[\s\S]*overflow-y: auto !important/);
  assert.match(repair, /scroll-padding-bottom: calc\(16px \+ env\(safe-area-inset-bottom/);
});

test("report picker scrolls and keeps both placement choices discoverable", () => {
  assert.match(repair, /data-active-sheet="report"[\s\S]*gridly-v2-report-picker/);
  assert.match(repair, /gridly-v2-report-ctas[\s\S]*position: sticky[\s\S]*bottom:/);
  const template = app.slice(app.indexOf("function buildReportHazardSurfaceHtml()"), app.indexOf("const sheetTemplates ="));
  assert.match(template, /data-v2-action="report-use-location"[^>]*>Use my location<\/button>/);
  assert.match(template, /data-v2-action="report-tap-map"[^>]*>Tap the map<\/button>/);
});

test("report review and both non-accidental actions retain scroll clearance and touch size", () => {
  assert.match(repair, /gridly-v2-report-review > \.gridly-v2-list[\s\S]*padding-bottom: calc\(12px \+ env\(safe-area-inset-bottom/);
  assert.match(repair, /gridly-v2-report-review :is\(\.primary-btn, \.secondary-btn\)[\s\S]*min-height: 44px/);
  assert.match(app, /data-v2-action="report-confirm-governed-draft"[^>]*>Submit Report<\/button>/);
  assert.match(app, /data-v2-action="report-cancel-governed-draft"[^>]*>Back<\/button>/);
});

test("Alerts, History, Settings, and KBYG have bounded short-height containment", () => {
  for (const sheet of ["alerts", "history", "settings"]) {
    assert.match(repair, new RegExp(`data-active-sheet="${sheet}"`));
  }
  assert.match(repair, /data-active-sheet="alerts"[\s\S]*#gridlyPortraitV2SheetBody[\s\S]*contain: layout paint/);
  assert.match(repair, /data-active-sheet="history"[\s\S]*margin-block: 0 !important/);
  assert.match(repair, /data-active-sheet="settings"[\s\S]*margin-block: 0 !important/);
  assert.match(repair, /gridly-brief-interaction-panel\[data-gridly-brief-expanded="true"\][\s\S]*max-height: 100dvh !important[\s\S]*padding-bottom: calc\(16px \+ env\(safe-area-inset-bottom/);
});

test("map attribution and the center disclosure control stay inside useful map space", () => {
  assert.match(repair, /#map \.leaflet-control-attribution[\s\S]*bottom: 4px[\s\S]*max-width: calc\(100% - 56px\)[\s\S]*white-space: normal/);
  assert.match(repair, /#map \.gridly-map-attribution-disclosure[\s\S]*max-height: calc\(100% - 40px\)/);
  assert.match(repair, /\.gridly-landscape-command-handle[\s\S]*bottom: calc\(100% \+ 4px\)/);
  assert.doesNotMatch(repair, /#map\s*\{[^}]*height:\s*\d+px/);
});

test("repair is CSS-only and does not acquire report or data lifecycle ownership", () => {
  assert.doesNotMatch(repair, /(?:localStorage|sessionStorage|fetch\(|submitGoverned|createSharedHazardReport|provider|persistence|setView\()/i);
  for (const owner of ["report-use-location", "report-tap-map", "report-confirm-governed-draft", "report-cancel-governed-draft"]) {
    assert.match(app, new RegExp(owner));
  }
});
