const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
const start=app.indexOf('function getGridlySelectedAwarenessArea(');
const source=app.slice(start,app.indexOf('// Read-only consumer projection',start));
test('canonical Home retains one area object until explicit membership or canonical focus changes',()=>{
 const record={identityType:'PLACE_GEOID',communityKey:'4827300',countyId:'henderson-tx'};
 let point={lat:32.0543013,lng:-95.5059246};
 const h={gridlySelectedAwarenessAreaResolutionCache:{totalGetterCalls:0},gridlyRecordSelectedAwarenessAreaGetterCaller(){},gridlyReadHomePersonalizationRecord:()=>record,
  gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity:()=>({placeGeoid:record.communityKey,memberships:['48001','48213'],area:{key:'place-'+record.communityKey,canonicalMultiCountyPlace:true,...point}}),
  gridlyResolvePersistedCanonicalPlaceOperationalCounty:()=>record.countyId,
  gridlyProjectCanonicalPlaceOperationalCounty:(area,countyId)=>({...area,countyId}),gridlyUserProfile:{},window:{setTimeout(){}}};
 vm.createContext(h);vm.runInContext(source,h);
 const first=h.getGridlySelectedAwarenessArea();
 for(let i=0;i<100;i++)assert.equal(h.getGridlySelectedAwarenessArea(),first,'same governed identity must not churn consumer ownership');
 record.countyId='anderson-tx';const next=h.getGridlySelectedAwarenessArea();assert.notEqual(next,first);assert.equal(next.countyId,'anderson-tx');
 point={lat:null,lng:null};const pending=h.getGridlySelectedAwarenessArea();assert.notEqual(pending,next);
 point={lat:32.0543013,lng:-95.5059246};const hydrated=h.getGridlySelectedAwarenessArea();assert.notEqual(hydrated,pending);assert.equal(hydrated.lat,32.0543013);assert.equal(h.getGridlySelectedAwarenessArea(),hydrated);
});
