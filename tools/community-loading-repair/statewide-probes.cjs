// Post-startup operations, deliberately outside the startup CPU profile/window.
const assert=require('node:assert/strict');
module.exports=async({page,cdp,c})=>{
 page.setDefaultTimeout(300000);
 const memoryBefore=await cdp.send('Runtime.getHeapUsage');
 const domBefore=await cdp.send('Memory.getDOMCounters');
 const operations=await page.evaluate(()=>{
  const result={lookup:[],summary:[],invalidation:null};
  const queries=crossings.map(row=>({crossingName:row.name}));
  for(let pass=0;pass<3;pass++){let found=0;const start=performance.now();for(const query of queries)if(getGridlyAwarenessIntelligenceCrossing(query))found++;result.lookup.push({count:queries.length,found,ms:performance.now()-start});}
  let summary;
  for(let pass=0;pass<3;pass++){const start=performance.now();summary=buildGridlyCommunityAwarenessIntelligenceSummary();result.summary.push({ms:performance.now()-start,reusable:isGridlyCachedAwarenessSummaryForCurrentArea(summary)});}
  if(typeof gridlyAwarenessSummaryInputRevision==='function'){
   const stamp=gridlyAwarenessSummaryInputRevision(),old=activeHazards;
   const start=performance.now();
   try{activeHazards=[...old,{id:'LOCAL-INVALIDATION-PROBE',status:'active',lat:0,lng:0}];result.invalidation={different:stamp!==gridlyAwarenessSummaryInputRevision(),rejectsOld:!isGridlyCachedAwarenessSummaryForCurrentArea(summary),ms:performance.now()-start};}
   finally{activeHazards=old;}
   result.invalidation.restored=stamp===gridlyAwarenessSummaryInputRevision();
  }
  return result;
 });
 if(operations.invalidation){assert.equal(operations.invalidation.different,true);assert.equal(operations.invalidation.rejectsOld,true);assert.equal(operations.invalidation.restored,true);}
 if(await page.locator('#gridlyPortraitV2SheetClose').isVisible())await page.locator('#gridlyPortraitV2SheetClose').click();
 const popup=await page.evaluate(async()=>{
  const pair=[...crossingMarkers].find(([id,marker])=>marker.getElement()?.isConnected);
  if(!pair)return{skipped:'No marker in current governed viewport'};
  const[id,marker]=pair,start=performance.now();marker.fire('click');const synchronousMs=performance.now()-start;
  const deadline=performance.now()+10000;while(!isGridlyCrossingPopupVisible(marker)&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const paintMs=performance.now()-start,content=String(marker.getPopup().getContent()),crossing=crossings.find(row=>row.id===id),expected=buildPopup(crossing,getLatestReportForCrossing(id));
  const fields=html=>{const doc=new DOMParser().parseFromString(html,'text/html');return[...doc.querySelectorAll('[data-gridly-crossing-popup-field]')].map(n=>[n.dataset.gridlyCrossingPopupField,n.textContent]);};
  const result={id,county:marker.options.gridlyCountyId,synchronousMs,paintMs,fields:fields(content),expected:fields(expected),open:isGridlyCrossingPopupVisible(marker),noOverflow:document.documentElement.scrollWidth<=innerWidth};map.closePopup();return result;
 });
 if(!popup.skipped){assert.equal(popup.open,true);assert.equal(popup.county,c.county);assert.equal(popup.noOverflow,true);assert.deepEqual(popup.fields,popup.expected);}
 return{operations,popup,memoryBefore,memoryAfter:await cdp.send('Runtime.getHeapUsage'),domBefore,domAfter:await cdp.send('Memory.getDOMCounters'),cacheNote:'same-document getters/index reuse; cold browser contexts with interception; no real HTTP-cache or native-memory claim'};
};
