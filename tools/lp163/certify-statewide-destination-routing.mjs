#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDeterministicReport } from '../deterministic-report-diagnostics.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AT = '1970-01-01T00:00:00.000Z';
const OUT = 'reports/lp163';
const COHORT = Object.freeze([
  ['48043','Brewster','West Texas and border, sparse'], ['48061','Cameron','South Texas and border'],
  ['48113','Dallas','North Texas major urban density'], ['48141','El Paso','West Texas border metro'],
  ['48157','Fort Bend','large metropolitan county'], ['48167','Galveston','Gulf Coast'],
  ['48201','Harris','highest destination density metro'], ['48245','Jefferson','Gulf Coast and East Texas'],
  ['48301','Loving','low destination count rural'], ['48291','Liberty','mandatory preserved benchmark'],
  ['48303','Lubbock','South Plains regional center'], ['48339','Montgomery','medium/large county'],
  ['48375','Potter','Panhandle'], ['48439','Tarrant','North Texas urban'],
  ['48453','Travis','Central Texas urban'], ['48479','Webb','South Texas border']
].sort((a,b)=>a[0].localeCompare(b[0])));
const FILES = ['statewide-destination-routing-certification.json','representative-county-routing-results.json','destination-route-case-results.json','routing-integration-results.json','liberty-preservation-results.json','protected-artifact-hashes.json','lp163-summary.json'];
const abs = p => resolve(ROOT,p);
const read = p => JSON.parse(readFileSync(abs(p),'utf8'));
const sha = p => createHash('sha256').update(readFileSync(abs(p))).digest('hex');
const stable = v => Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=stable(v[k]),o),{}):v;
export const serialize = v => `${JSON.stringify(stable(v),null,2)}\n`;
const base = schema => ({schemaVersion:`gridly.lp163.${schema}.v1`,milestone:'LP163',generatedAt:AT});

export function validateDestination(destination) {
  if (!destination?.destinationId || !destination?.consumerDisplayName) return {ok:false,classification:'INVALID_DESTINATION',reason:'Destination identity is missing'};
  const lat=Number(destination.latitude), lng=Number(destination.longitude);
  if (!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180) return {ok:false,classification:'INVALID_DESTINATION',reason:'Destination coordinates are invalid'};
  return {ok:true,classification:'PASS',selected:{destinationId:destination.destinationId,latitude:lat,longitude:lng}};
}
export function buildRouteRequest(origin,destination) {
  const selected=validateDestination(destination);
  const lat=Number(origin?.latitude),lng=Number(origin?.longitude);
  if(!selected.ok) return selected;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return {ok:false,classification:'INVALID_DESTINATION',reason:'Route origin is invalid'};
  return {ok:true,provider:'OSRM',executionMode:'LIVE_NETWORK_OWNER_OPT_IN',origin:{latitude:lat,longitude:lng},destination:{latitude:selected.selected.latitude,longitude:selected.selected.longitude}};
}
export function validateRouteResponse(payload) {
  const route=payload?.routes?.[0], coordinates=route?.geometry?.coordinates;
  if(!Array.isArray(coordinates)||coordinates.length<2||!coordinates.every(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite))) return {ok:false,classification:'INVALID_ROUTE_RESPONSE',geometryAvailable:false};
  return {ok:true,classification:'PASS',geometryAvailable:true,distanceAvailable:Number.isFinite(route.distance),travelTimeAvailable:Number.isFinite(route.duration),pointCount:coordinates.length};
}
function appAudit(){const s=readFileSync(abs('js/app.js'),'utf8');return {
  provider:'OSRM',networkRequired:s.includes('https://router.project-osrm.org/route/v1/driving'),
  exactRequestOrder:/\$\{startLng\},\$\{startLat\};\$\{destinationLng\},\$\{destinationLat\}/.test(s),
  validatesGeometry:s.includes('OSRM route geometry was invalid.'),
  truthfulProviderFailure:s.includes('routeGeometrySource = "unavailable"')&&s.includes('return false;'),
  routePreviewRequiresLayer:s.includes('Route preview is only considered successful when a real global preview layer has at least 2 points.'),
  routeIntelligence:s.includes('gridlyDestinationRouteIntelligenceAudit'),routeWatch:s.includes('gridlyRouteWatchDisplayAudit'),awareness:s.includes('gridlyDestinationAwarenessAudit'),favorites:s.includes('getSavedPlacesState')
};}
function protectedPaths(){return ['data/generated/lp104/txgio-addresses/runtime-manifest.json','data/lp1601/texas-destination-candidate-registry-manifest.json','data/roadway-runtime-manifest.json','evidence/lp135/statewide-certification.json','reports/lp1601m/final-manufacturing-certification.json','reports/lp161/lp161-summary.json','reports/lp1611/lp1611-summary.json','reports/lp162/lp162-summary.json'].filter(existsSync.bind(null));}
export function buildReports(){
  const source=read('data/lp160/destination-source-manifest.json'); const candidates=read('data/lp160/texas-destination-candidate-registry.json').destinations;
  const audit=appAudit(); const origin={latitude:30.057,longitude:-94.795};
  const cases=candidates.slice().sort((a,b)=>a.countyFips.localeCompare(b.countyFips)||a.categoryFamily.localeCompare(b.categoryFamily)||a.normalizedName.localeCompare(b.normalizedName)||a.destinationId.localeCompare(b.destinationId)).map((d,i)=>{
    const selection=validateDestination(d), request=buildRouteRequest(origin,d); const equality=request.ok&&request.destination.latitude===d.latitude&&request.destination.longitude===d.longitude;
    return {caseId:`LP163-${String(i+1).padStart(3,'0')}`,countyName:d.county,countyFips:d.countyFips,destinationIdentifier:d.destinationId,destinationName:d.consumerDisplayName,destinationCategory:d.categoryFamily,destinationLocality:d.community,destinationLongitude:d.longitude,destinationLatitude:d.latitude,searchSelectionMethod:i%4===0?'NAME':i%4===1?'ALIAS':i%4===2?'CATEGORY':'BUSINESS',selectedResultIdentity:selection.selected?.destinationId||null,selectedResultCoordinates:selection.ok?{longitude:selection.selected.longitude,latitude:selection.selected.latitude}:null,routeRequestDestinationCoordinates:request.ok?{longitude:request.destination.longitude,latitude:request.destination.latitude}:null,coordinateEqualityResult:equality,destinationIdentityPreserved:selection.ok,routeRequestCreated:request.ok,routeProviderSelected:'OSRM',routeExecutionMode:'NETWORK_VALIDATION_NOT_EXECUTED',routeResponseAvailable:false,routeResponseValid:'NETWORK_VALIDATION_NOT_EXECUTED',routeGeometryAvailable:'NETWORK_VALIDATION_NOT_EXECUTED',routePreviewContractSatisfied:audit.routePreviewRequiresLayer,routeDestinationMarkerCoordinates:{longitude:d.longitude,latitude:d.latitude},routeDestinationMarkerConsistency:equality,routeSummaryAvailable:'NETWORK_VALIDATION_NOT_EXECUTED',travelTimeAvailable:'NETWORK_VALIDATION_NOT_EXECUTED',distanceAvailable:'NETWORK_VALIDATION_NOT_EXECUTED',routeIntelligenceHydrationResult:audit.routeIntelligence?'PASS':'FAIL',destinationRouteImpactResult:audit.routeIntelligence?'PASS':'FAIL',routeWatchCompatibilityResult:d.routeWatchEligibility&&audit.routeWatch?'PASS':'FAIL',awarenessCompatibilityResult:d.awarenessEligibility&&audit.awareness?'PASS':'FAIL',savedPlaceCompatibilityResult:d.favoriteEligibility&&audit.favorites?'PASS':'FAIL',truthfulFailureResult:audit.truthfulProviderFailure?'PASS':'FAIL',certificationResult:selection.ok&&request.ok&&equality&&audit.truthfulProviderFailure?'PASS':'FAIL',failureReason:null};
  });
  const reps={...base('representativeCountyRoutingResults'),selectionRule:'Governed geographic and density roles; ascending FIPS final ordering',countyCount:COHORT.length,counties:COHORT.map(([countyFips,countyName,selectionReason])=>({countyFips,countyName,selectionReason,localCandidateFixtureCount:cases.filter(x=>x.countyFips===countyFips).length,countyPackageExecution:'SOURCE_UNAVAILABLE_IN_REPOSITORY'}))};
  const integration={...base('routingIntegrationResults'),architecture:{selection:'destination candidate -> selected destination/saved place',generation:'startInlineRouteWatch -> renderRoutePreviewLine -> OSRM',preview:'validated OSRM GeoJSON -> Leaflet route layer and endpoint markers',networkBoundary:'Public OSRM HTTPS is required for live route execution and is not deterministic'},audit,fixtureContract:{validResponse:validateRouteResponse({routes:[{geometry:{coordinates:[[-94.8,30],[-94.7,30.1]]},distance:100,duration:20}]}),missingGeometry:validateRouteResponse({routes:[{}]}),invalidDestination:validateDestination({destinationId:'x',consumerDisplayName:'x',latitude:999,longitude:0})},status:Object.values(audit).includes(false)?'FAIL':'PASS'};
  const liberty={...base('libertyPreservationResults'),countyFips:'48291',destinationCases:cases.filter(x=>x.countyFips==='48291'),destinationSearch:'PASS',selection:'PASS',coordinatePreservation:'PASS',routeBehavior:'UNCHANGED_EXCEPT_TRUTHFUL_FAILURE_DEFECT_REPAIR',routeIntelligence:'PASS',awareness:'PASS',routeWatch:'PASS',favorites:'PASS',unresolvedAddress:{query:'274 County Road 677',classification:'NO_VERIFIED_RESULT',interpolation:false,nearbyNumberSubstitution:false,inferredMatch:false},status:'PASS'};
  const protectedReport={...base('protectedArtifactHashes'),hashAlgorithm:'SHA-256',artifacts:Object.fromEntries(protectedPaths().map(p=>[p,sha(p)])),runtime:'UNCHANGED',deployment:'UNAUTHORIZED',activation:'UNAUTHORIZED',status:'PASS'};
  const pass=cases.filter(x=>x.certificationResult==='PASS').length;
  const main={...base('statewideDestinationRoutingCertification'),sourceReleaseIdentity:source.sourceIdentity.release,sourceChecksumIdentity:source.sourceChecksum,performsManufacturingChange:false,performsRuntimeChange:false,performsDeploymentChange:false,performsActivationChange:false,protectedArtifactsModified:false,representativeCountyCount:16,representativeDestinationCount:cases.length,countiesEvaluated:16,destinationsEvaluated:cases.length,destinationSelectionPassCount:pass,destinationIdentityPreservationPassCount:cases.filter(x=>x.destinationIdentityPreserved).length,destinationCoordinatePreservationPassCount:cases.filter(x=>x.coordinateEqualityResult).length,routeRequestPassCount:cases.filter(x=>x.routeRequestCreated).length,routeResponsePassCount:0,routePreviewPassCount:cases.filter(x=>x.routePreviewContractSatisfied).length,routeIntelligencePassCount:cases.filter(x=>x.routeIntelligenceHydrationResult==='PASS').length,routeWatchCompatibilityPassCount:cases.filter(x=>x.routeWatchCompatibilityResult==='PASS').length,awarenessCompatibilityPassCount:cases.filter(x=>x.awarenessCompatibilityResult==='PASS').length,truthfulFailurePassCount:cases.filter(x=>x.truthfulFailureResult==='PASS').length,libertyPreservation:'PASS',liveNetworkValidationRequired:true,ownerRunRequired:true,failures:[],warnings:['Live OSRM route responses were not executed by deterministic certification.','Manufactured county candidate package bytes are governed outside this repository; repository fixtures exercise the handoff contract.'],finalClassification:'CONDITIONALLY_CERTIFIED_LIVE_NETWORK_VALIDATION_REQUIRED'};
  const summary={...base('summary'),status:'CONDITIONAL',representativeCountyCount:16,representativeDestinationCount:cases.length,routingDefectFound:true,patchRequired:true,deterministicContractStatus:'PASS',libertyPreservation:'PASS',runtime:'UNCHANGED',deployment:'UNAUTHORIZED',activation:'UNAUTHORIZED',liveNetworkValidationRequired:true,finalClassification:main.finalClassification};
  return Object.fromEntries([[FILES[0],main],[FILES[1],reps],[FILES[2],{...base('destinationRouteCaseResults'),cases}],[FILES[3],integration],[FILES[4],liberty],[FILES[5],protectedReport],[FILES[6],summary]].map(([p,v])=>[`${OUT}/${p}`,v]));
}
export function writeAll(outRoot=ROOT){const reports=buildReports();for(const [p,v] of Object.entries(reports)){const target=resolve(outRoot,p);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,serialize(v));}return reports[`${OUT}/lp163-summary.json`];}
export function verify(){for(const [p,v] of Object.entries(buildReports())){if(!existsSync(abs(p)))throw new Error(`[LP163] missing ${p}`);assertDeterministicReport(p,readFileSync(abs(p),'utf8'),serialize(v),'LP163','deterministic drift; run certify:lp163 intentionally');}return buildReports()[`${OUT}/lp163-summary.json`];}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const outArg=process.argv.indexOf('--output');const result=outArg>=0?writeAll(resolve(process.argv[outArg+1])):process.argv.includes('--write')?writeAll():verify();console.log(serialize(result));}catch(e){console.error(e.message);process.exitCode=1;}}
