import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const PRECEDENCE='INDEPENDENT_GOVERNED_PLACE_WINS';
export const FAR_ID='0a54b85a-6d66-4887-8a12-19dff06070c8';
export const WEST_ID='4c5f3a02-22b0-4af8-8d74-b1bc35a8e03e';
export const SOURCE={bytes:1864489,sha256:'bf15d7d257d60970c894e590cacb996a15a8796d789e09335860fdb2a6a6e13d'};
export const WEST={bytes:427909,sha256:'1eed04031d6a0ccb13c5749fbcc7af3c829e2bc959db065a2dd7b78c324ec181'};
export const PATHS={identity:'reports/metro-child-area-evidence-governance-audit.json',placeGeometryAudit:'reports/statewide-place-presentation-geometry-audit.json',working:'reports/san-antonio-sa-tomorrow-working-geometry-governance.json',source:'reports/san-antonio-sa-tomorrow-geometry-source-certification.json',west:'evidence/san-antonio-sa-tomorrow-derived-repairs/west-northwest/repaired.geojson'};
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p)));
const digest=p=>{const b=fs.readFileSync(p);return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
export const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const serialize=v=>JSON.stringify(canonical(v),null,2)+'\n';

export function classifyPair({intersectionArea,placeWithinAtomic=false,atomicWithinPlace=false,boundariesTouch=false}){
  if(!Number.isFinite(intersectionArea)||intersectionArea<0)throw Error('INVALID_INTERSECTION_AREA');
  if(intersectionArea===0)return boundariesTouch?'BOUNDARY_TOUCH_ONLY':'DISJOINT';
  if(placeWithinAtomic)return 'PLACE_CONTAINED_WITHIN_ATOMIC_UNIT';
  if(atomicWithinPlace)return 'ATOMIC_UNIT_CONTAINED_WITHIN_PLACE';
  return 'PARTIAL_AREA_OVERLAP';
}
export function classifyAggregate({positiveAreaCount,boundaryTouchCount,farSouthwestPreventsCertification=false}){
  if(farSouthwestPreventsCertification)return 'INDETERMINATE_FAR_SOUTHWEST_GOVERNANCE_HOLD';
  if(positiveAreaCount>1)return 'MULTI_ATOMIC_POSITIVE_AREA_OVERLAP';
  if(positiveAreaCount===1)return 'SINGLE_ATOMIC_POSITIVE_AREA_RELATIONSHIP';
  if(boundaryTouchCount>0)return 'BOUNDARY_TOUCH_ONLY';
  return 'OUTSIDE_USABLE_SA_TOMORROW_GEOGRAPHY';
}
export function reconcileGovernance(){
  const identity=read(PATHS.identity), metro=identity.metros.find(x=>x.name==='San Antonio');
  const cohort=metro?.independentlyGovernedCommunities||[];
  if(cohort.length!==33||new Set(cohort.map(x=>x.placeGeoid)).size!==33||new Set(cohort.map(x=>x.name)).size!==33)throw Error('EXACT_33_UNIQUE_GOVERNED_PLACE_IDENTITIES_REQUIRED');
  if(cohort.some(x=>!/^48\d{5}$/.test(x.placeGeoid)||x.precedenceRequirement!=='PRESERVE_INDEPENDENT_CANONICAL_IDENTITY'))throw Error('PLACE_CANONICAL_IDENTITY_RECONCILIATION_FAILED');
  const working=read(PATHS.working), records=working.records;
  if(records.length!==30||new Set(records.map(x=>x.globalId)).size!==30)throw Error('EXACT_30_UNIQUE_ATOMIC_IDENTITIES_REQUIRED');
  const usable=records.filter(x=>x.workingGeometryAuthority);
  const far=records.find(x=>x.globalId===FAR_ID),west=records.find(x=>x.globalId===WEST_ID);
  if(usable.length!==29||far?.workingGeometryAuthority!==null||west?.workingGeometryAuthority!=='CERTIFIED_DERIVED_MAKEVALID')throw Error('WORKING_GEOMETRY_GOVERNANCE_RECONCILIATION_FAILED');
  return {cohort:cohort.sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid)),records:records.sort((a,b)=>a.globalId.localeCompare(b.globalId)),usable,pairEvaluationCount:33*29,precedence:PRECEDENCE};
}
export function auditGovernedInputs({ownerPlaceGeometry=process.env.GRIDLY_TEXAS_PLACE_ZIP,ownerSaGeometry=process.env.GRIDLY_SA_TOMORROW_GEOJSON}={}){
  const governance=reconcileGovernance();
  const westIdentity=digest(path.join(ROOT,PATHS.west));
  if(westIdentity.bytes!==WEST.bytes||westIdentity.sha256!==WEST.sha256)throw Error(`WEST_NORTHWEST_DERIVED_IDENTITY_MISMATCH: expected ${WEST.bytes}/${WEST.sha256}, received ${westIdentity.bytes}/${westIdentity.sha256}`);
  const missing=[];
  if(!ownerPlaceGeometry||!fs.existsSync(ownerPlaceGeometry))missing.push('GRIDLY_TEXAS_PLACE_ZIP');
  if(!ownerSaGeometry||!fs.existsSync(ownerSaGeometry))missing.push('GRIDLY_SA_TOMORROW_GEOJSON');
  if(ownerSaGeometry&&fs.existsSync(ownerSaGeometry)){const actual=digest(ownerSaGeometry);if(actual.bytes!==SOURCE.bytes||actual.sha256!==SOURCE.sha256)throw Error('SA_TOMORROW_OWNER_SOURCE_IDENTITY_MISMATCH');}
  return {...governance,missing,ready:missing.length===0};
}
export function failClosedFarSouthwest(){return {method:'NO_CERTIFIED_FAR_SOUTHWEST_TOPOLOGY_OR_GOVERNED_EXCLUSION_GEOMETRY_AVAILABLE',relevant:true,preventsFullCertification:true,classification:'INDETERMINATE_FAR_SOUTHWEST_GOVERNANCE_HOLD'};}

function main(){
  const modes=['--whatif','--verify','--apply'].filter(x=>process.argv.includes(x));if(modes.length!==1)throw Error('EXACTLY_ONE_GUARDED_MODE_REQUIRED');
  const audit=auditGovernedInputs();
  if(!audit.ready)throw Error(`AUTHORITATIVE_GEOMETRY_INPUTS_MISSING: ${audit.missing.join(', ')}`);
  throw Error('GDAL_3_13_OVERLAY_EXECUTION_NOT_AVAILABLE_IN_THIS_REPOSITORY_ENVIRONMENT');
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{main();}catch(e){const out={milestone:'LP191',status:'FAIL_CLOSED',error:e.message,runtimeMutationPerformed:false};(process.argv.includes('--json')?console.log:console.error)(serialize(out));process.exitCode=1;}
