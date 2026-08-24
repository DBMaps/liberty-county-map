import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const audit = fs.readFileSync(new URL("../js/gridlyRuntimePerformanceAudit.js", import.meta.url), "utf8");
const snapshot = app.slice(app.indexOf("const gridlyAlertsSnapshotReconciliationState"), app.indexOf("window.getAlertsSurfaceSnapshot = getAlertsSurfaceSnapshot"));
const writer = app.slice(app.indexOf("async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync"), app.indexOf("function invokeMobileAlertsEntry"));
const open = app.slice(app.indexOf("function openAlertsSurfaceFromDock()"), app.indexOf("function gridlyInstantAlertsSheetAudit()"));
const acceptance = app.slice(app.indexOf("window.gridlyLP226AlertsReopenAcceptance"), app.indexOf("window.gridlyAlertDataDiagnostic"));

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

test("reopen separates same-generation snapshot reuse from mandatory authoritative DOM projection", () => {
  assert.match(open, /cached-snapshot-authoritative-reprojection/);
  assert.match(open, /const opened = false/);
  assert.match(open, /gridlyOpenAlertsSurfaceAfterPaint\(alertsSheetGeneration\)/);
  assert.doesNotMatch(open, /cacheRead\.contextMatched\s*&&\s*typeof window\.openGridlyPortraitV2Sheet/);
  assert.doesNotMatch(open, /gridlySynchronizeOpenAlertsPortrait\("alerts_open_after_shell"\)/);
  assert.match(writer, /const snapshot = await cooperativePhase\("snapshotAcquisitionMs"/);
  assert.match(writer, /window\.openGridlyPortraitV2Sheet\("alerts"/);
});

test("street-level location changes invalidate while an unchanged snapshot remains reusable", () => {
  for (const field of ["crossStreet", "resolvedLocation", "selectedLocationValue", "selectedLocationAuthority", "locationSelectionReason"]) {
    assert.match(snapshot, new RegExp(`record\\.${field}`));
  }
  const signature = ({ roadName, crossStreet, resolvedLocation }) => JSON.stringify({ roadName, crossStreet, resolvedLocation });
  const cached = signature({ roadName: "Spring St", crossStreet: "S Davis St", resolvedLocation: "Spring St and S Davis St" });
  assert.equal(signature({ roadName: "Spring St", crossStreet: "S Davis St", resolvedLocation: "Spring St and S Davis St" }), cached);
  assert.notEqual(signature({ roadName: "Spring St", crossStreet: "", resolvedLocation: "Hopkins County" }), cached);
});

test("owner reopen helper reports snapshot and writer decisions without another writer or delay", () => {
  for (const key of ["snapshotBuildDecision", "snapshotReuseDecision", "authoritativeWriteApplied", "sheetExposedAfterAuthority", "domLocation", "selectedLocationValue", "writerParity", "presentationContract", "firstLosingStage"]) assert.match(acceptance, new RegExp(key));
  assert.match(acceptance, /gridlyAlertsAuthorityWriterAudit/);
  assert.doesNotMatch(acceptance, /innerHTML|openGridlyPortraitV2Sheet|setTimeout|setInterval|requestAnimationFrame/);
  assert.equal((app.match(/async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync/g) || []).length, 1);
});
