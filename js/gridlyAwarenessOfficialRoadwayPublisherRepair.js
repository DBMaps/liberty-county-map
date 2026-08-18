/*
 * Gridly Awareness Official Roadway Publisher Repair
 *
 * Restores DriveTexas / official roadway records to the already-published
 * community awareness summary without making Alerts a producer again.
 */
(function gridlyAwarenessOfficialRoadwayPublisherRepair(globalScope) {
  "use strict";

  const state = {
    installed: false,
    originalBuilder: null,
    originalConsumerRefresh: null,
    lastSuccessfulRecords: [],
    lastSuccessfulAreaIdentity: null,
    lastSuccessfulAt: null,
    hasSuccessfulDataset: false,
    lastEnrichment: null,
    initialConnectorSyncStarted: false,
    initialConnectorSyncCompleted: false,
    initialConnectorSyncAttempts: 0,
    initialConnectorSyncReason: null,
    awarenessRevision: 0,
    lastRevisionReason: null,
    publicationRevision: 0,
    lastPublishedSummary: null,
    previousAreaIdentity: null,
    currentAreaIdentity: null,
    transitionRevision: 0
  };
  const referenceIds = new WeakMap();
  let nextReferenceId = 1;
  function objectId(value) {
    if (!value || typeof value !== "object") return null;
    if (!referenceIds.has(value)) referenceIds.set(value, nextReferenceId++);
    return referenceIds.get(value);
  }

  function cloneRecords(records) {
    try {
      return JSON.parse(JSON.stringify(Array.isArray(records) ? records : []));
    } catch (_error) {
      return [];
    }
  }

  function readProviderRecords(apiName) {
    try {
      const api = globalScope[apiName];
      const records = api && typeof api.getNormalizedRecords === "function"
        ? api.getNormalizedRecords()
        : [];
      return Array.isArray(records) ? records : [];
    } catch (_error) {
      return [];
    }
  }

  function normalizeOfficialRecords(records) {
    return records
      .map((record) => {
        if (typeof globalScope.buildGridlyOfficialSituationAlert !== "function") return record;
        try {
          const normalized = globalScope.buildGridlyOfficialSituationAlert(record, "official-roadways");
          if (!normalized) return null;
          // Consumer situation identity belongs to the governed envelope and
          // is intentionally not reconstructed by the presentation builder.
          // Carry it across normalization so distinct official situations do
          // not collapse merely because their display copy is alike.
          return {
            ...normalized,
            consumerSituationId: record.consumerSituationId || normalized.consumerSituationId,
            sourceProviderRecordId: record.sourceProviderRecordId || normalized.sourceProviderRecordId,
            retained: record.retained ?? normalized.retained,
            sourceStatus: record.sourceStatus || normalized.sourceStatus
          };
        } catch (_error) {
          return record;
        }
      })
      .filter(Boolean);
  }

  function recordKey(record = {}) {
    return String(
      record.consumerSituationId ||
      record.sourceProviderRecordId ||
      record.id ||
      record.incidentId ||
      record.report_id ||
      record.reportId ||
      `${record.title || record.category || record.type || "hazard"}|${record.roadName || record.locationName || record.location || record.subtitle || ""}`
    ).toLowerCase();
  }

  function canonicalAreaKey(area) {
    return String(area?.key || area?.canonicalKey || area?.id || "").trim();
  }

  function buildSharedActiveIssueContract(summary, officialInArea, officialSource, selectedArea) {
    const hazards = Array.isArray(summary.activeHazardsInArea) ? summary.activeHazardsInArea : [];
    const reports = Array.isArray(summary.activeReportsInArea) ? summary.activeReportsInArea : [];
    const officialKeys = new Set(officialInArea.map(recordKey));
    const crossingReports = reports.filter((record) => {
      try { return globalScope.isGridlyCrossingReportRecord?.(record) === true; } catch (_error) { return false; }
    });
    const communityReports = reports.filter((record) => !crossingReports.includes(record));
    // `officialInArea` and `officialSource` are deliberately supplied by the
    // same envelope read in enrichSummary.  Do not derive the official count
    // by intersecting that snapshot with the older activeHazards publisher:
    // on connector convergence that publisher can still represent the
    // pre-fetch (empty) cycle even though the governed envelope has records.
    const officialRecords = officialInArea;
    const otherHazards = hazards.filter((record) => !officialKeys.has(recordKey(record)));
    const unique = new Set();
    const countUnique = (records, prefix) => records.reduce((count, record) => {
      const key = `${prefix}:${recordKey(record)}`;
      if (unique.has(key)) return count;
      unique.add(key);
      return count + 1;
    }, 0);
    const activeOfficialRoadwayCount = countUnique(officialRecords, "official");
    const activeCommunityReportCount = countUnique(communityReports, "community");
    const activeCrossingIssueCount = countUnique(crossingReports, "crossing");
    const activeOtherHazardCount = countUnique(otherHazards, "hazard");
    return Object.freeze({
      version: "LP214_PHASE_2_2H",
      activeIssueCount: activeOfficialRoadwayCount + activeCommunityReportCount + activeCrossingIssueCount + activeOtherHazardCount,
      activeOfficialRoadwayCount,
      activeCommunityReportCount,
      activeCrossingIssueCount,
      activeOtherHazardCount,
      officialRoadwaySourceStatus: officialSource.sourceStatus,
      quietEligible: officialSource.quietEligible !== false,
      // Summary.selectedAwarenessArea is a presentation/debug projection and
      // its historical `id` field is not a stable identity owner. Publish the
      // key from the exact canonical selection used to obtain the envelope.
      areaIdentity: canonicalAreaKey(selectedArea),
      countRule: "distinct lifecycle-active, area-eligible records by governed source ownership"
    });
  }

  function selectedAreaIdentity() {
    try { return canonicalAreaKey(globalScope.getGridlySelectedAwarenessArea?.()); } catch (_error) { return ""; }
  }

  function rememberSuccessfulConnectorRecords(records) {
    state.lastSuccessfulRecords = cloneRecords(records);
    state.lastSuccessfulAreaIdentity = selectedAreaIdentity() || null;
    state.hasSuccessfulDataset = true;
    let sourceTimestamp = null;
    try {
      sourceTimestamp = globalScope.gridlyDriveTexasConnector?.areaLifecycleAudit?.()?.lastSuccessfulFetchTimestamp || null;
    } catch (_error) {}
    state.lastSuccessfulAt = sourceTimestamp || new Date().toISOString();
  }

  const SOURCE_STATUS = Object.freeze({
    HEALTHY_WITH_DATA: "HEALTHY_WITH_DATA",
    HEALTHY_EMPTY: "HEALTHY_EMPTY",
    PROJECTION_DEFECT: "PROJECTION_DEFECT",
    SOURCE_FAILED_NO_RETAINED_DATA: "SOURCE_FAILED_NO_RETAINED_DATA",
    SOURCE_FAILED_WITH_RETAINED_DATA: "SOURCE_FAILED_WITH_RETAINED_DATA",
    SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
    UNKNOWN: "UNKNOWN"
  });

  function readRuntimeHealth() {
    let connectorRuntime = null;
    let providerRuntime = null;
    let lifecycle = null;
    try { connectorRuntime = globalScope.gridlyDriveTexasConnectorRuntimeAudit?.() || null; } catch (_error) {}
    try { providerRuntime = globalScope.gridlyDriveTexasProvider?.getRuntimeState?.() || null; } catch (_error) {}
    try { lifecycle = globalScope.gridlyDriveTexasConnector?.areaLifecycleAudit?.() || null; } catch (_error) {}
    return { connectorRuntime, providerRuntime, lifecycle };
  }

  function readGovernedConsumerEvaluation(fallbackRecords) {
    try {
      // The connector getter is the current-awareness view.  Inject that view
      // into the authority selector so the consumer bridge does not silently
      // re-resolve the connector's statewide retained cache (or a differently
      // scoped provider cache) while classifying the current community.
      const selectionInput = {
        records: Array.isArray(fallbackRecords) ? fallbackRecords : []
      };
      // LP039.2 geographic predicates require the governed presentation
      // focus, not the identity/operational-county object returned by the
      // raw selection accessor.  In particular, canonical place selections
      // can carry their certified lat/lng/radius only on this context.
      if (typeof globalScope.getGridlyCanonicalAwarenessPresentationContext === "function") {
        selectionInput.selectedAwarenessArea = globalScope.getGridlyCanonicalAwarenessPresentationContext();
      } else if (typeof globalScope.getGridlySelectedAwarenessArea === "function") {
        selectionInput.selectedAwarenessArea = globalScope.getGridlySelectedAwarenessArea();
      }
      // Capture LP039.2 once, then give that very object to LP039.3.  Counts
      // and status below consequently describe one evaluation, not two calls
      // that may straddle an area transition or connector refresh.
      const authoritySnapshot = globalScope.gridlyGetDriveTexasAuthoritySnapshot?.(selectionInput) || null;
      const selection = globalScope.gridlySelectConsumerVisibleDriveTexasSituations?.({
        ...selectionInput,
        authoritySnapshot
      });
      if (Array.isArray(selection?.consumerVisibleSituations)) {
        const authority = authoritySnapshot?.authority || {};
        return {
          records: selection.consumerVisibleSituations,
          authoritySnapshot,
          selection,
          authorityEligibleCount: Number(authority.authorityEligibleRecordCount ?? authoritySnapshot?.counts?.authorityEligibleRecordCount ?? selection.authorityEligibleCount ?? selection.lp0393ConsumerProjectionInputCount ?? selection.consumerVisibleSituations.length),
          projectionInputCount: Number(selection.lp0393ConsumerProjectionInputCount ?? selection.authorityEligibleCount ?? selection.consumerVisibleSituations.length)
        };
      }
    } catch (_error) {}
    const records = Array.isArray(fallbackRecords) ? fallbackRecords : [];
    return { records, authoritySnapshot: null, selection: null, authorityEligibleCount: records.length, projectionInputCount: records.length };
  }

  function readOfficialSourceEnvelope() {
    const connectorRecords = readProviderRecords("gridlyDriveTexasConnector");
    const providerRecords = readProviderRecords("gridlyDriveTexasProvider");
    const governed = readGovernedConsumerEvaluation(connectorRecords);
    const currentRecords = governed.records;
    const health = readRuntimeHealth();
    const connected = health.connectorRuntime?.connected === true || health.providerRuntime?.connected === true;
    const explicitFailure = health.connectorRuntime?.connected === false && Boolean(
      health.lifecycle?.lastFetchError || health.providerRuntime?.lastError || state.initialConnectorSyncReason === "timeout"
    );
    const sourceAvailable = Boolean(globalScope.gridlyDriveTexasConnector || globalScope.gridlyDriveTexasProvider);

    if (connected) {
      rememberSuccessfulConnectorRecords(currentRecords);
      const projectionDefect = governed.authorityEligibleCount !== governed.projectionInputCount
        || governed.projectionInputCount !== currentRecords.length;
      const geographicEvaluationState = governed.authoritySnapshot?.selectedAwarenessArea?.geographicEvaluationState
        || health.lifecycle?.geographicEvaluationState
        || "AVAILABLE";
      const evaluationRevision = governed.authoritySnapshot?.evaluationRevision
        || [canonicalAreaKey(governed.authoritySnapshot?.selectedAwarenessArea), health.lifecycle?.lastFetchGeneration ?? "", health.lifecycle?.lastAreaViewGeneration ?? "", connectorRecords.length].join(":");
      return {
        records: currentRecords,
        source: "gridlyDriveTexasConnector",
        connected: true,
        fetchFailed: false,
        healthyEmpty: !projectionDefect && geographicEvaluationState === "AVAILABLE" && governed.authorityEligibleCount === 0 && currentRecords.length === 0,
        retained: false,
        retainedLastSuccessful: false,
        lastSuccessfulAt: state.lastSuccessfulAt,
        sourceStatus: projectionDefect
          ? SOURCE_STATUS.PROJECTION_DEFECT
          : (currentRecords.length ? SOURCE_STATUS.HEALTHY_WITH_DATA : (geographicEvaluationState === "AVAILABLE" ? SOURCE_STATUS.HEALTHY_EMPTY : SOURCE_STATUS.UNKNOWN)),
        quietEligible: !projectionDefect && geographicEvaluationState === "AVAILABLE" && governed.authorityEligibleCount === 0 && currentRecords.length === 0,
        consumerDisclosure: projectionDefect ? "Official roadway projection is temporarily unavailable" : null,
        geographicEvaluationState,
        evaluationRevision,
        authorityInputCount: connectorRecords.length,
        authorityEligibleCount: governed.authorityEligibleCount,
        lp0393ProjectionInputCount: governed.projectionInputCount,
        lp0393ProjectedCount: currentRecords.length,
        consumerVisibleCount: currentRecords.length,
        consumerEnvelopeCount: currentRecords.length,
        countConverged: governed.authorityEligibleCount === governed.projectionInputCount && governed.projectionInputCount === currentRecords.length
      };
    }

    const retentionMatchesArea = !state.lastSuccessfulAreaIdentity || state.lastSuccessfulAreaIdentity === selectedAreaIdentity();
    // Connector/provider caches are retained source snapshots too. They are
    // eligible during failure only when the last successful fetch belonged
    // to this same canonical area.
    const retainedRecords = retentionMatchesArea
      ? (connectorRecords.length ? connectorRecords : (providerRecords.length ? providerRecords : cloneRecords(state.lastSuccessfulRecords)))
      : [];
    const retained = retentionMatchesArea && (state.hasSuccessfulDataset || retainedRecords.length > 0);
    if (explicitFailure) {
      return {
        records: retainedRecords,
        source: retained ? "gridlyDriveTexasConnector_last_successful" : "gridlyDriveTexasConnector",
        connected: false,
        fetchFailed: true,
        healthyEmpty: false,
        retained,
        retainedLastSuccessful: retained,
        lastSuccessfulAt: health.lifecycle?.lastSuccessfulFetchTimestamp || state.lastSuccessfulAt || null,
        sourceStatus: retained ? SOURCE_STATUS.SOURCE_FAILED_WITH_RETAINED_DATA : SOURCE_STATUS.SOURCE_FAILED_NO_RETAINED_DATA,
        quietEligible: false,
        consumerDisclosure: retained ? "Official roadway updates may be delayed" : "Official roadway updates temporarily unavailable"
      };
    }

    return {
      records: retainedRecords,
      source: sourceAvailable ? "gridlyDriveTexasProvider" : "unavailable",
      connected: false,
      fetchFailed: false,
      healthyEmpty: false,
      retained,
      retainedLastSuccessful: retained,
      lastSuccessfulAt: health.lifecycle?.lastSuccessfulFetchTimestamp || state.lastSuccessfulAt || null,
      sourceStatus: sourceAvailable ? SOURCE_STATUS.UNKNOWN : SOURCE_STATUS.SOURCE_UNAVAILABLE,
      quietEligible: false,
      consumerDisclosure: sourceAvailable ? "Official roadway update status is being confirmed" : "Official roadway updates temporarily unavailable"
    };
  }

  function readOfficialSourceRecords() {
    return readOfficialSourceEnvelope();
  }

  function enrichSummary(summary) {
    if (!summary || typeof summary !== "object") return summary;

    const officialSource = readOfficialSourceRecords();
    const sourceRecords = officialSource.records;
    const officialNormalizationInputCount = sourceRecords.length;
    const officialRecords = normalizeOfficialRecords(sourceRecords);
    // readOfficialSourceEnvelope is the final, governed consumer boundary:
    // its records have already passed DriveTexas authority selection,
    // geographic selection, lifecycle/freshness eligibility and
    // deduplication. Running the generic raw-hazard lifecycle pipeline here
    // was both redundant and incompatible with the smaller consumer
    // projection (which intentionally has no raw lifecycle fields).
    const officialLifecycleActiveCount = officialRecords.length;

    const selectedArea = typeof globalScope.getGridlySelectedAwarenessArea === "function"
      ? globalScope.getGridlySelectedAwarenessArea()
      : summary.selectedAwarenessArea || null;
    const currentIdentity = canonicalAreaKey(selectedArea);
    const summaryIdentity = canonicalAreaKey(summary?.sharedActiveIssueContract) || canonicalAreaKey(summary?.selectedAwarenessArea);
    if (summaryIdentity && currentIdentity && summaryIdentity !== currentIdentity && state.originalBuilder) {
      // Never enrich a previous community's lists in place. Zero is a valid
      // current-area publication, not permission to retain the old snapshot.
      return enrichSummary(state.originalBuilder({ awarenessArea: selectedArea }));
    }

    // readOfficialSourceEnvelope has already asked the DriveTexas consumer
    // selector for the current canonical area. Re-filtering its normalized
    // records here can reject records whose consumer projection intentionally
    // omits geometry/locality fields. The envelope and count therefore remain
    // one area-scoped snapshot, with no label re-resolution or second filter.
    const officialInArea = officialRecords;
    const existing = Array.isArray(summary.activeHazardsInArea)
      ? summary.activeHazardsInArea
      : [];
    const seen = new Set(existing.map(recordKey));
    const added = officialInArea.filter((record) => {
      const key = recordKey(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    summary.activeHazardsInArea = existing.concat(added);
    summary.sourceBreakdown = summary.sourceBreakdown || {};
    summary.sourceBreakdown.activeHazards = {
      ...(summary.sourceBreakdown.activeHazards || {}),
      source: "activeHazards_plus_officialRoadways",
      officialRoadwaySource: officialSource.source,
      officialRoadwayCount: officialRecords.length,
      matchedOfficialRoadwayCount: officialInArea.length,
      retainedLastSuccessful: officialSource.retainedLastSuccessful,
      lastSuccessfulAt: state.lastSuccessfulAt,
      officialRoadwaySourceStatus: officialSource.sourceStatus,
      officialRoadwayHealthyEmpty: officialSource.healthyEmpty,
      officialRoadwayConnected: officialSource.connected,
      officialRoadwayFetchFailed: officialSource.fetchFailed,
      officialRoadwayQuietEligible: officialSource.quietEligible,
      activeConsidered: summary.activeHazardsInArea.length,
      matchedInArea: summary.activeHazardsInArea.length
    };
    summary.officialRoadwaySourceStatus = { ...officialSource, records: cloneRecords(officialSource.records) };
    summary.sharedActiveIssueContract = buildSharedActiveIssueContract(summary, officialInArea, officialSource, selectedArea);
    summary.activeIssueCount = summary.sharedActiveIssueContract.activeIssueCount;
    if (summary.activeIssueCount > 0) {
      summary.activityLevel = summary.activeIssueCount >= 4 ? "Elevated" : "Active";
      summary.awarenessStatus = "Active local conditions";
      summary.awarenessStatusReason = `${summary.activeIssueCount} governed active issue${summary.activeIssueCount === 1 ? "" : "s"} in this awareness area.`;
    }
    if (officialSource.consumerDisclosure) {
      summary.warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
      if (!summary.warnings.includes(officialSource.consumerDisclosure)) summary.warnings.push(officialSource.consumerDisclosure);
      if (!officialSource.quietEligible && summary.activeHazardsInArea.length === 0) {
        summary.awarenessStatus = "Status being confirmed";
        summary.awarenessStatusReason = officialSource.consumerDisclosure;
      }
    }

    state.lastEnrichment = {
      at: new Date().toISOString(),
      sourceRecordCount: sourceRecords.length,
      sourceEnvelopeCount: sourceRecords.length,
      officialNormalizationInputCount,
      officialNormalizedCount: officialRecords.length,
      officialLifecycleActiveCount,
      officialInAreaCount: officialInArea.length,
      sharedContractOfficialInputCount: officialInArea.length,
      sharedContractOfficialUniqueCount: summary.sharedActiveIssueContract.activeOfficialRoadwayCount,
      enrichedSummaryOfficialCount: summary.sharedActiveIssueContract.activeOfficialRoadwayCount,
      officialActiveCount: officialRecords.length,
      officialMatchedCount: officialInArea.length,
      recordsAdded: added.length,
      officialRoadwaySource: officialSource.source,
      retainedLastSuccessful: officialSource.retainedLastSuccessful,
      lastSuccessfulAt: state.lastSuccessfulAt
    };

    return summary;
  }

  function enrichPublishedState() {
    try {
      const pulseState = typeof globalScope.gridlyCommunityPulseAuditState !== "undefined"
        ? globalScope.gridlyCommunityPulseAuditState
        : null;
      // Enrich exactly one consumer summary and publish that same reference to
      // every shared consumer.  Enriching the Pulse and microline copies in
      // isolation left portrait normalization and Location Context holding a
      // pre-enrichment snapshot, and did not cause either surface to render.
      let candidate = pulseState?.communityAwarenessSummary
        || globalScope.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary
        || null;
      const currentIdentity = selectedAreaIdentity();
      const candidateIdentity = canonicalAreaKey(candidate?.sharedActiveIssueContract) || canonicalAreaKey(candidate?.selectedAwarenessArea);
      // Provider refresh is the production transition path as well as the
      // explicit canonical-transition API. Capture the identity before the
      // stale candidate is replaced so completed-transition audit evidence
      // does not start at null.
      if (!state.currentAreaIdentity) {
        state.currentAreaIdentity = candidateIdentity || currentIdentity || null;
      }
      if (currentIdentity && currentIdentity !== state.currentAreaIdentity) {
        state.previousAreaIdentity = state.currentAreaIdentity;
        state.currentAreaIdentity = currentIdentity;
        state.transitionRevision += 1;
      }
      if ((!candidate || (candidateIdentity && currentIdentity && candidateIdentity !== currentIdentity)) && state.originalBuilder) {
        candidate = state.originalBuilder({ awarenessArea: globalScope.getGridlySelectedAwarenessArea?.() });
      }
      if (!candidate) return null;
      const authoritativeSummary = enrichSummary(candidate);
      state.publicationRevision += 1;
      state.lastPublishedSummary = authoritativeSummary;
      const publication = {
        publicationRevision: state.publicationRevision,
        summaryRevision: Number(globalScope.gridlyOfficialRoadwayAwarenessRevision || state.awarenessRevision || 0),
        reason: state.lastRevisionReason || "official-roadway-enrichment"
      };
      if (typeof globalScope.gridlyPublishAuthoritativeCommunityAwarenessSummary === "function") {
        globalScope.gridlyPublishAuthoritativeCommunityAwarenessSummary(authoritativeSummary, publication);
      } else {
        // Compatibility fallback for test/early startup environments. This is
        // reference publication, not a second state store or source read.
        if (pulseState) pulseState.communityAwarenessSummary = authoritativeSummary;
        if (globalScope.gridlyTopAwarenessMicrolineState) {
          globalScope.gridlyTopAwarenessMicrolineState.communityAwarenessSummary = authoritativeSummary;
        }
      }
      // Portrait refresh is allowed to rebuild presentation models, but the
      // two shared consumers retain the publisher's authoritative reference.
      // Reassert it after the synchronous publication callback returns.
      const publishedPulseState = globalScope.gridlyCommunityPulseAuditState;
      if (publishedPulseState) publishedPulseState.communityAwarenessSummary = authoritativeSummary;
      if (globalScope.gridlyTopAwarenessMicrolineState) {
        globalScope.gridlyTopAwarenessMicrolineState.communityAwarenessSummary = authoritativeSummary;
      }
      return authoritativeSummary;
    } catch (_error) {}
    return null;
  }

  function publishCanonicalAreaTransitionSummary(summary, reason = "canonical-area-change") {
    const nextIdentity = selectedAreaIdentity();
    if (nextIdentity && nextIdentity !== state.currentAreaIdentity) {
      state.previousAreaIdentity = state.currentAreaIdentity;
      state.currentAreaIdentity = nextIdentity;
      state.transitionRevision += 1;
      state.lastPublishedSummary = null;
      advanceAwarenessRevision(reason);
    }
    const authoritativeSummary = enrichSummary(summary || state.originalBuilder?.({ awarenessArea: globalScope.getGridlySelectedAwarenessArea?.() }));
    if (!authoritativeSummary) return null;
    state.publicationRevision += 1;
    state.lastPublishedSummary = authoritativeSummary;
    globalScope.gridlyPublishAuthoritativeCommunityAwarenessSummary?.(authoritativeSummary, {
      publicationRevision: state.publicationRevision,
      summaryRevision: state.awarenessRevision,
      transitionRevision: state.transitionRevision,
      reason
    });
    return authoritativeSummary;
  }

  function rebuildSharedAwarenessAfterInitialConnector(reason) {
    const refresh = globalScope.refreshGridlyCommunityPulseSharedModel;
    if (typeof refresh !== "function") {
      enrichPublishedState();
      return Promise.resolve(null);
    }

    try {
      return Promise.resolve(refresh({
        reason: reason || "initial-drivetexas-publication",
        topAwarenessMicrolineReadOnly: true
      })).catch(() => null).then((result) => {
        enrichPublishedState();
        return result;
      });
    } catch (_error) {
      enrichPublishedState();
      return Promise.resolve(null);
    }
  }

  function advanceAwarenessRevision(reason) {
    const nextRevision = Number(globalScope.gridlyOfficialRoadwayAwarenessRevision || 0) + 1;
    globalScope.gridlyOfficialRoadwayAwarenessRevision = nextRevision;
    state.awarenessRevision = nextRevision;
    state.lastRevisionReason = reason || "drivetexas-snapshot-changed";
    return nextRevision;
  }

  function startInitialConnectorSynchronization() {
    if (state.initialConnectorSyncStarted) return;
    state.initialConnectorSyncStarted = true;

    const intervalId = globalScope.setInterval(() => {
      state.initialConnectorSyncAttempts += 1;

      const connectorRecords = readProviderRecords("gridlyDriveTexasConnector");
      let runtime = null;
      try {
        runtime = typeof globalScope.gridlyDriveTexasConnectorRuntimeAudit === "function"
          ? globalScope.gridlyDriveTexasConnectorRuntimeAudit()
          : null;
      } catch (_error) {}

      const connectorCompleted = Boolean(
        connectorRecords.length || runtime?.connected === true
      );
      const timedOut = state.initialConnectorSyncAttempts >= 50;

      if (!connectorCompleted && !timedOut) return;

      globalScope.clearInterval(intervalId);
      state.initialConnectorSyncCompleted = true;
      state.initialConnectorSyncReason = connectorRecords.length
        ? "records-available"
        : runtime?.connected === true
          ? "successful-empty-response"
          : "timeout";

      if (connectorRecords.length) {
        rememberSuccessfulConnectorRecords(connectorRecords);
      }

      // The initial fetch can settle before the consumer-refresh bridge is
      // installed.  Advance the same revision used by the shared-model cache
      // before requesting its cold-start rebuild.
      advanceAwarenessRevision(`initial-drivetexas-${state.initialConnectorSyncReason}`);
      rebuildSharedAwarenessAfterInitialConnector(
        `initial-drivetexas-${state.initialConnectorSyncReason}`
      );
    }, 200);
  }

  function installConsumerRefreshBridge() {
    const currentRefresh = globalScope.gridlyOfficialProviderConsumerRefresh;
    if (typeof currentRefresh !== "function") return false;
    if (currentRefresh.__gridlyOfficialRoadwayRetentionBridge === true) return true;

    state.originalConsumerRefresh = currentRefresh;
    const wrappedRefresh = function (options = {}) {
      const providerId = String(options?.providerId || "").toLowerCase();
      const reason = String(options?.reason || "").toLowerCase();

      if (providerId === "drivetexas" && reason.includes("fetch-success")) {
        rememberSuccessfulConnectorRecords(readProviderRecords("gridlyDriveTexasConnector"));
      }

      // The original refresh is animation-frame/timer scheduled.  Revision
      // must change before it captures the shared-model reuse signature.
      if (providerId === "drivetexas") {
        advanceAwarenessRevision(reason || "drivetexas-provider-refresh");
      }
      const result = state.originalConsumerRefresh.apply(this, arguments);

      if (providerId === "drivetexas") {
        // The activation owner schedules its narrow refresh on animation
        // frame. Queue convergence on that same scheduler so it runs after
        // the newly built Pulse model, rather than enriching the old model
        // before the scheduled refresh replaces it.
        const schedulePublication = typeof globalScope.requestAnimationFrame === "function"
          ? globalScope.requestAnimationFrame.bind(globalScope)
          : (callback) => globalScope.setTimeout(callback, 0);
        schedulePublication(enrichPublishedState);
      }

      return result;
    };
    wrappedRefresh.__gridlyOfficialRoadwayRetentionBridge = true;
    globalScope.gridlyOfficialProviderConsumerRefresh = wrappedRefresh;
    return true;
  }

  function install() {
    if (state.installed) {
      installConsumerRefreshBridge();
      startInitialConnectorSynchronization();
      return true;
    }
    const builder = globalScope.buildGridlyCommunityAwarenessIntelligenceSummary;
    if (typeof builder !== "function") return false;

    state.originalBuilder = builder;
    globalScope.buildGridlyCommunityAwarenessIntelligenceSummary = function () {
      const summary = state.originalBuilder.apply(this, arguments);
      return enrichSummary(summary);
    };
    installConsumerRefreshBridge();
    state.installed = true;
    enrichPublishedState();
    startInitialConnectorSynchronization();
    return true;
  }

  let attempts = 0;
  const timer = globalScope.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 40) {
      globalScope.clearInterval(timer);
      enrichPublishedState();
    }
  }, 50);

  globalScope.gridlyAwarenessOfficialRoadwayPublisherRepairAudit = function () {
    const pulseSummary = globalScope.gridlyCommunityPulseAuditState?.communityAwarenessSummary || null;
    const microlineSummary = globalScope.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary || null;
    const sourceStatusEnvelope = readOfficialSourceEnvelope();
    const officialCount = (summary) => Number(summary?.sharedActiveIssueContract?.activeOfficialRoadwayCount || 0);
    const sharedCount = (summary) => Number(summary?.sharedActiveIssueContract?.activeIssueCount || 0);
    const locationContextCount = Number(globalScope.document?.querySelector?.('[data-v2-location-awareness="panel"]')?.dataset?.activeAwarenessCount);
    const authoritativeSummary = state.lastPublishedSummary;
    return {
      available: true,
      installed: state.installed,
      lastEnrichment: state.lastEnrichment,
      officialNormalizationInputCount: Number(state.lastEnrichment?.officialNormalizationInputCount || 0),
      officialNormalizedCount: Number(state.lastEnrichment?.officialNormalizedCount || 0),
      officialLifecycleActiveCount: Number(state.lastEnrichment?.officialLifecycleActiveCount || 0),
      officialInAreaCount: Number(state.lastEnrichment?.officialInAreaCount || 0),
      sharedContractOfficialInputCount: Number(state.lastEnrichment?.sharedContractOfficialInputCount || 0),
      sharedContractOfficialUniqueCount: Number(state.lastEnrichment?.sharedContractOfficialUniqueCount || 0),
      providerAvailable: Boolean(globalScope.gridlyDriveTexasProvider),
      connectorAvailable: Boolean(globalScope.gridlyDriveTexasConnector),
      lastSuccessfulRecordCount: state.lastSuccessfulRecords.length,
      lastSuccessfulAt: state.lastSuccessfulAt,
      sourceStatusEnvelope,
      sourceEnvelopeCount: sourceStatusEnvelope.records.length,
      enrichedSummaryOfficialCount: officialCount(state.lastPublishedSummary),
      publishedPulseOfficialCount: officialCount(pulseSummary),
      publishedMicrolineOfficialCount: officialCount(microlineSummary),
      enrichedCount: sharedCount(state.lastPublishedSummary),
      pulseCount: sharedCount(pulseSummary),
      microlineCount: sharedCount(microlineSummary),
      sharedCount: sharedCount(state.lastPublishedSummary),
      publishedLocationContextCount: Number.isFinite(locationContextCount) ? locationContextCount : null,
      summaryRevision: Number(globalScope.gridlyOfficialRoadwayAwarenessRevision || state.awarenessRevision || 0),
      publicationRevision: state.publicationRevision,
      areaIdentity: state.lastPublishedSummary?.sharedActiveIssueContract?.areaIdentity || null,
      selectedAreaIdentity: selectedAreaIdentity() || null,
      publisherAreaIdentity: state.lastPublishedSummary?.sharedActiveIssueContract?.areaIdentity || null,
      pulseAreaIdentity: pulseSummary?.sharedActiveIssueContract?.areaIdentity || null,
      microlineAreaIdentity: microlineSummary?.sharedActiveIssueContract?.areaIdentity || null,
      portraitAreaIdentity: globalScope.document?.querySelector?.('[data-v2-location-awareness="panel"]')?.dataset?.areaIdentity || null,
      previousAreaIdentity: state.previousAreaIdentity,
      transitionRevision: state.transitionRevision,
      sameSummaryReference: Boolean(state.lastPublishedSummary && pulseSummary === state.lastPublishedSummary && microlineSummary === state.lastPublishedSummary),
      authoritativeObjectId: objectId(authoritativeSummary),
      pulseObjectId: objectId(pulseSummary),
      microlineObjectId: objectId(microlineSummary),
      sameAuthoritativePulseReference: Boolean(authoritativeSummary && pulseSummary === authoritativeSummary),
      sameAuthoritativeMicrolineReference: Boolean(authoritativeSummary && microlineSummary === authoritativeSummary),
      writeSiteReferenceAudit: globalScope.gridlyAuthoritativeCommunityAwarenessReferenceAudit || null,
      windowPulseStateDescriptor: Object.getOwnPropertyDescriptor(globalScope, "gridlyCommunityPulseAuditState") || null,
      windowMicrolineStateDescriptor: Object.getOwnPropertyDescriptor(globalScope, "gridlyTopAwarenessMicrolineState") || null,
      pulseSummaryDescriptor: pulseSummary && globalScope.gridlyCommunityPulseAuditState
        ? Object.getOwnPropertyDescriptor(globalScope.gridlyCommunityPulseAuditState, "communityAwarenessSummary") || null
        : null,
      microlineSummaryDescriptor: microlineSummary && globalScope.gridlyTopAwarenessMicrolineState
        ? Object.getOwnPropertyDescriptor(globalScope.gridlyTopAwarenessMicrolineState, "communityAwarenessSummary") || null
        : null,
      authoritativeSummaryRevision: Number(globalScope.gridlyOfficialRoadwayAwarenessRevision || state.awarenessRevision || 0),
      authoritativeSummaryAreaIdentity: state.lastPublishedSummary?.sharedActiveIssueContract?.areaIdentity || null,
      pulseSummaryRevision: Number(globalScope.gridlyCommunityPulseAuditState?.communityAwarenessSummaryRevision || 0),
      microlineSummaryRevision: Number(globalScope.gridlyTopAwarenessMicrolineState?.communityAwarenessSummaryRevision || 0),
      lastPulseSummaryWriter: globalScope.gridlyCommunityPulseAuditState?.communityAwarenessSummaryWriter || "official-roadway-publisher",
      lastMicrolineSummaryWriter: globalScope.gridlyTopAwarenessMicrolineState?.communityAwarenessSummaryWriter || "official-roadway-publisher",
      lastReferenceDivergenceReason: pulseSummary && microlineSummary && pulseSummary !== microlineSummary
        ? "microline-summary-reference-does-not-match-authoritative-pulse-summary"
        : null,
      consumerRefreshBridgeInstalled: Boolean(
        globalScope.gridlyOfficialProviderConsumerRefresh?.__gridlyOfficialRoadwayRetentionBridge
      ),
      initialConnectorSyncStarted: state.initialConnectorSyncStarted,
      initialConnectorSyncCompleted: state.initialConnectorSyncCompleted,
      initialConnectorSyncAttempts: state.initialConnectorSyncAttempts,
      initialConnectorSyncReason: state.initialConnectorSyncReason,
      awarenessRevision: Number(globalScope.gridlyOfficialRoadwayAwarenessRevision || state.awarenessRevision || 0),
      lastRevisionReason: state.lastRevisionReason
    };
  };
  globalScope.gridlyGetAuthoritativeCommunityAwarenessSummary = () => state.lastPublishedSummary;
  globalScope.gridlyGetDriveTexasConsumerSourceStatusEnvelope = readOfficialSourceEnvelope;
  globalScope.gridlyPublishCanonicalAreaTransitionSummary = publishCanonicalAreaTransitionSummary;
  globalScope.gridlyBuildSharedActiveIssueContract = buildSharedActiveIssueContract;
  globalScope.GRIDLY_DRIVETEXAS_CONSUMER_SOURCE_STATUS = SOURCE_STATUS;
})(window);
