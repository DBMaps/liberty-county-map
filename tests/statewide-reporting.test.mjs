import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { certify, genericHazardPolicy, reconcileCrossingCapabilities } from "../tools/certify-statewide-reporting.mjs";

test("statewide reporting protects all governed identities and crossing cohorts", () => {
  const { counts } = certify();
  assert.deepEqual([counts.countiesPassed, counts.uniqueFips, counts.placesPassed, counts.multiCountyPlaces], [254, 254, 1859, 163]);
  assert.deepEqual([counts.zeroFraCounties, counts.sourceOnlyCounties, counts.activeRuntimeCounties], [54, 173, 28]);
  assert.equal(certify().passed, true);
  assert.deepEqual([counts.ACTIVE_POSITIVE, counts.ACTIVE_EMPTY, counts.SOURCE_ONLY_POSITIVE, counts.SOURCE_ZERO_NOT_ACTIVATED], [27, 1, 173, 53]);
  assert.equal(counts.governedCrossingPartitionCount, 254);
  assert.deepEqual([counts.mapVisible, counts.alertsVisible, counts.awarenessActive, counts.crossingDependencyFailures], [254, 254, 254, 0]);
});

test("crossing source sets reconcile and runtime precedence partitions all counties", () => {
  const capability = JSON.parse(fs.readFileSync("reports/statewide-capability-audit/county-capability-matrix.json")).counties;
  const result = reconcileCrossingCapabilities(capability);
  assert.deepEqual(result.counts, { A: 254, Z: 54, P: 200, R: 28, S: 173 });
  assert.equal(result.sourceContractReconciled, true);
  assert.equal(result.partitionValid, true);
  assert.deepEqual(result.intersections["Z ∩ P"], []);
  assert.deepEqual(result.intersections["Z ∩ R"], ["tyler-tx"]);
  assert.deepEqual(result.intersections["S ∩ R"], []);
  assert.deepEqual(result.intersections["R - P"], ["tyler-tx"]);
  const partition = Object.values(result.classes).flat();
  assert.equal(partition.length, 254);
  assert.equal(new Set(partition).size, 254, "no county may occur twice or be silently dropped");
  assert.ok(result.classes.ACTIVE_EMPTY.includes("tyler-tx"));
  assert.ok(!result.classes.SOURCE_ZERO_NOT_ACTIVATED.includes("tyler-tx"), "active runtime takes precedence");
});

test("Waco helper has a browser-invokable read-only export", async () => {
  const source = fs.readFileSync("reports/statewide-capability-recovery/live-waco-report-select-helper.js", "utf8");
  assert.doesNotMatch(source, /\.(?:insert|update|delete)\s*\(/i);
  const calls = [];
  const builder = new Proxy({}, { get(_target, name) {
    if (name === "then") return (resolve) => resolve({ data: [{ id: "waco-fixture", created_at: "2026-08-16T00:00:00Z" }], error: null });
    return (...args) => { calls.push([name, ...args]); return builder; };
  }});
  globalThis.supabaseClient = { from(table) { calls.push(["from", table]); return builder; } };
  const { selectRecentWacoFloodingReport } = await import("../reports/statewide-capability-recovery/live-waco-report-select-helper.js");
  assert.equal(typeof selectRecentWacoFloodingReport, "function");
  assert.equal((await selectRecentWacoFloodingReport()).status, "FOUND");
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "county_id" && call[2] === "mclennan-tx"));
  assert.ok(calls.some((call) => call[0] === "order" && call[1] === "created_at"));
  delete globalThis.supabaseClient;
});

test("generic hazard policy never depends on crossing runtime", () => {
  for (const crossingRuntime of [undefined, false, true]) assert.deepEqual(genericHazardPolicy({ reportKind: "hazard", expired: false, countyFips: "48001", crossingRuntime }), { persistenceEligible: true, retrievalEligible: true, mapVisible: true, alertsVisible: true, awarenessState: "active", crossingRuntimeRequired: false });
});

test("runtime uses governed FIPS and statewide PLACE presentation candidates", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  assert.match(source, /function gridlyGetCountyReportingIdentity/);
  assert.match(source, /Object\.entries\(gridlyPlacePresentationTargets\)/);
  assert.match(source, /countyFips: gridlyGetCountyReportingIdentity/);
});

test("report insert errors remain consumer-visible failures", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  assert.match(source, /if \(error\) throw error/);
  assert.doesNotMatch(source, /gridlyInsertWithCountyMetadataFallback[\s\S]{0,500}catch\s*\([^)]*\)\s*\{\s*return\s*\{\s*error:\s*null/);
});
