import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { audit, sourceMatrix, sources, quietCopy, counties, outputs, HEALTH, TRUTH } from "../tools/lp205/build-statewide-source-health-quiet-state-audit.mjs";

const bySource = Object.fromEntries(sources.map((row) => [row.id, row]));
const byCopy = Object.fromEntries(quietCopy.map((row) => [row.statement, row]));

test("evaluates all counties and governed crossing cohorts", () => {
  assert.equal(counties.length, 254);
  assert.equal(sourceMatrix.cohortCounts.activePositiveCrossings, 202);
  assert.equal(sourceMatrix.cohortCounts.activeEmptyCrossings, 52);
  assert.ok(counties.every((county) => ["ACTIVE_POSITIVE", "ACTIVE_EMPTY"].includes(county.sourceHealth.crossings)));
});

test("classifies official and missing weather sources", () => {
  assert.equal(bySource.drivetexas.runtimeStatus, "INACTIVE_BY_DEFAULT");
  assert.equal(bySource.nws_alerts.runtimeStatus, "INACTIVE_BY_DEFAULT");
  assert.equal(bySource.weather_products.runtimeStatus, "NOT_IMPLEMENTED");
  assert.match(bySource.drivetexas.failureSemantics, /failure becomes \[\]/);
  assert.match(bySource.nws_alerts.zeroSemantics, /inactive and healthy-zero/);
});

test("represents report zero, unavailable, failure, startup, and freshness semantics", () => {
  assert.match(bySource.reports.zeroSemantics, /not proof/);
  assert.match(bySource.reports.unavailable, /returns null/);
  assert.match(bySource.reports.failureSemantics, /startup \[\]/);
  assert.equal(audit.findings.some((row) => row.rootCauses.includes("REPORT_FAILURE_COLLAPSES_TO_ZERO")), true);
  assert.equal(audit.findings.some((row) => row.rootCauses.includes("STARTUP_UNKNOWN_PRESENTED_AS_QUIET")), true);
});

test("identifies quiet copy owners and semantic scope", () => {
  assert.ok(quietCopy.length >= 8);
  assert.equal(byCopy["Community is quiet."].classification, "AMBIGUOUS");
  assert.equal(byCopy["Travel normally today."].classification, "FALSE_UNDER_KNOWN_SOURCE_GAP");
  assert.match(byCopy["Travel normally today."].owner, /Awareness Card/);
  assert.equal(audit.conclusion.failureOrInactivityCanLookQuiet, true);
});

test("models required deterministic scenarios and county switching", () => {
  assert.deepEqual(audit.scenarios.map((row) => row.id), [1,2,3,4,5,6,7,8]);
  assert.match(audit.scenarios[7].result, /startup|initial|arrays/i);
  assert.deepEqual(audit.statewide.countySwitchSequence, ["liberty-tx","sherman-tx","dallas-tx","andrews-tx","tyler-tx"]);
});

test("uses controlled vocabularies and declares audit-only production isolation", () => {
  for (const source of sources) for (const state of source.healthStates) assert.ok(HEALTH.includes(state), state);
  for (const row of quietCopy) assert.ok(TRUTH.includes(row.classification), row.classification);
  assert.equal(audit.auditOnly, true);
  assert.equal(audit.productionFilesModified, false);
  assert.equal(audit.sharedHealthModel.exists, false);
  assert.ok(audit.findings.every((row) => /^P[0-4]$/.test(row.priority)));
});

test("generated artifacts exist and no production path is an LP205 output", () => {
  for (const name of ["statewide-source-health-and-quiet-state-truthfulness-audit.json", "source-health-matrix.json", "LP205-STATEWIDE-SOURCE-HEALTH-AND-QUIET-STATE-TRUTHFULNESS-AUDIT.md"]) {
    assert.equal(fs.existsSync(new URL(`../reports/lp205/${name}`, import.meta.url)), true);
  }
  assert.deepEqual(Object.keys(outputs).sort(), ["LP205-STATEWIDE-SOURCE-HEALTH-AND-QUIET-STATE-TRUTHFULNESS-AUDIT.md", "source-health-matrix.json", "statewide-source-health-and-quiet-state-truthfulness-audit.json"]);
});
