// Local source-evidence topology only. No authority, travel or publication grants.
export const CONTRACT='dispatch-roadway-topology-v1';
export const RULES='shared-node-conservative-grade-v1';
export const LIMITS=Object.freeze({bytes:20*1024*1024,features:45000,positions:1000000,selections:50,searchResults:40,edges:100000,segments:50000,adjacency:200000,degree:256,graphBytes:64*1024*1024,outputBytes:20*1024*1024});
const fail=m=>{throw Error(m)};
const enc=v=>new TextEncoder().encode(JSON.stringify(v));
export async function digest(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')}
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const id=v=>Number.isSafeInteger(v)&&v>0;
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const highways=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service','track','path','footway','cycleway','pedestrian','steps','bridleway']);
const keys=['highway','name','ref','bridge','tunnel','layer','access','motor_vehicle','oneway','junction'];
function tags(raw){if(!plain(raw))fail('Malformed tags');const t={};for(const k of keys)if(Object.hasOwn(raw,k)){if(typeof raw[k]!=='string'||raw[k].length>240)fail('Malformed tag');t[k]=raw[k]}return t}
function grade(t){
 const unsupported=!highways.has(t.highway)||('bridge'in t&&!['yes','no','boardwalk'].includes(t.bridge))||('tunnel'in t&&!['yes','no','building_passage'].includes(t.tunnel))||('layer'in t&&!/^-?[0-5]$/.test(t.layer))||('junction'in t&&!['roundabout','circular'].includes(t.junction))||('oneway'in t&&!['yes','no','-1'].includes(t.oneway));
 const bridge=t.bridge&&t.bridge!=='no',tunnel=t.tunnel&&t.tunnel!=='no';
 return {unsupported:!!unsupported,conflict:!!(bridge&&tunnel),layer:'layer'in t?Number(t.layer):null,structure:bridge?'bridge':tunnel?'tunnel':'ground'};
}
/** Manifest is a reviewed local trust input; never accept browser-selected source manifests. */
export async function buildTopology(input,provenanceBytes,manifest){
 if(!(input instanceof Uint8Array)||!(provenanceBytes instanceof Uint8Array)||input.length>LIMITS.bytes||provenanceBytes.length>65536)fail('Input budget exceeded');
 if(!plain(manifest)||manifest.contract!==CONTRACT||manifest.rules!==RULES||manifest.crs!=='OGC:CRS84'||!sha(manifest.sourceHash)||!sha(manifest.provenanceHash)||typeof manifest.snapshot!=='string'||typeof manifest.packageId!=='string'||manifest.packageId.length>100||!manifest.packageId||!Number.isInteger(manifest.expectedElements)||!Number.isInteger(manifest.expectedHighwayWays))fail('Unreviewed source contract');
 manifest=freeze(structuredClone(manifest));input=input.slice();provenanceBytes=provenanceBytes.slice();
 if(await digest(input)!==manifest.sourceHash||await digest(provenanceBytes)!==manifest.provenanceHash)fail('Source/provenance hash mismatch');
 let source,p;try{source=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(input));p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(provenanceBytes))}catch{fail('Malformed source JSON')}
 if(source.version!=='0.6'||!Array.isArray(source.elements)||source.elements.length!==manifest.expectedElements||source.elements.length>LIMITS.features)fail('Source format/count mismatch');
 if(p.sha256!==manifest.sourceHash||p.acquired!==manifest.snapshot||p.license!=='https://opendatacommons.org/licenses/odbl/1-0/'||p.attribution!=='© OpenStreetMap contributors'||source.copyright!=='OpenStreetMap and contributors'||source.license!=='http://opendatacommons.org/licenses/odbl/1-0/'||source.attribution!=='http://www.openstreetmap.org/copyright'||p.source!==manifest.sourceUrl||JSON.stringify(p.bbox)!==JSON.stringify(manifest.bbox))fail('License/provenance mismatch');
 const bounds=source.bounds,b=manifest.bbox;
 if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]||b[0]<-180||b[2]>180||b[1]<-90||b[3]>90||!bounds||JSON.stringify([bounds.minlon,bounds.minlat,bounds.maxlon,bounds.maxlat])!==JSON.stringify(b))fail('Extraction bounds mismatch');
 const nodes=new Map(),ways=[],all=new Set();
 for(const e of source.elements){if(!plain(e)||!['node','way','relation'].includes(e.type)||!id(e.id)||all.has(e.type+'/'+e.id))fail('Duplicate/malformed source identity');all.add(e.type+'/'+e.id);
  if(e.type==='node'){if(!Number.isFinite(e.lon)||!Number.isFinite(e.lat)||Math.abs(e.lon)>180||Math.abs(e.lat)>90||!id(e.version))fail('Malformed source coordinate/version');nodes.set(e.id,{id:e.id,version:e.version,coordinate:[e.lon,e.lat]})}
  if(e.type==='way'&&plain(e.tags)&&Object.hasOwn(e.tags,'highway')){if(!id(e.version)||!Array.isArray(e.nodes)||e.nodes.length<2||!e.nodes.every(id))fail('Malformed way/node sequence');const t=tags(e.tags);ways.push({id:e.id,version:e.version,nodeIds:[...e.nodes],tags:t,grade:grade(t)})}
 }
 if(ways.length!==manifest.expectedHighwayWays)fail('Highway way count mismatch');ways.sort((a,b)=>a.id-b.id);
 const incidence=new Map(),sourceWays=[],sourceWayIndex=new Map(),missing=[],repeated=new Set();let positions=0,edges=0,adjacency=0;
 for(const w of ways){w.missing=w.nodeIds.some(n=>!nodes.has(n));positions+=w.nodeIds.length;edges+=w.nodeIds.length-1;if(positions*128+nodes.size*128>LIMITS.graphBytes||positions>LIMITS.positions||edges>LIMITS.edges)fail('Expanded edge/position budget exceeded');
  const seen=new Set();for(let i=0;i<w.nodeIds.length;i++){const n=w.nodeIds[i];if(!nodes.has(n)){missing.push({wayId:'osm:way:'+w.id,nodeId:'osm:node:'+n});continue}if(seen.has(n)&&!(i===w.nodeIds.length-1&&n===w.nodeIds[0]))repeated.add(w.id);seen.add(n);
   if(!incidence.has(n))incidence.set(n,new Map());incidence.get(n).set(w.id,w);
  }
  if(w.nodeIds.some(n=>!nodes.has(n)))continue;
  const coordinates=w.nodeIds.map(n=>nodes.get(n).coordinate);
  for(let i=1;i<coordinates.length;i++)if(coordinates[i][0]===coordinates[i-1][0]&&coordinates[i][1]===coordinates[i-1][1])fail('Zero-length source edge');
  sourceWays.push({sourceWayId:'osm:way:'+w.id,elementVersion:w.version,nodeIds:w.nodeIds,nodeVersions:w.nodeIds.map(n=>nodes.get(n).version),geometryHash:await digest(enc({type:'LineString',coordinates})),tags:w.tags});
 }
 for(const w of sourceWays)sourceWayIndex.set(w.sourceWayId,w);
 const junctions=[],junctionByNode=new Map();
 for(const [n,wm]of [...incidence].sort((a,b)=>a[0]-b[0])){adjacency+=wm.size;if(wm.size>LIMITS.degree||adjacency>LIMITS.adjacency)fail('Adjacency budget exceeded');if(wm.size<2)continue;
  const incident=[...wm.values()].sort((a,b)=>a.id-b.id);let state='VERIFIED_EVIDENCE',reason='SHARED_NODE_EXPLICIT_COMPATIBLE_GRADE';
  if(incident.some(w=>w.missing)){state='MISSING_SOURCE_EVIDENCE';reason='UNRESOLVED_INCIDENT_WAY_NODES'}
  else if(incident.some(w=>w.grade.unsupported||w.grade.conflict||repeated.has(w.id))){state='BLOCKED_AMBIGUITY';reason='UNSUPPORTED_OR_CONTRADICTORY_TAGS_OR_REPEATED_NODES'}
  else {const layers=new Set(incident.map(w=>w.grade.layer)),structures=new Set(incident.map(w=>w.grade.structure));const transition=incident.every(w=>w.nodeIds[0]===n||w.nodeIds.at(-1)===n);
   if(layers.size>1&&!layers.has(null)){state=transition?'CANDIDATE_REVIEW':'BLOCKED_AMBIGUITY';reason=transition?'GRADE_TRANSITION_AT_WAY_ENDPOINTS':'CONTRADICTORY_LAYERS'}
   else if(layers.has(null)){state='CANDIDATE_REVIEW';reason='MISSING_EXPLICIT_GRADE_EVIDENCE'}
   else if(structures.size>1){state=transition?'VERIFIED_EVIDENCE':'BLOCKED_AMBIGUITY';reason=transition?'EXPLICIT_GRADE_STRUCTURE_ENDPOINT_TRANSITION':'STRUCTURE_CONFLICT_AT_INTERIOR_NODE'}
  }
  const nc=nodes.get(n).coordinate;if(nc[0]<=b[0]||nc[0]>=b[2]||nc[1]<=b[1]||nc[1]>=b[3]){if(state!=='BLOCKED_AMBIGUITY'&&state!=='MISSING_SOURCE_EVIDENCE'){state='CANDIDATE_REVIEW';reason='EXTRACTION_EDGE_INCOMPLETE'}}
  const row={junctionId:'osm:node:'+n,nodeId:n,nodeVersion:nodes.get(n).version,coordinate:nodes.get(n).coordinate,incidentWayIds:incident.map(w=>'osm:way:'+w.id),state,reason};junctions.push(row);junctionByNode.set(n,row);
 }
 const segments=[],occurrences=new Map();let segmentBytes=0;
 for(const w of ways){if(w.nodeIds.some(n=>!nodes.has(n)))continue;const parent=sourceWayIndex.get('osm:way:'+w.id);const cuts=[0];for(let i=1;i<w.nodeIds.length-1;i++)if(junctionByNode.get(w.nodeIds[i])?.state==='VERIFIED_EVIDENCE')cuts.push(i);cuts.push(w.nodeIds.length-1);
  for(let k=1;k<cuts.length;k++){if(segments.length>=LIMITS.segments)fail('Segment budget exceeded');const start=cuts[k-1],end=cuts[k],slice=w.nodeIds.slice(start,end+1),coordinates=slice.map(n=>nodes.get(n).coordinate),issues=[];
   if(w.grade.unsupported||w.grade.conflict||repeated.has(w.id))issues.push('UNSUPPORTED_WAY_OR_REPEATED_NODES');for(const n of slice){const j=junctionByNode.get(n);if(j&&j.state!=='VERIFIED_EVIDENCE')issues.push(j.reason)}
   if(w.grade.layer===null)issues.push('MISSING_EXPLICIT_GRADE_EVIDENCE');
   const endpoints=[slice[0],slice.at(-1)].map(n=>{const j=junctionByNode.get(n),c=nodes.get(n).coordinate;return {nodeId:'osm:node:'+n,nodeVersion:nodes.get(n).version,junctionId:j?.junctionId??null,state:j?.state??'CANDIDATE_REVIEW',reason:j?.reason??(c[0]<=b[0]||c[0]>=b[2]||c[1]<=b[1]||c[1]>=b[3]?'EXTRACTION_EDGE_INCOMPLETE':'SOURCE_WAY_ENDPOINT_NOT_CERTIFIED_DEAD_END')}});
   const state=slice.some(n=>junctionByNode.get(n)?.state==='MISSING_SOURCE_EVIDENCE')?'MISSING_SOURCE_EVIDENCE':w.grade.unsupported||w.grade.conflict||repeated.has(w.id)||slice.some(n=>junctionByNode.get(n)?.state==='BLOCKED_AMBIGUITY')?'BLOCKED_AMBIGUITY':issues.length||endpoints.some(e=>e.state!=='VERIFIED_EVIDENCE')?'CANDIDATE_REVIEW':'VERIFIED_EVIDENCE';
   const pair=JSON.stringify([w.id,slice[0],slice.at(-1)]),occurrence=occurrences.get(pair)||0;occurrences.set(pair,occurrence+1);const segmentId=JSON.stringify(['osm',w.id,slice[0],slice.at(-1),occurrence]);
   segments.push({segmentId,parentWayId:parent.sourceWayId,sourceElementVersion:w.version,sourceSnapshot:manifest.snapshot,sourceHash:manifest.sourceHash,parentGeometryHash:parent.geometryHash,sliceIndices:[start,end],nodeIds:slice,nodeVersions:slice.map(n=>nodes.get(n).version),endpoints,geometry:{type:'LineString',coordinates},geometryVersion:await digest(enc({nodeIds:slice,coordinates})),rules:RULES,state,reasons:[...new Set(issues)],aliases:[...new Set([w.tags.name,w.tags.ref].filter(Boolean))],tags:w.tags,authority:'UNVERIFIED',travelPermission:'NOT_ASSERTED',publication:'DISABLED'});
   segmentBytes+=enc(segments.at(-1)).length;if(segmentBytes>LIMITS.outputBytes||segmentBytes*16+positions*128+nodes.size*256>LIMITS.graphBytes)fail('Incremental output/accounted graph memory budget exceeded');
  }
 }
 const topologyVersion=await digest(enc({contract:CONTRACT,rules:RULES,sourceHash:manifest.sourceHash,provenanceHash:manifest.provenanceHash,sourceWays,junctions,segments,missing}));
 for(const s of segments){s.topologyVersion=topologyVersion;s.selection={contract:CONTRACT,packageId:manifest.packageId,sourceHash:manifest.sourceHash,topologyVersion,segmentId:s.segmentId,geometryVersion:s.geometryVersion}}
 const data={contract:CONTRACT,rules:RULES,packageId:manifest.packageId,sourceHash:manifest.sourceHash,provenanceHash:manifest.provenanceHash,sourceSnapshot:manifest.snapshot,crs:'OGC:CRS84',license:p.license,attribution:p.attribution,scope:'BOUNDED_LOCAL_SOURCE_EVIDENCE_ONLY',authority:'UNVERIFIED',publication:'DISABLED',topologyVersion,sourceWays,junctions,segments,missing};
 const outputBytes=enc(data).length,graphBytes=outputBytes*16+positions*128+adjacency*128+nodes.size*256;if(outputBytes>LIMITS.outputBytes||graphBytes>LIMITS.graphBytes)fail('Output/accounted graph memory budget exceeded');
 freeze(data);const byId=new Map(segments.map(s=>[s.segmentId,s])),byWay=new Map();for(const s of segments){if(!byWay.has(s.parentWayId))byWay.set(s.parentWayId,[]);byWay.get(s.parentWayId).push(s)}
 function selected(refs){if(!Array.isArray(refs)||refs.length>LIMITS.selections)fail('Selection limit exceeded');const seen=new Set();return refs.map(r=>{if(!plain(r)||seen.has(r.segmentId))fail('Duplicate/malformed selection');seen.add(r.segmentId);const s=byId.get(r.segmentId);if(!s||Object.keys(r).sort().join(',')!==Object.keys(s.selection).sort().join(',')||Object.keys(s.selection).some(k=>r[k]!==s.selection[k]))fail('Stale/mixed-version selection; explicit review required');if(s.state!=='VERIFIED_EVIDENCE')fail('Segment requires review; operational selection blocked');return s})}
 return Object.freeze({data,selected,forWay:way=>Object.freeze([...(byWay.get(way)||[])]),search:q=>{if(typeof q!=='string'||q.length>240)fail('Invalid search');return Object.freeze(segments.filter(s=>[s.parentWayId,...s.aliases].some(x=>x.toLowerCase().includes(q.toLowerCase()))).slice(0,LIMITS.searchResults))},statistics:freeze({sourceNodes:nodes.size,highwayWays:ways.length,resolvedWays:sourceWays.length,missingReferences:missing.length,positions,edges,adjacency,junctions:junctions.length,segments:segments.length,outputBytes,accountedGraphBytes:graphBytes,junctionStates:counts(junctions),segmentStates:counts(segments)})});
}
function counts(rows){const out={VERIFIED_EVIDENCE:0,CANDIDATE_REVIEW:0,BLOCKED_AMBIGUITY:0,MISSING_SOURCE_EVIDENCE:0};for(const r of rows)out[r.state]++;return out}
