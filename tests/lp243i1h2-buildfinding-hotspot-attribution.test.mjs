import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const buildStart = app.indexOf("function gridlyHistoricalIntelligenceBuildFinding(");
const buildEnd = app.indexOf("function gridlyHistoricalIntelligenceSharedRecordCount", buildStart);
const buildFinding = app.slice(buildStart, buildEnd);
const auditStart = app.indexOf("async function gridlyLP243I1H2BuildFindingPerformanceAudit(");
const auditEnd = app.indexOf("// LP243.I1H1 TEMPORARY DIAGNOSTIC", auditStart);
const audit = app.slice(auditStart, auditEnd);

test("focused audit owns one real History builder invocation without a History click", () => {
  assert.ok(buildStart > 0 && buildEnd > buildStart && auditStart > 0 && auditEnd > auditStart);
  assert.equal((audit.match(/Reflect\.apply\(buildGridlyHistoricalIntelligenceSheetHtml, window, \[\]\)/g) || []).length, 1);
  assert.match(audit, /builderCalls \+= 1/);
  assert.doesNotMatch(audit, /\.click\(|openGridlyPortraitV2Sheet|openPortraitV2Sheet/);
  assert.match(app, /window\.gridlyLP243I1H2BuildFindingPerformanceAudit = gridlyLP243I1H2BuildFindingPerformanceAudit/);
});

test("BuildFinding collects bounded exclusive internal stage timing and group sizes", () => {
  for (const stage of [
    "duration_derivation", "confirmation_count_scan", "confidence_support_and_recency",
    "road_extraction_and_normalization", "reference_road_scan", "record_id_mapping_and_filter",
    "peak_window_timestamp_derivation", "community_context_resolution", "hazard_label_scan",
    "location_specificity_and_authority_resolution", "latest_timestamp_repeated_resolution", "finding_assembly_and_source_family"
  ]) assert.match(buildFinding, new RegExp(`timed\\("${stage}"`));
  for (const field of ["calls", "totalMs", "maxMs", "averageMs", "recordsProcessed", "minGroupSize", "maxGroupSize", "averageGroupSize"])
    assert.match(audit, new RegExp(`\\b${field}\\b`));
  assert.match(audit, /exclusiveStagesNonOverlapping: true/);
  assert.match(audit, /nestedHelpersExcludedFromAccountedPercent: true/);
  assert.match(audit, /accountedPercent/);
});

test("audit correlates the six pipeline categories and bounds slow calls to ten", () => {
  for (const category of ["crossing", "flood", "construction", "hazard", "duration", "confirmed", "unknown/internal"])
    assert.match(app, new RegExp(`"${category.replace("/", "\\/")}"`));
  for (const field of ["totalBuildFindingMs", "averageBuildFindingMs", "recordsProcessedTotal", "maxGroupSize", "dominantStage", "dominantStageMs"])
    assert.match(audit, new RegExp(`\\b${field}\\b`));
  assert.match(audit, /\.slice\(0, 10\)/);
});

test("result is privacy bounded and contains no History record content", () => {
  assert.match(audit, /recordContentReturned: false/);
  assert.match(audit, /recordIdsReturned: false/);
  assert.match(audit, /locationsReturned: false/);
  assert.match(audit, /rawHistoryReturned: false/);
  assert.doesNotMatch(audit, /sourceRecords\s*:|sourceRecordIds\s*:|retainedRecords\s*:|rawJson|storagePayload\s*:/i);
});

test("temporary session restores in finally and instrumentation is measurement only", () => {
  assert.match(audit, /const previousSession = gridlyLP243I1H2BuildFindingDiagnosticSession/);
  assert.match(audit, /finally \{[\s\S]*gridlyLP243I1H2BuildFindingDiagnosticSession = previousSession/);
  assert.match(audit, /wrappersRestored: gridlyLP243I1H2BuildFindingDiagnosticSession === previousSession/);
  assert.match(audit, /optimizationPerformed: false/);
  assert.doesNotMatch(audit, /memoiz|Worker\s*\(|requestIdleCallback|setTimeout|Promise\.all|\.click\(/i);
});

test("History semantics and frozen surfaces remain untouched by the focused diagnostic", () => {
  assert.match(buildFinding, /source: "real_historical_records"/);
  assert.match(app, /LP243\.I1H2 TEMPORARY DIAGNOSTIC SESSION\. Null during ordinary History use/);
  assert.doesNotMatch(audit, /landscape|portrait|responsive|Leaflet|gridlySearch|KBYG|Layers|lp243j/i);
  assert.match(html, /js\/app\.js\?v=243i1h2-buildfinding-hotspot-attribution&amp;lp243j1=startup-readiness-handshake/);
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
});
