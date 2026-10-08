// Local source geometry contract. This module confers no operational authority.
export const CONTRACT = 'dispatch-roadway-registry-v1';
export const LIMITS = Object.freeze({bytes:20*1024*1024, features:45000, positions:1000000, selections:50});
const refuse = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 240;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const freeze = value => { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const encode = value => new TextEncoder().encode(JSON.stringify(value));
const tuple = values => JSON.stringify(values);
function countySet(values, approved){
 if(!Array.isArray(values)||!values.length||values.length>254||new Set(values).size!==values.length||values.some(v=>!/^48\d{3}$/.test(v)||!approved.has(v)))refuse('Unknown or duplicate Texas county identity.');
 return [...values].sort();
}
function geometry(value,budget){
 if(!plain(value)||Object.keys(value).some(k=>!['type','coordinates'].includes(k))||!['LineString','MultiLineString'].includes(value.type))refuse('Unsupported road geometry.');
 const lines=value.type==='LineString'?[value.coordinates]:value.coordinates;
 if(!Array.isArray(lines)||!lines.length)refuse('Empty road geometry.');
 for(const line of lines){
  if(!Array.isArray(line)||line.length<2)refuse('Malformed road line.');
  budget.positions+=line.length;if(budget.positions>LIMITS.positions)refuse('Geometry position limit exceeded.');
  for(const p of line)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)refuse('Invalid longitude/latitude coordinate.');
  if(!line.some(p=>p[0]!==line[0][0]||p[1]!==line[0][1]))refuse('Degenerate road line.');
 }
 return structuredClone(value);
}
/** The manifest is a reviewed trust input, not a browser permission or source discovery mechanism. */
export async function loadRegistry(input,provenanceBytes,manifest,approvedCountyFips){
 if(!(input instanceof Uint8Array)||input.byteLength>LIMITS.bytes||!(provenanceBytes instanceof Uint8Array)||provenanceBytes.byteLength>65536)refuse('Missing or oversized pinned input.');
 if(!plain(manifest)||manifest.contract!==CONTRACT||!['namespace','dataset','sourceDataset','snapshot','version','packageId','featureIdKey','license','attribution','sourceTransform'].every(k=>text(manifest[k]))||!['inputHash','sourceHash','provenanceHash'].every(k=>hash(manifest[k])))refuse('Malformed registry provenance contract.');
 manifest=freeze(structuredClone(manifest));input=input.slice();provenanceBytes=provenanceBytes.slice();
 if(!/^[a-z][a-z0-9.-]{0,79}$/.test(manifest.namespace)||!['osmId','@id','TLID','LINEARID','id'].includes(manifest.featureIdKey))refuse('Invalid source identity contract.');
 if(manifest.crs!=='OGC:CRS84')refuse('Unexpected coordinate reference system.');
 const counties=countySet(manifest.countyFips,new Set(approvedCountyFips));
 if(!Number.isInteger(manifest.inputFeatureCount)||manifest.inputFeatureCount<1||manifest.inputFeatureCount>LIMITS.features)refuse('Invalid pinned feature count.');
 const excluded=manifest.excludedGeometryTypes||[];
 if(!Array.isArray(excluded)||excluded.length>1||excluded.some(t=>t!=='Polygon'))refuse('Unsupported exclusion policy.');
 if(await digest(input)!==manifest.inputHash||await digest(provenanceBytes)!==manifest.provenanceHash)refuse('Pinned input or provenance hash mismatch.');
 let data,provenance;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(input));provenance=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(provenanceBytes));}catch{refuse('Malformed source JSON.');}
 if(provenance.source!==manifest.sourceDataset||provenance.sha256!==manifest.sourceHash||provenance.sourceTimestamp!==manifest.snapshot||provenance.license!==manifest.license||provenance.copyright!==manifest.attribution)refuse('Missing or mismatched source provenance.');
 if(data?.type!=='FeatureCollection'||data.crs||!Array.isArray(data.features)||data.features.length!==manifest.inputFeatureCount)refuse('Unsupported collection, CRS or feature count.');
 const rows=[],byIdentity=new Map(),budget={positions:0};let excludedCount=0;
 for(const f of data.features){
  if(f?.type!=='Feature'||!plain(f.properties))refuse('Malformed source feature.');
  if(excluded.includes(f.geometry?.type)){excludedCount++;continue;}
  const sourceId=manifest.featureIdKey==='id'?f.id:f.properties[manifest.featureIdKey];
  if(!text(sourceId)||sourceId.trim()!==sourceId||(manifest.namespace==='osm'&&!/^way\/\d+$/.test(sourceId)))refuse('Missing or malformed source feature identity.');
  const g=geometry(f.geometry,budget),geometryHash=await digest(encode(g));
  const identity={namespace:manifest.namespace,sourceFeatureId:sourceId,packageId:manifest.packageId};
  const identityKey=tuple([identity.namespace,identity.sourceFeatureId,identity.packageId,counties]);
  if(byIdentity.has(identityKey))refuse('Duplicate source feature identity.');
  const aliases=[...new Set(['name','ref','FULLNAME','ROADNAME'].map(k=>f.properties[k]).filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))];
  if(aliases.length>4||aliases.some(v=>v.length>240))refuse('Oversized road alias.');
  const version={contract:CONTRACT,sourceSnapshot:manifest.snapshot,sourceVersion:manifest.version,inputHash:manifest.inputHash,sourceHash:manifest.sourceHash,geometryHash};
  const selection={identity:identityKey,contract:CONTRACT,packageId:manifest.packageId,sourceVersion:manifest.version,sourceSnapshot:manifest.snapshot,sourceHash:manifest.sourceHash,provenanceHash:manifest.provenanceHash,inputHash:manifest.inputHash,geometryHash};
  const row=freeze({identity,identityKey,version,selection,countyFips:counties,aliases,label:aliases[0]||'Unnamed source road',geometry:g,operationalSegmentId:null,
   provenance:{dataset:manifest.dataset,sourceDataset:manifest.sourceDataset,provenanceHash:manifest.provenanceHash,crs:manifest.crs,license:manifest.license,attribution:manifest.attribution,sourceTransform:manifest.sourceTransform,registryTransform:'No coordinate transformation; geometry digest is SHA-256 of JSON.stringify(geometry), not original feature bytes.'},
   certification:{sourceGeometry:'VALID',sourceIdentity:'GOVERNED_LOCAL',topology:'UNVERIFIED',boundaryRelationship:'UNVERIFIED',roadwayAuthority:'UNVERIFIED',publication:'DISABLED'}});
  rows.push(row);byIdentity.set(identityKey,row);
 }
 if(!rows.length)refuse('No supported road geometry.');
 const keys=['contract','geometryHash','identity','inputHash','packageId','sourceVersion','sourceSnapshot','sourceHash','provenanceHash'].sort().join(',');
 function selected(references){
  if(!Array.isArray(references)||references.length>LIMITS.selections)refuse('Select up to 50 distinct source lines.');
  const seen=new Set();return references.map(ref=>{
   if(!plain(ref)||Object.keys(ref).sort().join(',')!==keys||typeof ref.identity!=='string'||seen.has(ref.identity))refuse('Malformed or duplicated selection reference.');
   seen.add(ref.identity);const row=byIdentity.get(ref.identity);
   if(!row||JSON.stringify(Object.keys(ref).sort().map(k=>ref[k]))!==JSON.stringify(Object.keys(row.selection).sort().map(k=>row.selection[k])))refuse('Unknown or stale source selection. Explicit review required.');
   return row;
  });
 }
 return Object.freeze({contract:CONTRACT,packageId:manifest.packageId,countyFips:freeze(counties),features:freeze(rows),statistics:freeze({inputBytes:input.byteLength,inputFeatures:data.features.length,roadFeatures:rows.length,excludedFeatures:excludedCount,positions:budget.positions}),
  selected,search(query){if(typeof query!=='string'||query.length>240)refuse('Invalid road search.');const q=query.trim().toLowerCase();return rows.filter(r=>[...r.aliases,r.identity.sourceFeatureId].some(v=>v.toLowerCase().includes(q))).slice(0,40);}});
}