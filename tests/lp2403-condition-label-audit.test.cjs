const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const audit = require("../audits/lp2403-condition-label-audit.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const governed = fs.readFileSync(path.join(root, "js/governed-awareness.js"), "utf8");
const report = fs.readFileSync(path.join(root, "LP240.3-CANONICAL-CONDITION-LABEL-AUDIT.md"), "utf8");

test("audit is passive and reports unavailable DOM truthfully", () => {
  const result = audit.auditMountedConditionLabels(null);
  assert.equal(result.authorityAvailable, false);
  assert.deepEqual(result.rows, []);
  assert.equal(result.summary.conditionCount, 0);
});

test("community canonical inventory and blocked semantics remain governed", () => {
  for (const key of ["flooding", "crash", "disabled_vehicle", "debris", "road_closed", "construction", "traffic_backup", "rail_blockage_delay", "rail_issue", "other_hazard"]) assert.match(app, new RegExp(`(?:value:\\s*|\\")${key}`));
  assert.match(governed, /blocked:\s*"blocked_crossing"/);
  assert.match(governed, /road_closed:\s*"closed_road"/);
  assert.match(governed, /flooding:\s*"flooded_road"/);
});

test("audit records the repaired shared display authority", () => {
  assert.match(app, /debris:\s*\{\s*label:\s*"Debris In Road"/s);
  assert.match(app, /function gridlyLp0541bCanonicalHazardLabel/);
  assert.match(app, /function gridlyBuildCanonicalLiveIncidentPresentation/);
  assert.match(report, /LP240\.3 audit baseline/);
  assert.match(report, /Debris \/ Obstruction/);
});

test("protected identity and roadway hierarchy are recorded as hard gates", () => {
  assert.match(report, /IDENTITY GATE/);
  assert.match(report, /road-first/);
  assert.match(report, /provider-specific NWS event/);
});
