(function initGridlyUnifiedIntelligence(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const SYSTEM_NAME = "Unified Intelligence";
  const REQUIRED_FOUNDATIONS = Object.freeze(["drivetexas", "weather"]);
  const PROVIDER_IDS = Object.freeze(["community", "drivetexas", "weather"]);
  const state = Object.freeze({
    system: SYSTEM_NAME,
    registered: true,
    enabled: false,
    activated: false,
    uiOwnership: false,
    consumerRenderingActive: false
  });

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function getPackage(packageId) {
    const registry = globalScope.gridlyPackageRegistry;
    if (!registry || typeof registry.getPackage !== "function") return null;
    try {
      return registry.getPackage(packageId);
    } catch (error) {
      return null;
    }
  }

  function safeRuntime(provider) {
    if (!provider || typeof provider.getRuntimeState !== "function") return null;
    try {
      return provider.getRuntimeState() || null;
    } catch (error) {
      return null;
    }
  }

  function resolveCommunitySource() {
    const pkg = getPackage("intelligence.community-reports");
    const localRuntimeAvailable = typeof globalScope.getLiveHazardIncidents === "function"
      || Array.isArray(globalScope.activeHazards)
      || Array.isArray(globalScope.unifiedRoadIncidents)
      || Array.isArray(globalScope.activeUnifiedIncidents);
    return freeze({
      available: Boolean(pkg || localRuntimeAvailable),
      enabled: true,
      registered: Boolean(pkg),
      runtimeAvailable: localRuntimeAvailable
    });
  }

  function resolveProvider(providerId, globalName) {
    const provider = globalScope[globalName];
    const runtime = safeRuntime(provider);
    return freeze({
      available: Boolean(provider && typeof provider === "object"),
      enabled: runtime ? runtime.enabled === true : false,
      registered: runtime ? runtime.registered === true : Boolean(getPackage(`intelligence.${providerId}`)),
      recordCount: runtime && Number.isFinite(Number(runtime.recordCount)) ? Number(runtime.recordCount) : 0,
      normalizedRecordsAvailable: Boolean(provider && typeof provider.getNormalizedRecords === "function")
    });
  }

  function getProviders() {
    return freeze({
      community: resolveCommunitySource(),
      drivetexas: resolveProvider("drivetexas", "gridlyDriveTexasProvider"),
      weather: resolveProvider("weather", "gridlyWeatherProvider")
    });
  }

  function getMissingRequiredProviders(providers) {
    return freeze(REQUIRED_FOUNDATIONS.filter((providerId) => providers?.[providerId]?.available !== true));
  }

  function getState() {
    const providers = getProviders();
    const missingRequiredProviders = getMissingRequiredProviders(providers);
    return freeze({
      system: SYSTEM_NAME,
      registered: true,
      enabled: false,
      activated: false,
      providerCount: PROVIDER_IDS.length,
      providers,
      recordCount: 0,
      uiOwnership: false,
      consumerRenderingActive: false,
      missingRequiredProviders,
      safeForActivation: missingRequiredProviders.length === 0
    });
  }

  function collectNormalizedRecords() {
    const summary = getState();
    if (summary.enabled !== true || summary.activated !== true) return freeze([]);
    return freeze(["gridlyDriveTexasProvider", "gridlyWeatherProvider"].flatMap((globalName) => {
      const provider = globalScope[globalName];
      if (!provider || typeof provider.getNormalizedRecords !== "function") return [];
      try {
        const records = provider.getNormalizedRecords();
        return Array.isArray(records) ? records.map(clone).filter(Boolean) : [];
      } catch (error) {
        return [];
      }
    }));
  }

  const api = freeze({
    getState,
    collectNormalizedRecords
  });

  globalScope.gridlyUnifiedIntelligence = api;
  globalScope.gridlyUnifiedIntelligenceAudit = function gridlyUnifiedIntelligenceAudit() {
    const summary = getState();
    return freeze({
      system: SYSTEM_NAME,
      registered: summary.registered === true,
      enabled: false,
      activated: false,
      driveTexasVisible: summary.providers.drivetexas.available === true,
      weatherVisible: summary.providers.weather.available === true,
      communityRecognized: summary.providers.community.available === true,
      uiOwnership: false,
      consumerRenderingActive: false,
      missingRequiredProviders: summary.missingRequiredProviders,
      safeForActivation: summary.safeForActivation === true
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
