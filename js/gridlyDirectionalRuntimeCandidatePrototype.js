(function gridlyDirectionalRuntimeCandidatePrototype() {
  "use strict";

  const REVIEW_BUCKETS = Object.freeze([
    "reversible_lane",
    "construction_segment",
    "hov_hot_lane",
    "missing_county",
    "missing_oneway",
    "missing_ref",
    "manual_review_required"
  ]);

  const PROTECTED_SYSTEMS = Object.freeze({
    historicalReadsEnabled: false,
    historyUiEnabled: false,
    DriveTexasPaused: true,
    TransportationIntelligenceEnabled: false,
    TransportationIntelligenceDisplay: false,
    TransportationIntelligenceActivation: false
  });

  const AUTHORITATIVE_EVIDENCE = Object.freeze({
    sourceArtifact: "assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json",
    architectureArtifact: "assets/directional-intelligence/evidence/v694-directional-runtime-prototype-architecture.json",
    activeCounty: "Liberty County",
    totalSegments: 245,
    strongCandidates: 164,
    reviewRequiredCandidates: 81,
    blockedCandidates: 0,
    bearingOnlyCandidates: 0,
    confidencePresent: true,
    sourceTraceable: true,
    evidencePresent: true,
    countyContained: true,
    countyAmbiguous: false,
    leakageDetected: false,
    reviewBucketDistribution: Object.freeze({
      reversible_lane: 7,
      construction_segment: 8,
      hov_hot_lane: 10,
      missing_county: 36,
      missing_oneway: 3,
      missing_ref: 0,
      manual_review_required: 17
    })
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function failClosedReason(evidence) {
    if (!evidence) return "source missing";
    if (evidence.sourceTraceable !== true) return "source missing";
    if (evidence.evidencePresent !== true) return "evidence missing";
    if (evidence.confidencePresent !== true) return "confidence missing";
    if (evidence.countyContained !== true || evidence.countyAmbiguous === true || evidence.leakageDetected === true) return "containment invalid";
    return null;
  }

  function generatePrototypeState(overrideEvidence) {
    const evidence = overrideEvidence === undefined ? AUTHORITATIVE_EVIDENCE : overrideEvidence;
    const reason = failClosedReason(evidence);
    const failClosed = Boolean(reason);
    const reviewExcludedCount = failClosed ? 0 : REVIEW_BUCKETS.reduce((total, bucket) => total + Number(evidence.reviewBucketDistribution?.[bucket] || 0), 0);
    const bearingOnlyRuntimeCandidates = failClosed ? 0 : Number(evidence.bearingOnlyCandidates || 0);
    const candidateCount = failClosed || bearingOnlyRuntimeCandidates > 0 ? 0 : Number(evidence.strongCandidates || 0);
    const invalidCandidates = failClosed ? Number(evidence?.totalSegments || 0) : 0;
    const excludedCandidates = failClosed ? 0 : reviewExcludedCount + Number(evidence.blockedCandidates || 0) + bearingOnlyRuntimeCandidates;
    const countyContainmentPass = !failClosed && evidence.countyContained === true && evidence.countyAmbiguous !== true && evidence.leakageDetected !== true;
    const bearingProtectionPass = bearingOnlyRuntimeCandidates === 0 && candidateCount >= 0;
    const failClosedProtectionPass = failClosed ? candidateCount === 0 : candidateCount === Number(evidence.strongCandidates || 0);

    return Object.freeze({
      evidence: clone(evidence || {}),
      candidate: Object.freeze({
        available: true,
        candidateCount,
        reviewExcludedCount,
        blockedCount: failClosed ? 0 : Number(evidence.blockedCandidates || 0),
        countyContained: countyContainmentPass,
        bearingOnlyCandidates: bearingOnlyRuntimeCandidates,
        failClosedState: failClosed,
        safeForPrototypePhase: !failClosed && countyContainmentPass && bearingProtectionPass && candidateCount > 0
      }),
      containment: Object.freeze({
        countyContainmentPass,
        leakageDetected: failClosed ? Boolean(evidence?.leakageDetected) : false,
        invalidCandidates,
        excludedCandidates,
        activeCounty: evidence?.activeCounty || "unknown",
        safeForRuntimePrototype: !failClosed && countyContainmentPass && bearingProtectionPass
      }),
      runtime: Object.freeze({
        candidateGenerationAvailable: true,
        runtimeVisibleToUsers: false,
        displayEnabled: false,
        routeWatchConnected: false,
        alertsConnected: false,
        awarenessConnected: false,
        reviewBucketsExcluded: !failClosed && reviewExcludedCount === Number(evidence.reviewRequiredCandidates || 0),
        bearingProtectionPass,
        failClosedProtectionPass
      }),
      protectedSystems: PROTECTED_SYSTEMS,
      failClosedReason: reason
    });
  }

  const state = generatePrototypeState();

  window.gridlyDirectionalCandidateAudit = function gridlyDirectionalCandidateAudit() {
    return clone(state.candidate);
  };

  window.gridlyDirectionalContainmentAudit = function gridlyDirectionalContainmentAudit() {
    return clone(state.containment);
  };

  window.gridlyDirectionalRuntimeAudit = function gridlyDirectionalRuntimeAudit() {
    return clone(state.runtime);
  };

  window.gridlyDirectionalRuntimePrototypeProtectedState = function gridlyDirectionalRuntimePrototypeProtectedState() {
    return clone({ protectedSystems: state.protectedSystems, sourceArtifact: state.evidence.sourceArtifact, architectureArtifact: state.evidence.architectureArtifact });
  };

  window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness = function gridlyDirectionalRuntimeCandidatePrototypeTestHarness(evidence) {
    const testState = generatePrototypeState(evidence);
    return clone({ candidate: testState.candidate, containment: testState.containment, runtime: testState.runtime, failClosedReason: testState.failClosedReason });
  };
})();
