import fs from 'node:fs';
import path from 'node:path';
import { validateGovernedNonPlaceAnchors } from './export-governed-non-place-anchors.mjs';

export const RADII_MILES=Object.freeze([5,10,25]);
export const CORE_CATEGORIES=Object.freeze(['FUEL','GROCERY','LODGING','HOSPITAL','PHARMACY','RESTAURANT','CONVENIENCE']);
export const METADATA_CLASSES=Object.freeze(['SPATIAL_METADATA_CONSISTENT','SPATIAL_METADATA_CONFLICT','SPATIAL_METADATA_INCOMPLETE','SPATIAL_METADATA_REVIEW_REQUIRED']);
export const RURAL_TAIL=Object.freeze(['King','Loving','Borden','Roberts','Kent','Glasscock','Kenedy','Terrell','Foard','Motley','Sterling','Stonewall','Irion','Cottle','Cochran']);

export function haversineMiles(a,b){
 const p=Math.PI/180,lat1=Number(a.latitude)*p,lat2=Number(b.latitude)*p;
 const dlat=lat2-lat1,dlon=(Number(b.longitude)-Number(a.longitude))*p;
 const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
 return 3958.7613*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function radiusCounts(anchor,pois,category='ALL'){
 const distances=pois.filter(p=>category==='ALL'||p.category===category).map(p=>haversineMiles(anchor,p)).sort((a,b)=>a-b);
 return {nearestMiles:distances[0]??null,within5:distances.filter(d=>d<=5).length,within10:distances.filter(d=>d<=10).length,within25:distances.filter(d=>d<=25).length};
}
export function metadataClassification(record){
 const region=String(record.sourceRegion??'').trim().toUpperCase(),locality=String(record.sourceLocality??'').trim(),postcode=String(record.sourcePostcode??'').trim();
 if(!region&&!locality&&!postcode)return 'SPATIAL_METADATA_INCOMPLETE';
 if(region&&region!=='TX'&&region!=='TEXAS')return 'SPATIAL_METADATA_CONFLICT';
 if(record.localityConflict===true||record.postcodeConflict===true||record.countyLabelConflict===true)return 'SPATIAL_METADATA_CONFLICT';
 if(record.localityConflict===null||record.postcodeConflict===null||record.countyLabelConflict===null)return 'SPATIAL_METADATA_REVIEW_REQUIRED';
 return 'SPATIAL_METADATA_CONSISTENT';
}
export function shardFanout(anchor,radiusMiles){
 const latDelta=radiusMiles/69,lonDelta=radiusMiles/(69*Math.cos(Number(anchor.latitude)*Math.PI/180));
 const ys=[Math.floor(anchor.latitude-latDelta),Math.floor(anchor.latitude+latDelta)];
 const xs=[Math.floor(anchor.longitude-lonDelta),Math.floor(anchor.longitude+lonDelta)];
 return (ys[1]-ys[0]+1)*(xs[1]-xs[0]+1);
}

const pending=(schemaVersion,extra={})=>({schemaVersion,executionState:'NOT_EXECUTED_OWNER_LOCAL_INPUTS_ABSENT',...extra});
export function pendingReports({counties,places,cohort}){
 const placeRows=Object.entries(places).map(([communityId,p])=>({communityId,identityType:'CANONICAL_PLACE',placeGeoid:communityId,anchor:{latitude:p.lat,longitude:p.lon},measurement:'NOT_EXECUTED'}));
 const common={standaloneAuthorityRows:391772,radiiMiles:RADII_MILES,coreCategories:CORE_CATEGORIES};
 return {
  'county-coverage.json':pending('gridly.lp24111.d4.counties.v1',{...common,expectedCountyCount:254,accountedCountyCount:counties.length,withoutPois:0,rows:counties.map(c=>({countyFips:c.fips,countyName:c.countyName,measurement:'NOT_EXECUTED'}))}),
  'community-radius-coverage.json':pending('gridly.lp24111.d4.places.v1',{...common,canonicalPlaceCount:1859,measuredPlaceCount:0,missingPlaceAnchors:0,invalidPlaceCoordinates:0,rows:placeRows}),
  'governed-non-place-coverage.json':pending('gridly.lp24111.d4.non-place.v1',{...common,expectedCount:29,measuredCount:0,governedInventory:{total:29,houstonRegions:15,sanAntonioRegions:9,ordinaryCommunities:5},noFabricatedPlaceGeoids:true,tarkington:{identityType:'GOVERNED_NON_PLACE',placeGeoid:null,measurement:'NOT_EXECUTED'},rows:[]}),
  'category-accessibility.json':pending('gridly.lp24111.d4.accessibility.v1',{...common,communityCount:1888}),
  'metadata-conflicts.json':pending('gridly.lp24111.d4.metadata.v1',{requiredClassifications:METADATA_CLASSES,recordsAudited:0,sourceFieldsRewritten:false,retainedSample:{name:'Hitachi Energy Jefferson City',spatialCounty:'King County, Texas',sourceRegion:'MO',sourceLocality:'Jefferson City',sourcePostcode:'65101-5032',confidence:0.886,classification:'SPATIAL_METADATA_CONFLICT'}}),
  'brand-coverage.json':pending('gridly.lp24111.d4.brands.v1',{authorityRole:'DESCRIPTIVE_NOT_IDENTITY_AUTHORITY'}),
  'rural-tail-coverage.json':pending('gridly.lp24111.d4.rural.v1',{requiredCount:15,kingRawAuthorityContext:14,rows:RURAL_TAIL.map(countyName=>({countyName,measurement:'NOT_EXECUTED'}))}),
  'lp24110-cohort-reconciliation.json':pending('gridly.lp24111.d4.cohorts.v1',{expectedCount:22,accountedCount:cohort.communities.length,communityCount:cohort.communities.length,runtimeClaim:false,rows:cohort.communities.map(c=>({...c,authorityCapability:'NOT_EXECUTED'}))}),
  'owner-poc-coverage-reconciliation.json':pending('gridly.lp24111.d4.owner-poc.v1',{required:['Dayton / Liberty','Tarkington','Pecos'],rows:[]}),
  'community-coverage-quality.json':pending('gridly.lp24111.d4.quality.v1',{classes:['ROBUST_LOCAL_COVERAGE','BASIC_LOCAL_COVERAGE','REGIONAL_DEPENDENCY','SPARSE_RURAL_EXPECTED','CATEGORY_GAP','METADATA_REVIEW_REQUIRED'],logic:'Classification requires radius/category evidence and rural context; no single statewide count threshold is used.'}),
  'coverage-fanout.json':pending('gridly.lp24111.d4.fanout.v1',{communityCount:1888,radiiMiles:RADII_MILES,architecture:'EXISTING_ONE_DEGREE_SHARDS_NOT_REGENERATED'}),
  'attribution-source-inventory.json':pending('gridly.lp24111.d4.sources.v1',{reviewState:'LEGAL_REVIEW_REQUIRED',legalConclusion:false}),
  'osm-supplement-evaluation.json':pending('gridly.lp24111.d4.osm.v1',{decision:'INSUFFICIENT_EVIDENCE',merged:false,odblReview:'LEGAL_REVIEW_REQUIRED'}),
  'exception-ledger.json':{schemaVersion:'gridly.lp24111.d4.exceptions.v1',exceptions:[{id:'REMAINING_PHASE_D_MEASUREMENTS_NOT_EXECUTED',severity:'BLOCKER'},{id:'D4_OWNER_LOCAL_STANDALONE_AUTHORITY_ABSENT',severity:'BLOCKER'},{id:'D4_29_ANCHOR_EXPORT_ABSENT',severity:'BLOCKER'},{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'},{id:'LEGAL_REVIEW_REQUIRED',severity:'BLOCKER'}]},
  'certification.json':{schemaVersion:'gridly.lp24111.d4.certification.v1',executiveResult:'PHASE_D4_MEASUREMENT_INCOMPLETE',productViability:'OVERTURE_TEXAS_POI_AUTHORITY_NOT_YET_PRODUCT_VIABLE',osmSupplementDecision:'INSUFFICIENT_EVIDENCE',productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',zeroCostContract:'NON_RUNTIME',legalState:'LEGAL_REVIEW_REQUIRED',mergeRecommendation:'MERGE_FAIL_CLOSED_D4_TOOLING_ONLY_DO_NOT_CERTIFY',nextAction:'Restore identity-governed-eligible.parquet and the governed 29-anchor export under owner-local/lp24111, then run npm run execute:lp24111-coverage.'}
 };
}

export function validateEnvelope(envelope){
 const r=envelope?.reports??{},gate={countyRows:r['county-coverage.json']?.rows?.length===254,placeRows:r['community-radius-coverage.json']?.rows?.length===1859,measuredPlaces:r['community-radius-coverage.json']?.measuredPlaceCount===1859,nonPlaceRows:r['governed-non-place-coverage.json']?.rows?.length===29,measuredNonPlaces:r['governed-non-place-coverage.json']?.measuredCount===29,noMissingAnchors:r['community-radius-coverage.json']?.missingPlaceAnchors===0&&r['governed-non-place-coverage.json']?.missingAnchors===0,metadata:r['metadata-conflicts.json']?.recordsAudited===391772,cohorts:r['lp24110-cohort-reconciliation.json']?.rows?.length===22,fanout:r['coverage-fanout.json']?.executionState==='OWNER_LOCAL_MEASURED',sources:r['attribution-source-inventory.json']?.executionState==='OWNER_LOCAL_MEASURED',runtime:r['certification.json']?.productionPoiSearch==='NOT_LAUNCHED_NOT_CERTIFIED'};
 return {passed:Object.values(gate).every(Boolean),gates:gate};
}

const root=path.resolve(import.meta.dirname,'../..'),args=new Set(process.argv.slice(2));
if(args.has('--execute')){
 const required=['identity-governed-eligible.parquet','governed-non-place-anchors.json'];
 const missing=required.filter(f=>!fs.existsSync(path.join(root,'owner-local/lp24111',f)));
 if(missing.length)throw Error(`D.4 fail-closed: missing owner-local inputs: ${missing.join(', ')}`);
 const anchorEnvelope=JSON.parse(fs.readFileSync(path.join(root,'owner-local/lp24111/governed-non-place-anchors.json'),'utf8'));
 if(anchorEnvelope.schemaVersion!=='gridly.lp24111.governed-non-place-anchors.v1'||anchorEnvelope.count!==anchorEnvelope.rows?.length)throw Error('D.4 fail-closed: governed non-PLACE anchor envelope is invalid');
 validateGovernedNonPlaceAnchors(anchorEnvelope.rows);
 throw Error('D.4 execution requires the owner DuckDB measurement adapter; no upstream data was fetched or regenerated.');
}
