import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const OUTPUT_JSON='reports/san-antonio-sa-tomorrow-official-registry.json';
export const OUTPUT_MD='reports/san-antonio-sa-tomorrow-official-registry.md';
export const OUTPUT_MANIFEST='reports/san-antonio-sa-tomorrow-official-source-manifest.json';
export const AUTHORITY_CLASSES=Object.freeze(['CITY_PRIMARY_CURRENT','CITY_PRIMARY_HISTORICAL','CITY_ADOPTED_PLAN','CITY_PLANNING_PAGE','CITY_OFFICIAL_PDF','CITY_OFFICIAL_WORK_SESSION']);
export const STATUS_VALUES=Object.freeze(['ADOPTED','IN_PROGRESS','PLANNED','FUTURE_PHASE','OFFICIAL_AREA_STATUS_UNRESOLVED']);

const AREA_PLANNING=Object.freeze({classification:'CITY_PRIMARY_CURRENT',title:'SA Tomorrow Area Planning',department:'City of San Antonio Planning Department',url:'https://www.sanantonio.gov/Planning/PlanningUrbanDesign/ComprehensivePlanning/SA-Tomorrow-Area-Planning',currentOrHistorical:'CURRENT'});
const COMPREHENSIVE_PLAN=Object.freeze({classification:'CITY_OFFICIAL_PDF',title:'SA Tomorrow Comprehensive Plan',department:'City of San Antonio Planning Department',url:'https://satomorrow.com/wp-content/uploads/2016/08/SA-Tomorrow-Comprehensive-Plan.pdf',publicationOrAdoptionDate:'2016-08-11',currentOrHistorical:'HISTORICAL_ADOPTED_FRAMEWORK'});
const GIS_PORTAL=Object.freeze({classification:'CITY_PRIMARY_CURRENT',title:'City of San Antonio GIS',department:'City of San Antonio Information Technology Services Department',url:'https://gis.sanantonio.gov/',currentOrHistorical:'CURRENT'});

export const REGIONAL_CENTERS=Object.freeze(['Brooks','Downtown','Fort Sam Houston','Greater Airport Area','Highway 151 and Loop 1604','Medical Center','Midtown','Northeast I-35 and Loop 410','Port San Antonio','Rolling Oaks','Stone Oak','Texas A&M-San Antonio','UTSA']);
export const COMMUNITY_AREAS=Object.freeze(['Eastside','Far East','Far North','Far South','Far Southwest','Far West','Near North','Near North Central','Near West','North Central','Northeast','Northwest','South','Southeast','Southwest','West Northwest','Westside']);

const normalizedName=name=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const record=(officialName,type)=>({
  officialName,type,officialIdentifier:null,
  normalizedStatus:'OFFICIAL_AREA_STATUS_UNRESOLVED',
  officialStatusText:'The City source certifies the planning-area identity and type; a current area-specific plan phase or adoption status was not established by the certified sources.',
  adoptionDate:null,dedicatedOfficialPageUrl:null,currentOrHistoricalStatus:'CURRENT_OFFICIAL_FRAMEWORK',
  primaryAuthority:{...AREA_PLANNING},supportingAuthorities:[{...COMPREHENSIVE_PLAN}],officialAliases:[],
  geometryStatus:'NOT_YET_CERTIFIED',
  geometryLeads:[{leadType:'OFFICIAL_GIS_PORTAL',authority:{...GIS_PORTAL},note:'Discovery lead only; no item, layer, service, coordinates, or geometry were acquired or certified.'}],
  governedForFutureConsolidation:true
});

export function reconcileSources(records,sources=[]){
  const conflicts=sources.filter(source=>source.current===true&&source.materialConflict===true);
  return {status:conflicts.length?'SOURCE_CONFLICT_REQUIRES_REVIEW':'RECONCILED',conflicts};
}
export function validateRegistry(records){
  if(!Array.isArray(records))throw new Error('Registry records are required');
  const names=new Set(),ids=new Set();
  for(const item of records){
    const key=normalizedName(item.officialName);
    if(names.has(key))throw new Error(`Duplicate normalized official name: ${item.officialName}`); names.add(key);
    if(item.officialIdentifier!==null){if(ids.has(item.officialIdentifier))throw new Error(`Duplicate official identifier: ${item.officialIdentifier}`);ids.add(item.officialIdentifier);}
    if(!['REGIONAL_CENTER','COMMUNITY_AREA'].includes(item.type))throw new Error(`Invalid type: ${item.type}`);
    if(!STATUS_VALUES.includes(item.normalizedStatus))throw new Error(`Invalid status: ${item.normalizedStatus}`);
    if(!item.primaryAuthority||!AUTHORITY_CLASSES.includes(item.primaryAuthority.classification))throw new Error(`Third-party or missing authority for ${item.officialName}`);
    if(item.geometryStatus!=='NOT_YET_CERTIFIED')throw new Error(`Geometry was improperly certified for ${item.officialName}`);
    for(const forbidden of ['gridlyId','childId','coordinates','geometry','consolidatedInto'])if(Object.hasOwn(item,forbidden))throw new Error(`Forbidden field ${forbidden}`);
  }
  const rc=records.filter(x=>x.type==='REGIONAL_CENTER').length,ca=records.filter(x=>x.type==='COMMUNITY_AREA').length;
  if(rc!==13||ca!==17||records.length!==30)throw new Error(`Framework count mismatch: ${rc} + ${ca} != 30`);
  if(reconcileSources(records).status!=='RECONCILED')throw new Error('SOURCE_CONFLICT_REQUIRES_REVIEW');
  return true;
}
export function buildRegistry(){
  const records=[...REGIONAL_CENTERS.map(x=>record(x,'REGIONAL_CENTER')),...COMMUNITY_AREAS.map(x=>record(x,'COMMUNITY_AREA'))].sort((a,b)=>a.type.localeCompare(b.type)||a.officialName.localeCompare(b.officialName,'en-US'));
  validateRegistry(records);
  return {
    schemaVersion:'gridly.san-antonio-sa-tomorrow-official-registry.v1',certificationStatus:'CERTIFIED_IDENTITY_AND_PROVENANCE_ONLY',
    framework:{regionalCenterCount:13,communityAreaCount:17,totalOfficialSubAreaCount:30,countStatus:'RECONCILED',authority:{...AREA_PLANNING},supportingAuthority:{...COMPREHENSIVE_PLAN},officialLanguage:'The City area-planning framework identifies 13 Regional Centers and 17 Community Areas; together these are the 30 SA Tomorrow sub-areas. Community Areas address portions outside Regional Centers.'},
    governance:{auditOnly:true,runtimeMutationAuthorized:false,productionMutationPerformed:false,relationshipRule:'OFFICIAL_ATOMIC_SUBAREA != GRIDLY_CONSUMER_CHILD',consolidationPerformed:false,gridlyChildRegionsCreated:false,independentPlaceCdpPrecedence:{rule:'INDEPENDENT_GOVERNED_PLACE_WINS',governedIdentityCount:33,sourceReport:'reports/san-antonio-official-source-regionalization-design-audit.json',relationship:'SEPARATE_IDENTITY_SYSTEM_NOT_ABSORBED'}},
    statusVocabulary:[...STATUS_VALUES],sourceAuthorityVocabulary:[...AUTHORITY_CLASSES,'REFERENCE_ONLY_NON_AUTHORITY'],
    reconciliation:{status:'RECONCILED',sourceConflictCount:0,conflicts:[],officialAliasesOrRenames:[],note:'No material current-source conflict or City-proven alias was established; punctuation and names are retained as published.'},
    summary:{frameworkCount:30,regionalCenterCount:13,communityAreaCount:17,adoptedCount:0,inProgressCount:0,futureOrPlannedCount:0,unresolvedStatusCount:30,sourceConflictCount:0,recordsLackingDedicatedOfficialPage:30,recordsLackingGeometryLead:0},
    records,
    geometryMilestone:{status:'NOT_EXECUTED',allGeometryStatus:'NOT_YET_CERTIFIED',nextMilestone:'Acquire and certify City-controlled geometry for each of the 30 atomic sub-areas, pin official item/service/layer and source bytes, validate topology and provenance, and perform no consolidation.'}
  };
}
export const serialize=value=>JSON.stringify(value,null,2)+'\n';
function manifest(){return {schemaVersion:'gridly.san-antonio-sa-tomorrow-official-source-manifest.v1',sources:[AREA_PLANNING,COMPREHENSIVE_PLAN,GIS_PORTAL],referenceOnly:[{classification:'REFERENCE_ONLY_NON_AUTHORITY',title:'Maps San Antonio regions',url:'https://mapssanantonio.com/regions/',mayGovern:false},{classification:'REFERENCE_ONLY_NON_AUTHORITY',title:'Third-party ArcGIS copy: SA Tomorrow Regional Centers and Community Areas',url:null,mayGovern:false}]};}
function markdown(r){const table=type=>r.records.filter(x=>x.type===type).map(x=>`| ${x.officialName} | ${x.normalizedStatus} | ${x.dedicatedOfficialPageUrl?'Yes':'No'} | ${x.geometryLeads.length?'City GIS portal (discovery only)':'None'} |`).join('\n');return `# San Antonio / SA Tomorrow official 30-unit registry certification\n\n## Certification\n\n**CERTIFIED_IDENTITY_AND_PROVENANCE_ONLY** — 13 Regional Centers + 17 Community Areas = 30 unique official atomic planning sub-areas. Geometry and plan status are deliberately not inferred.\n\nPrimary authority: [SA Tomorrow Area Planning](${AREA_PLANNING.url}), City of San Antonio Planning Department. Supporting adopted framework: [SA Tomorrow Comprehensive Plan](${COMPREHENSIVE_PLAN.url}) (adopted August 11, 2016).\n\n## Summary\n\n- Framework / Regional Centers / Community Areas: **30 / 13 / 17**\n- Adopted / in progress / future or planned / unresolved: **0 / 0 / 0 / 30**\n- Current material source conflicts: **0**\n- Dedicated City page not established: **30**\n- Geometry lead absent: **0** (the City GIS portal is only a discovery lead, not certified geometry)\n- Aliases or renames proved by City evidence: **none**\n\n## Regional Centers\n\n| Official name | Status | Dedicated page | Geometry lead |\n|---|---|---:|---|\n${table('REGIONAL_CENTER')}\n\n## Community Areas\n\n| Official name | Status | Dedicated page | Geometry lead |\n|---|---|---:|---|\n${table('COMMUNITY_AREA')}\n\n## Governance boundaries\n\n- **OFFICIAL_ATOMIC_SUBAREA != GRIDLY_CONSUMER_CHILD**.\n- No child ID, coordinate, geometry, consolidation, regionalization, or runtime mutation exists in this registry.\n- Every record remains **NOT_YET_CERTIFIED** for geometry. The City GIS portal is recorded only as a future discovery lead.\n- **INDEPENDENT_GOVERNED_PLACE_WINS** remains a separate 33-identity PLACE/CDP system; none is absorbed here.\n- Future sequence: 30 official atoms → certified City geometry → deterministic consolidation analysis → approximately 8–12 proposals → owner review → separate authorization.\n\n## Reconciliation and limitations\n\nThe exact published names are retained without invented IDs or aliases. No material conflict between the certified current City authority and supporting adopted framework was established. Area-specific adoption/phase evidence and dedicated pages were not sufficiently established, so all 30 records use the explicit fail-closed status **OFFICIAL_AREA_STATUS_UNRESOLVED**. Third-party ArcGIS copies and consumer maps are reference-only and do not certify any record.\n`}
export function writeReports(){const r=buildRegistry();fs.writeFileSync(path.join(ROOT,OUTPUT_JSON),serialize(r));fs.writeFileSync(path.join(ROOT,OUTPUT_MANIFEST),serialize(manifest()));fs.writeFileSync(path.join(ROOT,OUTPUT_MD),markdown(r));return r;}
if(process.argv[1]===fileURLToPath(import.meta.url))writeReports();
