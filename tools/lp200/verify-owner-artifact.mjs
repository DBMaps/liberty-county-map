#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { METHODS } from './derive-populated-cores.mjs';
import { PLACE_SOURCE } from './build-statewide-place-populated-core-certification.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const PROJECTION='data/generated/gridly-statewide-consumer-community-projection-v1.json';
const MANIFEST='data/generated/lp104/txgio-addresses/manifest.json';
const PRESENTATION='data/generated/gridly-statewide-place-presentation-v1.json';
const TRUTH='reports/lp197/governed-place-consumer-presentation-cameras.json';
const REPORT_JSON='reports/lp200/statewide-governed-place-populated-core-signal-certification.json';
const REPORT_MD='reports/lp200/statewide-governed-place-populated-core-signal-certification.md';
export const OWNER_ARTIFACT_ENV='GRIDLY_LP200_OWNER_CANDIDATE_ARTIFACT';
export const FIRST_OWNER_IDENTITY=Object.freeze({bytes:8952409,sha256:'0c66bb25978f186bf37633dfb77e01bfbcb686b5309db0ec3055af5a2478e1fc',acceptedAddressRecords:12130953,manifestSha256:'3d19b17c97550be08609b36b3954f7e19e09784516768553e19c3a3253d50f2a'});
const read=p=>JSON.parse(fs.readFileSync(path.isAbsolute(p)?p:path.join(ROOT,p),'utf8'));
const digestBytes=b=>({bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});
const fileDigest=p=>digestBytes(fs.readFileSync(p));
const stable=x=>JSON.stringify(x,null,2)+'\n';
const fail=s=>{throw Error(`LP200_OWNER_ARTIFACT_${s}`);};
const hav=(a,b)=>{const R=6371008.8,r=n=>n*Math.PI/180,v=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lng-a.lng)/2)**2;return 2*R*Math.asin(Math.sqrt(v));};
const forbiddenKeys=new Set(['generatedAt','startedAt','finishedAt','timestamp','pid','processingDurationMilliseconds','durationMilliseconds','tempPath','temporaryPath']);
function assertNoVolatile(value){if(!value||typeof value!=='object')return;for(const [k,v] of Object.entries(value)){if(forbiddenKeys.has(k))fail(`VOLATILE_FIELD:${k}`);assertNoVolatile(v);}}

/** Validate without opening a raw address package or invoking GDAL. */
export function preflightOwnerArtifact(artifactPath,{legacyIdentity=FIRST_OWNER_IDENTITY}={}){
 if(!artifactPath)fail(`PATH_REQUIRED:set ${OWNER_ARTIFACT_ENV}`);
 if(!fs.existsSync(artifactPath)||!fs.statSync(artifactPath).isFile())fail('FILE_NOT_FOUND');
 const bytes=fs.readFileSync(artifactPath),identity=digestBytes(bytes);let artifact;
 try{artifact=JSON.parse(bytes);}catch{fail('INVALID_JSON');}
 const projection=read(PROJECTION),manifest=read(MANIFEST),manifestIdentity=fileDigest(path.join(ROOT,MANIFEST));
 if(projection.counts.uniquePlaceCount!==1859||projection.counts.membershipCount!==2058)fail('GOVERNED_INVENTORY_MISMATCH');
 if(artifact.schemaVersion!=='gridly.lp200.statewide-place-populated-core-candidates.v1'||artifact.certificationOnly!==true||artifact.rowCount!==1859||!artifact.places||Array.isArray(artifact.places))fail('SCHEMA_MISMATCH');
 assertNoVolatile(artifact);
 const topLevelKeys=Object.keys(artifact),allowedTopLevel=['schemaVersion','certificationOnly','rowCount','deduplicationRule','places','inputBinding'];
 if(topLevelKeys.some(k=>!allowedTopLevel.includes(k)))fail('UNEXPECTED_TOP_LEVEL_FIELD');
 const expected=new Map(projection.communities.map(c=>[c.placeGeoid,c])),geoids=Object.keys(artifact.places);
 if(geoids.length!==1859||new Set(geoids).size!==1859)fail('GEOID_COUNT_OR_DUPLICATE');
 if(geoids.some(g=>!expected.has(g))||[...expected.keys()].some(g=>!Object.hasOwn(artifact.places,g)))fail('GEOID_INVENTORY_MISMATCH');
 let memberships=0;
 for(const [geoid,row] of Object.entries(artifact.places)){
  const governed=expected.get(geoid);memberships+=row.countyMemberships?.length||0;
  const rowKeys=['placeGeoid','label','countyMemberships','addressPointsIntersectingPlace','uniqueAddressCount','addressDensityPerSquareKilometer','selectedDensityResolutionMeters','candidates','selectedMethod','classification'];
  if(Object.keys(row).some(k=>!rowKeys.includes(k)))fail(`UNEXPECTED_ROW_FIELD:${geoid}`);
  if(row.placeGeoid!==geoid||row.label!==governed.displayName||JSON.stringify(row.countyMemberships)!==JSON.stringify(governed.countyMemberships))fail(`PLACE_CONTRACT_MISMATCH:${geoid}`);
  if(!Number.isInteger(row.uniqueAddressCount)||row.uniqueAddressCount<0||!Number.isInteger(row.addressPointsIntersectingPlace)||row.addressPointsIntersectingPlace<0)fail(`ADDRESS_COUNT_INVALID:${geoid}`);
  if(!['POPULATED_CORE_CERTIFIED','POPULATED_CORE_INSUFFICIENT_SIGNAL'].includes(row.classification))fail(`CLASSIFICATION_INVALID:${geoid}`);
  if(JSON.stringify(Object.keys(row.candidates||{}))!==JSON.stringify(METHODS))fail(`METHOD_VOCABULARY_MISMATCH:${geoid}`);
  if(row.selectedMethod!==null&&!METHODS.includes(row.selectedMethod))fail(`SELECTED_METHOD_INVALID:${geoid}`);
  for(const [method,c] of Object.entries(row.candidates)){if(c===null){if(row.uniqueAddressCount!==0)fail(`NULL_CANDIDATE:${geoid}`);continue;}if(c.method!==method||c.containment!=='PASS'||![c.lat,c.lng,c.projectedX,c.projectedY,c.addressSupport].every(Number.isFinite)||typeof c.containedAddressFallbackApplied!=='boolean')fail(`CANDIDATE_CONTRACT_MISMATCH:${geoid}/${method}`);}
 }
 if(memberships!==2058)fail('MEMBERSHIP_COUNT_MISMATCH');
 const acceptedAddressRecords=manifest.packages.reduce((n,p)=>n+p.acceptedRecords,0),binding={manifestSha256:manifestIdentity.sha256,acceptedAddressRecords,packageCount:manifest.packages.length,packageIdentities:manifest.packages.map(p=>({fips:p.fips,bytes:p.outputBytes,sha256:p.packageHash})),placeSource:{filename:PLACE_SOURCE.filename,bytes:PLACE_SOURCE.bytes,sha256:PLACE_SOURCE.sha256,vintage:PLACE_SOURCE.vintage},canonicalPlaceCount:1859,membershipCount:2058};
 const legacy=identity.bytes===legacyIdentity.bytes&&identity.sha256===legacyIdentity.sha256;
 if(legacy){if(binding.manifestSha256!==legacyIdentity.manifestSha256||binding.acceptedAddressRecords!==legacyIdentity.acceptedAddressRecords)fail('LEGACY_INPUT_IDENTITY_MISMATCH');}
 else {const b=artifact.inputBinding;if(!b||b.manifestSha256!==binding.manifestSha256||b.acceptedAddressRecords!==binding.acceptedAddressRecords||b.packageCount!==254||JSON.stringify(b.packageIdentities)!==JSON.stringify(binding.packageIdentities)||b.placeSource?.sha256!==PLACE_SOURCE.sha256||b.placeSource?.bytes!==PLACE_SOURCE.bytes||b.placeSource?.vintage!==2025||b.canonicalPlaceCount!==1859||b.membershipCount!==2058)fail('INPUT_IDENTITY_MISMATCH');}
 return {artifact,artifactPath:path.resolve(artifactPath),identity,binding,bindingAuthority:legacy?'FIRST_OWNER_EXACT_IDENTITY_ATTESTATION':'EMBEDDED_INPUT_BINDING'};
}

export function certifyOwnerArtifact(preflight){
 const {artifact,identity,binding,bindingAuthority}=preflight,projection=read(PROJECTION),presentation=read(PRESENTATION),truth=read(TRUTH),rows=artifact.places;
 const truths=truth.cameras,metrics=METHODS.map(method=>{const perCityErrors=truths.map(t=>({placeGeoid:t.placeGeoid,label:t.label,errorMeters:Number(hav(t,rows[t.placeGeoid].candidates[method]).toFixed(3))})),values=perCityErrors.map(x=>x.errorMeters).sort((a,b)=>a-b),total=perCityErrors.reduce((n,x)=>n+x.errorMeters,0),mean=total/perCityErrors.length;return {method,perCityErrors,meanErrorMeters:Number(mean.toFixed(3)),medianErrorMeters:Number(((values[1]+values[2])/2).toFixed(3)),totalErrorMeters:Number(total.toFixed(3)),maximumErrorMeters:Number(Math.max(...values).toFixed(3)),percentageImprovementVsLp199Mean:Number(((4855.401-mean)/4855.401*100).toFixed(3))};});
 const controls=labels=>labels.map(label=>{const community=projection.communities.find(c=>c.displayName===label),row=rows[community.placeGeoid],camera=presentation.places[community.placeGeoid],selected=row.selectedMethod?row.candidates[row.selectedMethod]:null;return {placeGeoid:community.placeGeoid,label,currentCamera:{lat:camera.lat,lng:camera.lng,zoom:13},addressCount:row.uniqueAddressCount,signalStrength:row.classification,allCandidates:row.candidates,selectedMethod:row.selectedMethod,movementDistanceFromCurrentCameraMeters:selected?Number(hav(camera,selected).toFixed(3)):null,containment:selected?.containment??'NOT_EVALUATED',classification:row.classification,confidence:row.uniqueAddressCount>=50?'SUFFICIENT_SIGNAL':'INSUFFICIENT_SIGNAL'};});
 return {schemaVersion:'gridly.lp200.owner-artifact-certification.v1',milestone:'LP200.5',classification:'OWNER_ARTIFACT_VERIFIED',executionMode:'OWNER_ARTIFACT_ONLY_VERIFICATION',scope:{certificationOnly:true,addressPackagesOpened:false,derivePopulatedCoresInvoked:false,gdalSpatialExportInvoked:false,runtimeMutation:false},ownerArtifact:{pathSource:OWNER_ARTIFACT_ENV,bytes:identity.bytes,sha256:identity.sha256,rowCount:artifact.rowCount,unchangedRequired:true},inputIdentity:{...binding,bindingAuthority},calibration:{truth:truths,lp199Baseline:{meanErrorMeters:4855.401,totalErrorMeters:19421.605,maximumErrorMeters:10562.890},candidateMetrics:metrics},knownBadControls:controls(['Corpus Christi','McAllen','Port Arthur','Tyler','Waco']),smallPlaceControls:controls(['Temple','Nacogdoches','Alpine','Marfa','Palestine']),performanceHistory:{classification:'FIRST_OWNER_EXECUTION_EVIDENCE',cryptographicallyBound:bindingAuthority==='FIRST_OWNER_EXACT_IDENTITY_ATTESTATION',totalSourceRecords:12130953,validCoordinateRecords:12130953,deduplicatedRecords:12130953,duplicateRecordsRejected:0,recordsIntersectingPlaces:8390642,placeAssociations:8390642,note:'Preserved first-owner execution evidence; not recomputed or represented as artifact-verification performance.'},determinism:{inputs:['governed identity metadata','owner candidate artifact','LP197 calibration truth'],volatileFieldsAbsent:true},recommendation:'CERTIFICATION_EVIDENCE_ONLY_DO_NOT_ACTIVATE_RUNTIME'};
}
function markdown(r){return `# LP200.5 — Existing owner derivation artifact certification\n\n**${r.classification}**\n\nArtifact-only mode read the explicit \`${OWNER_ARTIFACT_ENV}\` path. It did not open address gzip packages, call \`derivePopulatedCores\`, invoke GDAL, or rewrite the candidate artifact.\n\n## Artifact identity\n\nBytes: **${r.ownerArtifact.bytes}**  \nSHA-256: \`${r.ownerArtifact.sha256}\`  \nRows / canonical GEOIDs / memberships: **1859 / 1859 / 2058**. Binding authority: **${r.inputIdentity.bindingAuthority}**.\n\n## Calibration recomputed from candidate rows\n\n| Method | Mean m | Median m | Total m | Maximum m | Improvement vs LP199 mean |\n|---|---:|---:|---:|---:|---:|\n${r.calibration.candidateMetrics.map(x=>`| ${x.method} | ${x.meanErrorMeters} | ${x.medianErrorMeters} | ${x.totalErrorMeters} | ${x.maximumErrorMeters} | ${x.percentageImprovementVsLp199Mean}% |`).join('\n')}\n\nKnown-bad controls: ${r.knownBadControls.map(x=>x.label).join(', ')}. Small-place controls: ${r.smallPlaceControls.map(x=>x.label).join(', ')}. Full extracted candidate details are in the JSON report.\n\nFirst-owner processing counts are classified as **FIRST_OWNER_EXECUTION_EVIDENCE**, separate from recomputed certification facts. Runtime remains unchanged.\n`;}
export function ownerArtifactOutputs(artifactPath){const before=fileDigest(artifactPath),report=certifyOwnerArtifact(preflightOwnerArtifact(artifactPath)),json=stable(report),md=markdown(report),again=certifyOwnerArtifact(preflightOwnerArtifact(artifactPath));if(json!==stable(again)||md!==markdown(again))fail('NONDETERMINISTIC_REPORT');const after=fileDigest(artifactPath);if(JSON.stringify(before)!==JSON.stringify(after))fail('HASH_CHANGED');return {[REPORT_JSON]:json,[REPORT_MD]:md};}
export function runOwnerArtifactVerification(env=process.env){const artifactPath=env[OWNER_ARTIFACT_ENV];const before=artifactPath&&fs.existsSync(artifactPath)?fileDigest(artifactPath):null,out=ownerArtifactOutputs(artifactPath);for(const [p,bytes] of Object.entries(out)){const target=path.join(ROOT,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}const after=fileDigest(artifactPath);if(JSON.stringify(before)!==JSON.stringify(after))fail('HASH_CHANGED_AFTER_REPORT_WRITE');return {artifact:after,reports:Object.keys(out)};}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(!process.argv.includes('--verify-owner-artifact'))fail('EXPLICIT_MODE_REQUIRED');console.log(JSON.stringify(runOwnerArtifactVerification(),null,2));}
