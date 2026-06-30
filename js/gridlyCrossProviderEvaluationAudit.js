(function initGridlyCrossProviderEvaluationAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDERS = Object.freeze(["community", "drivetexas", "weather"]);
  const PROXIMITY_KM = 8;
  const DUPLICATE_PROXIMITY_KM = 2;

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function text(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function providerId(record, fallback) {
    const id = text(record && (record.providerId || record.provider)).replace(/\s+/g, "");
    if (id === "drivetexas" || id === "drive texas") return "drivetexas";
    if (PROVIDERS.includes(id)) return id;
    return fallback;
  }

  function getCategory(record) {
    return String(record.category || record.eventType || record.event || record.condition || record.status || "Uncategorized").trim() || "Uncategorized";
  }

  function combined(record) {
    return text([getCategory(record), record.title, record.description, record.routeName, record.roadName, record.road, record.location, Array.isArray(record.affectedAreas) ? record.affectedAreas.join(" ") : ""].join(" "));
  }

  function route(record) {
    return text(record.routeName || record.roadName || record.road || record.highway || "");
  }

  function tokens(value) {
    return text(value).split(/\s+/).filter((token) => token.length > 1);
  }

  function tokenSimilarity(left, right) {
    const a = tokens(left);
    const b = new Set(tokens(right));
    if (!a.length || !b.size) return 0;
    const shared = a.filter((token) => b.has(token)).length;
    return shared / Math.max(a.length, b.size);
  }

  function categorySimilar(a, b) {
    const left = combined(a);
    const right = combined(b);
    const groups = [
      /flood|high water|water over|flash flood/,
      /closure|closed|blocked|restriction|lane|construction|crash/,
      /storm|tornado|wind|hail|weather|warning|watch/,
      /clear|cleared|open|reopened|resolved/
    ];
    return groups.some((pattern) => pattern.test(left) && pattern.test(right)) || tokenSimilarity(getCategory(a), getCategory(b)) >= 0.5;
  }

  function termsSimilar(a, b) {
    return tokenSimilarity([a.title, a.description].join(" "), [b.title, b.description].join(" ")) >= 0.25;
  }

  function coords(record) {
    const lat = Number(record.latitude ?? record.lat);
    const lon = Number(record.longitude ?? record.lng ?? record.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }

  function distanceKm(a, b) {
    const ca = coords(a); const cb = coords(b);
    if (!ca || !cb) return null;
    const r = 6371;
    const dLat = (cb.lat - ca.lat) * Math.PI / 180;
    const dLon = (cb.lon - ca.lon) * Math.PI / 180;
    const la1 = ca.lat * Math.PI / 180;
    const la2 = cb.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function timeRange(record) {
    const start = Date.parse(record.startTime || record.effectiveTime || record.effective || record.reportedAt || record.createdAt || record.updatedAt || "");
    const end = Date.parse(record.endTime || record.expirationTime || record.expires || record.endsAt || record.updatedAt || "");
    return { start: Number.isFinite(start) ? start : null, end: Number.isFinite(end) ? end : null };
  }

  function timeOverlaps(a, b) {
    const ta = timeRange(a); const tb = timeRange(b);
    if (ta.start == null || tb.start == null) return true;
    const ae = ta.end == null ? ta.start + 60 * 60 * 1000 : ta.end;
    const be = tb.end == null ? tb.start + 60 * 60 * 1000 : tb.end;
    return ta.start <= be && tb.start <= ae;
  }

  function routeSimilar(a, b) {
    const ra = route(a); const rb = route(b);
    return Boolean(ra && rb && tokenSimilarity(ra, rb) >= 0.5);
  }

  function near(a, b, km) {
    const d = distanceKm(a, b);
    return d == null ? false : d <= km;
  }

  function hasSignal(record, pattern) { return pattern.test(combined(record)); }
  const closure = /closure|closed|blocked|restriction|shut down/;
  const clear = /clear|cleared|open|reopened|resolved/;
  const hazard = /flood|hazard|crash|storm|tornado|warning|water over|blocked|closure|closed/;
  const weather = /flood|storm|tornado|weather|warning|watch|wind|hail/;
  const construction = /construction|maintenance|work zone/;

  function summarize(record) {
    return freeze({
      id: String(record.id || record.sourceId || ""),
      providerId: providerId(record, "unknown"),
      category: getCategory(record),
      title: String(record.title || record.description || getCategory(record)),
      routeName: String(record.routeName || record.roadName || record.road || ""),
      latitude: coords(record)?.lat ?? null,
      longitude: coords(record)?.lon ?? null
    });
  }

  function candidate(a, b, reason) {
    const d = distanceKm(a, b);
    return freeze({ records: freeze([summarize(a), summarize(b)]), reason, distanceKm: d == null ? null : Math.round(d * 100) / 100 });
  }

  function normalizeRecords(records, fallbackProvider) {
    return (Array.isArray(records) ? records : []).map(clone).filter(Boolean).map((record) => Object.assign(record, { providerId: providerId(record, fallbackProvider) })).filter((record) => PROVIDERS.includes(record.providerId));
  }

  function readCommunity() {
    const sources = [globalScope.getLiveHazardIncidents, globalScope.getCommunityReports].filter((fn) => typeof fn === "function");
    for (const fn of sources) {
      try { const records = fn(); if (Array.isArray(records)) return records; } catch (error) {}
    }
    for (const name of ["activeHazards", "unifiedRoadIncidents", "activeUnifiedIncidents", "communityReports"]) {
      if (Array.isArray(globalScope[name])) return globalScope[name];
    }
    return [];
  }

  function readConnector(name) {
    const connector = globalScope[name];
    if (!connector || typeof connector.getNormalizedRecords !== "function") return [];
    try { return connector.getNormalizedRecords(); } catch (error) { return []; }
  }

  function geographicCoverage(records) {
    const points = records.map(coords).filter(Boolean);
    const namedAreas = Array.from(new Set(records.flatMap((record) => {
      const areas = Array.isArray(record.affectedAreas) ? record.affectedAreas : [];
      return areas.concat([record.county, record.region, record.location]).filter(Boolean).map(String);
    }))).sort();
    if (!points.length) return freeze({ pointCount: 0, boundingBox: null, namedAreas: freeze(namedAreas) });
    return freeze({
      pointCount: points.length,
      boundingBox: freeze({
        minLatitude: Math.min(...points.map((point) => point.lat)),
        maxLatitude: Math.max(...points.map((point) => point.lat)),
        minLongitude: Math.min(...points.map((point) => point.lon)),
        maxLongitude: Math.max(...points.map((point) => point.lon))
      }),
      namedAreas: freeze(namedAreas)
    });
  }

  function timeCoverage(records) {
    const ranges = records.map(timeRange);
    const starts = ranges.map((range) => range.start).filter((value) => value != null);
    const ends = ranges.map((range) => range.end).filter((value) => value != null);
    const durations = ranges.map((range) => range.start != null && range.end != null ? range.end - range.start : null).filter((value) => value != null && value >= 0);
    return freeze({
      recordsWithStart: starts.length,
      recordsWithEnd: ends.length,
      earliestStart: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
      latestStart: starts.length ? new Date(Math.max(...starts)).toISOString() : null,
      earliestEnd: ends.length ? new Date(Math.min(...ends)).toISOString() : null,
      latestEnd: ends.length ? new Date(Math.max(...ends)).toISOString() : null,
      shortestDurationMinutes: durations.length ? Math.round(Math.min(...durations) / 60000) : null,
      longestDurationMinutes: durations.length ? Math.round(Math.max(...durations) / 60000) : null
    });
  }

  function inventoryFor(records, available) {
    return freeze({
      available: available === true,
      recordCount: records.length,
      categories: freeze(Array.from(new Set(records.map(getCategory))).sort()),
      normalizedModelReady: records.length === 0 ? available === true : records.every((record) => Boolean(getCategory(record) && providerId(record, ""))),
      geographicCoverage: geographicCoverage(records),
      timeCoverage: timeCoverage(records),
      rawPayloadExposed: records.some((record) => record.rawPayloadExposed === true || Object.prototype.hasOwnProperty.call(record, "properties") || Object.prototype.hasOwnProperty.call(record, "geometry"))
    });
  }

  function runtimeContainment() {
    const drive = typeof globalScope.gridlyDriveTexasConnectorRuntimeAudit === "function" ? globalScope.gridlyDriveTexasConnectorRuntimeAudit() : {};
    const wx = typeof globalScope.gridlyWeatherConnectorRuntimeAudit === "function" ? globalScope.gridlyWeatherConnectorRuntimeAudit() : {};
    const ui = typeof globalScope.gridlyUnifiedIntelligenceAudit === "function" ? globalScope.gridlyUnifiedIntelligenceAudit() : {};
    return freeze({
      driveTexasDormant: drive.providerActivated !== true && drive.renderingPerformed !== true && drive.automaticPolling !== true,
      weatherDormant: wx.providerActivated !== true && wx.renderingPerformed !== true && wx.automaticPolling !== true,
      unifiedIntelligenceInactive: ui.activated !== true && ui.enabled !== true && ui.consumerRenderingActive !== true,
      noRenderingOccurred: drive.renderingPerformed !== true && wx.renderingPerformed !== true && ui.consumerRenderingActive !== true,
      noProviderActivationOccurred: drive.providerActivated !== true && wx.providerActivated !== true,
      noAutomaticPollingOccurred: drive.automaticPolling !== true && wx.automaticPolling !== true
    });
  }

  function relationshipKey(records) {
    const ids = Array.from(new Set(records.map((record) => record.providerId))).sort();
    return ids.join(":");
  }

  function summarizeRelationships(candidates) {
    const summary = { communityDrivetexas: 0, drivetexasWeather: 0, communityWeather: 0, threeProvider: 0, representativeExamples: freeze(candidates.slice(0, 5)) };
    candidates.forEach((item) => {
      const key = relationshipKey(item.records || []);
      if (key === "community:drivetexas") summary.communityDrivetexas += 1;
      else if (key === "drivetexas:weather") summary.drivetexasWeather += 1;
      else if (key === "community:weather") summary.communityWeather += 1;
    });
    return freeze(summary);
  }

  function threeProviderRelationships(byProvider) {
    const relationships = [];
    byProvider.community.forEach((community) => byProvider.drivetexas.forEach((drive) => byProvider.weather.forEach((wx) => {
      const communityDrive = timeOverlaps(community, drive) && categorySimilar(community, drive) && (near(community, drive, PROXIMITY_KM) || routeSimilar(community, drive));
      const driveWeather = timeOverlaps(drive, wx) && categorySimilar(drive, wx) && (near(drive, wx, PROXIMITY_KM) || routeSimilar(drive, wx));
      const communityWeather = timeOverlaps(community, wx) && categorySimilar(community, wx) && (near(community, wx, PROXIMITY_KM) || routeSimilar(community, wx));
      if (communityDrive && driveWeather && communityWeather) relationships.push(freeze({ records: freeze([summarize(community), summarize(drive), summarize(wx)]), reason: "Three-provider relationship candidate based on shared time, category, and geography/route signals." }));
    })));
    return freeze(relationships);
  }

  function audit() {
    const byProvider = freeze({
      community: normalizeRecords(readCommunity(), "community"),
      drivetexas: normalizeRecords(readConnector("gridlyDriveTexasConnector"), "drivetexas"),
      weather: normalizeRecords(readConnector("gridlyWeatherConnector"), "weather")
    });
    const all = PROVIDERS.flatMap((p) => byProvider[p]);
    const overlapCandidates = [];
    const duplicateCandidates = [];
    const conflictCandidates = [];
    const complementCandidates = [];

    for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i], b = all[j];
      if (a.providerId === b.providerId) continue;
      const nearby = near(a, b, PROXIMITY_KM), routeMatch = routeSimilar(a, b), categoryMatch = categorySimilar(a, b), timeMatch = timeOverlaps(a, b);
      if (timeMatch && categoryMatch && (nearby || routeMatch)) overlapCandidates.push(candidate(a, b, "Conservative cross-provider overlap candidate; not treated as truth."));
      if (timeMatch && categoryMatch && near(a, b, DUPLICATE_PROXIMITY_KM) && routeMatch && termsSimilar(a, b)) duplicateCandidates.push(candidate(a, b, "Stronger duplicate candidate based on route, coordinates, category, time, and title/description terms."));
      if ((hasSignal(a, closure) && hasSignal(b, clear)) || (hasSignal(b, closure) && hasSignal(a, clear))) conflictCandidates.push(candidate(a, b, "Possible clear/open versus closure/restriction conflict candidate."));
      if ((a.providerId === "community" || b.providerId === "community") && ((hasSignal(a, hazard) && !nearby && !routeMatch) || (hasSignal(b, hazard) && !nearby && !routeMatch))) conflictCandidates.push(candidate(a, b, "Possible community hazard without nearby official corroboration candidate."));
      if ((hasSignal(a, weather) && hasSignal(b, closure)) || (hasSignal(b, weather) && hasSignal(a, closure))) complementCandidates.push(candidate(a, b, "Likely weather warning near DriveTexas closure complement candidate."));
      if ((a.providerId === "community" || b.providerId === "community") && categoryMatch && (nearby || routeMatch)) complementCandidates.push(candidate(a, b, "Likely community report near official provider record complement candidate."));
    }

    byProvider.drivetexas.forEach((record) => { if (hasSignal(record, construction) && !byProvider.community.some((c) => near(record, c, PROXIMITY_KM) || routeSimilar(record, c))) complementCandidates.push(freeze({ records: freeze([summarize(record)]), reason: "DriveTexas construction with no nearby community report candidate.", distanceKm: null })); });
    byProvider.weather.forEach((record) => { if (!byProvider.community.some((c) => near(record, c, PROXIMITY_KM) || categorySimilar(record, c))) complementCandidates.push(freeze({ records: freeze([summarize(record)]), reason: "Weather alert with no nearby community report candidate.", distanceKm: null })); });

    return freeze({
      auditOnly: true,
      providers: freeze({
        community: inventoryFor(byProvider.community, byProvider.community.length > 0 || typeof globalScope.getLiveHazardIncidents === "function" || Array.isArray(globalScope.activeHazards) || Array.isArray(globalScope.communityReports)),
        drivetexas: inventoryFor(byProvider.drivetexas, Boolean(globalScope.gridlyDriveTexasConnector)),
        weather: inventoryFor(byProvider.weather, Boolean(globalScope.gridlyWeatherConnector))
      }),
      overlapCandidates: freeze(overlapCandidates),
      duplicateCandidates: freeze(duplicateCandidates),
      complementCandidates: freeze(complementCandidates),
      conflictCandidates: freeze(conflictCandidates),
      relationshipAnalysis: freeze({
        overlap: summarizeRelationships(overlapCandidates),
        duplicate: summarizeRelationships(duplicateCandidates),
        complement: summarizeRelationships(complementCandidates),
        conflict: summarizeRelationships(conflictCandidates),
        threeProvider: threeProviderRelationships(byProvider)
      }),
      runtimeContainment: runtimeContainment()
    });
  }

  globalScope.gridlyCrossProviderEvaluationAudit = audit;
  if (typeof module !== "undefined" && module.exports) module.exports = audit;
})(typeof window !== "undefined" ? window : globalThis);
