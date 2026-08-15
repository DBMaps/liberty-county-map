#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const OUTPUT='reports/lp2012/owner-visual-certification.json';
const WHATIF='reports/lp2012/promotion-whatif.json';
const SUMMARY='reports/lp2012/promotion-whatif-summary.json';
const REVIEW='reports/lp2012/promotion-whatif-review.json';
const read=f=>fs.readFileSync(path.join(ROOT,f));
const json=f=>JSON.parse(read(f));
const hash=f=>crypto.createHash('sha256').update(read(f)).digest('hex');
const assert=(value,message)=>{if(!value)throw new Error(`LP201.2 owner certification fail-closed: ${message}`);};
export const serialize=value=>`${JSON.stringify(value,null,2)}\n`;

const OWNER_REVIEWS=[
  ['Corpus Christi','extreme-distance/coastal','Named-place anchor corrects the offshore/current geographic-center presentation and centers the developed Corpus Christi urban core.'],
  ['Stamford','extreme-distance/inland','Named-place anchor corrects the Lake Stamford presentation and centers the actual Stamford community.'],
  ['Galveston','island/irregular municipal geography','Named-place anchor replaces western-island geographic framing with the developed Galveston urban core.'],
  ['Monahans','extreme-distance/inland','Named-place anchor corrects the displaced current camera and centers Monahans itself.'],
  ['Dayton','known lifecycle/semantic-center control',"Named-place anchor centers Dayton's developed core and matches the expected semantic Dayton presentation."],
  ['Tyler','duplicate-name geographically disambiguated',"Both cameras are usable, but the named-place anchor provides better semantic centering of Tyler's urban core."],
  ['Waco','major-city A','Named-place anchor corrects the Lake Waco/western bias and centers the developed Waco urban core.'],
  ['Liberty','duplicate-name geographically disambiguated',"Both cameras are usable; the named-place anchor provides slightly better centering of Liberty's developed core."],
  ['Abbott','rural incorporated place','Current and proposed cameras are nearly equivalent; named-place anchor preserves appropriate rural-town framing with no visual regression.'],
  ['Acala','CDP','Named-place anchor provides slightly better settlement-centered framing with no CDP-specific regression.'],
  ['Houston','major metro parent PLACE / region separation','Named-place anchor provides better semantic presentation of the Houston parent PLACE while preserving separate regional-camera governance.']
];
const LP197=[['Austin','4805000'],['Dallas','4819000'],['El Paso','4824000'],['Fort Worth','4827000']];

export function buildCertification({inventory=json(WHATIF),summary=json(SUMMARY)}={}) {
  assert(inventory.runtimeActivation===false&&summary.runtimeActivation===false,'WhatIf runtime activation is not false');
  assert(inventory.records.length===1859&&summary.totalCanonicalCount===1859,'canonical total drifted');
  assert(summary.proposedCount===1555&&summary.higherAuthorityRetainedCount===4&&summary.unresolvedRetainedCount===300&&summary.otherEligibilityGuardRetainedCount===0,'certified cohort counts drifted');
  assert(summary.zoomPolicy.result==='PASS_PRESERVED'&&summary.regionSeparation.result==='PASS','zoom or region governance drifted');
  const byName=new Map(inventory.records.map(x=>[x.canonical.name,x]));
  const reviewedRecords=OWNER_REVIEWS.map(([name,riskClass,ownerReason])=>{
    const x=byName.get(name); assert(x&&x.promotionEligible&&x.proposal,`${name} no longer joins an eligible WhatIf proposal`);
    return {canonicalGeoid:x.canonical.placeGeoid,canonicalName:x.canonical.name,governedType:x.canonical.governedType,lp2011Bucket:x.lp2011Bucket,currentCamera:x.currentCamera,proposedCamera:x.proposal,distanceMeters:x.comparison.distanceMeters,ownerDecision:'PASS_PROPOSED',ownerReason,riskClass};
  });
  const higherAuthorityControls=LP197.map(([name,geoid])=>{
    const x=byName.get(name); assert(x?.canonical.placeGeoid===geoid&&x.decision==='RETAIN_HIGHER_AUTHORITY_CAMERA'&&x.proposal===null,`${name} LP197 protection drifted`);
    return {canonicalGeoid:geoid,canonicalName:name,currentAuthority:'LP197 owner-approved',automaticPromotion:false,comparisonOnly:true,ownerCameraRetained:true,observedHarnessResult:'COMPARISON ONLY — OWNER CAMERA REMAINS AUTHORITATIVE'};
  });
  const kyle=byName.get('Kyle'); assert(kyle?.canonical.placeGeoid==='4839952'&&kyle.lp2011Bucket==='B_MULTIPLE_OSM_CANDIDATES'&&!kyle.promotionEligible&&kyle.proposal===null,'Kyle fail-closed control drifted');
  const excludedBuckets=['B_','D_','E_','G_','H_'];
  assert(inventory.records.every(x=>!excludedBuckets.some(b=>x.lp2011Bucket.startsWith(b))||x.proposal===null),'B/D/E/G/H proposal detected');
  return {
    schemaVersion:'gridly.lp2012.owner-visual-certification.v1',runtimeActivation:false,
    certificationStatus:'LP201.2 CERTIFIED — READY FOR SEPARATE GUARDED RUNTIME-PROMOTION MILESTONE',promotionDesignCertified:true,
    statewideWhatIfIdentity:{schemaVersion:inventory.schemaVersion,canonicalTotal:1859,bucketA:1253,bucketC:306,potentialAC:1559,unexpectedEligibilityFailures:0,artifacts:[WHATIF,SUMMARY,REVIEW].map(path=>({path,sha256:hash(path)}))},
    reviewMethod:{harness:'LP201.2 Phase 3 audit-only owner visual review harness',comparison:'CURRENT versus LP201.2 PROPOSED on the actual Gridly map',decisionStore:'audit-only in-memory decision store',export:'gridlyLp2012ExportDecisions()',persistedToRuntimeStorage:false,additionalRandomSamplingPerformed:false},
    reviewedRecords,higherAuthorityControls,
    unresolvedControls:[{canonicalGeoid:'4839952',canonicalName:'Kyle',lp2011Bucket:kyle.lp2011Bucket,automaticProposal:false,currentCameraRemainsAvailable:true,showProposedFailsClosed:true,observedError:'Kyle: NO AUTOMATIC PROPOSAL'}],
    visualFindings:{reviewedCount:11,allDecisions:'PASS_PROPOSED',observedVisualRegressions:0,riskCoverage:Object.fromEntries(OWNER_REVIEWS.map(([,risk])=>[risk,reviewedRecords.filter(x=>x.riskClass===risk).map(x=>x.canonicalName)])),distanceFinding:{conclusion:'DISTANCE IS REVIEW EVIDENCE, NOT A PROMOTION REJECTION THRESHOLD.',maximumDistanceRuleCreated:false,examples:reviewedRecords.filter(x=>['Corpus Christi','Stamford','Galveston','Monahans'].includes(x.canonicalName)).map(x=>({canonicalName:x.canonicalName,distanceMeters:x.distanceMeters,ownerDecision:x.ownerDecision}))},scopeFinding:'The representative sample supports the governed promotion model and exposed no systemic presentation failure; it does not prove every individual PLACE is visually perfect.'},
    certificationConclusions:{statewideWhatIfInternallyCertified:true,representativeReviewSupportsNamedPlaceAnchorModel:true,largeDisplacementIsNotARejectionCondition:true,multiplePlaceTypesAndRiskClassesPassed:true,lp197Protected:true,unresolvedBehaviorFailsClosed:true,zoomGovernanceUnchanged:true,houstonAndSanAntonioRegionIdentitiesProtected:true,nextMilestone:'LP201.3 — Guarded Named-Place Camera Runtime Promotion'},
    promotionCohort:{proposed:{count:1555,status:'CERTIFIED_FOR_FUTURE_GUARDED_PROMOTION_DESIGN'},higherAuthority:{count:4,status:'RETAIN_HIGHER_AUTHORITY_CAMERA'},unresolvedOrIneligible:{count:300,status:'RETAIN_CURRENT_CAMERA'},excludedBucketsWithNoProposal:['B','D','E','G','H']},
    certificationLimits:['LP201.2 certifies the governed promotion model and cohort.','LP201.2 does NOT certify that every one of the 1,555 cameras has been manually viewed.','LP201.2 does NOT activate the cameras.','LP201.2 does NOT supersede LP197 owner cameras.','LP201.2 does NOT resolve B/D/E/G/H records.','LP201.2 does NOT alter dedicated Houston/San Antonio region identities.','LP201.2 does NOT modify zoom governance.'],
    protectedRuntimeResult:{result:'NO PRODUCTION RUNTIME CHANGES',runtimeActivation:false,applyModeAdded:false,productionCameraAuthorityModified:false,protectedSurfaces:summary.protectedRuntimeSurfaces.paths}
  };
}
export const rendered=(options)=>serialize(buildCertification(options));
export function verifyCertification(){assert(read(OUTPUT).equals(Buffer.from(rendered())),`${OUTPUT} byte/content drift`);return true;}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=new Set(process.argv.slice(2)); assert(!args.has('--apply'),'--apply does not exist'); assert(args.has('--write')!==args.has('--verify'),'choose exactly one of --write or --verify');
  if(args.has('--write'))fs.writeFileSync(path.join(ROOT,OUTPUT),rendered()); else verifyCertification();
  console.log('LP201.2 owner visual certification PASS: 11 reviewed, 1555 future promotion-design records, runtimeActivation=false');
}
