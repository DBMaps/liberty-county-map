import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/gridlyRuntimePerformanceAudit.js", import.meta.url), "utf8");

function load(extra = {}) {
  let time = 100;
  const window = { performance: { now: () => time }, ...extra };
  window.__setTime = (value) => { time = value; };
  vm.runInNewContext(source, { window, globalThis: window, Date }, { filename: "gridlyRuntimePerformanceAudit.js" });
  return window;
}

function observedWindow(extra = {}) {
  let observer;
  class PerformanceObserver {
    constructor(callback) { this.callback = callback; this.queued = []; observer = this; }
    observe(options) { this.options = options; }
    takeRecords() { return this.queued.splice(0); }
  }
  const window = load({ PerformanceObserver, ...extra });
  return {
    window,
    queue(...entries) { observer.queued.push(...entries); },
    deliver(...entries) { observer.callback({ getEntries: () => entries }); },
    observer
  };
}

test("LP224 instrumentation is passive and introduces no scheduling or output mutation", () => {
  for (const forbidden of ["setInterval(", "setTimeout(", "requestAnimationFrame(", ".innerHTML", ".textContent", "MutationObserver"]) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(source, /instrumentationPassive: true/);
  assert.doesNotMatch(source, /debounce|throttle|sleep|delayMs|await new Promise/);
});

test("reset creates non-colliding generations and excludes buffered pre-reset Long Tasks", () => {
  const { window, queue, deliver } = observedWindow();
  const first = window.gridlyRuntimePerformanceAuditBegin("OPEN_ALERTS");
  assert.equal(first, "lp224-g1-1");
  queue({ name: "old-queued", startTime: 90, duration: 500 });
  window.__setTime(200);
  const reset = window.gridlyRuntimePerformanceAudit("reset");
  assert.equal(reset.measurementGeneration, 2);
  assert.equal(reset.nextTransactionId, "lp224-g2-1");
  deliver({ name: "old-buffered", startTime: 150, duration: 600 });
  assert.equal(window.gridlyRuntimePerformanceAuditBegin("IDLE"), "lp224-g2-1");
  assert.notEqual(first, "lp224-g2-1");
  assert.equal(window.gridlyRuntimePerformanceAudit().longTasks.length, 0);
});

test("Long Tasks receive transaction identity only inside explicit bounds and use durationMs", () => {
  const { window, deliver } = observedWindow();
  deliver({ name: "before", startTime: 99, duration: 51 });
  window.__setTime(110);
  const id = window.gridlyRuntimePerformanceAuditBegin("MAP_PAN");
  deliver({ name: "during", startTime: 115, duration: 88.456 });
  window.__setTime(130);
  const result = window.gridlyRuntimePerformanceAuditEnd(id);
  deliver({ name: "after", startTime: 131, duration: 75 });
  const audit = window.gridlyRuntimePerformanceAudit();
  assert.equal(result.longTasks[0].transactionId, id);
  assert.equal(result.longTasks[0].durationMs, 88.46);
  assert.equal("duration" in result.longTasks[0], false);
  assert.equal(audit.longTasks.find((entry) => entry.name === "before").transactionId, null);
  assert.equal(audit.longTasks.find((entry) => entry.name === "after").transactionId, null);
});

test("end returns required lifetime-counter deltas and bounded IDLE observation window", () => {
  const totals = { alerts: 2, merge: 4, weather: 6, crossings: 3 };
  const window = load({
    gridlyMainThreadAttributionAudit: () => ({ measuredFunctions: [
      { functionName: "alert snapshot creation", callCount: totals.alerts },
      { functionName: "alert merge", callCount: totals.merge },
      { functionName: "weather situation promotion", callCount: totals.weather },
      { functionName: "renderAlerts", callCount: totals.alerts },
      { functionName: "Alerts DOM generation", callCount: totals.alerts },
      { functionName: "KBYG writer", callCount: totals.alerts },
      { functionName: "Location Context writer", callCount: totals.alerts },
      { functionName: "Community Pulse writer", callCount: totals.alerts },
      { functionName: "hazard render", callCount: totals.alerts }
    ] }),
    gridlyCrossingRenderAudit: () => ({ renderCount: totals.crossings })
  });
  const id = window.gridlyRuntimePerformanceAudit("begin", "IDLE");
  totals.alerts += 3; totals.merge += 5; totals.weather += 7; totals.crossings += 2;
  window.__setTime(350);
  const result = window.gridlyRuntimePerformanceAudit("end", id);
  assert.equal(result.durationMs, 250);
  assert.equal(result.counterDeltas.alertSnapshotCreation, 3);
  assert.equal(result.counterDeltas.alertMerge, 5);
  assert.equal(result.counterDeltas.weatherPromotion, 7);
  assert.equal(result.counterDeltas.renderAlerts, 3);
  assert.equal(result.counterDeltas.alertsDomGeneration, 3);
  assert.equal(result.counterDeltas.authoritativeAlertsWriter, 3);
  assert.equal(result.counterDeltas.kbygWriter, 3);
  assert.equal(result.counterDeltas.locationContextWriter, 3);
  assert.equal(result.counterDeltas.communityPulseWriter, 3);
  assert.equal(result.counterDeltas.hazardRender, 3);
  assert.equal(result.counterDeltas.crossingRender, 2);
  assert.equal(window.gridlyRuntimePerformanceAudit().idle.observationWindowMs, 250);
});

test("canonical community is read passively from governed runtime authority", () => {
  const window = load({
    GRIDLY_ACTIVE_COUNTY_ID: "hopkins-tx",
    gridlyGetCanonicalActiveCommunityState: () => ({ selectedAwarenessArea: { label: "Sulphur Springs" } })
  });
  const audit = window.gridlyRuntimePerformanceAudit();
  assert.equal(audit.session.canonicalCommunity, "Sulphur Springs");
  assert.equal(audit.session.activeCountyId, "hopkins-tx");
});

test("unsupported observer and failing legacy helpers fail closed", () => {
  const window = load({ gridlyRefreshBreakdownAudit() { throw new Error("unavailable"); } });
  const audit = window.gridlyRuntimePerformanceAudit();
  assert.equal(audit.available, true);
  assert.equal(audit.longTaskObservationSupported, false);
  assert.equal(audit.longTasks.length, 0);
});

test("audit remains diagnostic, keeps production writers, and never authorizes optimization", () => {
  const renderAlerts = () => "authoritative";
  const window = load({ renderAlerts, gridlyMainThreadAttributionAudit: () => ({ measuredFunctions: [{ functionName: "renderAlerts", category: "alert-rendering", callCount: 2, maxDuration: 64 }] }) });
  const audit = window.gridlyRuntimePerformanceAudit();
  assert.equal(window.renderAlerts, renderAlerts);
  assert.equal(audit.surfaces.alerts.authoritativeWriteCount, 2);
  assert.equal(audit.firstExpensiveStage, null);
  assert.equal(audit.safeToOptimize, false);
});

test("LP224 contains no arbitrary delay, town-specific production logic, or optimization", () => {
  assert.doesNotMatch(source, /Sulphur Springs|Pecos|Eastland|Huntsville|Del Rio|Cienegas Terrace|Box Canyon/i);
  assert.doesNotMatch(source, /optimi[sz]e|removeEventListener|cancelAnimationFrame|clearInterval|clearTimeout/);
});
