import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {authority,sha256,serialize,reconcile,validateGeometry,validateProposal,FAIL_CLOSED} from '../tools/acquire-certify-san-antonio-regionalization-sources.mjs';

const portal={id:'CITY-ORG'};
const official={owner:'CoSAGIS',orgId:'CITY-ORG',url:'https://services.arcgis.com/example/arcgis/rest/services/areas/FeatureServer'};
const polygon={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
const records=(n,prefix='Area')=>Array.from({length:n},(_,i)=>({stableId:i+1,NAME:`${prefix} ${i+1}`,geometry:polygon}));

test('authority requires City owner, organization, and service host',()=>assert.equal(authority(official,portal).certified,true));
test('third-party owner and organization are rejected',()=>{assert.equal(authority({...official,owner:'plausible-user'},portal).certified,false);assert.equal(authority({...official,orgId:'OTHER'},portal).certified,false);});
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
