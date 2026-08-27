(function initGridlyWeatherLiveConnector(globalScope) {
  "use strict";
  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_ID = "weather";
  const PROVIDER_NAME = "Weather";
  // Retained for diagnostics/future discovery; selected-area authority never uses it.
  const DEFAULT_ENDPOINT = "https://api.weather.gov/alerts/active?area=TX";
  const POINT_ENDPOINT = "https://api.weather.gov/alerts/active?point={lat},{lng}";
  const TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 2;
  const REFRESH_INTERVAL_MS = 120000;
  const CACHE_MAX = 8;
  const state = { connected:false, networkingAvailable:typeof globalScope.fetch === "function", automaticPolling:false, providerActivated:false, authorityReady:false, authorityWaitReason:null, normalizedRecordCount:0, lastFetchSucceeded:false, lastError:null, lastRequestAt:null, lastSuccessAt:null, lastFailureAt:null, refreshIntervalMs:REFRESH_INTERVAL_MS, pointRequestIdentity:null, pointEndpoint:null, pointResponseValid:false, staleResponseSuppressedCount:0 };
  const cache = new Map();
  let normalizedRecords = [];
  let fetchInFlight = null;
  let currentIdentity = null;
  let generation = 0;
  let refreshTimer = null;

  const freeze = (value) => value && typeof value === "object" ? Object.freeze(value) : value;
  const clone = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; } };
  const iso = () => new Date().toISOString();
  function resolvePoint() { try { return globalScope.gridlyResolveGovernedWeatherPoint?.() || null; } catch (_) { return null; } }
  // This is the network boundary for the canonical NWS point contract. Zero is
  // valid for either axis independently; only the unresolved sentinel pair is
  // rejected.
  function validGovernedPoint(point) {
    const lat = point?.lat;
    const lng = point?.lng;
    return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
      && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180
      && !(lat === 0 && lng === 0);
  }
  function identity(point) { return point ? `${point.stableIdentity}|${point.awarenessKey}|${point.lat},${point.lng}` : null; }
  function endpoint(point) { return POINT_ENDPOINT.replace("{lat}", encodeURIComponent(String(point.lat))).replace("{lng}", encodeURIComponent(String(point.lng))); }
  function provider() { return globalScope.gridlyWeatherProvider || globalScope.gridlyIntelligenceProviders?.[PROVIDER_ID] || null; }
  function validPayload(payload) { return Boolean(payload && payload.type === "FeatureCollection" && Array.isArray(payload.features)); }
  function currentRecords(records) {
    const now = Date.now();
    return records.filter((record) => {
      const status = String(record.status || "Actual").toLowerCase();
      const message = String(record.messageType || "Alert").toLowerCase();
      const effective = Date.parse(record.effectiveTime || record.onsetTime || "");
      const expires = Date.parse(record.expirationTime || record.endTime || "");
      return status !== "test" && status !== "draft" && message !== "cancel" && (!Number.isFinite(effective) || effective <= now) && (!Number.isFinite(expires) || expires > now);
    });
  }
  function notify(reason) {
    try { globalScope.gridlyOfficialProviderConsumerRefresh?.({ providerId:PROVIDER_ID, reason, evidenceChanged:true }); } catch (_) {}
  }
  async function requestPayload(url) {
    if (typeof globalScope.fetch !== "function") throw new Error("Weather connector fetch is unavailable");
    let last;
    for (let attempt=0; attempt<MAX_ATTEMPTS; attempt+=1) {
      const controller = typeof globalScope.AbortController === "function" ? new globalScope.AbortController() : null;
      const timer = controller && typeof globalScope.setTimeout === "function" ? globalScope.setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
      try {
        const response = await globalScope.fetch(url, { method:"GET", cache:"no-store", headers:{ Accept:"application/geo+json, application/json" }, signal:controller?.signal });
        if (!response?.ok) { const error = new Error(`Weather connector request failed: ${response?.status || "unknown"}`); error.status=Number(response?.status)||0; throw error; }
        return await response.json();
      } catch (error) {
        last=error; const transient = error?.name === "AbortError" || error instanceof TypeError || error?.status === 408 || error?.status === 429 || error?.status >= 500;
        if (!transient || attempt === MAX_ATTEMPTS-1) throw error;
      } finally { if (timer != null) globalScope.clearTimeout?.(timer); }
    }
    throw last;
  }
  function publish(entry, requestGeneration) {
    const live = resolvePoint();
    if (requestGeneration !== generation || identity(live) !== entry.requestIdentity) { state.staleResponseSuppressedCount += 1; return false; }
    currentIdentity = entry.requestIdentity;
    normalizedRecords = entry.records.map(clone).filter(Boolean);
    state.connected=entry.succeeded && entry.valid; state.authorityReady=true; state.authorityWaitReason=null; state.lastFetchSucceeded=entry.succeeded; state.lastError=entry.error; state.lastSuccessAt=entry.succeeded ? entry.fetchedAt : state.lastSuccessAt; state.lastFailureAt=entry.succeeded ? state.lastFailureAt : entry.fetchedAt; state.normalizedRecordCount=normalizedRecords.length; state.pointRequestIdentity=entry.requestIdentity; state.pointEndpoint=entry.endpoint; state.pointResponseValid=entry.valid;
    notify(entry.succeeded ? "weather-point-fetch-success" : "weather-point-fetch-failure");
    return true;
  }
  function invalidateCurrentAuthority(nextIdentity, nextPoint) {
    if (currentIdentity === nextIdentity || (currentIdentity === null && state.pointRequestIdentity === nextIdentity && state.pointResponseValid === false)) return;
    currentIdentity = null;
    normalizedRecords = [];
    state.connected = false;
    state.lastFetchSucceeded = false;
    state.lastError = null;
    state.normalizedRecordCount = 0;
    state.pointRequestIdentity = nextIdentity;
    state.pointEndpoint = nextPoint ? endpoint(nextPoint) : null;
    state.pointResponseValid = false;
    notify("weather-point-identity-transition");
  }
  async function fetchPoint(point, requestGeneration) {
    const requestIdentity=identity(point), url=endpoint(point); state.lastRequestAt=iso(); state.pointRequestIdentity=requestIdentity; state.pointEndpoint=url;
    try {
      const payload=await requestPayload(url);
      if (!validPayload(payload)) throw new Error("Weather connector schema validation failed");
      const normalizer=provider()?.normalizeRecords;
      if (typeof normalizer !== "function") throw new Error("Weather provider normalizer unavailable");
      const records=currentRecords(normalizer(payload).map(clone).filter(Boolean));
      const entry={ requestIdentity, point, endpoint:url, attempted:true, succeeded:true, valid:true, fetchedAt:iso(), records, error:null };
      cache.delete(requestIdentity); cache.set(requestIdentity,entry); while(cache.size>CACHE_MAX) cache.delete(cache.keys().next().value);
      publish(entry,requestGeneration); return freeze({ connected:true, normalizedRecordCount:records.length, requestIdentity });
    } catch(error) {
      const entry={ requestIdentity, point, endpoint:url, attempted:true, succeeded:false, valid:false, fetchedAt:iso(), records:[], error:error?.message||String(error) };
      publish(entry,requestGeneration); return freeze({ connected:false, normalizedRecordCount:0, error:entry.error, requestIdentity });
    }
  }
  function fetchNow() {
    state.providerActivated = true;
    const point=resolvePoint(); const nextIdentity=identity(point);
    if (!validGovernedPoint(point)) {
      generation+=1;
      state.authorityReady=false;
      state.authorityWaitReason="WAITING_FOR_AUTHORITY";
      return Promise.resolve(freeze({connected:false,notReady:true,reason:state.authorityWaitReason}));
    }
    state.authorityReady=true; state.authorityWaitReason=null;
    if (fetchInFlight?.identity === nextIdentity) return fetchInFlight.promise;
    invalidateCurrentAuthority(nextIdentity, point);
    const requestGeneration=++generation;
    const promise=fetchPoint(point,requestGeneration).finally(() => { if(fetchInFlight?.promise===promise) fetchInFlight=null; });
    fetchInFlight={identity:nextIdentity,promise}; return promise;
  }
  function refreshAwarenessView() {
    const point=resolvePoint(), next=identity(point), cached=next ? cache.get(next) : null;
    if (!validGovernedPoint(point)) return fetchNow();
    if (fetchInFlight?.identity === next) return fetchInFlight.promise;
    generation+=1;
    invalidateCurrentAuthority(next, point);
    if (cached && Date.now()-Date.parse(cached.fetchedAt)<=REFRESH_INTERVAL_MS) { publish(cached,generation); return Promise.resolve(freeze({connected:true,cached:true,normalizedRecordCount:cached.records.length})); }
    return fetchNow();
  }
  function startPolling() { state.automaticPolling=true; const tick=async()=>{await fetchNow(); if(state.automaticPolling) refreshTimer=globalScope.setTimeout(tick,REFRESH_INTERVAL_MS);}; tick(); return runtimeAudit(); }
  function stopPolling(){state.automaticPolling=false;if(refreshTimer!=null)globalScope.clearTimeout?.(refreshTimer);refreshTimer=null;return runtimeAudit();}
  function getNormalizedRecords(){return freeze(normalizedRecords.map(clone).filter(Boolean));}
  function runtimeAudit(){const selectedPoint=resolvePoint();const selectedIdentity=identity(selectedPoint);const entry=currentIdentity&&currentIdentity===selectedIdentity?cache.get(currentIdentity):null;const age=entry?Date.now()-Date.parse(entry.fetchedAt):Infinity;if(state.providerActivated!==true)return freeze({connected:false,networkingAvailable:typeof globalScope.fetch === "function",automaticPolling:false,providerActivated:false,renderingPerformed:false,normalizedRecordCount:0,requestAttempted:false,requestSucceeded:false,lastRequestAt:null,lastSuccessAt:null,lastFailureAt:null,lastError:null,refreshIntervalMs:REFRESH_INTERVAL_MS});return freeze({ ...state, applicabilityMode:"NWS_POINT_QUERY", statewideDiagnosticEndpoint:DEFAULT_ENDPOINT, pointAlertEndpoint:state.pointEndpoint, requestAttempted:Boolean(entry?.attempted), requestSucceeded:Boolean(entry?.succeeded), responseValid:Boolean(entry?.valid), fetchedAt:entry?.fetchedAt||null, freshEnough:Boolean(entry?.succeeded&&entry?.valid&&age>=0&&age<=REFRESH_INTERVAL_MS), pointActiveAlertCount:entry?.records?.length||0, pointActiveAlertIds:freeze((entry?.records||[]).map(r=>r.id)), currentAwarenessIdentity:selectedIdentity, responseIdentity:entry?.requestIdentity||null, selectedPoint, cacheSize:cache.size });}
  globalScope.gridlyWeatherConnector=freeze({providerId:PROVIDER_ID,providerName:PROVIDER_NAME,timeoutMs:TIMEOUT_MS,maxAttempts:MAX_ATTEMPTS,refreshIntervalMs:REFRESH_INTERVAL_MS,fetchNow,refreshAwarenessView,startPolling,stopPolling,getNormalizedRecords});
  globalScope.gridlyWeatherConnectorRuntimeAudit=runtimeAudit;
  if(typeof module!=="undefined"&&module.exports)module.exports=globalScope.gridlyWeatherConnector;
})(typeof window!=="undefined"?window:globalThis);
