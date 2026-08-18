(function initGridlyDestinationSearchLocality(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GRIDLY_DESTINATION_SEARCH_LOCALITY = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGridlyDestinationSearchLocality() {
  "use strict";

  const EARTH_RADIUS_MILES = 3958.7613;
  const normalizeQuery = (value = "") => String(value).toLowerCase().trim().replace(/\s+/g, " ");
  const radians = (degrees) => degrees * Math.PI / 180;
  function distanceMiles(a, b) {
    if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return null;
    const dLat = radians(b.lat - a.lat);
    const dLng = radians(b.lng - a.lng);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }
  function textRelevance(query, candidate) {
    const needle = normalizeQuery(query);
    const title = normalizeQuery(candidate?.name || candidate?.title || candidate?.label);
    if (!needle || !title) return 0;
    if (title === needle) return 300;
    if (title.startsWith(needle)) return 260;
    if (title.includes(needle)) return 220;
    const tokens = needle.split(" ");
    return tokens.every((token) => title.includes(token)) ? 180 : tokens.some((token) => title.includes(token)) ? 80 : 0;
  }
  function rankCandidates(query, anchor, candidates = []) {
    return candidates.map((candidate, providerOrder) => {
      const distance = distanceMiles(anchor, candidate);
      const text = textRelevance(query, candidate);
      const validity = Number.isFinite(candidate?.lat) && Number.isFinite(candidate?.lng) && candidate.valid !== false ? 40 : -500;
      const sourceConfidence = Math.max(0, Math.min(50, Number(candidate.sourceConfidence) || 25));
      const locality = distance === null ? -120 : Math.max(-120, 150 - distance * 3);
      return { ...candidate, audit: { textRelevance: text, distanceMiles: distance, validity, sourceConfidence, locality, score: text + validity + sourceConfidence + locality, providerOrder } };
    }).sort((a, b) => b.audit.score - a.audit.score || (a.audit.distanceMiles ?? Infinity) - (b.audit.distanceMiles ?? Infinity) || a.audit.providerOrder - b.audit.providerOrder)
      .map((candidate, index) => ({ ...candidate, audit: { ...candidate.audit, finalRank: index + 1 } }));
  }
  function contextCacheKey(query, context = {}) {
    return [normalizeQuery(query), context.canonicalCommunityKey || context.placeGeoid || "no-community", Number(context.lat).toFixed(5), Number(context.lng).toFixed(5), context.mode || "area"].join("|");
  }
  function resolveCanonicalAnchor(area, resolvePresentation) {
    if (!area || area.countyWide === true || area.fallback === true) return null;
    const geoid = String(area.placeGeoid || area.communityId || "").trim();
    const keyMatch = /^place-(48\d{5})$/.exec(String(area.canonicalKey || area.key || "").trim());
    const placeGeoid = keyMatch?.[1] || (/^48\d{5}$/.test(geoid) ? geoid : "");
    if (!placeGeoid || (keyMatch && geoid && geoid !== placeGeoid)) return null;
    const focus = resolvePresentation?.({ canonicalKey: `place-${placeGeoid}`, placeGeoid });
    if (![focus?.lat, focus?.lng].every(Number.isFinite)) return Object.freeze({
      label: area.label || area.consumerLabel || area.displayName || "",
      canonicalCommunityKey: `place-${placeGeoid}`, placeGeoid,
      lat: null, lng: null, source: "canonical_place_presentation_unavailable",
      geographicAuthority: null, failure: "CANONICAL_PLACE_PRESENTATION_COORDINATES_UNAVAILABLE"
    });
    return Object.freeze({
      label: area.label || area.consumerLabel || area.displayName || "",
      canonicalCommunityKey: `place-${placeGeoid}`, placeGeoid,
      lat: focus.lat, lng: focus.lng, source: "canonical_place_presentation",
      geographicAuthority: focus.authority || "canonical_place_presentation",
      anchorSource: focus.provenance || "LP201 / canonical PLACE presentation authority",
      radiusMiles: Number.isFinite(focus.radiusMiles) ? focus.radiusMiles : null
    });
  }
  function proximityViewbox(anchor, radiusMiles = 30) {
    if (![anchor?.lat, anchor?.lng].every(Number.isFinite)) return null;
    const radius = Math.max(5, Number(radiusMiles) || 30);
    const latDelta = radius / 69;
    const lngDelta = radius / (69 * Math.max(0.2, Math.cos(radians(anchor.lat))));
    return [anchor.lng - lngDelta, anchor.lat + latDelta, anchor.lng + lngDelta, anchor.lat - latDelta].map((n) => Number(n.toFixed(6)));
  }
  function buildProviderRequestPlan(query, anchor, options = {}) {
    const normalized = String(query || "").trim();
    if (!normalized || ![anchor?.lat, anchor?.lng].every(Number.isFinite)) return [];
    const local = `${normalized} near ${anchor.label} Texas`;
    const regionalBox = proximityViewbox(anchor, options.radiusMiles || Math.max(30, Number(anchor.radiusMiles || 0) * 4));
    return [
      { variant: "canonical_local", query: local, locality: anchor.label, lat: anchor.lat, lng: anchor.lng, viewbox: regionalBox, bounded: false, countryCodes: "us", state: "Texas", county: null },
      { variant: "nearby_regional", query: normalized, locality: anchor.label, lat: anchor.lat, lng: anchor.lng, viewbox: regionalBox, bounded: false, countryCodes: "us", state: "Texas", county: null },
      { variant: "texas_fallback", query: `${normalized} Texas`, locality: null, lat: null, lng: null, viewbox: null, bounded: false, countryCodes: "us", state: "Texas", county: null }
    ];
  }
  return { normalizeQuery, distanceMiles, textRelevance, rankCandidates, contextCacheKey, resolveCanonicalAnchor, proximityViewbox, buildProviderRequestPlan };
});
