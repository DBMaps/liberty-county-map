import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/gridlyRuntimePerformanceAudit.js", import.meta.url), "utf8");

function load(extra = {}) {
  const window = { performance: { now: (() => { let value = 100; return () => ++value; })() }, ...extra };
  vm.runInNewContext(source, { window, globalThis: window, Date }, { filename: "gridlyRuntimePerformanceAudit.js" });
  return window;
}

test("LP224 instrumentation is passive and introduces no scheduling or output mutation", () => {
  for (const forbidden of ["setInterval(", "setTimeout(", "requestAnimationFrame(", ".innerHTML", ".textContent", "MutationObserver"]) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(source, /instrumentationPassive: true/);
});

test("transaction IDs are monotonic, non-colliding, and reset deterministically", () => {
  const window = load();
  const first = window.gridlyRuntimePerformanceAuditBegin("open_alerts", "test");
  const second = window.gridlyRuntimePerformanceAuditBegin("map_pan", "test");
  assert.equal(first, "lp224-1");
  assert.equal(second, "lp224-2");
  assert.notEqual(first, second);
  window.gridlyRuntimePerformanceAuditEnd(second);
  assert.equal(window.gridlyRuntimePerformanceAuditReset().nextTransactionId, "lp224-1");
  assert.equal(window.gridlyRuntimePerformanceAuditBegin("idle"), "lp224-1");
});

test("unsupported observer and failing legacy helpers fail closed", () => {
  const window = load({ gridlyRefreshBreakdownAudit() { throw new Error("unavailable"); } });
  const audit = window.gridlyRuntimePerformanceAudit();
  assert.equal(audit.available, true);
  assert.equal(audit.longTaskObservationSupported, false);
  assert.equal(audit.longTasks.length, 0);
});

test("audit contract is deterministic and does not replace the Alerts writer", () => {
  const renderAlerts = () => "authoritative";
  const window = load({ renderAlerts, gridlyMainThreadAttributionAudit: () => ({ measuredFunctions: [{ functionName: "renderAlerts", category: "alert-rendering", callCount: 2, maxDuration: 64 }] }) });
  const first = window.gridlyRuntimePerformanceAudit();
  const second = window.gridlyRuntimePerformanceAudit();
  assert.equal(window.renderAlerts, renderAlerts);
  assert.equal(first.surfaces.alerts.authoritativeWriteCount, 2);
  assert.equal(first.firstExpensiveStage, "renderAlerts");
  assert.deepEqual(first.surfaces, second.surfaces);
});

test("LP224 contains no arbitrary delay or town-specific production logic", () => {
  assert.doesNotMatch(source, /Sulphur Springs|Pecos|Eastland|Huntsville|Del Rio|Cienegas Terrace|Box Canyon/i);
  assert.doesNotMatch(source, /sleep|delayMs|await new Promise/);
});
