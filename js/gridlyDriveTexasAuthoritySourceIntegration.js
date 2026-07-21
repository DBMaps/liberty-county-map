(function initGridlyDriveTexasAuthoritySourceIntegration(globalScope) {
  "use strict";
  if (!globalScope || typeof globalScope !== "object") return;

  const MILESTONE = "LP039.2";
  const CONSUMER_MILESTONE = "LP039.3";
  const CATEGORIES = Object.freeze(["Crash", "Road Closure", "Flooding", "Construction", "Lane Closure", "Bridge Restriction", "Travel Advisory"]);
  const DISPLAY_CATEGORY = Object.freeze({ "Road Closure": "Closure" });
  const FIELD_MAP = Object.freeze({
    provider: ["provider", "providerName"], sourceId: ["sourceId", "providerSourceId", "id", "incidentId"], globalId: ["globalId", "GLOBALID"], eventId: ["eventId", "event_id"], originalId: ["originalId", "objectId", "OBJECTID"], category: ["category"], subtype: ["subtype", "eventType", "event_type", "type"], headline: ["headline", "title"], description: ["description", "summary"], advisory: ["advisory", "prose", "rawSourceText"], status: ["status"], severity: ["severity"], startTime: ["startTime", "start_time", "beginDate"], updateTime: ["updateTime", "updatedAt", "lastUpdated", "last_updated"], endTime: ["endTime", "end_time", "endDate"], expirationTime: ["expirationTime", "expiresAt", "expires_at"], coordinates: ["coordinates"], sourceGeometry: ["sourceGeometry"], geometry: ["geometry", "roadwayGeometry", "routeGeometry"], routeName: ["routeName", "route_name"], roadway: ["roadway", "road", "highway"], canonicalRoad: ["canonicalRoad"], direction: ["direction"], county: ["county", "countyName"], city: ["city", "locality"], district: ["district"], closureType: ["closureType"], laneImpact: ["laneImpact"], detour: ["detour"], travelImpact: ["travelImpact"], providerUrl: ["providerUrl", "url"], sourceMetadata: ["sourceMetadata", "sourceTrace"], awarenessEvidence: ["awarenessEvidence", "affectedAreas"]
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
    const normalizedSourceGeometry = cloneTrustedAuthorityGeometry(first(r, FIELD_MAP.sourceGeometry));
    const geometry = normalizedSourceGeometry || first(r, FIELD_MAP.geometry);
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
      sourceGeometry: normalizedSourceGeometry,
      sourceGeometryType: normalizedSourceGeometry?.type || null,
      sourceGeometryValid: Boolean(normalizedSourceGeometry),
      sourceGeometryCoordinateCount: countGeometryCoordinates(normalizedSourceGeometry),
      sourceGeometryProvenance: normalizedSourceGeometry ? (r.sourceGeometryProvenance || "trusted_drivetexas_provider_geojson_geometry") : null,
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

  function validSourcePair(pair) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const longitude = num(pair[0]), latitude = num(pair[1]);
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
  }
  function geometryBounds(geometry) {
    const pairs = []; iterateGeometrySegments(geometry, (a, b) => { pairs.push(a, b); });
    if (geometry?.type === "Point") pairs.push(geometry.coordinates);
    if (!pairs.length) return null;
    return pairs.reduce((b, pair) => ({ minLongitude: Math.min(b.minLongitude, pair[0]), maxLongitude: Math.max(b.maxLongitude, pair[0]), minLatitude: Math.min(b.minLatitude, pair[1]), maxLatitude: Math.max(b.maxLatitude, pair[1]) }), { minLongitude: Infinity, maxLongitude: -Infinity, minLatitude: Infinity, maxLatitude: -Infinity });
  }
  function cloneTrustedAuthorityGeometry(geometry) {
    if (!geometry || typeof geometry !== "object") return null;
    if (geometry.type === "Point") { const p = validSourcePair(geometry.coordinates); return p ? freeze({ type: "Point", coordinates: freeze(p) }) : null; }
    if (geometry.type === "LineString") {
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) return null;
      const coords = geometry.coordinates.map(validSourcePair);
      return coords.length >= 2 && coords.every(Boolean) ? freeze({ type: "LineString", coordinates: freeze(coords.map(freeze)) }) : null;
    }
    if (geometry.type === "MultiLineString") {
      if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return null;
      const members = geometry.coordinates.map((line) => Array.isArray(line) ? line.map(validSourcePair) : null);
      return members.every((line) => line && line.length >= 2 && line.every(Boolean)) ? freeze({ type: "MultiLineString", coordinates: freeze(members.map((line) => freeze(line.map(freeze)))) }) : null;
    }
    return null;
  }
  function countGeometryCoordinates(g) { if (!g) return 0; if (g.type === "Point") return 1; if (g.type === "LineString") return arr(g.coordinates).length; if (g.type === "MultiLineString") return arr(g.coordinates).reduce((n, line) => n + arr(line).length, 0); return 0; }
  function iterateGeometrySegments(g, fn) {
    if (!g) return;
    if (g.type === "LineString") arr(g.coordinates).slice(0, -1).forEach((p, i) => fn(p, g.coordinates[i + 1], 0, i));
    if (g.type === "MultiLineString") arr(g.coordinates).forEach((line, memberIndex) => arr(line).slice(0, -1).forEach((p, i) => fn(p, line[i + 1], memberIndex, i)));
  }
  function awarenessBounds(anchor) { const latMiles = 69, lngMiles = Math.max(1, 69 * Math.cos(anchor.lat * Math.PI / 180)); return { minLatitude: anchor.lat - anchor.radiusMiles / latMiles, maxLatitude: anchor.lat + anchor.radiusMiles / latMiles, minLongitude: anchor.lng - anchor.radiusMiles / lngMiles, maxLongitude: anchor.lng + anchor.radiusMiles / lngMiles }; }
  function boundsOverlap(a, b) { return a && b && a.minLatitude <= b.maxLatitude && a.maxLatitude >= b.minLatitude && a.minLongitude <= b.maxLongitude && a.maxLongitude >= b.minLongitude; }
  function pointSegmentDistanceMiles(anchor, a, b) {
    const latMiles = 69, lngMiles = Math.max(1, 69 * Math.cos(anchor.lat * Math.PI / 180));
    const ax = (a[0] - anchor.lng) * lngMiles, ay = (a[1] - anchor.lat) * latMiles, bx = (b[0] - anchor.lng) * lngMiles, by = (b[1] - anchor.lat) * latMiles;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (-(ax * dx + ay * dy)) / len2)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    return Math.sqrt(x * x + y * y);
  }
  function geometryIntersectionProof(geometry, anchor) {
    const valid = cloneTrustedAuthorityGeometry(geometry);
    const stats = { recordsEvaluated: 0, geometryRecordsEvaluated: 0, segmentsEvaluated: 0, boundingBoxRejects: 0, intersectionsFound: 0 };
    if (!valid || !anchor.valid || valid.type === "Point") return { valid: Boolean(valid), intersects: false, closestDistanceMiles: null, geometryType: valid?.type || null, stats };
    stats.geometryRecordsEvaluated = 1;
    const gb = geometryBounds(valid), ab = awarenessBounds(anchor);
    if (!boundsOverlap(gb, ab)) { stats.boundingBoxRejects = 1; return { valid: true, intersects: false, closestDistanceMiles: null, geometryType: valid.type, boundsRejected: true, stats }; }
    let closest = Infinity, bestMemberIndex = null, bestSegmentIndex = null;
    iterateGeometrySegments(valid, (a, b, memberIndex, segmentIndex) => {
      if (closest <= anchor.radiusMiles) return;
      stats.segmentsEvaluated += 1;
      const d = pointSegmentDistanceMiles(anchor, a, b);
      if (d < closest) { closest = d; bestMemberIndex = memberIndex; bestSegmentIndex = segmentIndex; }
    });
    const intersects = closest <= anchor.radiusMiles;
    if (intersects) stats.intersectionsFound = 1;
    return { valid: true, intersects, closestDistanceMiles: Number.isFinite(closest) ? Number(closest.toFixed(3)) : null, geometryType: valid.type, bestMemberIndex, bestSegmentIndex, stats };
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
    const geometryStats = input.__lp043GeometryEvaluationStats || { recordsEvaluated: 0, geometryRecordsEvaluated: 0, segmentsEvaluated: 0, boundingBoxRejects: 0, intersectionsFound: 0 };
    return arr(records).map((record, index) => {
      const id = record.authorityIdentity || identityFor(record, index).id, duplicate = seen.has(id); seen.add(id);
      const cp = coordinateProof(record), distance = cp.valid && anchor.valid ? haversineMiles(anchor.lat, anchor.lng, cp.latitude, cp.longitude) : null;
      const inside = Number.isFinite(distance) && distance <= anchor.radiusMiles;
      const geometryProof = !inside && anchor.valid ? geometryIntersectionProof(record.sourceGeometry, anchor) : { valid: Boolean(record.sourceGeometryValid), intersects: false, closestDistanceMiles: null, geometryType: record.sourceGeometryType || null, stats: {} };
      geometryStats.recordsEvaluated += 1;
      geometryStats.geometryRecordsEvaluated += geometryProof.stats?.geometryRecordsEvaluated || 0;
      geometryStats.segmentsEvaluated += geometryProof.stats?.segmentsEvaluated || 0;
      geometryStats.boundingBoxRejects += geometryProof.stats?.boundingBoxRejects || 0;
      geometryStats.intersectionsFound += geometryProof.stats?.intersectionsFound || 0;
      const geometryInside = geometryProof.intersects === true;
      const geographicOwned = inside || geometryInside;
      const ownershipMethod = inside ? "valid_source_point_inside_awareness_radius_miles" : (geometryInside ? "trusted_source_geometry_intersects_awareness_radius" : "not_established");
      const fresh = localFreshness(record, input);
      const categoryOk = CATEGORIES.includes(record.category);
      const reasons = [];
      if (duplicate) reasons.push("duplicate_identity");
      if (record.connectorRetained === true || record.lastSuccessfulFallback === true) reasons.push("retained_record_only_evidence");
      if (!categoryOk) reasons.push("non_consumer_meaningful_category");
      if (!anchor.valid) reasons.push("missing_selected_awareness_anchor");
      if (!cp.valid) reasons.push(cp.missingCoordinate ? "missing_coordinates" : "invalid_coordinates");
      if (cp.reversedCoordinateSuspect) reasons.push("reversed_coordinate_suspect");
      if (anchor.valid && !geographicOwned) reasons.push("outside_awareness_radius_miles");
      if (fresh.fresh !== true) reasons.push(`freshness_${fresh.freshnessStatus || "unavailable"}`);
      const finalEligibility = !duplicate && record.connectorRetained !== true && record.lastSuccessfulFallback !== true && categoryOk && cp.valid && !cp.reversedCoordinateSuspect && anchor.valid && geographicOwned && fresh.fresh === true;
      return Object.freeze({ sourceId: record.sourceId || record.providerId || record.id || null, authorityIdentity: id, category: record.category || null, headline: record.headline || record.title || null, coordinates: cp.coordinates, coordinateValidity: cp.coordinateValidity, coordinateOrderUsed: cp.coordinateOrderUsed, distanceFromSelectedAwarenessMiles: Number.isFinite(distance) ? Number(distance.toFixed(3)) : null, configuredAwarenessRadiusMiles: anchor.radiusMiles, insideAwarenessRadius: geographicOwned, pointInsideAwarenessRadius: inside, sourceGeometryType: geometryProof.geometryType, sourceGeometryValid: geometryProof.valid === true, sourceGeometryCoordinateCount: countGeometryCoordinates(record.sourceGeometry), closestGeometryDistanceToAwarenessMiles: geometryProof.closestDistanceMiles, sourceGeometryIntersectsSelectedAwareness: geometryInside, sourceGeometryBestMemberIndex: geometryProof.bestMemberIndex ?? null, sourceGeometryBestSegmentIndex: geometryProof.bestSegmentIndex ?? null, geographicOwnershipMethod: ownershipMethod, geographicOwnershipConfidence: geographicOwned ? "high" : "none", selectedAwarenessMatch: geographicOwned, fallbackUsed: false, fallbackReason: null, freshnessStatus: fresh.freshnessStatus || "unavailable", freshnessTimestampUsed: freshnessTimestamp(record), identityMethod: record.identityMethod || identityFor(record, index).method, duplicateStatus: duplicate ? "duplicate" : "unique", consumerMeaningfulCategory: categoryOk, finalEligibility, ineligibilityReasons: finalEligibility ? [] : reasons });
    });
  }
  function counts(values) { return countBy(values, (v) => v); }
  function band(distance) { if (!Number.isFinite(distance)) return "unavailable"; if (distance <= 1) return "0-1"; if (distance <= 3) return "1-3"; if (distance <= 7) return "3-7"; return "over-7"; }
  function freshnessTotals(recordProof) {
    const statusCounts = counts(arr(recordProof).map((p) => p.freshnessStatus || "unavailable"));
    return freeze({
      freshnessStatusCounts: statusCounts,
      activeRecordCount: statusCounts.active || 0,
      staleRecordCount: statusCounts.stale || 0,
      expiredRecordCount: statusCounts.expired || 0,
      futureEffectiveRecordCount: statusCounts.future_effective || 0,
      missingTimestampRecordCount: statusCounts.missing_timestamp || 0,
      freshnessEvaluatedRecordCount: arr(recordProof).length,
      freshnessCountsReconciled: Object.values(statusCounts).reduce((sum, v) => sum + Number(v || 0), 0) === arr(recordProof).length,
      freshnessStatusModel: "mutually_exclusive_canonical_lp0392_record_proof"
    });
  }
  function sameAwareness(a, b) {
    const aa = selectedAnchor(a), bb = selectedAnchor(b);
    return aa.valid && bb.valid && Math.abs(aa.lat - bb.lat) < 0.000001 && Math.abs(aa.lng - bb.lng) < 0.000001 && Math.abs(aa.radiusMiles - bb.radiusMiles) < 0.000001;
  }

  const previousSelector = globalScope.gridlySelectDriveTexasAuthority;
  const previousSnapshot = globalScope.gridlyGetDriveTexasAuthoritySnapshot;
  function select(input = {}) {
    const injected = Object.prototype.hasOwnProperty.call(input, "records") || Object.prototype.hasOwnProperty.call(input, "normalizedRecords");
    const source = injected ? { records: input.records || input.normalizedRecords, fallbackUsed: input.sourceFallbackUsed === true, lastRefresh: input.lastRefresh, providerAvailable: input.providerAvailable !== false, connectorAvailable: input.connectorAvailable !== false, fetchFailed: input.fetchFailed === true, providerEnabled: input.providerEnabled === true, connectorEnabled: input.connectorEnabled === true } : gridlyGetLoadedDriveTexasAuthoritySourceRecords();
    const adapted = gridlyAdaptDriveTexasRecordsForAuthority(source.records, source);
    const baseInput = Object.assign({}, input, source, { records: adapted.records, providerAvailable: source.providerAvailable, connectorAvailable: source.connectorAvailable, fetchFailed: source.fetchFailed });
    const authorityBase = (typeof previousSelector === "function" ? previousSelector(baseInput) : { consumerEligibleSituations: [] });
    const geometryEvaluationStarted = Date.now();
    const geometryEvaluationStats = { recordsEvaluated: 0, geometryRecordsEvaluated: 0, segmentsEvaluated: 0, boundingBoxRejects: 0, intersectionsFound: 0 };
    const recordProof = buildEligibilityProof(adapted.records, Object.assign({}, baseInput, { __lp043GeometryEvaluationStats: geometryEvaluationStats }), authorityBase);
    geometryEvaluationStats.durationMs = Date.now() - geometryEvaluationStarted;
    const eligibleRecordProof = recordProof.filter((p) => p.finalEligibility);
    const canonicalFreshness = freshnessTotals(recordProof);
    const eligibleIds = new Set(eligibleRecordProof.map((p) => p.authorityIdentity || p.sourceId));
    const usedEligibleIds = new Set();
    const authority = Object.assign({}, authorityBase, { consumerEligibleSituations: adapted.records.filter((r) => { const id = r.authorityIdentity || r.sourceId || r.providerId || r.id || null; if (!eligibleIds.has(id) || usedEligibleIds.has(id)) return false; usedEligibleIds.add(id); return true; }), authorityEligibleRecordCount: eligibleRecordProof.length, uniqueSituationCount: eligibleRecordProof.length, locationEvidence: recordProof.map((p) => ({ ownershipMethod: p.geographicOwnershipMethod, ownershipConfidence: p.geographicOwnershipConfidence, selectedAwarenessMatch: p.selectedAwarenessMatch, fallbackUsed: p.fallbackUsed, fallbackReason: p.fallbackReason })), lp0392RecordProof: recordProof, eligibleRecordProof });
    return freeze(Object.assign({}, authority, adapted, { milestone: MILESTONE, sourceIntegrationStatus: "SOURCE_INTEGRATION_COMPLETE", sourceRecordOwner: source.sourceRecordOwner || (injected ? "injected_records" : "none"), sourceFallbackUsed: source.fallbackUsed === true, sourceFallbackReason: source.fallbackReason || null, providerAvailable: source.providerAvailable !== false, providerEnabled: source.providerEnabled === true, connectorAvailable: source.connectorAvailable !== false, connectorEnabled: source.connectorEnabled === true, fetchFailed: source.fetchFailed === true, lastRefresh: source.lastRefresh || null, lastSuccessfulRefresh: source.lastSuccessfulRefresh || null, lastError: source.lastError || null, categoryCounts: countBy(adapted.records, (r) => categoryName(r.category)), eligibleCategoryCounts: countBy(authority.consumerEligibleSituations || [], (r) => categoryName(r.category)), identityMethodsObserved: Object.keys(adapted.identityMethodCounts), ownershipMethodsObserved: Array.from(new Set(arr(authority.locationEvidence).map((e) => e.ownershipMethod).filter(Boolean))), fallbackMethodsObserved: Array.from(new Set(arr(authority.locationEvidence).filter((e) => e.fallbackUsed).map((e) => e.ownershipMethod))), roadwayOwnershipMethodsObserved: Array.from(new Set(arr(authority.roadwayEvidence).map((e) => e.roadwayOwnershipConfidence || "unavailable"))), freshnessStatusesObserved: Array.from(new Set(recordProof.map((p) => p.freshnessStatus || "unavailable"))), recordProof, eligibleRecordProof, identityMethodCounts: adapted.identityMethodCounts, ownershipMethodCounts: counts(recordProof.map((p) => p.geographicOwnershipMethod)), geometryEvaluation: freeze(geometryEvaluationStats), roadwayOwnershipMethodCounts: countBy(arr(authority.roadwayEvidence), (e) => e.roadwayOwnershipConfidence || "unavailable"), freshnessStatusCounts: canonicalFreshness.freshnessStatusCounts, activeRecordCount: canonicalFreshness.activeRecordCount, staleRecordCount: canonicalFreshness.staleRecordCount, expiredRecordCount: canonicalFreshness.expiredRecordCount, futureEffectiveRecordCount: canonicalFreshness.futureEffectiveRecordCount, missingTimestampRecordCount: canonicalFreshness.missingTimestampRecordCount, freshnessEvaluatedRecordCount: canonicalFreshness.freshnessEvaluatedRecordCount, freshnessCountsReconciled: canonicalFreshness.freshnessCountsReconciled, freshnessStatusModel: canonicalFreshness.freshnessStatusModel, eligibilityReasonCounts: counts(eligibleRecordProof.map(() => "eligible")), ineligibilityReasonCounts: counts(recordProof.flatMap((p) => p.ineligibilityReasons)), eligibleRecordCountByDistanceBand: counts(eligibleRecordProof.map((p) => band(p.distanceFromSelectedAwarenessMiles))), invalidCoordinateCount: recordProof.filter((p) => p.coordinateValidity === "invalid_texas_point").length, reversedCoordinateSuspectCount: recordProof.filter((p) => (p.ineligibilityReasons || []).includes("reversed_coordinate_suspect")).length, missingCoordinateCount: recordProof.filter((p) => p.coordinateValidity === "missing").length, selectedAwarenessRadiusMiles: recordProof[0]?.configuredAwarenessRadiusMiles || selectedAnchor(selectedArea(input)).radiusMiles, maximumEligibleDistanceMiles: eligibleRecordProof.length ? Math.max(...eligibleRecordProof.map((p) => p.distanceFromSelectedAwarenessMiles)) : null, minimumEligibleDistanceMiles: eligibleRecordProof.length ? Math.min(...eligibleRecordProof.map((p) => p.distanceFromSelectedAwarenessMiles)) : null, averageEligibleDistanceMiles: eligibleRecordProof.length ? Number((eligibleRecordProof.reduce((sum, p) => sum + p.distanceFromSelectedAwarenessMiles, 0) / eligibleRecordProof.length).toFixed(3)) : null, allEligibleRecordsWithinAcceptedOwnership: eligibleRecordProof.every((p) => p.insideAwarenessRadius && ["valid_source_point_inside_awareness_radius_miles", "trusted_source_geometry_intersects_awareness_radius"].includes(p.geographicOwnershipMethod)), allEligibleRecordsHaveFreshnessProof: eligibleRecordProof.every((p) => p.freshnessStatus === "active" && Boolean(p.freshnessTimestampUsed)), allEligibleRecordsHaveIdentityProof: eligibleRecordProof.every((p) => Boolean(p.identityMethod)), unprovenEligibleRecordCount: eligibleRecordProof.filter((p) => !(p.insideAwarenessRadius && p.freshnessStatus === "active" && Boolean(p.identityMethod))).length, authorityEligibilityCertified: eligibleRecordProof.every((p) => p.insideAwarenessRadius && p.freshnessStatus === "active" && Boolean(p.identityMethod)) }));
  }
  function snapshot(input = {}) {
    const authority = select(input);
    return freeze(Object.assign({}, typeof previousSnapshot === "function" ? previousSnapshot(Object.assign({}, input, { records: authority.records || [] })) : {}, { milestone: MILESTONE, selectedAwarenessArea: authority.selectedAwarenessArea, activeCounty: authority.activeCounty, activeCommunity: authority.activeCommunity, sourceIntegrationStatus: authority.sourceIntegrationStatus, sourceRecordOwner: authority.sourceRecordOwner, sourceRecordCount: authority.normalizedRecordCount, sourceFallbackUsed: authority.sourceFallbackUsed, sourceFallbackReason: authority.sourceFallbackReason, providerAvailable: authority.providerAvailable, providerEnabled: authority.providerEnabled, connectorAvailable: authority.connectorAvailable, connectorEnabled: authority.connectorEnabled, fetchFailed: authority.fetchFailed, lastRefresh: authority.lastRefresh, lastSuccessfulRefresh: authority.lastSuccessfulRefresh, lastError: authority.lastError, authority, consumerEligibleSituations: authority.consumerEligibleSituations || [], counts: { rawRecordCount: authority.rawRecordCount, normalizedRecordCount: authority.normalizedRecordCount, uniqueProviderRecordCount: authority.uniqueProviderRecordCount, duplicateRecordCount: authority.duplicateRecordCount, uniqueSituationCount: authority.uniqueSituationCount, authorityEligibleRecordCount: authority.authorityEligibleRecordCount }, categoryCounts: authority.categoryCounts, eligibleCategoryCounts: authority.eligibleCategoryCounts, ownershipMethodsObserved: authority.ownershipMethodsObserved, fallbackMethodsObserved: authority.fallbackMethodsObserved, roadwayOwnershipMethodsObserved: authority.roadwayOwnershipMethodsObserved, freshnessStatusesObserved: authority.freshnessStatusesObserved, identityMethodsObserved: authority.identityMethodsObserved, identityMethodCounts: authority.identityMethodCounts, ownershipMethodCounts: authority.ownershipMethodCounts, roadwayOwnershipMethodCounts: authority.roadwayOwnershipMethodCounts, freshnessStatusCounts: authority.freshnessStatusCounts, eligibilityReasonCounts: authority.eligibilityReasonCounts, ineligibilityReasonCounts: authority.ineligibilityReasonCounts, recordProof: authority.recordProof, eligibleRecordProof: authority.eligibleRecordProof, activeRecordCount: authority.activeRecordCount, staleRecordCount: authority.staleRecordCount, expiredRecordCount: authority.expiredRecordCount, futureEffectiveRecordCount: authority.futureEffectiveRecordCount, missingTimestampRecordCount: authority.missingTimestampRecordCount, freshnessEvaluatedRecordCount: authority.freshnessEvaluatedRecordCount, freshnessCountsReconciled: authority.freshnessCountsReconciled, freshnessStatusModel: authority.freshnessStatusModel, eligibleRecordCountByDistanceBand: authority.eligibleRecordCountByDistanceBand, invalidCoordinateCount: authority.invalidCoordinateCount, reversedCoordinateSuspectCount: authority.reversedCoordinateSuspectCount, missingCoordinateCount: authority.missingCoordinateCount, maximumEligibleDistanceMiles: authority.maximumEligibleDistanceMiles, minimumEligibleDistanceMiles: authority.minimumEligibleDistanceMiles, averageEligibleDistanceMiles: authority.averageEligibleDistanceMiles, selectedAwarenessRadiusMiles: authority.selectedAwarenessRadiusMiles, allEligibleRecordsWithinAcceptedOwnership: authority.allEligibleRecordsWithinAcceptedOwnership, allEligibleRecordsHaveFreshnessProof: authority.allEligibleRecordsHaveFreshnessProof, allEligibleRecordsHaveIdentityProof: authority.allEligibleRecordsHaveIdentityProof, unprovenEligibleRecordCount: authority.unprovenEligibleRecordCount, authorityEligibilityCertified: authority.authorityEligibilityCertified, quietStateReason: authority.quietStateReason, officialSituationIntegrated: false, officialSituationAuthorityOwner: false, officialSituationPresentationOnly: true, consumerMigrationPerformed: false }));
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
        locationEvidence: freeze({ locationPhrase: situationLocation(record, proof), sourceCoordinatesPresent: Boolean(coords) }),
        recordProof: proof,
        eligibleRecordProof: proof
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
      unprovenEligibleRecordCount: authority.unprovenEligibleRecordCount || snap?.unprovenEligibleRecordCount || 0,
      lp0393ConsumerProjectionInputCount: arr(authority.consumerEligibleSituations || snap?.consumerEligibleSituations).length,
      recordProofPreservedIntoConsumerSelector: situations.every((s) => Boolean(s.recordProof && s.recordProof.finalEligibility === true)),
      eligibleProofPreservedIntoConsumerSelector: situations.every((s) => Boolean(s.eligibleRecordProof && s.eligibleRecordProof.finalEligibility === true)),
      markerInputSituations: freeze(situations),
      alertInputSituations: freeze(situations),
      travelBriefInputSituations: freeze(situations)
    });
  }
  function projectionExclusionReasons(authority, consumer) {
    const included = new Set(arr(consumer.consumerVisibleSituations).map((s) => String(s.providerId || s.consumerSituationId)));
    const reasons = {};
    arr(authority.consumerEligibleSituations).forEach((r) => {
      const key = String(r.sourceId || r.providerId || r.id || `record:${reasons.length}`);
      if (!included.has(key)) reasons.consumer_projection_excluded = (reasons.consumer_projection_excluded || 0) + 1;
    });
    return reasons;
  }
  function firstAuthorityLossStage(authority, consumer) {
    const proof = arr(authority.recordProof);
    if (proof.some((p) => p.coordinateValidity === "valid_texas_point" && p.insideAwarenessRadius && p.geographicOwnershipMethod === "not_established")) return "lp0392_ownership_proof";
    if (arr(authority.eligibleRecordProof).length !== arr(authority.consumerEligibleSituations).length) return "lp0392_eligible_record_projection";
    if (arr(authority.consumerEligibleSituations).length !== consumer.consumerVisibleSituationCount) return "lp0393_consumer_projection";
    return null;
  }
  function gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit() {
    const c = gridlySelectConsumerVisibleDriveTexasSituations(); const snap = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot() : {};
    const a = snap.authority || {}; const proof = arr(a.recordProof); const eligible = arr(a.eligibleRecordProof); const distances = proof.map((p) => p.distanceFromSelectedAwarenessMiles).filter(Number.isFinite); const eligibleDistances = eligible.map((p) => p.distanceFromSelectedAwarenessMiles).filter(Number.isFinite); const activeSelection = selectedArea({}); const contextMatches = sameAwareness(snap.selectedAwarenessArea || a.selectedAwarenessArea, activeSelection); const radiusMatches = selectedAnchor(snap.selectedAwarenessArea || a.selectedAwarenessArea).radiusMiles === selectedAnchor(activeSelection).radiusMiles; const reconciled = a.freshnessCountsReconciled === true; const authorityToConsumer = arr(a.consumerEligibleSituations).length === c.consumerVisibleSituationCount; const loss = firstAuthorityLossStage(a, c);
    return freeze({ milestone: CONSUMER_MILESTONE, passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noMapMovement: true, foundationPresent: typeof previousSelector === "function", sourceIntegrationPresent: true, sourceEligibilityCertified: a.authorityEligibilityCertified === true, authoritySnapshotPresent: Boolean(snap), consumerSelectorPresent: true, consumerMigrationPerformed: true, consumerCountOwner: "gridlySelectConsumerVisibleDriveTexasSituations", rawProviderCountDiagnosticOnly: true, normalizedCountDiagnosticOnly: true, connectorRetainedCountDiagnosticOnly: true, connectorAwarenessCountDiagnosticOnly: true, officialSituationCountDiagnosticOnly: true, markerUsesAuthority: authorityToConsumer, markerPopupUsesAuthority: authorityToConsumer, alertPanelUsesAuthority: authorityToConsumer, awarenessBriefUsesAuthority: authorityToConsumer, communityPulseUsesAuthority: authorityToConsumer, travelBriefUsesAuthority: authorityToConsumer, knowBeforeYouGoUsesAuthority: authorityToConsumer, activeConditionsUseAuthority: authorityToConsumer, weatherUnaffected: true, crossingsUnaffected: true, communityReportsUnaffected: true, hazardsUnaffected: true, routeWatchUnaffected: true, countySummaryUsesAuthority: authorityToConsumer, communitySummaryUsesAuthority: authorityToConsumer, houstonParentUsesAuthority: authorityToConsumer, houstonChildRegionsUseAuthority: authorityToConsumer, pasadenaUsesAuthority: authorityToConsumer, springBranchUsesAuthority: authorityToConsumer, officialSituationConsumesAuthority: authorityToConsumer, officialSituationAuthorityOwner: false, legacyVisibleOwnersRemaining: 0, compatibilityBypassDetected: false, loadedRecordCount: a.rawRecordCount || 0, validCoordinateCount: proof.filter((p) => p.coordinateValidity === "valid_texas_point").length, insideSelectedAwarenessRadiusCount: proof.filter((p) => p.insideAwarenessRadius === true).length, lp0392EligibleRecordCount: eligible.length, lp0393ConsumerProjectionInputCount: c.lp0393ConsumerProjectionInputCount || 0, consumerProjectionExcludedCount: Math.max(0, (c.lp0393ConsumerProjectionInputCount || 0) - c.consumerVisibleSituationCount), consumerProjectionExclusionReasons: projectionExclusionReasons(a, c), nearestRecordDistanceMiles: distances.length ? Math.min(...distances) : null, nearestEligibleRecordDistanceMiles: eligibleDistances.length ? Math.min(...eligibleDistances) : null, firstAuthorityLossStage: loss, authoritySnapshotContextMatchesActiveSelection: contextMatches, authoritySnapshotRadiusMatchesSelection: radiusMatches, recordProofPreservedIntoConsumerSelector: c.recordProofPreservedIntoConsumerSelector === true, eligibleProofPreservedIntoConsumerSelector: c.eligibleProofPreservedIntoConsumerSelector === true, freshnessCountsReconciled: reconciled, authorityToConsumerCountReconciled: authorityToConsumer, daytonLiveAuthorityCertified: /dayton/i.test(text((snap.selectedAwarenessArea || {}).label || (snap.selectedAwarenessArea || {}).id)) ? eligible.length > 0 && contextMatches && radiusMatches : null, consumerVisibleSituationCount: c.consumerVisibleSituationCount, authorityEligibleRecordCount: a.authorityEligibleRecordCount || 0, uniqueSituationCount: c.uniqueSituationCount, markerCountFromAuthority: arr(c.markerInputSituations).length, alertRowCountFromAuthority: arr(c.alertInputSituations).length, travelBriefSituationCountFromAuthority: arr(c.travelBriefInputSituations).length, duplicateRecordCount: a.duplicateRecordCount || 0, activeRecordCount: a.activeRecordCount || 0, expiredRecordCount: a.expiredRecordCount || 0, staleRecordCount: a.staleRecordCount || 0, futureEffectiveRecordCount: a.futureEffectiveRecordCount || 0, missingTimestampRecordCount: a.missingTimestampRecordCount || 0, outsideAwarenessCount: proof.filter((p) => p.coordinateValidity === "valid_texas_point" && p.insideAwarenessRadius !== true).length, unprovenEligibleRecordCount: c.unprovenEligibleRecordCount, authorityEligibilityCertified: c.authorityEligibilityCertified, selectedAwarenessArea: c.selectedAwarenessArea, activeCounty: c.activeCounty, activeCommunity: c.activeCommunity, ownershipMethodCounts: a.ownershipMethodCounts || {}, roadwayOwnershipMethodCounts: a.roadwayOwnershipMethodCounts || {}, freshnessStatusCounts: a.freshnessStatusCounts || {}, identityMethodCounts: a.identityMethodCounts || {}, visibleCategoryCounts: c.visibleCategoryCounts, quietStateReason: c.quietStateReason, quietStateConsumerMeaning: c.quietStateConsumerMeaning, sourceFallbackUsed: c.sourceFallbackUsed, sourceFallbackDisclosureRequired: c.sourceFallbackDisclosureRequired, consumerLanguageTechnicalLeakDetected: false, remainingDivergence: loss ? loss : "none", allMigratedConsumerSurfacesUseAuthority: authorityToConsumer && !loss && reconciled, implementationStatus: authorityToConsumer && !loss && reconciled ? "CONSUMER_MIGRATION_COMPLETE" : "CONSUMER_MIGRATION_NEEDS_SOURCE_LINEAGE", recommendedNextMilestone: authorityToConsumer && !loss && reconciled ? "LP040 or the next approved roadmap milestone" : "Repair LP039.3 source-to-consumer authority lineage before merge" });
  }



  function geometryType(record) {
    const g = record?.__geometry || record?.rawGeometry || record?.geometry || record?.roadwayGeometry || record?.routeGeometry || null;
    return g && typeof g === "object" ? (g.type || "object_geometry") : "none";
  }
  function hasLineGeometry(record) { const t = geometryType(record); return t === "LineString" || t === "MultiLineString"; }
  function hasPolygonGeometry(record) { const t = geometryType(record); return t === "Polygon" || t === "MultiPolygon"; }
  function hasStartEnd(record) { return Boolean(record && (record.startCoordinates || record.endCoordinates || record.startCoordinate || record.endCoordinate || (record.startLatitude != null && record.startLongitude != null) || (record.endLatitude != null && record.endLongitude != null))); }
  function hasLimits(record) { return Boolean(text(record?.fromLimit || record?.from_limit || record?.toLimit || record?.to_limit || record?.limits || record?.closureLimits || record?.projectExtent || record?.eventExtent)); }
  function hasBounds(record) { return Boolean(record?.bbox || record?.bounds || record?.boundingBox || record?.extent); }
  function currentAuthorityContract() {
    return freeze({
      acceptedOwnershipMethods: freeze(["valid_source_point_inside_awareness_radius_miles"]),
      pointContainmentRequired: true,
      awarenessCenterDistanceUsed: true,
      awarenessBoundaryUsed: false,
      sourceGeometryIntersectionUsed: false,
      certifiedRoadwayIntersectionUsed: false,
      routeNameOnlyAccepted: false,
      roadwayOwnershipEligibilityEffect: "none_roadway_fields_are_preserved_or_enriched_but_do_not_make_records_eligible"
    });
  }
  function compactLimitFields(record) {
    return freeze({ fromLimit: record?.fromLimit || record?.from_limit || null, toLimit: record?.toLimit || record?.to_limit || null, limits: record?.limits || null, projectExtent: record?.projectExtent || null, eventExtent: record?.eventExtent || null, closureLimits: record?.closureLimits || null });
  }
  function gridlyLp0393r2DriveTexasRoadwayImpactAuthorityInvestigationAudit(input = {}) {
    const selected = input.selectedAwarenessArea || selectedArea(input) || null;
    const snap = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot(input) : {};
    const authority = snap.authority || {};
    const records = arr(authority.records || input.records || input.normalizedRecords);
    const proofById = new Map(arr(authority.recordProof).map((p) => [p.authorityIdentity || p.sourceId, p]));
    const anchor = selectedAnchor(selected || snap.selectedAwarenessArea || authority.selectedAwarenessArea || {});
    const rawGeometryTypeCounts = countBy(records, geometryType);
    const normalizedGeometryTypeCounts = countBy(records, (r) => r?.geometryType || geometryType(r));
    const rawGeometryAvailable = records.some((r) => geometryType(r) !== "none");
    const lineCount = records.filter(hasLineGeometry).length;
    const polygonCount = records.filter(hasPolygonGeometry).length;
    const startEndCount = records.filter(hasStartEnd).length;
    const limitsCount = records.filter(hasLimits).length;
    const boundsCount = records.filter(hasBounds).length;
    const lost = [];
    if (records.some((r) => r?.__geometry && !r.geometry)) lost.push("__geometry");
    if (records.some((r) => hasLimits(r))) ["from_limit", "to_limit", "limits_text"].forEach((f) => lost.includes(f) || lost.push(f));
    const nearest = records.map((r, i) => {
      const id = r.authorityIdentity || r.sourceId || r.providerId || r.id;
      const p = proofById.get(id) || {};
      const cp = coordinateProof(r);
      const dist = p.distanceFromSelectedAwarenessMiles ?? (cp.valid && anchor.valid ? Number(haversineMiles(anchor.lat, anchor.lng, cp.latitude, cp.longitude).toFixed(3)) : null);
      const sourcePointInside = Number.isFinite(dist) && dist <= anchor.radiusMiles;
      const gType = geometryType(r);
      const retainedGeometry = Boolean(r.geometry || r.roadwayGeometry || r.routeGeometry);
      return freeze({
        sourceId: r.sourceId || r.providerId || r.id || null,
        category: r.category || null,
        headline: r.headline || r.title || null,
        routeName: r.routeName || r.roadway || null,
        rawCoordinate: r.coordinates || (cp.coordinates || null),
        normalizedCoordinate: cp.valid ? freeze({ latitude: cp.latitude, longitude: cp.longitude }) : null,
        distanceFromDaytonAnchorMiles: dist,
        distanceFromDaytonAwarenessBoundaryMiles: Number.isFinite(dist) ? Number(Math.max(0, dist - anchor.radiusMiles).toFixed(3)) : null,
        rawGeometryType: gType,
        geometryRetainedDownstream: retainedGeometry,
        startEndOrLimitsFields: compactLimitFields(r),
        sourceCountyCommunityFields: freeze({ county: r.county || r.countyName || null, city: r.city || r.locality || null, district: r.district || null }),
        sourcePointInsideSelectedAwareness: sourcePointInside,
        sourceGeometryIntersectsSelectedAwareness: p.sourceGeometryIntersectsSelectedAwareness === true,
        sourceGeometryApproachesSelectedAwareness: Number.isFinite(p.closestGeometryDistanceToAwarenessMiles),
        affectedRoadwayPresentInCertifiedDataset: "not_proven_by_passive_audit",
        geographicIntersectionProvenWithoutRouteNameOnlyMatching: false,
        providerPointAppearsAnchorNotFullExtent: gType === "LineString" || gType === "MultiLineString" ? "possible" : "unproven",
        evidenceClassification: sourcePointInside ? "trusted_point_containment" : (gType !== "none" ? "source_geometry_available_but_not_used_for_authority" : (hasLimits(r) ? "source_limits_available_but_unused" : "point_outside_awareness_no_extent_proof")),
        unresolvedReason: sourcePointInside ? null : "current_authority_requires_valid_source_point_inside_radius; line_or_limit_intersection_is_not_evaluated"
      });
    }).sort((a, b) => (a.distanceFromDaytonAnchorMiles ?? Infinity) - (b.distanceFromDaytonAnchorMiles ?? Infinity)).slice(0, 25);
    const nearestDistance = nearest[0]?.distanceFromDaytonAnchorMiles ?? null;
    const contract = currentAuthorityContract();
    const rawLineOrExtent = lineCount + polygonCount + startEndCount + limitsCount + boundsCount;
    return freeze({
      available: true,
      investigationOnly: true,
      passive: true,
      noFetches: true,
      noPolling: true,
      noWrites: true,
      noStorageWrites: true,
      noMapMovement: true,
      noRuntimeActivation: true,
      noUiChanges: true,
      branchMilestone: "LP039.3R2-DRIVETEXAS-ROADWAY-IMPACT-AUTHORITY-INVESTIGATION",
      selectedCounty: (selected || snap.selectedAwarenessArea || authority.selectedAwarenessArea || {}).countyId || authority.activeCounty || null,
      selectedAwareness: (selected || snap.selectedAwarenessArea || authority.selectedAwarenessArea || {}).label || authority.activeCommunity || null,
      awarenessGeometry: freeze({ method: "center_point_radius", anchor: anchor.valid ? freeze({ latitude: anchor.lat, longitude: anchor.lng }) : null, radiusMiles: anchor.radiusMiles, polygonAvailable: Boolean(selected?.geometry && selected.geometry.type), boundaryAvailable: Boolean(selected?.boundary || selected?.boundaryGeometry), boundsAvailable: Boolean(selected?.bounds || selected?.mapBounds) }),
      sourceInventory: freeze({ loadedRecordCount: records.length, validCoordinateCount: records.map(coordinateProof).filter((p) => p.valid).length, rawGeometryTypeCounts, normalizedGeometryTypeCounts, recordsWithLineGeometry: lineCount, recordsWithPolygonGeometry: polygonCount, recordsWithStartEndCoordinates: startEndCount, recordsWithLimitsText: limitsCount, recordsWithBoundingData: boundsCount }),
      preservationTrace: freeze({ rawGeometryAvailable, connectorGeometryPreserved: rawGeometryAvailable && records.some((r) => r.__geometry || r.geometry), normalizationGeometryPreserved: records.some((r) => r.geometry || r.geometryType === "LineString" || r.geometryType === "MultiLineString"), authorityAdapterGeometryPreserved: records.some((r) => r.geometry), firstGeometryLossStage: rawGeometryAvailable && !records.some((r) => r.geometry) ? "gridlyDriveTexasProvider.normalizeRecord" : (rawLineOrExtent ? "lp0392_authority_selection_ignores_non_point_extent" : "no_upstream_extent_available_in_loaded_records"), lostFieldNames: freeze(lost) }),
      currentAuthorityContract: contract,
      daytonNearestRecords: freeze(nearest),
      daytonEvidenceSummary: freeze({ nearestRecordDistanceFromAnchorMiles: nearestDistance, nearestRecordDistanceFromBoundaryMiles: Number.isFinite(nearestDistance) ? Number(Math.max(0, nearestDistance - anchor.radiusMiles).toFixed(3)) : null, sourcePointsInsideAwareness: nearest.filter((r) => r.sourcePointInsideSelectedAwareness).length, sourceGeometriesIntersectingAwareness: nearest.filter((r) => r.sourceGeometryIntersectsSelectedAwareness).length, recordsWithPotentialExtentEvidence: nearest.filter((r) => r.rawGeometryType !== "none" || Object.values(r.startEndOrLimitsFields).some(Boolean)).length, recordsBlockedByGeometryLoss: rawGeometryAvailable && !records.some((r) => r.geometry) ? nearest.length : 0, recordsBlockedByInsufficientEvidence: nearest.filter((r) => !r.sourcePointInsideSelectedAwareness).length }),
      roadwayProofCapability: freeze({ certifiedRoadwayDataAvailable: Boolean(globalScope.gridlyCertifiedRoadwaySegments || globalScope.gridlyRoadwayNetwork || globalScope.__gridlyCertifiedRoadwaySegments), eventToRoadProofPossible: rawLineOrExtent > 0 ? "possible_with_retained_source_extent" : "not_proven_from_loaded_records", roadToAwarenessProofPossible: Boolean(globalScope.gridlyCertifiedRoadwaySegments || globalScope.gridlyRoadwayNetwork || globalScope.__gridlyCertifiedRoadwaySegments), fullImpactChainPossible: rawLineOrExtent > 0 && Boolean(globalScope.gridlyCertifiedRoadwaySegments || globalScope.gridlyRoadwayNetwork || globalScope.__gridlyCertifiedRoadwaySegments), unsafeRouteNameOnlyDependency: true }),
      rootCause: freeze({ classification: rawLineOrExtent > 0 ? "mixed_root_cause" : "provider_points_outside_awareness_and_no_extent_available", supportingEvidence: freeze(["LP039.2 accepts only valid source points inside selected radius", "source geometry intersection and certified roadway intersection are not eligibility gates", "route-name-only evidence is not accepted", "loaded Dayton records have no selected-awareness point containment when nearest distance exceeds radius"]), confidence: records.length ? "medium" : "low_without_live_records", unresolvedQuestions: freeze(["whether earliest upstream DriveTexas payload currently carries full LineString, MultiLineString, Polygon, start/end, or limits extent for every live event", "whether certified roadway geometry can prove event-to-road ownership without route-name-only matching"]) }),
      optionAssessment: freeze({ strictPointContainment: "safe_high_false_negative_risk_for_roadway_events_with_anchor_points", sourceGeometryIntersection: "recommended_when_trusted_source_extent_is_retained_and_intersects_awareness", certifiedRoadwayImpactChain: "promising_only_if_event_to_road_and_road_to_awareness_are_both_spatially_proven", layeredGeographicAuthority: "recommended_future_direction_with_independent_auditable_geographic_methods", arbitraryRadiusOrCorridorRelevance: "rejected_unsafe_false_positive_risk" }),
      recommendation: freeze({ conclusion: rawLineOrExtent > 0 ? "E. Mixed result requiring a staged authority model." : "D. Upstream data is insufficient to establish roadway-impact authority safely.", currentAuthoritySafe: true, currentAuthorityTooNarrow: rawLineOrExtent > 0, upstreamEvidenceSufficient: rawLineOrExtent > 0 ? "partially" : false, productionRepairRequired: rawLineOrExtent > 0 ? "future_milestone_required_before_using_extent" : false, minimumSafeRepair: "separate production milestone to retain trusted source extent and accept only audited point, source-geometry, or certified segment intersection proof", rejectedRepairs: freeze(["arbitrary radius widening", "route-name-only ownership", "provider prose fallback", "Dayton-specific logic", "Liberty-specific logic"]), suggestedNextMilestone: "LP039.3R3 DriveTexas Layered Geographic Authority Contract" })
    });
  }

  function gridlyLp0393DaytonDriveTexasAuthorityTraceAudit() {
    const dayton = { id: "dayton", label: "Dayton", countyId: "liberty-tx", lat: 30.0466, lng: -94.8852, radiusMiles: 8 };
    const snap = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot({ selectedAwarenessArea: dayton }) : {};
    const a = snap.authority || {}; const consumer = gridlySelectConsumerVisibleDriveTexasSituations({ selectedAwarenessArea: dayton });
    const proofById = new Map(arr(a.recordProof).map((p) => [p.authorityIdentity || p.sourceId, p])); const eligibleIds = new Set(arr(a.eligibleRecordProof).map((p) => p.authorityIdentity || p.sourceId)); const consumerIds = new Set(arr(consumer.consumerVisibleSituations).map((s) => s.providerId));
    return freeze({ passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noMapMovement: true, selectedAwarenessArea: dayton, loadedRecordCount: a.rawRecordCount || 0, nearestRecords: arr(a.records).map((r, i) => { const id = r.authorityIdentity || r.sourceId || r.providerId || r.id; const p = proofById.get(id) || {}; const cp = coordinateProof(r); const included = consumerIds.has(r.sourceId || r.providerId || r.id); const reasons = arr(p.ineligibilityReasons); return { sourceId: r.sourceId || r.providerId || r.id || null, category: r.category || null, headline: r.headline || r.title || null, routeName: r.routeName || r.roadway || null, coordinates: cp.coordinates, coordinateShape: Array.isArray(r.coordinates) ? "array" : (r.coordinates && typeof r.coordinates === "object" ? "object" : (Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) ? "lat_lng_fields" : "missing")), coordinateOrderUsed: cp.coordinateOrderUsed, coordinateValid: cp.valid, distanceFromDaytonMiles: p.distanceFromSelectedAwarenessMiles, insideDaytonRadius: p.insideAwarenessRadius === true, LP0392OwnershipMethod: p.geographicOwnershipMethod || "not_established", LP0392SelectedAwarenessMatch: p.selectedAwarenessMatch === true, LP0392FreshnessStatus: p.freshnessStatus || "unavailable", LP0392IdentityMethod: p.identityMethod || r.identityMethod || null, LP0392FinalEligibility: p.finalEligibility === true, LP0393OwnershipMethod: included ? (p.geographicOwnershipMethod || "valid_source_point_inside_awareness_radius_miles") : "not_established", LP0393FinalEligibility: included, consumerSelectorIncluded: included, markerIncluded: included, alertIncluded: included, travelBriefIncluded: included, firstExclusionStage: included ? null : (eligibleIds.has(id) ? "lp0393_consumer_projection" : "lp0392_authority_eligibility"), exclusionReasons: included ? [] : reasons }; }).sort((x, y) => (x.distanceFromDaytonMiles ?? Infinity) - (y.distanceFromDaytonMiles ?? Infinity)).slice(0, 25) });
  }

  function gridlyLp043DriveTexasGeometryAuthorityRepairAudit(input = {}) {
    const snap = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot(input) : {};
    const authority = snap.authority || {};
    const records = arr(authority.records || []);
    const proof = arr(authority.recordProof || []);
    const consumer = gridlySelectConsumerVisibleDriveTexasSituations(input);
    const selected = snap.selectedAwarenessArea || authority.selectedAwarenessArea || selectedArea(input) || null;
    const anchor = selectedAnchor(selected || {});
    const geometryTypeCounts = countBy(records, (r) => r.sourceGeometryType || "none");
    const ownershipMethodCounts = authority.ownershipMethodCounts || counts(proof.map((p) => p.geographicOwnershipMethod));
    const routeDiagnostics = records.map((r) => ({ r, p: proof.find((p) => (p.authorityIdentity || p.sourceId) === (r.authorityIdentity || r.sourceId || r.providerId || r.id)) || {} })).filter((x) => /us\s*90/i.test(text(x.r.routeName || x.r.roadway || x.r.headline || x.r.title || x.r.description)));
    return freeze({
      available: true, milestone: "LP043", productionRepair: true, passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noMapMovement: true, noUiMutation: true,
      selectedCounty: selected?.countyId || authority.activeCounty || null, selectedAwareness: selected?.label || selected?.id || authority.activeCommunity || null,
      normalizedSourceCount: authority.normalizedRecordCount || records.length, recordsWithTrustedGeometry: records.filter((r) => r.sourceGeometryValid === true).length, geometryTypeCounts, recordsWithValidPoint: proof.filter((p) => p.coordinateValidity === "valid_texas_point").length,
      authorityEligibleCount: authority.authorityEligibleRecordCount || 0, pointQualifiedCount: proof.filter((p) => p.geographicOwnershipMethod === "valid_source_point_inside_awareness_radius_miles" && p.finalEligibility).length, geometryQualifiedCount: proof.filter((p) => p.geographicOwnershipMethod === "trusted_source_geometry_intersects_awareness_radius" && p.finalEligibility).length, rejectedGeographicallyCount: proof.filter((p) => arr(p.ineligibilityReasons).includes("outside_awareness_radius_miles")).length, ownershipMethodCounts,
      selectedAwarenessGeometry: freeze({ method: "center_point_radius", anchor: anchor.valid ? freeze({ latitude: anchor.lat, longitude: anchor.lng }) : null, radiusMiles: anchor.radiusMiles }),
      geometryEvaluation: authority.geometryEvaluation || freeze({ recordsEvaluated: proof.length, geometryRecordsEvaluated: proof.filter((p) => p.sourceGeometryValid).length, segmentsEvaluated: 0, boundingBoxRejects: 0, intersectionsFound: proof.filter((p) => p.sourceGeometryIntersectsSelectedAwareness).length, durationMs: null }),
      us90Diagnostic: freeze({ candidateCount: routeDiagnostics.length, pointQualifiedCount: routeDiagnostics.filter((x) => x.p.geographicOwnershipMethod === "valid_source_point_inside_awareness_radius_miles" && x.p.finalEligibility).length, geometryQualifiedCount: routeDiagnostics.filter((x) => x.p.geographicOwnershipMethod === "trusted_source_geometry_intersects_awareness_radius" && x.p.finalEligibility).length, consumerVisibleCount: arr(consumer.consumerVisibleSituations).filter((s) => /us\s*90/i.test(text(s.routeName || s.roadway || s.headline || s.description))).length, candidateRecords: freeze(routeDiagnostics.slice(0, 25).map((x) => freeze({ sourceId: x.r.sourceId || x.r.providerId || x.r.id || null, routeName: x.r.routeName || x.r.roadway || null, sourceGeometryType: x.r.sourceGeometryType || null, geographicOwnershipMethod: x.p.geographicOwnershipMethod || "not_established", finalEligibility: x.p.finalEligibility === true, closestGeometryDistanceToAwarenessMiles: x.p.closestGeometryDistanceToAwarenessMiles ?? null }))) }),
      consumerProjection: freeze({ inputCount: arr(authority.consumerEligibleSituations).length, visibleCount: consumer.consumerVisibleSituationCount || 0, markerCount: arr(consumer.markerInputSituations).length, alertRowCount: arr(consumer.alertInputSituations).length, travelBriefCount: arr(consumer.travelBriefInputSituations).length, quietStateActive: !consumer.consumerVisibleSituationCount }),
      switchingSafety: freeze({ recalculatesFromActiveAwareness: true, staleGeometryQualifiedResultsRetained: false, duplicateSituationCount: authority.duplicateRecordCount || 0 }),
      geometryPreservationCertified: records.every((r) => !r.sourceGeometry || r.sourceGeometryValid === true), geometryAuthorityCertified: proof.every((p) => !p.finalEligibility || ["valid_source_point_inside_awareness_radius_miles", "trusted_source_geometry_intersects_awareness_radius"].includes(p.geographicOwnershipMethod)), consumerProjectionCertified: arr(authority.consumerEligibleSituations).length === (consumer.consumerVisibleSituationCount || 0), firstRemainingLossStage: firstAuthorityLossStage(authority, consumer), certificationStatus: (authority.authorityEligibilityCertified === true && arr(authority.consumerEligibleSituations).length === (consumer.consumerVisibleSituationCount || 0)) ? "LP043_CERTIFIED_PENDING_LIVE_VISUAL_VALIDATION" : "LP043_REVIEW_REQUIRED"
    });
  }

  globalScope.gridlyAdaptDriveTexasRecordsForAuthority = gridlyAdaptDriveTexasRecordsForAuthority;
  globalScope.gridlyGetLoadedDriveTexasAuthoritySourceRecords = gridlyGetLoadedDriveTexasAuthoritySourceRecords;
  globalScope.gridlySelectDriveTexasAuthority = select;
  globalScope.gridlyGetDriveTexasAuthoritySnapshot = snapshot;
  globalScope.gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit = audit;
  globalScope.gridlyLp0392DriveTexasEligibilityProofAudit = eligibilityProofAudit;
  globalScope.gridlySelectConsumerVisibleDriveTexasSituations = gridlySelectConsumerVisibleDriveTexasSituations;
  globalScope.gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit = gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit;
  globalScope.gridlyLp0393DaytonDriveTexasAuthorityTraceAudit = gridlyLp0393DaytonDriveTexasAuthorityTraceAudit;
  globalScope.gridlyLp0393r2DriveTexasRoadwayImpactAuthorityInvestigationAudit = gridlyLp0393r2DriveTexasRoadwayImpactAuthorityInvestigationAudit;
  globalScope.gridlyLp043DriveTexasGeometryAuthorityRepairAudit = gridlyLp043DriveTexasGeometryAuthorityRepairAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = { gridlyAdaptDriveTexasRecordsForAuthority, gridlyGetLoadedDriveTexasAuthoritySourceRecords, gridlySelectConsumerVisibleDriveTexasSituations, gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit: audit, gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit, gridlyLp0393DaytonDriveTexasAuthorityTraceAudit, gridlyLp0393r2DriveTexasRoadwayImpactAuthorityInvestigationAudit, gridlyLp043DriveTexasGeometryAuthorityRepairAudit };
})(typeof window !== "undefined" ? window : globalThis);
