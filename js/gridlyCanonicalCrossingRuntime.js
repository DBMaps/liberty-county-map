(function installGridlyCanonicalCrossingRuntime(global) {
  "use strict";
  const ASSET = "data/runtime/canonical-crossing-memberships-v1.json";
  const SOURCE_SHA256 = "2d3f409de35eded92b391cfe5525ad17ad822ded255bb7fdf5c2bf45f1dfc958";
  const state = { data: null, error: null, promise: null };
  function load() {
    if (state.promise) return state.promise;
    state.promise = fetch(ASSET, { cache: "force-cache" }).then(response => {
      if (!response.ok) throw new Error(`LP233 runtime asset unavailable (${response.status})`);
      return response.json();
    }).then(data => {
      if (data?.sourceSha256 !== SOURCE_SHA256 || !data?.places) throw new Error("LP233 runtime artifact integrity metadata mismatch");
      state.data = data;
      return data;
    }).catch(error => { state.error = String(error?.message || error); return null; });
    return state.promise;
  }
  function geoidFromIdentity(identity) {
    const direct = String(identity?.placeGeoid || identity?.communityId || "").trim();
    if (/^48\d{5}$/.test(direct)) return direct;
    const key = String(identity?.canonicalKey || identity?.key || "").trim();
    return /^place-(48\d{5})$/.exec(key)?.[1] || null;
  }
  function lookup(identity) {
    const placeGeoid = geoidFromIdentity(identity);
    if (!placeGeoid || !state.data) return null;
    const row = state.data.places[placeGeoid];
    if (!row) return null;
    return Object.freeze({ placeGeoid, canonicalKey: `place-${placeGeoid}`, canonicalCommunity: row.n, governedCountyFips: Object.freeze([...row.m]), crossingIds: Object.freeze(row.x.map(item => item[0])), crossingsBySourceCounty: Object.freeze(Object.fromEntries(Object.entries(Object.groupBy(row.x, item => item[2])).map(([county, entries]) => [county, Object.freeze(entries.map(item => item[0]))]))), certifiedCrossingCount: row.x.length, resolvedRuntimeCrossingCount: row.x.length, missingCertifiedCrossingIds: Object.freeze([]) });
  }
  global.gridlyCanonicalCrossingRuntime = Object.freeze({ assetPath: ASSET, sourceSha256: SOURCE_SHA256, load, lookup, state });
  load();
})(window);
