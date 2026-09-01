import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const resolver = app.slice(app.indexOf("function gridlyHistoricalIntelligenceCleanLocationCandidate"), app.indexOf("function gridlyHistoricalIntelligenceFormatLocationLine"));
const builder = app.slice(app.indexOf("function buildGridlyHistoricalIntelligenceSheetHtml"), app.indexOf("// LP243.I1H2 TEMPORARY DIAGNOSTIC"));

const exactPaths = ["presentationLocationLabel", "locationLabel", "displayLocation", "resolvedLocationLabel", "localizedLocation", "localizedSpot", "locationName", "locationPhrase", "knownLocation"];
const roadPaths = ["referenceRoad", "reference_road", "roadName", "road", "resolvedRoadName", "primaryRoad", "routeName", "crossingName", "crossingLabel", "crossing", "intersection", "crossStreet", "cross_street", "nearestRoad", "nearestRoadName", "nearest_road", "street", "address"];
const localityPaths = ["locality", "town", "city", "place", "area"];
const nests = ["", "raw", "source", "original"];
const paths = (names) => nests.flatMap((nest) => names.map((name) => nest ? `${nest}.${name}` : name));
const read = (record, path) => path.split(".").reduce((value, key) => value && typeof value === "object" ? value[key] : undefined, record);
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const context = (record) => {
  for (const [catalog, specificity] of [[paths(exactPaths), "specific"], [paths(roadPaths), "specific"], [paths(localityPaths), "locality"]]) {
    for (const sourceField of catalog) {
      const label = clean(read(record, sourceField));
      if (label) return { label, sourceField, specificity };
    }
  }
  return null;
};
// A test-only reference preserves the pre-I1H3 second traversal.
const referenceMissResolution = (finding) => {
  const findingContext = context(finding);
  if (findingContext) return findingContext;
  const contexts = finding.sourceRecords.map(context).filter(Boolean);
  return contexts.find((item) => item.specificity === "specific") || contexts[0] || null;
};
// I1H3 captures the same two legacy find targets during the candidate traversal.
const onePassMissResolution = (finding) => {
  let first = null;
  let firstSpecific = null;
  for (const record of finding.sourceRecords) {
    const item = context(record);
    if (!first && item) first = item;
    if (!firstSpecific && item?.specificity === "specific") firstSpecific = item;
  }
  const findingContext = context(finding);
  return findingContext || firstSpecific || first;
};

function fixture(size, category) {
  const records = Array.from({ length: size }, (_, index) => index === Math.floor(size / 2)
    ? { locality: "Dayton", metadata: { category } }
    : index === size - 1
      ? { raw: { roadName: `FM ${category.length}90` } }
      : { metadata: { category, index } });
  return { sourceRecords: records };
}

test("shared synchronous authority remains singular and is not landscape-specific", () => {
  assert.match(resolver, /function gridlyHistoricalIntelligenceBestLocationContext/);
  assert.match(app, /gridlyHistoricalIntelligenceBuildFinding[\s\S]*gridlyHistoricalIntelligenceBestLocationContext/);
  assert.doesNotMatch(resolver + builder, /landscape|requestIdleCallback|setTimeout|Worker\s*\(|async function buildGridlyHistoricalIntelligenceSheetHtml/);
  assert.match(app, /history: \{ title: "Historical Intelligence", html: buildGridlyHistoricalIntelligenceSheetHtml \}/);
});

test("authority catalogs and specificity rules are retained", () => {
  for (const token of ["presentationLocationLabel", "referenceRoad", "crossingName", "intersection", "nearestRoad", "address", "locality", "town", "city", "source_report_field", "text_fallback_extraction"])
    assert.match(resolver, new RegExp(`\\b${token}\\b`));
  assert.match(resolver, /specificity === "specific"/);
  assert.match(app, /source: "real_historical_records"/);
});

test("crossing, flood, hazard, duration, confirmed and owner-sized groups are miss-equivalent", () => {
  const cases = [["crossing", 86], ["flood", 158], ["hazard", 173], ["duration", 180], ["confirmed", 195], ["confirmed", 203]];
  for (const [category, size] of cases)
    assert.deepEqual(onePassMissResolution(fixture(size, category)), referenceMissResolution(fixture(size, category)), `${category}/${size}`);
});

test("candidate path, authority, label, and locality output fields remain exact", () => {
  const specific = { sourceRecords: [{ locality: "Liberty" }, { original: { crossingName: "Main St & US 90" } }] };
  assert.deepEqual(onePassMissResolution(specific), referenceMissResolution(specific));
  const governedFinding = { presentationLocationLabel: "Near FM 1960", sourceRecords: [{ locality: "Dayton" }] };
  assert.deepEqual(onePassMissResolution(governedFinding), referenceMissResolution(governedFinding));
});

test("algorithmic guard: immutable catalogs are hoisted and a miss has one group traversal", () => {
  assert.match(resolver, /GRIDLY_HISTORICAL_SOURCE_REPORT_DIRECT_PATHS = Object\.freeze/);
  assert.match(resolver, /GRIDLY_HISTORICAL_SOURCE_REPORT_FALLBACK_PATHS = Object\.freeze/);
  const best = resolver.slice(resolver.indexOf("function gridlyHistoricalIntelligenceBestLocationContext"));
  assert.doesNotMatch(best, /\.map\(\(record\)|recordContexts/);
  assert.match(resolver, /recordFallbackContext: firstSpecificRecordContext \|\| firstRecordContext/);
  assert.match(resolver, /if \(value == null \|\| value === ""\) return ""/);
});

test("no truncation, persistent cache, provider change, presentation rewrite, or CSS identity change", () => {
  assert.doesNotMatch(builder, /retained(?:Records|History).*slice\(0,\s*\d+\)|global.*cache/i);
  assert.doesNotMatch(resolver, /memo|cache|WeakMap|Map\(\).*record/i);
  assert.match(app, /source: "real_historical_records"/);
  assert.match(html, /js\/app\.js\?v=243i1h3-history-location-resolution-performance-repair&amp;lp243j1=startup-readiness-handshake/);
  assert.match(html, /css\/styles\.css\?v=243h10l-landscape-status-composition&amp;lp243j=presentation-ownership-containment/);
});

test("LP243.I1 eligibility, J/J1 startup, and frozen systems remain protected", () => {
  assert.match(app, /function getGridlyV2SheetInteractionEligibility/);
  assert.match(app, /LP243\.J1: promote the existing singular command owner/);
  assert.match(html, /lp243j1=startup-readiness-handshake/);
  for (const token of ["gridlySearchShell", "KBYG", "Leaflet"]) assert.ok(app.includes(token));
});
