(function gridlyDirectionalServiceConsumer() {
  "use strict";

  const CONSUMER_SOURCE = "directional-service-consumer";
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

  function readServiceState(serviceState) {
    if (serviceState !== undefined) return serviceState;
    if (typeof window.gridlyDirectionalServiceAudit !== "function") return null;
    if (typeof window.gridlyDirectionalServiceSnapshot !== "function") return null;

    const state = {
      audit: window.gridlyDirectionalServiceAudit(),
      snapshot: window.gridlyDirectionalServiceSnapshot(),
      protections: null
    };

    if (typeof window.gridlyDirectionalServiceLayerTestHarness === "function") {
      state.protections = window.gridlyDirectionalServiceLayerTestHarness().protections;
    }

    return state;
  }

  function hasCandidateInventory(state) {
    return Boolean(
      state
      && state.snapshot
      && Number.isFinite(Number(state.snapshot.candidateCount))
      && Array.isArray(state.snapshot.candidateIds)
      && state.snapshot.candidateIds.length === Number(state.snapshot.candidateCount || 0)
    );
  }

  function hasReviewBucketEscape(state) {
    const candidateIds = Array.isArray(state?.snapshot?.candidateIds) ? state.snapshot.candidateIds : [];
    return candidateIds.some((candidateId) => REVIEW_BUCKETS.some((bucket) => String(candidateId).includes(bucket)));
  }

  function isServiceSafe(state) {
    const audit = state?.audit || {};
    const snapshot = state?.snapshot || {};
    const protections = state?.protections || {};
    const serviceAvailable = audit.available === true && typeof window.gridlyDirectionalServiceAudit === "function" && typeof window.gridlyDirectionalServiceSnapshot === "function";
    const candidateInventoryAvailable = hasCandidateInventory(state);
    const containmentPass = audit.countyContained === true;
    const bearingProtectionPass = protections.bearingProtectionPass === true;
    const failClosedPass = audit.failClosedState === false && Number(snapshot.candidateCount || 0) > 0;
    const reviewProtectionPass = protections.reviewBucketsExcluded === true && !hasReviewBucketEscape(state);
    const runtimeHidden = audit.userVisible === false && audit.displayEnabled === false;

    return Boolean(
      serviceAvailable
      && candidateInventoryAvailable
      && containmentPass
      && bearingProtectionPass
      && failClosedPass
      && reviewProtectionPass
      && runtimeHidden
    );
  }

  function createConsumerState(serviceState) {
    const state = readServiceState(serviceState);
    const serviceAvailable = Boolean(state?.audit?.available === true && state?.snapshot?.source === "directional-service-layer");
    const safeForConsumerPhase = isServiceSafe(state);
    const audit = state?.audit || {};
    const snapshot = state?.snapshot || {};
    const candidateCount = safeForConsumerPhase ? Number(snapshot.candidateCount || audit.candidateCount || 0) : 0;
    const reviewExcludedCount = safeForConsumerPhase ? Number(audit.reviewExcludedCount || 0) : 0;
    const blockedCount = safeForConsumerPhase ? Number(audit.blockedCount || 0) : 0;
    const countyContained = safeForConsumerPhase && audit.countyContained === true;
    const failClosedState = safeForConsumerPhase ? false : true;
    const activeCounty = safeForConsumerPhase ? snapshot.activeCounty : "unknown";

    return Object.freeze({
      audit: Object.freeze({
        available: true,
        serviceAvailable,
        candidateCount,
        reviewExcludedCount,
        blockedCount,
        countyContained,
        failClosedState,
        userVisible: false,
        safeForConsumerPhase
      }),
      snapshot: Object.freeze({
        source: CONSUMER_SOURCE,
        candidateCount,
        excludedCount: reviewExcludedCount + blockedCount,
        activeCounty,
        containmentPass: countyContained,
        failClosedPass: !failClosedState,
        userVisible: false
      }),
      protections: Object.freeze({
        reviewBuckets: REVIEW_BUCKETS,
        bearingDataExposed: false,
        directionalLabelsExposed: false,
        displayEnabled: false,
        routeWatchConnected: false,
        alertsConnected: false,
        awarenessConnected: false,
        driveTexasConnected: false,
        transportationIntelligenceConnected: false
      })
    });
  }

  const consumerState = createConsumerState();

  window.gridlyDirectionalConsumerAudit = function gridlyDirectionalConsumerAudit() {
    return clone(consumerState.audit);
  };

  window.gridlyDirectionalConsumerSnapshot = function gridlyDirectionalConsumerSnapshot() {
    return clone(consumerState.snapshot);
  };

  window.gridlyDirectionalServiceConsumerTestHarness = function gridlyDirectionalServiceConsumerTestHarness(serviceState) {
    if (serviceState === undefined) return clone(createConsumerState());
    return clone(createConsumerState(serviceState));
  };
})();
