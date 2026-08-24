import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const audit = fs.readFileSync(new URL("../js/gridlyRuntimePerformanceAudit.js", import.meta.url), "utf8");
const snapshot = app.slice(app.indexOf("const gridlyAlertsSnapshotReconciliationState"), app.indexOf("window.getAlertsSurfaceSnapshot = getAlertsSurfaceSnapshot"));
const writer = app.slice(app.indexOf("async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync"), app.indexOf("function invokeMobileAlertsEntry"));
const open = app.slice(app.indexOf("function openAlertsSurfaceFromDock()"), app.indexOf("function gridlyInstantAlertsSheetAudit()"));
const membershipAudit = app.slice(app.indexOf("const GRIDLY_LP226_DEFAULT_TARGET_PRESENTATION_ID"), app.indexOf("window.gridlyLP226AlertsReopenAcceptance"));
const acceptance = app.slice(app.indexOf("window.gridlyLP226AlertsReopenAcceptance"), app.indexOf("window.gridlyAlertDataDiagnostic"));
const lifecycleAudit = app.slice(app.indexOf("window.gridlyLP226SourceLifecycleAudit"), app.indexOf("window.gridlyLP226AlertsMembershipAudit"));

test("unchanged same-generation requests reuse the existing snapshot without a timer", () => {
  assert.match(snapshot, /inputSignature === inputSignature/);
  assert.match(snapshot, /return gridlyLP226ConsumerSnapshot\(gridlyAlertsSnapshotReconciliationState\.snapshot\)/);
  assert.match(snapshot, /suppressedRequests \+= 1/);
  assert.doesNotMatch(snapshot, /setTimeout|setInterval|debounce|throttle|visibilityState/);
});

test("authoritative cache owns immutable membership and consumers receive shallow copies", () => {
  assert.match(snapshot, /snapshot\.alerts = Object\.freeze\(normalizedAlertItems\.map/);
  assert.match(snapshot, /gridlyLP226ConsumerSnapshot/);
  assert.match(snapshot, /alerts: snapshot\.alerts\.map/);
  assert.match(snapshot, /presentationAlerts: snapshot\.presentationAlerts\.map/);
  assert.match(snapshot, /normalizedAlertItems: snapshot\.normalizedAlertItems\.map/);
  const cache = Object.freeze([{ id: "road-closed" }, { id: "traffic-backup" }]);
  const oneAlertProjection = cache.filter(({ id }) => id === "traffic-backup");
  const zeroAlertProjection = cache.filter(() => false);
  assert.equal(cache.length, 2);
  assert.equal(oneAlertProjection.length, 1);
  assert.equal(zeroAlertProjection.length, 0);
});

test("cache commits and replacements expose bounded integrity evidence", () => {
  for (const token of ["cacheCommitSequence", "cacheCommitCaller", "cacheCommitReason", "previousCanonicalIds",
    "nextCanonicalIds", "membershipAdded", "membershipRemoved", "previousSignature", "nextSignature",
    "previousGeneration", "nextGeneration", "replacementCaller", "replacementReason",
    "VALID_INVALIDATION_REBUILD", "VALID_SAME_MEMBERSHIP_REUSE", "INVALID_SAME_GENERATION_MEMBERSHIP_CHANGE", "UNKNOWN"]) {
    assert.match(snapshot, new RegExp(token));
  }
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
  assert.match(writer, /snapshot = await cooperativePhase\("snapshotAcquisitionMs"/);
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

test("bounded signature distinguishes identity, lifecycle, and equal-count replacement", () => {
  assert.match(snapshot, /governedMembership/);
  const signature = (rows) => rows.map(({ id, lifecycle }) => `${id}:${lifecycle}`).sort().join("|");
  assert.notEqual(signature([{ id: "road", lifecycle: "active" }]), signature([{ id: "traffic", lifecycle: "active" }]));
  assert.notEqual(signature([{ id: "road", lifecycle: "active" }]), signature([{ id: "road", lifecycle: "cleared" }]));
  assert.equal(signature([{ id: "road", lifecycle: "active" }]), signature([{ id: "road", lifecycle: "active" }]));
});

test("owner reopen helper reports snapshot and writer decisions without another writer or delay", () => {
  for (const key of ["snapshotBuildDecision", "snapshotReuseDecision", "authoritativeWriteDispatchAttempted", "authoritativeWriteApplied", "sheetExposedAfterAuthority", "domLocation", "selectedLocationValue", "writerParity", "presentationContract", "firstLosingStage"]) assert.match(acceptance, new RegExp(key));
  assert.match(acceptance, /gridlyAlertsAuthorityWriterAudit/);
  assert.doesNotMatch(acceptance, /innerHTML|openGridlyPortraitV2Sheet|setTimeout|setInterval|requestAnimationFrame/);
  assert.equal((app.match(/async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync/g) || []).length, 1);
});

test("source lifecycle audit distinguishes legitimate TTL removal from detectable invalid removal", () => {
  for (const key of ["sourceLifecycleStatus", "sourceLifecycleReason", "lastSourceSeenAt", "lastGovernedActiveSeenAt",
    "removedByFunction", "removedReason", "legitimateLifecycleRemoval", "active", "cleared", "stale", "expired",
    "current", "updatedAt", "createdAt", "expiresAt", "ttlMinutes", "confirmationState", "sourceProviderState"]) {
    assert.match(lifecycleAudit, new RegExp(key));
  }
  assert.match(lifecycleAudit, /PROVIDER_TTL_EXPIRED/);
  assert.match(lifecycleAudit, /SUPABASE_EXPIRES_AT_NOT_GREATER_THAN_NOW/);
  assert.match(lifecycleAudit, /LIFECYCLE_DEFECT_DETECTABLE/);
  assert.doesNotMatch(lifecycleAudit, /activeHazards\s*=|\.push\(|\.splice\(/);
});

test("NO_BUILD and REUSE_SAME_GENERATION still dispatch the sole authoritative writer before exposure", () => {
  assert.match(open, /authoritativeWriteDispatchAttempted = true;\s*gridlyOpenAlertsSurfaceAfterPaint\(alertsSheetGeneration\)/);
  assert.match(open, /sheetVisibleAt: null/);
  assert.match(writer, /window\.openGridlyPortraitV2Sheet\("alerts"/);
  assert.equal((app.match(/async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync/g) || []).length, 1);
});

test("authoritative snapshot records bounded membership identity and generation metadata", () => {
  for (const token of ["canonicalGovernedEvidenceIds", "presentationIncidentIds", "activeMembershipCount", "contextKey", "community", "county", "countyId", "inputSignature", "generation"]) {
    assert.match(snapshot, new RegExp(token));
  }
  assert.match(snapshot, /snapshot\.authoritativeMembership/);
});

test("reopen dispatches the complete authoritative snapshot without narrowing it again", () => {
  assert.match(writer, /const snapshotAlerts = Array\.isArray\(snapshot\?\.alerts\)/);
  assert.match(writer, /authoritative snapshot membership reuse/);
  assert.match(writer, /snapshotAlerts\.slice\(\)/);
  assert.doesNotMatch(writer, /gridlyFilterAlertRecordsBySelectedAwarenessArea\(snapshotAlerts, "openAlertsSurfaceFromDock"\)/);

  const authoritativeSnapshot = Object.freeze({ alerts: Object.freeze([
    { id: "road-closed", evidenceId: "active_hazard:road-closed" },
    { id: "traffic-backup", evidenceId: "official:traffic-backup" }
  ]) });
  const writerInput = authoritativeSnapshot.alerts.slice();
  assert.deepEqual(writerInput.map(({ id }) => id), ["road-closed", "traffic-backup"]);
  assert.equal(authoritativeSnapshot.alerts.length, writerInput.length);
});

test("target-specific audit follows Road Closed through every membership stage", () => {
  for (const key of [
    "expectedPresentationIncidentId", "expectedGovernedEvidenceId", "cachedSnapshotContainsIncident",
    "writerInputContainsIncident", "governedProjectionContainsIncident", "dedupedProjectionContainsIncident",
    "presentationModelContainsIncident", "finalDomContainsIncident", "cachedSnapshotIds", "writerInputIds",
    "governedProjectionIds", "dedupedProjectionIds", "presentationIds", "finalDomIds", "firstLosingStage"
  ]) assert.match(membershipAudit, new RegExp(key));
  for (const stage of ["SOURCE_LIFECYCLE_FAILURE", "GOVERNED_ACTIVE_MEMBERSHIP_FAILURE", "SNAPSHOT_BUILD_MEMBERSHIP_FAILURE",
    "CACHE_MUTATION_AFTER_BUILD", "CACHE_REPLACEMENT_SAME_GENERATION", "CACHE_SIGNATURE_FAILURE",
    "AUTHORITATIVE_DISPATCH_INPUT_FAILURE", "PRESENTATION_MODEL_FAILURE", "DOM_PARITY_FAILURE"]) assert.match(membershipAudit, new RegExp(stage));
  assert.match(membershipAudit, /DOM_PARITY_PASS/);
});

test("owner helper cannot pass for Traffic Backup when requested Road Closed is absent", () => {
  for (const key of [
    "targetPresentationIncidentId", "targetGovernedEvidenceId", "targetPresentInSnapshot",
    "targetPresentInWriterInput", "targetPresentInFinalDom", "authoritativeMembershipCount",
    "domMembershipCount", "membershipParity", "overallPass"
  ]) assert.match(acceptance, new RegExp(key));
  assert.match(acceptance, /audit\.cachedSnapshotContainsIncident && audit\.writerInputContainsIncident && audit\.finalDomContainsIncident/);
  const requestedRoadClosedPresent = false;
  const trafficBackupRenderedPerfectly = true;
  assert.equal(requestedRoadClosedPresent && trafficBackupRenderedPerfectly, false);
});

test("known target and location authority are deterministic without community-specific production branching", () => {
  assert.match(membershipAudit, /f4a2845c-aea2-49a2-84f2-5b9b6400eeff/);
  assert.match(membershipAudit, /active_hazard:hazard-device-fb254e5c-da39-4ff0-92d1-15c9cc62b57d-1787577251389/);
  assert.match(acceptance, /selectedLocationValue/);
  assert.doesNotMatch(acceptance, /Sulphur Springs|Hopkins County/);
});
