const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/styles.css", "utf8");

test("persistent route card renders only the existing decision headline", () => {
  const renderPath = app.match(/function getGridlyDestinationRouteImpactCardText\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(renderPath, /buildGridlyDestinationDecisionPresentation\(\{ audit \}\)/);
  assert.match(renderPath, /return normalizeGridlyUserFacingRoadText\(decision\.interpretation\)/);
  assert.doesNotMatch(renderPath, /decision\.reason|decision\.confidence|decision\.freshness/);
});

test("portrait route action shares a compact card row and retains a 44px target", () => {
  const passTwo = css.slice(css.indexOf("LP185.2B — compact persistent route state"));
  assert.match(passTwo, /grid-template-columns: minmax\(0, 1fr\) 82px !important/);
  assert.match(passTwo, /min-height: 88px !important/);
  assert.match(passTwo, /max-height: min\(112px,/);
  assert.match(passTwo, /min-height: 44px !important/);
});

test("Pass 2 leaves expanded intelligence and Travel Brief styling untouched", () => {
  const passTwo = css.slice(css.indexOf("LP185.2B — compact persistent route state"));
  assert.doesNotMatch(passTwo, /gridly-destination-impact-(?:pane|card|actions)/);
  assert.doesNotMatch(passTwo, /gridly-brief-interaction-panel|gridly-brief-flow/);
  assert.doesNotMatch(passTwo, /gridly-v2-awareness-brief-card/);
});
