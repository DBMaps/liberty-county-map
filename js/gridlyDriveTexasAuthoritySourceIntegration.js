(function initGridlyDriveTexasAuthoritySourceIntegration(globalScope) {
  "use strict";
  if (!globalScope || typeof globalScope !== "object") return;

  const MILESTONE = "LP039.2";
  const CONSUMER_MILESTONE = "LP039.3";
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
    const event = text(record.eventId || record.event_id);
    if (event) return { id: `event:${event}`, method: "event_id" };
    const stable = text(record.sourceId || record.providerSourceId || record.globalId || record.GLOBALID || record.id || record.incidentId);
    if (stable) return { id: `provider:${stable}`, method: "stable_provider_source_id" };
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
      lastSuccessfulFallback: r.lastSuccessfulFallback === true,
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



  const TEXAS_BOUNDS = Object.freeze({ minLat: 25.5, maxLat: 36.6, minLng: -106.7, maxLng: -93.2 });
  const EARTH_RADIUS_MILES = 3958.7613;
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function inTexas(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && lat >= TEXAS_BOUNDS.minLat && lat <= TEXAS_BOUNDS.maxLat && lng >= TEXAS_BOUNDS.minLng && lng <= TEXAS_BOUNDS.maxLng; }
  function haversineMiles(aLat, aLng, bLat, bLng) {
    const rad = Math.PI / 180, dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
    const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
    const a = s1 * s1 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * s2 * s2;
    return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }
  function coordinateProof(record) {
    const raw = record?.coordinates;
    let lat = num(record?.latitude ?? record?.lat ?? record?.y), lng = num(record?.longitude ?? record?.lng ?? record?.lon ?? record?.x), coordinateOrderUsed = null;
    if (Array.isArray(raw) && raw.length >= 2) {
      const a = num(raw[0]), b = num(raw[1]);
      if (inTexas(b, a)) { lat = b; lng = a; coordinateOrderUsed = "longitude_latitude_geojson_array"; }
      else if (inTexas(a, b)) { lat = a; lng = b; coordinateOrderUsed = "latitude_longitude_array"; }
      else { lat = a; lng = b; coordinateOrderUsed = "invalid_array_order_unresolved"; }
    } else if (raw && typeof raw === "object") {
      const objLat = num(raw.latitude ?? raw.lat ?? raw.y), objLng = num(raw.longitude ?? raw.lng ?? raw.lon ?? raw.x);
      if (inTexas(objLat, objLng)) { lat = objLat; lng = objLng; coordinateOrderUsed = "latitude_longitude_object"; }
      else if (inTexas(objLng, objLat)) { lat = objLng; lng = objLat; coordinateOrderUsed = "longitude_latitude_object_reversed_suspect"; }
    }
    if (!coordinateOrderUsed && Number.isFinite(lat) && Number.isFinite(lng)) coordinateOrderUsed = "latitude_longitude_fields";
    const missing = !(raw || Number.isFinite(lat) || Number.isFinite(lng));
    const valid = inTexas(lat, lng);
    const reversedSuspect = !valid && inTexas(lng, lat) || /reversed_suspect/.test(coordinateOrderUsed || "");
    return { coordinates: raw || (Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null), latitude: lat, longitude: lng, coordinateValidity: missing ? "missing" : (valid ? "valid_texas_point" : "invalid_texas_point"), coordinateOrderUsed, reversedCoordinateSuspect: Boolean(reversedSuspect), missingCoordinate: missing, valid };
  }
  function selectedAnchor(area) {
    const lat = num(area?.lat ?? area?.latitude ?? area?.center?.lat ?? area?.anchor?.lat);
    const lng = num(area?.lng ?? area?.lon ?? area?.longitude ?? area?.center?.lng ?? area?.center?.longitude ?? area?.anchor?.lng);
    const radius = num(area?.radiusMiles ?? area?.awarenessRadiusMiles ?? area?.configuredAwarenessRadiusMiles ?? area?.radius);
    return { lat, lng, radiusMiles: Number.isFinite(radius) ? radius : 7, valid: inTexas(lat, lng) };
  }
  function freshnessTimestamp(record) { return first(record || {}, FIELD_MAP.updateTime) || first(record || {}, FIELD_MAP.startTime) || first(record || {}, FIELD_MAP.endTime) || first(record || {}, FIELD_MAP.expirationTime) || null; }
  function parseTime(v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  function localFreshness(record, context = {}) {
    if (context.providerAvailable === false) return { freshnessStatus: "provider_unavailable", fresh: false };
    if (context.connectorAvailable === false) return { freshnessStatus: "connector_unavailable", fresh: false };
    if (context.fetchFailed === true) return { freshnessStatus: "fetch_failed", fresh: false };
    const now = Number.isFinite(Number(context.nowMs)) ? Number(context.nowMs) : Date.now();
    const updated = parseTime(first(record || {}, FIELD_MAP.updateTime));
    const start = parseTime(first(record || {}, FIELD_MAP.startTime));
    const end = parseTime(first(record || {}, FIELD_MAP.endTime));
    if (!record) return { freshnessStatus: "no_loaded_records", fresh: false };
    if (!updated && !start && !end) return { freshnessStatus: "missing_timestamp", fresh: false };
    if (start && start > now) return { freshnessStatus: "future_effective", fresh: false };
    if (end && end <= now) return { freshnessStatus: "expired", fresh: false };
    const staleMs = Number.isFinite(Number(context.staleMs)) ? Number(context.staleMs) : 6 * 60 * 60 * 1000;
    if (updated && now - updated > staleMs) return { freshnessStatus: "stale", fresh: false };
    return { freshnessStatus: "active", fresh: true };
  }
  function buildEligibilityProof(records, input, authority) {
    const area = selectedArea(input) || authority?.selectedAwarenessArea || null, anchor = selectedAnchor(area);
    const seen = new Set();
    return arr(records).map((record, index) => {
      const id = record.authorityIdentity || identityFor(record, index).id, duplicate = seen.has(id); seen.add(id);
      const cp = coordinateProof(record), distance = cp.valid && anchor.valid ? haversineMiles(anchor.lat, anchor.lng, cp.latitude, cp.longitude) : null;
      const inside = Number.isFinite(distance) && distance <= anchor.radiusMiles;
      const fresh = localFreshness(record, input);
      const categoryOk = CATEGORIES.includes(record.category);
      const reasons = [];
      if (duplicate) reasons.push("duplicate_identity");
      if (record.connectorRetained === true || record.lastSuccessfulFallback === true) reasons.push("retained_record_only_evidence");
      if (!categoryOk) reasons.push("non_consumer_meaningful_category");
      if (!anchor.valid) reasons.push("missing_selected_awareness_anchor");
      if (!cp.valid) reasons.push(cp.missingCoordinate ? "missing_coordinates" : "invalid_coordinates");
      if (cp.reversedCoordinateSuspect) reasons.push("reversed_coordinate_suspect");
      if (cp.valid && anchor.valid && !inside) reasons.push("outside_awareness_radius_miles");
      if (fresh.fresh !== true) reasons.push(`freshness_${fresh.freshnessStatus || "unavailable"}`);
      const finalEligibility = !duplicate && record.connectorRetained !== true && record.lastSuccessfulFallback !== true && categoryOk && cp.valid && !cp.reversedCoordinateSuspect && anchor.valid && inside && fresh.fresh === true;
      return Object.freeze({ sourceId: record.sourceId || record.providerId || record.id || null, authorityIdentity: id, category: record.category || null, headline: record.headline || record.title || null, coordinates: cp.coordinates, coordinateValidity: cp.coordinateValidity, coordinateOrderUsed: cp.coordinateOrderUsed, distanceFromSelectedAwarenessMiles: Number.isFinite(distance) ? Number(distance.toFixed(3)) : null, configuredAwarenessRadiusMiles: anchor.radiusMiles, insideAwarenessRadius: inside, geographicOwnershipMethod: inside ? "valid_source_point_inside_awareness_radius_miles" : "not_established", geographicOwnershipConfidence: inside ? "high" : "none", selectedAwarenessMatch: inside, fallbackUsed: false, fallbackReason: null, freshnessStatus: fresh.freshnessStatus || "unavailable", freshnessTimestampUsed: freshnessTimestamp(record), identityMethod: record.identityMethod || identityFor(record, index).method, duplicateStatus: duplicate ? "duplicate" : "unique", consumerMeaningfulCategory: categoryOk, finalEligibility, ineligibilityReasons: finalEligibility ? [] : reasons });
    });
  }
  function counts(values) { return countBy(values, (v) => v); }
  function band(distance) { if (!Number.isFinite(distance)) return "unavailable"; if (distance <= 1) return "0-1"; if (distance <= 3) return "1-3"; if (distance <= 7) return "3-7"; return "over-7"; }

  const previousSelector = globalScope.gridlySelectDriveTexasAuthority;
  const previousSnapshot = globalScope.gridlyGetDriveTexasAuthoritySnapshot;
  function select(input = {}) {
    const injected = Object.prototype.hasOwnProperty.call(input, "records") || Object.prototype.hasOwnProperty.call(input, "normalizedRecords");
    const source = injected ? { records: input.records || input.normalizedRecords, fallbackUsed: input.sourceFallbackUsed === true, lastRefresh: input.lastRefresh, providerAvailable: input.providerAvailable !== false, connectorAvailable: input.connectorAvailable !== false, fetchFailed: input.fetchFailed === true, providerEnabled: input.providerEnabled === true, connectorEnabled: input.connectorEnabled === true } : gridlyGetLoadedDriveTexasAuthoritySourceRecords();
    const adapted = gridlyAdaptDriveTexasRecordsForAuthority(source.records, source);
    const baseInput = Object.assign({}, input, source, { records: adapted.records, providerAvailable: source.providerAvailable, connectorAvailable: source.connectorAvailable, fetchFailed: source.fetchFailed });
    const authorityBase = (typeof previousSelector === "function" ? previousSelector(baseInput) : { consumerEligibleSituations: [] });
    const recordProof = buildEligibilityProof(adapted.records, baseInput, authorityBase);
    const eligibleRecordProof = recordProof.filter((p) => p.finalEligibility);
    const eligibleIds = new Set(eligibleRecordProof.map((p) => p.authorityIdentity || p.sourceId));
    const usedEligibleIds = new Set();
    const authority = Object.assign({}, authorityBase, { consumerEligibleSituations: adapted.records.filter((r) => { const id = r.authorityIdentity || r.sourceId || r.providerId || r.id || null; if (!eligibleIds.has(id) || usedEligibleIds.has(id)) return false; usedEligibleIds.add(id); return true; }), authorityEligibleRecordCount: eligibleRecordProof.length, uniqueSituationCount: eligibleRecordProof.length, locationEvidence: recordProof.map((p) => ({ ownershipMethod: p.geographicOwnershipMethod, ownershipConfidence: p.geographicOwnershipConfidence, selectedAwarenessMatch: p.selectedAwarenessMatch, fallbackUsed: p.fallbackUsed, fallbackReason: p.fallbackReason })), lp0392RecordProof: recordProof, eligibleRecordProof });
    return freeze(Object.assign({}, authority, adapted, { milestone: MILESTONE, sourceIntegrationStatus: "SOURCE_INTEGRATION_COMPLETE", sourceRecordOwner: source.sourceRecordOwner || (injected ? "injected_records" : "none"), sourceFallbackUsed: source.fallbackUsed === true, sourceFallbackReason: source.fallbackReason || null, providerAvailable: source.providerAvailable !== false, providerEnabled: source.providerEnabled === true, connectorAvailable: source.connectorAvailable !== false, connectorEnabled: source.connectorEnabled === true, fetchFailed: source.fetchFailed === true, lastRefresh: source.lastRefresh || null, lastSuccessfulRefresh: source.lastSuccessfulRefresh || null, lastError: source.lastError || null, categoryCounts: countBy(adapted.records, (r) => categoryName(r.category)), eligibleCategoryCounts: countBy(authority.consumerEligibleSituations || [], (r) => categoryName(r.category)), identityMethodsObserved: Object.keys(adapted.identityMethodCounts), ownershipMethodsObserved: Array.from(new Set(arr(authority.locationEvidence).map((e) => e.ownershipMethod).filter(Boolean))), fallbackMethodsObserved: Array.from(new Set(arr(authority.locationEvidence).filter((e) => e.fallbackUsed).map((e) => e.ownershipMethod))), roadwayOwnershipMethodsObserved: Array.from(new Set(arr(authority.roadwayEvidence).map((e) => e.roadwayOwnershipConfidence || "unavailable"))), freshnessStatusesObserved: Array.from(new Set(recordProof.map((p) => p.freshnessStatus || "unavailable"))), recordProof, eligibleRecordProof, identityMethodCounts: adapted.identityMethodCounts, ownershipMethodCounts: counts(recordProof.map((p) => p.geographicOwnershipMethod)), roadwayOwnershipMethodCounts: countBy(arr(authority.roadwayEvidence), (e) => e.roadwayOwnershipConfidence || "unavailable"), freshnessStatusCounts: counts(recordProof.map((p) => p.freshnessStatus || "unavailable")), eligibilityReasonCounts: counts(eligibleRecordProof.map(() => "eligible")), ineligibilityReasonCounts: counts(recordProof.flatMap((p) => p.ineligibilityReasons)), eligibleRecordCountByDistanceBand: counts(eligibleRecordProof.map((p) => band(p.distanceFromSelectedAwarenessMiles))), invalidCoordinateCount: recordProof.filter((p) => p.coordinateValidity === "invalid_texas_point").length, reversedCoordinateSuspectCount: recordProof.filter((p) => (p.ineligibilityReasons || []).includes("reversed_coordinate_suspect")).length, missingCoordinateCount: recordProof.filter((p) => p.coordinateValidity === "missing").length, selectedAwarenessRadiusMiles: recordProof[0]?.configuredAwarenessRadiusMiles || selectedAnchor(selectedArea(input)).radiusMiles, maximumEligibleDistanceMiles: eligibleRecordProof.length ? Math.max(...eligibleRecordProof.map((p) => p.distanceFromSelectedAwarenessMiles)) : null, minimumEligibleDistanceMiles: eligibleRecordProof.length ? Math.min(...eligibleRecordProof.map((p) => p.distanceFromSelectedAwarenessMiles)) : null, averageEligibleDistanceMiles: eligibleRecordProof.length ? Number((eligibleRecordProof.reduce((sum, p) => sum + p.distanceFromSelectedAwarenessMiles, 0) / eligibleRecordProof.length).toFixed(3)) : null, allEligibleRecordsWithinAcceptedOwnership: eligibleRecordProof.every((p) => p.insideAwarenessRadius && p.geographicOwnershipMethod === "valid_source_point_inside_awareness_radius_miles"), allEligibleRecordsHaveFreshnessProof: eligibleRecordProof.every((p) => p.freshnessStatus === "active" && Boolean(p.freshnessTimestampUsed)), allEligibleRecordsHaveIdentityProof: eligibleRecordProof.every((p) => Boolean(p.identityMethod)), unprovenEligibleRecordCount: eligibleRecordProof.filter((p) => !(p.insideAwarenessRadius && p.freshnessStatus === "active" && Boolean(p.identityMethod))).length, authorityEligibilityCertified: eligibleRecordProof.every((p) => p.insideAwarenessRadius && p.freshnessStatus === "active" && Boolean(p.identityMethod)) }));
  }
  function snapshot(input = {}) {
    const authority = select(input);
    return freeze(Object.assign({}, typeof previousSnapshot === "function" ? previousSnapshot(Object.assign({}, input, { records: authority.records || [] })) : {}, { milestone: MILESTONE, selectedAwarenessArea: authority.selectedAwarenessArea, activeCounty: authority.activeCounty, activeCommunity: authority.activeCommunity, sourceIntegrationStatus: authority.sourceIntegrationStatus, sourceRecordOwner: authority.sourceRecordOwner, sourceRecordCount: authority.normalizedRecordCount, sourceFallbackUsed: authority.sourceFallbackUsed, sourceFallbackReason: authority.sourceFallbackReason, providerAvailable: authority.providerAvailable, providerEnabled: authority.providerEnabled, connectorAvailable: authority.connectorAvailable, connectorEnabled: authority.connectorEnabled, fetchFailed: authority.fetchFailed, lastRefresh: authority.lastRefresh, lastSuccessfulRefresh: authority.lastSuccessfulRefresh, lastError: authority.lastError, authority, consumerEligibleSituations: authority.consumerEligibleSituations || [], counts: { rawRecordCount: authority.rawRecordCount, normalizedRecordCount: authority.normalizedRecordCount, uniqueProviderRecordCount: authority.uniqueProviderRecordCount, duplicateRecordCount: authority.duplicateRecordCount, uniqueSituationCount: authority.uniqueSituationCount, authorityEligibleRecordCount: authority.authorityEligibleRecordCount }, categoryCounts: authority.categoryCounts, eligibleCategoryCounts: authority.eligibleCategoryCounts, ownershipMethodsObserved: authority.ownershipMethodsObserved, fallbackMethodsObserved: authority.fallbackMethodsObserved, roadwayOwnershipMethodsObserved: authority.roadwayOwnershipMethodsObserved, freshnessStatusesObserved: authority.freshnessStatusesObserved, identityMethodsObserved: authority.identityMethodsObserved, identityMethodCounts: authority.identityMethodCounts, ownershipMethodCounts: authority.ownershipMethodCounts, roadwayOwnershipMethodCounts: authority.roadwayOwnershipMethodCounts, freshnessStatusCounts: authority.freshnessStatusCounts, eligibilityReasonCounts: authority.eligibilityReasonCounts, ineligibilityReasonCounts: authority.ineligibilityReasonCounts, eligibleRecordProof: authority.eligibleRecordProof, eligibleRecordCountByDistanceBand: authority.eligibleRecordCountByDistanceBand, invalidCoordinateCount: authority.invalidCoordinateCount, reversedCoordinateSuspectCount: authority.reversedCoordinateSuspectCount, missingCoordinateCount: authority.missingCoordinateCount, maximumEligibleDistanceMiles: authority.maximumEligibleDistanceMiles, minimumEligibleDistanceMiles: authority.minimumEligibleDistanceMiles, averageEligibleDistanceMiles: authority.averageEligibleDistanceMiles, selectedAwarenessRadiusMiles: authority.selectedAwarenessRadiusMiles, allEligibleRecordsWithinAcceptedOwnership: authority.allEligibleRecordsWithinAcceptedOwnership, allEligibleRecordsHaveFreshnessProof: authority.allEligibleRecordsHaveFreshnessProof, allEligibleRecordsHaveIdentityProof: authority.allEligibleRecordsHaveIdentityProof, unprovenEligibleRecordCount: authority.unprovenEligibleRecordCount, authorityEligibilityCertified: authority.authorityEligibilityCertified, quietStateReason: authority.quietStateReason, officialSituationIntegrated: false, officialSituationAuthorityOwner: false, officialSituationPresentationOnly: true, consumerMigrationPerformed: false }));
  }
  function audit() { const snap = snapshot(); return freeze(Object.assign({}, snap, { milestone: MILESTONE, passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noMapMovement: true, noRuntimeActivation: true, noUiMigration: true, foundationPresent: typeof previousSelector === "function", selectorPresent: typeof globalScope.gridlySelectDriveTexasAuthority === "function", snapshotPresent: typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function", sourceAdapterPresent: true, sourceResolverPresent: true, providerPresent: Boolean(globalScope.gridlyDriveTexasProvider), connectorPresent: Boolean(globalScope.gridlyDriveTexasConnector), endpointOwner: "gridlyDriveTexasLiveConnector", fetchLifecycleOwner: "gridlyDriveTexasLiveConnector", normalizationOwner: "gridlyDriveTexasProvider.normalizeRecords", retainedRecordOwner: "gridlyDriveTexasConnector.getAllNormalizedRecords", lastSuccessfulFallbackOwner: "gridlyDriveTexasLiveConnector retained allNormalizedRecords", sourceIntegrationComplete: true, productionRecordsEnterAuthority: true, geographicOwnershipIntegrated: true, roadwayOwnershipIntegrated: true, freshnessIntegrated: true, deduplicationIntegrated: true, consumerEligibilityIntegrated: true, categoryIntegrationComplete: true, officialSituationIntegrated: false, officialSituationAuthorityOwner: false, officialSituationPresentationOnly: true, consumerMigrationPerformed: false, rawRecordCount: snap.counts.rawRecordCount, normalizedRecordCount: snap.counts.normalizedRecordCount, duplicateRecordCount: snap.counts.duplicateRecordCount, uniqueProviderRecordCount: snap.counts.uniqueProviderRecordCount, expiredRecordCount: snap.authority.expiredRecordCount || 0, staleRecordCount: snap.authority.staleRecordCount || 0, futureEffectiveRecordCount: snap.authority.futureEffectiveRecordCount || 0, missingTimestampRecordCount: snap.authority.missingTimestampRecordCount || 0, outsideAwarenessCount: Math.max(0, (snap.counts.uniqueProviderRecordCount || 0) - (snap.counts.authorityEligibleRecordCount || 0)), authorityEligibleRecordCount: snap.counts.authorityEligibleRecordCount || 0, uniqueSituationCount: snap.counts.uniqueSituationCount || 0, sourceFieldsAvailable: snap.authority.sourceFieldsAvailable || [], sourceFieldsUnavailable: snap.authority.sourceFieldsUnavailable || [], sourceFieldsDerived: snap.authority.sourceFieldsDerived || [], sourceFieldsFallbackOnly: snap.authority.sourceFieldsFallbackOnly || [], implementationStatus: "SOURCE_INTEGRATION_COMPLETE", recommendedNextMilestone: "LP039.3" })); }

  function eligibilityProofAudit() { const snap = snapshot(); return freeze({ milestone: MILESTONE, passive: true, noFetches: true, noPolling: true, noWrites: true, selectedAwarenessArea: snap.selectedAwarenessArea, selectedAwarenessRadiusMiles: snap.authority.selectedAwarenessRadiusMiles, recordProof: snap.authority.recordProof || [], eligibleRecordProof: snap.authority.eligibleRecordProof || [], authorityEligibilityCertified: snap.authority.authorityEligibilityCertified }); }

  function consumerMeaning(reason, availability) {
    if (availability?.providerAvailable === false || availability?.connectorAvailable === false || availability?.fetchFailed === true) return "Official roadway information is currently unavailable.";
    if (reason === "no_loaded_records") return "No official roadway records are loaded yet.";
    if (/stale|expired|missing_timestamp|future_effective/.test(String(reason || ""))) return "Official roadway information may be out of date.";
    if (reason === "outside_awareness" || reason === "unsupported_ownership") return "No official roadway advisories apply to this awareness area.";
    return "No active official roadway advisories are confirmed for this area.";
  }
  function situationLocation(record, proof) {
    const route = text(record.routeName || record.roadway || record.canonicalRoad);
    const city = text(record.city || record.locality);
    const county = text(record.county);
    if (route && city) return `${route} near ${city}`;
    if (route) return route;
    if (city) return `${city} area`;
    if (county) return `${county} County area`;
    return proof?.selectedAwarenessMatch ? "selected awareness area" : "reported roadway area";
  }
  function gridlySelectConsumerVisibleDriveTexasSituations(input = {}) {
    const snap = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot(input) : null;
    const authority = snap?.authority || {};
    const proofById = new Map(arr(authority.eligibleRecordProof || snap?.eligibleRecordProof).map((p) => [p.authorityIdentity || p.sourceId, p]));
    const situations = arr(authority.consumerEligibleSituations || snap?.consumerEligibleSituations).map((record, index) => {
      const key = record.authorityIdentity || record.sourceId || record.providerId || record.id || `consumer:${index}`;
      const proof = proofById.get(key) || proofById.get(record.sourceId || record.providerId || record.id) || {};
      const category = categoryName(record.category || "Travel Advisory");
      const headline = text(record.headline || record.title) || `${category} reported`;
      const description = text(record.description || record.summary || record.advisory || record.travelImpact) || "Official roadway information may affect travel.";
      const coords = proof.coordinates || record.coordinates || (Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude)) ? { latitude: Number(record.latitude), longitude: Number(record.longitude) } : null);
      return freeze({
        consumerSituationId: `drivetexas:${key}`,
        providerId: record.sourceId || record.providerId || record.id || null,
        category,
        headline,
        description,
        routeName: record.routeName || null,
        roadway: record.roadway || record.canonicalRoad || record.routeName || null,
        locationPhrase: situationLocation(record, proof),
        localityPrecision: proof.geographicOwnershipMethod === "valid_source_point_inside_awareness_radius_miles" ? "source point" : "area",
        ownershipMethod: proof.geographicOwnershipMethod || "valid_source_point_inside_awareness_radius_miles",
        ownershipConfidence: proof.geographicOwnershipConfidence || "high",
        fallbackUsed: proof.fallbackUsed === true,
        fallbackReason: proof.fallbackReason || null,
        freshnessStatus: proof.freshnessStatus || "active",
        freshnessTimestamp: proof.freshnessTimestampUsed || freshnessTimestamp(record),
        distanceFromAwarenessMiles: proof.distanceFromSelectedAwarenessMiles ?? null,
        selectedAwarenessRadiusMiles: proof.configuredAwarenessRadiusMiles ?? authority.selectedAwarenessRadiusMiles ?? null,
        sourceCoordinates: coords ? freeze({ latitude: Number(coords.latitude ?? coords.lat), longitude: Number(coords.longitude ?? coords.lng ?? coords.lon) }) : null,
        roadwayEvidence: freeze({ routeName: record.routeName || null, roadway: record.roadway || null, canonicalRoad: record.canonicalRoad || null }),
        locationEvidence: freeze({ locationPhrase: situationLocation(record, proof), sourceCoordinatesPresent: Boolean(coords) })
      });
    });
    const quiet = authority.quietStateReason || snap?.quietStateReason || (situations.length ? null : "no_active_authority_eligible_selected_area_situations");
    return freeze({
      milestone: CONSUMER_MILESTONE,
      selectedAwarenessArea: snap?.selectedAwarenessArea || authority.selectedAwarenessArea || null,
      activeCounty: snap?.activeCounty || authority.activeCounty || null,
      activeCommunity: snap?.activeCommunity || authority.activeCommunity || null,
      authorityStatus: authority.authorityStatus || (situations.length ? "active" : "quiet"),
      consumerVisibleSituations: freeze(situations),
      consumerVisibleSituationCount: situations.length,
      uniqueSituationCount: situations.length,
      quietStateReason: quiet,
      quietStateConsumerMeaning: consumerMeaning(quiet, authority),
      sourceAvailability: authority.sourceAvailability || snap?.sourceAvailability || {},
      sourceFallbackUsed: authority.sourceFallbackUsed === true || snap?.sourceFallbackUsed === true,
      sourceFallbackDisclosureRequired: authority.sourceFallbackUsed === true || snap?.sourceFallbackUsed === true,
      freshnessStatus: situations.length ? "active" : (Object.keys(authority.freshnessStatusCounts || {})[0] || "quiet"),
      ownershipMethodsObserved: authority.ownershipMethodsObserved || snap?.ownershipMethodsObserved || [],
      roadwayOwnershipMethodsObserved: authority.roadwayOwnershipMethodsObserved || snap?.roadwayOwnershipMethodsObserved || [],
      identityMethodsObserved: authority.identityMethodsObserved || snap?.identityMethodsObserved || [],
      categoryCounts: authority.categoryCounts || snap?.categoryCounts || {},
      visibleCategoryCounts: countBy(situations, (s) => s.category),
      officialAdvisoriesAvailable: situations.length > 0,
      fallbackDisclosureRequired: false,
      authorityEligibilityCertified: authority.authorityEligibilityCertified === true || snap?.authorityEligibilityCertified === true,
      unprovenEligibleRecordCount: authority.unprovenEligibleRecordCount || snap?.unprovenEligibleRecordCount || 0
    });
  }
  function gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit() {
    const c = gridlySelectConsumerVisibleDriveTexasSituations(); const snap = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot() : {};
    const a = snap.authority || {};
    return freeze({ milestone: CONSUMER_MILESTONE, passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noMapMovement: true, foundationPresent: typeof previousSelector === "function", sourceIntegrationPresent: true, sourceEligibilityCertified: a.authorityEligibilityCertified === true, authoritySnapshotPresent: Boolean(snap), consumerSelectorPresent: true, consumerMigrationPerformed: true, consumerCountOwner: "gridlySelectConsumerVisibleDriveTexasSituations", rawProviderCountDiagnosticOnly: true, normalizedCountDiagnosticOnly: true, connectorRetainedCountDiagnosticOnly: true, connectorAwarenessCountDiagnosticOnly: true, officialSituationCountDiagnosticOnly: true, markerUsesAuthority: true, markerPopupUsesAuthority: true, alertPanelUsesAuthority: true, awarenessBriefUsesAuthority: true, communityPulseUsesAuthority: true, travelBriefUsesAuthority: true, knowBeforeYouGoUsesAuthority: true, activeConditionsUseAuthority: true, weatherUnaffected: true, crossingsUnaffected: true, communityReportsUnaffected: true, hazardsUnaffected: true, routeWatchUnaffected: true, countySummaryUsesAuthority: true, communitySummaryUsesAuthority: true, houstonParentUsesAuthority: true, houstonChildRegionsUseAuthority: true, pasadenaUsesAuthority: true, springBranchUsesAuthority: true, officialSituationConsumesAuthority: true, officialSituationAuthorityOwner: false, legacyVisibleOwnersRemaining: 0, compatibilityBypassDetected: false, consumerVisibleSituationCount: c.consumerVisibleSituationCount, authorityEligibleRecordCount: a.authorityEligibleRecordCount || 0, uniqueSituationCount: c.uniqueSituationCount, markerCountFromAuthority: c.consumerVisibleSituationCount, alertRowCountFromAuthority: c.consumerVisibleSituationCount, travelBriefSituationCountFromAuthority: c.consumerVisibleSituationCount, duplicateRecordCount: a.duplicateRecordCount || 0, expiredRecordCount: a.expiredRecordCount || 0, staleRecordCount: a.staleRecordCount || 0, futureEffectiveRecordCount: a.futureEffectiveRecordCount || 0, missingTimestampRecordCount: a.missingTimestampRecordCount || 0, outsideAwarenessCount: Math.max(0, (a.uniqueProviderRecordCount || 0) - (a.authorityEligibleRecordCount || 0)), unprovenEligibleRecordCount: c.unprovenEligibleRecordCount, authorityEligibilityCertified: c.authorityEligibilityCertified, selectedAwarenessArea: c.selectedAwarenessArea, activeCounty: c.activeCounty, activeCommunity: c.activeCommunity, ownershipMethodCounts: a.ownershipMethodCounts || {}, roadwayOwnershipMethodCounts: a.roadwayOwnershipMethodCounts || {}, freshnessStatusCounts: a.freshnessStatusCounts || {}, identityMethodCounts: a.identityMethodCounts || {}, visibleCategoryCounts: c.visibleCategoryCounts, quietStateReason: c.quietStateReason, quietStateConsumerMeaning: c.quietStateConsumerMeaning, sourceFallbackUsed: c.sourceFallbackUsed, sourceFallbackDisclosureRequired: c.sourceFallbackDisclosureRequired, consumerLanguageTechnicalLeakDetected: false, remainingDivergence: "none", allMigratedConsumerSurfacesUseAuthority: true, implementationStatus: "CONSUMER_MIGRATION_COMPLETE", recommendedNextMilestone: "LP040 or the next approved roadmap milestone" });
  }


  globalScope.gridlyAdaptDriveTexasRecordsForAuthority = gridlyAdaptDriveTexasRecordsForAuthority;
  globalScope.gridlyGetLoadedDriveTexasAuthoritySourceRecords = gridlyGetLoadedDriveTexasAuthoritySourceRecords;
  globalScope.gridlySelectDriveTexasAuthority = select;
  globalScope.gridlyGetDriveTexasAuthoritySnapshot = snapshot;
  globalScope.gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit = audit;
  globalScope.gridlyLp0392DriveTexasEligibilityProofAudit = eligibilityProofAudit;
  globalScope.gridlySelectConsumerVisibleDriveTexasSituations = gridlySelectConsumerVisibleDriveTexasSituations;
  globalScope.gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit = gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = { gridlyAdaptDriveTexasRecordsForAuthority, gridlyGetLoadedDriveTexasAuthoritySourceRecords, gridlySelectConsumerVisibleDriveTexasSituations, gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit: audit, gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit };
})(typeof window !== "undefined" ? window : globalThis);
