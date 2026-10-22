// Production-derived comparison; never reads or overwrites the development audit.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const dir=path.resolve(process.env.REPAIR_OUTPUT_DIR||'.artifacts/community-loading-integration-v1');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const before=read('before-baseline.json'),after=read('after-baseline.json');
const beforeMeta=read('before-metadata.json'),afterMeta=read('after-metadata.json');
assert.equal(before.length,12);assert.equal(after.length,12);
const base=beforeMeta.baselineRef;assert.equal(base,'faac47368da3137b50d53813b7f0299a2f4b1830');
for(const [file,digest] of Object.entries(beforeMeta.servedSources))assert.equal(digest,hash(cp.execFileSync('git',['show',base+':'+file],{maxBuffer:24*1024*1024})),file);
for(const [file,digest] of Object.entries(afterMeta.servedSources))assert.equal(digest,hash(fs.readFileSync(file)),file);
function cpu(file){
  const profile=read(file),parents=new Map(),nodes=new Map(profile.nodes.map(node=>[node.id,node])),totals=new Map();
  for(const node of profile.nodes)for(const id of node.children||[])parents.set(id,node.id);
  for(let i=0;i<(profile.samples||[]).length;i++){
    let id=profile.samples[i];const delta=(profile.timeDeltas[i]||0)/1000;
    while(id){const name=nodes.get(id).callFrame.functionName;totals.set(name,(totals.get(name)||0)+delta);id=parents.get(id);}
  }
  return {selectorMs:totals.get('gridlySelectConsumerVisibleCrossings')||0,popupMs:totals.get('buildPopup')||0,diagnosticStackMs:totals.get('gridlyGetInvalidRoadLabelCaller')||0};
}
function metric(run,phase){
  const snapshot=run.snapshot,bodies=snapshot.resources.filter(row=>/production-crossings\.geojson/.test(row.url)),probes=snapshot.resources.filter(row=>/assets\/markers\//.test(row.url));
  const index=run.mode==='cold'?0:Number(run.mode.split('-')[1]);
  assert.deepEqual(run.errors,[]);assert.equal(run.usability.sheetVisible,true);assert.equal(run.usability.county,run.county);assert.equal(run.usability.place,run.place);
  return {phase,case:run.case,mode:run.mode,bootstrapMs:snapshot.diag.startupCompletedAtMs,usableMs:run.usability.paintAt,clickPaintMs:run.usability.hostClickAndPaintMs,crossings:snapshot.crossings,roads:snapshot.roads,crossingRequests:snapshot.fetch.filter(row=>/production-crossings\.geojson/.test(row.url)).length,crossingBodyBytes:bodies.reduce((sum,row)=>sum+row.encoded,0),crossingTransferBytes:bodies.reduce((sum,row)=>sum+row.transfer,0),markerProbeRequests:probes.length,markerProbeBytes:probes.reduce((sum,row)=>sum+row.encoded,0),longTaskCount:snapshot.longTasks.length,longestTaskMs:Math.max(0,...snapshot.longTasks.map(row=>row.ms)),blockingAbove50Ms:snapshot.longTasks.reduce((sum,row)=>sum+Math.max(0,row.ms-50),0),...cpu(`${phase}-${run.case}-${index}.cpuprofile`)};
}
const measurements=[],parity=[];
for(let i=0;i<after.length;i++){
  const a=after[i],b=before[i];assert.equal(a.case,b.case);assert.equal(a.mode,b.mode);
  for(const key of ['inventoryIds','consumerIds'])assert.deepEqual(a.snapshot.dom[key],b.snapshot.dom[key]);
  assert.deepEqual(a.snapshot.area.countyMemberships,b.snapshot.area.countyMemberships);
  for(const key of ['countyId','placeId'])assert.equal(a.snapshot.context[key],b.snapshot.context[key]);
  assert.equal(a.snapshot.dom.camera.zoom,b.snapshot.dom.camera.zoom);
  for(const axis of ['lat','lng'])assert.ok(Math.abs(a.snapshot.dom.camera.center[axis]-b.snapshot.dom.camera.center[axis])<0.00001);
  measurements.push(metric(b,'before'),metric(a,'after'));
  parity.push({case:a.case,mode:a.mode,inventoryCount:a.snapshot.dom.inventoryIds.length,consumerCount:a.snapshot.dom.consumerIds.length,orderedIdsMatch:true,identityAndCameraMatch:true});
}
const cases=['Crosby','Dayton','Dallas','Coldspring'];
const comparison=cases.map(name=>{
  const values=phase=>{const rows=measurements.filter(row=>row.case===name&&row.phase===phase);assert.equal(rows.length,3);return Object.fromEntries(Object.keys(rows[0]).filter(key=>typeof rows[0][key]==='number').map(key=>[key,median(rows.map(row=>row[key]))]));};
  return {case:name,before:values('before'),after:values('after')};
});
if(process.argv.includes('--performance-only')){
  fs.writeFileSync(path.join(dir,'performance-only.json'),JSON.stringify({beforeMeta,afterMeta,measurements,comparison,parity},null,2));
  console.log(JSON.stringify(comparison,null,2));process.exit(0);
}
const functional=[];
for(const name of cases){
  const a=read(`after-${name}-functional.json`),b=read(`before-${name}-functional.json`);
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);assert.deepEqual(a.states.map(s=>s.label),b.states.map(s=>s.label));
  for(const state of a.states){
    const old=b.states.find(row=>row.label===state.label);
    for(const key of ['inventoryIds','consumerIds'])assert.deepEqual(state[key],old[key]);
    for(const key of Object.keys(state.surfaces)){
      const sort=rows=>rows.slice().sort((x,y)=>x.id.localeCompare(y.id));
      assert.deepEqual(sort(state.surfaces[key]),sort(old.surfaces[key]),`${name}/${state.label}/${key}`);
    }
    for(const key of ['reports','hazards'])assert.deepEqual(state.summary[key].slice().sort(),old.summary[key].slice().sort());
    assert.deepEqual(state.weather,old.weather);assert.equal(state.context.type,old.context.type);assert.equal(state.context.countyId,old.context.countyId);
    if(state.context.type!=='AROUND_ME')assert.equal(state.context.placeId,old.context.placeId);
    else {for(const key of ['lat','lng','health'])assert.equal(state.context[key],old.context[key]);}
    assert.equal(state.ui.noOverflow,true);assert.equal(state.ui.missingLabel,false);
  }
  assert.equal(a.nws?.allPassed,true);assert.equal(a.nws.states.length,9);
  if(!a.popup.skipped){assert.equal(a.popup.id,b.popup.id);assert.deepEqual(a.popup.fields,b.popup.fields);}
  functional.push({case:name,pairedStates:a.states.length,checks:a.checks,popupBefore:b.popup,popupAfter:a.popup,nwsStates:a.nws.states.map(state=>state.label)});
}
const activeBefore=read('before-Dayton-active-popup.json'),activeAfter=read('after-Dayton-active-popup.json');
assert.deepEqual(activeBefore.errors,[]);assert.deepEqual(activeAfter.errors,[]);assert.equal(activeBefore.popup.id,activeAfter.popup.id);assert.deepEqual(activeBefore.popup.fields,activeAfter.popup.fields);
const counts=file=>{
  const tap=fs.readFileSync(path.join(dir,file),'utf8');
  const value=key=>Number(tap.match(new RegExp('^# '+key+' (\\d+)','m'))?.[1]);
  return {file,tests:value('tests'),pass:value('pass'),fail:value('fail'),failures:[...tap.matchAll(/^not ok \d+ - (.*)$/gm)].map(match=>match[1])};
};
const suites=['investigation','expanded'].map(name=>{
  const b=counts(`final-tests/before-${name}.tap`),a=counts(`final-tests/after-${name}.tap`);assert.deepEqual(a.failures,b.failures);
  return {name,before:b,after:a,newFailures:[]};
});
const focused=counts('focused-final.tap');assert.equal(focused.tests,56);assert.equal(focused.fail,0);
const result={date:new Date().toISOString(),branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),beforeMeta,afterMeta,measurements,comparison,parity,functional,activePopup:{before:activeBefore.popup,after:activeAfter.popup},suites,focused,allAssertionsPassed:true};
fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({comparison,pairedSafetyStates:functional.reduce((sum,row)=>sum+row.pairedStates,0),nwsBrowserStates:functional.reduce((sum,row)=>sum+row.nwsStates.length,0),suites,focused},null,2));
