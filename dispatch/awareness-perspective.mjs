/**
 * Geographic awareness v1 — PURE, LOCAL, SYNTHETIC, PREVIEW ONLY.
 * No DOM, map, I/O, clock, network, dependencies, credentials or authority commands.
 * A reviewed caller must supply catalogue/source pins and disclosure decisions.
 * This contract validates their binding; it cannot authenticate that caller,
 * certify FIPS against a government inventory, survey geometry or grant access.
 * Polygon/corridor evidence is an explicit referenced assertion, NOT computed
 * here. Point distance never establishes polygon crossing or corridor impact.
 * No geometry is loaded. Outputs never certify safety, jurisdiction or delivery.
 */
export const PERSPECTIVES=Object.freeze(['LOCAL','COUNTY','REGIONAL']);
export const STATES=Object.freeze(['AVAILABLE_INFORMATION','HEALTHY_NO_MATCHING_INCIDENTS','SOURCE_UNAVAILABLE_OR_STALE','GEOGRAPHIC_COVERAGE_UNAVAILABLE','PERMISSION_DENIED']);
export const REASONS=Object.freeze(['INSIDE_SELECTED_AREA','CROSSES_SELECTED_BOUNDARY','NEARBY','AFFECTS_SELECTED_CORRIDOR']);
export const LIMITS=Object.freeze({sources:32,counties:512,localities:4096,regions:256,memberships:254,recordMemberships:32,totalMemberships:20000,records:2000,evidence:4,nearbyMeters:100000});
const catalogs=new WeakMap(),scopes=new WeakMap(),states=new WeakMap();
const fail=code=>{throw new TypeError('AWARENESS_'+code);};
function object(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('OBJECT');
 const ds=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(ds).some(k=>typeof k!=='string'||!keys.includes(k)||!('value' in ds[k])))fail('FIELDS');
 return value;
}
function text(v){if(typeof v!=='string'||!v.length||v.length>200||v.trim()!==v||/[\u0000-\u001f]/.test(v))fail('TEXT');return v;}
function id(v){text(v);if(!/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$/.test(v))fail('IDENTITY');return v;}
function integer(v,max){if(!Number.isSafeInteger(v)||v<0||v>max)fail('LIMIT');return v;}
function array(v,max){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max)fail('LIMIT');if(Reflect.ownKeys(v).length!==v.length+1)fail('ARRAY');for(let i=0;i<v.length;i++)if(!Object.hasOwn(v,i)||!('value' in Object.getOwnPropertyDescriptor(v,String(i))))fail('ARRAY');return v;}
function unique(v,max,convert=id){const out=array(v,max).map(convert);if(new Set(out).size!==out.length)fail('DUPLICATE');return out.sort();}
function fips(v){if(typeof v!=='string'||!/^\d{5}$/.test(v)||+v.slice(0,2)<1||+v.slice(0,2)>78||+v.slice(2)===0)fail('FIPS');return v;}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
const order=(a,b)=>a<b?-1:a>b?1:0;
function source(value){object(value,['id','version','evidenceRef']);return {id:id(value.id),version:id(value.version),evidenceRef:text(value.evidenceRef)};}
const certification=()=>({stage:'LOCAL_SYNTHETIC_CONTRACT',authority:'UNVERIFIED',publication:'DISABLED',safety:'NOT_ESTABLISHED'});
function catalogue(c){const data=catalogs.get(c);if(!data)fail('CATALOGUE');return data;}
function scope(s){const data=scopes.get(s);if(!data)fail('SCOPE');return data;}

/** Pins are separate reviewed configuration, never inferred from the catalogue. */
export function createCatalogue(input,pins){
 object(input,['version','sources','counties','localities','regions']);object(pins,['version','sources']);
 const version=id(input.version);if(version!==id(pins.version))fail('STALE_CATALOGUE');
 const ss=array(input.sources,LIMITS.sources).map(source),ps=array(pins.sources,LIMITS.sources).map(source);
 const canonical=s=>JSON.stringify([...s].sort((a,b)=>order(a.id,b.id)));
 if(!ss.length||new Set(ss.map(s=>s.id)).size!==ss.length||new Set(ps.map(s=>s.id)).size!==ps.length||canonical(ss)!==canonical(ps))fail('SOURCE_PINS');
 const sourceMap=new Map(ss.map(s=>[s.id,s]));let budget=0;
 const bind=v=>{const s=sourceMap.get(v.sourceId);if(!s||s.version!==v.sourceVersion)fail('STALE_SOURCE');return {...s};};
 const members=(v,max=LIMITS.memberships)=>{const result=unique(v,max,fips);budget+=result.length;if(budget>LIMITS.totalMemberships)fail('LIMIT');return result;};
 const counties=array(input.counties,LIMITS.counties).map(v=>{object(v,['fips','label','sourceId','sourceVersion','neighbors']);const code=fips(v.fips);return {canonicalId:'county:'+code,fips:code,label:text(v.label),source:bind(v),neighbors:members(v.neighbors)};});
 const countyMap=new Map(counties.map(c=>[c.fips,c]));if(!counties.length||countyMap.size!==counties.length)fail('DUPLICATE');
 for(const c of counties)for(const n of c.neighbors){if(n===c.fips||!countyMap.has(n)||!countyMap.get(n).neighbors.includes(c.fips))fail('NEIGHBORS');}
 const checkMembers=v=>{const codes=members(v);if(!codes.length||codes.some(c=>!countyMap.has(c)))fail('UNKNOWN_MEMBERSHIP');return codes;};
 function entries(values,prefix,max){return array(values,max).map(v=>{object(v,['canonicalId','label','sourceId','sourceVersion','counties']);const canonicalId=id(v.canonicalId);if(!canonicalId.startsWith(prefix+':')||canonicalId.length===prefix.length+1)fail('IDENTITY');return {canonicalId,label:text(v.label),source:bind(v),counties:checkMembers(v.counties)};});}
 const localities=entries(input.localities,'locality',LIMITS.localities),regions=entries(input.regions,'region',LIMITS.regions);
 const all=[...counties,...localities,...regions],entriesMap=new Map(all.map(v=>[v.canonicalId,v]));if(entriesMap.size!==all.length)fail('DUPLICATE');
 const result=freeze({version,sources:[...ss].sort((a,b)=>order(a.id,b.id)),counties:counties.sort((a,b)=>order(a.fips,b.fips)),localities:localities.sort((a,b)=>order(a.canonicalId,b.canonicalId)),regions:regions.sort((a,b)=>order(a.canonicalId,b.canonicalId)),certification:certification()});
 catalogs.set(result,{version,entriesMap,countyMap});return result;
}

export function resolveScope(catalog,reference){
 const c=catalogue(catalog);object(reference,['perspective','canonicalId','catalogueVersion','sourceVersion']);
 if(!PERSPECTIVES.includes(reference.perspective))fail('PERSPECTIVE');
 const entry=c.entriesMap.get(id(reference.canonicalId));if(!entry)fail('UNKNOWN_IDENTITY');
 if(reference.catalogueVersion!==c.version||reference.sourceVersion!==entry.source.version)fail('STALE_SCOPE');
 const kind=reference.perspective,prefix={LOCAL:'locality:',COUNTY:'county:',REGIONAL:'region:'}[kind];if(!entry.canonicalId.startsWith(prefix))fail('PERSPECTIVE');
 const counties=kind==='COUNTY'?[entry.fips]:[...entry.counties];
 const identity=JSON.stringify([kind,entry.canonicalId,c.version,entry.source.id,entry.source.version,entry.source.evidenceRef,counties]);
 const result=freeze({identity,perspective:kind,canonicalId:entry.canonicalId,catalogueVersion:c.version,source:{...entry.source},countyFips:counties,label:entry.label,certification:certification()});
 scopes.set(result,{catalog,c,entry});return result;
}
export function createPerspective(homeScope,viewScope=homeScope){
 const home=scope(homeScope),view=scope(viewScope);if(home.catalog!==view.catalog)fail('STALE_SCOPE');
 const result=freeze({homeArea:homeScope,viewArea:viewScope,cameraAction:'NONE',privilegeAction:'NONE',certification:certification()});states.set(result,home.catalog);return result;
}
export function selectPerspective(state,viewScope){
 const catalog=states.get(state);if(!catalog||scope(viewScope).catalog!==catalog)fail('STALE_SCOPE');return createPerspective(state.homeArea,viewScope);
}
/** An explicit action returns a request, never coordinates or a map operation. */
export function requestReframe(state,action){if(!states.has(state)||!['HOME','VIEW'].includes(action))fail('REFRAME');return freeze({action:'REFRAME_REQUEST',target:action==='HOME'?state.homeArea:state.viewArea,privilegeAction:'NONE'});}

function result(state,extra={}){return freeze({state,items:[],history:[],safetyAssessment:'NOT_ESTABLISHED',certification:certification(),...extra});}
/** Disclosure must come from a trusted external decision. This is not an Auth API.
 * Denial and unhealthy/unknown coverage paths do not inspect protected records.
 * Authorized outputs expose identity/evidence only; no arbitrary payload fields.
 */
export function evaluateAwareness(view,input){
 const s=scope(view);
 if(!input||Object.getPrototypeOf(input)!==Object.prototype)fail('OBJECT');
 const descriptor=Object.getOwnPropertyDescriptor(input,'disclosure');
 if(!descriptor||!('value' in descriptor))return result('PERMISSION_DENIED');
 const d=object(descriptor.value,['allowed','scopeIdentity','sourceId','decisionVersion']);
 if(d.allowed!==true||d.scopeIdentity!==view.identity)return result('PERMISSION_DENIED');
 id(d.sourceId);id(d.decisionVersion);
 object(input,['disclosure','source','expectedSourceVersion','health','coverage','nearbyMeters','records']);
 const provider=source(input.source);if(provider.id!==d.sourceId||provider.version!==id(input.expectedSourceVersion))fail('SOURCE_PINS');
 if(!['HEALTHY','UNAVAILABLE','STALE'].includes(input.health))fail('HEALTH');
 if(!['COMPLETE','PARTIAL','UNAVAILABLE'].includes(input.coverage))fail('COVERAGE');
 if(input.health!=='HEALTHY')return result('SOURCE_UNAVAILABLE_OR_STALE',{source:provider,health:input.health});
 if(input.coverage!=='COMPLETE')return result('GEOGRAPHIC_COVERAGE_UNAVAILABLE',{source:provider,coverage:input.coverage});
 const nearby=integer(input.nearbyMeters,LIMITS.nearbyMeters),versions=new Map();
 const knownIds=s.c.entriesMap,knownCounties=s.c.countyMap;
 function record(v){
  object(v,['sourceId','sourceVersion','nativeId','revision','withdrawn','stale','catalogueVersion','countyFips','localityIds','evidence']);
  if(v.sourceId!==provider.id||v.sourceVersion!==provider.version||v.catalogueVersion!==view.catalogueVersion)fail('STALE_RECORD');
  const nativeId=id(v.nativeId),revision=integer(v.revision,2147483647);if(!revision||typeof v.withdrawn!=='boolean'||typeof v.stale!=='boolean')fail('RECORD');
  const counties=unique(v.countyFips,LIMITS.recordMemberships,fips),localityIds=unique(v.localityIds,LIMITS.recordMemberships);
  if(counties.some(c=>!knownCounties.has(c))||localityIds.some(l=>!l.startsWith('locality:')||!knownIds.has(l)))fail('UNKNOWN_MEMBERSHIP');
  if(localityIds.some(l=>knownIds.get(l).counties.some(c=>!counties.includes(c))))fail('INCOMPLETE_MEMBERSHIP');
  const evidence=array(v.evidence,LIMITS.evidence).map(e=>{
   object(e,['reason','method','scopeIdentity','reference','intersects','crossesBoundary','distanceMeters','corridorId']);
   if(!REASONS.includes(e.reason)||!['GOVERNED_MEMBERSHIP','POLYGON_INTERSECTION','POINT_DISTANCE','DOCUMENTED_CORRIDOR_IMPACT','INCOMPLETE'].includes(e.method))fail('EVIDENCE');
   if(e.scopeIdentity!==view.identity)fail('STALE_EVIDENCE');text(e.reference);
   if(e.intersects!==undefined&&typeof e.intersects!=='boolean'||e.crossesBoundary!==undefined&&typeof e.crossesBoundary!=='boolean')fail('EVIDENCE');
   if(e.distanceMeters!==undefined&&(!Number.isFinite(e.distanceMeters)||e.distanceMeters<0||e.distanceMeters>LIMITS.nearbyMeters))fail('EVIDENCE');
   if(e.corridorId!==undefined)id(e.corridorId);
   const compatible={INSIDE_SELECTED_AREA:['GOVERNED_MEMBERSHIP','POLYGON_INTERSECTION','INCOMPLETE'],CROSSES_SELECTED_BOUNDARY:['POLYGON_INTERSECTION','INCOMPLETE'],NEARBY:['POINT_DISTANCE','INCOMPLETE'],AFFECTS_SELECTED_CORRIDOR:['DOCUMENTED_CORRIDOR_IMPACT','INCOMPLETE']};
   if(!compatible[e.reason].includes(e.method))fail('EVIDENCE_METHOD');
   if(e.method==='POINT_DISTANCE'&&e.distanceMeters===undefined||e.method==='POLYGON_INTERSECTION'&&e.intersects===undefined||e.method==='DOCUMENTED_CORRIDOR_IMPACT'&&!e.corridorId||e.reason==='CROSSES_SELECTED_BOUNDARY'&&e.method!=='INCOMPLETE'&&e.crossesBoundary!==true)fail('EVIDENCE');
   return {...e};
  });
  if(new Set(evidence.map(e=>e.reason)).size!==evidence.length)fail('DUPLICATE');
  return {sourceId:provider.id,sourceVersion:provider.version,nativeId,revision,withdrawn:v.withdrawn,stale:v.stale,catalogueVersion:view.catalogueVersion,countyFips:counties,localityIds,evidence:evidence.sort((a,b)=>REASONS.indexOf(a.reason)-REASONS.indexOf(b.reason))};
 }
 for(const raw of array(input.records,LIMITS.records)){
  const r=record(raw),key=JSON.stringify([r.sourceId,r.nativeId]),revs=versions.get(key)||new Map(),old=revs.get(r.revision);
  if(old&&JSON.stringify(old)!==JSON.stringify(r))fail('AMBIGUOUS_REVISION');revs.set(r.revision,r);versions.set(key,revs);
 }
 const current=[...versions.values()].map(revs=>[...revs.values()].sort((a,b)=>b.revision-a.revision)[0]).sort((a,b)=>order(a.nativeId,b.nativeId));
 const history=current.filter(r=>r.stale||r.withdrawn).map(r=>({sourceId:r.sourceId,sourceVersion:r.sourceVersion,nativeId:r.nativeId,revision:r.revision,withdrawn:r.withdrawn,stale:r.stale}));
 if(current.some(r=>r.stale&&!r.withdrawn))return result('SOURCE_UNAVAILABLE_OR_STALE',{source:provider,health:'RECORD_STALE',history});
 const active=current.filter(r=>!r.stale&&!r.withdrawn);
 if(active.some(r=>!r.evidence.length||!r.countyFips.length&&!r.localityIds.length||r.evidence.some(e=>e.method==='INCOMPLETE')))return result('GEOGRAPHIC_COVERAGE_UNAVAILABLE',{source:provider,coverage:'INCOMPLETE_EVIDENCE',history});
 const selected=new Set(view.countyFips),adjacent=new Set(view.countyFips.flatMap(c=>knownCounties.get(c).neighbors)),items=[];
 for(const r of active){
  const inside=view.perspective==='LOCAL'?r.localityIds.includes(view.canonicalId):r.countyFips.some(c=>selected.has(c));
  const reasons=r.evidence.filter(e=>{
   if(e.reason==='INSIDE_SELECTED_AREA')return e.method==='GOVERNED_MEMBERSHIP'?inside:e.intersects===true;
   if(e.reason==='CROSSES_SELECTED_BOUNDARY')return e.intersects===true&&e.crossesBoundary===true;
   if(e.reason==='NEARBY')return e.distanceMeters<=nearby&&r.countyFips.some(c=>selected.has(c)||adjacent.has(c));
   return e.method==='DOCUMENTED_CORRIDOR_IMPACT';
  });
  if(reasons.length)items.push({...r,evidence:reasons});
 }
 return result(items.length?'AVAILABLE_INFORMATION':'HEALTHY_NO_MATCHING_INCIDENTS',{source:provider,coverage:'COMPLETE',items,history});
}
