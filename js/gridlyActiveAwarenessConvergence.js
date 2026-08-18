(function attachGridlyActiveAwarenessConvergence(root) {
  "use strict";

  function safeCount(value) {
    return Math.max(0, Number(value) || 0);
  }

  /**
   * Makes the LP214 shared issue contract the sole owner of consumer-active
   * awareness. V179.5 remains available as a secondary ranking/diagnostic
   * model, but its ungoverned records and infrastructure signals cannot create
   * an active count or active narrative.
   */
  function reconcileGridlyActiveAwarenessWithSharedContract(lightweight = {}, summary = {}) {
    const contract = summary?.sharedActiveIssueContract;
    if (!contract || !Number.isFinite(Number(contract.activeIssueCount))) {
      return {
        activeAwareness: { ...lightweight },
        governed: false,
        activeIssueCount: safeCount(lightweight?.activeAwarenessCount),
        quietEligible: false
      };
    }

    const activeIssueCount = safeCount(contract.activeIssueCount);
    const quietEligible = contract.quietEligible === true && activeIssueCount === 0;
    const rawLightweightCount = safeCount(lightweight?.activeAwarenessCount);
    const sourceBreakdownAvailable = Boolean(summary?.sourceBreakdown && typeof summary.sourceBreakdown === "object");
    const suppressed = rawLightweightCount > activeIssueCount;
    const quietCopy = {
      headline: "Your area is being watched",
      subline: "No active local issues reported right now."
    };
    const activeAwareness = {
      ...lightweight,
      activeAwarenessCount: activeIssueCount,
      topAwarenessDedupedMobilityCount: activeIssueCount,
      topAwarenessDisplayedCount: activeIssueCount,
      sharedActiveIssueContract: contract,
      authoritativeCountOwner: "LP214_SHARED_ACTIVE_ISSUE_CONTRACT",
      ownershipClassification: "SECONDARY_PRESENTATION_MODEL",
      rawLightweightActiveAwarenessCount: rawLightweightCount,
      lightweightSignalConsumerAuthority: false,
      lightweightSourceBreakdownAvailable: sourceBreakdownAvailable,
      lightweightSuppressedByGovernedContract: suppressed,
      lightweightSuppressionReason: suppressed
        ? "UNATTRIBUTED_OR_UNGOVERNED_LIGHTWEIGHT_ACTIVE_SIGNAL"
        : "",
      activityLevel: quietEligible ? "quiet" : (activeIssueCount > 0 ? (lightweight?.activityLevel || "active") : "uncertain")
    };

    if (activeIssueCount === 0) {
      Object.assign(activeAwareness, quietCopy, {
        resolvedCategory: null,
        selectedActiveDetail: null,
        topAwarenessSelectedRawDetail: null,
        topAwarenessSelectionTruthSource: "lp214_shared_contract_no_active_issues",
        topAwarenessHeadlineSource: "lp214_shared_contract_quiet",
        reusedAlertText: "",
        reusedAlertSource: "",
        lightweightSummaryReuseApplied: false
      });
    }

    return { activeAwareness, governed: true, activeIssueCount, quietEligible, contract };
  }

  function gridlyActiveAwarenessConvergenceAudit() {
    const pulse = root.gridlyCommunityPulseAuditState || {};
    const summary = pulse.communityAwarenessSummary || root.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary || {};
    const contract = summary.sharedActiveIssueContract || {};
    const awareness = pulse.activeAwareness || {};
    const locationPanel = root.document?.querySelector?.('[data-v2-location-awareness="panel"]');
    const selected = awareness.topAwarenessSelectedRawDetail || null;
    return Object.freeze({
      canonicalKey: contract.areaIdentity || null,
      crossingsWatched: Array.isArray(summary.crossingsInArea) ? summary.crossingsInArea.length : Number(summary.crossingsInArea || 0),
      sharedActiveIssueCount: safeCount(contract.activeIssueCount),
      lightweightActiveAwarenessCount: safeCount(awareness.activeAwarenessCount),
      rawLightweightActiveAwarenessCount: safeCount(awareness.rawLightweightActiveAwarenessCount),
      activeOfficialRoadwayCount: safeCount(contract.activeOfficialRoadwayCount),
      activeCommunityReportCount: safeCount(contract.activeCommunityReportCount),
      activeCrossingIssueCount: safeCount(contract.activeCrossingIssueCount),
      activeOtherHazardCount: safeCount(contract.activeOtherHazardCount),
      visibleLocationContextIssueCount: safeCount(locationPanel?.dataset?.activeAwarenessCount),
      visibleHeadline: pulse.visiblePrimary || pulse.renderedPulseHeadline || "",
      visibleSubline: pulse.visibleSecondary || pulse.renderedPulseSubline || "",
      quietEligible: contract.quietEligible === true,
      locationContextCertificationStatus: root.gridlyLocationContextAwarenessAudit?.locationContextCertificationStatus || null,
      locationContextPass: root.gridlyLocationContextAwarenessAudit?.locationContextPass ?? null,
      pulseMicrolineSameReference: pulse.communityAwarenessSummary === root.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary,
      activeAwarenessSourceIdentity: selected?.item?.id || selected?.item?.reportId || selected?.item?.crossingId || null,
      activeAwarenessSourceOwnership: awareness.authoritativeCountOwner || null,
      activeAwarenessSourceLifecycleStatus: selected?.lifecycleClassification?.lifecycleStage || selected?.item?.lifecycleState || selected?.item?.status || null,
      ownershipClassification: awareness.ownershipClassification || null,
      suppressionReason: awareness.lightweightSuppressionReason || null
    });
  }

  root.reconcileGridlyActiveAwarenessWithSharedContract = reconcileGridlyActiveAwarenessWithSharedContract;
  root.gridlyActiveAwarenessConvergenceAudit = gridlyActiveAwarenessConvergenceAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = { reconcileGridlyActiveAwarenessWithSharedContract, gridlyActiveAwarenessConvergenceAudit };
})(typeof window !== "undefined" ? window : globalThis);
