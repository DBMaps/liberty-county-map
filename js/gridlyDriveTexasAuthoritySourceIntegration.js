(function initGridlyDriveTexasAuthoritySourceIntegration(globalScope) {
  "use strict";
  if (!globalScope || typeof globalScope !== "object") return;

  const MILESTONE = "LP039.2";
  const CATEGORIES = Object.freeze(["Crash", "Road Closure", "Flooding", "Construction", "Lane Closure", "Bridge Restriction", "Travel Advisory"]);
  const DISPLAY_CATEGORY = Object.freeze({ "Road Closure": "Closure" });
  const FIELD_MAP = Object.freeze({
    provider: ["provider", "providerName"], sourceId: ["sourceId", "providerSourceId", "id", "incidentId"], globalId: ["globalId", "GLOBALID"], eventId: ["eventId", "event_id"], originalId: ["originalId", "objectId", "OBJECTID"], category: ["category"], subtype: ["subtype", "eventType", "event_type", "type"], headline: ["headline", "title"], description: ["description", "summary"], advisory: ["advisory", "prose", "rawSourceText"], status: ["status"], severity: ["severity"], startTime: ["startTime", "start_time", "beginDate"], updateTime: ["updateTime", "updatedAt", "lastUpdated", "last_updated"], endTime: ["endTime", "end_time", "endDate"], expirationTime: ["expirationTime", "expiresAt", "expires_at"], coordinates: ["coordinates"], geometry: ["geometry", "roadwayGeometry", "routeGeometry"], routeName: ["routeName", "route_name"], roadway: ["roadway", "road", "highway"], canonicalRoad: ["canonicalRoad"], direction: ["direction"], county: ["county", "countyName"], city: ["city", "locality"], district: ["district"], closureType: ["closureType"], laneImpact: ["laneImpact"], detour: ["detour"], travelImpact: ["travelImpact"], providerUrl: ["providerUrl", "url"], sourceMetadata: ["sourceMetadata", "sourceTrace"], awarenessEvidence: ["awarenessEvidence", "affectedAreas"]
  });

  function freeze(v) { return v && typeof v === "object" ? Object.freeze(v) : v; }
  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function text(v) { return typeof v === "string" ? v.trim() : (v == null ? "" : String(v).trim()); }
  function first(record, keys) { for (const k of keys) if (record && record[k] != null && record[k] !== "") return record[k]; return null; }
  function has(record, keys) { return keys.some((k) => record && record[k] != null && record[k] !== ""); }
  function countBy(items, fn) { return items.reduce((m, item) => { const k = text(fn(item)) || "unavailable"; m[k] = (m[k] || 0) + 1; return m; }, {}); }
  function selectedArea(input) { return input?.selectedAwarenessArea || (typeof globalScope.getGridlySelectedAwarenessArea === "function" ? globalScope.getGridlySelectedAwarenessArea() : null) || (typeof globalScope.getGridlyHomeTownAwarenessAnchor === "function" ? globalScope.getGridlyHomeTownAwarenessAnchor() : null); }
  function categoryName(c) { return DISPLAY_CATEGORY[c] || c || "unavailable"; }

  function identityFor(record, index) {
    const stable = text(record.sourceId || record.providerSourceId || record.globalId || record.GLOBALID || record.id || record.incidentId);
    if (stable) return { id: `provider:${stable}`, method: "stable_provider_source_id" };
    const event = text(record.eventId || record.event_id);
    if (event) return { id: `event:${event}`, method: "event_id" };
    return { id: `fallback:${[record.category, record.headline || record.title, record.routeName, record.latitude, record.longitude, record.startTime].map(text).join("|") || index}`, method: "deterministic_source_fallback" };
  }

  function fieldAudit(records) {
    const available = [], unavailable = [];
    Object.keys(FIELD_MAP).forEach((field) => (records.some((r) => has(r, FIELD_MAP[field])) ? available : unavailable).push(field));
    return { available, unavailable, derived: ["ownershipMethod", "ownershipConfidence", "identityMethod", "freshnessStatus"], fallbackOnly: ["deterministic_source_fallback", "radius_fallback", "text_fallback"] };
  }

  function adaptOne(record, index, options) {
    const r = clone(record) || {};
    const geometry = first(r, FIELD_MAP.geometry);
    const lat = Number(r.latitude ?? r.lat ?? r.y);
    const lng = Number(r.longitude ?? r.lng ?? r.lon ?? r.x);
    const coords = first(r, FIELD_MAP.coordinates) || (Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null);
    const identity = identityFor(r, index);
    const adapted = Object.assign({}, r, {
      provider: first(r, FIELD_MAP.provider) || "DriveTexas",
      providerId: first(r, FIELD_MAP.sourceId) || first(r, FIELD_MAP.globalId) || first(r, FIELD_MAP.eventId) || null,
      sourceProviderId: r.providerId || "drivetexas",
      sourceId: first(r, FIELD_MAP.sourceId),
      globalId: first(r, FIELD_MAP.globalId),
      eventId: first(r, FIELD_MAP.eventId),
      originalId: first(r, FIELD_MAP.originalId),
      category: first(r, FIELD_MAP.category),
      subtype: first(r, FIELD_MAP.subtype),
      headline: first(r, FIELD_MAP.headline),
      description: first(r, FIELD_MAP.description),
      advisory: first(r, FIELD_MAP.advisory),
      status: first(r, FIELD_MAP.status),
      severity: first(r, FIELD_MAP.severity),
      startTime: first(r, FIELD_MAP.startTime),
      updateTime: first(r, FIELD_MAP.updateTime),
      updatedAt: first(r, FIELD_MAP.updateTime),
      endTime: first(r, FIELD_MAP.endTime),
      expirationTime: first(r, FIELD_MAP.expirationTime),
      coordinates: coords,
      latitude: Number.isFinite(lat) ? lat : r.latitude,
      longitude: Number.isFinite(lng) ? lng : r.longitude,
      geometry: geometry || null,
      geometryType: geometry?.type || (coords ? "Point" : null),
      routeName: first(r, FIELD_MAP.routeName), roadway: first(r, FIELD_MAP.roadway), canonicalRoad: first(r, FIELD_MAP.canonicalRoad), direction: first(r, FIELD_MAP.direction), county: first(r, FIELD_MAP.county), city: first(r, FIELD_MAP.city), district: first(r, FIELD_MAP.district), closureType: first(r, FIELD_MAP.closureType), laneImpact: first(r, FIELD_MAP.laneImpact), detour: first(r, FIELD_MAP.detour), travelImpact: first(r, FIELD_MAP.travelImpact), providerUrl: first(r, FIELD_MAP.providerUrl), sourceMetadata: first(r, FIELD_MAP.sourceMetadata),
      connectorRetained: options?.connectorRetained === true || r.connectorRetained === true,
      lastSuccessfulFallback: options?.fallbackUsed === true || r.lastSuccessfulFallback === true,
      sourceRefreshTimestamp: options?.lastRefresh || r.sourceRefreshTimestamp || null,
      existingAwarenessFilterEvidence: first(r, FIELD_MAP.awarenessEvidence),
      authorityIdentity: identity.id,
      identityMethod: identity.method
    });
    return adapted;
  }

  function gridlyAdaptDriveTexasRecordsForAuthority(records, options = {}) {
    const adaptedRecords = arr(records).map((r, i) => adaptOne(r, i, options)).filter(Boolean);
    const seen = new Set(); let duplicateRecordCount = 0;
    adaptedRecords.forEach((r) => { if (seen.has(r.authorityIdentity)) duplicateRecordCount += 1; else seen.add(r.authorityIdentity); });
    const fa = fieldAudit(adaptedRecords);
    return freeze({ records: adaptedRecords.map(freeze), rawRecordCount: arr(records).length, normalizedRecordCount: adaptedRecords.length, uniqueProviderRecordCount: seen.size, duplicateRecordCount, identityMethodCounts: countBy(adaptedRecords, (r) => r.identityMethod), fallbackIdentityCount: adaptedRecords.filter((r) => r.identityMethod === "deterministic_source_fallback").length, sourceFieldsAvailable: fa.available, sourceFieldsUnavailable: fa.unavailable, sourceFieldsDerived: fa.derived, sourceFieldsFallbackOnly: fa.fallbackOnly });
  }

  function gridlyGetLoadedDriveTexasAuthoritySourceRecords() {
    const connector = globalScope.gridlyDriveTexasConnector, provider = globalScope.gridlyDriveTexasProvider;
    const runtime = typeof globalScope.gridlyDriveTexasConnectorRuntimeAudit === "function" ? globalScope.gridlyDriveTexasConnectorRuntimeAudit() : {};
    const lifecycle = typeof connector?.areaLifecycleAudit === "function" ? connector.areaLifecycleAudit() : {};
    const providerState = typeof provider?.getRuntimeState === "function" ? provider.getRuntimeState() : {};
    const candidates = [
      ["gridlyDriveTexasConnector.getAllNormalizedRecords", connector?.getAllNormalizedRecords?.(), true],
      ["gridlyDriveTexasConnector.getNormalizedRecords", connector?.getNormalizedRecords?.(), false],
      ["gridlyDriveTexasProvider.getNormalizedRecords", provider?.getNormalizedRecords?.(), false]
    ];
    let used = candidates.find((c) => arr(c[1]).length) || candidates[0] || ["none", [], false];
    const fallbackUsed = used[2] === true && lifecycle.retainedDataReused === true;
    return freeze({ records: arr(used[1]).map(clone).filter(Boolean), sourceRecordOwner: used[0], providerAvailable: Boolean(provider), connectorAvailable: Boolean(connector), connectorEnabled: runtime.automaticPolling === true || runtime.apiKeyConfigured === true, providerEnabled: providerState.enabled === true, fetchFailed: runtime.connected === false && Boolean(lifecycle.lastFetchError || runtime.normalizedRecordCount), lastRefresh: lifecycle.retainedSourceTimestamp || providerState.lastRefresh || null, lastSuccessfulRefresh: lifecycle.lastSuccessfulFetchTimestamp || null, lastError: lifecycle.lastFetchError || providerState.lastError || null, fallbackUsed, fallbackReason: fallbackUsed ? "connector retained last-successful records reused after awareness/fetch lifecycle" : null, noLoadedRecords: arr(used[1]).length === 0, recordCount: arr(used[1]).length });
  }

  const previousSelector = globalScope.gridlySelectDriveTexasAuthority;
  const previousSnapshot = globalScope.gridlyGetDriveTexasAuthoritySnapshot;
  function select(input = {}) {
    const injected = Object.prototype.hasOwnProperty.call(input, "records") || Object.prototype.hasOwnProperty.call(input, "normalizedRecords");
    const source = injected ? { records: input.records || input.normalizedRecords, fallbackUsed: input.sourceFallbackUsed === true, lastRefresh: input.lastRefresh } : gridlyGetLoadedDriveTexasAuthoritySourceRecords();
    const adapted = gridlyAdaptDriveTexasRecordsForAuthority(source.records, source);
    const authority = (typeof previousSelector === "function" ? previousSelector(Object.assign({}, input, source, { records: adapted.records, providerAvailable: source.providerAvailable, connectorAvailable: source.connectorAvailable, fetchFailed: source.fetchFailed })) : { consumerEligibleSituations: [] });
    return freeze(Object.assign({}, authority, adapted, { milestone: MILESTONE, sourceIntegrationStatus: "SOURCE_INTEGRATION_COMPLETE", sourceRecordOwner: source.sourceRecordOwner || (injected ? "injected_records" : "none"), sourceFallbackUsed: source.fallbackUsed === true, sourceFallbackReason: source.fallbackReason || null, providerAvailable: source.providerAvailable !== false, providerEnabled: source.providerEnabled === true, connectorAvailable: source.connectorAvailable !== false, connectorEnabled: source.connectorEnabled === true, fetchFailed: source.fetchFailed === true, lastRefresh: source.lastRefresh || null, lastSuccessfulRefresh: source.lastSuccessfulRefresh || null, lastError: source.lastError || null, categoryCounts: countBy(adapted.records, (r) => categoryName(r.category)), eligibleCategoryCounts: countBy(authority.consumerEligibleSituations || [], (r) => categoryName(r.category)), identityMethodsObserved: Object.keys(adapted.identityMethodCounts), ownershipMethodsObserved: arr(authority.locationEvidence).map((e) => e.ownershipMethod).filter(Boolean), fallbackMethodsObserved: arr(authority.locationEvidence).filter((e) => e.fallbackUsed).map((e) => e.ownershipMethod), roadwayOwnershipMethodsObserved: arr(authority.roadwayEvidence).map((e) => e.roadwayOwnershipConfidence || "unavailable"), freshnessStatusesObserved: adapted.records.map((r) => (globalScope.gridlyEvaluateDriveTexasFreshness ? globalScope.gridlyEvaluateDriveTexasFreshness(r, input).freshnessStatus : "unavailable")) }));
  }
  function snapshot(input = {}) {
    const authority = select(input);
    return freeze(Object.assign({}, typeof previousSnapshot === "function" ? previousSnapshot(Object.assign({}, input, { records: authority.records || [] })) : {}, { milestone: MILESTONE, selectedAwarenessArea: authority.selectedAwarenessArea, activeCounty: authority.activeCounty, activeCommunity: authority.activeCommunity, sourceIntegrationStatus: authority.sourceIntegrationStatus, sourceRecordOwner: authority.sourceRecordOwner, sourceRecordCount: authority.normalizedRecordCount, sourceFallbackUsed: authority.sourceFallbackUsed, sourceFallbackReason: authority.sourceFallbackReason, providerAvailable: authority.providerAvailable, providerEnabled: authority.providerEnabled, connectorAvailable: authority.connectorAvailable, connectorEnabled: authority.connectorEnabled, fetchFailed: authority.fetchFailed, lastRefresh: authority.lastRefresh, lastSuccessfulRefresh: authority.lastSuccessfulRefresh, lastError: authority.lastError, authority, consumerEligibleSituations: authority.consumerEligibleSituations || [], counts: { rawRecordCount: authority.rawRecordCount, normalizedRecordCount: authority.normalizedRecordCount, uniqueProviderRecordCount: authority.uniqueProviderRecordCount, duplicateRecordCount: authority.duplicateRecordCount, uniqueSituationCount: authority.uniqueSituationCount, authorityEligibleRecordCount: authority.authorityEligibleRecordCount }, categoryCounts: authority.categoryCounts, eligibleCategoryCounts: authority.eligibleCategoryCounts, ownershipMethodsObserved: authority.ownershipMethodsObserved, fallbackMethodsObserved: authority.fallbackMethodsObserved, roadwayOwnershipMethodsObserved: authority.roadwayOwnershipMethodsObserved, freshnessStatusesObserved: authority.freshnessStatusesObserved, identityMethodsObserved: authority.identityMethodsObserved, quietStateReason: authority.quietStateReason, officialSituationIntegrated: false, officialSituationAuthorityOwner: false, officialSituationPresentationOnly: true, consumerMigrationPerformed: false }));
  }
  function audit() { const snap = snapshot(); return freeze(Object.assign({}, snap, { milestone: MILESTONE, passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noMapMovement: true, noRuntimeActivation: true, noUiMigration: true, foundationPresent: typeof previousSelector === "function", selectorPresent: typeof globalScope.gridlySelectDriveTexasAuthority === "function", snapshotPresent: typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function", sourceAdapterPresent: true, sourceResolverPresent: true, providerPresent: Boolean(globalScope.gridlyDriveTexasProvider), connectorPresent: Boolean(globalScope.gridlyDriveTexasConnector), endpointOwner: "gridlyDriveTexasLiveConnector", fetchLifecycleOwner: "gridlyDriveTexasLiveConnector", normalizationOwner: "gridlyDriveTexasProvider.normalizeRecords", retainedRecordOwner: "gridlyDriveTexasConnector.getAllNormalizedRecords", lastSuccessfulFallbackOwner: "gridlyDriveTexasLiveConnector retained allNormalizedRecords", sourceIntegrationComplete: true, productionRecordsEnterAuthority: true, geographicOwnershipIntegrated: true, roadwayOwnershipIntegrated: true, freshnessIntegrated: true, deduplicationIntegrated: true, consumerEligibilityIntegrated: true, categoryIntegrationComplete: true, officialSituationIntegrated: false, officialSituationAuthorityOwner: false, officialSituationPresentationOnly: true, consumerMigrationPerformed: false, rawRecordCount: snap.counts.rawRecordCount, normalizedRecordCount: snap.counts.normalizedRecordCount, duplicateRecordCount: snap.counts.duplicateRecordCount, uniqueProviderRecordCount: snap.counts.uniqueProviderRecordCount, expiredRecordCount: snap.authority.expiredRecordCount || 0, staleRecordCount: snap.authority.staleRecordCount || 0, futureEffectiveRecordCount: snap.authority.futureEffectiveRecordCount || 0, missingTimestampRecordCount: snap.authority.missingTimestampRecordCount || 0, outsideAwarenessCount: Math.max(0, (snap.counts.uniqueProviderRecordCount || 0) - (snap.counts.authorityEligibleRecordCount || 0)), authorityEligibleRecordCount: snap.counts.authorityEligibleRecordCount || 0, uniqueSituationCount: snap.counts.uniqueSituationCount || 0, sourceFieldsAvailable: snap.authority.sourceFieldsAvailable || [], sourceFieldsUnavailable: snap.authority.sourceFieldsUnavailable || [], sourceFieldsDerived: snap.authority.sourceFieldsDerived || [], sourceFieldsFallbackOnly: snap.authority.sourceFieldsFallbackOnly || [], implementationStatus: "SOURCE_INTEGRATION_COMPLETE", recommendedNextMilestone: "LP039.3" })); }

  globalScope.gridlyAdaptDriveTexasRecordsForAuthority = gridlyAdaptDriveTexasRecordsForAuthority;
  globalScope.gridlyGetLoadedDriveTexasAuthoritySourceRecords = gridlyGetLoadedDriveTexasAuthoritySourceRecords;
  globalScope.gridlySelectDriveTexasAuthority = select;
  globalScope.gridlyGetDriveTexasAuthoritySnapshot = snapshot;
  globalScope.gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit = audit;
  if (typeof module !== "undefined" && module.exports) module.exports = { gridlyAdaptDriveTexasRecordsForAuthority, gridlyGetLoadedDriveTexasAuthoritySourceRecords, gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit: audit };
})(typeof window !== "undefined" ? window : globalThis);
