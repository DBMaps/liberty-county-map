import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { buildAudit } from "../tools/lp214/audit-drivetexas-consumer-contract.mjs";

const artifact = JSON.parse(fs.readFileSync("data/generated/lp214-drivetexas-consumer-contract-audit.json", "utf8"));
const taxonomy = new Set(["HEALTH_AWARE", "ARRAY_ONLY_AMBIGUOUS", "ARRAY_ONLY_SAFE_BY_UPSTREAM_GATE", "RETAINED_DATA_WITH_HEALTH", "NOT_USER_VISIBLE", "LEGACY_OR_UNUSED", "UNKNOWN"]);
const surfaceTaxonomy = new Set(["VISIBLE_FALSE_QUIET_POSSIBLE", "VISIBLE_STALE_WITHOUT_WARNING_POSSIBLE", "VISIBLE_FAILURE_DISCLOSED", "NOT_AFFECTED", "NOT_CONNECTED_TO_DRIVETEXAS", "OWNER_RUNTIME_CONFIRMATION_REQUIRED"]);

test("artifact is deterministic and current", () => {
  assert.deepEqual(artifact, buildAudit());
  execFileSync(process.execPath, ["tools/lp214/audit-drivetexas-consumer-contract.mjs", "--verify"]);
});

test("every discovered consumer has one valid classification", () => {
  const ids = artifact.implementationCallGraph.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert(ids.length > 0);
  for (const entry of artifact.implementationCallGraph) {
    assert(entry.file && entry.function && entry.consumerSurface && entry.dataAccessor);
    assert(taxonomy.has(entry.classification));
    if (entry.classification === "ARRAY_ONLY_AMBIGUOUS") assert.equal(entry.sourceHealthConsulted, false);
    if (entry.contract === "records-only" && entry.sourceHealthConsulted === false) assert.notEqual(entry.classification, "HEALTH_AWARE");
  }
});

test("risk, retention, LP043 and repair classifications are stable", () => {
  assert.equal(artifact.quietStateRisk.classification, "VISIBLE_FALSE_QUIET_POSSIBLE");
  assert.equal(artifact.quietStateRisk.actualPathExists, true);
  assert.equal(artifact.retainedDataRisk.classification, "VISIBLE_STALE_WITHOUT_WARNING_POSSIBLE");
  assert.equal(artifact.lp043Classification.classification, "STALE_FIXTURE");
  assert(artifact.lp043Classification.evidence.length >= 3);
  assert.equal(artifact.recommendedRepairBoundary.boundary, "E_AWARENESS_CONSUMER_BRIDGE_WITH_SHARED_SOURCE_STATUS_ENVELOPE");
  for (const entry of artifact.consumerSurfaceClassifications) assert(surfaceTaxonomy.has(entry.classification));
});

test("Dallas remains a multi-county browser control", () => {
  const dallas = artifact.laterCertificationPlan.representativeBrowserControls.find((item) => item.placeGeoid === "4819000");
  assert(dallas);
  assert.equal(dallas.geography, "multi-county");
});

test("Phase 2.1 artifact remains immutable while later repairs stay outside protected providers", () => {
  assert.equal(artifact.productionSourceModified, false);
  const changed = execFileSync("git", ["diff", "--name-only", "--", "js"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const allowedConsumerBoundaries = new Set([
    "js/app.js",
    "js/gridlyAlertSemanticContract.js",
    // Alerts publication-to-presentation convergence consumes the already
    // governed shared summary and does not alter provider normalization.
    "js/gridlyAlertsPublishedAwareness.js",
    "js/gridlyAwarenessOfficialRoadwayPublisherRepair.js",
    // LP214's governed projection repair supplies one LP039.2 snapshot to
    // LP039.3; it does not modify provider fetching or normalization.
    "js/gridlyDriveTexasAuthoritySourceIntegration.js",
    // LP214's subsequently authorized canonical-focus bridge changes only the
    // connector's awareness-context input; source fetch/normalization remain protected.
    "js/gridlyDriveTexasLiveConnector.js",
    // LP214 cold-start closure governs configuration readiness before the
    // existing connector activation/fetch lifecycle; provider normalization is unchanged.
    "js/gridlyOfficialProviderActivation.js",
    // Recovery Repair 003 retries a stale cached governed geometry package so
    // canonical county containment can complete; DriveTexas is not involved.
    "js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js",
    // LP214 crossing transport repair is isolated from DriveTexas fetching
    // and prevents diagnostic provider modes from overriding governed packages.
    "js/gridlyCrossingProvider.js",
    "js/gridlyCrossingProviderActivationAudit.js"
  ]);
  assert(changed.every((file) => allowedConsumerBoundaries.has(file)), `unexpected protected JavaScript change: ${changed.join(", ")}`);
  assert(!changed.some((file) => /DriveTexasProvider|Weather/i.test(file)));
});
