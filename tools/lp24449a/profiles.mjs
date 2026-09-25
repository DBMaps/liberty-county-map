import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {root,out,write,loadInventory} from './inventory.mjs';
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const require=createRequire(import.meta.url),session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
const record=(place,name,county,memberships)=>({zip:'',countyId:county,countyName:'',countyMemberships:memberships,communityKey:place,communityLabel:name,awarenessAreaKey:`place-${place}`,consumerLabel:name,identityType:'PLACE_GEOID',canonicalRegionId:null,resolutionStatus:'manual_confirmed',resolutionMethod:'profile-fixture',sourceVersion:'LP217',confirmedAt:'2026-09-24T00:00:00.000Z',schemaVersion:'LP051.7.home-personalization.v1'});
const saved={version:1,home:null,work:{id:'work',label:'Work fixture',lat:30.0505,lng:-94.889,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},custom:[],favorites:[]};
const cases=[
 {name:'empty',profile:{},expected:null},
 {name:'canonical-single',profile:{gridlyHomePersonalizationV1:record('4801396','Agua Dulce','nueces-tx',['48355'])},expected:['4801396','nueces-tx']},
 {name:'legacy-single',profile:{gridlyHomeTown:'Agua Dulce',gridlySettingsV1:{community:{homeTown:'Agua Dulce',awarenessArea:'Agua Dulce',awarenessAreaKey:'nueces-tx-agua-dulce',countyId:'nueces-tx'}}},expected:['4801396','nueces-tx']},
 {name:'legacy-single-name-only',profile:{gridlyHomeTown:'Palestine'},expected:['4854708','anderson-tx']},
 {name:'legacy-settings-single-no-county',profile:{gridlySettingsV1:{community:{homeTown:'Palestine'}}},expected:['4854708','anderson-tx']},
 {name:'legacy-region-name-collision',profile:{gridlyHomeTown:'Spring Branch',gridlySettingsV1:{community:{homeTown:'Spring Branch',awarenessArea:'Spring Branch',awarenessAreaKey:'comal-tx-spring-branch',countyId:'comal-tx'}}},expected:['4869608','comal-tx']},
 {name:'canonical-multi-explicit',profile:{gridlyHomePersonalizationV1:record('4827300','Frankston','henderson-tx',['48001','48213'])},expected:['4827300','henderson-tx']},
 {name:'legacy-multi-explicit',profile:{gridlyHomeTown:'Frankston',gridlySettingsV1:{community:{homeTown:'Frankston',awarenessArea:'Frankston',awarenessAreaKey:'henderson-tx-frankston',countyId:'henderson-tx'}}},expected:['4827300','henderson-tx']},
 {name:'legacy-county-occurrence-key',profile:{gridlyHomeTown:'Frankston',gridlySettingsV1:{community:{homeTown:'Frankston',awarenessAreaKey:'henderson-tx-frankston'}}},expected:['4827300','henderson-tx']},
 {name:'canonical-outranks-stale-settings',profile:{gridlyHomePersonalizationV1:record('4827300','Frankston','henderson-tx',['48001','48213']),gridlySettingsV1:{community:{homeTown:'Frankston',awarenessAreaKey:'anderson-tx-frankston',countyId:'anderson-tx'}}},expected:['4827300','henderson-tx']},
 {name:'multi-missing-county',profile:{gridlyHomePersonalizationV1:record('4827300','Frankston',null,['48001','48213']),gridlyHomeTown:'Frankston'},expected:null},
 {name:'legacy-multi-name-only',profile:{gridlyHomeTown:'Frankston'},expected:null},
 {name:'legacy-multi-default-county-is-member',profile:{gridlyHomeTown:'Cleveland'},expected:null},
 {name:'legacy-multi-lowercase-name',profile:{gridlyHomeTown:'cleveland'},expected:null},
 {name:'work-only',profile:{gridlySavedPlacesV1:saved},expected:null},
 {name:'home-plus-work',profile:{gridlySavedPlacesV1:{...saved,home:{...saved.work,id:'home',label:'Saved Home fixture'}},gridlyHomePersonalizationV1:record('4827300','Frankston','henderson-tx',['48001','48213'])},expected:['4827300','henderson-tx']},
 {name:'malformed-memberships',profile:{gridlyHomePersonalizationV1:{...record('4827300','Frankston','henderson-tx',['48001','48213']),countyMemberships:{bad:true}}},expected:null},
 {name:'malformed-json',profile:{gridlyHomePersonalizationV1:'{"countyId":'},expected:null},
 {name:'malformed-saved-places',profile:{gridlySavedPlacesV1:{version:1,home:{id:'home',label:'Incomplete'},work:null}},expected:null,allowSavedNormalization:true},
];
const results=[];
const inventory=loadInventory();
try {for(const test of cases){
 const {page,context,evidence}=await session.newPage(test.profile);
 await page.addScriptTag({path:`${root}/tools/lp24449a/runtime-probe.js`});
 await page.evaluate(()=>lp24449a.settle());
 const result=await page.evaluate(async()=>({identity:lp24449a.identity(),weather:gridlyResolveGovernedWeatherPoint(),search:(await gridlySearchAddress('Frankston, Henderson County, TX')).map(r=>r.placeGeoid),bytes:lp24449a.bytes(),chooser:!!document.querySelector('[data-v2-action="settings-change-home-area"]')}));
 const expectedRow=test.expected&&inventory.rows.find(r=>r.place_geoid===test.expected[0]&&r.county_id===test.expected[1]);
 const checks={identity:test.expected?result.identity.place===test.expected[0]&&result.identity.county===test.expected[1]:result.identity.type==='NONE',canonicalCoordinates:!expectedRow||(Math.abs(result.identity.lat-expectedRow.presentation_lat)<1e-6&&Math.abs(result.identity.lng-expectedRow.presentation_lng)<1e-6),searchUsable:result.search.includes('4827300'),startupNoErrors:evidence.errors.length===0,savedPlacesPreserved:!!test.allowSavedNormalization||!test.profile.gridlySavedPlacesV1||result.bytes.gridlySavedPlacesV1===JSON.stringify(test.profile.gridlySavedPlacesV1)};
 results.push({...test,sourceHash,result,checks,pass:Object.values(checks).every(Boolean),errors:evidence.errors});
 console.log(JSON.stringify({name:test.name,checks,identity:result.identity}));await context.close();
 write(`${out}/startup-profiles.json`,results);
}}finally{await session.close();}
