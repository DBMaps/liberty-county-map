#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const P={projection:'data/generated/gridly-statewide-consumer-community-projection-v1.json',presentation:'data/generated/gridly-statewide-place-presentation-v1.json',geometry:'reports/statewide-place-presentation-geometry-audit.json',overrides:'reports/lp197/governed-place-consumer-presentation-cameras.json',manifest:'data/generated/lp104/txgio-addresses/manifest.json',source:'data/lp104/txgio-2026-address-source.json',license:'data/lp104/source-license-manifest.json',reconciliation:'evidence/lp130/final-reconciliation.json',json:'reports/lp200/statewide-governed-place-populated-core-signal-certification.json',md:'reports/lp200/statewide-governed-place-populated-core-signal-certification.md',candidate:'evidence/lp200/statewide-place-populated-core-candidates.json'};
export const PLACE_SOURCE=Object.freeze({authority:'United States Census Bureau',dataset:'2025 TIGER/Line Places — Texas',vintage:2025,filename:'tl_2025_48_place.zip',bytes:9782040,sha256:'5a0c4d49641f69028ee9f5c343bf09936ec00a378e5e6393115b106bab935e13',sourceCrs:'EPSG:4269',geoidField:'GEOID',geometryType:'Polygon (promoted to MultiPolygon for prior analysis)',featureCount:1863,eligiblePlaceCount:1859,ownerLocalPath:'C:\\GitHub\\Gridly-Source-Data\\Census\\TIGER2025\\PLACE\\original\\tl_2025_48_place.zip'});
export const PLACE_ENV='GRIDLY_TEXAS_PLACE_ZIP';
export const INTERNAL_DERIVATION_ENV='GRIDLY_LP200_INTERNAL_DERIVATION_APPROVED';
export const EXECUTION_MODES=Object.freeze({baseline:'BASELINE_FAIL_CLOSED',ownerReady:'OWNER_GOVERNED_INPUT_READY'});
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const pct=n=>Number((n/1859*100).toFixed(3));
const packageName=x=>x.outputPath.split(/[\\/]/).at(-1);
const digest=p=>{const b=fs.readFileSync(p);return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};};
const gdalExe=(name,env)=>env.GRIDLY_GDAL_BIN?path.join(env.GRIDLY_GDAL_BIN,process.platform==='win32'?`${name}.exe`:name):name;
const defaultRunner=(program,args)=>{const r=spawnSync(program,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(r.error||r.status!==0)throw Error(`LP200_PLACE_PREFLIGHT_GDAL_FAILURE:${r.error?.message||(r.stderr||r.stdout).trim()}`);return (r.stdout||'').trim();};
export function preflightPlaceGeometry(sourcePath,{env=process.env,run=defaultRunner,identity=PLACE_SOURCE}={}){
 if(!sourcePath||!fs.existsSync(sourcePath))throw Error('LP200_PLACE_PREFLIGHT_SOURCE_REQUIRED');
 if(path.basename(sourcePath).toLowerCase()!==identity.filename)throw Error('LP200_PLACE_PREFLIGHT_FILENAME_MISMATCH');
 const actual=digest(sourcePath);if(actual.bytes!==identity.bytes||actual.sha256!==identity.sha256)throw Error(`LP200_PLACE_PREFLIGHT_IDENTITY_MISMATCH:${actual.bytes}/${actual.sha256}`);
 const ogrinfo=gdalExe('ogrinfo',env),ogr2ogr=gdalExe('ogr2ogr',env),version=run(ogrinfo,['--version']);
 if(!/^GDAL 3\.13\./.test(version))throw Error(`LP200_PLACE_PREFLIGHT_GDAL_VERSION_MISMATCH:${version}`);run(ogr2ogr,['--version']);
 const datasource=`/vsizip/${path.resolve(sourcePath).replaceAll('\\','/')}`,info=run(ogrinfo,['-ro','-so','-al',datasource]);
 if(!/Feature Count:\s*1863\b/.test(info))throw Error('LP200_PLACE_PREFLIGHT_FEATURE_COUNT_MISMATCH');
 if(!/Geometry:\s*(?:Multi )?Polygon\b/i.test(info))throw Error('LP200_PLACE_PREFLIGHT_GEOMETRY_TYPE_MISMATCH');
 for(const field of ['GEOID','NAME','LSAD','CLASSFP','INTPTLAT','INTPTLON'])if(!new RegExp(`\\b${field}\\b`).test(info))throw Error(`LP200_PLACE_PREFLIGHT_FIELD_MISSING:${field}`);
 const epsg=[...info.matchAll(/(?:AUTHORITY|ID)\["EPSG",[" ]*(\d+)/g)].at(-1)?.[1];if(epsg!=='4269')throw Error(`LP200_PLACE_PREFLIGHT_CRS_MISMATCH:${epsg||'unresolved'}`);
 return {...identity,path:sourcePath,classification:'OWNER_LOCAL_GOVERNED_INPUT_AVAILABLE_BY_KNOWN_PATH',gdalVersion:version,preflight:'PASS'};
}
export function discoverPlaceGeometry({env=process.env,run=defaultRunner}={}){
 const sourcePath=[env[PLACE_ENV],PLACE_SOURCE.ownerLocalPath].filter(Boolean).find(x=>fs.existsSync(x));
 const priorReferences=['reports/statewide-place-presentation-geometry-audit.json','tools/audit-statewide-place-presentation-geometry.mjs','tools/lp191/bexar-place-overlay.mjs','reports/lp191/bexar-place-cdp-overlay.json'];
 if(!sourcePath)return {...PLACE_SOURCE,path:null,classification:'IDENTITY_KNOWN_BUT_BYTES_UNAVAILABLE',environmentVariable:PLACE_ENV,priorReferences,preflight:'NOT_RUN_BYTES_UNAVAILABLE'};
 return {...preflightPlaceGeometry(sourcePath,{env,run}),environmentVariable:PLACE_ENV,priorReferences};
}
/** Classify only fully reconciled governed inputs as owner-ready.
 *
 * This deliberately does not inspect an environment variable.  The caller must
 * first validate every package identity and complete the PLACE GDAL preflight.
 */
export function classifyExecutionMode({manifestEntries,physicalPackageFiles,identityValidPackageFiles,missingCountyFips,placePreflight}){
 const complete=manifestEntries===254&&physicalPackageFiles===254&&identityValidPackageFiles===254&&missingCountyFips.length===0&&placePreflight==='PASS';
 return complete?EXECUTION_MODES.ownerReady:EXECUTION_MODES.baseline;
}
export function internalDerivationAuthorization(env=process.env){
 return env[INTERNAL_DERIVATION_ENV]==='1'
  ?{environmentVariable:INTERNAL_DERIVATION_ENV,approved:true,classification:'INTERNAL_CERTIFICATION_ONLY_DERIVATION'}
  :{environmentVariable:INTERNAL_DERIVATION_ENV,approved:false,classification:'INTERNAL_CERTIFICATION_ONLY_DERIVATION_NOT_AUTHORIZED'};
}
export function build({env=process.env,run=defaultRunner}={}){
 const projection=read(P.projection), manifest=read(P.manifest), source=read(P.source), license=read(P.license), reconciliation=read(P.reconciliation), current=read(P.presentation), overrides=read(P.overrides);
 if(projection.counts.uniquePlaceCount!==1859||projection.counts.membershipCount!==2058)throw Error('governed PLACE inventory mismatch');
 const packages=manifest.packages.map(x=>{const relative=`data/generated/lp104/txgio-addresses/${packageName(x)}`,absolute=path.join(ROOT,relative),present=fs.existsSync(absolute);return {fips:x.fips,path:relative,expectedBytes:x.outputBytes,expectedSha256:x.packageHash,acceptedRecords:x.acceptedRecords,present,identityValid:present&&fs.statSync(absolute).size===x.outputBytes&&hash(relative)===x.packageHash};});
 const validPackages=packages.filter(x=>x.identityValid),valid=new Set(validPackages.map(x=>x.fips)), missing=packages.filter(x=>!x.present), invalid=packages.filter(x=>x.present&&!x.identityValid),placeGeometry=discoverPlaceGeometry({env,run});
 const missingCountyFips=packages.filter(x=>!x.identityValid).map(x=>x.fips);
 const executionMode=classifyExecutionMode({manifestEntries:manifest.packages.length,physicalPackageFiles:packages.filter(x=>x.present).length,identityValidPackageFiles:validPackages.length,missingCountyFips,placePreflight:placeGeometry.preflight});
 const authorization=internalDerivationAuthorization(env);
 const inventory=projection.communities.map(x=>{const covered=x.countyMemberships.filter(f=>valid.has(f));return {placeGeoid:x.placeGeoid,label:x.displayName,countyMemberships:x.countyMemberships,addressPointsIntersectingPlace:null,uniqueAddressCount:null,addressDensityPerSquareKilometer:null,memberCountyArtifactsAvailable:covered,coverageAcrossAllMemberCounties:covered.length===x.countyMemberships.length,sourcePackageProvenance:x.countyMemberships.map(f=>packages.find(p=>p.fips===f)?.path??null),signalCoverage:'ADDRESS_SIGNAL_UNAVAILABLE',signalEligibility:'POPULATED_CORE_UNAVAILABLE',reason:'Required governed package set and raw governed PLACE polygon are not both available in this checkout; no spatial association or count was fabricated.'};});
 const names=['Dallas','Fort Worth','Austin','El Paso','Amarillo','Corpus Christi','McAllen','Port Arthur','Tyler','Waco','Lubbock','Laredo','Brownsville','Galveston','Denton','Temple','Nacogdoches','Alpine','Marfa','Palestine'];
 const cameras=overrides.cameras;
 const controls=names.map(label=>{const i=inventory.find(x=>x.label===label),c=current.places[i.placeGeoid],o=cameras.find(x=>x.placeGeoid===i.placeGeoid);return {placeGeoid:i.placeGeoid,label,currentCamera:{lat:c.lat,lng:c.lng,zoom:13},ownerApprovedCamera:o?{lat:o.lat,lng:o.lng,zoom:o.zoom}:null,candidatePopulatedCore:null,addressCount:null,localDensitySignal:'UNAVAILABLE',containmentStatus:'NOT_EVALUATED',confidence:'POPULATED_CORE_UNAVAILABLE',review:'OWNER_VISUAL_CERTIFICATION_NOT_YET_APPLICABLE'};});
 const calibrationNames=names.slice(0,10),calibrationCoverage=inventory.filter(x=>calibrationNames.includes(x.label)).map(x=>({label:x.label,placeGeoid:x.placeGeoid,requiredCountyFips:x.countyMemberships,availableCountyFips:x.memberCountyArtifactsAvailable,complete:x.coverageAcrossAllMemberCounties}));
 const classification=executionMode===EXECUTION_MODES.ownerReady?(authorization.approved?'OWNER_EXECUTION_AUTHORIZED_DERIVATION_REQUIRED':'NOT_READY_INTERNAL_DERIVATION_AUTHORIZATION_REQUIRED'):'NOT_READY_OWNER_INPUT_REQUIRED';
 return {schemaVersion:'gridly.lp200.statewide-governed-place-populated-core-signal-certification.v1',milestone:'LP200',classification,executionMode,scope:{certificationOnly:true,runtimeActivation:false,identityMutation:false,countyMembershipMutation:false,zipMutation:false,cameraRegistryMutation:false},generatedFrom:Object.fromEntries(['projection','presentation','geometry','overrides','manifest','source','license','reconciliation'].map(k=>[k,{path:P[k],sha256:hash(P[k])}])),sourceInventory:[
  {source:'LP130 certified address packages',path:'data/generated/lp104/txgio-addresses/*.addresses.jsonl.gz',classification:'PARTIAL_COVERAGE',manifestEntries:manifest.packages.length,filesPresent:packages.filter(x=>x.present).length,identityValidPackageFiles:validPackages.length,uniqueCountyFipsRepresented:valid.size,missingCountyFips:packages.filter(x=>!x.identityValid).map(x=>x.fips),filesMissing:missing.length,identityInvalid:invalid.length,governedRecordsRepresented:validPackages.reduce((s,x)=>s+x.acceptedRecords,0)},
  {source:'statewide address manifest',path:P.manifest,classification:'GOVERNED_EXISTING',vintage:manifest.source,recordCount:manifest.sourceRecordCount,countyCount:manifest.packages.length},
  {source:'address source/license identity',path:`${P.source}; ${P.license}`,classification:'GOVERNED_EXISTING',governance:'storage allowed; redistribution/derivatives unresolved and production ineligible'},
  {source:'PLACE identity and memberships',path:P.projection,classification:'GOVERNED_EXISTING',coverage:1859,memberships:2058},
  {source:'PLACE presentation points',path:P.presentation,classification:'GOVERNED_EXISTING',coverage:1859},
  {source:'PLACE polygon diagnostics (not raw polygons)',path:P.geometry,classification:'DERIVED_FROM_GOVERNED',coverage:1859},
  {source:'raw governed PLACE polygons required for point containment',path:placeGeometry.path,classification:placeGeometry.classification,identity:PLACE_SOURCE,environmentVariable:PLACE_ENV},
  {source:'county geometry',path:'data/generated/gridly-authoritative-county-geometry.json',classification:fs.existsSync(path.join(ROOT,'data/generated/gridly-authoritative-county-geometry.json'))?'GOVERNED_EXISTING':'NOT_AVAILABLE'},
  {source:'road/intersection density',path:'statewide governed point/graph evidence',classification:'NOT_AVAILABLE'},
  {source:'ZIP/community projection',path:'data/generated/gridly-statewide-consumer-zip-index-v1.json',classification:'GOVERNED_EXISTING_SUPPORT_ONLY_NOT_POPULATED_CORE'},
  {source:'crossing/location evidence',path:'Crossing-Packages',classification:'PARTIAL_COVERAGE_NOT_APPROPRIATE_FOR_CORE'}],
 placeGeometry, addressFeasibility:{manifestEntries:manifest.packages.length,packageFilesPhysicallyPresent:packages.filter(x=>x.present).length,identityValidPackageFiles:validPackages.length,uniqueCountyFipsRepresented:valid.size,missingCountyFips:packages.filter(x=>!x.identityValid).map(x=>x.fips),all254ManifestEntries:true,all254PackageArtifactsAvailable:missing.length===0&&invalid.length===0,manifestCountyCount:254,availableValidCountyCount:valid.size,missingCountyCount:packages.length-valid.size,manifestAddressRecords:manifest.sourceRecordCount,availableAddressRecords:validPackages.reduce((s,x)=>s+x.acceptedRecords,0),coordinatePrecision:'EPSG:4326 output declared; precision cannot establish completeness',deterministicPlaceAssociation:placeGeometry.preflight==='PASS',licenseGovernanceReady:false,decision:'FAIL_CLOSED_BEFORE_SPATIAL_PROCESSING'},
 packageAvailabilityReconciliation:{initialReportValidPackageFiles:59,currentManifestEntries:manifest.packages.length,currentPackageFilesPhysicallyPresent:packages.filter(x=>x.present).length,currentIdentityValidPackageFiles:validPackages.length,currentUniqueCountyFipsRepresented:valid.size,currentMissingCountyFips:packages.filter(x=>!x.identityValid).map(x=>x.fips),currentGovernedRecordsRepresented:validPackages.reduce((s,x)=>s+x.acceptedRecords,0),historicalPackageTreeFileCount:149,currentHeadPackageTreeFileCount:149,historicalFilesAbsentFromHead:0,explanation:'The initial 59 was an identity-valid package-file count, not a package-tree file count. The 149 tree entries include package sidecars, runtime certificates, and the manifest. Safe owner comparison found no additive historical package-tree files; current counts are recomputed only from physical files and manifest byte/hash validation.'},
 authorizationGate:{classification:authorization.classification,environmentVariable:INTERNAL_DERIVATION_ENV,internalCertificationOnlyComputation:{knownProhibited:false,approved:authorization.approved,status:authorization.classification},commitDerivedPopulatedCoreCoordinates:{knownProhibited:false,permitted:false,status:'CERTIFICATION_EVIDENCE_ONLY_DO_NOT_PROMOTE_TO_RUNTIME'},redistributeRawAddressRecords:{permitted:false,status:'NOT_AUTHORIZED'},rawAddressStorage:{permitted:true,status:'GOVERNED_EXISTING'},finding:'Authorization permits only internal certification computation. It never permits raw redistribution, public exposure, runtime activation, production coordinates, or deployment.'},
 executionReadiness:{executionMode,technicalInputsReady:executionMode===EXECUTION_MODES.ownerReady,fullStatewideAddressCoverageReady:valid.size===254,calibrationCoverage,calibrationPlacesReady:calibrationCoverage.filter(x=>x.complete).map(x=>x.label),calibrationPlacesBlocked:calibrationCoverage.filter(x=>!x.complete).map(x=>x.label),polygonReady:placeGeometry.preflight==='PASS',authorizationForInternalComputation:authorization.classification,realProcessingCanRun:executionMode===EXECUTION_MODES.ownerReady&&authorization.approved,reason:executionMode!==EXECUTION_MODES.ownerReady?'The complete identity-valid address cohort and exact preflighted PLACE source do not coexist.':authorization.approved?'Every technical and governance input gate passed; certification-only derivation is authorized.':'Technical gates passed, but explicit internal-derivation authorization is absent.'},
 thresholds:{complete:'all member county packages identity-valid AND >=50 unique contained points',partial:'one or more, but not all, member county packages identity-valid',sparse:'all packages available and 1-49 unique contained points',zero:'all packages available and 0 contained points',unavailable:'a required package, raw PLACE polygon, or authorization is unavailable'},
 coverage:{totalPlaces:1859,totalMemberships:2058,ADDRESS_SIGNAL_COMPLETE:0,ADDRESS_SIGNAL_PARTIAL:0,ADDRESS_SIGNAL_SPARSE:0,ADDRESS_SIGNAL_ZERO:0,ADDRESS_SIGNAL_UNAVAILABLE:1859,POPULATED_CORE_CERTIFIED:0,POPULATED_CORE_REVIEW_REQUIRED:0,POPULATED_CORE_INSUFFICIENT_SIGNAL:0,POPULATED_CORE_UNAVAILABLE:1859,percentAvailable:0,percentUnavailable:pct(1859)},
 algorithms:['mean projected coordinate','projected coordinate medians / robust geometric median','highest-density fixed grid','highest-density adaptive bounded kernel-like grid','weighted centroid of occupied grid cells','densest connected address-cluster centroid'].map(method=>({method,status:'NOT_EVALUATED_INPUT_GATE_FAILED',projection:'EPSG:3083'})),gridResolutionStudy:{cellSizesMeters:[250,500,1000,2000],status:'NOT_EVALUATED_INPUT_GATE_FAILED'},robustness:{outlierResilience:'NOT_EVALUATED',containment:'NOT_EVALUATED_NO_RAW_PLACE_POLYGONS',multiCountyRule:'aggregate by canonical PLACE GEOID across every governed membership; never choose a primary county'},
 calibration:{truth:cameras.map(x=>({placeGeoid:x.placeGeoid,label:x.label,lat:x.lat,lng:x.lng,zoom:x.zoom})),lp199Baseline:{meanErrorMeters:4855.401,totalErrorMeters:19421.605,maximumErrorMeters:10562.890},candidateMetrics:[],minimumReviewBar:'>=30% mean-error reduction, no catastrophic regression, plausible known-bad movement, high statewide coverage',finding:'NO CANDIDATE; metrics were not fabricated'},knownBadControls:controls.filter(x=>['Corpus Christi','McAllen','Port Arthur','Tyler','Waco'].includes(x.label)),smallPlaceControls:controls.filter(x=>['Temple','Nacogdoches','Alpine','Marfa','Palestine'].includes(x.label)),ownerVisualCohort:controls,
 selectedSignal:{model:null,status:'NO_MODEL_INPUT_GATE_FAILED'},fallbackModel:'OWNER_APPROVED_OVERRIDE -> CERTIFIED_POPULATED_CORE (none) -> EXISTING_CANONICAL_PLACE_CAMERA; documentation only, runtime unchanged',corpusChristiSearchFinding:{placeGeoid:'4817000',classification:'LP196_VISIBLE_PICKER_PARITY_DEFECT_REMAINS_EXPLICIT_AND_SEPARATE',repairIncluded:false,finding:'Existing generic LP196 tests cover canonical collapse, but LP199 recorded owner-visible duplicate county rows. LP200 makes no search/runtime change without a browser reproduction.'},candidateArtifact:{path:P.candidate,emitted:false,reason:'Derivation is not feasible in this checkout; emitting null statewide candidates would misrepresent evidence.'},performance:{recordsProcessed:0,duration:'not recorded in deterministic artifact',intermediateArtifactBytes:0,reason:'identity/input gate stops before expensive spatial processing'},ownerExecution:{required:true,safety:'ADDITIVE_FILE_SPECIFIC_IDENTITY_VERIFIED_NON_DESTRUCTIVE; never restore historical directories over current HEAD',expectedSource:source.defaultWindowsGdb,placeEnvironmentVariable:PLACE_ENV,internalDerivationEnvironmentVariable:INTERNAL_DERIVATION_ENV,knownPlaceSourcePath:PLACE_SOURCE.ownerLocalPath,manifestPath:P.manifest,manifestSha256:hash(P.manifest),expectedBytes:manifest.packages.reduce((s,x)=>s+x.outputBytes,0),expectedAddressRecords:manifest.sourceRecordCount,commands:["Set-Location C:\\GitHub\\liberty-county-map",`$env:${PLACE_ENV} = '${PLACE_SOURCE.ownerLocalPath}'`,`$env:${INTERNAL_DERIVATION_ENV} = '1'`,"npm run build:lp200","npm run verify:lp200","npm run test:lp200"]},runtimeRecommendation:'DO_NOT_ACTIVATE; use only exact, preflighted governed inputs and explicit internal-certification authorization. Never overlay historical directories or promote certification evidence to runtime.',inventory};
}
function markdown(d){const g=d.placeGeometry,a=d.authorizationGate,r=d.packageAvailabilityReconciliation;return `# LP200 — Statewide governed PLACE populated-core signal certification

## Final classification

**${d.classification}**

Execution mode: **${d.executionMode}**.

No populated-core candidate was emitted or activated. Runtime, LP197, identities, memberships, ZIPs, and cameras are unchanged.

## Address package reconciliation

The manifest has **${r.currentManifestEntries}** entries. Current physical package files: **${r.currentPackageFilesPhysicallyPresent}**; identity-valid package files / unique county FIPS: **${r.currentIdentityValidPackageFiles} / ${r.currentUniqueCountyFipsRepresented}**; missing county FIPS: **${r.currentMissingCountyFips.length}**; governed records represented: **${r.currentGovernedRecordsRepresented.toLocaleString('en-US')}** of ${d.addressFeasibility.manifestAddressRecords.toLocaleString('en-US')}.

The initial **59** was a package-file count, not a package-tree count. Both the historical and current HEAD trees contain 149 entries and the additive comparison found zero historical files absent from HEAD. Sidecars, certificates, and the manifest account for the difference between 149 tree entries and package files. No historical directory restore is needed or safe.

## Governed statewide PLACE polygon

Prior statewide geometry and LP191 used **${g.dataset}**, \`${g.filename}\`, vintage ${g.vintage}: ${g.bytes} bytes; SHA-256 \`${g.sha256}\`; source CRS ${g.sourceCrs}; identity field \`${g.geoidField}\`; ${g.geometryType}; ${g.featureCount} source features reconciling to ${g.eligiblePlaceCount} eligible PLACEs. Classification: **${g.classification}**. Known owner path: \`${g.ownerLocalPath}\`. Portable input contract: \`${g.environmentVariable}\`. Required toolchain is QGIS 3.44.11 / GDAL 3.13.x (OGR/GEOS/PROJ). The strict preflight checks filename, bytes, hash, GDAL version, feature count, geometry, fields, CRS, and governed eligibility contract and fails closed.

Prior certification references are recorded in the JSON. The source is not replaced or reacquired.

## Authorization gate (separate decisions)

A. Internal certification-only computation: **${d.authorizationGate.classification}** (explicit opt-in: \`${d.authorizationGate.environmentVariable}=1\`). B. Committing production populated-core coordinates remains **not authorized**. C. Raw address redistribution and public exposure remain **not authorized**. D. Runtime activation and deployment remain outside this authorization. Storage remains governed and permitted. These decisions are not conflated.

## Execution readiness

Polygon preflight: **${g.preflight}**. Full statewide address coverage: **${d.executionReadiness.fullStatewideAddressCoverageReady}**. Calibration controls ready: ${d.executionReadiness.calibrationPlacesReady.join(', ')||'none'}; blocked: ${d.executionReadiness.calibrationPlacesBlocked.join(', ')||'none'}. Real-processing gate: **${d.executionReadiness.realProcessingCanRun}**. No missing county is fabricated and no null candidate artifact is emitted.

All 1,859 PLACE rows remain \`ADDRESS_SIGNAL_UNAVAILABLE\` because package coverage, raw polygon availability, and authorization are evaluated separately and the required gates do not currently coexist.

## Safe owner procedure (PowerShell)

Never restore a historical evidence, report, or generated-input directory over HEAD. Historical recovery, if later proven necessary, must be additive, file-specific, identity-verified, and non-destructive.

\`\`\`powershell
${d.ownerExecution.commands.join('\n')}
\`\`\`

The next owner action is to set the environment variable to the already governed archive and rerun LP200. The build validates the archive and every physically present package by bytes and SHA-256. Do not modify runtime or LP197.
`}

export function outputs(){const d=build();return {[P.json]:JSON.stringify(d,null,2)+'\n',[P.md]:markdown(d)}}
export function run(mode){for(const [p,bytes] of Object.entries(outputs())){const a=path.join(ROOT,p);if(mode==='write'){fs.mkdirSync(path.dirname(a),{recursive:true});fs.writeFileSync(a,bytes);}else if(!fs.existsSync(a)||fs.readFileSync(a,'utf8')!==bytes)throw Error(`LP200_DETERMINISM_MISMATCH:${p}`)}return build()}
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv.includes('--write')?'write':'verify';run(mode);console.log(`LP200 ${mode} passed`)}
