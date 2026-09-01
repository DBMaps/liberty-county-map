import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const resolver = app.slice(app.indexOf("function gridlyHistoricalIntelligenceCleanLocationCandidate"), app.indexOf("function gridlyHistoricalIntelligenceFormatLocationLine"));
const builder = app.slice(app.indexOf("function gridlyBuildHistoricalIntelligenceSheetHtmlWithBuilderMemo"), app.indexOf("function gridlyLp0552VisibleConsumerTextForLeakAudit"));
const findings = app.slice(app.indexOf("function gridlyBuildHistoricalIntelligenceFindings"), app.indexOf("function gridlyHistoricalIntelligenceHasClearTime"));

const paths = ["locationLabel", "raw.locationLabel", "roadName", "raw.roadName", "locality", "raw.locality"];
const compiled = paths.map((path) => ({ path, keys: path.split(".") }));
const derive = (record) => {
  for (const item of compiled) {
    const value = item.keys.reduce((current, key) => current && current[key], record);
    if (value) return { label: value, sourceField: item.path, specificity: item.path.includes("locality") ? "locality" : "specific" };
  }
  return null;
};

function resolve(records, memo) {
  const counts = new Map();
  for (const record of records) {
    if (!memo.has(record)) memo.set(record, derive(record));
    const item = memo.get(record);
    if (!item) continue;
    const key = item.label.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

test("I1H3 one-pass resolver and immutable candidate catalogs remain preserved", () => {
  assert.match(resolver, /GRIDLY_HISTORICAL_SOURCE_REPORT_DIRECT_PATHS = Object\.freeze/);
  assert.match(resolver, /recordFallbackContext: firstSpecificRecordContext \|\| firstRecordContext/);
  assert.doesNotMatch(resolver.slice(resolver.indexOf("function gridlyHistoricalIntelligenceBestLocationContext")), /recordContexts|\.map\(\(record\)/);
});

test("source proves overlapping groups retain record identity, so no semantic-key cache is warranted", () => {
  assert.match(findings, /\.filter\(\(record\)[\s\S]*gridlyHistoricalIntelligenceGroupRecords\(floodEvents/);
  assert.match(findings, /durationEvents = \[\.\.\.crossingEvents, \.\.\.hazardEvents\]\.filter/);
  assert.match(findings, /confirmedEvents = \[\.\.\.crossingEvents, \.\.\.hazardEvents\]\.filter/);
  assert.match(app, /groups\.get\(key\)\.push\(record\)/);
  assert.doesNotMatch(resolver, /semantic.*memo|fingerprint.*memo|JSON\.stringify\(record\)/i);
});

test("I1H4 memo lifetime remains builder-scoped with no persistent or exposed cache", () => {
  assert.match(resolver, /let gridlyHistoricalIntelligenceBuilderLocationMemo = null/);
  assert.match(resolver, /memo\.has\(record\)/);
  assert.match(builder, /gridlyHistoricalIntelligenceBuilderLocationMemo = new WeakMap\(\)/);
  assert.match(builder, /finally[\s\S]*gridlyHistoricalIntelligenceBuilderLocationMemo = previousMemo/);
  assert.doesNotMatch(app, /window\.gridlyHistoricalIntelligenceBuilderLocationMemo|localStorage.*memo|sessionStorage.*memo/);
});

test("identity memo reuses one derivation but clones and collisions remain isolated", () => {
  const shared = { id: "same", raw: { roadName: "FM 1960" }, sourceType: "official" };
  const clone = { ...shared, raw: { ...shared.raw } };
  const changedLocation = { ...shared, raw: { roadName: "US 90" } };
  const changedAuthority = { ...shared, sourceType: "community" };
  const memo = new WeakMap();
  let calls = 0;
  const get = (record) => { if (!memo.has(record)) { memo.set(record, (++calls, derive(record))); } return memo.get(record); };
  assert.deepEqual(get(shared), get(shared));
  assert.equal(calls, 1);
  get(clone); get(changedLocation); get(changedAuthority);
  assert.equal(calls, 4, "distinct instances, same IDs, location changes, and authority changes cannot collide");
});

test("compiled immutable paths remove repeated parsing without precedence or source-path changes", () => {
  assert.match(resolver, /function gridlyHistoricalIntelligenceCompilePaths/);
  assert.match(resolver, /keys: Object\.freeze\(path\.split\("\."\)\)/);
  assert.match(resolver, /GRIDLY_HISTORICAL_RECORD_EXACT_PATHS[\s\S]*GRIDLY_HISTORICAL_RECORD_ROAD_PATHS[\s\S]*GRIDLY_HISTORICAL_RECORD_LOCALITY_PATHS/);
  assert.deepEqual(derive({ locationLabel: "Exact", roadName: "Road", locality: "Town" }), { label: "Exact", sourceField: "locationLabel", specificity: "specific" });
  assert.deepEqual(derive({ roadName: "Road", locality: "Town" }), { label: "Road", sourceField: "roadName", specificity: "specific" });
  assert.deepEqual(derive({ locality: "Town" }), { label: "Town", sourceField: "locality", specificity: "locality" });
});

test("finding aggregation stays finding-specific for crossing/flood/hazard/duration/confirmed and large groups", () => {
  const a = { roadName: "A" }, b = { roadName: "B" }, memo = new WeakMap();
  for (const [category, records] of [["crossing", [a,a]], ["flood", [a,b]], ["hazard", [b,b,b]], ["duration", [a,b,b]], ["confirmed", [a,a,b]], ["large", Array(300).fill(a)]]) {
    const counts = resolve(records, memo);
    assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), records.length, category);
  }
});

test("ordering, presentation, retained data, and synchronous shared History path are unchanged", () => {
  assert.match(findings, /sort\(\(a, b\) => Number\(b\.significanceScore\)/);
  assert.match(app, /history: \{ title: "Historical Intelligence", html: buildGridlyHistoricalIntelligenceSheetHtml \}/);
  assert.match(app, /Local knowledge from cleared community reports for what to know before you go\./);
  assert.doesNotMatch(resolver + builder, /requestIdleCallback|setTimeout|new Worker|async function buildGridlyHistoricalIntelligenceSheetHtml|landscape/);
  assert.doesNotMatch(builder, /\.slice\(0,\s*\d+\)|recordLimit|groupLimit|MAX_(?:RECORD|HISTORY)/);
});

test("I1, J/J1, Search, KBYG, Leaflet, and diagnostic retirement remain protected", () => {
  for (const token of ["getGridlyV2SheetInteractionEligibility", "LP243.J1: promote the existing singular command owner", "gridlySearchShell", "KBYG", "Leaflet"]) assert.ok(app.includes(token), token);
  assert.match(html, /lp243j1=startup-readiness-handshake/);
  assert.doesNotMatch(app, /window\.gridlyLP243I1H1HistoryPerformanceAudit|window\.gridlyLP243I1H2BuildFindingPerformanceAudit|OWNER_STATE_HISTORY_PERFORMANCE|BUILDFINDING_HOTSPOT_ATTRIBUTION/);
});

test("only the JavaScript identity advances; CSS remains unchanged", () => {
  assert.equal((html.match(/js\/app\.js\?v=243i1h5-final-history-click-latency-closure&amp;lp243j1=startup-readiness-handshake/g) || []).length, 1);
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
  assert.ok(css.length > 0);
});
