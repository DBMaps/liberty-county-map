(function initGridlyWeatherLiveConnector(globalScope) {
  "use strict";
  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_ID = "weather";
  const PROVIDER_NAME = "Weather";
  // Retained for diagnostics/future discovery; selected-area authority never uses it.
  const DEFAULT_ENDPOINT = "https://api.weather.gov/alerts/active?area=TX";
  const POINT_ENDPOINT = "https://api.weather.gov/alerts/active?point={lat},{lng}";
  const POINTS_LOOKUP_ENDPOINT = "https://api.weather.gov/points/{lat},{lng}";
  const TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 2;
  const REFRESH_INTERVAL_MS = 120000;
  const CACHE_MAX = 8;
  const state = { connected:false, networkingAvailable:typeof globalScope.fetch === "function", automaticPolling:false, providerActivated:false, authorityReady:false, authorityWaitReason:null, normalizedRecordCount:0, lastFetchSucceeded:false, lastError:null, lastRequestAt:null, lastSuccessAt:null, lastFailureAt:null, refreshIntervalMs:REFRESH_INTERVAL_MS, pointRequestIdentity:null, pointEndpoint:null, pointResponseValid:false, pointsLookupEndpoint:null, pointsRequestAttempted:false, pointsRequestSucceeded:false, forecastEndpoint:null, forecastRequestAttempted:false, forecastRequestSucceeded:false, staleResponseSuppressedCount:0 };
  const cache = new Map();
  let normalizedRecords = [];
  let fetchInFlight = null;
  let currentIdentity = null;
  let generation = 0;
  let refreshTimer = null;
  let expiryTimer = null;

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
  function pointsEndpoint(point) { return POINTS_LOOKUP_ENDPOINT.replace("{lat}", encodeURIComponent(String(point.lat))).replace("{lng}", encodeURIComponent(String(point.lng))); }
  function provider() { return globalScope.gridlyWeatherProvider || globalScope.gridlyIntelligenceProviders?.[PROVIDER_ID] || null; }
  function validPayload(payload) { return Boolean(payload && payload.type === "FeatureCollection" && Array.isArray(payload.features)); }
  function governedForecastEndpoint(payload) {
    const value = payload?.properties?.forecast;
    if (typeof value !== "string") return null;
    return /^https:\/\/api\.weather\.gov\//i.test(value) ? value : null;
  }
  function validForecastPayload(payload) { return Boolean(payload?.properties && Array.isArray(payload.properties.periods)); }
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
  function retainedWarnings(records) {
    // A transport outage is not a cancellation. Retain only previously verified
    // warnings with an explicit authoritative expiry; never invent an extension.
    return currentRecords(records).filter(record => /warning/i.test(record.event || record.category || "")
      && String(record.status || "Actual").toLowerCase() === "actual"
      && Boolean(record.id || record.sourceTrace?.sourceId)
      && Number.isFinite(Date.parse(record.expirationTime || record.endTime || "")));
  }
  function entryIsFresh(entry) {
    const age = Date.now() - Date.parse(entry?.fetchedAt || "");
    return Boolean(entry?.succeeded && entry?.valid && age >= 0 && age <= REFRESH_INTERVAL_MS);
  }
  function entryRecords(entry) {
    if (!entry?.recordsAuthoritative) return [];
    return entryIsFresh(entry) ? currentRecords(entry.records) : retainedWarnings(entry.records);
  }
  function scheduleExpiry(entry, ownerGeneration) {
    if (expiryTimer != null) globalScope.clearTimeout?.(expiryTimer);
    expiryTimer=null;
    const expiries=entryRecords(entry).map(record=>Date.parse(record.expirationTime || record.endTime || "")).filter(value=>Number.isFinite(value) && value>Date.now());
    if (!expiries.length || typeof globalScope.setTimeout !== "function") return;
    expiryTimer=globalScope.setTimeout(()=>{
      expiryTimer=null;
      if (ownerGeneration !== generation || currentIdentity !== entry.requestIdentity || identity(resolvePoint()) !== entry.requestIdentity || cache.get(entry.requestIdentity) !== entry) return;
      normalizedRecords=entryRecords(entry).map(clone).filter(Boolean);
      state.normalizedRecordCount=normalizedRecords.length;
      notify("weather-alert-expired");
      scheduleExpiry(entry,ownerGeneration);
    },Math.min(2147483647,Math.max(1,Math.min(...expiries)-Date.now())));
    // Node certification timers must not hold a process open; browser handles
    // are numeric and do not expose unref.
    expiryTimer?.unref?.();
  }
  function activeAlertPayload(payload) {
    const cancelled=new Set();
    for (const feature of payload.features) {
      if (String(feature?.properties?.messageType || "").toLowerCase() !== "cancel" || String(feature?.properties?.status || "Actual").toLowerCase() !== "actual") continue;
      for (const reference of feature.properties.references || []) {
        if (reference?.identifier) cancelled.add(reference.identifier);
        if (reference?.["@id"]) cancelled.add(reference["@id"]);
        if (reference?.url) cancelled.add(reference.url);
      }
    }
    return { ...payload, features:payload.features.filter(feature => !cancelled.has(feature?.id) && !cancelled.has(feature?.properties?.id)) };
  }
  function notify(reason) {
    try { globalScope.gridlyOfficialProviderConsumerRefresh?.({ providerId:PROVIDER_ID, reason, evidenceChanged:true }); } catch (_) {}
    try { globalScope.gridlySynchronizeOpenAlertsPortrait?.(reason); } catch (_) {}
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
    state.requestInFlight = false;
    currentIdentity = entry.requestIdentity;
    normalizedRecords = entryRecords(entry).map(clone).filter(Boolean);
    state.connected=entry.succeeded && entry.valid; state.authorityReady=true; state.authorityWaitReason=null; state.lastFetchSucceeded=entry.succeeded; state.lastError=entry.error; state.lastSuccessAt=entry.lastAlertSuccessAt || null; state.lastFailureAt=entry.succeeded ? state.lastFailureAt : entry.checkedAt; state.normalizedRecordCount=normalizedRecords.length; state.pointRequestIdentity=entry.requestIdentity; state.pointEndpoint=entry.endpoint; state.pointResponseValid=entry.valid; state.pointsLookupEndpoint=entry.pointsLookupEndpoint; state.pointsRequestAttempted=entry.pointsRequestAttempted; state.pointsRequestSucceeded=entry.pointsRequestSucceeded; state.forecastEndpoint=entry.forecastEndpoint; state.forecastRequestAttempted=entry.forecastRequestAttempted; state.forecastRequestSucceeded=entry.forecastRequestSucceeded;
    state.forecastError=entry.forecastError || null;
    state.forecastRequestInFlight=entry.forecastRequestInFlight === true;
    scheduleExpiry(entry,requestGeneration);
    notify(entry.succeeded ? "weather-point-fetch-success" : "weather-point-fetch-failure");
    return true;
  }
  function invalidateCurrentAuthority(nextIdentity, nextPoint) {
    if (currentIdentity === nextIdentity || (currentIdentity === null && state.pointRequestIdentity === nextIdentity && state.pointResponseValid === false)) return;
    currentIdentity = null;
    if (expiryTimer != null) globalScope.clearTimeout?.(expiryTimer);
    expiryTimer=null;
    normalizedRecords = [];
    state.connected = false;
    state.lastFetchSucceeded = false;
    state.lastError = null;
    state.normalizedRecordCount = 0;
    state.pointRequestIdentity = nextIdentity;
    state.pointEndpoint = nextPoint ? endpoint(nextPoint) : null;
    state.pointResponseValid = false;
    state.pointsLookupEndpoint = nextPoint ? pointsEndpoint(nextPoint) : null;
    state.pointsRequestAttempted = false;
    state.pointsRequestSucceeded = false;
    state.forecastEndpoint = null;
    state.forecastRequestAttempted = false;
    state.forecastRequestSucceeded = false;
    state.forecastError = null;
    state.forecastRequestInFlight = false;
    notify("weather-point-identity-transition");
  }
  async function fetchPoint(point, requestGeneration) {
    const requestIdentity=identity(point), url=endpoint(point), lookupUrl=pointsEndpoint(point); state.requestInFlight=true; state.lastRequestAt=iso(); state.pointRequestIdentity=requestIdentity; state.pointEndpoint=url; state.pointsLookupEndpoint=lookupUrl;
    globalScope.gridlySynchronizeOpenAlertsPortrait?.("weather-source-loading");
    const attempt={pointsLookupEndpoint:lookupUrl,pointsRequestAttempted:false,pointsRequestSucceeded:false,forecastEndpoint:null,forecastRequestAttempted:false,forecastRequestSucceeded:false,forecastError:null,forecastRequestInFlight:true};
    const isCurrent=()=>requestGeneration === generation && identity(resolvePoint()) === requestIdentity;
    let entry=null;
    const commit=()=>{
      if (isCurrent()) {
        cache.delete(requestIdentity); cache.set(requestIdentity,entry);
        while(cache.size>CACHE_MAX) cache.delete(cache.keys().next().value);
      }
      return publish(entry,requestGeneration);
    };
    // The selected point is already governed. Forecast discovery/enrichment must
    // never gate its alert request or the publication of a successful warning.
    const forecastTask=(async()=>{
      try {
        attempt.pointsRequestAttempted=true;
        const pointsPayload=await requestPayload(lookupUrl);
        attempt.pointsRequestSucceeded=true;
        const forecastUrl=governedForecastEndpoint(pointsPayload);
        if (!forecastUrl) throw new Error("NWS points response did not provide a governed forecast endpoint");
        attempt.forecastEndpoint=forecastUrl; attempt.forecastRequestAttempted=true;
        const forecastPayload=await requestPayload(forecastUrl);
        if (!validForecastPayload(forecastPayload)) throw new Error("NWS forecast schema validation failed");
        attempt.forecastRequestSucceeded=true;
      } catch(error) { attempt.forecastError=error?.message||String(error); }
      finally {
        attempt.forecastRequestInFlight=false;
        if (entry && isCurrent()) { Object.assign(entry,attempt); commit(); }
      }
    })();
    try {
      const payload=await requestPayload(url);
      if (!validPayload(payload)) throw new Error("Weather connector schema validation failed");
      const normalizer=provider()?.normalizeRecords;
      if (typeof normalizer !== "function") throw new Error("Weather provider normalizer unavailable");
      const records=currentRecords(normalizer(activeAlertPayload(payload)).map(clone).filter(Boolean));
      const fetchedAt=iso();
      entry={ requestIdentity, point, endpoint:url, attempted:true, succeeded:true, valid:true, fetchedAt, checkedAt:fetchedAt, lastAlertSuccessAt:fetchedAt, recordsAuthoritative:true, records, error:null, ...attempt };
      // Cache publication follows the same current-generation authority as UI
      // publication, including when an earlier A request finishes after A-B-A.
      commit();
    } catch(error) {
      const previous=isCurrent() ? cache.get(requestIdentity) : null;
      const records=previous?.recordsAuthoritative ? retainedWarnings(previous.records) : [];
      entry={ requestIdentity, point, endpoint:url, attempted:true, succeeded:false, valid:false, fetchedAt:previous?.fetchedAt || null, checkedAt:iso(), lastAlertSuccessAt:previous?.lastAlertSuccessAt || null, recordsAuthoritative:records.length>0, records, error:error?.message||String(error), ...attempt };
      // A failed check supersedes this identity's earlier healthy cache entry.
      // Otherwise refreshAwarenessView can immediately restore obsolete success.
      commit();
    }
    await forecastTask;
    return freeze({ connected:entry.succeeded && entry.valid, normalizedRecordCount:entryRecords(entry).length, error:entry.error, requestIdentity });
  }
  function fetchNow() {
    state.providerActivated = true;
    const point=resolvePoint(); const nextIdentity=identity(point);
    if (!validGovernedPoint(point)) {
      generation+=1;
      invalidateCurrentAuthority(null, null);
      normalizedRecords=[];
      state.requestInFlight=false;
      state.authorityReady=false;
      state.authorityWaitReason="WAITING_FOR_AUTHORITY";
      return Promise.resolve(freeze({connected:false,notReady:true,reason:state.authorityWaitReason}));
    }
    state.authorityReady=true; state.authorityWaitReason=null;
    if (fetchInFlight?.identity === nextIdentity && fetchInFlight.generation === generation) return fetchInFlight.promise;
    invalidateCurrentAuthority(nextIdentity, point);
    const requestGeneration=++generation;
    scheduleExpiry(cache.get(nextIdentity),requestGeneration);
    const promise=fetchPoint(point,requestGeneration).finally(() => { if(fetchInFlight?.promise===promise) fetchInFlight=null; });
    fetchInFlight={identity:nextIdentity,generation:requestGeneration,promise}; return promise;
  }
  function refreshAwarenessView() {
    const point=resolvePoint(), next=identity(point), cached=next ? cache.get(next) : null;
    if (!validGovernedPoint(point)) return fetchNow();
    if (fetchInFlight?.identity === next && fetchInFlight.generation === generation) return fetchInFlight.promise;
    generation+=1;
    invalidateCurrentAuthority(next, point);
    const checkAge=Date.now()-Date.parse(cached?.checkedAt || "");
    if (cached && checkAge>=0 && checkAge<=REFRESH_INTERVAL_MS) { publish(cached,generation); return Promise.resolve(freeze({connected:entryIsFresh(cached),cached:true,normalizedRecordCount:entryRecords(cached).length})); }
    return fetchNow();
  }
  function startPolling() { state.automaticPolling=true; const tick=async()=>{await fetchNow(); if(state.automaticPolling) refreshTimer=globalScope.setTimeout(tick,REFRESH_INTERVAL_MS);}; tick(); return runtimeAudit(); }
  function stopPolling(){state.automaticPolling=false;if(refreshTimer!=null)globalScope.clearTimeout?.(refreshTimer);refreshTimer=null;return runtimeAudit();}
  function getNormalizedRecords(){const selectedIdentity=identity(resolvePoint());const entry=currentIdentity===selectedIdentity ? cache.get(currentIdentity) : null;return freeze(entryRecords(entry).map(clone).filter(Boolean));}
  function runtimeAudit(){
    const selectedPoint=resolvePoint(), selectedIdentity=identity(selectedPoint);
    const entry=currentIdentity&&currentIdentity===selectedIdentity?cache.get(currentIdentity):null;
    if(state.providerActivated!==true)return freeze({connected:false,networkingAvailable:typeof globalScope.fetch === "function",automaticPolling:false,providerActivated:false,renderingPerformed:false,normalizedRecordCount:0,requestAttempted:false,requestSucceeded:false,lastRequestAt:null,lastSuccessAt:null,lastFailureAt:null,lastError:null,refreshIntervalMs:REFRESH_INTERVAL_MS});
    const freshEnough=entryIsFresh(entry), records=entryRecords(entry);
    const retainedWarningEvidence=!freshEnough && records.length>0;
    const healthy=freshEnough && entry.forecastRequestSucceeded===true;
    return freeze({ ...state,
      requestInFlight:state.requestInFlight===true && state.pointRequestIdentity===selectedIdentity,
      applicabilityMode:"NWS_POINT_QUERY", statewideDiagnosticEndpoint:DEFAULT_ENDPOINT, pointAlertEndpoint:state.pointEndpoint,
      requestAttempted:Boolean(entry?.attempted), requestSucceeded:Boolean(entry?.succeeded), responseValid:Boolean(entry?.valid),
      fetchedAt:entry?.fetchedAt||null, checkedAt:entry?.checkedAt||null, freshEnough,
      freshnessStatus:freshEnough?"FRESH":(entry?.lastAlertSuccessAt?"STALE":"UNKNOWN"),
      normalizedRecordCount:records.length, pointActiveAlertCount:records.length, pointActiveAlertIds:freeze(records.map(r=>r.id)),
      retainedWarningEvidence, retainedWarningIds:freeze(retainedWarningEvidence?records.map(r=>r.id):[]),
      retainedWarningExpiries:freeze(retainedWarningEvidence?Object.fromEntries(records.map(r=>[r.id,r.expirationTime||r.endTime])):{}),
      currentAwarenessIdentity:selectedIdentity, responseIdentity:entry?.requestIdentity||null, selectedPoint,
      selectedIdentityClass:selectedPoint?.identityClass||null, selectedPlaceGeoid:selectedPoint?.placeGeoid||null,
      governedWeatherPointAvailable:validGovernedPoint(selectedPoint), governedWeatherLatitude:validGovernedPoint(selectedPoint)?selectedPoint.lat:null, governedWeatherLongitude:validGovernedPoint(selectedPoint)?selectedPoint.lng:null,
      latestProviderSuccessTimestamp:entry?.lastAlertSuccessAt||null,
      finalWeatherHealth:healthy?"HEALTHY":(freshEnough||retainedWarningEvidence?"DEGRADED":"UNAVAILABLE"),
      finalWeatherUnavailableReason:healthy?null:(state.authorityWaitReason||state.lastError||entry?.forecastError||(entry?.forecastRequestInFlight?"FORECAST_ENRICHMENT_PENDING":entry?.lastAlertSuccessAt?"STALE_PROVIDER_SUCCESS":"PROVIDER_SUCCESS_NOT_ESTABLISHED")), cacheSize:cache.size });
  }
  globalScope.gridlyWeatherConnector=freeze({providerId:PROVIDER_ID,providerName:PROVIDER_NAME,timeoutMs:TIMEOUT_MS,maxAttempts:MAX_ATTEMPTS,refreshIntervalMs:REFRESH_INTERVAL_MS,fetchNow,refreshAwarenessView,startPolling,stopPolling,getNormalizedRecords});
  globalScope.gridlyWeatherConnectorRuntimeAudit=runtimeAudit;
  if(typeof module!=="undefined"&&module.exports)module.exports=globalScope.gridlyWeatherConnector;
})(typeof window!=="undefined"?window:globalThis);
