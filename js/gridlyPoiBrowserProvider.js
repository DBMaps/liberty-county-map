(function (root) {
  "use strict";

  const EXPECTED = Object.freeze({
    authorityReleaseId: "lp24111-d5-standalone-2026-08-28",
    runtimeSchemaVersion: "gridly.poi.runtime.v2",
    sourceInventorySha256: "a9d7a77b964af35fcb21ad3cd061ceb1e1a33ae4dc5091a25a119bada92cec13",
    authorityInputSha256: "6c63fc555ea4a887162541cb1a4587f9d3edb52fb70cb3e81982598b9a82f85c",
    manifestSha256: "53bdb47e180836eaede03e2cf7f2acb5ec730507a768c1bae06ba0eab0c7fa9a",
    governedCount: 391772,
    shardCount: 86
  });
  const BASE = "poi/lp24111-d5-standalone-2026-08-28/runtime-v2/";
  const RADII = new Set([5, 10, 25]);
  const CATEGORY_OPTIONS = Object.freeze(["AGRICULTURAL_SERVICE", "AIRPORT", "ATM", "AUTO_REPAIR", "BANK", "BUS_STATION", "CAMPGROUND", "CAR_WASH", "CONVENIENCE_STORE", "EMERGENCY_CARE", "EV_CHARGING", "FIRE", "FUEL", "GENERAL_RETAIL", "GOLF", "GOVERNMENT", "GROCERY", "HARDWARE", "HOSPITAL", "LAUNDRY", "LODGING", "MARINA", "PARKING", "PHARMACY", "POLICE", "POST_OFFICE", "RESTAURANT", "SCHOOL", "SHOPPING", "STORAGE", "TIRE_SERVICE", "TOWING", "TRAIN_STATION", "TRUCK_STOP", "URGENT_CARE", "VISITOR_CENTER"]);
  const ALLOWED_RECORD_FIELDS = new Set(["id", "displayName", "gridlyCategory", "latitude", "longitude", "countyContextId", "brand", "provenanceSummary"]);
  const COHORTS = Object.freeze({
    Dayton: [30.0466, -94.8852, "liberty-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4819432", placeGeoid: "4819432" }],
    Tarkington: [30.3205, -94.996, "liberty-tx", "GOVERNED_NON_PLACE", { stableGovernedIdentity: "liberty-tx:tarkington", placeGeoid: null }],
    Dallas: [32.7767, -96.797, "dallas-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4819000", placeGeoid: "4819000" }],
    Austin: [30.2672, -97.7431, "travis-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4805000", placeGeoid: "4805000" }],
    Abilene: [32.4487, -99.7331, "taylor-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4801000", placeGeoid: "4801000" }],
    Midland: [31.9973, -102.0779, "midland-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4848072", placeGeoid: "4848072" }],
    Pecos: [31.4229, -103.4932, "reeves-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4856520", placeGeoid: "4856520" }],
    "San Antonio": [29.4241, -98.4936, "bexar-tx", "CANONICAL_PLACE", { stableGovernedIdentity: "place-4865000", placeGeoid: "4865000" }],
    Terlingua: [29.321, -103.6168, "brewster-tx", "DIRECT_COORDINATE", null]
  });
  class ProviderFailure extends Error { constructor(stage, detail) { super(`${stage}: ${detail}`); this.name = "GridlyPoiProviderFailure"; this.stage = stage; } }
  const fail = (stage, detail) => { throw new ProviderFailure(stage, detail); };
  const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  const radians = value => value * Math.PI / 180;
  const distanceMiles = (a, b) => { const dLat = radians(b.latitude - a.latitude); const dLon = radians(b.longitude - a.longitude); const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2; return 3958.7613 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };
  const productionGateEnabled = () => root.GRIDLY_RUNTIME_CONFIG?.poiBrowserProvider?.enabled === "ENABLED";
  const qaOverrideEnabled = () => root.__GRIDLY_POI_NON_PRODUCTION__ === true;
  const gateEnabled = () => productionGateEnabled() || qaOverrideEnabled();
  const state = { providerInitialized: false, manifestVerified: false, candidateShardIds: [], loadedShardIds: [], cacheHitCount: 0, cacheMissCount: 0, requestedRadiusMiles: null, rawEligibleCount: 0, returnedCount: 0, zeroResult: false, lastSearchOriginType: null, requestCommunityIdentity: null, requestCountyContextId: null, attributionAvailable: false, fallbackAttempted: false, providerFailure: null };
  let manifest = null;
  let manifestPromise = null;
  const shardCache = new Map();
  const shardPromises = new Map();

  async function sha256(bytes) {
    if (!root.crypto?.subtle) fail("WEB_CRYPTO_UNAVAILABLE", "SHA-256 verification is required");
    return hex(await root.crypto.subtle.digest("SHA-256", bytes));
  }
  async function fetchBytes(url, stage) {
    let response;
    try { response = await root.fetch(url, { cache: "no-store", credentials: "same-origin" }); } catch (error) { fail(stage, error?.message || "network failure"); }
    if (!response.ok) fail(stage, `HTTP ${response.status}`);
    return response.arrayBuffer();
  }
  function validateManifest(value) {
    for (const key of ["authorityReleaseId", "runtimeSchemaVersion", "sourceInventorySha256", "authorityInputSha256"]) if (value?.[key] !== EXPECTED[key]) fail("MANIFEST_CONTRACT", key);
    if (value.shardCount !== EXPECTED.shardCount || value.shards?.length !== EXPECTED.shardCount || value.expectedGovernedPoiCount !== EXPECTED.governedCount || value.materializedGovernedPoiCount !== EXPECTED.governedCount) fail("MANIFEST_CONTRACT", "counts");
    if (value.maxCandidateShards5Mi !== 4 || value.maxCandidateShards10Mi !== 4 || value.maxCandidateShards25Mi !== 4) fail("MANIFEST_CONTRACT", "fanout");
    if (value.legalBinding?.attributionText !== "POI data sources and licenses" || value.legalBinding?.target !== "DATA_SOURCES_AND_LICENSES") fail("MANIFEST_CONTRACT", "attribution");
    const ids = new Set();
    for (const shard of value.shards) { if (!/^tx-\d{2}-\d{3}$/.test(shard.shardId) || shard.file !== `${shard.shardId}.json.gz` || !Number.isInteger(shard.byteCount) || !/^[a-f0-9]{64}$/.test(shard.sha256) || ids.has(shard.shardId)) fail("MANIFEST_CONTRACT", "shard metadata"); ids.add(shard.shardId); }
    return value;
  }
  async function initialize() {
    if (!gateEnabled()) { rollback(); fail("POI_PROVIDER_GATE_OFF", "provider is disabled"); }
    if (manifest) return manifest;
    if (!manifestPromise) manifestPromise = (async () => {
      const bytes = await fetchBytes(`${BASE}manifest.json`, "MANIFEST_FETCH");
      if (!gateEnabled()) fail("POI_PROVIDER_GATE_OFF", "provider was disabled during initialization");
      if (await sha256(bytes) !== EXPECTED.manifestSha256) fail("MANIFEST_SHA256", "certified manifest hash mismatch");
      let parsed; try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("MANIFEST_PARSE", "invalid JSON"); }
      manifest = validateManifest(parsed); state.manifestVerified = true; state.providerInitialized = true; state.attributionAvailable = true; renderSurface(); return manifest;
    })().catch(error => { manifestPromise = null; state.providerFailure = `${error.stage || "PROVIDER"}: ${error.message}`; throw error; });
    return manifestPromise;
  }
  function validateRecord(row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) fail("V2_RECORD", "record object required");
    for (const key of Object.keys(row)) if (!ALLOWED_RECORD_FIELDS.has(key)) fail("V2_RECORD", `unknown field ${key}`);
    for (const key of ["id", "displayName", "gridlyCategory", "countyContextId"]) if (typeof row[key] !== "string" || !row[key].trim()) fail("V2_RECORD", key);
    if (!Number.isFinite(row.latitude) || row.latitude < -90 || row.latitude > 90 || !Number.isFinite(row.longitude) || row.longitude < -180 || row.longitude > 180) fail("V2_RECORD", "coordinates");
    if ("communityIdentity" in row) fail("V2_RECORD", "communityIdentity belongs to request context");
    return row;
  }
  function validateRequest(request) {
    if (!RADII.has(request.radiusMiles)) fail("REQUEST", "radius must be 5, 10, or 25 miles");
    if (!Number.isFinite(request.latitude) || !Number.isFinite(request.longitude) || typeof request.countyContextId !== "string" || !request.countyContextId) fail("REQUEST", "origin or county context");
    if (request.limit !== undefined && request.limit !== 50) fail("REQUEST", "result limit is fixed at 50");
    if (request.communityIdentity && !["CANONICAL_PLACE", "GOVERNED_NON_PLACE"].includes(request.originType)) fail("REQUEST_IDENTITY", "community identity is not allowed for this origin");
    if (request.originType === "GOVERNED_NON_PLACE" && request.communityIdentity?.placeGeoid !== null) fail("REQUEST_IDENTITY", "non-place placeGeoid must be null");
  }
  function candidateShardIds(value, request) {
    const latDelta = request.radiusMiles / 69; const lonDelta = request.radiusMiles / (69 * Math.cos(radians(request.latitude))); const ids = [];
    for (let lat = Math.floor(request.latitude - latDelta); lat <= Math.floor(request.latitude + latDelta); lat++) for (let lon = Math.floor(request.longitude - lonDelta); lon <= Math.floor(request.longitude + lonDelta); lon++) ids.push(`tx-${String(lat).padStart(2, "0")}-${String(Math.abs(lon)).padStart(3, "0")}`);
    const existing = new Set(value.shards.map(shard => shard.shardId)); const selected = [...new Set(ids)].filter(id => existing.has(id)).sort();
    if (selected.length > 4) fail("SHARD_FANOUT", String(selected.length)); return selected;
  }
  async function decompress(bytes) {
    if (typeof root.DecompressionStream !== "function") fail("GZIP_UNAVAILABLE", "this browser does not support DecompressionStream('gzip')");
    try { return await new Response(new Blob([bytes]).stream().pipeThrough(new root.DecompressionStream("gzip"))).arrayBuffer(); } catch (error) { fail("GZIP_DECOMPRESSION", error?.message || "invalid gzip"); }
  }
  async function loadShard(id) {
    const value = await initialize(); const meta = value.shards.find(shard => shard.shardId === id); if (!meta) fail("SHARD_ID", id);
    const key = `${EXPECTED.authorityReleaseId}|${EXPECTED.runtimeSchemaVersion}|${EXPECTED.manifestSha256}|${id}|${meta.sha256}`;
    if (shardCache.has(key)) { state.cacheHitCount++; return shardCache.get(key); }
    if (shardPromises.has(key)) { state.cacheHitCount++; return shardPromises.get(key); }
    state.cacheMissCount++;
    const pending = (async () => { const compressed = await fetchBytes(`${BASE}${meta.file}`, "SHARD_FETCH"); if (compressed.byteLength !== meta.byteCount) fail("SHARD_BYTE_COUNT", id); if (await sha256(compressed) !== meta.sha256) fail("SHARD_SHA256", id); let payload; try { payload = JSON.parse(new TextDecoder().decode(await decompress(compressed))); } catch (error) { if (error instanceof ProviderFailure) throw error; fail("SHARD_PARSE", id); } if (payload.schemaVersion !== EXPECTED.runtimeSchemaVersion || !Array.isArray(payload.records) || payload.records.length !== meta.recordCount) fail("SHARD_CONTRACT", id); payload.records.forEach(validateRecord); shardCache.set(key, payload.records); state.loadedShardIds = [...new Set([...state.loadedShardIds, id])].sort(); return payload.records; })();
    shardPromises.set(key, pending); try { return await pending; } finally { shardPromises.delete(key); }
  }
  async function search(request) {
    if (!gateEnabled()) { rollback(); fail("POI_PROVIDER_GATE_OFF", "provider is disabled"); }
    validateRequest(request); const value = await initialize(); const candidates = candidateShardIds(value, request); state.candidateShardIds = candidates; state.requestedRadiusMiles = request.radiusMiles; state.lastSearchOriginType = request.originType || null; state.requestCommunityIdentity = request.communityIdentity || null; state.requestCountyContextId = request.countyContextId;
    const rows = (await Promise.all(candidates.map(loadShard))).flat(); const eligible = []; const seen = new Set();
    for (const row of rows) { if (request.category && row.gridlyCategory !== request.category) continue; const distance = distanceMiles(request, row); if (distance <= request.radiusMiles && !seen.has(row.id)) { seen.add(row.id); eligible.push({ ...row, distanceMiles: Number(distance.toFixed(3)) }); } }
    eligible.sort((a, b) => a.distanceMiles - b.distanceMiles || a.id.localeCompare(b.id)); const results = eligible.slice(0, 50); state.rawEligibleCount = eligible.length; state.returnedCount = results.length; state.zeroResult = results.length === 0; state.providerFailure = null;
    const result = { status: results.length ? "RESULTS" : "ZERO_RESULT", requestedRadiusMiles: request.radiusMiles, candidateShardIds: candidates, loadedShardIds: [...candidates], rawEligibleCount: eligible.length, returnedCount: results.length, results, requestContext: { originType: request.originType || null, communityIdentity: request.communityIdentity || null, countyContextId: request.countyContextId }, attribution: { text: "POI data sources and licenses", target: "DATA_SOURCES_AND_LICENSES" } }; renderResults(result); return result;
  }
  function rollback() { manifest = null; manifestPromise = null; shardCache.clear(); shardPromises.clear(); Object.assign(state, { providerInitialized: false, manifestVerified: false, candidateShardIds: [], loadedShardIds: [], cacheHitCount: 0, cacheMissCount: 0, requestedRadiusMiles: null, rawEligibleCount: 0, returnedCount: 0, zeroResult: false, lastSearchOriginType: null, requestCommunityIdentity: null, requestCountyContextId: null, attributionAvailable: false, providerFailure: null }); root.document?.getElementById("gridlyPoiNonProductionSurface")?.remove(); }
  function requestForCohort(name, radiusMiles, category) { const item = COHORTS[name]; if (!item) fail("REQUEST", "unknown acceptance location"); return { name, latitude: item[0], longitude: item[1], countyContextId: item[2], originType: item[3], communityIdentity: item[4], radiusMiles: Number(radiusMiles), category: category || undefined, limit: 50 }; }
  function assertContextRequestAgreement(context, request) {
    if (request.name !== context.label || request.originType !== context.originType || request.countyContextId !== context.countyContextId) fail("CONTEXT_AUTHORITY", "label and request authority disagree");
    const contextIdentity = context.communityIdentity || null;
    const requestIdentity = request.communityIdentity || null;
    if ((contextIdentity?.stableGovernedIdentity || null) !== (requestIdentity?.stableGovernedIdentity || null) || (contextIdentity?.placeGeoid ?? null) !== (requestIdentity?.placeGeoid ?? null)) fail("CONTEXT_AUTHORITY", "community identity and request authority disagree");
    return request;
  }
  function requestForCurrentContext(radiusMiles, category, resolvedContext) {
    const context = resolvedContext || root.gridlyGetCurrentGovernedLocationContext?.();
    if (!context) return null;
    const request = { name: context.label, latitude: Number(context.latitude), longitude: Number(context.longitude), countyContextId: context.countyContextId, originType: context.originType, communityIdentity: context.communityIdentity || undefined, radiusMiles: Number(radiusMiles), category: category || undefined, limit: 50 };
    validateRequest(request);
    return assertContextRequestAgreement(context, request);
  }
  function audit() { if (!gateEnabled() && (manifest || shardCache.size || state.providerInitialized)) rollback(); return Object.freeze({ available: true, gateEnabled: gateEnabled(), providerInitialized: state.providerInitialized, authorityReleaseId: EXPECTED.authorityReleaseId, runtimeSchemaVersion: EXPECTED.runtimeSchemaVersion, manifestVerified: state.manifestVerified, manifestSha256: EXPECTED.manifestSha256, candidateShardIds: [...state.candidateShardIds], loadedShardIds: [...state.loadedShardIds], loadedShardCount: state.loadedShardIds.length, cacheHitCount: state.cacheHitCount, cacheMissCount: state.cacheMissCount, requestedRadiusMiles: state.requestedRadiusMiles, rawEligibleCount: state.rawEligibleCount, returnedCount: state.returnedCount, zeroResult: state.zeroResult, lastSearchOriginType: state.lastSearchOriginType, requestCommunityIdentity: state.requestCommunityIdentity, requestCountyContextId: state.requestCountyContextId, attributionAvailable: state.attributionAvailable, fallbackAttempted: false, providerFailure: state.providerFailure, productionGate: productionGateEnabled() ? "ON" : "OFF", productionProviderEligible: true }); }
  function renderResults(result) { const target = root.document?.getElementById("gridlyPoiNonProductionResults"); if (!target) return; target.replaceChildren(); const status = root.document.createElement("p"); status.className = "gridly-poi-status"; status.textContent = result.status === "ZERO_RESULT" ? `No matching places within ${result.requestedRadiusMiles} miles. Radius was not widened.` : `${result.returnedCount} nearby places (${result.rawEligibleCount} eligible)`; target.append(status); for (const poi of result.results) { const item = root.document.createElement("article"); item.className = "gridly-poi-result"; const title = root.document.createElement("strong"); title.textContent = poi.displayName; const detail = root.document.createElement("span"); detail.textContent = `${poi.gridlyCategory.replaceAll("_", " ")} · ${poi.distanceMiles.toFixed(1)} mi · ${poi.countyContextId.replace("-tx", " County")}`; item.append(title, detail); target.append(item); } }
  function refreshSurfaceContext(section = root.document?.getElementById("gridlyPoiNonProductionSurface")) { if (!section) return null; const context = root.gridlyGetCurrentGovernedLocationContext?.() || null; section.querySelector("#gridlyPoiContextLabel").textContent = context ? `Nearby places around ${context.label}` : "Choose a location first to see nearby places."; section.querySelector("#gridlyPoiSearch").disabled = !context; return context; }
  function renderSurface() {
    if (!gateEnabled() || !state.manifestVerified || !root.document || root.document.getElementById("gridlyPoiNonProductionSurface")) return;
    const host = root.document.querySelector(".gridly-search-card");
    if (!host) return;
    const section = root.document.createElement("section");
    section.id = "gridlyPoiNonProductionSurface";
    section.className = "gridly-poi-nonproduction";
    section.setAttribute("aria-label", "Nearby places");
    const qaBadge = qaOverrideEnabled() && !productionGateEnabled() ? "<span>Non-production</span>" : "";
    const categories = CATEGORY_OPTIONS.map(category => `<option value="${category}">${category.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())}</option>`).join("");
    section.innerHTML = `<div class="gridly-poi-heading"><strong>Nearby places</strong>${qaBadge}</div><p id="gridlyPoiContextLabel" class="gridly-poi-context"></p><div class="gridly-poi-controls"><fieldset id="gridlyPoiRadius" class="gridly-poi-radius"><legend>Radius</legend><div class="gridly-poi-radius-segments"><label><input type="radio" name="gridlyPoiRadiusMiles" value="5" checked><span>5 mi</span></label><label><input type="radio" name="gridlyPoiRadiusMiles" value="10"><span>10 mi</span></label><label><input type="radio" name="gridlyPoiRadiusMiles" value="25"><span>25 mi</span></label></div></fieldset><label class="gridly-poi-category">Category<span class="gridly-poi-select-wrap"><select id="gridlyPoiCategory"><option value="">All categories</option>${categories}</select></span></label><button id="gridlyPoiSearch" type="button">Find places</button></div><div id="gridlyPoiNonProductionResults" class="gridly-poi-results" aria-live="polite"></div><a class="gridly-poi-attribution" href="#dataSourcesAndLicenses">POI data sources and licenses</a>`;
    host.append(section);
    refreshSurfaceContext(section);
    root.document.addEventListener("click", event => { if (section.isConnected && !section.contains(event.target)) refreshSurfaceContext(section); });
    section.addEventListener("focusin", () => refreshSurfaceContext(section));
    section.querySelector("#gridlyPoiSearch").addEventListener("click", async () => {
      const button = section.querySelector("#gridlyPoiSearch");
      const context = refreshSurfaceContext(section);
      const radius = section.querySelector('input[name="gridlyPoiRadiusMiles"]:checked')?.value;
      const request = requestForCurrentContext(radius, section.querySelector("#gridlyPoiCategory").value, context);
      if (!request) { section.querySelector("#gridlyPoiNonProductionResults").textContent = ""; return; }
      section.querySelector("#gridlyPoiContextLabel").textContent = `Nearby places around ${request.name}`;
      button.disabled = true;
      try { await search(request); } catch (error) { state.providerFailure = `${error.stage || "PROVIDER"}: ${error.message}`; section.querySelector("#gridlyPoiNonProductionResults").textContent = "Nearby places could not be loaded. No alternate source was used."; } finally { button.disabled = false; }
    });
  }
  const api = Object.freeze({ initialize, search, rollback, requestForCohort, requestForCurrentContext, audit, EXPECTED, _test: Object.freeze({ validateManifest, validateRecord, validateRequest, assertContextRequestAgreement, candidateShardIds, distanceMiles }) });
  root.GridlyPoiBrowserProvider = api; root.gridlyPoiBrowserRehearsalAudit = audit;
  if (root.document) { const automaticallyInitialize = () => { if (gateEnabled()) initialize().catch(() => {}); else rollback(); }; if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", automaticallyInitialize, { once: true }); else automaticallyInitialize(); root.addEventListener?.("pageshow", automaticallyInitialize); }
})(typeof window !== "undefined" ? window : globalThis);
