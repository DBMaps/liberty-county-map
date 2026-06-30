(function initGridlyUnifiedIntelligenceSimulation(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const SUPPORTED_PROVIDERS = Object.freeze(["community", "drivetexas", "weather"]);
  const CONSUMER_RENDERING_PERFORMED = false;

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

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function compact(values) {
    return values.map((value) => String(value || "").trim()).filter(Boolean);
  }

  function unique(values) {
    return freeze(Array.from(new Set(compact(values))));
  }

  function providerId(record) {
    return normalizeText(record.providerId || record.provider).replace(/\s+/g, "");
  }

  function combinedText(record) {
    return normalizeText([
      record.category,
      record.condition,
      record.status,
      record.title,
      record.description,
      record.routeName,
      record.roadName,
      record.location,
      Array.isArray(record.affectedAreas) ? record.affectedAreas.join(" ") : ""
    ].join(" "));
  }

  function routeText(record) {
    return normalizeText(record.routeName || record.roadName || record.road || record.highway || record.location || record.title || record.description);
  }

  function hasFloodSignal(record) {
    return /\bflood|high water|water over|flash flood/.test(combinedText(record));
  }

  function hasClosureSignal(record) {
    return /\bclosed\b|closure|road closed|blocked|shut down/.test(combinedText(record));
  }

  function hasClearSignal(record) {
    return /\bclear\b|cleared|open|reopened|normal/.test(combinedText(record));
  }

  function hasRouteRelationship(a, b) {
    const left = routeText(a);
    const right = routeText(b);
    if (!left || !right) return false;
    const leftTokens = left.split(/\s+/).filter((token) => token.length > 1);
    const rightTokens = new Set(right.split(/\s+/).filter((token) => token.length > 1));
    return leftTokens.some((token) => rightTokens.has(token));
  }

  function isNormalizedRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    if (record.rawPayloadExposed === true) return false;
    if (Object.prototype.hasOwnProperty.call(record, "properties")) return false;
    if (Object.prototype.hasOwnProperty.call(record, "geometry")) return false;
    const id = providerId(record);
    return SUPPORTED_PROVIDERS.includes(id) && Boolean(record.category || record.title || record.description || record.condition || record.status);
  }

  function recordSummary(record) {
    return freeze({
      id: String(record.id || ""),
      providerId: providerId(record),
      category: String(record.category || record.condition || record.status || "Uncategorized"),
      title: String(record.title || record.description || record.category || "Simulated observation")
    });
  }

  function relationship(a, b, reason) {
    return freeze({
      records: freeze([recordSummary(a), recordSummary(b)]),
      reason
    });
  }

  function evaluate(records) {
    const normalizedRecords = Array.isArray(records) ? records.map(clone).filter(isNormalizedRecord) : [];
    const duplicateCandidates = [];
    const conflictingConditions = [];
    const overlappingConditions = [];

    for (let i = 0; i < normalizedRecords.length; i += 1) {
      for (let j = i + 1; j < normalizedRecords.length; j += 1) {
        const a = normalizedRecords[i];
        const b = normalizedRecords[j];
        const sameProvider = providerId(a) === providerId(b);
        const relatedRoute = hasRouteRelationship(a, b);
        const sharedFlood = hasFloodSignal(a) && hasFloodSignal(b);
        const closureVsClear = (hasClosureSignal(a) && hasClearSignal(b)) || (hasClosureSignal(b) && hasClearSignal(a));
        if (!sameProvider && relatedRoute && sharedFlood) {
          duplicateCandidates.push(relationship(a, b, "Different providers describe related flooding awareness on the same route or area."));
        }
        if (!sameProvider && closureVsClear && relatedRoute) {
          conflictingConditions.push(relationship(a, b, "Different providers describe clear/open and closed/blocked conditions for the same route or area."));
        }
        if (!sameProvider && (sharedFlood || (hasFloodSignal(a) && hasClosureSignal(b)) || (hasFloodSignal(b) && hasClosureSignal(a)))) {
          overlappingConditions.push(relationship(a, b, "Provider observations overlap as flood, warning, or closure awareness."));
        }
      }
    }

    return freeze({
      simulatedRecordCount: normalizedRecords.length,
      providersRepresented: unique(normalizedRecords.map(providerId)),
      categoriesRepresented: unique(normalizedRecords.map((record) => record.category || record.condition || record.status || "Uncategorized")),
      duplicateCandidates: freeze(duplicateCandidates),
      conflictingConditions: freeze(conflictingConditions),
      overlappingConditions: freeze(overlappingConditions),
      observations: freeze(normalizedRecords.map(recordSummary)),
      consumerRenderingPerformed: CONSUMER_RENDERING_PERFORMED
    });
  }

  function runSampleScenario() {
    return evaluate([
      { id: "sample-community-flood-us90", providerId: "community", provider: "Community", category: "Flooding", title: "Flooding on US 90", description: "Community flooding report on US 90", routeName: "US 90", rawPayloadExposed: false },
      { id: "sample-drivetexas-closure-us90", providerId: "drivetexas", provider: "DriveTexas", category: "Road Closure", title: "Road Closed due to Flooding on US 90", description: "Road closed due to flooding", routeName: "US 90", rawPayloadExposed: false },
      { id: "sample-weather-flash-flood", providerId: "weather", provider: "Weather", category: "Flash Flood Warning", title: "Flash Flood Warning", description: "Flash Flood Warning affecting Liberty County and US 90 corridor", affectedAreas: ["Liberty County"], rawPayloadExposed: false }
    ]);
  }

  const api = freeze({ evaluate, runSampleScenario });
  globalScope.gridlyUnifiedIntelligenceSimulation = api;
  globalScope.gridlyUnifiedSimulationAudit = function gridlyUnifiedSimulationAudit() {
    return freeze({
      simulationAvailable: Boolean(globalScope.gridlyUnifiedIntelligenceSimulation),
      providerSupport: freeze({ community: true, drivetexas: true, weather: true }),
      consumerRenderingPerformed: CONSUMER_RENDERING_PERFORMED,
      safeIsolation: true,
      readsLiveState: false,
      writesLiveState: false,
      readyForPresentationDesign: true
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
