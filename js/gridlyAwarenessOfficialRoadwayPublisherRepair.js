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
    lastSuccessfulAt: null,
    hasSuccessfulDataset: false,
    lastEnrichment: null,
    initialConnectorSyncStarted: false,
    initialConnectorSyncCompleted: false,
    initialConnectorSyncAttempts: 0,
    initialConnectorSyncReason: null
  };

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

  function lifecycleActive(records) {
    const safeRecords = Array.isArray(records) ? records : [];
    if (typeof globalScope.getGridlyAwarenessLifecycleActiveHazards === "function") {
      try {
        return globalScope.getGridlyAwarenessLifecycleActiveHazards(safeRecords);
      } catch (_error) {}
    }
    return safeRecords.filter((record) => {
      if (!record || record.expired || record.isExpired || record.archived || record.hidden) return false;
      const lifecycle = String(
        record.lifecycleState || record.lifecycle || record.status || record.state || "active"
      ).toLowerCase();
      return !/(^|[_\s-])(cleared|expired|inactive|historical|removed|resolved|cancelled|canceled)([_\s-]|$)/.test(lifecycle);
    });
  }

  function normalizeOfficialRecords(records) {
    return records
      .map((record) => {
        if (typeof globalScope.buildGridlyOfficialSituationAlert !== "function") return record;
        try {
          return globalScope.buildGridlyOfficialSituationAlert(record, "official-roadways");
        } catch (_error) {
          return record;
        }
      })
      .filter(Boolean);
  }

  function recordKey(record = {}) {
    return String(
      record.id ||
      record.incidentId ||
      record.report_id ||
      record.reportId ||
      `${record.title || record.category || record.type || "hazard"}|${record.roadName || record.locationName || record.location || record.subtitle || ""}`
    ).toLowerCase();
  }

  function inAwarenessArea(record, selectedArea) {
    if (typeof globalScope.isGridlyRecordInAwarenessArea !== "function") return true;
    try {
      return globalScope.isGridlyRecordInAwarenessArea(record, selectedArea);
    } catch (_error) {
      return true;
    }
  }

  function rememberSuccessfulConnectorRecords(records) {
    state.lastSuccessfulRecords = cloneRecords(records);
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

  function readConsumerVisibleRecords(fallbackRecords) {
    try {
      // The connector getter is the current-awareness view.  Inject that view
      // into the authority selector so the consumer bridge does not silently
      // re-resolve the connector's statewide retained cache (or a differently
      // scoped provider cache) while classifying the current community.
      const selectionInput = {
        records: Array.isArray(fallbackRecords) ? fallbackRecords : []
      };
      if (typeof globalScope.getGridlySelectedAwarenessArea === "function") {
        selectionInput.selectedAwarenessArea = globalScope.getGridlySelectedAwarenessArea();
      }
      const selection = globalScope.gridlySelectConsumerVisibleDriveTexasSituations?.(selectionInput);
      if (Array.isArray(selection?.consumerVisibleSituations)) return selection.consumerVisibleSituations;
    } catch (_error) {}
    return Array.isArray(fallbackRecords) ? fallbackRecords : [];
  }

  function readOfficialSourceEnvelope() {
    const connectorRecords = readProviderRecords("gridlyDriveTexasConnector");
    const providerRecords = readProviderRecords("gridlyDriveTexasProvider");
    const currentRecords = readConsumerVisibleRecords(connectorRecords);
    const health = readRuntimeHealth();
    const connected = health.connectorRuntime?.connected === true || health.providerRuntime?.connected === true;
    const explicitFailure = health.connectorRuntime?.connected === false && Boolean(
      health.lifecycle?.lastFetchError || health.providerRuntime?.lastError || state.initialConnectorSyncReason === "timeout"
    );
    const sourceAvailable = Boolean(globalScope.gridlyDriveTexasConnector || globalScope.gridlyDriveTexasProvider);

    if (connected) {
      rememberSuccessfulConnectorRecords(currentRecords);
      return {
        records: currentRecords,
        source: "gridlyDriveTexasConnector",
        connected: true,
        fetchFailed: false,
        healthyEmpty: currentRecords.length === 0,
        retained: false,
        retainedLastSuccessful: false,
        lastSuccessfulAt: state.lastSuccessfulAt,
        sourceStatus: currentRecords.length ? SOURCE_STATUS.HEALTHY_WITH_DATA : SOURCE_STATUS.HEALTHY_EMPTY,
        quietEligible: currentRecords.length === 0,
        consumerDisclosure: null
      };
    }

    const retainedRecords = connectorRecords.length
      ? connectorRecords
      : providerRecords.length
        ? providerRecords
        : cloneRecords(state.lastSuccessfulRecords);
    const retained = state.hasSuccessfulDataset || retainedRecords.length > 0;
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
    const officialRecords = lifecycleActive(normalizeOfficialRecords(sourceRecords));

    const selectedArea = typeof globalScope.getGridlySelectedAwarenessArea === "function"
      ? globalScope.getGridlySelectedAwarenessArea()
      : summary.selectedAwarenessArea || null;

    const officialInArea = officialRecords.filter((record) => inAwarenessArea(record, selectedArea));
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
      if (pulseState?.communityAwarenessSummary) {
        enrichSummary(pulseState.communityAwarenessSummary);
      }
      if (globalScope.gridlyTopAwarenessMicrolineState?.communityAwarenessSummary) {
        enrichSummary(globalScope.gridlyTopAwarenessMicrolineState.communityAwarenessSummary);
      }
    } catch (_error) {}
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

      const result = state.originalConsumerRefresh.apply(this, arguments);

      if (providerId === "drivetexas") {
        globalScope.setTimeout(enrichPublishedState, 0);
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
    return {
      available: true,
      installed: state.installed,
      lastEnrichment: state.lastEnrichment,
      providerAvailable: Boolean(globalScope.gridlyDriveTexasProvider),
      connectorAvailable: Boolean(globalScope.gridlyDriveTexasConnector),
      lastSuccessfulRecordCount: state.lastSuccessfulRecords.length,
      lastSuccessfulAt: state.lastSuccessfulAt,
      sourceStatusEnvelope: readOfficialSourceEnvelope(),
      consumerRefreshBridgeInstalled: Boolean(
        globalScope.gridlyOfficialProviderConsumerRefresh?.__gridlyOfficialRoadwayRetentionBridge
      ),
      initialConnectorSyncStarted: state.initialConnectorSyncStarted,
      initialConnectorSyncCompleted: state.initialConnectorSyncCompleted,
      initialConnectorSyncAttempts: state.initialConnectorSyncAttempts,
      initialConnectorSyncReason: state.initialConnectorSyncReason
    };
  };
  globalScope.gridlyGetDriveTexasConsumerSourceStatusEnvelope = readOfficialSourceEnvelope;
  globalScope.GRIDLY_DRIVETEXAS_CONSUMER_SOURCE_STATUS = SOURCE_STATUS;
})(window);
