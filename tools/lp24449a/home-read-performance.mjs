import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {root,out,artifacts,write} from './inventory.mjs';
const require=createRequire(import.meta.url),runs=[];
for(const baseline of [true,false]){
 const session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true,baseline});
 try {
  const {page,evidence}=await session.newPage();
  await page.addScriptTag({path:`${root}/tools/lp24449a/runtime-probe.js`});
  const setup=await page.evaluate(async baseline=>{
   const start=performance.now();
   const group=getGridlyManualAwarenessAreaOptions().find(group=>group.countyId==='harris-tx');
   const option=group.communities.find(option=>option.label==='Houston');
   const saved=baseline?saveGridlyHomeTownPreference(option.value):gridlySaveCanonicalMultiCountyPlaceHome(option.canonicalResolution,'lp24449a-home-read-performance',group.countyId);
   await lp24449a.settle();
   return {saved,elapsedMs:performance.now()-start,context:lp24449a.identity(),getterCalls:gridlySelectedAwarenessAreaResolutionCache.totalGetterCalls};
  },baseline);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const sample=await page.evaluate(()=>{
   const count=1000,start=performance.now();let area;
   for(let i=0;i<count;i++)area=getGridlySelectedAwarenessArea({homeOnly:true});
   return {count,elapsedMs:performance.now()-start,area:{key:area?.key,county:area?.countyId,place:area?.placeGeoid},context:lp24449a.identity()};
  });
  const {profile}=await cdp.send('Profiler.stop');await cdp.detach();
  const name=baseline?'baseline':'repaired';write(`${artifacts}/home-read-${name}.cpuprofile`,profile);
  const nodes=new Map(profile.nodes.map(node=>[node.id,node])),descendants=new Set();
  const visit=id=>{if(descendants.has(id))return;descendants.add(id);for(const child of nodes.get(id)?.children||[])visit(child);};
  for(const node of profile.nodes)if(node.callFrame.functionName==='gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity')visit(node.id);
  const run={baseline,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(`${root}/${baseline?'.artifacts/lp24449a/baseline-app.js':'js/app.js'}`)).digest('hex'),setup,sample,canonicalResolverSamples:profile.samples?.filter(id=>descendants.has(id)).length,totalSamples:profile.samples?.length,errors:evidence.errors};
  runs.push(run);write(`${out}/home-read-performance.json`,runs);console.log(JSON.stringify(run));
 }finally{await session.close();}
}
