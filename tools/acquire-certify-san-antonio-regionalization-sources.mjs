import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const EVIDENCE_DIR='evidence/san-antonio-regionalization-source';
export const MANIFEST='reports/san-antonio-regionalization-source-certification.json';
export const OFFICIAL_PORTAL='https://cosagis.maps.arcgis.com';
export const EXPECTED={communityAreas:17,regionalCenters:13};
export const EXPECTED_CENTERS=Object.freeze(['Brooks','Downtown','Fort Sam Houston','Greater Airport Area','Highway 151 and Loop 1604','Medical Center','Midtown','Northeast I-35 and Loop 410','Port San Antonio','Rolling Oaks','Stone Oak','Texas A&M-San Antonio','UTSA']);
export const FAIL_CLOSED=Object.freeze(['OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED','SOURCE_LAYER_IDENTITY_AMBIGUOUS','COMMUNITY_AREA_REGISTRY_NOT_CERTIFIED','DUPLICATE_STABLE_IDS','REQUIRED_GEOMETRY_MISSING','SOURCE_IDENTITY_NOT_HASHED_OR_PRESERVED','EXPECTED_COUNT_CONFLICT_UNRECONCILED','TOPOLOGY_PREVENTS_DETERMINISTIC_CONSOLIDATION','NON_AUTHORITATIVE_SOURCE_REQUIRED']);
const TYPES={communityAreas:['community area','community areas'],regionalCenters:['regional center','regional centers']};

export function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
export function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
export function serialize(value){return JSON.stringify(stable(value),null,2)+'\n';}
export function authority(item,portal){
  const url=new URL(item.url||OFFICIAL_PORTAL);
  const approvedHost=new URL(OFFICIAL_PORTAL).hostname;
  const ownerOk=typeof item.owner==='string'&&/^(cosagis|cityofsanantonio)$/i.test(item.owner);
  const orgOk=Boolean(portal?.id)&&item.orgId===portal.id;
  const serviceOk=/^https:\/\//.test(item.url||'')&&(/\.arcgis\.com$/.test(url.hostname)||url.hostname==='gis.sanantonio.gov');
  return {certified:ownerOk&&orgOk&&serviceOk,ownerOk,orgOk,serviceOk,portalId:portal?.id||null,reason:ownerOk&&orgOk&&serviceOk?'CITY_CONTROLLED_ARCGIS_IDENTITY_CONFIRMED':'OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED'};
}
export function reconcile(kind,records,nameField='NAME'){
  const expected=EXPECTED[kind], ids=records.map(x=>String(x.stableId)), names=records.map(x=>String(x[nameField]));
  const duplicates=a=>[...new Set(a.filter((x,i)=>a.indexOf(x)!==i))].sort();
  const out={expectedCount:expected,actualCount:records.length,countMatches:records.length===expected,duplicateIds:duplicates(ids),duplicateNames:duplicates(names)};
  if(kind==='regionalCenters'){out.exactMatches=EXPECTED_CENTERS.filter(x=>names.includes(x));out.missing=EXPECTED_CENTERS.filter(x=>!names.includes(x));out.additional=names.filter(x=>!EXPECTED_CENTERS.includes(x)).sort();}
  out.certified=out.countMatches&&!out.duplicateIds.length&&!out.duplicateNames.length&&records.every(x=>x.geometry);
  return out;
}
export function validateGeometry(records){
  const invalid=[]; for(const r of records){const g=r.geometry;if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!Array.isArray(g.coordinates)||!g.coordinates.length)invalid.push(String(r.stableId));}
  if(invalid.length)throw new Error(`REQUIRED_GEOMETRY_MISSING_OR_INVALID: ${invalid.join(', ')}`);return true;
}
export function validateProposal(groups,atomicIds){
  const used=[]; for(const g of groups){if(!/^SA-CANDIDATE-\d{2}$/.test(g.id)||g.namingStatus!=='CONSUMER_NAME_REQUIRES_OWNER_APPROVAL')throw new Error('INVENTED_OR_UNAPPROVED_CONSUMER_NAME');for(const id of g.communityAreaIds){if(!atomicIds.includes(id))throw new Error('CONSOLIDATION_NOT_WHOLE_ATOMIC_AREA');used.push(id);}if(g.placePrecedence!=='INDEPENDENT_GOVERNED_PLACE_WINS')throw new Error('PLACE_PRECEDENCE_NOT_PRESERVED');}
  if(new Set(used).size!==used.length)throw new Error('DUPLICATE_CONSOLIDATION_MEMBERSHIP');if(used.length!==atomicIds.length)throw new Error('INCOMPLETE_CONSOLIDATION_MEMBERSHIP');return true;
}
function args(argv){const modes=argv.filter(x=>['--discover','--acquire','--verify'].includes(x));if(modes.length!==1)throw new Error('Exactly one of --discover, --acquire, or --verify is required');return {mode:modes[0].slice(2),json:argv.includes('--json')};}
async function getJson(url){const r=await fetch(url,{headers:{'user-agent':'Gridly-owner-source-certification/1'}});if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);return r.json();}
async function portal(){return getJson(`${OFFICIAL_PORTAL}/sharing/rest/portals/self?f=json`);}
async function candidates(portalId,term){const q=encodeURIComponent(`orgid:${portalId} (${term.map(x=>`title:\"${x}\"`).join(' OR ')}) type:\"Feature Service\"`);return (await getJson(`${OFFICIAL_PORTAL}/sharing/rest/search?f=json&num=100&q=${q}`)).results||[];}
async function layerDetails(item){const service=await getJson(`${item.url}?f=json`);const layers=[];for(const x of service.layers||[])layers.push({...x,metadata:await getJson(`${item.url}/${x.id}?f=json`)});return {service,layers};}
export async function discover(){
  const p=await portal();if(!p.id)throw new Error('OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED: portal has no organization id');const found={};
  for(const [kind,terms] of Object.entries(TYPES)){const items=await candidates(p.id,terms);const certified=[];for(const item of items){const a=authority(item,p);if(a.certified)certified.push({...item,authority:a,details:await layerDetails(item)});}found[kind]=certified;}
  return {schemaVersion:'gridly.san-antonio-source-discovery.v1',officialPortal:OFFICIAL_PORTAL,organizationId:p.id,organizationName:p.name||null,candidates:found,writePerformed:false};
}
function selectedLayers(discovery){const out=[];for(const [kind,items] of Object.entries(discovery.candidates)){for(const item of items)for(const layer of item.details.layers){const n=(layer.metadata.name||'').toLowerCase();if(TYPES[kind].some(t=>n.includes(t)))out.push({kind,item,layer});}}return out;}
async function queryBytes(serviceUrl,layerId){const params=new URLSearchParams({f:'geojson',where:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',orderByFields:'OBJECTID ASC'});const url=`${serviceUrl}/${layerId}/query?${params}`;const r=await fetch(url);if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);return {url,params:Object.fromEntries(params),bytes:Buffer.from(await r.arrayBuffer())};}
export async function acquire(){
  const d=await discover(), chosen=selectedLayers(d);for(const kind of Object.keys(TYPES))if(chosen.filter(x=>x.kind===kind).length!==1)throw new Error(`SOURCE_LAYER_IDENTITY_AMBIGUOUS: ${kind}`);
  fs.mkdirSync(path.join(ROOT,EVIDENCE_DIR),{recursive:true});const sources=[];
  for(const x of chosen){const q=await queryBytes(x.item.url,x.layer.id), filename=`${x.kind}.${x.item.id}.layer-${x.layer.id}.source.geojson`;fs.writeFileSync(path.join(ROOT,EVIDENCE_DIR,filename),q.bytes);const json=JSON.parse(q.bytes);const fields=x.layer.metadata.fields||[], oid=(fields.find(f=>f.type==='esriFieldTypeOID')||{}).name||null;const name=(fields.find(f=>/^(name|area_name|center_name)$/i.test(f.name))||{}).name||null;const id=(fields.find(f=>/^(id|area_id|center_id)$/i.test(f.name))||{}).name||oid;if(!name||!id)throw new Error(`COMMUNITY_AREA_REGISTRY_NOT_CERTIFIED: identifying fields absent for ${x.kind}`);const records=json.features.map(f=>({stableId:f.properties[id],NAME:f.properties[name],objectId:oid?f.properties[oid]:null,geometry:f.geometry})).sort((a,b)=>String(a.stableId).localeCompare(String(b.stableId)));validateGeometry(records);const rec=reconcile(x.kind,records);if(!rec.certified)throw new Error(`EXPECTED_COUNT_CONFLICT_UNRECONCILED: ${x.kind}`);sources.push({kind,title:x.item.title,owner:x.item.owner,organizationId:d.organizationId,itemId:x.item.id,itemModified:x.item.modified||null,serviceUrl:x.item.url,serviceType:x.item.type,layerId:x.layer.id,layerName:x.layer.metadata.name,description:x.item.description||x.layer.metadata.description||null,attribution:x.layer.metadata.attribution||null,copyrightText:x.layer.metadata.copyrightText||null,capabilities:x.layer.metadata.capabilities||null,supportedQueryFormats:x.layer.metadata.supportedQueryFormats||null,maxRecordCount:x.layer.metadata.maxRecordCount||null,objectIdField:oid,stableIdField:id,officialNameField:name,spatialReference:x.layer.metadata.extent?.spatialReference||null,geometryType:x.layer.metadata.geometryType,extent:x.layer.metadata.extent||null,featureCount:records.length,filename,byteLength:q.bytes.length,sha256:sha256(q.bytes),acquisitionUrl:q.url,queryParameters:q.params,registry:records.map(({geometry,...r})=>({...r,geometryPresent:Boolean(geometry)})),reconciliation:rec});}
  const manifest={schemaVersion:'gridly.san-antonio-source-certification.v1',deterministicIdentity:{officialPortal:OFFICIAL_PORTAL,organizationId:d.organizationId,sources:sources.sort((a,b)=>a.kind.localeCompare(b.kind))},operationalEvidence:{retrievalTimeExcludedFromGovernedIdentity:true},status:'SOURCE_CERTIFIED_OWNER_REVIEW_REQUIRED',failClosedGates:FAIL_CLOSED};fs.writeFileSync(path.join(ROOT,MANIFEST),serialize(manifest));return manifest;
}
export function verify(){const m=JSON.parse(fs.readFileSync(path.join(ROOT,MANIFEST),'utf8'));for(const s of m.deterministicIdentity.sources){const b=fs.readFileSync(path.join(ROOT,EVIDENCE_DIR,s.filename));if(b.length!==s.byteLength||sha256(b)!==s.sha256)throw new Error(`SOURCE_IDENTITY_NOT_HASHED_OR_PRESERVED: ${s.filename}`);}return {verified:true,sourceCount:m.deterministicIdentity.sources.length,status:m.status};}
async function main(){const a=args(process.argv.slice(2));const result=a.mode==='discover'?await discover():a.mode==='acquire'?await acquire():verify();console.log(a.json?serialize(result):JSON.stringify(result,null,2));}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(`FAIL_CLOSED: ${e.message}`);process.exitCode=1;});
