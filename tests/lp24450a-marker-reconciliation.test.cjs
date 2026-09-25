const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const app=fs.readFileSync('js/app.js','utf8');
function harness(){
 const queue=[],markers=new Map(),layers=new Set();let records=[],renders=0,fetches=0;
 const box={console,Date,Map,Set,performance:{now:()=>0},gridlyConfigurationReady:{then(){}},requestAnimationFrame:fn=>(queue.push(fn),queue.length),
  gridlyDriveTexasOfficialMarkers:markers,gridlyDriveTexasOfficialLayer:{removeLayer:m=>layers.delete(m),hasLayer:m=>layers.has(m)},
  L:{divIcon(){},marker(){return {addTo(){layers.add(this);return this;},bindPopup(){},getPopup(){return {};}};}},
  gridlyLp045EnsureOfficialMarkerLayerAttached(){},gridlyLp019CrossingVisibilityState:{},gridlyLp019ReadCrossingVisibilitySnapshot:()=>({}),
  gridlyGetDriveTexasConsumerSourceStatusEnvelope:()=>({records}),getGridlyCanonicalAwarenessPresentationContext:()=>({canonicalKey:'current'}),
  gridlyLp0452BaseOfficialMarkerTrace:()=>({}),gridlyLp0452OfficialMarkerConstructionTraceState:{},gridlyBuildOfficialRoadwayProductionMarkerIcon:()=>({options:{}}),
  gridlyLp0393ConsumerDriveTexasPopupHtml:()=>'',gridlyLp0452RecordOfficialMarkerConstructionFailure:(_trace,_stage,error)=>{throw error;},
  gridlyUnifiedIntelligencePrototype:{runtime(){}},refreshGridlyCommunityPulseSharedModel(){},fetch(){fetches++;throw Error('Rendering must not fetch');}};
 box.window=box;vm.createContext(box);
 vm.runInContext(fs.readFileSync('js/gridlyOfficialRoadwayMarkerPublication.js','utf8'),box);
 vm.runInContext(app.match(/function renderGridlyDriveTexasOfficialMarkers\([^]*?^\}/m)[0],box);
 const renderer=box.renderGridlyDriveTexasOfficialMarkers;box.renderGridlyDriveTexasOfficialMarkers=(...a)=>{renders++;return renderer(...a);};
 vm.runInContext(fs.readFileSync('js/gridlyOfficialProviderActivation.js','utf8'),box);
 return {box,markers,layers,set:v=>records=v,notify:()=>box.gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',evidenceChanged:true,reason:'contract-context'}),drain:()=>{let n=0;while(queue.length){assert.ok(++n<5,'bounded scheduler');queue.shift()();}},stats:()=>({renders,fetches,pending:queue.length})};
}
const positive=[{consumerSituationId:'drivetexas:road-a',lat:32.79,lng:-96.77},{consumerSituationId:'drivetexas:road-b',lat:32.80,lng:-96.78}];
test('existing renderer automatically reconciles positive, empty, restoration and failed/recovered envelopes',()=>{
 const h=harness();for(const records of [positive,[],positive,[],positive]){h.set(records);h.notify();h.drain();assert.equal(h.markers.size,records.length);assert.equal(h.layers.size,records.length);assert.deepEqual([...h.markers.keys()],records.map(r=>r.consumerSituationId));}
 assert.equal(h.stats().fetches,0);assert.equal(h.stats().pending,0);
});
test('coalesced publications use latest context, preserve marker identity and do not accumulate',()=>{
 const h=harness();h.set(positive);h.notify();h.set([]);h.notify();h.drain();assert.equal(h.markers.size,0);assert.equal(h.stats().renders,1);
 h.set(positive);h.notify();h.drain();const first=h.markers.get('drivetexas:road-a');
 h.notify();h.notify();h.drain();assert.equal(h.markers.get('drivetexas:road-a'),first);assert.equal(h.layers.size,2);assert.equal(h.stats().renders,3);assert.equal(h.stats().fetches,0);
});
test('unchanged evidence does not schedule a render loop and missing initial map is harmless',()=>{
 const h=harness();h.box.gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',evidenceChanged:false});h.drain();assert.equal(h.stats().renders,0);
 h.box.gridlyDriveTexasOfficialLayer=null;h.notify();h.drain();assert.equal(h.markers.size,0);assert.equal(h.stats().pending,0);
});
