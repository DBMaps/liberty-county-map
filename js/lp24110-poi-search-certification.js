(function installLp24110PoiSearchCertification(global) {
  "use strict";

  const CATEGORY_PATTERNS = Object.freeze([
    ["gas_station", /\b(?:gas|fuel|petrol)\s+(?:station|stop)\b/],
    ["hospital", /\b(?:hospital|medical center)\b/],
    ["pharmacy", /\b(?:pharmacy|chemist)\b/],
    ["restaurant", /\b(?:restaurant|food)\b/],
    ["grocery_store", /\b(?:grocery|supermarket)\s*(?:store)?\b/],
    ["hotel", /\b(?:hotel|motel|lodging)\b/],
    ["school", /\b(?:school|college|university)\b/],
    ["urgent_care", /\burgent\s+care\b/]
  ]);
  const MAX_LOCAL_DISTANCE_MILES = 75;

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function classify(query) {
    const normalized = normalize(query);
    const category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
    return Object.freeze({
      type: category ? "CATEGORY_DISCOVERY" : "NAMED_ENTITY_SEARCH",
      category,
      normalizedQuery: normalized
    });
  }

  function isLocalResult(result) {
    const distance = Number(result?.searchRank?.anchorDistanceMiles);
    return result?.searchRank?.inBounds === true || result?.searchRank?.isLocality === true
      || (Number.isFinite(distance) && distance <= MAX_LOCAL_DISTANCE_MILES);
  }

  function summarize(result, index) {
    const rank = result?.searchRank || {};
    const distance = Number(rank.anchorDistanceMiles);
    const address = result?.raw?.address || (result?.address && typeof result.address === "object" ? result.address : {});
    return Object.freeze({
      rank: Number(rank.rank) || index + 1,
      name: String(result?.title || result?.label || ""),
      latitude: Number.isFinite(Number(result?.lat)) ? Number(result.lat) : null,
      longitude: Number.isFinite(Number(result?.lng)) ? Number(result.lng) : null,
      distanceMiles: Number.isFinite(distance) ? Number(distance.toFixed(1)) : null,
      locality: String(address.city || address.town || address.village || address.hamlet || ""),
      county: String(address.county || ""),
      provider: String(result?.provider || result?.source || "unknown"),
      local: isLocalResult(result),
      destinationHandoffAvailable: Number.isFinite(Number(result?.lat)) && Number.isFinite(Number(result?.lng))
    });
  }

  function createAudit(runtime) {
    if (!runtime || typeof runtime.search !== "function" || typeof runtime.context !== "function") {
      throw new TypeError("LP241.10 requires read-only search and context adapters");
    }
    return async function gridlyLP24110PoiSearchAudit(query) {
      const queryText = String(query || "").trim();
      const intent = classify(queryText);
      const before = runtime.context();
      const results = queryText ? await runtime.search(queryText) : [];
      const after = runtime.context();
      const rankedResults = (Array.isArray(results) ? results : []).map(summarize);
      const local = rankedResults.filter((result) => result.local);
      const nearest = rankedResults.map((result) => result.distanceMiles).filter(Number.isFinite).sort((a, b) => a - b)[0] ?? null;
      const sameContext = String(before.community || "") === String(after.community || "")
        && String(before.countyId || "") === String(after.countyId || "")
        && Number(before.lat) === Number(after.lat) && Number(before.lng) === Number(after.lng);
      return Object.freeze({
        query: queryText,
        searchIntent: intent.type,
        category: intent.category,
        contextCommunity: String(before.community || ""),
        contextCountyId: String(before.countyId || ""),
        contextAnchor: Number.isFinite(Number(before.lat)) && Number.isFinite(Number(before.lng))
          ? Object.freeze({ latitude: Number(before.lat), longitude: Number(before.lng), source: String(before.source || "unknown") }) : null,
        provider: rankedResults[0]?.provider || "none",
        candidateCount: rankedResults.length,
        rankedResults,
        nearestResultDistanceMiles: nearest,
        localResultAvailable: local.length > 0,
        localityAgreement: local.some((result) => normalize(result.locality) === normalize(before.community)),
        countyAgreement: Boolean(normalize(String(before.county || "").replace(/ county$/i, "")))
          && local.some((result) => normalize(result.county).includes(normalize(String(before.county || "").replace(/ county$/i, "")))),
        staleContextDetected: !sameContext,
        destinationHandoffAvailable: rankedResults.some((result) => result.destinationHandoffAvailable),
        pass: Boolean(queryText && local.length && sameContext && rankedResults.some((result) => result.destinationHandoffAvailable))
      });
    };
  }

  global.GRIDLY_LP24110_POI_SEARCH = Object.freeze({ classify, createAudit, isLocalResult, summarize, maxLocalDistanceMiles: MAX_LOCAL_DISTANCE_MILES });
})(window);
