(function installLp097SearchGovernance(global) {
  "use strict";

  const normalize = (value) => String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const addressOf = (result) => result?.raw?.address || (result?.address && typeof result.address === "object" ? result.address : {});
  const isCurated = (result) => result?.raw?.seedSource === "lp097_governed_curated";
  const categoryFamily = (result) => {
    const text = normalize([result?.type, ...(result?.raw?.categories || [])].join(" "));
    if (/hospital|medical|clinic|emergency room|healthcare/.test(text)) return "medical";
    if (/government|city hall|courthouse|sheriff|police/.test(text)) return "government";
    if (/school|education|college/.test(text)) return "education";
    if (/library|post office|public service/.test(text)) return "public_service";
    if (/park|airport|retail|store|grocery/.test(text)) return "community";
    return text || "unknown";
  };
  const milesBetween = (a, b) => {
    if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return Infinity;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const names = (result) => new Set([result?.title, result?.label, ...(result?.raw?.aliases || [])].map(normalize).filter(Boolean));
  const nameAgreement = (a, b) => [...names(a)].some((name) => names(b).has(name));
  const field = (result, keys) => {
    const address = addressOf(result);
    return normalize(keys.map((key) => address?.[key]).find(Boolean));
  };
  const samePlace = (a, b) => {
    if (!nameAgreement(a, b) || categoryFamily(a) !== categoryFamily(b)) return null;
    const distance = milesBetween(a, b);
    const communitiesAgree = field(a, ["city", "town", "village"]) && field(a, ["city", "town", "village"]) === field(b, ["city", "town", "village"]);
    const countiesAgree = field(a, ["county"]) && field(a, ["county"]) === field(b, ["county"]);
    const postalAgree = field(a, ["postcode", "postalcode"]) && field(a, ["postcode", "postalcode"]) === field(b, ["postcode", "postalcode"]);
    const streetsAgree = field(a, ["road", "street"]) && field(a, ["road", "street"]) === field(b, ["road", "street"]);
    if (distance <= 0.25 && (communitiesAgree || countiesAgree || postalAgree)) return "canonical_or_alias+category+proximity+locality";
    if (streetsAgree && (communitiesAgree || postalAgree) && distance <= 1) return "canonical_or_alias+category+address";
    return null;
  };

  function deduplicate(results) {
    const survivors = [];
    const evidence = { candidateCountBeforeDeduplication: results.length, candidateCountAfterDeduplication: 0, duplicateGroupCount: 0, curatedOverProviderSurvivorCount: 0, unresolvedPossibleDuplicateCount: 0, duplicateReasonCodes: [] };
    for (const candidate of results) {
      const matchIndex = survivors.findIndex((existing) => samePlace(existing, candidate));
      if (matchIndex < 0) {
        const possible = survivors.some((existing) => nameAgreement(existing, candidate) && categoryFamily(existing) === categoryFamily(candidate));
        if (possible) evidence.unresolvedPossibleDuplicateCount += 1;
        survivors.push(candidate);
        continue;
      }
      const existing = survivors[matchIndex];
      const reason = samePlace(existing, candidate);
      evidence.duplicateGroupCount += 1;
      if (!evidence.duplicateReasonCodes.includes(reason)) evidence.duplicateReasonCodes.push(reason);
      if (isCurated(candidate) && !isCurated(existing)) {
        survivors[matchIndex] = candidate;
        evidence.curatedOverProviderSurvivorCount += 1;
      } else if (isCurated(existing) && !isCurated(candidate)) evidence.curatedOverProviderSurvivorCount += 1;
    }
    evidence.candidateCountAfterDeduplication = survivors.length;
    return { results: survivors, evidence };
  }

  global.GRIDLY_LP097_SEARCH_GOVERNANCE = Object.freeze({ deduplicate, samePlace, categoryFamily, normalize });
})(window);
