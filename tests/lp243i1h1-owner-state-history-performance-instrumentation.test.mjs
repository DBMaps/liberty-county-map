import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = app.indexOf("async function gridlyLP243I1H1HistoryPerformanceAudit(");
const end = app.indexOf("function gridlyLp0552VisibleConsumerTextForLeakAudit", start);
const diagnostic = app.slice(start, end);

test("LP243.I1H1 exposes one temporary owner and one last-result owner", () => {
  assert.ok(start > 0 && end > start);
  assert.equal((app.match(/window\.gridlyLP243I1H1HistoryPerformanceAudit =/g) || []).length, 1);
  assert.equal((app.match(/window\.gridlyLP243I1H1HistoryPerformanceAuditLastResult = null/g) || []).length, 1);
  assert.match(html, /js\/app\.js\?v=243i1h1-owner-state-history-performance-diagnostic&amp;lp243j1=startup-readiness-handshake/);
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
});

test("diagnostic invokes the real shared builder exactly once and measures its wall time", () => {
  assert.equal((diagnostic.match(/buildGridlyHistoricalIntelligenceSheetHtml\(\{ breakdownSections, breakdownCounts \}\)/g) || []).length, 1);
  assert.match(diagnostic, /const builderStarted = now\(\)/);
  assert.match(diagnostic, /builderTotalMs = now\(\) - builderStarted/);
  assert.match(diagnostic, /outputLength = typeof html === "string" \? html\.length : 0/);
  assert.doesNotMatch(diagnostic, /openGridlyPortraitV2Sheet|openPortraitV2Sheet|gridlyHistoryDockButton\.click/);
});

test("required top-level and nested History stages are measured without changing feature logic", () => {
  for (const name of [
    "gridlyLp0546ResolveSelectionContext", "gridlyLp0546ResolveCrossingRecord", "gridlyHistoricalProtectedState",
    "gridlyLp0543BuildVisibleHistoricalPatternModel", "gridlyBuildHistoricalIntelligenceFindings",
    "gridlyReadHistoricalIntelligenceStorageSnapshot", "gridlyLp0545FilterHistoricalRecordsForContext",
    "gridlyLp0545RecordMatchesContext", "gridlyHistoricalIntelligenceBuildFinding",
    "gridlyDeduplicateHistoricalIntelligenceFindings", "gridlyLp0543BuildConsumerPatternFromFinding",
    "gridlyLp0543GroupIndependentIncidents", "gridlyLp0543ConsumerLocalParts"
  ]) assert.match(diagnostic, new RegExp(`wrap\\("${name}"`));
  assert.match(diagnostic, /exclusiveStages/);
  assert.match(diagnostic, /nestedHotspots/);
  assert.match(diagnostic, /final_presentation_and_uninstrumented_builder_residual/);
  assert.match(diagnostic, /nestedTimingsOverlapParents: true/);
});

test("diagnostic returns counts and storage timing but never returns retained payloads", () => {
  for (const field of [
    "retainedCrossingCount", "retainedHazardCount", "retainedTotalCount", "matchedCrossingCount",
    "matchedHazardCount", "rawFindingCount", "deduplicatedFindingCount", "consumerPatternCandidateCount",
    "independentIncidentCount", "localTimeFormatterCallCount", "crossingCatalogCount", "payloadLengthChars",
    "getItemMs", "parseMs", "parseCalls"
  ]) assert.match(diagnostic, new RegExp(`\\b${field}\\b`));
  assert.match(diagnostic, /retainedRecordBodiesReturned: false/);
  assert.match(diagnostic, /rawStorageReturned: false/);
  assert.doesNotMatch(diagnostic, /rawJson|rawJSON|eventBodies|retainedRecords|storagePayload\s*:/);
});

test("temporary wrappers preserve calls and restore in finally", () => {
  assert.match(diagnostic, /Reflect\.apply\(original, this, args\)/);
  assert.match(diagnostic, /finally \{[\s\S]*record\(name, elapsed/);
  assert.match(diagnostic, /finally \{[\s\S]*while \(originals\.length\)/);
  assert.match(diagnostic, /wrappersRestored: true/);
  assert.match(diagnostic, /window\.gridlyLP243I1H1HistoryPerformanceAuditLastResult = result/);
});

test("instrumentation remains measurement-only and shared", () => {
  assert.match(diagnostic, /optimizationPerformed: false/);
  assert.match(diagnostic, /PerformanceObserver/);
  assert.match(diagnostic, /type: "longtask"/);
  assert.match(diagnostic, /console\.table\(exclusiveStages\)/);
  assert.match(diagnostic, /console\.table\(nestedHotspots\)/);
  assert.doesNotMatch(diagnostic, /requestIdleCallback|Worker\s*\(|memoiz|new Intl\.DateTimeFormat|landscape|sheetHidden|loading spinner/i);
  assert.doesNotMatch(diagnostic, /fetch\(|supabase|Leaflet|setView\(|gridlySearch|KBYG/i);
});
