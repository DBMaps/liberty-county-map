import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const writer = app.slice(app.indexOf("async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync"), app.indexOf("function invokeMobileAlertsEntry"));
const pulse = app.slice(app.indexOf("function buildGridlyCommunityPulseModel"), app.indexOf("function formatGridlyCommunityPulseTime"));

test("valid same-generation authoritative data skips only the pre-snapshot yield", () => {
  const fast = writer.slice(writer.indexOf("if (validSameGenerationSnapshot)"), writer.indexOf("const snapshotAlerts"));
  assert.match(fast, /snapshot = await cooperativePhase\("snapshotAcquisitionMs"/);
  assert.match(fast, /SNAPSHOT_ACQUIRED/);
  assert.doesNotMatch(fast.slice(0, fast.indexOf("} else {")), /cooperativeYieldOrCancel/);
  assert.match(writer, /cachedMembership\?\.contextKey === cooperativeBuildContextKey/);
  assert.match(writer, /cachedMembership\?\.revisionKey === cooperativeBuildRevisionKey/);
  assert.match(writer, /cachedMembership\?\.generation === gridlyAlertsSnapshotReconciliationState\.snapshotGeneration/);
});

test("transaction-local stages prove G1 cancellation and G2 writer/DOM progress", () => {
  for (const stage of ["PENDING_BEFORE_SNAPSHOT", "CANCELLED_BEFORE_SNAPSHOT", "SNAPSHOT_ACQUIRED", "PENDING_AFTER_SNAPSHOT", "CANCELLED_AFTER_SNAPSHOT", "WRITER_INPUT_ASSIGNED", "PRESENTATION_MODEL_BUILT", "DOM_APPLIED", "ERROR"]) assert.match(app, new RegExp(stage));
  assert.match(app, /gridlyLP226AlertsWriterTransactions\.set\(ownership\.alertsSheetGeneration, transaction\)/);
  assert.match(writer, /setTransactionStage\("WRITER_INPUT_ASSIGNED"/);
  assert.match(writer, /setTransactionStage\("DOM_APPLIED"/);
  assert.match(writer, /gridlyCanApplyAlertsSheetGeneration\(alertsSheetGeneration\)/);
});

test("reuse remains cached data routed through LP223 concise presentation, never cached DOM", () => {
  assert.match(writer, /snapshotAlerts\.slice\(\)/);
  assert.match(writer, /PRESENTATION_MODEL_BUILT/);
  assert.match(writer, /RenderCompleteAlertCard/);
  assert.match(writer, /CONCISE_ALERT_CARD/);
  assert.equal((app.match(/async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync/g) || []).length, 1);
  assert.doesNotMatch(writer, /cachedMarkup.*openGridlyPortraitV2Sheet|setInterval/);
});

test("governed KBYG rows enter one post-governance top-awareness presentation truth", () => {
  assert.match(pulse, /governedTopAwarenessCandidates/);
  assert.match(pulse, /governedEvidenceId: row\.evidenceId/);
  assert.match(pulse, /buildGridlyLightweightActiveAwareness\(\{[\s\S]*activeHazards: postGovernanceHazards,[\s\S]*governedEligibleTopAwarenessCount/);
  assert.match(pulse, /postGovernancePresentationTruth = true/);
  assert.ok(pulse.indexOf("governedTopAwarenessCandidates") < pulse.indexOf("buildGridlyLightweightActiveAwareness"));
});

test("positive governed presentation has a generic active fallback and cannot remain normal", () => {
  assert.match(app, /else if \(topAwarenessPresentationActiveCount > 0\) \{\s*headline = "Active conditions are developing nearby"/);
  assert.match(app, /const subline = topAwarenessPresentationActiveCount > 0/);
  const governedRepair = pulse.slice(0, pulse.indexOf("const selectedCommunityCount"));
  assert.doesNotMatch(governedRepair, /Sulphur Springs|Hopkins County|Traffic Backup|83d3dd68|fb254e5c/);
});
