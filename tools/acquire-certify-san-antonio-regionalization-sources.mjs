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
const CITY_OWNERS=new Set(['cosagis','cityofsanantonio']);
const ARCGIS_SERVICE_HOST=/^(?:services\d*|utility)\.arcgis\.com$/i;

export function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
export function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
export function serialize(value){return JSON.stringify(stable(value),null,2)+'\n';}
export function authority(item,portal,service={}){
  let serviceHost=null;try{serviceHost=new URL(item.url).hostname.toLowerCase();}catch{}
  const owner=typeof item.owner==='string'?item.owner:null;
  const ownerOk=Boolean(owner)&&CITY_OWNERS.has(owner.toLowerCase());
  const portalId=portal?.id||null, itemOrgId=item.orgId||null;
  const orgOk=portalId&&itemOrgId?itemOrgId===portalId:true;
  const serviceHostOk=serviceHost==='gis.sanantonio.gov'||ARCGIS_SERVICE_HOST.test(serviceHost||'');
  const serviceTypeOk=/^(?:Feature|Map) Service$/i.test(item.type||'')&&Array.isArray(service.layers);
  const serviceItemId=service.serviceItemId||null;
  const serviceIdentityOk=Boolean(serviceItemId)&&serviceItemId===item.id;
  const serviceUrlOk=typeof item.url==='string'&&/^https:\/\//.test(item.url)&&/\/(?:Feature|Map)Server\/?$/i.test(item.url);
  const certified=ownerOk&&orgOk&&serviceHostOk&&serviceTypeOk&&serviceIdentityOk&&serviceUrlOk;
  return {certified,ownerOk,orgOk,serviceHostOk,serviceTypeOk,serviceIdentityOk,serviceUrlOk,evidence:{itemId:item.id||null,itemTitle:item.title||null,itemOwner:owner,itemOrganizationId:itemOrgId,portalOrganizationId:portalId,portalOrganizationName:portal?.name||null,serviceUrl:item.url||null,serviceHost,serviceItemId,serviceName:service.name||service.mapName||null,serviceLayerCount:Array.isArray(service.layers)?service.layers.length:null},reason:certified?'CITY_CONTROLLED_ARCGIS_ITEM_AND_SERVICE_CONFIRMED':'OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED'};
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
async function portal(read=getJson){try{return await read(`${OFFICIAL_PORTAL}/sharing/rest/portals/self?f=json`);}catch{return {};}}
async function candidates(portalId,terms,read=getJson){const scope=portalId?`orgid:${portalId} `:'';const q=encodeURIComponent(`${scope}(${terms.map(x=>`title:\"${x}\"`).join(' OR ')} OR title:\"SA Tomorrow Regional Centers and Community Areas\") (type:\"Feature Service\" OR type:\"Map Service\")`);return (await read(`${OFFICIAL_PORTAL}/sharing/rest/search?f=json&num=100&q=${q}`)).results||[];}
async function itemDetails(id,read=getJson){return read(`${OFFICIAL_PORTAL}/sharing/rest/content/items/${encodeURIComponent(id)}?f=json`);}
async function layerDetails(item,read=getJson){const service=await read(`${item.url}?f=json`);const layers=[];for(const x of service.layers||[])layers.push({...x,metadata:await read(`${item.url}/${x.id}?f=json`)});return {service,layers};}
function candidateTitle(item,terms){const title=String(item.title||'').toLowerCase();return title==='sa tomorrow regional centers and community areas'||terms.some(term=>title.includes(term));}
export async function discover({readJson=getJson}={}){
  const p=await portal(readJson),found={};
  for(const [kind,terms] of Object.entries(TYPES)){const leads=await candidates(p.id,terms,readJson),certified=[];for(const lead of leads){if(!lead.id)continue;const item=await itemDetails(lead.id,readJson);if(item.id!==lead.id||!candidateTitle(item,terms))continue;const details=await layerDetails(item,readJson);const a=authority(item,p,details.service);if(a.certified)certified.push({...item,authority:a,details});}found[kind]=certified;}
  const result={schemaVersion:'gridly.san-antonio-source-discovery.v2',officialPortal:OFFICIAL_PORTAL,organizationId:p.id||null,organizationName:p.name||null,authorityBasis:'DIRECT_ARCGIS_ITEM_AND_SERVICE_METADATA',candidates:found,writePerformed:false};
  const chosen=selectedLayers(result);for(const kind of Object.keys(TYPES))if(chosen.filter(x=>x.kind===kind).length!==1)throw new Error(`SOURCE_LAYER_IDENTITY_AMBIGUOUS: ${kind}`);
  return result;
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
