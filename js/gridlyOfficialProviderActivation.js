(function initGridlyOfficialProviderActivation(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const state = {
    activated: false,
    driveTexasActivated: false,
    weatherActivated: false,
    lastActivationAt: null
  };

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

  function refreshConsumers() {
    try { if (typeof globalScope.gridlyRenderTravelBrief === "function") globalScope.gridlyRenderTravelBrief(); } catch (error) {}
    try { if (typeof globalScope.gridlyUnifiedIntelligencePrototype?.runtime === "function") globalScope.gridlyUnifiedIntelligencePrototype.runtime(); } catch (error) {}
    try { if (typeof globalScope.gridlyRefreshBriefWeather === "function") globalScope.gridlyRefreshBriefWeather(); } catch (error) {}
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
      lastActivationAt: state.lastActivationAt
    });
  }

  globalScope.gridlyOfficialProviderActivation = freeze({ activate, audit });
  globalScope.gridlyOfficialProviderActivationAudit = audit;

  if (typeof globalScope.setTimeout === "function") {
    globalScope.setTimeout(activate, 0);
  } else {
    activate();
  }
})(typeof window !== "undefined" ? window : globalThis);
