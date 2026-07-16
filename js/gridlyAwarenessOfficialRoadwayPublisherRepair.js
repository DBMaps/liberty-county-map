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
    lastEnrichment: null
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
    state.lastSuccessfulAt = new Date().toISOString();
  }

  function readOfficialSourceRecords() {
    const connectorRecords = readProviderRecords("gridlyDriveTexasConnector");
    if (connectorRecords.length) {
      rememberSuccessfulConnectorRecords(connectorRecords);
      return {
        records: connectorRecords,
        source: "gridlyDriveTexasConnector",
        retainedLastSuccessful: false
      };
    }

    const providerRecords = readProviderRecords("gridlyDriveTexasProvider");
    if (providerRecords.length) {
      return {
        records: providerRecords,
        source: "gridlyDriveTexasProvider",
        retainedLastSuccessful: false
      };
    }

    return {
      records: cloneRecords(state.lastSuccessfulRecords),
      source: state.lastSuccessfulRecords.length
        ? "gridlyDriveTexasConnector_last_successful"
        : "gridlyDriveTexasProvider",
      retainedLastSuccessful: state.lastSuccessfulRecords.length > 0
    };
  }

  function enrichSummary(summary) {
    if (!summary || typeof summary !== "object") return summary;

    const officialSource = readOfficialSourceRecords();
    const sourceRecords = officialSource.records;
    const officialRecords = lifecycleActive(normalizeOfficialRecords(sourceRecords));

    const selectedArea = summary.selectedAwarenessArea ||
      (typeof globalScope.getGridlySelectedAwarenessArea === "function"
        ? globalScope.getGridlySelectedAwarenessArea()
        : null);

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
      activeConsidered: summary.activeHazardsInArea.length,
      matchedInArea: summary.activeHazardsInArea.length
    };

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
      consumerRefreshBridgeInstalled: Boolean(
        globalScope.gridlyOfficialProviderConsumerRefresh?.__gridlyOfficialRoadwayRetentionBridge
      )
    };
  };
})(window);
