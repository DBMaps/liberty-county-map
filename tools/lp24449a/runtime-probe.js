/* Certification-only browser helpers. Calls the frozen production entry points;
   never replaces a production function or writes to a remote service. */
window.lp24449a = (() => {
  const homeKeys=['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1','gridlySavedPlacesV1'];
  const bytes=()=>Object.fromEntries(homeKeys.map(k=>[k,localStorage.getItem(k)]));
  const identity=()=>{const c=gridlyGetCurrentAwarenessContext();const d=c.type==='HOME'&&c.generation===0&&window.gridlyStartupDiagnostics?.state?.startupCompleted?window.gridlyLp028DriveTexasAreaLifecycleAudit?.():null;return {probeVersion:3,type:c.type,place:c.placeId,name:c.placeName,county:c.countyId,lat:c.lat,lng:c.lng,generation:c.generation,health:c.health,expiresAt:c.expiresAt,startupProviderFocus:d?{coordinates:d.lastFilterCoordinates,state:d.geographicEvaluationState,authority:d.lastFilterFocusAuthority}:null};};
  const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  async function ready(){const deadline=Date.now()+60000;while(window.gridlyStartupDiagnostics?.state?.startupCompleted!==true){if(Date.now()>deadline)throw new Error('Certification startup readiness timeout');await new Promise(r=>setTimeout(r,25));}}
  async function settle(){await ready();await gridlyAwaitActiveCountyCrossingInventoryLoad('lp24449a-certification');await tick();}
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
  return {version:1,snapshot,identity,bytes,settle};
})();
