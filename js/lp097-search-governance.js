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
  const names = (result) => new Set([
    result?.title, result?.label, result?.raw?.name, result?.raw?.display_name,
    result?.raw?.namedetails?.name, ...(result?.raw?.aliases || [])
  ].map(normalize).filter(Boolean));
  const nameAgreement = (a, b) => [...names(a)].some((left) => [...names(b)].some((right) => left === right || (left.length >= 12 && (left.includes(right) || right.includes(left)))));
  const GENERIC_MEDICAL_TOKENS = new Set(["medical", "hospital", "regional", "center", "centre", "clinic", "health", "healthcare", "the"]);
  const distinctiveTokens = (result) => new Set([...names(result)].flatMap((name) => name.split(" ")).filter((token) => token.length > 2 && !GENERIC_MEDICAL_TOKENS.has(token)));
  const distinctiveNameAgreement = (a, b) => {
    const left = distinctiveTokens(a);
    const right = distinctiveTokens(b);
    const overlap = [...left].filter((token) => right.has(token));
    return overlap.length >= 2 && overlap.length >= Math.min(left.size, right.size, 3);
  };
  const field = (result, keys) => {
    const address = addressOf(result);
    return normalize(keys.map((key) => address?.[key]).find(Boolean));
  };
  const samePlace = (a, b) => {
    if (categoryFamily(a) !== categoryFamily(b)) return null;
    const departmentPattern = /\b(department|cardiology|radiology|pharmacy|laboratory|imaging|surgery|pediatrics)\b/;
    if ([...names(a)].some((name) => departmentPattern.test(name)) !== [...names(b)].some((name) => departmentPattern.test(name))) return null;
    const aliasIdentity = nameAgreement(a, b);
    const governedMedicalIdentity = categoryFamily(a) === "medical" && (isCurated(a) || isCurated(b)) && distinctiveNameAgreement(a, b);
    if (!aliasIdentity && !governedMedicalIdentity) return null;
    const distance = milesBetween(a, b);
    const communitiesAgree = field(a, ["city", "town", "village"]) && field(a, ["city", "town", "village"]) === field(b, ["city", "town", "village"]);
    const countiesAgree = field(a, ["county"]) && field(a, ["county"]) === field(b, ["county"]);
    const postalAgree = field(a, ["postcode", "postalcode"]) && field(a, ["postcode", "postalcode"]) === field(b, ["postcode", "postalcode"]);
    const streetsAgree = field(a, ["road", "street"]) && field(a, ["road", "street"]) === field(b, ["road", "street"]);
    if (aliasIdentity && distance <= 0.25 && (communitiesAgree || countiesAgree || postalAgree)) return "confirmed_alias_identity";
    if (governedMedicalIdentity && communitiesAgree && (countiesAgree || postalAgree) && distance <= 2) return "confirmed_name_locality_identity";
    if (governedMedicalIdentity && distance <= 1) return "confirmed_name_coordinate_identity";
    if (aliasIdentity && streetsAgree && (communitiesAgree || postalAgree) && distance <= 1) return "confirmed_alias_identity";
    return null;
  };

  const comparable = (value) => {
    const normalized = normalize(value).replace(/\bcounty\b/g, "").trim();
    return ({ tx: "texas", oh: "ohio", co: "colorado" })[normalized] || normalized;
  };
  function evaluateAddressExactness(model = {}, result = {}, options = {}) {
    const address = addressOf(result);
    const reasons = [];
    const resultValue = (keys) => keys.map((key) => address?.[key]).find(Boolean) || "";
    const expected = model.expectedGeography || {};
    const explicit = model.explicitGeography || {};
    const resultHouse = normalize(resultValue(["house_number", "housenumber"]));
    const resultRoad = normalize(resultValue(["road", "residential", "pedestrian", "street"]));
    const queryRoad = normalize(String(model.street || "").replace(/^\s*\d{1,6}[a-z]?\s*/i, ""));
    if (!model.houseNumber || !resultHouse || normalize(model.houseNumber) !== resultHouse) reasons.push("house_number_mismatch");
    if (!queryRoad || !resultRoad || !(resultRoad.includes(queryRoad) || queryRoad.includes(resultRoad))) reasons.push("street_mismatch");
    const compare = (key, resultKeys, reason) => {
      const wanted = comparable(explicit[key] || expected[key]);
      const actual = comparable(resultValue(resultKeys));
      if (wanted && actual && wanted !== actual) reasons.push(reason);
      else if (wanted && !actual) reasons.push("insufficient_exactness_evidence");
    };
    compare("state", ["state", "state_code"], "state_mismatch");
    compare("city", ["city", "town", "village", "hamlet", "municipality"], explicit.city ? "city_conflict" : "enriched_locality_conflict");
    compare("county", ["county"], explicit.county ? "county_conflict" : "enriched_locality_conflict");
    compare("postalCode", ["postcode", "postalcode"], "postal_code_conflict");
    const maxMiles = Number(options.maxExpectedDistanceMiles || 100);
    if (!model.explicitOutOfArea && model.expectedCenter && milesBetween(model.expectedCenter, result) > maxMiles) reasons.push("outside_expected_geography");
    const uniqueReasons = [...new Set(reasons)];
    return { exact: uniqueReasons.length === 0, reasons: uniqueReasons, houseAgreement: !uniqueReasons.includes("house_number_mismatch"), roadAgreement: !uniqueReasons.includes("street_mismatch") };
  }

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

  global.GRIDLY_LP097_SEARCH_GOVERNANCE = Object.freeze({ deduplicate, samePlace, categoryFamily, normalize, evaluateAddressExactness });
})(window);
