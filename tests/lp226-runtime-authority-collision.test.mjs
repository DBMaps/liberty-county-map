import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const published = fs.readFileSync(new URL("../js/gridlyAlertsPublishedAwareness.js", import.meta.url), "utf8");
const activation = fs.readFileSync(new URL("../js/gridlyCrossingProviderActivationAudit.js", import.meta.url), "utf8");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const body = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const authoritativeOpen = functionSource(app, "openAlertsSurfaceFromDock");

function productionJavaScript() {
  return fs.readdirSync(new URL("../js", import.meta.url))
    .filter(file => file.endsWith(".js"))
    .map(file => [file, fs.readFileSync(new URL(`../js/${file}`, import.meta.url), "utf8")]);
}

test("app.js is the exactly one production dock-open authority", () => {
  const authorities = productionJavaScript().flatMap(([file, source]) => {
    const definitions = source.match(/function\s+openAlertsSurfaceFromDock\s*\(/g) || [];
    const assignments = source.match(/(?:window|globalThis)\.openAlertsSurfaceFromDock\s*=/g) || [];
    return Array(definitions.length + assignments.length).fill(file);
  });
  assert.deepEqual(authorities, ["app.js"]);
  assert.match(authoritativeOpen, /gridlyOpenAlertsSurfaceAfterPaint\(alertsSheetGeneration\)/);
  assert.doesNotMatch(authoritativeOpen, /alerts_open_is_cache_only/);
});

test("the asynchronously loaded published-awareness module cannot replace either load order", () => {
  const authoritative = vm.runInNewContext(`(${authoritativeOpen})`);
  for (const moduleFirst of [false, true]) {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    if (moduleFirst) vm.runInContext(published, sandbox);
    sandbox.window.openAlertsSurfaceFromDock = authoritative;
    if (!moduleFirst) vm.runInContext(published, sandbox);
    assert.equal(sandbox.window.openAlertsSurfaceFromDock, authoritative);
    const runtimeSource = Function.prototype.toString.call(sandbox.window.openAlertsSurfaceFromDock);
    assert.match(runtimeSource, /gridlyOpenAlertsSurfaceAfterPaint/);
    assert.doesNotMatch(runtimeSource, /alerts_open_is_cache_only/);
  }
  assert.match(activation, /appendChild\(alertsScript\)/);
  assert.match(activation, /afterPublisherLoaded[\s\S]*loadAlertsConsumer\(\)/);
});

test("dock entry dynamically invokes the authoritative owner and dispatches LP223 writer", () => {
  const invoke = functionSource(app, "invokeMobileAlertsEntry");
  const afterPaint = functionSource(app, "gridlyOpenAlertsSurfaceAfterPaint");
  assert.match(invoke, /openAlertsSurfaceFromDock\(\)/);
  assert.doesNotMatch(invoke, /const\s+\w+\s*=\s*openAlertsSurfaceFromDock\s*(?!\()/);
  assert.match(afterPaint, /gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply\(alertsSheetGeneration\)/);
  assert.equal((app.match(/async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync/g) || []).length, 1);
  assert.match(authoritativeOpen, /cached-snapshot-authoritative-reprojection/);
  assert.match(authoritativeOpen, /authoritativeWriteDispatchAttempted = true/);
});

test("published-awareness retains legitimate helper exports without opener lifecycle or polling", () => {
  for (const helper of [
    "gridlyGetPublishedCommunityAwarenessSummaryForAlerts",
    "gridlyGetPublishedAwarenessAlertRecordsForCurrentArea",
    "gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords"
  ]) {
    assert.match(published, new RegExp(`window\\.${helper}\\s*=`));
  }
  assert.doesNotMatch(published, /openAlertsSurfaceFromDock|alerts_open_is_cache_only/);
  assert.doesNotMatch(published, /setTimeout|setInterval|requestAnimationFrame/);
  assert.match(published, /data-gridly-alert-row="true"/);
});
