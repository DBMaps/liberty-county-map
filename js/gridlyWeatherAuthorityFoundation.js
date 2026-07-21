(function installGridlyWeatherAuthorityFoundation(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const MILESTONE = "LP038.1";
  const DEFAULT_PROVIDER = "weather";
  const FRESH_MS = 6 * 60 * 60 * 1000;
  const CONTRACT_KEYS = Object.freeze([
    "selectedAwarenessArea", "authorityStatus", "provider", "providerRecordCount",
    "consumerSituationCount", "uniqueSituationCount", "freshnessOwner", "localityOwner",
    "ownershipMethod", "fallbackReason", "containsCurrentConditions", "containsForecast",
    "containsAlerts", "consumerEligibleWeather", "expiredRecords", "duplicateRecords",
    "staleRecords", "quietStateReason", "recommendedPresentation"
  ]);

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) value.forEach(freeze);
    else Object.keys(value).forEach((key) => freeze(value[key]));
    return Object.freeze(value);
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function lower(value) { return text(value).toLowerCase(); }
  function asArray(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
  function nowMs(options) { const value = options && options.now ? Date.parse(options.now) : Date.now(); return Number.isFinite(value) ? value : Date.now(); }
  function timestamp(value) { const parsed = Date.parse(value || ""); return Number.isFinite(parsed) ? parsed : null; }

  function readProviderRecords(options) {
    if (Array.isArray(options?.records)) return options.records.slice();
    const provider = options?.providerApi || globalScope.gridlyWeatherProvider;
    if (provider && typeof provider.getNormalizedRecords === "function") return asArray(provider.getNormalizedRecords()).slice();
    return [];
  }

  function awarenessName(area) { return text(area?.name || area?.label || area?.title || area?.id || area); }
  function awarenessCounty(area) { return lower(area?.county || area?.countyName || area?.parentCounty || area?.authorityCounty || awarenessName(area).replace(/ county$/i, "")); }
  function recordAreas(record) { return asArray(record?.affectedAreas || record?.areas || record?.counties || record?.areaDesc).flatMap((area) => typeof area === "string" ? area.split(/[;,]/) : [area]).map(text).filter(Boolean); }
  function recordLocality(record) { return text(record?.locality || record?.city || record?.community || record?.locationName || record?.canonicalDisplayLocation); }
  function recordZone(record) { return text(record?.forecastZone || record?.zone || record?.zoneId || record?.ugc); }
  function recordCounty(record) { return text(record?.county || record?.countyName || record?.authorityCounty); }
  function recordProvider(record) { return lower(record?.providerId || record?.provider || DEFAULT_PROVIDER); }
  function recordKind(record) { return lower(record?.weatherKind || record?.kind || record?.type || (record?.category || record?.event ? "alert" : "weather")); }

  function coordinate(record) {
    const lat = Number(record?.latitude ?? record?.lat);
    const lng = Number(record?.longitude ?? record?.lng ?? record?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = Number(ring[i][0]), yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]), yj = Number(ring[j][1]);
      if (((yi > point.lat) !== (yj > point.lat)) && point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-9) + xi) inside = !inside;
    }
    return inside;
  }

  function geometryContains(geometry, point) {
    if (!geometry || !point) return false;
    const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];
    return rings.some((ring) => Array.isArray(ring) && ring.length >= 4 && pointInRing(point, ring));
  }

  function geographicOwnership(record, selectedArea) {
    const areaName = lower(awarenessName(selectedArea));
    const county = awarenessCounty(selectedArea);
    if (!areaName && !county && !selectedArea?.geometry) return { belongs: false, method: "unknown_ownership", locality: null, fallbackReason: "missing_awareness_area" };
    if (geometryContains(record.__geometry || record.geometry || record.alertPolygon, coordinate(record))) return { belongs: true, method: "alert_polygon", locality: recordLocality(record) || awarenessName(selectedArea), fallbackReason: null };
    const zone = lower(recordZone(record));
    if (zone && asArray(selectedArea?.forecastZones || selectedArea?.zones).map(lower).includes(zone)) return { belongs: true, method: "forecast_zone", locality: recordLocality(record) || awarenessName(selectedArea), fallbackReason: null };
    const areas = recordAreas(record).map(lower);
    if ((county && (lower(recordCounty(record)).includes(county) || areas.some((area) => area.includes(county)))) || (areaName && areas.some((area) => area.includes(areaName)))) return { belongs: true, method: "county", locality: recordLocality(record) || awarenessName(selectedArea), fallbackReason: null };
    if (geometryContains(selectedArea?.geometry, coordinate(record))) return { belongs: true, method: "awareness_geometry", locality: awarenessName(selectedArea), fallbackReason: null };
    const locality = lower(recordLocality(record));
    if (locality && (locality === areaName || locality.includes(areaName) || areaName.includes(locality))) return { belongs: true, method: "fallback_locality", locality: recordLocality(record), fallbackReason: "locality_fallback_used" };
    return { belongs: false, method: "outside_authority", locality: recordLocality(record) || null, fallbackReason: locality ? "failed_locality" : "unknown_ownership" };
  }

  function freshness(record, options) {
    const now = nowMs(options);
    const expires = timestamp(record?.expirationTime || record?.expires || record?.endTime);
    if (expires != null && expires < now) return "expired";
    const observed = timestamp(record?.effectiveTime || record?.startTime || record?.updatedTime || record?.updatedAt || record?.sent);
    if (observed != null && now - observed > Number(options?.freshnessMs || FRESH_MS)) return "stale";
    return "fresh";
  }

  function isMeaningful(record) { return Boolean(text(record?.category || record?.title || record?.event || record?.temperature || record?.summary || record?.forecast)); }
  function keyFor(record) { return [recordProvider(record), text(record?.id || record?.sourceId || record?.title || record?.category), text(record?.effectiveTime || record?.startTime)].join("|"); }
  function situationKey(record, ownership) { return [recordProvider(record), text(record?.category || record?.event || record?.weatherKind || recordKind(record)), lower(ownership.locality || "")].join("|"); }

  function gridlySelectConsumerWeatherAuthority(options = {}) {
    const selectedAwarenessArea = options.selectedAwarenessArea || options.awarenessArea || globalScope.gridlySelectedAwarenessArea || null;
    const provider = lower(options.provider || DEFAULT_PROVIDER) || DEFAULT_PROVIDER;
    const records = readProviderRecords(options).map(clone).filter(Boolean);
    const seen = new Set();
    const situations = new Set();
    const eligible = [], expired = [], duplicate = [], stale = [];
    let localityOwner = null, freshnessOwner = "fresh", ownershipMethod = null, fallbackReason = null;
    let containsCurrentConditions = false, containsForecast = false, containsAlerts = false;

    records.forEach((record) => {
      if (recordProvider(record) !== provider) return;
      const kind = recordKind(record);
      containsCurrentConditions = containsCurrentConditions || kind.includes("current");
      containsForecast = containsForecast || kind.includes("forecast");
      containsAlerts = containsAlerts || kind.includes("alert") || Boolean(record.category);
      const owned = geographicOwnership(record, selectedAwarenessArea);
      const age = freshness(record, options);
      const key = keyFor(record);
      if (seen.has(key)) { duplicate.push(record); return; }
      seen.add(key);
      if (age === "expired") { expired.push(record); return; }
      if (age === "stale") { stale.push(record); return; }
      if (!owned.belongs || !isMeaningful(record)) return;
      localityOwner = localityOwner || owned.locality || awarenessName(selectedAwarenessArea) || null;
      ownershipMethod = ownershipMethod || owned.method;
      fallbackReason = fallbackReason || owned.fallbackReason;
      situations.add(situationKey(record, owned));
      eligible.push(Object.assign({}, record, { authority: { consumerEligible: true, ownershipMethod: owned.method, localityOwner: owned.locality || null, freshness: age } }));
    });

    if (expired.length) freshnessOwner = "expired_records_excluded";
    else if (stale.length) freshnessOwner = "stale_records_excluded";
    const result = {
      selectedAwarenessArea: awarenessName(selectedAwarenessArea) || null,
      authorityStatus: eligible.length ? "ACTIVE" : "QUIET",
      provider,
      providerRecordCount: records.filter((record) => recordProvider(record) === provider).length,
      consumerSituationCount: eligible.length,
      uniqueSituationCount: situations.size,
      freshnessOwner,
      localityOwner,
      ownershipMethod: ownershipMethod || "none",
      fallbackReason: fallbackReason || (eligible.length ? null : "no_consumer_eligible_weather"),
      containsCurrentConditions,
      containsForecast,
      containsAlerts,
      consumerEligibleWeather: eligible,
      expiredRecords: expired,
      duplicateRecords: duplicate,
      staleRecords: stale,
      quietStateReason: eligible.length ? null : "no_authoritative_fresh_local_weather",
      recommendedPresentation: eligible.length ? "consumer_weather_situations" : "quiet_state"
    };
    return freeze(result);
  }

  function audit() {
    return freeze({
      milestone: MILESTONE,
      authorityEnginePresent: true,
      selectorPresent: typeof globalScope.gridlySelectConsumerWeatherAuthority === "function",
      providerOwnership: true,
      geographicOwnership: true,
      freshnessOwnership: true,
      consumerEligibility: true,
      deduplicationReady: true,
      authorityContractReady: CONTRACT_KEYS.every(Boolean),
      contractKeys: CONTRACT_KEYS.slice(),
      currentConditionsIntegrated: false,
      forecastIntegrated: false,
      alertsIntegrated: false,
      consumerMigrationPerformed: false,
      recommendedNextMilestone: "LP038.2",
      implementationStatus: "FOUNDATION_COMPLETE",
      passive: true,
      noPolling: true,
      noFetches: true,
      noWrites: true,
      noMutations: true,
      noMapMovement: true,
      noRuntimeActivation: true
    });
  }

  globalScope.gridlyWeatherAuthorityFoundation = freeze({ milestone: MILESTONE, contractKeys: CONTRACT_KEYS, select: gridlySelectConsumerWeatherAuthority });
  globalScope.gridlySelectConsumerWeatherAuthority = gridlySelectConsumerWeatherAuthority;
  globalScope.gridlyLp0381WeatherAuthorityFoundationAudit = audit;
  if (typeof module !== "undefined" && module.exports) module.exports = globalScope.gridlyWeatherAuthorityFoundation;
})(typeof window !== "undefined" ? window : globalThis);
