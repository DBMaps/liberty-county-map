// Mounted consumer proof for the independent pending -> completed forecast
// boundary. Kept separate from the original nine NWS scenarios.
const assert=require('node:assert/strict');
module.exports=async({page})=>{
 let release;const held=new Promise(resolve=>{release=resolve;});
 await page.route('https://api.weather.gov/gridpoints/**/forecast',async route=>{await held;await route.fallback();},{times:1});
 await page.evaluate(()=>{window.__forecastCompletionProbe=gridlyWeatherConnector.fetchNow();});
 try{
  await page.waitForFunction(()=>{const r=gridlyWeatherConnectorRuntimeAudit();return r.forecastRequestInFlight===true&&r.requestSucceeded===true&&r.responseValid===true&&r.freshEnough===true;},null,{timeout:10000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const capture=()=>page.evaluate(()=>({runtime:gridlyWeatherConnectorRuntimeAudit(),coverage:gridlyGetLocalSourceCoverage(),records:gridlyWeatherConnector.getNormalizedRecords(),inputRevision:gridlyAwarenessSummaryInputRevision(),alertsText:document.querySelector('[data-gridly-lp236-alerts="true"]')?.innerText||'',warningVisible:!!document.querySelector('[data-gridly-lp236-source="weather"] [data-gridly-lp236-condition-id]')?.getClientRects().length}));
  // Alerts authority is independent of optional forecast enrichment. Broad
  // source coverage remains incomplete while its own forecast is pending;
  // the Alerts header correctly reflects successfully retrieved alerts.
  const pending=await capture();assert.equal(pending.coverage.complete,false);assert.equal(pending.warningVisible,true);assert.match(pending.alertsText,/Flash Flood Warning/i);
  release();await page.evaluate(async()=>{await window.__forecastCompletionProbe;delete window.__forecastCompletionProbe;});
  await page.waitForFunction(()=>gridlyGetLocalSourceCoverage().complete===true,null,{timeout:10000});
  const complete=await capture();assert.equal(complete.runtime.forecastRequestSucceeded,true);assert.equal(complete.warningVisible,true);assert.deepEqual(complete.records,pending.records);return{allPassed:true,pending,complete,proof:'actual current coverage gate reconciles forecast completion; mounted warning identity/lineage/location remain exact without another provider read'};
 }finally{release();}
};
