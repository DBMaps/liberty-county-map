(function initGridlyIntelligenceActivationReadiness(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const AUDIT_NAME = "V834 Intelligence Activation Readiness";
  const BASE_BLOCKERS = Object.freeze([
    "Unified Intelligence intentionally dormant",
    "Provider activation requires explicit future milestone"
  ]);
  const PROTECTED_SYSTEMS = Object.freeze({
    awarenessBriefUnchanged: true,
    alertsUnchanged: true,
    communityPulseUnchanged: true,
    routeWatchUnchanged: true,
    crossingsUnchanged: true,
    reportingUnchanged: true,
    supabaseUnchanged: true
  });

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function safeCall(fn) {
    if (typeof fn !== "function") return null;
    try {
      return fn() || null;
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

  function getProviderRuntime(globalName) {
    const provider = globalScope[globalName];
    if (!provider || typeof provider.getRuntimeState !== "function") return null;
    return safeCall(() => provider.getRuntimeState());
  }

  function providerRecordCount(globalName) {
    const provider = globalScope[globalName];
    if (!provider || typeof provider.getNormalizedRecords !== "function") return 0;
    const records = safeCall(() => provider.getNormalizedRecords());
    return Array.isArray(records) ? records.length : 0;
  }

  function resolveCommunity() {
    const pkg = getPackage("intelligence.community-reports");
    const runtimeAvailable = typeof globalScope.getLiveHazardIncidents === "function"
      || Array.isArray(globalScope.activeHazards)
      || Array.isArray(globalScope.unifiedRoadIncidents)
      || Array.isArray(globalScope.activeUnifiedIncidents);
    return freeze({
      available: Boolean(pkg || runtimeAvailable),
      recognized: Boolean(pkg || runtimeAvailable)
    });
  }

  function resolveProvider(globalName, auditName) {
    const audit = safeCall(globalScope[auditName]);
    const runtime = getProviderRuntime(globalName);
    const registered = audit ? audit.registered === true : runtime ? runtime.registered === true : false;
    const enabled = runtime ? runtime.enabled === true : audit ? audit.enabled === true : false;
    const connected = runtime ? runtime.connected === true : audit ? audit.connected === true : false;
    const normalizedModelReady = audit ? audit.normalizedModelReady === true : runtime ? runtime.normalizedModelReady === true : false;
    const uiOwnership = audit ? audit.uiOwnership === true : runtime ? runtime.uiOwnership === true : false;
    const visible = Boolean(globalScope[globalName] && typeof globalScope[globalName] === "object");
    const dormant = enabled === false && connected === false && providerRecordCount(globalName) === 0;
    return freeze({
      registered,
      enabled,
      connected,
      normalizedModelReady,
      uiOwnership,
      safeForActivation: visible && registered && normalizedModelReady && uiOwnership === false && dormant,
      visible,
      dormant
    });
  }

  function resolveUnified() {
    const api = globalScope.gridlyUnifiedIntelligence;
    const audit = safeCall(globalScope.gridlyUnifiedIntelligenceAudit);
    const state = api && typeof api.getState === "function" ? safeCall(() => api.getState()) : null;
    const records = api && typeof api.collectNormalizedRecords === "function" ? safeCall(() => api.collectNormalizedRecords()) : null;
    const registered = audit ? audit.registered === true : state ? state.registered === true : false;
    const enabled = state ? state.enabled === true : audit ? audit.enabled === true : false;
    const activated = state ? state.activated === true : audit ? audit.activated === true : false;
    const consumerRenderingActive = state ? state.consumerRenderingActive === true : audit ? audit.consumerRenderingActive === true : false;
    const uiOwnership = state ? state.uiOwnership === true : audit ? audit.uiOwnership === true : false;
    const collectionDormant = Array.isArray(records) && records.length === 0;
    return freeze({
      registered,
      enabled,
      activated,
      consumerRenderingActive,
      uiOwnership,
      safeForActivation: Boolean(api) && registered && enabled === false && activated === false && consumerRenderingActive === false && uiOwnership === false && collectionDormant,
      visible: Boolean(api),
      collectionDormant
    });
  }

  globalScope.gridlyIntelligenceActivationReadinessAudit = function gridlyIntelligenceActivationReadinessAudit() {
    const providers = freeze({
      community: resolveCommunity(),
      drivetexas: resolveProvider("gridlyDriveTexasProvider", "gridlyDriveTexasProviderAudit"),
      weather: resolveProvider("gridlyWeatherProvider", "gridlyWeatherProviderAudit"),
      unified: resolveUnified()
    });
    const blockers = BASE_BLOCKERS.slice();
    if (!providers.community.available) blockers.push("Community incident source is not available");
    if (!providers.drivetexas.safeForActivation) blockers.push("DriveTexas foundation is missing or not dormant");
    if (!providers.weather.safeForActivation) blockers.push("Weather foundation is missing or not dormant");
    if (!providers.unified.safeForActivation) blockers.push("Unified Intelligence foundation is missing or not dormant");
    const structurallyReady = providers.community.available === true
      && providers.drivetexas.safeForActivation === true
      && providers.weather.safeForActivation === true
      && providers.unified.safeForActivation === true;
    return freeze({
      audit: AUDIT_NAME,
      readyForActivation: structurallyReady,
      activationAllowed: false,
      activationPolicy: "V834 is readiness-only; Unified Intelligence activation requires an explicit future milestone.",
      providers,
      protectedSystems: PROTECTED_SYSTEMS,
      consumerRenderingActive: providers.unified.consumerRenderingActive === true,
      blockers: freeze(blockers)
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
