(function gridlyDirectionalServiceLayer() {
  "use strict";

  const SERVICE_SOURCE = "directional-service-layer";
  const REVIEW_BUCKETS = Object.freeze([
    "reversible_lane",
    "construction_segment",
    "hov_hot_lane",
    "missing_county",
    "missing_oneway",
    "missing_ref",
    "manual_review_required"
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readRuntimeState(runtimeState) {
    if (runtimeState) return runtimeState;
    if (typeof window.gridlyDirectionalCandidateAudit !== "function") return null;
    if (typeof window.gridlyDirectionalContainmentAudit !== "function") return null;
    if (typeof window.gridlyDirectionalRuntimeAudit !== "function") return null;
    return {
      candidate: window.gridlyDirectionalCandidateAudit(),
      containment: window.gridlyDirectionalContainmentAudit(),
      runtime: window.gridlyDirectionalRuntimeAudit()
    };
  }

  function hasRuntimeEvidence(state) {
    return Boolean(state && state.candidate && state.containment && state.runtime);
  }

  function isContained(state) {
    return state.containment.countyContainmentPass === true && state.candidate.countyContained === true && state.containment.leakageDetected !== true && Boolean(state.containment.activeCounty && state.containment.activeCounty !== "unknown");
  }

  function isBearingProtected(state) {
    return state.runtime.bearingProtectionPass === true && Number(state.candidate.bearingOnlyCandidates || 0) === 0;
  }

  function isReviewExcluded(state) {
    return state.runtime.reviewBucketsExcluded === true && Number(state.candidate.reviewExcludedCount || 0) >= 0;
  }

  function buildCandidateIds(candidateCount, activeCounty) {
    const countySlug = String(activeCounty || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
    return Array.from({ length: candidateCount }, (_, index) => `${countySlug}-directional-candidate-${String(index + 1).padStart(3, "0")}`);
  }

  function createServiceState(runtimeState) {
    const state = readRuntimeState(runtimeState);
    const runtimeEvidenceAvailable = hasRuntimeEvidence(state);
    const countyContained = runtimeEvidenceAvailable && isContained(state);
    const bearingProtectionPass = runtimeEvidenceAvailable && isBearingProtected(state);
    const reviewBucketsExcluded = runtimeEvidenceAvailable && isReviewExcluded(state);
    const displayEnabled = runtimeEvidenceAvailable ? state.runtime.displayEnabled === true : false;
    const userVisible = runtimeEvidenceAvailable ? state.runtime.runtimeVisibleToUsers === true || displayEnabled === true : false;
    const runtimeFailClosed = runtimeEvidenceAvailable ? state.candidate.failClosedState === true : true;
    const failClosedState = !runtimeEvidenceAvailable || runtimeFailClosed || !countyContained || !bearingProtectionPass || !reviewBucketsExcluded || userVisible;
    const candidateCount = failClosedState ? 0 : Number(state.candidate.candidateCount || 0);
    const reviewExcludedCount = failClosedState ? 0 : Number(state.candidate.reviewExcludedCount || 0);
    const blockedCount = failClosedState ? 0 : Number(state.candidate.blockedCount || 0);
    const activeCounty = failClosedState ? "unknown" : state.containment.activeCounty;

    return Object.freeze({
      audit: Object.freeze({
        available: runtimeEvidenceAvailable,
        candidateCount,
        reviewExcludedCount,
        blockedCount,
        countyContained,
        failClosedState,
        userVisible: false,
        displayEnabled: false,
        safeForServiceLayer: !failClosedState && candidateCount > 0 && userVisible === false
      }),
      snapshot: Object.freeze({
        candidateIds: Object.freeze(buildCandidateIds(candidateCount, activeCounty)),
        candidateCount,
        excludedCount: reviewExcludedCount + blockedCount,
        activeCounty,
        source: SERVICE_SOURCE
      }),
      protections: Object.freeze({
        reviewBuckets: REVIEW_BUCKETS,
        reviewBucketsExcluded,
        bearingProtectionPass,
        runtimeEvidenceAvailable,
        routeWatchConnected: false,
        alertsConnected: false,
        awarenessConnected: false
      })
    });
  }

  const serviceState = createServiceState();

  window.gridlyDirectionalServiceAudit = function gridlyDirectionalServiceAudit() {
    return clone(serviceState.audit);
  };

  window.gridlyDirectionalServiceSnapshot = function gridlyDirectionalServiceSnapshot() {
    return clone(serviceState.snapshot);
  };

  window.gridlyDirectionalServiceLayerTestHarness = function gridlyDirectionalServiceLayerTestHarness(evidence) {
    if (evidence === undefined) return clone(createServiceState());
    if (typeof window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness !== "function") return clone(createServiceState(null));
    return clone(createServiceState(window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness(evidence)));
  };
})();
