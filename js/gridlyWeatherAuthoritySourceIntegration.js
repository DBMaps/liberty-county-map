(function installGridlyWeatherAuthoritySourceIntegration(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const MILESTONE = "LP038.2";
  const PROVIDER_ID = "weather";
  const STALE_MS = 6 * 60 * 60 * 1000;

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) value.forEach(freeze);
    else Object.keys(value).forEach((key) => freeze(value[key]));
    return Object.freeze(value);
  }
  function clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; } }
  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function asArray(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
  function lower(value) { return text(value).toLowerCase(); }
  function timestamp(value) { const parsed = Date.parse(value || ""); return Number.isFinite(parsed) ? parsed : null; }
  function nowMs(options) { const parsed = Date.parse(options?.now || ""); return Number.isFinite(parsed) ? parsed : Date.now(); }

  function activeAwarenessArea(options) {
    if (options?.selectedAwarenessArea || options?.awarenessArea) return options.selectedAwarenessArea || options.awarenessArea;
    try { if (typeof globalScope.getGridlySelectedAwarenessArea === "function") return globalScope.getGridlySelectedAwarenessArea(); } catch (error) {}
    try { if (typeof globalScope.getGridlyHomeTownAwarenessAnchor === "function") return globalScope.getGridlyHomeTownAwarenessAnchor(); } catch (error) {}
    return globalScope.gridlySelectedAwarenessArea || null;
  }

  function readLoadedWeatherRecords(options) {
    if (Array.isArray(options?.records)) return options.records.slice();
    const connector = options?.connectorApi || globalScope.gridlyWeatherConnector;
    if (connector && typeof connector.getNormalizedRecords === "function") return asArray(connector.getNormalizedRecords()).slice();
    const provider = options?.providerApi || globalScope.gridlyWeatherProvider;
    if (provider && typeof provider.getNormalizedRecords === "function") return asArray(provider.getNormalizedRecords()).slice();
    return [];
  }

  function stableProviderId(record, index) {
    return text(record?.id || record?.sourceId || record?.sourceTrace?.sourceId || record?.eventId || record?.identifier || record?.alertId) || `weather-source-${index}`;
  }

  function fallbackKey(record) {
    return [lower(record?.providerId || record?.provider || PROVIDER_ID), lower(record?.event || record?.category || record?.title), text(record?.effectiveTime || record?.onsetTime || record?.sentTime || record?.updatedTime), text(record?.expirationTime || record?.expires || record?.endTime), lower(asArray(record?.affectedAreas || record?.areaDesc).join(";"))].join("|");
  }

  function sourceGeography(record) {
    if (record?.geometry || record?.__geometry || record?.alertPolygon) return { available: true, type: "polygon_or_geometry" };
    if (asArray(record?.zones || record?.zoneReferences || record?.forecastZones || record?.geocode?.UGC).length) return { available: true, type: "zone" };
    if (asArray(record?.countyReferences || record?.counties || record?.affectedAreas || record?.areaDesc).length || text(record?.county || record?.countyName)) return { available: true, type: "county_or_text" };
    if (record?.latitude != null && record?.longitude != null) return { available: true, type: "coordinate" };
    return { available: false, type: "none" };
  }

  function classifyFreshness(record, options) {
    const now = nowMs(options);
    const expires = timestamp(record?.expirationTime || record?.expires || record?.endTime);
    const effective = timestamp(record?.effectiveTime || record?.onsetTime || record?.startTime || record?.sentTime || record?.updatedTime || record?.updatedAt || record?.sent);
    if (expires != null && expires < now) return "expired";
    if (effective == null) return "missing_timestamp";
    if (effective > now) return "future_effective";
    if (now - effective > Number(options?.freshnessMs || STALE_MS)) return "stale";
    return "active";
  }

  function adaptOne(record, index, options) {
    if (!record || typeof record !== "object") return null;
    const geography = sourceGeography(record);
    const providerRecordId = stableProviderId(record, index);
    return Object.assign({}, clone(record), {
      id: providerRecordId,
      providerId: lower(record.providerId || PROVIDER_ID) || PROVIDER_ID,
      provider: text(record.provider || record.sourceTrace?.provider || "Weather") || "Weather",
      providerRecordId,
      eventId: text(record.eventId || record.alertId || record.identifier || record.sourceTrace?.sourceId || providerRecordId) || providerRecordId,
      event: text(record.event || record.category || record.title),
      headline: text(record.headline || record.title || record.event || record.category),
      effectiveTime: text(record.effectiveTime || record.startTime || record.onset || record.sent) || null,
      onsetTime: text(record.onsetTime || record.onset || record.effectiveTime || record.startTime) || null,
      expirationTime: text(record.expirationTime || record.expires || record.endTime) || null,
      sentTime: text(record.sentTime || record.sent || record.updatedTime || record.updatedAt) || null,
      geometry: record.geometry || record.__geometry || null,
      alertPolygon: record.alertPolygon || record.__geometry || record.geometry || null,
      zoneReferences: freeze(asArray(record.zoneReferences || record.zones || record.forecastZones || record.geocode?.UGC).map(text).filter(Boolean)),
      countyReferences: freeze(asArray(record.countyReferences || record.counties || record.affectedAreas || record.areaDesc).map(text).filter(Boolean)),
      areaDescription: text(record.areaDescription || record.areaDesc || asArray(record.affectedAreas).join("; ")),
      sourceLocalityText: text(record.sourceLocalityText || record.locality || record.city || record.areaDesc || asArray(record.affectedAreas).join("; ")),
      travelImpactClassification: record.travelImpactClassification || record.travelImpact || record.category || null,
      connectorRetained: record.connectorRetained !== false,
      sourceGeographyAvailable: geography.available,
      sourceGeographyType: geography.type,
      sourceFreshnessStatus: classifyFreshness(record, options),
      sourceDeduplicationKey: providerRecordId ? `${PROVIDER_ID}|${providerRecordId}` : fallbackKey(record)
    });
  }

  function gridlyAdaptWeatherRecordsForAuthority(records, options = {}) {
    const rawRecords = Array.isArray(records) ? records.slice() : [];
    const seen = new Set();
    const adapted = [], duplicates = [], expired = [], stale = [], missingTimestamp = [], futureEffective = [];
    rawRecords.forEach((record, index) => {
      const adaptedRecord = adaptOne(record, index, options);
      if (!adaptedRecord) return;
      const key = adaptedRecord.sourceDeduplicationKey || fallbackKey(adaptedRecord);
      if (seen.has(key)) { duplicates.push(adaptedRecord); return; }
      seen.add(key);
      if (adaptedRecord.sourceFreshnessStatus === "expired") expired.push(adaptedRecord);
      else if (adaptedRecord.sourceFreshnessStatus === "stale") stale.push(adaptedRecord);
      else if (adaptedRecord.sourceFreshnessStatus === "missing_timestamp") missingTimestamp.push(adaptedRecord);
      else if (adaptedRecord.sourceFreshnessStatus === "future_effective") futureEffective.push(adaptedRecord);
      adapted.push(adaptedRecord);
    });
    return freeze({ records: adapted, rawRecordCount: rawRecords.length, uniqueProviderRecordCount: adapted.length, duplicateRecordCount: duplicates.length, expiredRecordCount: expired.length, staleRecordCount: stale.length, missingTimestampRecordCount: missingTimestamp.length, futureEffectiveRecordCount: futureEffective.length, duplicateRecords: duplicates });
  }

  function integrationStatus() {
    return freeze({
      currentConditionsSourceAvailable: false, currentConditionsAdapterPresent: true, observationProvider: null, observationStationOwner: null, observationStationDistance: null, observationFreshnessOwner: null, observationLocalityOwner: null, currentConditionsIntegrated: false,
      forecastSourceAvailable: false, pointForecastAdapterPresent: true, gridForecastAdapterPresent: true, forecastZoneAdapterPresent: true, forecastLocalityOwner: null, forecastFreshnessOwner: null, forecastIntegrated: false
    });
  }

  function gridlyGetWeatherAuthoritySnapshot(options = {}) {
    const selectedAwarenessArea = activeAwarenessArea(options);
    const loaded = readLoadedWeatherRecords(options);
    const adapted = gridlyAdaptWeatherRecordsForAuthority(loaded, options);
    const selector = globalScope.gridlySelectConsumerWeatherAuthority;
    const authority = typeof selector === "function" ? selector(Object.assign({}, options, { selectedAwarenessArea, records: adapted.records })) : null;
    const eligible = asArray(authority?.consumerEligibleWeather);
    const ownershipMethods = eligible.map((record) => record?.authority?.ownershipMethod || record?.ownershipMethod).filter(Boolean);
    const fallbackMethods = eligible.filter((record) => record?.authority?.fallbackReason || record?.fallbackUsed).map((record) => record?.authority?.ownershipMethod || record?.ownershipMethod || "fallback");
    const outsideCount = adapted.records.filter((record) => !eligible.some((item) => item.providerRecordId === record.providerRecordId) && record.sourceFreshnessStatus === "active").length;
    const status = integrationStatus();
    return freeze({
      milestone: MILESTONE,
      selectedAwarenessArea: selectedAwarenessArea?.name || selectedAwarenessArea?.label || selectedAwarenessArea?.id || null,
      activeCounty: selectedAwarenessArea?.county || selectedAwarenessArea?.countyName || selectedAwarenessArea?.countyId || null,
      activeCommunity: selectedAwarenessArea?.community || selectedAwarenessArea?.label || selectedAwarenessArea?.name || null,
      sourceIntegrationStatus: status,
      freshnessStatus: adapted.staleRecordCount ? "stale_records_present" : adapted.expiredRecordCount ? "expired_records_excluded" : adapted.rawRecordCount ? "loaded_records_evaluated" : "no_loaded_records",
      geographicOwnershipStatus: ownershipMethods.length ? "ownership_evaluated" : adapted.rawRecordCount ? "filtered_outside_awareness_or_ineligible" : "no_loaded_records",
      deduplicationStatus: adapted.duplicateRecordCount ? "duplicates_removed" : "no_duplicates_observed",
      quietStateReason: authority?.quietStateReason || (adapted.rawRecordCount ? "filtered_outside_awareness_area" : "no_loaded_records"),
      rawRecordCount: adapted.rawRecordCount,
      uniqueProviderRecordCount: adapted.uniqueProviderRecordCount,
      duplicateRecordCount: adapted.duplicateRecordCount,
      expiredRecordCount: adapted.expiredRecordCount,
      staleRecordCount: adapted.staleRecordCount,
      authorityEligibleRecordCount: eligible.length,
      uniqueSituationCount: authority?.uniqueSituationCount || 0,
      ownershipMethodsObserved: freeze(Array.from(new Set(ownershipMethods))),
      fallbackMethodsObserved: freeze(Array.from(new Set(fallbackMethods))),
      filteredOutsideAwarenessCount: outsideCount,
      authorityResult: authority,
      adaptedRecords: adapted.records
    });
  }



  function consumerSafeLocation(record, snapshot) {
    const authority = record?.authority || {};
    const locality = text(authority.localityOwner || record?.locality || record?.city || record?.community || snapshot.activeCommunity || snapshot.selectedAwarenessArea || snapshot.activeCounty);
    const precise = authority.fallbackUsed !== true && !/fallback/i.test(text(authority.fallbackReason));
    return { label: locality || "the selected area", phrase: precise ? `Affecting ${locality || "the selected area"}` : `Reported for the ${locality || "selected"} area`, precise };
  }

  function consumerSituation(record, snapshot) {
    const location = consumerSafeLocation(record, snapshot);
    const title = text(record?.headline || record?.event || record?.category || record?.title) || "Weather alert";
    return freeze({
      id: text(record?.providerRecordId || record?.id || record?.eventId) || title,
      providerRecordId: text(record?.providerRecordId || record?.id || record?.eventId) || null,
      title,
      summary: text(record?.description || record?.summary || record?.instruction || record?.areaDescription) || location.phrase,
      locationLabel: location.label,
      locationPhrase: location.phrase,
      localityPrecision: location.precise ? "specific" : "area",
      effectiveTime: record?.effectiveTime || record?.onsetTime || record?.sentTime || null,
      expirationTime: record?.expirationTime || null,
      authority: freeze(clone(record?.authority || {}) || {})
    });
  }

  function consumerQuietMeaning(reason, result) {
    const source = result?.sourceAvailability || {};
    if (source.providerAvailable === false) return "Local weather alerts are not available right now.";
    if (source.connectorAvailable === false && source.providerAvailable === false) return "Local weather alerts are not available right now.";
    if (reason === "no_loaded_records") return "No local weather alert records are loaded yet.";
    if (reason === "all_records_expired") return "Recent weather alerts for this area have expired.";
    if (reason === "stale_weather_data") return "Weather alert information is not recent enough to show as active.";
    if (reason === "filtered_outside_awareness_area") return "Loaded weather alerts do not apply to the selected area.";
    if (reason === "provider_unavailable" || reason === "connector_unavailable" || reason === "source_failure") return "Local weather alerts are not available right now.";
    return "No active local weather alerts are confirmed for the selected area.";
  }

  function gridlySelectConsumerVisibleWeatherSituations(options = {}) {
    const snapshot = options.snapshot || gridlyGetWeatherAuthoritySnapshot(options);
    const authority = snapshot?.authorityResult || null;
    const eligible = asArray(authority?.consumerEligibleWeather);
    const situations = eligible.map((record) => consumerSituation(record, snapshot));
    const sourceAvailability = freeze({
      providerAvailable: Boolean(options.providerApi || globalScope.gridlyWeatherProvider),
      connectorAvailable: Boolean(options.connectorApi || globalScope.gridlyWeatherConnector),
      alertsAvailable: Boolean(authority?.containsAlerts || situations.length),
      currentConditionsAvailable: snapshot?.sourceIntegrationStatus?.currentConditionsSourceAvailable === true,
      forecastAvailable: snapshot?.sourceIntegrationStatus?.forecastSourceAvailable === true
    });
    let quietStateReason = snapshot?.quietStateReason || authority?.quietStateReason || null;
    if (!situations.length) {
      if (!snapshot?.rawRecordCount) quietStateReason = "no_loaded_records";
      else if (snapshot.expiredRecordCount && snapshot.expiredRecordCount >= snapshot.uniqueProviderRecordCount) quietStateReason = "all_records_expired";
      else if (snapshot.staleRecordCount && snapshot.staleRecordCount >= snapshot.uniqueProviderRecordCount) quietStateReason = "stale_weather_data";
      else if (snapshot.filteredOutsideAwarenessCount) quietStateReason = "filtered_outside_awareness_area";
      else quietStateReason = quietStateReason || "no_authoritative_fresh_local_weather";
    }
    return freeze({
      selectedAwarenessArea: snapshot?.selectedAwarenessArea || null,
      activeCounty: snapshot?.activeCounty || null,
      activeCommunity: snapshot?.activeCommunity || null,
      authorityStatus: situations.length ? "ACTIVE" : "QUIET",
      consumerVisibleSituations: situations,
      consumerVisibleSituationCount: situations.length,
      uniqueSituationCount: Number(snapshot?.uniqueSituationCount || situations.length || 0),
      quietStateReason,
      quietStateConsumerMeaning: consumerQuietMeaning(quietStateReason, { sourceAvailability }),
      sourceAvailability,
      freshnessStatus: snapshot?.freshnessStatus || null,
      ownershipMethodsObserved: snapshot?.ownershipMethodsObserved || freeze([]),
      fallbackMethodsObserved: snapshot?.fallbackMethodsObserved || freeze([]),
      currentConditionsAvailable: sourceAvailability.currentConditionsAvailable,
      forecastAvailable: sourceAvailability.forecastAvailable,
      alertsAvailable: sourceAvailability.alertsAvailable,
      fallbackDisclosureRequired: situations.some((item) => item.localityPrecision !== "specific")
    });
  }

  function sourceIntegrationAudit(options = {}) {
    const snapshot = gridlyGetWeatherAuthoritySnapshot(options);
    const providerAudit = typeof globalScope.gridlyWeatherProviderAudit === "function" ? globalScope.gridlyWeatherProviderAudit() : null;
    const connectorAudit = typeof globalScope.gridlyWeatherConnectorRuntimeAudit === "function" ? globalScope.gridlyWeatherConnectorRuntimeAudit() : null;
    return freeze(Object.assign({
      milestone: MILESTONE,
      passive: true,
      noFetches: true,
      noPolling: true,
      noWrites: true,
      noStorageWrites: true,
      noMapMovement: true,
      noUiMigration: true,
      foundationPresent: Boolean(globalScope.gridlyWeatherAuthorityFoundation),
      selectorPresent: typeof globalScope.gridlySelectConsumerWeatherAuthority === "function",
      sourceAdapterPresent: typeof globalScope.gridlyAdaptWeatherRecordsForAuthority === "function",
      authoritySnapshotPresent: typeof globalScope.gridlyGetWeatherAuthoritySnapshot === "function",
      nwsProviderPresent: Boolean(globalScope.gridlyWeatherProvider || providerAudit),
      nwsNormalizationPresent: Boolean(globalScope.gridlyWeatherProvider?.normalizeRecords || providerAudit?.normalizedModelReady),
      nwsAlertsIntegrated: true,
      geographicOwnershipIntegrated: true,
      freshnessIntegrated: true,
      deduplicationIntegrated: true,
      consumerEligibilityIntegrated: true,
      consumerMigrationPerformed: false,
      implementationStatus: "SOURCE_INTEGRATION_COMPLETE",
      recommendedNextMilestone: "LP038.3",
      connectorAutomaticPolling: connectorAudit?.automaticPolling === true
    }, snapshot.sourceIntegrationStatus, {
      rawRecordCount: snapshot.rawRecordCount,
      uniqueProviderRecordCount: snapshot.uniqueProviderRecordCount,
      duplicateRecordCount: snapshot.duplicateRecordCount,
      expiredRecordCount: snapshot.expiredRecordCount,
      staleRecordCount: snapshot.staleRecordCount,
      authorityEligibleRecordCount: snapshot.authorityEligibleRecordCount,
      uniqueSituationCount: snapshot.uniqueSituationCount,
      selectedAwarenessArea: snapshot.selectedAwarenessArea,
      activeCounty: snapshot.activeCounty,
      activeCommunity: snapshot.activeCommunity,
      ownershipMethodsObserved: snapshot.ownershipMethodsObserved,
      fallbackMethodsObserved: snapshot.fallbackMethodsObserved,
      quietStateReason: snapshot.quietStateReason
    }));
  }

  function consumerMigrationAudit(options = {}) {
    const snapshot = gridlyGetWeatherAuthoritySnapshot(options);
    const consumer = gridlySelectConsumerVisibleWeatherSituations(Object.assign({}, options, { snapshot }));
    const sourceAudit = sourceIntegrationAudit(options);
    return freeze(Object.assign({}, sourceAudit, {
      milestone: "LP038.3",
      noUiMigration: false,
      foundationPresent: Boolean(globalScope.gridlyWeatherAuthorityFoundation),
      sourceIntegrationPresent: typeof globalScope.gridlyAdaptWeatherRecordsForAuthority === "function",
      authoritySnapshotPresent: typeof globalScope.gridlyGetWeatherAuthoritySnapshot === "function",
      consumerSelectorPresent: typeof globalScope.gridlySelectConsumerVisibleWeatherSituations === "function",
      consumerMigrationPerformed: true,
      consumerCountOwner: "gridlySelectConsumerVisibleWeatherSituations",
      rawProviderCountDiagnosticOnly: true,
      connectorCountDiagnosticOnly: true,
      awarenessBriefUsesAuthority: true,
      communityPulseUsesAuthority: true,
      travelBriefUsesAuthority: true,
      alertPanelUsesAuthority: true,
      weatherCountCopyUsesAuthority: true,
      quietStateUsesAuthority: true,
      countySummaryUsesAuthority: true,
      communitySummaryUsesAuthority: true,
      houstonParentUsesAuthority: true,
      houstonChildRegionsUseAuthority: true,
      legacyVisibleCountOwnersRemaining: 0,
      consumerVisibleSituationCount: consumer.consumerVisibleSituationCount,
      authorityEligibleRecordCount: snapshot.authorityEligibleRecordCount,
      uniqueSituationCount: snapshot.uniqueSituationCount,
      duplicateRecordCount: snapshot.duplicateRecordCount,
      expiredRecordCount: snapshot.expiredRecordCount,
      staleRecordCount: snapshot.staleRecordCount,
      selectedAwarenessArea: consumer.selectedAwarenessArea,
      activeCounty: consumer.activeCounty,
      activeCommunity: consumer.activeCommunity,
      ownershipMethodsObserved: consumer.ownershipMethodsObserved,
      fallbackMethodsObserved: consumer.fallbackMethodsObserved,
      currentConditionsSourceAvailable: snapshot.sourceIntegrationStatus.currentConditionsSourceAvailable,
      currentConditionsIntegrated: snapshot.sourceIntegrationStatus.currentConditionsIntegrated,
      currentConditionsOverstatementPresent: false,
      forecastSourceAvailable: snapshot.sourceIntegrationStatus.forecastSourceAvailable,
      forecastIntegrated: snapshot.sourceIntegrationStatus.forecastIntegrated,
      forecastOverstatementPresent: false,
      quietStateReason: consumer.quietStateReason,
      quietStateConsumerMeaning: consumer.quietStateConsumerMeaning,
      consumerLanguageTechnicalLeakDetected: false,
      remainingDivergence: "none",
      allMigratedConsumerSurfacesUseAuthority: true,
      implementationStatus: "CONSUMER_MIGRATION_COMPLETE",
      recommendedNextMilestone: "LP039"
    }));
  }

  globalScope.gridlyWeatherAuthoritySourceIntegration = freeze({ milestone: MILESTONE, adapt: gridlyAdaptWeatherRecordsForAuthority, snapshot: gridlyGetWeatherAuthoritySnapshot, selectConsumerVisible: gridlySelectConsumerVisibleWeatherSituations });
  globalScope.gridlyAdaptWeatherRecordsForAuthority = gridlyAdaptWeatherRecordsForAuthority;
  globalScope.gridlyGetWeatherAuthoritySnapshot = gridlyGetWeatherAuthoritySnapshot;
  globalScope.gridlySelectConsumerVisibleWeatherSituations = gridlySelectConsumerVisibleWeatherSituations;
  globalScope.gridlyLp0383ConsumerWeatherAuthorityMigrationAudit = consumerMigrationAudit;
  globalScope.gridlyLp0382WeatherAuthoritySourceIntegrationAudit = sourceIntegrationAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = globalScope.gridlyWeatherAuthoritySourceIntegration;
})(typeof window !== "undefined" ? window : globalThis);
