(function initGridlyOfficialProviderActivation(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  // Recovery Repair 002: a bounded, localhost-only stopwatch used to
  // attribute synchronous hydration work.  It observes callbacks in place;
  // it does not wrap browser schedulers or alter callback ordering.
  function installMainThreadAttributionAudit() {
    if (typeof globalScope.gridlyRecordMainThreadAttribution === "function") return;
    const hostname = String(globalScope.location?.hostname || "").toLowerCase();
    if (!(["localhost", "127.0.0.1", "::1"].includes(hostname))) return;
    const history = [];
    const limit = 120;
    const clock = () => typeof globalScope.performance?.now === "function" ? globalScope.performance.now() : Date.now();
    const snapshot = () => {
      let publisher = null;
      let crossing = null;
      try { publisher = globalScope.gridlyAwarenessOfficialRoadwayPublisherRepairAudit?.() || null; } catch (_error) {}
      try { crossing = globalScope.gridlyCrossingRenderAudit?.() || null; } catch (_error) {}
      return {
        canonicalArea: publisher?.selectedAreaIdentity || publisher?.areaIdentity || null,
        activeCounty: globalScope.gridlyActiveCountyId || globalScope.gridlyGetActiveCountyId?.() || null,
        publicationRevision: publisher?.publicationRevision ?? null,
        crossingRevision: crossing?.renderCrossingsCallCount ?? null,
        driveTexasCurrentAreaCount: publisher?.sourceEnvelopeCount ?? null,
        sharedActiveCount: publisher?.sharedCount ?? null,
        domTargetCount: globalScope.document?.querySelectorAll?.("[data-v2-location-awareness], .leaflet-marker-icon")?.length ?? null,
        markerCount: crossing?.renderedMarkerCount ?? null
      };
    };
    globalScope.gridlyRecordMainThreadAttribution = function (writer, scheduler, callback) {
      let reentrant = false;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].writer === writer && history[index].end == null) { reentrant = true; break; }
      }
      const before = snapshot();
      const start = clock();
      const entry = { timestamp: new Date().toISOString(), scheduler, writer, start, end: null, duration: null, reentrant, before };
      history.push(entry);
      if (history.length > limit) history.splice(0, history.length - limit);
      try { return callback(); }
      finally {
        entry.end = clock();
        entry.duration = Number((entry.end - start).toFixed(2));
        entry.after = snapshot();
      }
    };
    globalScope.gridlyRepair002MainThreadAttributionAudit = () => Object.freeze({
      enabled: true,
      localhostOnly: true,
      limit,
      entries: history.map((entry) => Object.freeze({ ...entry, before: Object.freeze({ ...entry.before }), after: entry.after ? Object.freeze({ ...entry.after }) : null }))
    });
  }
  installMainThreadAttributionAudit();

  const state = {
    activated: false,
    driveTexasActivated: false,
    weatherActivated: false,
    lastActivationAt: null,
    lastDriveTexasSignature: null,
    lastWeatherSignature: null,
    driveTexasRecordCount: 0,
    weatherRecordCount: 0,
    providerEvidenceChanged: false,
    consumerRefreshRequested: false,
    consumerRefreshCoalesced: false,
    consumerRefreshSkippedUnchanged: false,
    lastConsumerRefreshDurationMs: null,
    broadPortraitRefreshInvoked: false,
    duplicateConsumerRefreshPrevented: false
  };

  const stages = Object.create(null);
  function stage(name, status, reason) {
    stages[name] = freeze({
      started: status === "started",
      completed: status === "completed",
      failed: status === "failed",
      skipped: status === "skipped",
      waiting: status === "waiting",
      reason: reason || null,
      timestamp: new Date().toISOString()
    });
  }

  let consumerRefreshTimer = null;

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function startConnector(name) {
    const connector = globalScope[name];
    if (!connector || typeof connector.startPolling !== "function") return false;
    try {
      connector.startPolling();
      return true;
    } catch (error) {
      return false;
    }
  }

  function nowMs() {
    return typeof globalScope.performance?.now === "function" ? globalScope.performance.now() : Date.now();
  }

  function runNarrowConsumerRefresh(reason) {
    const startedAt = nowMs();
    try { if (typeof globalScope.gridlyUnifiedIntelligencePrototype?.runtime === "function") globalScope.gridlyUnifiedIntelligencePrototype.runtime(); } catch (error) {}
    try { if (typeof globalScope.gridlyRenderTravelBrief === "function") globalScope.gridlyRenderTravelBrief(); } catch (error) {}
    try { if (typeof globalScope.gridlyBriefInteractionRender === "function") globalScope.gridlyBriefInteractionRender(); } catch (error) {}
    try { if (typeof globalScope.refreshGridlyCommunityPulseSharedModel === "function") globalScope.refreshGridlyCommunityPulseSharedModel({ reason: reason || "official-provider-evidence", topAwarenessMicrolineReadOnly: true }); } catch (error) {}
    state.lastConsumerRefreshDurationMs = Number((nowMs() - startedAt).toFixed(2));
  }

  function compactSignatureHash(signature) {
    if (typeof signature !== "string") return null;
    let hash = 2166136261;
    for (let index = 0; index < signature.length; index += 1) {
      hash ^= signature.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function extractProviderRecordCount(signature) {
    if (typeof signature !== "string") return 0;
    const match = signature.match(/^[^:]+:(\d+):/);
    return match ? Number(match[1]) || 0 : 0;
  }

  function requestConsumerRefresh(options = {}) {
    const providerId = String(options.providerId || "official").toLowerCase();
    const signature = typeof options.signature === "string" ? options.signature : null;
    const previousSignature = providerId === "weather" ? state.lastWeatherSignature : providerId === "drivetexas" ? state.lastDriveTexasSignature : null;
    const changed = options.evidenceChanged === true || (signature !== null && signature !== previousSignature);

    if (providerId === "weather" && signature !== null) {
      state.lastWeatherSignature = signature;
      state.weatherRecordCount = extractProviderRecordCount(signature);
    }
    if (providerId === "drivetexas" && signature !== null) {
      state.lastDriveTexasSignature = signature;
      state.driveTexasRecordCount = extractProviderRecordCount(signature);
    }

    state.providerEvidenceChanged = changed;
    if (!changed) {
      state.consumerRefreshSkippedUnchanged = true;
      state.consumerRefreshRequested = false;
      state.broadPortraitRefreshInvoked = false;
      return audit();
    }

    state.consumerRefreshRequested = true;
    state.consumerRefreshSkippedUnchanged = false;
    state.broadPortraitRefreshInvoked = false;

    if (consumerRefreshTimer != null) {
      state.consumerRefreshCoalesced = true;
      state.duplicateConsumerRefreshPrevented = true;
      return audit();
    }

    const schedule = typeof globalScope.requestAnimationFrame === "function"
      ? (callback) => globalScope.requestAnimationFrame(callback)
      : (callback) => globalScope.setTimeout(callback, 0);
    consumerRefreshTimer = schedule(() => {
      consumerRefreshTimer = null;
      const run = () => runNarrowConsumerRefresh(options.reason || `${providerId}-provider-evidence`);
      if (typeof globalScope.gridlyRecordMainThreadAttribution === "function") {
        globalScope.gridlyRecordMainThreadAttribution("official-provider-activation:narrow-consumer-refresh", "requestAnimationFrame", run);
      } else run();
    });
    return audit();
  }

  function refreshConsumers() {
    return requestConsumerRefresh({ providerId: "activation", evidenceChanged: true, reason: "official-provider-activation" });
  }

  function activate() {
    if (state.activated) return audit();
    stage("providerActivation", "started", "configuration readiness satisfied");
    state.activated = true;
    state.lastActivationAt = new Date().toISOString();
    state.driveTexasActivated = startConnector("gridlyDriveTexasConnector");
    state.weatherActivated = startConnector("gridlyWeatherConnector");
    stage("driveTexasConnectorActivation", state.driveTexasActivated ? "completed" : "failed", state.driveTexasActivated ? "polling requested" : "connector unavailable");
    stage("providerActivation", "completed", "official providers activated");
    refreshConsumers();
    return audit();
  }

  function audit() {
    return freeze({
      activated: state.activated === true,
      driveTexasActivated: state.driveTexasActivated === true,
      weatherActivated: state.weatherActivated === true,
      driveTexasRefreshIntervalMs: Number(globalScope.gridlyDriveTexasConnector?.refreshIntervalMs) || null,
      weatherRefreshIntervalMs: Number(globalScope.gridlyWeatherConnector?.refreshIntervalMs) || null,
      lastActivationAt: state.lastActivationAt,
      lastDriveTexasSignatureHash: compactSignatureHash(state.lastDriveTexasSignature),
      lastWeatherSignatureHash: compactSignatureHash(state.lastWeatherSignature),
      driveTexasRecordCount: state.driveTexasRecordCount,
      weatherRecordCount: state.weatherRecordCount,
      providerEvidenceChanged: state.providerEvidenceChanged === true,
      consumerRefreshRequested: state.consumerRefreshRequested === true,
      consumerRefreshCoalesced: state.consumerRefreshCoalesced === true,
      consumerRefreshSkippedUnchanged: state.consumerRefreshSkippedUnchanged === true,
      lastConsumerRefreshDurationMs: state.lastConsumerRefreshDurationMs,
      broadPortraitRefreshInvoked: state.broadPortraitRefreshInvoked === true,
      duplicateConsumerRefreshPrevented: state.duplicateConsumerRefreshPrevented === true,
      configurationReadiness: freeze(Object.assign({}, globalScope.gridlyConfigurationReadiness || {})),
      stages: freeze(Object.assign({}, stages))
    });
  }

  function recoverConfiguration() {
    const connector = globalScope.gridlyDriveTexasConnector;
    const runtime = typeof globalScope.gridlyDriveTexasConnectorRuntimeAudit === "function" ? globalScope.gridlyDriveTexasConnectorRuntimeAudit() : null;
    if (!state.activated) return activate();
    if (!runtime?.apiKeyConfigured) {
      stage("configurationResolution", "failed", "DriveTexas API key is not configured");
      return audit();
    }
    stage("configurationResolution", "completed", runtime.configurationSource || "configured");
    if (!state.driveTexasActivated) state.driveTexasActivated = startConnector("gridlyDriveTexasConnector");
    else if (connector && typeof connector.fetchNow === "function" && runtime.lastFetchSucceeded !== true) connector.fetchNow();
    return audit();
  }

  globalScope.gridlyOfficialProviderActivation = freeze({ activate, audit, requestConsumerRefresh, recoverConfiguration });
  globalScope.gridlyOfficialProviderConsumerRefresh = requestConsumerRefresh;
  globalScope.gridlyOfficialProviderActivationAudit = audit;

  stage("configurationResolution", "waiting", "waiting for explicit configuration readiness");
  if (globalScope.gridlyConfigurationReady && typeof globalScope.gridlyConfigurationReady.then === "function") {
    globalScope.gridlyConfigurationReady.then(function () {
      const runtime = typeof globalScope.gridlyDriveTexasConnectorRuntimeAudit === "function" ? globalScope.gridlyDriveTexasConnectorRuntimeAudit() : null;
      stage("configurationResolution", runtime?.apiKeyConfigured ? "completed" : "failed", runtime?.configurationSource || "DriveTexas API key is not configured");
      activate();
    });
    globalScope.addEventListener?.("gridly:configuration-ready", recoverConfiguration);
  } else if (typeof globalScope.setTimeout === "function") {
    globalScope.setTimeout(activate, 0);
  } else {
    activate();
  }
})(typeof window !== "undefined" ? window : globalThis);
