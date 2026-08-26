const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const audit = require("../audits/lp2403-condition-label-audit.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const governed = fs.readFileSync(path.join(root, "js/governed-awareness.js"), "utf8");
const report = fs.readFileSync(path.join(root, "LP240.3-CANONICAL-CONDITION-LABEL-AUDIT.md"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

function condition(id, canonicalKey, displayLabel) {
  const label = { textContent: displayLabel };
  return {
    id,
    dataset: { gridlyLp236ConditionId: id, gridlyCanonicalHazardType: canonicalKey, gridlyAlertCondition: displayLabel },
    matches: () => false,
    querySelector: () => label,
    closest: () => null,
    contains: () => false
  };
}

function alertsRoot(rows, { connected = true, template = false } = {}) {
  return {
    isConnected: connected,
    querySelectorAll: () => rows,
    closest: (selector) => selector === "template" && template ? {} : null
  };
}

function documentFixture({ active = null, retained = null, historical = [] } = {}) {
  const sheetRoot = active || retained;
  const sheet = sheetRoot ? { querySelector: () => sheetRoot } : null;
  return {
    querySelector(selector) {
      if (selector === '#gridlyPortraitV2Sheet[data-active-sheet="alerts"]') return active ? sheet : null;
      if (selector === "#gridlyPortraitV2Sheet") return sheet;
      return null;
    },
    querySelectorAll: () => [...historical, ...(sheetRoot ? [sheetRoot] : [])]
  };
}

test("audit is passive and reports unavailable DOM truthfully", () => {
  const result = audit.auditMountedConditionLabels(null);
  assert.equal(result.authorityAvailable, false);
  assert.deepEqual(result.rows, []);
  assert.equal(result.summary.conditionCount, 0);
});

test("A/B/C/J: public audit passes the defined current Alerts root and returns its truthful summary", () => {
  const current = alertsRoot([
    condition("official-1", "lane_closure", "Lane Closure"),
    condition("community-1", "flooding", "Flooding")
  ]);
  const doc = documentFixture({ active: current });
  const previousDocument = global.document;
  global.document = doc;
  assert.doesNotThrow(() => global.gridlyLP240ConditionLabelAudit());
  if (previousDocument === undefined) delete global.document;
  else global.document = previousDocument;
  assert.equal(audit.resolveCurrentMountedRoot(doc), current);
  assert.equal(audit.auditMountedConditions(current).summary.conditionCount, 2);
  const result = audit.auditMountedConditionLabels(doc);
  assert.deepEqual(result.rows.map((row) => row.conditionId), ["official-1", "community-1"]);
  assert.deepEqual({ ...result.summary }, {
    conditionCount: 2, uniqueCanonicalKeyCount: 2, inconsistentLabelCount: 0,
    rawKeyLeakCount: 0, snakeCaseLeakCount: 0, lowercaseLabelCount: 0
  });
});

test("D: active or retained Portrait root outranks stale, detached, template, and historical roots", () => {
  const stale = alertsRoot([condition("stale", "road_closed", "Road Closed")]);
  const detached = alertsRoot([condition("detached", "crash", "Crash / Wreck")], { connected: false });
  const template = alertsRoot([condition("template", "debris", "Debris In Road")], { template: true });
  const newest = alertsRoot([condition("newest", "traffic_backup", "Traffic Backup / Heavy Delay")]);
  for (const fixture of [
    documentFixture({ active: alertsRoot([condition("active", "flooding", "Flooding")]), historical: [stale] }),
    documentFixture({ retained: alertsRoot([condition("retained", "construction", "Construction")]), historical: [stale] }),
    documentFixture({ historical: [stale, detached, template, newest] })
  ]) {
    assert.notEqual(audit.auditMountedConditionLabels(fixture).rows[0]?.conditionId, "stale");
  }
});

test("E: an empty current root is a valid available empty diagnostic", () => {
  const result = audit.auditMountedConditionLabels(documentFixture({ active: alertsRoot([]) }));
  assert.equal(result.authorityAvailable, true);
  assert.deepEqual(result.rows, []);
  assert.deepEqual({ ...result.summary }, {
    conditionCount: 0, uniqueCanonicalKeyCount: 0, inconsistentLabelCount: 0,
    rawKeyLeakCount: 0, snakeCaseLeakCount: 0, lowercaseLabelCount: 0
  });
});

test("F/I: audit implementation is read-only and condition identity remains untouched", () => {
  const source = fs.readFileSync(path.join(root, "audits/lp2403-condition-label-audit.js"), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=|\.textContent\s*=|appendChild|replaceChildren|setAttribute|fetch\s*\(|localStorage|sessionStorage|render|refresh|transition|publish/i);
  const node = condition("identity-stays", "traffic_backup", "Traffic Backup / Heavy Delay");
  const before = structuredClone(node.dataset);
  assert.equal(audit.auditMountedConditionLabels(documentFixture({ active: alertsRoot([node]) })).rows[0].conditionId, "identity-stays");
  assert.deepEqual(node.dataset, before);
});

test("G/H: formatter and LP240.2A projection stay protected; only audit cache revision advances", () => {
  const formatter = fs.readFileSync(path.join(root, "js/gridlyConditionDisplayLabel.js"), "utf8");
  assert.match(formatter, /COMMUNITY_LABELS/);
  assert.match(app, /class="gridly-lp236-roadway-group" data-gridly-disclosure-key=.*data-gridly-lp236-roadway=/);
  assert.equal((index.match(/lp2403-condition-label-audit\.js\?v=2403a1/g) || []).length, 1);
  assert.doesNotMatch(index, /lp2403-condition-label-audit\.js\?v=2403a["']/);
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
