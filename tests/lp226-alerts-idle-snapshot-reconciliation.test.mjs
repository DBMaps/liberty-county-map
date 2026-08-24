import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const audit = fs.readFileSync(new URL("../js/gridlyRuntimePerformanceAudit.js", import.meta.url), "utf8");
const snapshot = app.slice(app.indexOf("const gridlyAlertsSnapshotReconciliationState"), app.indexOf("window.getAlertsSurfaceSnapshot = getAlertsSurfaceSnapshot"));
const writer = app.slice(app.indexOf("async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync"), app.indexOf("function invokeMobileAlertsEntry"));

test("unchanged same-generation requests reuse the existing snapshot without a timer", () => {
  assert.match(snapshot, /inputSignature === inputSignature/);
  assert.match(snapshot, /return gridlyAlertsSnapshotReconciliationState\.snapshot/);
  assert.match(snapshot, /suppressedRequests \+= 1/);
  assert.doesNotMatch(snapshot, /setTimeout|setInterval|debounce|throttle|visibilityState/);
});

test("every relevant Alerts dependency contributes to deterministic invalidation", () => {
  for (const token of ["activeReports", "activeHazards", "activeRecords", "confirmationCount", "lifecycleState", "crossingId", "gridlyDriveTexasConnector", "gridlyWeatherConnector", "selectedAwarenessArea", "countyId", "GRIDLY_ACTIVE_COUNTY_ID", "getSmartAlertsPreferences", "getRouteSurfaceSnapshot"]) assert.match(snapshot, new RegExp(token));
  assert.match(snapshot, /invalidations \+= 1/);
  assert.match(snapshot, /snapshotGeneration \+= 1/);
});

test("LP223 writer, concise cards, location and canonical identities remain protected", () => {
  assert.match(writer, /getAlertsSurfaceSnapshot/);
  assert.match(writer, /CONCISE_ALERT_CARD/);
  assert.match(writer, /data-gridly-governed-evidence-id/);
  assert.match(writer, /data-gridly-persisted-record-id/);
  assert.match(writer, /data-gridly-provider-record-id/);
  assert.match(app, /gridlyResolveAlertCanonicalGeography/);
  assert.match(app, /reportId: canonicalPresentation\.reportId/);
});

test("repair is generic and audit extends the bounded LP224/LP225 authority", () => {
  assert.doesNotMatch(snapshot, /Sulphur Springs|Hopkins|town|municipality\s*===/i);
  assert.match(audit, /const VERSION = "LP226"/);
  assert.match(audit, /gridlyRuntimePerformanceAuditRecordAlertsSnapshot/);
  assert.match(audit, /gridlyLP226AlertsIdleAcceptance/);
  assert.match(audit, /alertsSnapshotReconciliation/);
});
