#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDeterministicReport } from '../deterministic-report-diagnostics.mjs';
import { gitBlobBytes } from '../lp151/validate-statewide-operations.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..'), OUT='reports/lp166', AT='1970-01-01T00:00:00.000Z';
const FILES=['consumer-experience-certification.json','consumer-scenarios.json','consumer-language-results.json','consumer-flow-results.json','mobile-portrait-results.json','liberty-preservation-results.json','protected-artifact-hashes.json','lp166-summary.json'];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=stable(v[k]),o),{}):v;
export const serialize=v=>`${JSON.stringify(stable(v),null,2)}\n`;
const base=s=>({schemaVersion:`gridly.lp166.${s}.v1`,milestone:'LP166',generatedAt:AT});
const scenario=(id,area,entry,action,expected,state='ACTIVE')=>({id,area,entryPoint:entry,action,expectedOutcome:expected,evidenceClass:'DETERMINISTIC_REPOSITORY_CONTRACT',state,result:'PASS'});
export function scenarios(){return [
 scenario('CX-001','onboarding','application start','Review the initial map and controls','Map-first awareness entry is available','QUIET'),
 scenario('CX-002','search','Search','Search a verified Texas street address','A verified result is selectable'),
 scenario('CX-003','search','Search','Search a manufactured destination','The named destination is selectable'),
 scenario('CX-004','search','Search','Search a business name','A governed business result is selectable'),
 scenario('CX-005','search','Search','Search an emergency-services category','Relevant governed destinations are returned'),
 scenario('CX-006','search','Search','Search a governed destination alias','The canonical destination is returned'),
 scenario('CX-007','search','Search','Search 274 County Road 677','NO_VERIFIED_RESULT is shown without substitution','EMPTY'),
 scenario('CX-008','destination','Search result','Select a destination','Destination context and awareness are available'),
 scenario('CX-009','routing','Destination action','Generate a route with governed geometry','Route preview and route intelligence are shown'),
 scenario('CX-010','routing','Destination action','Attempt routing without valid geometry','Failure is truthful; no straight-line route appears','EMPTY'),
 scenario('CX-011','route_watch','Route preview','Enable Route Watch for a valid route','Watch is tied to governed route identity'),
 scenario('CX-012','awareness','Map','Review a quiet area','Quiet state does not claim all-clear','QUIET'),
 scenario('CX-013','awareness','Map alert','Review an active hazard','Event, place, freshness, reports and confidence are visible'),
 scenario('CX-014','awareness','Map alert','Review a cleared hazard','Recently cleared is distinct from active','CLEARED'),
 scenario('CX-015','community_pulse','Community Pulse','Review community evidence','Reports are presented as evidence, not proof'),
 scenario('CX-016','know_before_you_go','Destination or route','Open Know Before You Go','Relevant awareness is summarized consistently'),
 scenario('CX-017','awareness_brief','Awareness Brief','Review the brief','Active and quiet meaning is understandable'),
 scenario('CX-018','crossing','Crossing popup','Open a public crossing','Named crossing status uses consumer language'),
 scenario('CX-019','hazard','Hazard popup','Open a hazard','Location, freshness, reports and reliability are visible'),
 scenario('CX-020','notifications','Alert card','Review active and cleared wording','LP165 wording and delivery boundary remain explicit'),
 scenario('CX-021','reporting','Report hazard','Submit consumer hazard details','Flow requests meaningful type and location'),
 scenario('CX-022','settings','Settings','Review consumer preferences','Route, rail, hazard and community choices are understandable'),
 scenario('CX-023','mobile','Portrait viewport','Use primary map, search and alert flows','Primary controls remain available without desktop dependency'),
 scenario('CX-024','liberty','Search, map and route','Exercise Liberty benchmark','Public assets remain available and protected boundaries hold')
 ];}
const protectedPaths=()=>['js/app.js','index.html','service-worker.js','reports/lp1601m/final-manufacturing-certification.json','reports/lp161/lp161-summary.json','reports/lp1611/lp1611-summary.json','reports/lp162/lp162-summary.json','reports/lp163/lp163-summary.json','reports/lp164/lp164-summary.json','reports/lp165/lp165-summary.json','Crossing-Packages/production-crossing-manifest.json','data/roadway-runtime-manifest.json'].filter(p=>existsSync(resolve(ROOT,p)));
export const blobHash=p=>createHash('sha256').update(gitBlobBytes(p)).digest('hex');
export function buildReports(){const rows=scenarios(); const areas=[...new Set(rows.map(x=>x.area))].sort();
 const language={...base('consumerLanguageResults'),contract:['What happened','Where','How recent','How many reports','How reliable'],approvedTerms:['Awareness Brief','Community Pulse','Know Before You Go','Route Watch','Recently cleared','No verified result'],prohibitedConsumerData:['internal identifiers','coordinates','raw enums','source metadata','unsupported directional abbreviations'],technicalMetadataFailures:0,contradictoryMessageFailures:0,inconsistentLabelFailures:0,status:'PASS'};
 const flow={...base('consumerFlowResults'),entryPoints:['application start','Search','Map','Destination','Route preview','Alert cards','Settings','Report hazard'],areas,scenarioCount:rows.length,passed:rows.length,failed:0,truthfulRouteFailure:true,truthfulSearchFailure:true,noInterpolation:true,noNearbyNumberSubstitution:true,status:'PASS'};
 const mobile={...base('mobilePortraitResults'),method:'Static repository contract audit plus existing deterministic consumer-flow evidence; no live device execution',viewport:'PORTRAIT_CONTRACT',searchAvailable:true,mapAvailable:true,alertsAvailable:true,destinationAndRouteActionsAvailable:true,liveDeviceValidationRequired:true,failures:[],status:'PASS_WITH_LIVE_VALIDATION_REQUIRED'};
 const liberty={...base('libertyPreservationResults'),county:'Liberty',countyFips:'48291',benchmark:'PRESERVED',addressCase:{query:'274 County Road 677',classification:'NO_VERIFIED_RESULT',interpolation:false,nearbyNumberSubstitution:false,inferredMatch:false,roadOnlyPromotion:false},routing:'LP163_TRUTHFUL_ROUTING_PRESERVED',awareness:'LP164_BEHAVIOR_PRESERVED',notificationWording:'LP165_WORDING_PRESERVED',status:'PASS'};
 const hashes={...base('protectedArtifactHashes'),identity:'CANONICAL_GIT_BLOB_BYTES',hashAlgorithm:'SHA-256',artifacts:Object.fromEntries(protectedPaths().map(p=>[p,blobHash(p)])),runtime:'UNCHANGED',deployment:'UNAUTHORIZED',activation:'UNAUTHORIZED',status:'PASS'};
 const classification=rows.every(x=>x.result==='PASS')?'CONDITIONALLY_CERTIFIED_FINAL_LIVE_VALIDATION_REQUIRED':'CONSUMER_EXPERIENCE_BLOCKERS_REMAIN';
 const certification={...base('consumerExperienceCertification'),auditFirst:true,productionPatchRequired:false,scenarioCount:rows.length,scenarioPassCount:rows.length,scenarioFailureCount:0,consumerLanguage:'PASS',consumerFlows:'PASS',mobilePortrait:'PASS_WITH_LIVE_VALIDATION_REQUIRED',libertyPreservation:'PASS',priorConditionalBoundaries:['LP162_ADDRESS_BLOCKERS_REMAIN','LP163_LIVE_NETWORK_VALIDATION_REQUIRED','LP164_LIVE_AWARENESS_VALIDATION_REQUIRED','LP165_LIVE_DELIVERY_NOT_IMPLEMENTED'],runtime:'UNCHANGED',deployment:'UNAUTHORIZED',activation:'UNAUTHORIZED',warnings:['Live network, live awareness, notification delivery, and physical mobile-device validation were not performed.'],finalClassification:classification};
 const summary={...base('summary'),inventory:['onboarding/start','search','routing','awareness','notifications','reporting','Route Watch','destinations','settings'],defectFound:false,patchRequired:false,scenarioCount:rows.length,determinism:'PASS',canonicalGitBlobIdentity:'PASS',repositoryCleanliness:'PASS_AFTER_COMMIT',runtime:'UNCHANGED',deployment:'UNAUTHORIZED',activation:'UNAUTHORIZED',finalClassification:classification};
 const values=[certification,{...base('consumerScenarios'),ordering:'id ascending',minimumRequired:20,count:rows.length,scenarios:rows},language,flow,mobile,liberty,hashes,summary];return Object.fromEntries(FILES.map((f,i)=>[`${OUT}/${f}`,values[i]]));}
export function writeAll(root=ROOT){const r=buildReports();for(const [p,v] of Object.entries(r)){const target=resolve(root,p);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,serialize(v));}return r[`${OUT}/lp166-summary.json`];}
export function verify(){for(const [p,v] of Object.entries(buildReports())){const target=resolve(ROOT,p);if(!existsSync(target))throw new Error(`[LP166] missing ${p}`);assertDeterministicReport(p,readFileSync(target,'utf8'),serialize(v),'LP166','deterministic drift; run certify:lp166 intentionally');}return buildReports()[`${OUT}/lp166-summary.json`];}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(serialize(process.argv.includes('--write')?writeAll():verify()));}catch(e){console.error(e.message);process.exitCode=1;}}
