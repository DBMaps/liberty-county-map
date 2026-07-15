(function initGridlyOfficialProviderActivation(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

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
      runNarrowConsumerRefresh(options.reason || `${providerId}-provider-evidence`);
    });
    return audit();
  }

  function refreshConsumers() {
    return requestConsumerRefresh({ providerId: "activation", evidenceChanged: true, reason: "official-provider-activation" });
  }

  function activate() {
    if (state.activated) return audit();
    state.activated = true;
    state.lastActivationAt = new Date().toISOString();
    state.driveTexasActivated = startConnector("gridlyDriveTexasConnector");
    state.weatherActivated = startConnector("gridlyWeatherConnector");
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
      duplicateConsumerRefreshPrevented: state.duplicateConsumerRefreshPrevented === true
    });
  }

  globalScope.gridlyOfficialProviderActivation = freeze({ activate, audit, requestConsumerRefresh });
  globalScope.gridlyOfficialProviderConsumerRefresh = requestConsumerRefresh;
  globalScope.gridlyOfficialProviderActivationAudit = audit;

  if (typeof globalScope.setTimeout === "function") {
    globalScope.setTimeout(activate, 0);
  } else {
    activate();
  }
})(typeof window !== "undefined" ? window : globalThis);
