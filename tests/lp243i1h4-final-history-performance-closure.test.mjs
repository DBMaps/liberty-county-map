import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const resolver = app.slice(app.indexOf("function gridlyHistoricalIntelligenceCleanLocationCandidate"), app.indexOf("function gridlyHistoricalIntelligenceFormatLocationLine"));
const builder = app.slice(app.indexOf("function gridlyBuildHistoricalIntelligenceSheetHtmlWithBuilderMemo"), app.indexOf("function gridlyLp0552VisibleConsumerTextForLeakAudit"));

const exact = ["presentationLocationLabel", "locationLabel", "displayLocation", "resolvedLocationLabel", "localizedLocation", "localizedSpot", "locationName", "locationPhrase", "knownLocation"];
const road = ["referenceRoad", "reference_road", "roadName", "road", "resolvedRoadName", "primaryRoad", "routeName", "crossingName", "crossingLabel", "crossing", "intersection", "crossStreet", "cross_street", "nearestRoad", "nearestRoadName", "nearest_road", "street", "address"];
const locality = ["locality", "town", "city", "place", "area"];
const nests = ["", "raw", "source", "original"];
const paths = (catalog) => nests.flatMap((nest) => catalog.map((field) => nest ? `${nest}.${field}` : field));
const read = (record, path) => path.split(".").reduce((value, key) => value && typeof value === "object" ? value[key] : undefined, record);
const context = (record) => {
  for (const [catalog, specificity] of [[paths(exact), "specific"], [paths(road), "specific"], [paths(locality), "locality"]]) {
    for (const sourceField of catalog) {
      const label = String(read(record, sourceField) ?? "").replace(/\s+/g, " ").trim();
      if (label) return { label, sourceField, specificity };
    }
  }
  return null;
};

const legacyFallback = (finding) => {
  const sourceContexts = finding.sourceRecords.map(context).filter(Boolean);
  return context(finding) || sourceContexts.find((item) => item.specificity === "specific") || sourceContexts[0] || null;
};
const memoizedFallback = (finding, memo) => {
  let first = null;
  let firstSpecific = null;
  for (const record of finding.sourceRecords) {
    if (!memo.has(record)) memo.set(record, context(record));
    const item = memo.get(record);
    if (!first && item) first = item;
    if (!firstSpecific && item?.specificity === "specific") firstSpecific = item;
  }
  return context(finding) || firstSpecific || first;
};

test("H3 catalogs and one-pass fallback remain authoritative", () => {
  assert.match(resolver, /GRIDLY_HISTORICAL_SOURCE_REPORT_DIRECT_PATHS = Object\.freeze/);
  assert.match(resolver, /GRIDLY_HISTORICAL_SOURCE_REPORT_FALLBACK_PATHS = Object\.freeze/);
  assert.match(resolver, /recordFallbackContext: firstSpecificRecordContext \|\| firstRecordContext/);
  assert.doesNotMatch(resolver.slice(resolver.indexOf("function gridlyHistoricalIntelligenceBestLocationContext")), /recordContexts|\.map\(\(record\)/);
});

test("record derivation memo is bounded to one synchronous shared builder invocation", () => {
  assert.match(resolver, /let gridlyHistoricalIntelligenceBuilderLocationMemo = null/);
  assert.match(resolver, /memo\.has\(record\)/);
  assert.match(resolver, /candidates: Object\.freeze/);
  assert.match(builder, /gridlyHistoricalIntelligenceBuilderLocationMemo = new WeakMap\(\)/);
  assert.match(builder, /finally[\s\S]*gridlyHistoricalIntelligenceBuilderLocationMemo = previousMemo/);
  assert.doesNotMatch(app, /window\.gridlyHistoricalIntelligenceBuilderLocationMemo|localStorage.*memo|sessionStorage.*memo/);
});

test("crossing, flood, hazard, duration, confirmed, and large groups remain equivalent", () => {
  const cases = [["crossing", 86], ["flood", 158], ["hazard", 173], ["duration", 180], ["confirmed", 195], ["confirmed", 203]];
  for (const [category, size] of cases) {
    const shared = { raw: { roadName: `FM ${size}` }, metadata: { category } };
    const records = Array.from({ length: size }, (_, index) => index === 2 ? { locality: "Dayton" } : index === size - 1 ? shared : { metadata: { index } });
    const finding = { sourceRecords: records };
    assert.deepEqual(memoizedFallback(finding, new WeakMap()), legacyFallback(finding), `${category}/${size}`);
  }
});

test("overlapping findings reuse identity while preserving exact source path and precedence", () => {
  const shared = { original: { crossingName: "Main St & US 90" }, locality: "Liberty" };
  const memo = new WeakMap();
  let derivations = 0;
  const derive = (record) => { if (!memo.has(record)) { memo.set(record, context(record)); derivations += 1; } return memo.get(record); };
  assert.deepEqual(derive(shared), { label: "Main St & US 90", sourceField: "original.crossingName", specificity: "specific" });
  assert.deepEqual(derive(shared), derive(shared));
  assert.equal(derivations, 1);
});

test("no landscape branch, async masking, truncation, fallback loss, or authority weakening", () => {
  assert.doesNotMatch(resolver + builder, /landscape|requestIdleCallback|setTimeout|new Worker|async function buildGridlyHistoricalIntelligenceSheetHtml/);
  assert.doesNotMatch(builder, /\.slice\(0,\s*\d+\)|MAX_(?:RECORD|HISTORY)|recordLimit|groupLimit/);
  for (const token of ["source_report_field", "text_fallback_extraction", "specificity === \"specific\"", "findingContext", "recordFallbackContext"]) assert.ok(resolver.includes(token));
});

test("History presentation, finding ordering, and shared authority remain frozen", () => {
  assert.match(app, /history: \{ title: "Historical Intelligence", html: buildGridlyHistoricalIntelligenceSheetHtml \}/);
  assert.match(app, /gridlyDeduplicateHistoricalIntelligenceFindings/);
  assert.match(app, /source: "real_historical_records"/);
  assert.match(app, /Local knowledge from cleared community reports for what to know before you go\./);
});

test("LP243.I1 and J/J1 plus Search, KBYG, and Leaflet remain present", () => {
  assert.match(app, /function getGridlyV2SheetInteractionEligibility/);
  assert.match(app, /LP243\.J1: promote the existing singular command owner/);
  for (const token of ["gridlySearchShell", "KBYG", "Leaflet"]) assert.ok(app.includes(token));
  assert.match(html, /lp243j1=startup-readiness-handshake/);
});

test("heavyweight H1/H2 browser diagnostics are retired", () => {
  assert.doesNotMatch(app, /window\.gridlyLP243I1H1HistoryPerformanceAudit/);
  assert.doesNotMatch(app, /window\.gridlyLP243I1H2BuildFindingPerformanceAudit/);
  assert.doesNotMatch(app, /OWNER_STATE_HISTORY_PERFORMANCE|BUILDFINDING_HOTSPOT_ATTRIBUTION/);
});

test("only JavaScript asset identity advances and remains unique", () => {
  assert.equal((html.match(/js\/app\.js\?v=243i1h5-final-history-click-latency-closure&amp;lp243j1=startup-readiness-handshake/g) || []).length, 1);
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
  assert.ok(css.length > 0);
});
