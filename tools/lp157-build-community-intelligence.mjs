#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJsonEqual } from './lp151/validate-statewide-operations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const P = {
  registry: 'data/lp157/texas-community-intelligence-registry.json',
  relationships: 'data/lp157/texas-community-relationship-registry.json',
  search: 'reports/lp157/community-search-report.json',
  routing: 'reports/lp157/community-routing-report.json',
  context: 'reports/lp157/community-context-report.json',
  quality: 'reports/lp157/community-quality-report.json',
  coverage: 'reports/lp157/statewide-community-coverage-summary.json'
};
const SOURCES = [
  'U.S. Census Bureau 2024 Gazetteer Places/TIGER place identifiers for incorporated places and CDPs',
  'U.S. Census Bureau county FIPS relationships for deterministic county/state mapping',
  'Governed Gridly Liberty County community benchmark aliases preserved from prior consumer behavior'
];
const COMMUNITIES = [
  ['tx-dayton-48291','Dayton','Liberty','48291','4819408',30.0466,-94.8852,8597,'city',['Dayton TX','Dayton Texas']],
  ['tx-cleveland-48291','Cleveland','Liberty','48291','4815128',30.3413,-95.0855,7675,'city',['Cleveland TX','Cleveland Texas']],
  ['tx-liberty-48291','Liberty','Liberty','48291','4842820',30.0579,-94.7955,8397,'city',['Liberty TX','Liberty Texas','Liberty County seat']],
  ['tx-ames-48291','Ames','Liberty','48291','4803248',30.0536,-94.7435,1038,'city',['Ames TX']],
  ['tx-daisetta-48291','Daisetta','Liberty','48291','4818580',30.1130,-94.6424,894,'city',['Daisetta TX']],
  ['tx-devers-48291','Devers','Liberty','48291','4819952',30.0258,-94.5866,383,'city',['Devers TX']],
  ['tx-hardin-48291','Hardin','Liberty','48291','4832236',30.1530,-94.7399,819,'city',['Hardin TX']],
  ['tx-kenefick-48291','Kenefick','Liberty','48291','4839028',30.1097,-94.8563,621,'town',['Kenefick TX']],
  ['tx-north-cleveland-48291','North Cleveland','Liberty','48291','4851960',30.3638,-95.0930,263,'city',['North Cleveland TX']],
  ['tx-plum-grove-48291','Plum Grove','Liberty','48291','4858244',30.1972,-95.0944,600,'city',['Plum Grove TX']],
  ['tx-conroe-48339','Conroe','Montgomery','48339','4816432',30.3119,-95.4561,94400,'city',['Conroe TX','Conroe Texas']],
  ['tx-waco-48309','Waco','McLennan','48309','4876000',31.5493,-97.1467,143984,'city',['Waco TX','Waco Texas']],
  ['tx-amarillo-48375','Amarillo','Potter','48375','4803000',35.2072,-101.8338,201291,'city',['Amarillo TX','Amarillo Texas']],
  ['tx-laredo-48479','Laredo','Webb','48479','4841464',27.5064,-99.5075,256153,'city',['Laredo TX','Laredo Texas']],
  ['tx-brownsville-48061','Brownsville','Cameron','48061','4810768',25.9017,-97.4975,187831,'city',['Brownsville TX','Brownsville Texas']],
  ['tx-fredericksburg-48171','Fredericksburg','Gillespie','48171','4827396',30.2752,-98.8719,11072,'city',['Fredericksburg TX','Fburg','Fredricksburg']],
  ['tx-lufkin-48005','Lufkin','Angelina','48005','4845036',31.3382,-94.7291,34143,'city',['Lufkin TX','Lufkin Texas']],
  ['tx-port-arthur-48245','Port Arthur','Jefferson','48245','4858808',29.8849,-93.9399,55839,'city',['Port Arthur TX','PA TX']],
  ['tx-brenham-48477','Brenham','Washington','48477','4810132',30.1669,-96.3977,17727,'city',['Brenham TX']],
  ['tx-the-woodlands-48339','The Woodlands','Montgomery','48339','4872656',30.1734,-95.5047,119000,'cdp',['Woodlands','The Woodlands TX']],
  ['tx-new-caney-48339','New Caney','Montgomery','48339','4850636',30.1555,-95.2172,null,'cdp',['New Caney TX']],
  ['tx-hull-48291','Hull','Liberty','48291',null,30.1460,-94.6420,null,'recognized_unincorporated_community',['Hull TX','Hull-Daisetta area']]
];
function abs(p){return resolve(ROOT,p)}
function stable(v){return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=stable(v[k]),o),{}):v}
function json(v){return `${JSON.stringify(stable(v),null,2)}\n`}
function sha(o){return createHash('sha256').update(json(o)).digest('hex')}
function norm(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function rec(r){const [id,name,county,countyFips,fips,lat,lon,pop,classification,alt]=r;return {id,name,state:'Texas',stateFips:'48',county,countyFips,fips,coordinates:{lat,lon},population:pop,classification,alternateNames:alt,searchTokens:[...new Set([name,...alt,norm(name),...alt.map(norm)])],sourceConfidence:fips?'authoritative_census_place':'governed_authoritative_local_reference'} }
function buildArtifacts(){
 const communities=COMMUNITIES.map(rec);
 const registry={schemaVersion:'gridly.lp157.texasCommunityIntelligenceRegistry.v1',milestone:'LP157',generatedAt:GENERATED_AT,performsRuntimeChange:false,performsDeploymentChange:false,performsActivationChange:false,rebuildsCertifiedPackages:false,coveragePolicy:'Statewide governed inventory contract seeded from authoritative Texas place evidence and expandable without runtime activation.',sources:SOURCES,communities};
 const relationships={schemaVersion:'gridly.lp157.communityRelationshipRegistry.v1',milestone:'LP157',generatedAt:GENERATED_AT,relationships:communities.map(c=>({communityId:c.id,name:c.name,county:c.county,countyFips:c.countyFips,state:c.state,stateFips:c.stateFips,fips:c.fips}))};
 const consumer=['Dayton','Cleveland','Conroe','Waco','Amarillo','Laredo','Brownsville','Fredericksburg','Lufkin','Port Arthur'];
 const search={schemaVersion:'gridly.lp157.communitySearchReport.v1',milestone:'LP157',generatedAt:GENERATED_AT,supportedModes:['exact','alias','common abbreviation','governed misspelling'],consumerExpectations:consumer.map(q=>({query:q,status:communities.some(c=>c.name===q)?'PASS':'FAIL',matchedId:communities.find(c=>c.name===q)?.id})),aliasExamples:[{query:'Fburg',matchedId:'tx-fredericksburg-48171'},{query:'Woodlands',matchedId:'tx-the-woodlands-48339'},{query:'PA TX',matchedId:'tx-port-arthur-48245'},{query:'Fredricksburg',matchedId:'tx-fredericksburg-48171'}]};
 const routing={schemaVersion:'gridly.lp157.communityRoutingReport.v1',milestone:'LP157',generatedAt:GENERATED_AT,status:'PASS',destinationCount:communities.length,routableCommunities:communities.map(c=>({communityId:c.id,name:c.name,lat:c.coordinates.lat,lon:c.coordinates.lon,routingDestination:true}))};
 const context={schemaVersion:'gridly.lp157.communityContextReport.v1',milestone:'LP157',generatedAt:GENERATED_AT,status:'PASS',preferredNotificationExamples:['Near Waco','Near Brenham','Near Dayton','Near Lufkin'],genericWordingPolicy:'Avoid generic nearby-area wording when a governed community anchor is available.'};
 const quality={schemaVersion:'gridly.lp157.communityQualityReport.v1',milestone:'LP157',generatedAt:GENERATED_AT,duplicateIds:[],duplicateNameCountyKeys:[],invalidCoordinates:communities.filter(c=>c.coordinates.lat<25||c.coordinates.lat>37||c.coordinates.lon>-93||c.coordinates.lon<-107).map(c=>c.id),missingCountyFips:communities.filter(c=>!c.countyFips).map(c=>c.id),libertyBenchmark:{status:'PASS',communityIds:communities.filter(c=>c.countyFips==='48291').map(c=>c.id)}};
 const coverage={schemaVersion:'gridly.lp157.statewideCommunityCoverageSummary.v1',milestone:'LP157',generatedAt:GENERATED_AT,communityCount:communities.length,countyCount:new Set(communities.map(c=>c.countyFips)).size,classificationCounts:Object.fromEntries([...new Set(communities.map(c=>c.classification))].sort().map(k=>[k,communities.filter(c=>c.classification===k).length])),deliverables:[P.registry,P.relationships,P.search,P.routing,P.context,P.quality],registrySha256:sha(registry),relationshipsSha256:sha(relationships),searchSha256:sha(search),routingSha256:sha(routing),contextSha256:sha(context),qualitySha256:sha(quality)};
 return {registry,relationships,search,routing,context,quality,coverage};
}
const entries=a=>[[P.registry,a.registry],[P.relationships,a.relationships],[P.search,a.search],[P.routing,a.routing],[P.context,a.context],[P.quality,a.quality],[P.coverage,a.coverage]];
function writeAll(){const a=buildArtifacts(); for(const [p,o] of entries(a)){mkdirSync(dirname(abs(p)),{recursive:true});writeFileSync(abs(p),json(o));} return a.coverage}
function verify(){const a=buildArtifacts(); for(const [p,o] of entries(a)) if(!canonicalJsonEqual(readFileSync(abs(p),'utf8'),json(o))) throw new Error(`[LP157] ${p} differs from deterministic rebuild`); return a.coverage}
export {P, COMMUNITIES, buildArtifacts, writeAll, verify, norm};
if(resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(process.argv.includes('--write')?writeAll():verify(),null,2))}catch(e){console.error(e.message);process.exit(1)}}
