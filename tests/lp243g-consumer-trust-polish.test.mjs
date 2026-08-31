import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("G1 uses Home Area in the current Portrait Settings helper", () => {
  const preconditions = app.slice(app.indexOf("function getV2PreconditionsState"), app.indexOf("function refreshRouteButtonStates"));
  assert.match(preconditions, /Set Home Area and preferences/);
  assert.doesNotMatch(preconditions, /Home Town|Home town|Hometown/);
});

test("G2 presents stored controls as future preferences without adding delivery", () => {
  const settings = app.slice(app.indexOf("function buildSettingsSurfaceHtml"), app.indexOf("function buildReportHazardSurfaceHtml"));
  assert.match(settings, /Notification delivery is coming soon\. Save the updates you want to receive when it becomes available\./);
  assert.match(settings, /data-v2-settings-field="notifications\.routeAlerts"/);
  assert.match(app, /localStorage\.setItem\(GRIDLY_SETTINGS_STORAGE_KEY, JSON\.stringify\(normalized\)\)/);
  assert.doesNotMatch(app, /Notification\.requestPermission|new Notification\s*\(|PushManager|pushManager/);
  assert.doesNotMatch(serviceWorker, /addEventListener\(["']push["']/);
});

test("G3 report prompt is removed as soon as placement actions enable", () => {
  const state = app.slice(app.indexOf("function getV2PreconditionsState"), app.indexOf("function markV2BlockedInteraction"));
  assert.match(state, /reportReason: reportHazardSelected \? ""/);
  assert.match(state, /helper\.hidden = !preconditions\.reportReason/);
  assert.match(state, /button\.disabled = disablePlacementActions/);
});

test("G4 places Selected in the candidate header while preserving confirmation", () => {
  const builder = app.slice(app.indexOf("function buildGridlySettingsAwarenessOptionsHtml"), app.indexOf("function renderGridlyManualAwarenessAreaPicker"));
  assert.match(builder, /<span>\$\{escapeGridlySettingsAttribute\(title\)\}<\/span>\$\{isCurrent/);
  assert.match(builder, /settings-manual-area-state">Selected/);
  assert.match(builder, /Use this Home Area/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(css, /\.settings-manual-area-state \{ grid-column: 2; grid-row: 1;/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("G5 keeps truthful missing freshness and DriveTexas provenance", () => {
  assert.match(app, /const unavailable = "Update time unavailable"/);
  assert.match(app, /Official Source · DriveTexas/);
  assert.match(app, /freshnessFallbackReason: fallbackReason/);
});

test("changed browser assets have LP243.G identities", () => {
  assert.match(index, /css\/styles\.css\?v=243g-home-area-badge/);
  assert.match(index, /js\/app\.js\?v=243g-consumer-trust-polish/);
});
