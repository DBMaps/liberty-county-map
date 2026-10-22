// Parameterize the independent production-module NWS harness with actual
// governed county/PLACE points. Transport is explicit fixture data, never live.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const{source,boxFor,registry}=require('./statewide-certification.cjs');
const app=fs.readFileSync('js/app.js','utf8');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
async function main(){
 const registryValue=await registry(app),projection=read('data/generated/gridly-statewide-consumer-community-projection-v1.json').communities,identities=new Map(read('data/lp149/runtime-county-registry.json').identities.map(row=>[row.countyId,row]));
 const preamble=fs.readFileSync('tests/community-loading-nws-safety.test.cjs','utf8').split("test('forecast 503 retries independently")[0];
 const harnessBox={require,console,setTimeout,clearTimeout,setImmediate,AbortController};vm.createContext(harnessBox);vm.runInContext(preamble+';this.fixture={harness,warning,payload,response,initialTime};',harnessBox);const f=harnessBox.fixture;
 const rows=[];
 for(const[county,config]of Object.entries(registryValue)){
  const fips=identities.get(county).fips;if(config.countyFips)assert.equal(config.countyFips,fips);
  const b=boxFor(app,registryValue,county),place=projection.find(row=>row.countyMemberships.includes(fips));
  const area=place?{...place,countyId:county,key:'place-'+place.placeGeoid}:{countyId:county,countyWide:true};
  b.GRIDLY_AWARENESS_AREA_BY_KEY={};b.getGridlySelectedAwarenessArea=()=>area;vm.runInContext(source(app,'gridlyResolveGovernedWeatherPoint'),b);
  const point=b.gridlyResolveGovernedWeatherPoint(),h=f.harness();h.setPoint(point);
  if(place)assert.ok(point,county+'/available governed PLACE point must resolve');
  if(!point){await h.api.fetchNow();assert.equal(h.calls.length,0);assert.equal(h.records().length,0);assert.equal(h.audit().freshEnough,false);rows.push({county,pointAvailable:false,policy:'no governed PLACE point: existing county-wide fail-closed contract',fetchSuppressed:true,warningRetentionTested:false});continue;}
  const id='NWS-'+fips,feature=()=>f.warning(id,{areaDesc:config.name,affectedZones:['https://api.weather.gov/zones/county/TXC'+fips.slice(2)]});
  h.control.alerts=()=>f.response(f.payload(feature()));await h.api.fetchNow();assert.equal(h.records()[0].id,id);assert.equal(h.handoff().accepted,true);const original=JSON.stringify(h.records()[0]);
  h.control.forecast=()=>({ok:false,status:503});await h.api.fetchNow();assert.equal(h.audit().forecastRequestSucceeded,false);assert.equal(h.audit().requestSucceeded,true);assert.equal(h.handoff().accepted,true);
  h.advance(130000);h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();assert.equal(JSON.stringify(h.records()[0]),original);assert.equal(h.audit().freshEnough,false);assert.equal(h.handoff().accepted,true);assert.equal(h.audit().retainedWarningEvidence,true);
  const retained=h.selection().consumerVisibleSituations[0];h.advance(3600000);assert.equal(h.records().length,0);assert.equal(h.handoff(retained).accepted,false);
  h.control.forecast=()=>f.response({properties:{periods:[]}});h.control.alerts=()=>f.response(f.payload(f.warning(id,{expires:new Date(f.initialTime+3*3600000).toISOString(),areaDesc:config.name})));await h.api.fetchNow();assert.equal(h.records()[0].id,id);assert.equal(h.audit().freshEnough,true);
  h.control.alerts=()=>f.response(f.payload(f.warning('CANCEL-'+id,{messageType:'Cancel',references:[{identifier:id}],expires:new Date(f.initialTime+3*3600000).toISOString()})));await h.api.fetchNow();assert.equal(h.records().length,0);
  h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();assert.equal(h.records().length,0);assert.equal(h.audit().freshEnough,false);
  h.control.alerts=()=>f.response(f.payload());await h.api.fetchNow();assert.equal(h.audit().freshEnough,true);assert.equal(h.audit().finalWeatherHealth,'HEALTHY');assert.equal(h.records().length,0);
  // Real point identity, followed by unsupported county-wide state, then A.
  // Old retained evidence must not be resurrected when the identity re-enters.
  h.setPoint(null);await h.api.refreshAwarenessView();h.setPoint(point);h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();assert.equal(h.records().length,0);assert.equal(h.audit().freshEnough,false);
  rows.push({county,pointAvailable:true,point:JSON.parse(JSON.stringify(point)),warningRetentionTested:true,scenarios:9,forecastIndependent:true,identityLineageCoordinatesExpiryPreserved:true,expiryEnforced:true,cancellationClears:true,recovery:true,noResurrection:true,unsupportedReentrySafe:true});
 }
 const cacheHarness=f.harness(),cachePoints=rows.filter(row=>row.pointAvailable).slice(0,10).map(row=>row.point);let cachePoint;
 cacheHarness.control.alerts=()=>f.response(f.payload(f.warning('cache-'+cachePoint.stableIdentity)));
 for(const point of cachePoints){cachePoint=point;cacheHarness.setPoint(point);await cacheHarness.api.fetchNow();assert.ok(cacheHarness.audit().cacheSize<=8);assert.equal(cacheHarness.records()[0].id,'cache-'+point.stableIdentity);}
 assert.equal(cacheHarness.audit().cacheSize,8);const calls=cacheHarness.calls.length;cachePoint=cachePoints[0];cacheHarness.setPoint(cachePoint);await cacheHarness.api.refreshAwarenessView();assert.ok(cacheHarness.calls.length>calls,'evicted governed point must be refetched');assert.equal(cacheHarness.records()[0].id,'cache-'+cachePoint.stableIdentity);
 const output={date:new Date().toISOString(),auditedCounties:rows.length,pointLifecycleTested:rows.filter(row=>row.pointAvailable).length,countywideFailClosedTested:rows.filter(row=>!row.pointAvailable).length,scenarios:rows.reduce((sum,row)=>sum+(row.scenarios||1),0),cache:{governedPoints:cachePoints.length,maxEntries:8,evictionAndRevisitRefetch:true},allAssertionsPassed:true,rows,limitations:['Fixture transport, actual production provider/connector/authority/handoff modules and actual governed point resolver','No live-provider, map DOM, county-wide point fabrication or physical-device certification','Pending UI, authoritative timer callbacks and late A-B-A response cases remain covered by independent focused and mounted-browser suites']};
 const dir=path.resolve(process.env.STATEWIDE_OUTPUT_DIR||'.artifacts/community-loading-statewide');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'nws-county-correctness.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({auditedCounties:output.auditedCounties,pointLifecycleTested:output.pointLifecycleTested,countywideFailClosedTested:output.countywideFailClosedTested,scenarios:output.scenarios}));return output;
}
module.exports={main};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
