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
  return { normalizeQuery, distanceMiles, textRelevance, rankCandidates, contextCacheKey };
});
