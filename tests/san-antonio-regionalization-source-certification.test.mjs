import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {authority,discover,sha256,serialize,reconcile,validateGeometry,validateProposal,FAIL_CLOSED} from '../tools/acquire-certify-san-antonio-regionalization-sources.mjs';

const portal={id:'CITY-ORG'};
const official={id:'official-item',title:'SA Tomorrow Regional Centers and Community Areas',owner:'CoSAGIS',orgId:'CITY-ORG',type:'Feature Service',url:'https://services.arcgis.com/example/arcgis/rest/services/areas/FeatureServer'};
const service={serviceItemId:'official-item',name:'SA Tomorrow',layers:[]};
const polygon={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
const records=(n,prefix='Area')=>Array.from({length:n},(_,i)=>({stableId:i+1,NAME:`${prefix} ${i+1}`,geometry:polygon}));

test('authority requires City owner, consistent organization, and matching service identity',()=>assert.equal(authority(official,portal,service).certified,true));
test('Hub portal without orgId can use direct official item and service evidence',()=>{const result=authority({...official,orgId:undefined},{},service);assert.equal(result.certified,true);assert.equal(result.evidence.itemOwner,'CoSAGIS');assert.equal(result.evidence.serviceItemId,'official-item');});
test('third-party item is rejected',()=>assert.equal(authority({...official,owner:'plausible-user'},portal,service).certified,false));
test('matching-title item with wrong owner is rejected',()=>assert.equal(authority({...official,owner:'title-matcher'},portal,service).certified,false));
test('organization conflict is rejected when both IDs are available',()=>assert.equal(authority({...official,orgId:'OTHER'},portal,service).certified,false));
test('non-authoritative service host is rejected',()=>assert.equal(authority({...official,url:'https://example.net/areas/FeatureServer'},portal,service).certified,false));
test('service metadata pointing at a different item is rejected',()=>assert.equal(authority(official,portal,{...service,serviceItemId:'other-item'}).certified,false));

function discoveryReader({duplicate=false}={}){
  const itemIds=duplicate?['official-item','official-copy']:['official-item'];
  return async url=>{
    if(url.includes('/portals/self'))return {name:'City of San Antonio'};
    if(url.includes('/search?'))return {results:itemIds.map(id=>({id}))};
    const id=itemIds.find(x=>url.includes(`/items/${x}?`));
    if(id)return {...official,id,orgId:undefined,url:`https://services.arcgis.com/example/arcgis/rest/services/${id}/FeatureServer`};
    const serviceId=itemIds.find(x=>url.includes(`/services/${x}/FeatureServer`));
    if(serviceId&&/FeatureServer\?/.test(url))return {serviceItemId:serviceId,name:'SA Tomorrow',layers:[{id:0},{id:1}]};
    if(serviceId&&url.includes('/0?'))return {name:'SA Tomorrow Community Areas'};
    if(serviceId&&url.includes('/1?'))return {name:'SA Tomorrow Regional Centers'};
    throw new Error(`unexpected test URL: ${url}`);
  };
}
test('exact authoritative item/service path succeeds without portal orgId',async()=>{const result=await discover({readJson:discoveryReader()});assert.equal(result.organizationId,null);assert.equal(result.authorityBasis,'DIRECT_ARCGIS_ITEM_AND_SERVICE_METADATA');assert.equal(result.candidates.communityAreas[0].authority.certified,true);});
test('ambiguous multiple authoritative candidates fail closed',async()=>assert.rejects(discover({readJson:discoveryReader({duplicate:true})}),/SOURCE_LAYER_IDENTITY_AMBIGUOUS/));
test('source hashes exact bytes deterministically',()=>assert.equal(sha256(Buffer.from('source\n')),crypto.createHash('sha256').update('source\n').digest('hex')));
test('Community Area stable IDs must be unique',()=>{const x=records(17);x[16].stableId=1;assert.deepEqual(reconcile('communityAreas',x).duplicateIds,['1']);assert.equal(reconcile('communityAreas',x).certified,false);});
test('Regional Center identities and expected registry reconcile exactly',()=>{const names=['Brooks','Downtown','Fort Sam Houston','Greater Airport Area','Highway 151 and Loop 1604','Medical Center','Midtown','Northeast I-35 and Loop 410','Port San Antonio','Rolling Oaks','Stone Oak','Texas A&M-San Antonio','UTSA'];const x=names.map((NAME,i)=>({stableId:i+1,NAME,geometry:polygon}));const r=reconcile('regionalCenters',x);assert.equal(r.certified,true);assert.deepEqual(r.missing,[]);assert.deepEqual(r.additional,[]);});
test('registry count conflict fails certification without forcing expected count',()=>{const r=reconcile('communityAreas',records(16));assert.equal(r.actualCount,16);assert.equal(r.certified,false);});
test('null and invalid geometry fail closed',()=>{assert.throws(()=>validateGeometry([{stableId:1,geometry:null}]),/REQUIRED_GEOMETRY/);assert.throws(()=>validateGeometry([{stableId:1,geometry:{type:'Point',coordinates:[0,0]}}]),/INVALID/);});
test('stable serialization sorts object keys deterministically',()=>assert.equal(serialize({z:1,a:{d:2,b:1}}),'{\n  "a": {\n    "b": 1,\n    "d": 2\n  },\n  "z": 1\n}\n'));
test('consolidation uses every whole atomic area once and preserves PLACE precedence',()=>assert.equal(validateProposal([{id:'SA-CANDIDATE-01',namingStatus:'CONSUMER_NAME_REQUIRES_OWNER_APPROVAL',communityAreaIds:['a','b'],placePrecedence:'INDEPENDENT_GOVERNED_PLACE_WINS'}],['a','b']),true));
test('duplicate consolidation membership is rejected',()=>assert.throws(()=>validateProposal([{id:'SA-CANDIDATE-01',namingStatus:'CONSUMER_NAME_REQUIRES_OWNER_APPROVAL',communityAreaIds:['a','a'],placePrecedence:'INDEPENDENT_GOVERNED_PLACE_WINS'}],['a']),/DUPLICATE/));
test('invented consumer names are rejected',()=>assert.throws(()=>validateProposal([{id:'North San Antonio',namingStatus:'approved',communityAreaIds:['a'],placePrecedence:'INDEPENDENT_GOVERNED_PLACE_WINS'}],['a']),/INVENTED/));
test('tool has explicit complete fail-closed gates and no production write targets',()=>{assert.equal(FAIL_CLOSED.length,9);const src=fs.readFileSync(new URL('../tools/acquire-certify-san-antonio-regionalization-sources.mjs',import.meta.url),'utf8');assert.doesNotMatch(src,/writeFileSync\([^\n]*(?:js\/app\.js|Community-Packages|awareness|houston)/i);assert.match(src,/evidence\/san-antonio-regionalization-source/);});
test('app.js is not changed by test execution',()=>{const p=new URL('../js/app.js',import.meta.url);const a=sha256(fs.readFileSync(p));serialize({fixture:true});assert.equal(sha256(fs.readFileSync(p)),a);});
