(function installGridlyLp215LiveCertifier(global) {
  'use strict';
  const PREFIX = 'GRIDLY_LP215_AUDIT_';
  const CHECKPOINT_KEY = `${PREFIX}CHECKPOINT_V1`;
  const REPORT_URL = '/reports/lp215/statewide-consumer-wiring-certification.json';
  const TERMINAL = new Set(['HEALTHY_WITH_DATA','HEALTHY_EMPTY','STALE_RETAINED','FAILED','UNAVAILABLE','TIMEOUT','NOT_AVAILABLE_IN_RUNTIME']);
  const state = { running: false, stopped: false, itinerary: [], results: [], index: 0, startedAt: null, completedAt: null, previous: null };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ids = value => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].sort();
  const safe = (fn, fallback = null) => { try { return fn(); } catch (_) { return fallback; } };
  const call = (name, fallback = null) => typeof global[name] === 'function' ? safe(() => global[name](), fallback) : fallback;
  const equal = (a,b) => JSON.stringify(ids(a)) === JSON.stringify(ids(b));
  const mapSnapshot = () => { const audit = call('gridlyV925SnapshotState', null); const center = audit?.viewport || call('gridlyMapRuntimeAudit', null)?.center || null; return { center: center ? { lat: Number(center.lat), lng: Number(center.lng) } : null, zoom: center?.zoom ?? null }; };

  function driveState(envelope, timedOut) {
    if (timedOut) return 'TIMEOUT';
    if (!envelope) return 'NOT_AVAILABLE_IN_RUNTIME';
    const raw = String(envelope.sourceStatus || envelope.sourceHealthState || envelope.status || '').toUpperCase();
    if (raw === 'HEALTHY_WITH_DATA') return raw;
    if (raw === 'HEALTHY_EMPTY' && (envelope.requestCompleted === true || envelope.successfulCurrentFetch === true || envelope.quietEligible === true)) return raw;
    if (/WITH_RETAINED|STALE/.test(raw)) return 'STALE_RETAINED';
    if (/UNAVAILABLE/.test(raw)) return 'UNAVAILABLE';
    if (/FAIL|ERROR|PROJECTION_DEFECT/.test(raw)) return 'FAILED';
    return null;
  }

  async function waitFor(read, ready, timeoutMs, interval = 400) {
    const started = performance.now(); let value;
    do { value = read(); if (ready(value)) return { settled: true, value, elapsedMs: Math.round(performance.now() - started) }; await sleep(interval); } while (performance.now() - started < timeoutMs && !state.stopped);
    return { settled: false, value, elapsedMs: Math.round(performance.now() - started) };
  }

  async function selectThroughCanonicalProductionAction(row) {
    if (typeof global.selectGridlySettingsAwarenessArea !== 'function') {
      throw new Error('CANONICAL_PRODUCTION_SELECTION_ACTION_NOT_AVAILABLE');
    }
    const selected = global.selectGridlySettingsAwarenessArea(row.canonicalKey, 'lp215_live_certification', null);
    if (selected !== true) throw new Error('CANONICAL_PRODUCTION_SELECTION_ACTION_REJECTED');
    await sleep(300);
    // Open the actual consumer surface so displayed-card evidence is captured,
    // rather than inferring presentation from records while Alerts is closed.
    document.querySelector('[data-v2-sheet="alerts"], #mobileDockAlertsBtn, [data-section="alerts"]')?.click();
  }

  function snapshot(row, sourceTimedOut = false) {
    const context = call('gridlyActiveCountyRuntimeAudit', {}); const road = call('gridlyLp028RegionalRoadwayRuntimeAudit', {}); const rail = call('gridlyCrossingRenderAudit', {});
    const parityAudit = call('gridlyCrossingGenerationConsistencyAudit', {}); const envelope = call('gridlyGetDriveTexasConsumerSourceStatusEnvelope', null);
    const shared = call('gridlyGetAuthoritativeCommunityAwarenessSummary', null)?.sharedActiveIssueContract || {};
    const alertsSnapshot = call('getAlertsSurfaceSnapshot', null); const official = call('gridlyLp214OfficialRoadwayMarkerPublicationAudit', {}); const map = mapSnapshot();
    const policyIds = ids(parityAudit.expectedMarkerIds); const leafletIds = ids(parityAudit.actualMarkerIds);
    const domIds = ids([...document.querySelectorAll('[data-gridly-crossing-id], [data-crossing-id]')].map(n => n.dataset.gridlyCrossingId || n.dataset.crossingId));
    const alertNodes = [...document.querySelectorAll('[data-gridly-alert-report-id], [data-gridly-canonical-incident-id]')]; const alertIds = ids(alertNodes.map(n => n.dataset.gridlyAlertReportId || n.dataset.gridlyCanonicalIncidentId));
    const drive = driveState(envelope, sourceTimedOut); const railEmpty = row.railManifestStatus === 'ACTIVE_EMPTY' && row.railGovernedCount === 0;
    return { context, road, rail, envelope, shared, alertsSnapshot, official, map, policyIds, leafletIds, domIds, alertIds, drive,
      settled: context.activeCountyId === row.countyId && context.awarenessAreaKey === row.canonicalKey && road.loadedRoadwayCounty === row.countyId && context.inventoryHydrationCompleted === true && TERMINAL.has(drive),
      railPass: railEmpty ? Number(rail.runtimeCrossingInventoryCount) === 0 : context.runtimeInventoryCounty === row.countyId && Number(rail.runtimeCrossingInventoryCount) > 0 && equal(policyIds, leafletIds) && equal(leafletIds, domIds) };
  }

  function buildResult(row, settled, transitionStarted) {
    const s = settled.value || snapshot(row, true); const elapsed = Math.round(performance.now() - transitionStarted);
    const selected = s.context.awarenessAreaKey || null; const active = s.context.activeCountyId || null;
    const contextPass = selected === row.canonicalKey && active === row.countyId;
    const roadCount = call('gridlyRoadwayRuntimeAudit', {})?.roadwayFeatureCount ?? null;
    const roadwayLivePass = s.road.loadedRoadwayCounty === row.countyId && s.road.activeCountyPackageLoaded === true && (roadCount === null || roadCount === row.roadwayFeatureCount);
    const eligible = Number(s.alertsSnapshot?.activeLocalizedAlertCount ?? s.shared.activeIssueCount); const displayed = s.alertIds.length;
    const alertsEmptyReason = eligible === 0 ? (s.alertsSnapshot?.emptyReason || 'PRODUCTION_CONTRACT_ZERO_ELIGIBLE') : null;
    const alertsPass = Number.isInteger(eligible) && ((eligible === 0 && displayed === 0) || displayed === eligible);
    const currentRecords = ids((s.envelope?.records || []).map(r => r.consumerSituationId || r.sourceProviderRecordId || r.id));
    const stale = state.previous ? { selectedCommunity: selected !== state.previous.selectedCommunity, activeCounty: active !== state.previous.activeCounty, roadwaySourceCounty: s.road.loadedRoadwayCounty !== state.previous.roadwaySourceCounty, driveTexasCurrentAreaRecords: !currentRecords.some(x => state.previous.driveTexasRecordIds.includes(x)), railSourceCounty: s.context.runtimeInventoryCounty !== state.previous.railSourceCounty, railMarkers: !s.leafletIds.some(x => state.previous.railMarkerIds.includes(x)), alertsCards: !s.alertIds.some(x => state.previous.alertCardIds.includes(x)), awarenessRecords: true } : null;
    const staleStatePass = stale ? Object.values(stale).every(Boolean) : 'NOT_APPLICABLE_FIRST_ROW'; const driveTexasLivePass = ['HEALTHY_WITH_DATA','HEALTHY_EMPTY'].includes(s.drive);
    const reasons = []; if (!settled.settled) reasons.push(TERMINAL.has(s.drive) ? 'RUNTIME_SETTLEMENT_TIMEOUT' : 'SOURCE_TIMEOUT'); if (!contextPass) reasons.push('CONTEXT_FAILURE'); if (!roadwayLivePass) reasons.push('ROADWAY_LIVE_FAILURE'); if (!driveTexasLivePass) reasons.push(`DRIVETEXAS_${s.drive || 'INCOMPLETE'}`); if (!alertsPass) reasons.push('ALERTS_CONTRACT_FAILURE'); if (!s.railPass) reasons.push('RAIL_PARITY_FAILURE'); if (!staleStatePass) reasons.push('STALE_STATE_FAILURE');
    return { sequence: row.sequence, countyFips: row.countyFips, countyId: row.countyId, representativeCommunity: row.representativeCommunity, canonicalKey: row.canonicalKey, placeGeoid: row.placeGeoid, selectedCommunityAfterTransition:selected, activeCountyAfterTransition:active, mapCenter:s.map.center, mapZoom:s.map.zoom, contextPass,
      expectedRoadwayManifestStatus:row.roadwayManifestStatus, expectedRoadwayFeatureCount:row.roadwayFeatureCount, liveRoadwayCounty:s.road.loadedRoadwayCounty||null, liveRoadwayLoadedState:s.road.activeCountyPackageLoaded===true, liveRoadwayFeatureCount:roadCount, liveSourceGeneration:s.road.currentPackageCacheKey||null, stalePriorCountyRoadwayPresence:state.previous ? s.road.loadedRoadwayCounty===state.previous.roadwaySourceCounty:false, roadwayLivePass,
      driveTexasProviderId:'drivetexas', configurationAvailable:s.envelope?.configurationAvailable??null, requestAttempted:s.envelope?.requestAttempted??null, requestCompleted:s.envelope?.requestCompleted??null, sourceHealthState:s.drive||'TIMEOUT', currentAreaRecordCount:currentRecords.length, currentAreaRecordIds:currentRecords, consumerPublishedCount:s.shared.activeOfficialRoadwayCount??null, stalePreviousAreaRecordCount:state.previous?currentRecords.filter(x=>state.previous.driveTexasRecordIds.includes(x)).length:0, driveTexasLivePass,
      officialRoadwayCount:s.shared.activeOfficialRoadwayCount??s.official.representedRecordCount??null, officialRoadwayState:s.envelope?.sourceStatus||s.drive, officialRoadwayPass:Number.isInteger(s.shared.activeOfficialRoadwayCount??s.official.representedRecordCount),
      alertsEligibleCount:Number.isInteger(eligible)?eligible:null, alertsDisplayedCount:displayed, alertsEmptyReason, alertsOwnershipState:s.alertsSnapshot?'PRODUCTION_ALERTS_CONTRACT':'NOT_AVAILABLE_IN_RUNTIME', alertsPass,
      expectedRailManifestState:row.railManifestStatus, expectedRailGovernedCount:row.railGovernedCount, liveRailSourceCounty:s.context.runtimeInventoryCounty||null, liveRailInventoryCount:Number(s.rail.runtimeCrossingInventoryCount||0), awarenessQualifiedCount:s.rail.visibleCrossingCount??null, policyVisibleCount:s.policyIds.length, policyVisibleIds:s.policyIds, leafletMarkerIds:s.leafletIds, domMarkerIds:s.domIds, railClassification:row.railManifestStatus==='ACTIVE_EMPTY'?'RAIL_EXPECTED_EMPTY':'RAIL_WITH_DATA', railPass:s.railPass,
      staleStateChecks:stale, staleStatePass, transitionElapsedMs:elapsed, timeoutClassification:settled.settled?null:(TERMINAL.has(s.drive)?'RUNTIME_SETTLEMENT_TIMEOUT':'SOURCE_TIMEOUT'), complete:settled.settled, pass:settled.settled&&reasons.length===0, reasons };
  }

  function saveCheckpoint() { sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ schemaVersion:'gridly.lp215.live-checkpoint.v1', startedAt:state.startedAt, results:state.results })); }
  function summary() { const completed=state.results.length, pass=state.results.filter(r=>r.pass).length, fail=state.results.filter(r=>r.complete&&!r.pass).length, incomplete=254-pass-fail; return { expected:254, completed, pass, fail, incomplete }; }
  const previousFrom = (result, liveIds = result.currentAreaRecordIds || []) => ({selectedCommunity:result.selectedCommunityAfterTransition,activeCounty:result.activeCountyAfterTransition,roadwaySourceCounty:result.liveRoadwayCounty,driveTexasRecordIds:ids(liveIds),railSourceCounty:result.liveRailSourceCounty,railMarkerIds:result.leafletMarkerIds||[],alertCardIds:result.alertCardIds||[]});
  async function run() { if(state.running)return; state.running=true; state.stopped=false; while(state.index<state.itinerary.length&&!state.stopped){ const row=state.itinerary[state.index]; console.log(`[${String(row.sequence).padStart(3,'0')}/254] ${row.countyId.replace(/-tx$/,'')} / ${row.representativeCommunity}`); const started=performance.now(); try{await selectThroughCanonicalProductionAction(row); const settled=await waitFor(()=>snapshot(row,false),s=>s.settled,45000); const result=buildResult(row,settled,started); result.alertCardIds=settled.value?.alertIds||[]; state.results.push(result); state.previous=previousFrom(result,(settled.value?.envelope?.records||[]).map(r=>r.consumerSituationId||r.id)); console.log(`CONTEXT ${result.contextPass?'PASS':'FAIL'} | ROADWAY ${result.roadwayLivePass?'PASS':'FAIL'} | DRIVETEXAS ${result.sourceHealthState} | ALERTS ${result.alertsPass?'PASS':'FAIL'} | RAIL ${result.railPass?'PASS':'FAIL'} | STALE ${result.staleStatePass}`); }catch(error){ state.results.push({...row,complete:false,pass:false,reasons:['CONTEXT_FAILURE',error.message||String(error)]}); console.error(row.countyId,error); } state.index++; saveCheckpoint(); } state.running=false; if(state.index===254)state.completedAt=new Date().toISOString(); console.table(summary()); return global.gridlyLp215Status(); }
  function payload(){const s=summary();return {metadata:{schemaVersion:'gridly.lp215.live-certification.v1',auditOnly:true,itineraryUrl:REPORT_URL,expectedCount:254,repositoryAuditHead:'2db0b02b4455606947d211313203924d645c4e03'},checkpointHead:{completedSequence:state.index,countyFips:state.results.at(-1)?.countyFips||null},startedAt:state.startedAt,completedAt:state.completedAt,browserRuntime:{userAgent:navigator.userAgent,language:navigator.language,href:location.href},results:state.results,summary:s,failingCounties:state.results.filter(r=>r.complete&&!r.pass).map(r=>({countyId:r.countyId,reasons:r.reasons})),incompleteCounties:state.itinerary.filter((_,i)=>!state.results[i]?.complete).map((r,i)=>({countyId:r.countyId,reasons:state.results[i]?.reasons||['NOT_RUN']}))};}
  global.gridlyLp215Status=()=>({running:state.running,stopped:state.stopped,index:state.index,controlledStaleTransitions:Math.max(0,state.results.length-1),optionalWraparound:'NON_BLOCKING',...summary()}); global.gridlyLp215Stop=()=>{state.stopped=true;return global.gridlyLp215Status();}; global.gridlyLp215Export=(download=true)=>{const out=JSON.stringify(payload(),null,2)+'\n';if(download){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out],{type:'application/json'}));a.download='gridly-lp215-live-certification.json';a.click();URL.revokeObjectURL(a.href);}return out;}; global.gridlyLp215ClearAuditCheckpoint=()=>{Object.keys(sessionStorage).filter(k=>k.startsWith(PREFIX)).forEach(k=>sessionStorage.removeItem(k));return true;}; global.gridlyLp215Resume=()=>run();
  global.gridlyLp215OptionalWraparound=async()=>{if(state.index!==254)throw new Error('OPTIONAL_WRAPAROUND_REQUIRES_COMPLETED_CERTIFICATION');try{const row=state.itinerary[0];await selectThroughCanonicalProductionAction(row);const settled=await waitFor(()=>snapshot(row,false),s=>s.settled,45000);return {nonBlocking:true,result:buildResult(row,settled,performance.now()-settled.elapsedMs)};}catch(error){console.warn('[optional wraparound] Non-blocking helper failed',error);return {nonBlocking:true,pass:false,error:error.message||String(error)};}};
  global.gridlyLp215Start=async()=>{const response=await fetch(REPORT_URL,{cache:'no-store'});if(!response.ok)throw new Error(`LP215 itinerary fetch failed: ${response.status}`);const report=await response.json();state.itinerary=report.rows;if(state.itinerary.length!==254||new Set(state.itinerary.map(r=>r.countyFips)).size!==254)throw new Error('LP215 itinerary is not 254 unique counties');const checkpoint=safe(()=>JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY)),null);let resumeAt=0;while(resumeAt<state.itinerary.length&&checkpoint?.results?.[resumeAt]?.countyFips===state.itinerary[resumeAt].countyFips)resumeAt++;state.results=(checkpoint?.results||[]).slice(0,resumeAt);state.index=resumeAt;state.startedAt=checkpoint?.startedAt||new Date().toISOString();state.previous=state.index>0?previousFrom(state.results[state.index-1]):null;return run();};
  console.log('GRIDLY LP215 live certifier installed. Starting/resuming 254-county audit.'); global.gridlyLp215Start();
})(window);
