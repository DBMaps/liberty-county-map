/* Certification-only browser helpers. Calls the frozen production entry points;
   never replaces a production function or writes to a remote service. */
window.lp24449 = (() => {
  const homeKeys=['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1','gridlySavedPlacesV1'];
  const bytes=()=>Object.fromEntries(homeKeys.map(k=>[k,localStorage.getItem(k)]));
  const identity=()=>{const c=gridlyGetCurrentAwarenessContext();const d=c.type==='HOME'&&c.generation===0&&window.gridlyStartupDiagnostics?.state?.startupCompleted?window.gridlyLp028DriveTexasAreaLifecycleAudit?.():null;return {probeVersion:3,type:c.type,place:c.placeId,name:c.placeName,county:c.countyId,lat:c.lat,lng:c.lng,generation:c.generation,health:c.health,expiresAt:c.expiresAt,startupProviderFocus:d?{coordinates:d.lastFilterCoordinates,state:d.geographicEvaluationState,authority:d.lastFilterFocusAuthority}:null};};
  const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  let returnCohortPromise;
  const returnRequired=async row=>{if(row.is_multi_county||row.certificationForceReturn)return true;if(!returnCohortPromise){returnCohortPromise=fetch('/.artifacts/lp24449/return-cohort.json').then(r=>{if(!r.ok)throw new Error('Missing certification return cohort');return r.json();});}return (await returnCohortPromise).includes(row.place_geoid);};
  async function ready(){const deadline=Date.now()+60000;while(window.gridlyStartupDiagnostics?.state?.startupCompleted!==true){if(Date.now()>deadline)throw new Error('Certification startup readiness timeout');await new Promise(r=>setTimeout(r,25));}}
  async function settle(){await ready();await gridlyAwaitActiveCountyCrossingInventoryLoad('lp24449-certification');await tick();}
  function snapshot(){
    const c=identity(),area=getGridlySelectedAwarenessArea(),gov=gridlyGetGovernedConsumerProjection(),summary=buildGridlyCommunityAwarenessIntelligenceSummary();
    const weather=window.gridlyWeatherConnectorRuntimeAudit?.();
    const drive=window.gridlyDriveTexasConnectorRuntimeAudit?.();
    const driveArea=window.gridlyLp028DriveTexasAreaLifecycleAudit?.();
    const alerts=getAlertsSurfaceSnapshot();
    const rows=Object.fromEntries(Object.entries(gov.surfaces).map(([k,v])=>[k,v.map(r=>({id:r.evidenceId,type:r.subtype,county:r.record?.countyId||r.record?.county_id,active:r.active}))]));
    return {context:c,commandVisibility:window.__gridlyMobileCommandCardVisibilityState,activeCounty:gridlyGetActiveCountyId(),areaKey:area?.key,weatherPoint:gridlyResolveGovernedWeatherPoint(),weather:{point:weather?.selectedPoint,identity:weather?.currentAwarenessIdentity,endpoint:weather?.pointEndpoint,pointsEndpoint:weather?.pointsLookupEndpoint,activated:weather?.providerActivated,attempted:weather?.pointsRequestAttempted,health:weather?.finalWeatherHealth,error:weather?.lastError},drive,driveArea,rows,
      summary:{name:summary.awarenessAreaName,issues:summary.activeIssuesLine},location:{label:document.getElementById('mobileAwarenessPanelKicker')?.textContent,issues:document.getElementById('mobileAwarenessPanelIssues')?.textContent},pulse:{count:gridlyCommunityPulseAuditState?.activeAwareness?.activeAwarenessCount,text:document.querySelector('.gridly-v2-status-pill')?.innerText},kbyg:{name:document.getElementById('gridlyBriefLocation')?.textContent,text:document.getElementById('gridlyBriefInteractionPanel')?.innerText},alerts:{ids:alerts.alerts.map((r,i)=>gridlyAlertWriterRecordId(r,i)),area:alerts.canonicalKey||alerts.authoritativeMembership?.contextKey,authority:gridlyReadAlertsFamilyAuthority(),dom:[...document.querySelectorAll('[data-gridly-lp236-condition-id]')].map(n=>({id:n.dataset.gridlyLp236ConditionId,text:n.innerText})),text:document.querySelector('#gridlyPortraitV2Sheet[data-active-sheet=alerts]')?.innerText},
      crossing:{owner:gridlyCrossingInventoryCountyId,loaded:crossings.length,public:crossings.filter(isGridlyReportableCrossing).length,eligible:gridlySelectConsumerVisibleCrossings(area).map(x=>x.id),markers:[...crossingMarkers].filter(([,m])=>m.getElement()?.isConnected).map(([id])=>id),trace:window.gridlyCrossingProvider?.getLastLoadTrace?.()},hazards:activeHazards.map(r=>({id:r.id,county:r.countyId||r.county_id})),hazardMarkers:unifiedIncidentLayer?.getLayers().map(m=>m.options.incidentId),undefinedm:document.body.innerText.includes('undefinedm')};
  }
  async function search(row){
    const started=performance.now(),query=row.community_name;
    const bare=await gridlySearchAddress(query,{limit:20});
    const bareFinished=performance.now();
    const exact=bare.find(r=>r.placeGeoid===row.place_geoid);
    const normalized=resolveGridlyGovernedBareTexasPlaceQuery('  '+query.toUpperCase()+'  ');
    const qualifiedQuery=query+', '+row.county_name+', TX';
    const qualifiedAttempted=row.is_multi_county||!exact;
    const qualified=qualifiedAttempted?await gridlySearchAddress(qualifiedQuery,{limit:20}):[];
    const qualifiedFinished=performance.now();
    const selected=qualified.find(r=>r.placeGeoid===row.place_geoid)||exact;
    const picker=resolveGridlyManualAwarenessAreaSearch(query);
    const options=(picker.groups||[]).flatMap(g=>g.communities.map(c=>({place:c.placeGeoid||c.canonicalResolution?.placeGeoid,county:c.requestedOperationalCountyId||g.countyId})));
    const resolution={query,qualifiedQuery,qualifiedAttempted,diagnostics:bare.gridlyProviderDiagnostics?{intent:bare.gridlyProviderDiagnostics.intent,status:bare.gridlyProviderDiagnostics.providerStatus,stages:bare.gridlyProviderDiagnostics.stageCounts}:null,bare:bare.map(r=>({id:r.id,place:r.placeGeoid,title:r.title,county:r.requestedOperationalCountyId||r.countyId,memberships:r.countyMemberships,lat:r.lat,lng:r.lng,provider:r.provider})),qualified:qualified.map(r=>({place:r.placeGeoid,county:r.requestedOperationalCountyId||r.countyId,provider:r.provider})),normalized:normalized?{place:normalized.placeGeoid,memberships:normalized.countyMemberships}:null,pickerOptions:options,selectionMode:'production Search result plus explicit governed membership argument; visible membership affordance audited separately'};
    if(!selected)return {resolution,selected:false,ms:performance.now()-started};
    const homeBefore=bytes();
    selectGridlySearchResult({...selected,requestedOperationalCountyId:row.county_id});
    await settle();
    const selectedFinished=performance.now();
    const current=snapshot();
    const capturedFinished=performance.now();
    const filters={};const beforeFilter=activeGeoFilter;
    for(const [name,key]of [['nearby','nearby'],['area','town'],['county','county'],['delays','active-delays'],['all','all']]){
      activeGeoFilter=key;const crossingsForFilter=getVisibleCrossingsForFilter('lp24449-contract');
      filters[name]={key,context:identity(),ids:crossingsForFilter.map(c=>c.id),foreign:crossingsForFilter.filter(c=>!gridlyCrossingSampleMatchesCounty(c,row.county_id)).map(c=>c.id),areaTarget:gridlyGetTemporaryAreaFilterTarget(),anchor:getGridlyAwarenessAnchor()};
    }activeGeoFilter=beforeFilter;
    const filtersFinished=performance.now();
    const homeAfter=bytes();
    const returnHomeExercised=await returnRequired(row);
    if(returnHomeExercised){document.getElementById('gridlyTemporaryContextReturnHome').click();await settle();}
    return {resolution,selected:true,current,filters,homeBefore,homeAfter,returnHomeExercised,returnHomeScope:returnHomeExercised?'mandatory county representative / multi-county / generated-edge cohort':'direct identity/consumer/filter contract; Return Home covered by county transition cohort',returned:returnHomeExercised?identity():null,timing:{bareMs:bareFinished-started,qualifiedMs:qualifiedFinished-bareFinished,selectionMs:selectedFinished-qualifiedFinished,snapshotMs:capturedFinished-selectedFinished,filtersMs:filtersFinished-capturedFinished,returnMs:performance.now()-filtersFinished,contextAndFiltersMs:performance.now()-qualifiedFinished},ms:performance.now()-started};
  }
  async function home(row){
    await ready();
    const area=GRIDLY_AWARENESS_AREA_DEFINITIONS.find(a=>gridlyResolveCanonicalPlaceGeoid(a)===row.place_geoid);
    let saved=false;
    if(row.is_multi_county){saved=gridlySaveCanonicalMultiCountyPlaceHome({status:'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE',canonicalIdentity:'PLACE_GEOID',community:row.community_name,placeGeoid:row.place_geoid,countyMemberships:gridlyResolveCanonicalPlaceRegistryIdentity(area)?.countyMemberships},'lp24449-existing-home-entry',row.county_id);}
    else if(area)saved=Boolean(saveGridlyHomeTownPreference(area.key));
    await settle();const record=gridlyReadHomePersonalizationRecord();
    return {saved,context:identity(),bytes:bytes(),rehydration:record?gridlyLp0517ValidateHomeRecord(JSON.parse(JSON.stringify(record))).valid:null};
  }
  async function around(row){
    const coordinateReadinessStarted=Date.now();while(!gridlyResolveCountyIdForCoordinate(row.presentation_lat,row.presentation_lng)?.countyId){if(Date.now()-coordinateReadinessStarted>60000)throw new Error('Governed coordinate resolution unavailable after readiness wait');await new Promise(r=>setTimeout(r,25));}
    const coordinateReadinessWaitMs=Date.now()-coordinateReadinessStarted;
    const homeBefore=bytes(),expectedCoordinateResolution=gridlyResolveCountyIdForCoordinate(row.presentation_lat,row.presentation_lng),expected=expectedCoordinateResolution?.countyId;
    const position={timestamp:Date.now(),coords:{latitude:row.presentation_lat,longitude:row.presentation_lng,accuracy:10}};
    const activated=gridlyActivateForegroundAwarenessContext(position);await settle();const current=snapshot();
    const staleRejected=gridlyActivateForegroundAwarenessContext({...position,timestamp:Date.now()-121000})===null;
    const homeAfter=bytes();document.getElementById('gridlyTemporaryContextReturnHome').click();await settle();
    return {coordinateReadinessWaitMs,expectedCoordinateCounty:expected,expectedCoordinateResolution,selectedMembership:row.county_id,coordinateInsideSelectedMembership:expected===row.county_id,activated:Boolean(activated),current,staleRejected,homeBefore,homeAfter,returned:identity()};
  }
  async function protection(row,{countyFilter=false}={}){
    const results=await gridlySearchAddress(row.community_name,{limit:20}),result=results.find(r=>r.placeGeoid===row.place_geoid);
    const before={temporary:JSON.stringify(gridlyGetAwarenessContextStore().temporary),home:bytes()};
    const prior={flag:routeWatchActivated,windowFlag:window.__gridlyRouteWatchActive,geometry:window.__gridlyMonitoredRouteGeometry,source:activeRouteSource,origin:activeRouteOriginLabel,destination:activeRouteDestinationLabel};
    const geometry=[{lat:row.presentation_lat,lng:row.presentation_lng},{lat:row.presentation_lat+.01,lng:row.presentation_lng+.01}];
    window.__gridlyMonitoredRouteGeometry=geometry;activeRouteSource='destination_preview';activeRouteOriginLabel='Certification origin';activeRouteDestinationLabel='Certification destination';routeWatchActivated=true;window.__gridlyRouteWatchActive=true;
    let value;
    try{
      const beforeRoute=JSON.stringify(getRoutePolylineLatLngs()),beforeOwner=gridlyGetCurrentAwarenessContext().type;
      const searchRejected=!result||selectGridlySearchResult({...result,requestedOperationalCountyId:row.county_id})===null;
      const requestRejected=requestGridlyUserLocationFromControl()===false;
      const fixRejected=gridlyActivateForegroundAwarenessContext({timestamp:Date.now(),coords:{latitude:row.presentation_lat,longitude:row.presentation_lng}})===null;
      const filterContextBefore=identity();
      if(countyFilter){document.querySelector('#gridlyPortraitV2 .gridly-v2-segments [data-geo-filter="county"]').click();await settle();}
      value={fixture:'synthetic two-point monitored route; no network routing or production mutation',searchAvailable:Boolean(result),searchRejected,requestRejected,fixRejected,owner:beforeOwner,vertexCount:getRoutePolylineLatLngs().length,temporaryUnchanged:before.temporary===JSON.stringify(gridlyGetAwarenessContextStore().temporary),homeUnchanged:JSON.stringify(before.home)===JSON.stringify(bytes()),routeUnchanged:beforeRoute===JSON.stringify(getRoutePolylineLatLngs()),endpointsUnchanged:activeRouteOriginLabel==='Certification origin'&&activeRouteDestinationLabel==='Certification destination'};
      value.countyFilter={tested:countyFilter,before:filterContextBefore,after:identity(),activeCounty:gridlyGetActiveCountyId(),routeStillActive:routeWatchActivated===true};
      stopGridlyRouteWatch('lp24449-test-stop');value.stopped=routeWatchActivated===false;value.ownerAfterStop=gridlyGetCurrentAwarenessContext().type;
    }finally{routeWatchActivated=prior.flag;window.__gridlyRouteWatchActive=prior.windowFlag;window.__gridlyMonitoredRouteGeometry=prior.geometry;activeRouteSource=prior.source;activeRouteOriginLabel=prior.origin;activeRouteDestinationLabel=prior.destination;gridlyRefreshUnifiedAwarenessContext('lp24449-route-fixture-restored');}
    await settle();return value;
  }
  return {version:3,snapshot,identity,bytes,settle,search,home,around,protection};
})();
