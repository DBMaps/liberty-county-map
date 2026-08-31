const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const governed = require("../js/governed-awareness.js");
const labels = require("../js/gridlyConditionDisplayLabel.js");

function roadwayFormatter() {
  const start = app.indexOf("function gridlyTravelBriefRoadwayConditionLabel");
  const end = app.indexOf("function gridlyTravelBriefRoadwayLineRoute", start);
  const sandbox = { gridlyConditionDisplayLabel: labels.gridlyConditionDisplayLabel };
  vm.runInNewContext(`${app.slice(start, end)};this.format=gridlyTravelBriefRoadwayConditionLabel`, sandbox);
  return sandbox.format;
}

test("mixed official and Community Report families use governed cardinality", () => {
  assert.equal(governed.resolveLocationContextActiveIssueCount({
    governedEligibleEvidenceCount: 5,
    sharedActiveIssueCount: 3,
    reconciledActiveIssueCount: 3,
    alertsGroupedIssueCount: 99
  }), 5);
});

test("presentation cardinality is not an authority and quiet state remains zero", () => {
  assert.equal(governed.resolveLocationContextActiveIssueCount({
    governedEligibleEvidenceCount: 0,
    sharedActiveIssueCount: 0,
    reconciledActiveIssueCount: 0,
    alertsGroupedIssueCount: 7
  }), 0);
});

test("governed projection includes active Community Reports once and rejects stale rows", () => {
  const records = [
    { id: "community-1", sourceKind: "community_report", subtype: "closed_road", status: "active", active: true, geographicEligible: true },
    { id: "community-1", sourceKind: "community_report", subtype: "closed_road", status: "active", active: true, geographicEligible: true },
    { id: "community-stale", sourceKind: "community_report", subtype: "closed_road", status: "stale", geographicEligible: true }
  ];
  const projection = governed.buildConsumerProjection({ records });
  assert.equal(projection.snapshot.governedEligibleEvidenceCount, 1);
  assert.equal(projection.snapshot.duplicateEvidenceIds.length, 1);
  assert.deepEqual([...projection.surfaces.locationContext].map((row) => row.evidenceId), ["community_report:community-1"]);
});

test("KBYG consolidated labels use shared governed casing", () => {
  const format = roadwayFormatter();
  assert.equal(format("road closure affecting travel"), "Road Closure");
  assert.equal(format("Construction may affect travel"), "Construction");
  assert.equal(`${format("road closure")} and ${format("construction")}`, "Road Closure and Construction");
});

test("unknown KBYG roadway condition has a safe deliberate fallback", () => {
  assert.equal(roadwayFormatter()("provider condition without taxonomy"), "Roadway Condition");
});

test("production normalization passes governed evidence and never Alerts DOM cardinality", () => {
  const start = app.indexOf("function normalizeGridlyMobileAwarenessPanelSummary");
  const end = app.indexOf("function getGridlyAwarenessSummaryAreaIdentity", start);
  const source = app.slice(start, end);
  assert.match(source, /sharedActiveIssueCount:[\s\S]{0,160}governedEligibleEvidenceCount/);
  assert.doesNotMatch(source, /alertsGroupedIssueCount\s*[,}][\s\S]{0,200}resolveLocationContextActiveIssueCount/);
});
