(function (global) {
  "use strict";
  const INDEX_URL = "data/generated/gridly-statewide-consumer-zip-index-v1.json";
  const OVERRIDES_URL = "data/gridly-consumer-zip-overrides-v1.json";
  let cache = null;
  let pending = null;

  function normalize(value) {
    const input = String(value ?? "").trim();
    const match = input.match(/^(\d{5})(?:-\d{4})?$/);
    return match ? match[1] : null;
  }
  async function load() {
    if (cache) return cache;
    if (!pending) pending = Promise.all([fetch(INDEX_URL), fetch(OVERRIDES_URL)]).then(async ([index, overrides]) => {
      if (!index.ok || !overrides.ok) throw new Error("statewide_zip_artifact_load_failed");
      const [indexJson, overrideJson] = await Promise.all([index.json(), overrides.json()]);
      cache = { records: new Map(indexJson.records.map((r) => [r.zip, r])), overrides: new Map(overrideJson.records.map((r) => [r.zip, r])) };
      return cache;
    }).finally(() => { pending = null; });
    return pending;
  }
  function candidate(county, override = null) {
    const communities = override ? [{ placeGeoid: override.communityKey, displayName: override.communityLabel, awarenessAreaKey: override.awarenessAreaKey }] : (county.communities || []);
    return communities.map((community) => ({ countyId: county.countyId, countyFips: county.countyFips, countyName: county.countyName, communityKey: community.placeGeoid, placeGeoid: community.placeGeoid, communityLabel: community.displayName, consumerLabel: community.displayName, awarenessAreaKey: community.awarenessAreaKey || `${county.countyId}-${community.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` }));
  }
  function resolveLoaded(value) {
    const zip = normalize(value);
    if (!zip) return { resolved: false, status: "invalid", zip: "", reason: "Enter an exact 5-digit ZIP or valid ZIP+4." };
    if (!cache) return { resolved: false, status: "artifact_loading", zip, manualFallbackAvailable: true };
    const override = cache.overrides.get(zip);
    if (override && ["po_box_not_supported", "unique_zip_not_supported"].includes(override.resolutionStatus)) return { ...override, resolved: false, status: override.resolutionStatus, zip };
    const record = cache.records.get(zip);
    if (!record) return { resolved: false, status: "unavailable", zip, reason: "ZIP is affirmatively outside the Texas HUD evidence set." };
    if (override && override.resolutionStatus !== "ambiguous") {
      const county = record.countyCandidates.find((row) => row.countyId === override.countyId) || { countyId: override.countyId, countyName: override.countyName, countyFips: null };
      return { resolved: false, status: "requires_confirmation", zip, override: true, candidates: candidate(county, override), ...override };
    }
    const candidates = record.countyCandidates.flatMap((county) => candidate(county));
    return { resolved: false, status: record.countyCandidates.length > 1 ? "ambiguous" : "requires_confirmation", zip, countySelectionRequired: record.countyCandidates.length > 1, candidates, countyCandidates: record.countyCandidates };
  }
  async function resolve(value) { try { await load(); return resolveLoaded(value); } catch (error) { return { resolved: false, status: "manual_fallback", zip: normalize(value) || "", artifactLoadFailed: true, manualFallbackAvailable: true, reason: error.message }; } }
  global.GridlyStatewideZipResolver = Object.freeze({ normalize, load, resolve, resolveLoaded, clearCacheForTest() { cache = null; pending = null; } });
})(typeof window !== "undefined" ? window : globalThis);
