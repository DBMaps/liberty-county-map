import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

function sourceBetween(start, end) {
  return app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
}

function lifecycleHarness() {
  const context = vm.createContext({
    window: {},
    gridlyInstantAlertsSheetAuditState: { inFlightGeneration: 0, inFlight: null, inFlightKey: null }
  });
  const transactionSource = sourceBetween("const GRIDLY_LP226_ALERTS_TRANSACTION_LIMIT", "const gridlyLp016AlertsPostPaintDelayAuditState");
  const lifecycleSource = sourceBetween("function gridlyRecordAlertsSheetGenerationTransition", "// LP223: the portrait sheet");
  vm.runInContext(`${transactionSource}\n${lifecycleSource}\nthis.api = { gridlyBeginAlertsSheetLifecycle, gridlyMarkAlertsSheetClosed, gridlyCanApplyAlertsSheetGeneration, gridlyFinalizeAlertsSheetGeneration, gridlyLP226BeginAlertsWriterTransaction, gridlyLP226SetAlertsWriterTransactionStage, state: gridlyAlertsSheetLifecycleState };`, context);
  return { ...context.api, window: context.window };
}

test("non-visible G1 remains PENDING_AUTHORITY through reused snapshot writer and DOM apply", () => {
  const h = lifecycleHarness();
  const g1 = h.gridlyBeginAlertsSheetLifecycle();
  assert.equal(h.state.generationStates.get(g1).state, "PENDING_AUTHORITY");
  assert.equal(h.gridlyCanApplyAlertsSheetGeneration(g1), true, "pending ownership must not depend on visible sheet DOM");

  const transaction = h.gridlyLP226BeginAlertsWriterTransaction({ alertsSheetGeneration: g1, reusedSameGeneration: true });
  const trafficBackup = { id: "Traffic Backup", presentationContract: "CONCISE_ALERT_CARD" };
  h.gridlyLP226SetAlertsWriterTransactionStage(transaction, "SNAPSHOT_ACQUIRED", { snapshotBuildDecision: "NO_BUILD", snapshotReuseDecision: "REUSE_SAME_GENERATION" });
  h.gridlyLP226SetAlertsWriterTransactionStage(transaction, "WRITER_INPUT_ASSIGNED", { writerInputIds: [trafficBackup.id] });
  h.gridlyLP226SetAlertsWriterTransactionStage(transaction, "PRESENTATION_MODEL_BUILT", { presentationIds: [trafficBackup.id], presentationContract: trafficBackup.presentationContract });
  assert.equal(h.gridlyCanApplyAlertsSheetGeneration(g1), true);
  h.gridlyLP226SetAlertsWriterTransactionStage(transaction, "DOM_APPLIED", { domIds: [trafficBackup.id] });
  h.gridlyFinalizeAlertsSheetGeneration(g1, "applied");

  assert.equal(transaction.state, "DOM_APPLIED");
  assert.deepEqual([...transaction.writerInputIds], ["Traffic Backup"]);
  assert.deepEqual([...transaction.domIds], ["Traffic Backup"]);
  assert.equal(transaction.presentationContract, "CONCISE_ALERT_CARD");
  assert.equal(h.window.gridlyLP226CurrentAlertsWriterTransactionAudit().alertsSheetGeneration, g1);
});

test("explicit close invalidates G1 while reopened G2 survives pending authority and reaches DOM", () => {
  const h = lifecycleHarness();
  const g1 = h.gridlyBeginAlertsSheetLifecycle();
  h.gridlyMarkAlertsSheetClosed();
  assert.equal(h.state.generationStates.get(g1).state, "CLOSED");
  assert.equal(h.gridlyCanApplyAlertsSheetGeneration(g1), false);

  const g2 = h.gridlyBeginAlertsSheetLifecycle();
  assert.notEqual(g2, g1);
  assert.equal(h.state.generationStates.get(g2).state, "PENDING_AUTHORITY");
  assert.equal(h.gridlyCanApplyAlertsSheetGeneration(g2), true);
  const transaction = h.gridlyLP226BeginAlertsWriterTransaction({ alertsSheetGeneration: g2 });
  h.gridlyLP226SetAlertsWriterTransactionStage(transaction, "WRITER_INPUT_ASSIGNED", { writerInputIds: ["Traffic Backup"] });
  h.gridlyLP226SetAlertsWriterTransactionStage(transaction, "DOM_APPLIED", { domIds: ["Traffic Backup"] });
  h.gridlyFinalizeAlertsSheetGeneration(g2, "applied");
  assert.equal(h.gridlyCanApplyAlertsSheetGeneration(g2), true);
  assert.equal(transaction.state, "DOM_APPLIED");
  assert.ok(transaction.writerInputAssignedAt);
  assert.ok(transaction.domAppliedAt);
});

test("the former self-invalidator is documented and stale-writer guards remain", () => {
  const cancellation = sourceBetween("function gridlyAlertsMarkCooperativeBuildCancelled", "async function gridlyAlertsCooperativeYieldIfNeeded");
  assert.match(cancellation, /!gridlyCanApplyAlertsSheetGeneration\(alertsSheetGeneration\)[\s\S]*gridlyFinalizeAlertsSheetGeneration/);
  assert.match(app, /generationState === "PENDING_AUTHORITY" \|\| generationState === "DOM_APPLIED"/);
  assert.match(app, /cooperativeBuildGeneration === gridlyAlertsCooperativeBuildState\.generation/);
  assert.doesNotMatch(sourceBetween("function gridlyCanApplyAlertsSheetGeneration", "window.gridlyAlertsSheetLifecycleAudit"), /sheet\.hidden|activeSheet/);
  assert.doesNotMatch(sourceBetween("function gridlyRecordAlertsSheetGenerationTransition", "\/\/ LP223: the portrait sheet"), /setInterval|setTimeout/);
});
