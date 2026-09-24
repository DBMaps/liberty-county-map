import fs from 'node:fs';
import crypto from 'node:crypto';
import {root,out,artifacts,loadInventory,read,write} from './inventory.mjs';
const inv=loadInventory(),sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const required=name=>read(`reports/${name==='original-in-scope-failures'?'lp24449a':'lp24449b1'}/${name}.json`);
const identityOut=`${out}/identity-regression`;fs.mkdirSync(identityOut,{recursive:true});
const lines=name=>{const file=`${artifacts}/${name}.jsonl`;return fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];};
const key=r=>`${r.county_id}|${r.place_geoid}`;
const csv=(name,headers,rows)=>fs.writeFileSync(`${identityOut}/${name}.csv`,[headers,...rows].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
const original=required('original-in-scope-failures'),contract=required('home-identity-summary'),search=required('search-recertification'),visible=required('visible-search'),profiles=required('startup-profiles'),nueces=required('nueces-baseline-replay'),integrity=required('integrity'),tests=required('test-comparison'),cohort=required('browser-cohort');
const ringRecords=[...new Map(['transitions-progress','transitions-progress-0','transitions-progress-1'].flatMap(lines).filter(row=>row.sourceHash===sourceHash).map(row=>[row.home.county_id,row])).values()];
const ring={sourceHash,completed:ringRecords.length===254,passed:ringRecords.filter(row=>row.pass).length,records:ringRecords};
write(`${identityOut}/cross-county-transitions.json`,ring);
const homeMap=new Map([...lines('home-progress'),...lines('home-progress-0'),...lines('home-progress-1')].filter(r=>r.sourceHash===sourceHash).map(r=>[key(r),r]));
const homes=[...homeMap.values()],contractMap=new Map(contract.records.map(r=>[key(r),r])),searchMap=new Map(search.records.map(r=>[key(r),r]));
const labelBaseline=required('label-baseline'),labelMap=new Map(labelBaseline.records.map(row=>[key(row),row.expectedDisplayLabel]));
const weatherRequestProof=(row,stage)=>{
 const runtime=row[stage]?.snapshot?.weatherRuntime,point=runtime?.selectedPoint;
 const coordinates=`${row.presentation_lat},${row.presentation_lng}`;
 return {stage,point,pointEndpoint:runtime?.pointEndpoint,pointsLookupEndpoint:runtime?.pointsLookupEndpoint,requestAttempted:runtime?.requestAttempted,pointsRequestAttempted:runtime?.pointsRequestAttempted,
  pass:point?.placeGeoid===row.place_geoid&&point?.countyId===row.county_id
   &&Math.abs(point.lat-row.presentation_lat)<1e-6&&Math.abs(point.lng-row.presentation_lng)<1e-6
   &&runtime?.pointEndpoint===`https://api.weather.gov/alerts/active?point=${coordinates}`
   &&runtime?.pointsLookupEndpoint===`https://api.weather.gov/points/${coordinates}`
   &&runtime?.requestAttempted===true&&runtime?.pointsRequestAttempted===true};
};
const consumerProof=(row,stage)=>{
 const snapshot=row[stage]?.snapshot;
 const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/^(city|town|village) of\s+/,'').replace(/[^\p{L}\p{N}]+/gu,'');
 const name=normalize(labelMap.get(key(row))??row.community_name);
 const owners=Object.values(snapshot?.alertsAuthority||{}).map(source=>{try{return JSON.parse(source.owner);}catch{return null;}});
 return {stage,location:snapshot?.location,kbyg:snapshot?.kbyg,owners,rawCanonicalName:row.community_name,expectedDisplayLabel:labelMap.get(key(row)),baselineFormatterApplied:true,
  locationPass:normalize(snapshot?.location).includes(name),kbygPass:normalize(snapshot?.kbyg).includes(name),
  alertsPass:owners.length===3&&owners.every(owner=>owner?.[0]===`place-${row.place_geoid}`&&owner?.[1]===row.county_id)};
};
for(const row of homes){
 row.weatherRequestProof=['reloaded','returned'].map(stage=>weatherRequestProof(row,stage));
 row.consumerProof=['reloaded','returned'].map(stage=>consumerProof(row,stage));
 row.checks={...row.checks,weatherRequest:row.weatherRequestProof.every(p=>p.pass),locationLabel:row.consumerProof.every(p=>p.locationPass),kbygLabel:row.consumerProof.every(p=>p.kbygPass),alertsOwner:row.consumerProof.every(p=>p.alertsPass)};
 row.pass=row.pass&&Object.values(row.checks).every(Boolean);
}
const freeze=required('freeze-three-hazards'),settings=read('.artifacts/lp24449b1/freeze/settings.json');
const geometry=read('.artifacts/lp24449b1/freeze-geometry/browser.json');
const savedPlaces=required('freeze-saved-places');
const clearComparison=required('freeze-clear-comparison');
const homeReadPerformance=required('home-read-performance');
const textSizeBaseline=required('text-size-baseline');
const networkFiles=['home-network-0','home-network-1'].flatMap(name=>{const file=`${out}/${name}.json`;return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];});
const routes=['session.cjs','freeze-verify-browser.cjs','freeze-verify-settings.cjs','freeze-geometry.cjs'].map(name=>{const source=fs.readFileSync(`${root}/tools/lp24449b1/${name}`,'utf8');return {file:`tools/lp24449b1/${name}`,sha256:crypto.createHash('sha256').update(source).digest('hex'),methodAllowlist:/\['GET',\s*'HEAD',\s*'OPTIONS'\]\.includes/.test(source),serviceWorkersBlocked:/serviceWorkers:\s*['"]block['"]/.test(source),webSocketsClosed:source.includes('routeWebSocket')};});
const backend={allowedProductionWrites:0,policy:'Every page starts behind a GET/HEAD/OPTIONS allowlist; mutation requests abort before any network continuation, external reads are blocked or fulfilled locally, service workers are blocked and WebSockets closed.',routes,blockedMutationRequests:[...networkFiles.flatMap(r=>r.blockedWrites||[]),...(search.evidence?.blockedWrites||[]),...(visible.network?.blockedWrites||[]),...(freeze.network?.blockedWrites||[]),...(settings.blockedRequests||[]),...(geometry.blockedRequests||[])],passed:routes.every(r=>r.methodAllowlist&&r.serviceWorkersBlocked&&r.webSocketsClosed)};
backend.blockedMutationRequests.push(...ring.records.flatMap(row=>row.network?.blockedWrites||[]),...(nueces.network?.blockedWrites||[]),...(savedPlaces.network?.blockedWrites||[]));
backend.observationScope='Retained request records are examples from completed runs; interrupted runs and startup profiles may lack complete request logs. The same pre-navigation route policy blocks all mutation methods in every run.';
write(`${identityOut}/backend-safety.json`,backend);
const normalizeFailure=s=>s.replace(/ \([\d.]+ms\)$/,'');
const failuresOf=r=>new Set(r.failures.filter(x=>x!=='✖ failing tests:').map(normalizeFailure));
const repairedFailures=failuresOf(tests.runs.find(r=>!r.baseline)),baselineFailures=failuresOf(tests.runs.find(r=>r.baseline));
const newTestFailures=[...repairedFailures].filter(x=>!baselineFailures.has(x));
const failureDetails=kind=>{
 const log=fs.readFileSync(`${artifacts}/${kind}-suite.log`,'utf8');
 return log.split(/\r?\ntest at /).slice(1).map(block=>{
  const lines=block.split(/\r?\n/),title=normalizeFailure(lines.find(line=>line.startsWith('✖ '))||'');
  return {title,reason:lines.find(line=>/^\s+(?:ReferenceError|AssertionError|Error)\b/.test(line))?.trim()||'Missing error reason'};
 });
};
const repairedDetails=failureDetails('repaired'),baselineDetails=failureDetails('baseline');
const changedTestFailureReasons=repairedDetails.filter(detail=>!baselineDetails.some(prior=>prior.title===detail.title&&prior.reason===detail.reason));
write(`${identityOut}/test-failure-details.json`,{repaired:repairedDetails,baseline:baselineDetails,changedReasons:changedTestFailureReasons});
const replay=original.map(f=>{
 const h=homeMap.get(key(f)),c=contractMap.get(key(f)),s=searchMap.get(key(f)),v=visible.records.find(r=>r.place_geoid===f.place_geoid),n=nueces.records.find(r=>r.originalFailureId===f.originalFailureId);
 let pass=false,proof;
 if(f.code==='HOME_CHOICE_IDENTITY_BINDING_LOSS'){pass=!!(c?.pass&&h?.checks?.save&&h?.checks?.reload);proof=['home-identity-summary.json','home-browser-results.json'];}
 else if(f.code==='HOME_BASELINE_WRONG_CONTEXT'){pass=!!n?.pass;proof=['nueces-baseline-replay.json'];}
 else if(f.code.startsWith('SEARCH_')){pass=!!(s?.pass&&v?.pass);proof=['search-recertification.json','visible-search.json'];}
 else if(f.code==='WEATHER_WRONG_LOCALITY'){pass=!!(h?.checks?.weather&&h?.checks?.weatherRequest&&h?.checks?.save&&h?.checks?.reload&&h?.checks?.returnHome);proof=['home-browser-results.json','weather-locality-recertification.json'];}
 else {pass=!!(h?.checks?.save&&h?.checks?.reload&&h?.checks?.returnHome&&h?.checks?.activeCounty);proof=['home-browser-results.json'];}
 return {originalFailureId:f.originalFailureId,code:f.code,county_id:f.county_id,place_geoid:f.place_geoid,community:f.community,consumer:f.consumer,status:pass?'FIXED':'STILL_FAIL',proof,reason:pass?'Exact original identity and governed operational county pass the mapped final-source reproduction.':'Mapped reproduction missing or one or more required checks failed.'};
});
write(`${identityOut}/home-browser-results.json`,{completed:homes.length===cohort.total,sourceHash,count:homes.length,passed:homes.filter(r=>r.pass).length,records:homes});
for(const shard of [0,1]){
 const inShard=row=>cohort.rows.findIndex(member=>key(member)===key(row))%2===shard;
 const records=homes.filter(inShard),required=cohort.rows.filter(inShard).length;
 write(`${identityOut}/home-browser-results-${shard}.json`,{sourceHash,shard:`${shard}/2`,required,completed:records.length===required,count:records.length,passed:records.filter(row=>row.pass).length,records});
}
write(`${identityOut}/replay-results.json`,{original:original.length,fixed:replay.filter(r=>r.status==='FIXED').length,remaining:replay.filter(r=>r.status!=='FIXED').length,records:replay});
csv('replay-results',['original_failure_id','code','county_id','place_geoid','status','proof'],replay.map(r=>[r.originalFailureId,r.code,r.county_id,r.place_geoid,r.status,r.proof.join('|')]));
const multi=inv.rows.filter(r=>r.is_multi_county).map(row=>{const h=homeMap.get(key(row)),c=contractMap.get(key(row)),s=searchMap.get(key(row));return {...row,checks:{optionAndSerialization:!!c?.pass,visibleSaveReloadReturn:!!h?.pass,localSearch:!!s?.pass},pass:!!(c?.pass&&h?.pass&&s?.pass)};});
write(`${identityOut}/multicounty-recertification.json`,{communities:new Set(multi.map(r=>r.place_geoid)).size,memberships:multi.length,passed:multi.filter(r=>r.pass).length,records:multi});
const weather={scope:'Controlled healthy NWS fixtures verify identity, canonical point, and request input; no live weather availability claim.',search:{tested:search.records.length,passed:search.records.filter(r=>r.checks.weatherPlace&&r.checks.weatherCounty).length},home:{tested:homes.length,passed:homes.filter(r=>r.checks?.weather&&r.checks?.weatherRequest).length},originalFailures:replay.filter(r=>r.code==='WEATHER_WRONG_LOCALITY'),homeRecords:homes.map(r=>({county_id:r.county_id,place_geoid:r.place_geoid,point:r.returned?.snapshot.weatherPoint,runtime:r.returned?.snapshot.weatherRuntime||r.returned?.snapshot.weather,requestProof:r.weatherRequestProof,pass:!!(r.checks?.weather&&r.checks?.weatherRequest)}))};
write(`${identityOut}/weather-locality-recertification.json`,weather);
const same=homes.filter(r=>r.transition?.target.county_id===r.county_id);
const three=freeze.states?.find(r=>r.label==='initial');
const expectedStreets={flooding:'Cook Street and Church Street',debris:'Winfree Street and Flowers Street',other_hazard:'Hope Street and Nancy Street'};
const streetProof=(three?.model||[]).map(m=>{const d=three.dom.find(d=>d.id===m.id);return {type:m.type,expected:expectedStreets[m.type],actual:d?.location,freshness:d?.text.match(/Updated[^\n]*/)?.[0],pass:d?.location===expectedStreets[m.type]&&/Updated/.test(d?.text||'')};});
const hazardPass=!!three&&three.markers.length===3&&three.pulse===3&&['locationContext','communityPulse','kbygCommunity','alerts'].every(k=>three.surfaces[k].length===3)&&!three.undefinedm&&streetProof.length===3&&streetProof.every(r=>r.pass)&&new Set(streetProof.map(r=>r.freshness)).size>=2;
const browser={sourceHash,home:{tested:homes.length,required:cohort.total,passed:homes.filter(r=>r.pass).length,counties:new Set(homes.map(r=>r.county_id)).size,multiMemberships:homes.filter(r=>r.is_multi_county).length},search:{tested:search.count,passed:search.passed,sourceHash:search.sourceHash},visibleSearch:{tested:visible.count,required:visible.total,passed:visible.records.filter(r=>r.pass).length,collisionGroups:visible.collisionGroups,collisionIdentities:visible.collisionIdentities},profiles:{tested:profiles.length,passed:profiles.filter(r=>r.pass).length},returnHome:{tested:homes.length,passed:homes.filter(r=>r.checks?.returnHome).length},sameCounty:{tested:same.length,counties:new Set(same.map(r=>r.county_id)).size,passed:same.filter(r=>r.checks?.search&&r.checks?.returnHome).length},crossCounty:{tested:ring.records.length,passed:ring.passed},freeze:{combined:freeze.passed===true,settings:settings.passed===true,geometry:geometry.passed===true,threeHazards:hazardPass,streetProof},tests:{newFailures:newTestFailures,baselineFailureCount:baselineFailures.size,repairedFailureCount:repairedFailures.size},runtime:{homeTotalMs:homes.reduce((n,r)=>n+(r.runtimeMs||0),0),searchTotalMs:search.records.reduce((n,r)=>n+(r.runtimeMs||0),0),slowHome:homes.slice().sort((a,b)=>(b.runtimeMs||0)-(a.runtimeMs||0)).slice(0,10).map(r=>({county:r.county_id,place:r.place_geoid,ms:r.runtimeMs})),slowSearch:search.records.slice().sort((a,b)=>(b.runtimeMs||0)-(a.runtimeMs||0)).slice(0,10).map(r=>({county:r.county_id,place:r.place_geoid,ms:r.runtimeMs})),interpretation:'Headless deterministic harness timings include map rendering, settlement and reload; not human interaction latency.'}};
browser.consumers=Object.fromEntries(['weatherRequest','locationLabel','kbygLabel','alertsOwner','driveOwner','crossingOwner'].map(check=>[check,{tested:homes.length,passed:homes.filter(row=>row.checks?.[check]).length}]));
browser.freeze.savedPlaces=savedPlaces.passed===true;
browser.freeze.historicalClearComparison=clearComparison;
browser.freeze.textSizeBaseline=textSizeBaseline;
browser.runtime.homeReadPerformance=homeReadPerformance;
write(`${identityOut}/browser-summary.json`,browser);
const blockers=[];const gate=(name,pass)=>{if(!pass)blockers.push(name);};
gate('All 2058 Home option/serialization contracts',contract.count===2058&&contract.passed===2058&&contract.sourceHash===sourceHash);
gate('Existing San Antonio region options retain region identity',contract.regionProtection?.length===9&&contract.regionProtection.every(row=>row.pass));
gate('Every required Home browser case on final source',homes.length===cohort.total&&homes.every(r=>r.pass)&&cohort.rows.every(row=>homeMap.get(key(row))?.pass));
gate('All 362 multi-county memberships',multi.length===362&&multi.every(r=>r.pass));
gate('Exact protected Home and same-county cohorts',cohort.total===793&&browser.returnHome.tested===793&&browser.returnHome.passed===793&&browser.sameCounty.tested===763&&browser.sameCounty.passed===763);
gate('All 2058 Search memberships on final source',search.count===2058&&search.passed===2058&&search.sourceHash===sourceHash&&searchMap.size===2058&&inv.rows.every(row=>searchMap.get(key(row))?.pass));
gate('Every original failure replayed and fixed',replay.length===369&&replay.every(r=>r.status==='FIXED'));
gate('Visible Search and collision groups',visible.sourceHash===sourceHash&&visible.count===67&&visible.total===67&&visible.collisionGroups===22&&visible.collisionIdentities===45&&visible.records.every(r=>r.pass));
gate('Legacy and malformed startup profiles',profiles.length===19&&profiles.every(r=>r.pass&&r.sourceHash===sourceHash));
gate('Nueces baseline replay on final source',nueces.count===17&&nueces.passed===17&&nueces.sourceHash===sourceHash);
gate('254 cross-county ring transitions',ring.records.length===254&&ring.passed===254&&ring.sourceHash===sourceHash&&inv.counties.every((county,index)=>ring.records.some(row=>row.home.county_id===county.countyId&&row.target.county_id===inv.counties[(index+1)%254].countyId&&row.pass)));
gate('Frozen UI',freeze.passed&&settings.passed&&geometry.passed&&hazardPass&&[freeze,settings,geometry].every(r=>r.sourceHash===sourceHash));
gate('Saved-place Search layout',savedPlaces.passed&&savedPlaces.sourceHash===sourceHash);
gate('Observed Text Size limitation matches starting source',textSizeBaseline.sameControlMetrics&&textSizeBaseline.runs.find(run=>!run.baseline)?.sourceHash===sourceHash&&textSizeBaseline.runs.find(run=>run.baseline)?.sourceHash===required('starting-baseline').tracked.find(file=>file.file==='js/app.js').sha256);
gate('Historical clear diagnostic introduces no new failure',clearComparison.comparisonPass&&clearComparison.runs.find(run=>!run.baseline)?.sourceHash===sourceHash);
gate('Historical clear comparison uses exact starting source',clearComparison.runs.find(run=>run.baseline)?.sourceHash===required('starting-baseline').tracked.find(file=>file.file==='js/app.js').sha256);
gate('Production writes blocked',backend.passed);
gate('No new test failures',newTestFailures.length===0);
gate('Existing failures retain baseline causes',repairedDetails.length===repairedFailures.size&&changedTestFailureReasons.length===0);
gate('Label oracle uses unchanged starting-source display formatter',labelBaseline.formatterUnchanged&&labelBaseline.sourceHash===sourceHash&&labelBaseline.baselineSourceHash===required('starting-baseline').tracked.find(file=>file.file==='js/app.js').sha256);
gate('Final-source repeated Home read diagnostic retains explicit county',homeReadPerformance.some(run=>!run.baseline&&run.sourceHash===sourceHash&&run.sample.count===1000&&run.sample.context.place==='4835000'&&run.sample.context.county==='harris-tx'&&run.errors.length===0));
gate('Protected data, markers, prior evidence unchanged',integrity.protectedPass&&integrity.markerPass&&integrity.priorEvidencePass&&integrity.productSourceSha256===sourceHash);
const deferredCodes=['PROVIDER_HEALTH_FALSE','CROSSING_ELIGIBLE_PACKAGE_MISSING','PULSE_PUBLISHED_COUNT_STALE_AFTER_CLEAR','FILTER_COUNTY_WRONG_SCOPE'];
const oldLedger=read('reports/lp24449/failure-ledger.json');
const deferred=Object.fromEntries(deferredCodes.map(code=>[code,oldLedger.filter(r=>r.code===code).length]));
const decision=blockers.length?'HOLD':'APPROVE';
write(`${identityOut}/failure-ledger.json`,{decision,blockers,remainingOriginalFailures:replay.filter(r=>r.status!=='FIXED'),newHomeFailures:homes.filter(r=>!r.pass).map(r=>({county:r.county_id,place:r.place_geoid,checks:r.checks,error:r.error})),newSearchFailures:search.records.filter(r=>!r.pass),residualFamiliesEvaluatedByParentReport:deferred,liveLimitations:['No live external geocoding/provider acquisition certification.','Controlled NWS responses certify locality/request inputs, not live provider health.','Desktop Edge only; Android/iOS native WebView behavior requires device testing.']});
write(`${identityOut}/decision.json`,{decision,sourceHash,blockers,originalFailures:369,fixed:replay.filter(r=>r.status==='FIXED').length,residualFamiliesEvaluatedByParentReport:deferred,generatedAt:new Date().toISOString()});
console.log(JSON.stringify({decision,blockers,home:homes.length,search:search.count,multi:multi.length,fixed:replay.filter(r=>r.status==='FIXED').length}));
