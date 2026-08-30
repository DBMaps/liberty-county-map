/* Governed, provider-neutral official-roadway marker publication contract. */
(function gridlyOfficialRoadwayMarkerPublication(globalScope) {
  "use strict";

  const OUTCOME = Object.freeze({
    RENDERED: "RENDERED",
    GOVERNED_AGGREGATED: "GOVERNED_AGGREGATED",
    EXPLICITLY_SUPPRESSED_BY_CONTRACT: "EXPLICITLY_SUPPRESSED_BY_CONTRACT",
    SILENTLY_DROPPED: "SILENTLY_DROPPED"
  });

  const text = value => String(value ?? "").trim();
  function identity(record = {}, index = 0) {
    const raw = text(record.consumerSituationId || record.authorityIdentity || record.sourceProviderRecordId || record.providerId || record.id || `record-${index}`);
    return raw.startsWith("drivetexas:") ? raw : `drivetexas:${raw}`;
  }
  function validPair(pair) {
    const lng = Number(pair?.[0]);
    const lat = Number(pair?.[1]);
    return Array.isArray(pair) && pair.length >= 2 && Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && lat !== 0 && lng !== 0;
  }
  function validatedGeometryPairs(geometry) {
    if (geometry?.type === "Point") return validPair(geometry.coordinates) ? [geometry.coordinates] : [];
    if (geometry?.type === "LineString") {
      return Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2 && geometry.coordinates.every(validPair)
        ? geometry.coordinates : [];
    }
    if (geometry?.type === "MultiLineString") {
      if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length
        || !geometry.coordinates.every(line => Array.isArray(line) && line.length >= 2 && line.every(validPair))) return [];
      return geometry.coordinates.flat();
    }
    return [];
  }
  function coordinate(record = {}) {
    const source = record.sourceCoordinates || {};
    const lat = Number(source.latitude ?? source.lat ?? record.latitude ?? record.lat);
    const lng = Number(source.longitude ?? source.lng ?? source.lon ?? record.longitude ?? record.lng ?? record.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && lat !== 0 && lng !== 0) {
      return Object.freeze({ lat, lng });
    }
    const geometry = record.sourceGeometry || record.geometry;
    const pairs = validatedGeometryPairs(geometry);
    const pair = pairs?.[Math.floor((pairs?.length || 0) / 2)];
    const geometryLat = Number(pair?.[1]);
    const geometryLng = Number(pair?.[0]);
    return Number.isFinite(geometryLat) && Number.isFinite(geometryLng)
      ? Object.freeze({ lat: geometryLat, lng: geometryLng }) : null;
  }
  function build(records = [], options = {}) {
    const canonicalKey = text(options.canonicalKey);
    const seen = new Map();
    return Object.freeze((Array.isArray(records) ? records : []).map((record, index) => {
      const consumerSituationId = identity(record, index);
      const markerCoordinate = coordinate(record);
      const markerModelIdentity = consumerSituationId;
      const duplicateOf = seen.get(markerModelIdentity) || null;
      if (!duplicateOf) seen.set(markerModelIdentity, markerModelIdentity);
      const eligible = Boolean(markerCoordinate && markerModelIdentity);
      return Object.freeze({
        consumerSituationId,
        category: text(record.category || "Travel Advisory"),
        sourceOwnership: "OFFICIAL_ROADWAY",
        canonicalKey,
        markerCoordinate,
        markerPublicationEligible: eligible && !duplicateOf,
        suppressionReason: !markerCoordinate ? "MISSING_GOVERNED_PRESENTATION_COORDINATE" : duplicateOf ? "DUPLICATE_CONSUMER_SITUATION_ID" : null,
        markerModelIdentity,
        aggregationIdentity: duplicateOf,
        representedConsumerSituationIds: Object.freeze([consumerSituationId]),
        outcome: !markerCoordinate ? OUTCOME.EXPLICITLY_SUPPRESSED_BY_CONTRACT : duplicateOf ? OUTCOME.GOVERNED_AGGREGATED : null,
        record
      });
    }));
  }
  function reconcile(models = [], renderedIdentities = []) {
    const rendered = new Set(renderedIdentities.map(text));
    return Object.freeze(models.map(model => Object.freeze({
      ...model,
      outcome: model.outcome || (rendered.has(model.markerModelIdentity) ? OUTCOME.RENDERED : OUTCOME.SILENTLY_DROPPED),
      renderedMarkerIdentity: rendered.has(model.markerModelIdentity) ? model.markerModelIdentity : null
    })));
  }

  const api = Object.freeze({ OUTCOME, identity, coordinate, build, reconcile });
  globalScope.gridlyOfficialRoadwayMarkerPublication = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
