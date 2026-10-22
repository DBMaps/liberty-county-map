const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function verifyNws({page,caseName,setAlertFailure,setForecastFailure,setActive,setCancellation,setExpiry,settle}){
  const states=[];
  let forecastCompletion=null;
  const portraitWidths=[];
  const write=()=>fs.writeFileSync(path.join(process.env.REPAIR_OUTPUT_DIR||'.artifacts/community-loading-integration-v1',`after-${caseName}-nws.json`),JSON.stringify({states,forecastCompletion,portraitWidths},null,2));
  const capture=async label=>{
    await page.evaluate(async()=>{await gridlyWeatherConnector.fetchNow();gridlyRefreshUnifiedAwarenessContext('nws-safety-fixture');});
    await settle();
    if(await page.locator('#gridlyPortraitV2SheetClose').isVisible())await page.locator('#gridlyPortraitV2SheetClose').click();
    await page.locator('#gridlyAlertsDockButton').click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const disclosure=page.locator('details[data-gridly-lp236-source="weather"]');
    if(await disclosure.count()) {
      if(await disclosure.getAttribute('open')===null)await disclosure.locator(':scope > summary').click();
      for(const group of await disclosure.locator('details').all())if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();
    }
    const state=await page.evaluate(label=>{
      const snapshot=getAlertsSurfaceSnapshot(), section=document.querySelector('[data-gridly-lp236-source="weather"]');
      const weatherSurfaceIds=Object.fromEntries(Object.entries(gridlyGetGovernedConsumerProjection().surfaces).map(([key,rows])=>[key,rows.filter(row=>row.record.sourceKind==='weather_provider').map(row=>row.evidenceId)]));
      return {label,weatherSurfaceIds,runtime:gridlyWeatherConnectorRuntimeAudit(),records:gridlyWeatherConnector.getNormalizedRecords(),selection:gridlySelectConsumerVisibleWeatherSituations(),alertIds:snapshot.alerts.map((r,i)=>gridlyAlertWriterRecordId(r,i)),authority:gridlyReadAlertsFamilyAuthority().weather,coverage:gridlyGetLocalSourceCoverage(),dom:{state:section?.dataset.gridlyLp236AuthorityState,text:section?.innerText,warningVisible:!!section?.querySelector('[data-gridly-lp236-condition-id]')?.getClientRects().length,critical:!!document.querySelector('.gridly-lp236-critical'),noOverflow:document.documentElement.scrollWidth<=innerWidth}};
    },label);
    states.push(state);write();assert.equal(state.dom.noOverflow,true,'NWS disclosure preserves portrait width');return state;
  };
  setActive(true);setAlertFailure(false);setForecastFailure(false);
  const healthy=await capture('healthy-warning');assert.ok(healthy.dom.warningVisible,'current warning is rendered before fault injection');
  assert.match(healthy.dom.text,/warning/i);
  forecastCompletion=process.env.STATEWIDE_FORECAST_CHECK==='1'?await require('./verify-forecast-completion.cjs')({page}):null;
  await page.route('https://api.weather.gov/alerts/active?point=*',async route=>{await new Promise(resolve=>setTimeout(resolve,2000));await route.fallback();},{times:1});
  await page.evaluate(()=>{window.__nwsPendingProbe=gridlyWeatherConnector.fetchNow();});
  await page.waitForFunction(()=>gridlyWeatherConnectorRuntimeAudit().requestInFlight===true&&document.querySelector('[data-gridly-lp236-source="weather"]')?.dataset.gridlyLp236AuthorityState==='LOADING'&&document.querySelector('[data-gridly-lp236-source="weather"] [data-gridly-lp236-condition-id]')?.getClientRects().length>0,null,{timeout:10000});
  states.push(await page.evaluate(()=>({label:'pending-refresh',runtime:gridlyWeatherConnectorRuntimeAudit(),warningVisible:!!document.querySelector('[data-gridly-lp236-source="weather"] [data-gridly-lp236-condition-id]')?.getClientRects().length,text:document.querySelector('[data-gridly-lp236-source="weather"]')?.innerText})));
  write();await page.evaluate(async()=>{await window.__nwsPendingProbe;delete window.__nwsPendingProbe;});
  setForecastFailure(true);
  const forecast=await capture('forecast-503');
  assert.equal(forecast.runtime.forecastRequestSucceeded,false);assert.equal(forecast.runtime.requestSucceeded,true);
  assert.ok(forecast.alertIds.some(id=>id.includes('AUDIT-NWS-COUNTYWIDE')));assert.ok(forecast.dom.warningVisible);
  assert.equal(forecast.dom.critical,healthy.dom.critical,'preserve the existing critical presentation classification');
  assert.equal(forecast.coverage.complete,false,'missing forecast enrichment cannot establish full source coverage');
  setForecastFailure(false);setAlertFailure(true);
  const failure=await capture('alert-transport-failure');
  assert.equal(failure.runtime.freshEnough,false);assert.equal(failure.runtime.retainedWarningEvidence,true);
  assert.deepEqual(failure.records,forecast.records,'outage does not rewrite warning identity, coordinates, lineage, or expiry');
  assert.deepEqual(failure.weatherSurfaceIds,forecast.weatherSurfaceIds,'retention preserves the existing weather surface policy');
  assert.ok(failure.alertIds.some(id=>id.includes('AUDIT-NWS-COUNTYWIDE')),'retained warning survives the actual Alerts handoff');
  assert.equal(failure.dom.state,'STALE');assert.ok(failure.dom.warningVisible);assert.equal(failure.dom.critical,healthy.dom.critical);
  assert.match(failure.dom.text,/previously verified, unexpired warnings/);
  await page.screenshot({path:path.join(process.env.REPAIR_OUTPUT_DIR||'.artifacts/community-loading-integration-v1',`after-${caseName}-nws-retained-portrait.png`)});
  if(process.env.STATEWIDE_PORTRAIT_CHECK==='1'){
    for(const width of [360,375,390,411]){
      await page.setViewportSize({width,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const value=await page.evaluate(()=>{const section=document.querySelector('[data-gridly-lp236-source="weather"]'),rect=section?.getBoundingClientRect();return{width:innerWidth,noOverflow:document.documentElement.scrollWidth<=innerWidth,sectionWithinWidth:!!rect&&rect.left>=0&&rect.right<=innerWidth+1,warningVisible:!!section?.querySelector('[data-gridly-lp236-condition-id]')?.getClientRects().length,records:gridlyWeatherConnector.getNormalizedRecords(),text:section?.innerText};});
      assert.equal(value.noOverflow,true);assert.equal(value.sectionWithinWidth,true);assert.equal(value.warningVisible,true);assert.deepEqual(value.records,failure.records);assert.match(value.text,/previously verified, unexpired warnings/);portraitWidths.push(value);write();
      await page.screenshot({path:path.join(process.env.REPAIR_OUTPUT_DIR||'.artifacts/community-loading-integration-v1',`after-${caseName}-nws-retained-${width}.png`)});
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  setAlertFailure(false);
  const recovery=await capture('recovery');assert.equal(recovery.runtime.freshEnough,true);assert.equal(recovery.runtime.retainedWarningEvidence,false);
  setCancellation(true);
  const cancelled=await capture('cancellation');assert.deepEqual(cancelled.records,[]);assert.equal(cancelled.dom.warningVisible,false);
  assert.ok(Object.values(cancelled.weatherSurfaceIds).every(ids=>ids.length===0));
  setAlertFailure(true);
  const afterCancel=await capture('outage-after-cancellation');assert.deepEqual(afterCancel.records,[]);assert.equal(afterCancel.dom.warningVisible,false);
  setAlertFailure(false);setCancellation(false);setExpiry(new Date(Date.now()+4000).toISOString());
  const expiring=await capture('short-authoritative-expiry');assert.ok(expiring.dom.warningVisible);
  try { await page.waitForFunction(()=>gridlyWeatherConnector.getNormalizedRecords().length===0&&!document.querySelector('[data-gridly-lp236-source="weather"] [data-gridly-lp236-condition-id]'),null,{timeout:10000}); }
  catch(error){states.push(await page.evaluate(()=>({label:'expiry-failure-diagnostic',runtime:gridlyWeatherConnectorRuntimeAudit(),records:gridlyWeatherConnector.getNormalizedRecords(),weatherSection:document.querySelector('[data-gridly-lp236-source="weather"]')?.outerHTML})));write();throw error;}
  const expired=await page.evaluate(()=>({label:'expiry-without-network-poll',records:gridlyWeatherConnector.getNormalizedRecords(),runtime:gridlyWeatherConnectorRuntimeAudit(),warningVisible:!!document.querySelector('[data-gridly-lp236-source="weather"] [data-gridly-lp236-condition-id]'),weatherSurfaceIds:Object.fromEntries(Object.entries(gridlyGetGovernedConsumerProjection().surfaces).map(([key,rows])=>[key,rows.filter(row=>row.record.sourceKind==='weather_provider').map(row=>row.evidenceId)]))}));
  assert.ok(Object.values(expired.weatherSurfaceIds).every(ids=>ids.length===0));states.push(expired);
  write();
  setExpiry(null);setActive(false);await page.evaluate(()=>gridlyWeatherConnector.fetchNow());await settle();
  return {allPassed:true,states,forecastCompletion,portraitWidths};
};
