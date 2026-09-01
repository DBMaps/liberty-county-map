import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const formatterSource = app.match(/function buildGridlyLocationContextMetricLines\([\s\S]*?\n}/)?.[0] || "";
const formatter = Function(`${formatterSource}; return buildGridlyLocationContextMetricLines;`)();
const normalization = app.slice(app.indexOf("function normalizeGridlyMobileAwarenessPanelSummary"), app.indexOf("function getGridlyAwarenessSummaryAreaIdentity"));
const portrait = app.slice(app.indexOf("function refreshGridlyPortraitLocationAwarenessPanel"), app.indexOf("function getGridlyPortraitLocalizedIntelligenceSignature"));

test("Location Context uses one roadway-specific formatter for singular, plural, and responsive owners", () => {
  assert.equal(formatter({ activeIssueCount: 0 }).activeIssuesLine, "No active issues nearby");
  assert.equal(formatter({ activeIssueCount: 1 }).activeIssuesLine, "1 roadway issue nearby");
  assert.equal(formatter({ activeIssueCount: 2 }).activeIssuesLine, "2 roadway issues nearby");
  assert.doesNotMatch(formatterSource, /`\$\{active\} active issue/);
  assert.match(normalization, /activeIssuesLine: metricLines\.activeIssuesLine/);
  assert.match(portrait, /buildGridlyLocationContextMetricLines\(\{ activeIssueCount: activeCount \}\)\.activeIssuesLine/);
});

test("governed rows and the reconciled shared count remain the Location Context authority", () => {
  assert.match(normalization, /getGridlyReconciledAwarenessActiveIssueCount\(safeSummary/);
  assert.match(normalization, /gridlyGetGovernedActiveAwarenessRows\(\)\.length/);
  assert.match(normalization, /resolveLocationContextActiveIssueCount\(\{/);
  assert.match(normalization, /gridlyGetGovernedActiveAwarenessRows\(\)\.filter\(\(row\) => row\.sourceKind === "official_roadway"\)/);
  assert.doesNotMatch(normalization, /sourceKind === "weather_provider"/);
});

test("Alerts and KBYG authorities and composition remain independent", () => {
  assert.match(app, /function getGridlyVisibleAlertIncidentCount\(/);
  assert.match(app, /function getGridlyAlertsSurfaceVisibleActiveIncidentCount\(/);
  assert.match(app, /active conditions/);
  assert.match(app, /activeOfficialRoadwayCount/);
  assert.match(app, /gridlyTravelBriefWeatherLines\(weather/);
  assert.match(app, /`\$\{group\.entries\.length\} roadway conditions on \$\{group\.route\}`/);
  assert.match(normalization, /Alerts grouping is presentation cardinality/);
});

test("responsive presentations share markup and copy without viewport-specific wording", () => {
  assert.match(html, /id="mobileAwarenessPanelIssues"/);
  assert.doesNotMatch(formatterSource + normalization + portrait, /390|844|932/);
  assert.match(html, /js\/app\.js\?v=243i23r2-visible-map-attribution-boundary/);
});

test("protected provider, weather, map, styling, and history implementations are outside this repair", () => {
  for (const protectedPath of [
    "../js/gridlyDriveTexasLiveConnector.js",
    "../js/gridlyWeatherProvider.js",
    "../css/styles.css"
  ]) assert.ok(fs.existsSync(new URL(protectedPath, import.meta.url)), `${protectedPath} remains present`);
  assert.match(app, /arcgisStaticBasemapApiKey/);
  assert.match(app, /L\.map\(/);
  assert.match(app, /gridlyGetWeather/);
  assert.match(app, /gridlyDriveTexasConnector/);
  for (const protectedSuite of [
    "../tests/lp243i21-presentation-neutral-layers-opening-authority.test.mjs",
    "../tests/lp243i21d2-remove-dark-basemap.test.mjs",
    "../tests/lp243i21s1-satellite-label-legibility-carto-closure.test.mjs",
    "../tests/lp243i21s2-esri-imagery-labels-activation.test.mjs",
    "../tests/lp243j-presentation-ownership-containment.test.mjs",
    "../tests/lp243j1-startup-readiness-handshake.test.mjs",
    "../tests/history-capture/lp0538HistoricalEvidenceInterpretationAdapter.test.js"
  ]) assert.ok(fs.existsSync(new URL(protectedSuite, import.meta.url)), `${protectedSuite} remains present`);
});
