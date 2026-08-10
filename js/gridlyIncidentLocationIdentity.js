(function gridlyIncidentLocationIdentityModule(globalScope) {
  "use strict";

  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const read = (record, keys) => {
    const containers = [record, record?.canonicalCrossing, record?.structuredDisplayLocation, record?.gridlyStructuredMetadata, record?.raw, record?.source, record?.latestReport];
    for (const container of containers) {
      if (!container || typeof container !== "object") continue;
      for (const key of keys) {
        const value = clean(container[key]);
        if (value && !/^(?:unknown|nearby|local roadway|this (?:area|crossing)|n\/a|null|undefined)$/i.test(value)) return value;
      }
    }
    return "";
  };
  const same = (left, right) => clean(left).toLowerCase().replace(/[^a-z0-9]/g, "") === clean(right).toLowerCase().replace(/[^a-z0-9]/g, "");
  const official = (record) => /(?:drivetexas|txdot|official roadway|official_source)/i.test([
    record?.provider, record?.providerId, record?.sourceType, record?.sourceName,
    typeof record?.source === "string" ? record.source : "", record?.source?.name, record?.source?.provider
  ].map(clean).join(" "));
  const crossing = (record) => /(?:rail|train|crossing)/i.test([
    record?.type, record?.category, record?.reportType, record?.report_type, record?.title, record?.crossingId, record?.crossing_id
  ].map(clean).join(" "));

  function getGridlyIncidentLocationPresentation(record = {}) {
    if (!record || typeof record !== "object") return Object.freeze({ available: false, fullLabel: "", compactLabel: "", source: "none", precision: "none" });
    const canonicalCrossing = crossing(record) && typeof globalScope.getGridlyCanonicalCrossingLocationContext === "function"
      ? globalScope.getGridlyCanonicalCrossingLocationContext(record)
      : null;
    const input = canonicalCrossing ? { ...record, canonicalCrossing } : record;
    const canonical = read(input, ["canonicalDisplayLocation", "canonicalLocationPhrase", "authoritativeLocationLabel"]);
    const roadName = read(input, ["primaryRoad", "roadName", "road_name", "roadway", "routeName", "route", "corridor"]);
    const crossStreet = read(input, ["secondaryRoad", "crossStreet", "cross_street", "referenceRoad", "referenceRoadA", "intersectingRoad"]);
    const crossingName = read(input, ["namedCrossing", "crossingName", "crossing_name", "crossingRoadName", "crossingRoad", "name"]);
    const location = read(input, ["locationLabel", "resolvedLocationLabel", "displayLocation", "locationName", "location", "address"]);
    const locality = read(input, ["resolvedLocality", "locality", "city", "town", "placeName", "awarenessArea"]);
    const county = read(input, ["county", "countyName"]);
    let fullLabel = "";
    let source = "none";
    let precision = "none";

    if (official(input)) {
      fullLabel = canonical || location || roadName || locality || county;
      source = canonical || location ? "official-source-location" : (roadName ? "official-structured-road" : "official-context");
      precision = canonical || location ? "source-owned" : (roadName ? "road" : "locality");
    } else {
      const trustedCross = crossStreet || (crossing(input) ? crossingName : "");
      if (roadName && trustedCross && !same(roadName, trustedCross)) {
        fullLabel = `${roadName} & ${trustedCross}`;
        source = "canonical-infrastructure";
        precision = "intersection";
      } else if (canonical) {
        fullLabel = canonical;
        source = "canonical-record";
        precision = "street";
      } else if (location) {
        fullLabel = location;
        source = "structured-community-location";
        precision = "street";
      } else if (roadName && locality && !same(roadName, locality)) {
        fullLabel = `${roadName} — ${locality}`;
        source = "trusted-road-locality";
        precision = "road-locality";
      } else if (roadName || trustedCross) {
        fullLabel = roadName || trustedCross;
        source = roadName ? "trusted-road" : "canonical-crossing";
        precision = "road";
      } else if (locality || county) {
        fullLabel = locality || county;
        source = locality ? "resolved-locality" : "county-fallback";
        precision = locality ? "locality" : "county";
      }
    }

    return Object.freeze({
      available: Boolean(fullLabel), primaryLabel: fullLabel, secondaryLabel: locality && !same(locality, fullLabel) ? locality : "",
      fullLabel, compactLabel: fullLabel, roadName, crossStreet: crossStreet || (crossing(input) ? crossingName : ""),
      locality, county, source, precision, confidence: fullLabel ? "trusted-presented-data" : "unavailable"
    });
  }

  globalScope.getGridlyIncidentLocationPresentation = getGridlyIncidentLocationPresentation;
  if (typeof module !== "undefined" && module.exports) module.exports = { getGridlyIncidentLocationPresentation };
})(typeof window !== "undefined" ? window : globalThis);
