import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const auditSource = fs.readFileSync(new URL("../js/gridlyRuntimePerformanceAudit.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

function harness() {
  let time = 100; let observer;
  class PerformanceObserver { constructor(callback) { this.callback = callback; this.rows = []; observer = this; } observe() {} takeRecords() { return this.rows.splice(0); } }
  const window = { performance: { now: () => time }, PerformanceObserver };
  vm.runInNewContext(auditSource, { window, globalThis: window, Date }, { filename: "gridlyRuntimePerformanceAudit.js" });
  return { window, at(value) { time = value; }, queue(row) { observer.rows.push(row); } };
}

test("LP225 subsystem timing is passive, bounded, and requires explicit lineage", () => {
  const h = harness();
  assert.equal(h.window.gridlyRuntimePerformanceAuditRecordSubsystemTiming({ subsystem: "MAP", boundaryName: "render", trigger: "idle refresh", caller: "owner", startTime: 90, endTime: 99 }), null);
  const id = h.window.gridlyRuntimePerformanceAudit("begin", "IDLE");
  assert.equal(h.window.gridlyRuntimePerformanceAuditRecordSubsystemTiming({ subsystem: "MAP", boundaryName: "render", startTime: 101, endTime: 120 }), null);
  const row = h.window.gridlyRuntimePerformanceAuditRecordSubsystemTiming({ subsystem: "MAP", boundaryName: "render", trigger: "report completion", caller: "refreshReportHazardViews", startTime: 101, endTime: 120, mapMutationOccurred: true, outputChanged: false, noOp: true });
  assert.equal(row.transactionId, id); assert.equal(row.noOp, true);
  h.at(130); const result = h.window.gridlyRuntimePerformanceAudit("end", id);
  assert.equal(result.subsystemTimings.length, 1); assert.equal(result.ownerLineage[0].trigger, "report completion");
});

test("LP225 overlap remains correlation-only and excludes historical long tasks", () => {
  const h = harness(); h.window.gridlyRuntimePerformanceAudit("reset");
  h.queue({ name: "longtask", startTime: 50, duration: 80 });
  const id = h.window.gridlyRuntimePerformanceAudit("begin", "IDLE");
  h.window.gridlyRuntimePerformanceAuditRecordSubsystemTiming({ subsystem: "CROSSINGS", boundaryName: "renderCrossings", trigger: "package completion", caller: "loadCrossings", startTime: 101, endTime: 180 });
  h.queue({ name: "longtask", startTime: 110, duration: 60 }); h.at(200);
  const result = h.window.gridlyRuntimePerformanceAudit("end", id);
  assert.equal(result.longTasks.length, 1); assert.equal(result.longTaskOwnerOverlap[0].classification, "EXACT_OWNER_OVERLAP");
  assert.equal(result.longTaskOwnerOverlap[0].causationClaimed, false); assert.equal(result.rootCauseConfidence, "UNKNOWN"); assert.equal(result.safeToOptimize, false);
});

test("LP225 distinguishes audit candidates without changing production schedulers or outputs", () => {
  const h = harness(); const id = h.window.gridlyRuntimePerformanceAudit("begin", "IDLE");
  h.window.gridlyRuntimePerformanceAuditRecordSubsystemTiming({ subsystem: "AUDIT", boundaryName: "census", trigger: "explicit diagnostic", caller: "diagnostic", startTime: 101, endTime: 180, auditOnly: true });
  h.queue({ name: "longtask", startTime: 110, duration: 60 }); h.at(200);
  const result = h.window.gridlyRuntimePerformanceAudit("end", id);
  assert.equal(result.longTaskOwnerOverlap[0].classification, "AUDIT_OVERHEAD_CANDIDATE");
  assert.equal(result.auditOverheadAssessment.auditOnlyOverlapCount, 1);
  for (const forbidden of ["globalScope.setTimeout =", "globalScope.setInterval =", "globalScope.requestAnimationFrame =", "globalScope.fetch ="]) assert.equal(auditSource.includes(forbidden), false);
  assert.doesNotMatch(auditSource, /debounce|throttle|deepEqual/);
  assert.match(appSource, /gridlyRuntimePerformanceAuditRecordSubsystemTiming/);
  assert.doesNotMatch(appSource.slice(appSource.indexOf("function gridlyV920Measure"), appSource.indexOf("function gridlyV920StableSignature")), /setInterval|setTimeout|requestAnimationFrame\s*=/);
});

test("LP225 has no town-specific attribution, writer replacement, or global browser monkey patch", () => {
  assert.doesNotMatch(auditSource, /Sulphur Springs|Del Rio|Eastland|Huntsville|Pecos/i);
  assert.doesNotMatch(auditSource, /renderAlerts\s*=|renderGridlyCommunityPulse\s*=|localStorage\.setItem/);
  assert.match(auditSource, /instrumentationPassive: true/);
});
