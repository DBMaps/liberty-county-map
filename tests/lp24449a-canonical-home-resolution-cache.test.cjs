const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
const start=app.indexOf('function gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity(');
const source=app.slice(start,app.indexOf('\nfunction gridlyLp0517ValidateHomeRecord',start));
function harness(multi=true){
 let scans=0,focus=null;
 const memberships=multi?['48001','48213']:['48001'];
 const place={placeGeoid:'4827300',displayName:'Frankston',countyMemberships:memberships,canonicalIdentity:'PLACE_GEOID',consumerEligible:true,focus:null};
 const county=fips=>({countyFips:fips,get consumerAwarenessAreas(){scans++;return [place];}});
 const registry={'anderson-tx':county('48001'),...(multi?{'henderson-tx':county('48213')}:{})};
 const h={GRIDLY_COUNTY_REGISTRY:registry,normalizeGridlyAwarenessAreaLookupText:s=>s.toLowerCase(),resolveGridlyCanonicalPlacePresentationFocus:()=>focus};
 vm.createContext(h);vm.runInContext(source,h);
 return {h,memberships,record:{identityType:'PLACE_GEOID',communityKey:'4827300',countyMemberships:memberships},scans:()=>scans,focus:value=>focus=value};
}
test('repeated canonical Home reads avoid repeated registry traversal for single and multi-county identity',()=>{
 for(const multi of [false,true]){
  const t=harness(multi),resolve=t.h.gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity;
  const first=resolve(t.record),scans=t.scans();assert.ok(first);
  for(let i=0;i<1000;i++)assert.equal(resolve({...t.record,countyMemberships:[...t.memberships].reverse()}),first);
  assert.equal(t.scans(),scans,'identical reads must not rescan the statewide registry');
  assert.equal(first.area.canonicalMultiCountyPlace,multi);
  assert.equal(first.area.countyId,multi?null:'anderson-tx','cached identity remains unprojected for a multi-county PLACE');
 }
});
test('cached canonical identity never accepts malformed or different membership authority',()=>{
 const t=harness(),resolve=t.h.gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity,valid=resolve(t.record);
 for(const countyMemberships of ['48001',[],['48001'],['48001','48213','48291']])assert.equal(resolve({...t.record,countyMemberships}),null);
 assert.equal(resolve({...t.record,identityType:'OTHER'}),null);
 assert.equal(resolve({...t.record,communityKey:'not-a-place'}),null);
 assert.equal(resolve(t.record),valid);
});
test('canonical Home resolution refreshes when presentation hydrates, changes, or the registry is replaced',()=>{
 const t=harness(),resolve=t.h.gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity;
 const pending=resolve(t.record);assert.equal(pending.area.lat,undefined);
 t.focus({lat:32.0543013,lng:-95.5059246,zoom:12});const hydrated=resolve(t.record);
 assert.notEqual(hydrated,pending);assert.equal(hydrated.area.lat,32.0543013);
 t.focus({lat:32.0543013,lng:-95.5059246,zoom:13});const changed=resolve(t.record);
 assert.notEqual(changed,hydrated);assert.equal(changed.area.zoom,13);
 t.h.GRIDLY_COUNTY_REGISTRY={...t.h.GRIDLY_COUNTY_REGISTRY};
 assert.notEqual(resolve(t.record),changed);
});
