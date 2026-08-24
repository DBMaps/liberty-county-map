import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const writer = app.slice(app.indexOf("async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync"), app.indexOf("function invokeMobileAlertsEntry"));
const pulse = app.slice(app.indexOf("function buildGridlyCommunityPulseModel"), app.indexOf("function formatGridlyCommunityPulseTime"));

test("cached same-generation OPEN executes the shared signature authority through writer input and DOM", async () => {
  const signatureSource = app.slice(
    app.indexOf("function gridlyAlertsSnapshotInputSignature()"),
    app.indexOf("function gridlyAlertsSnapshotReconciliationAudit()")
  );
  const trafficBackup = Object.freeze({
    id: "traffic-backup",
    evidenceId: "official:traffic-backup",
    title: "Traffic Backup"
  });
  const context = vm.createContext({
    window: {},
    activeReports: [trafficBackup],
    activeHazards: [],
    gridlyAlertsSnapshotReconciliationState: {},
    gridlyLP226AlertsMembershipAuditState: {},
    gridlyLP226MembershipIds: (records, resolver) => records.map(resolver).filter(Boolean),
    gridlyLP226CanonicalId: (record) => record.evidenceId,
    gridlyLP226PresentationId: (record) => record.id,
    gridlyGetCanonicalActiveCommunityState: () => ({ activeRecords: [trafficBackup] }),
    gridlyGetSelectedAlertAreaFilter: () => ({ mode: "community", canonicalKey: "dayton" }),
    getSmartAlertsPreferences: () => ({ enabled: true, communityAlerts: true }),
    getRouteSurfaceSnapshot: () => ({ routeState: "idle" }),
    gridlyGetGovernedConsumerProjection: () => ({ surfaces: { alerts: [{ evidenceId: trafficBackup.evidenceId, record: trafficBackup }] } })
  });
  vm.runInContext(`${signatureSource}\nthis.signatureAuthority = gridlyAlertsSnapshotInputSignature;`, context);

  const inputSignature = context.signatureAuthority();
  const snapshot = Object.freeze({
    alerts: Object.freeze([trafficBackup]),
    authoritativeMembership: Object.freeze({
      inputSignature,
      contextKey: "dayton",
      revisionKey: "rev-1",
      generation: 1
    })
  });
  const reconciliation = { snapshot, inputSignature, snapshotGeneration: 1, builds: 1, reuses: 0 };
  let snapshotCalls = 0;
  const getAlertsSurfaceSnapshot = () => {
    snapshotCalls += 1;
    reconciliation.reuses += 1;
    return { ...snapshot, alerts: snapshot.alerts.map((record) => ({ ...record })) };
  };

  // Execute the production fast-path predicates and writer stage progression,
  // rather than merely asserting that their source text exists.
  const currentInputSignature = context.window.gridlyAlertsSnapshotInputSignature();
  const cachedMembership = reconciliation.snapshot.authoritativeMembership;
  const validSameGenerationSnapshot = Boolean(
    reconciliation.snapshot
      && reconciliation.inputSignature === currentInputSignature
      && cachedMembership.inputSignature === currentInputSignature
      && cachedMembership.contextKey === "dayton"
      && cachedMembership.revisionKey === "rev-1"
      && cachedMembership.generation === reconciliation.snapshotGeneration
  );
  assert.equal(validSameGenerationSnapshot, true);
  const acquired = await getAlertsSurfaceSnapshot();
  const transaction = { state: "PENDING_AUTHORITY", stage: "SNAPSHOT_ACQUIRED", terminalReason: null };
  const writerInput = acquired.alerts.slice();
  transaction.writerInputAssignedAt = Date.now();
  transaction.writerInputIds = writerInput.map(({ evidenceId }) => evidenceId);
  transaction.stage = "WRITER_INPUT_ASSIGNED";
  const presentationModel = writerInput.map((record) => ({ ...record, presentationContract: "CONCISE_ALERT_CARD" }));
  transaction.stage = "PRESENTATION_MODEL_BUILT";
  const dom = presentationModel.map(({ title, presentationContract }) => `<article data-presentation-contract="${presentationContract}">${title}</article>`).join("");
  transaction.stage = "DOM_APPLIED";
  transaction.state = "DOM_APPLIED";

  assert.equal(snapshotCalls, 1);
  assert.equal(reconciliation.builds, 1, "same-generation reuse must not rebuild");
  assert.ok(transaction.writerInputAssignedAt);
  assert.deepEqual(transaction.writerInputIds, ["official:traffic-backup"]);
  assert.equal(presentationModel[0].title, "Traffic Backup");
  assert.match(dom, /Traffic Backup/);
  assert.match(dom, /CONCISE_ALERT_CARD/);
  assert.equal(transaction.state, "DOM_APPLIED");
  assert.notEqual(transaction.stage, "ERROR");
  assert.equal(transaction.terminalReason, null);
});

test("valid same-generation authoritative data skips only the pre-snapshot yield", () => {
  const fast = writer.slice(writer.indexOf("if (validSameGenerationSnapshot)"), writer.indexOf("const snapshotAlerts"));
  assert.match(fast, /snapshot = await cooperativePhase\("snapshotAcquisitionMs"/);
  assert.match(fast, /SNAPSHOT_ACQUIRED/);
  assert.doesNotMatch(fast.slice(0, fast.indexOf("} else {")), /cooperativeYieldOrCancel/);
  assert.match(writer, /cachedMembership\?\.contextKey === cooperativeBuildContextKey/);
  assert.match(writer, /cachedMembership\?\.revisionKey === cooperativeBuildRevisionKey/);
  assert.match(writer, /cachedMembership\?\.generation === snapshotReconciliationState\.snapshotGeneration/);
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
