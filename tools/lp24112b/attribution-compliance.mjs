import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'reports/lp24112b');
const stable=value=>`${JSON.stringify(value,null,2)}\n`;

export const identity=Object.freeze({
  authorityReleaseId:'lp24111-d5-standalone-2026-08-28',
  runtimeSchemaVersion:'gridly.poi.runtime.v1',
  upstreamOvertureRelease:'2026-08-19.0',
  sourceInventoryHash:'a9d7a77b964af35fcb21ad3cd061ceb1e1a33ae4dc5091a25a119bada92cec13'
});
const sourceEntries=[
 ['Overture','overture','CDLA-Permissive-2.0',1462815],['meta','meta','CDLA-Permissive-2.0',903696],
 ['Overture-signals','overture','CDLA-Permissive-2.0',861912],['Microsoft','microsoft','CDLA-Permissive-2.0',235223],
 ['BrightQuery','brightquery','CDLA-Permissive-2.0',189064],['Foursquare','foursquare','Apache-2.0',101480],
 ['AllThePlaces','alltheplaces','CC0-1.0',23971],['DAC','dac','CDLA-Permissive-2.0',8250],
 ['PinMeTo','pinmeto','CDLA-Permissive-2.0',979],['RenderSEO','renderseo','CDLA-Permissive-2.0',152]
].map(([dataset,provider,license,sourceEntryCount])=>({dataset,provider,license,sourceEntryCount}));
const approvals={resultsAttributionApproved:false,dataSourcesPageApproved:false,cdlaNoticeApproved:false,apacheNoticeApproved:false,foursquareNoticeApproved:false,cc0NoticeReviewed:false,censusAcknowledgementApproved:false};

export function providerEligible(candidate){
 return candidate.legalClearanceStatus==='APPROVED' &&
  candidate.authorityReleaseId===identity.authorityReleaseId &&
  candidate.runtimeSchemaVersion===identity.runtimeSchemaVersion &&
  candidate.sourceInventoryHash===identity.sourceInventoryHash &&
  Object.keys(approvals).every(key=>candidate[key]===true);
}

export function reports(){
 const exposure={schemaVersion:'gridly.lp24112b.runtime-license-exposure.v1',countingUnit:'UNIQUE_FINAL_RUNTIME_POIS',combinations:[
  {licenses:['CDLA-Permissive-2.0'],count:355925},
  {licenses:['Apache-2.0','CDLA-Permissive-2.0'],count:23248},
  {licenses:['CC0-1.0','CDLA-Permissive-2.0'],count:12599}
 ],total:391772,apacheOnlyObserved:false,noOtherCombinationObserved:true,sourceEntryEvidence:{countingUnit:'SOURCE_ENTRIES_NOT_UNIQUE_POIS',entries:sourceEntries},legalConclusion:false};
 const surface={schemaVersion:'gridly.lp24112b.attribution-surface.v1',runtimeActive:false,consumerUiPublished:false,informationArchitecture:{futureEntryPoint:'Settings > About & Support > About Gridly > Data Sources & Licenses',existingNavigationReused:true},resultsAttribution:{attributionStatus:'COUNSEL_APPROVAL_REQUIRED',destination:'DATA_SOURCES_AND_LICENSES',compact:true,runtimeActive:false},dataSourcesAndLicenses:{status:'COUNSEL_APPROVAL_REQUIRED',sections:['POI authority','Authority release and version','Overture Maps Places','Contributing source/provider inventory','Observed license families','Gridly transformation statement','U.S. Census geographic-context acknowledgement','OSM status','Legal and contact information'],releaseDisclosure:identity},activationRule:'DORMANT_UNTIL_ALL_APPROVAL_GATES_AND_SEPARATE_RUNTIME_AUTHORIZATION'};
 const licensePlan={schemaVersion:'gridly.lp24112b.license-reference-plan.v1',authoritativeTextNotVendored:true,legalTermsParaphrased:false,references:[
  {license:'CDLA-Permissive-2.0',authoritativeUrl:'https://cdla.dev/permissive-2-0/',displayLocation:'Data Sources & Licenses > License references',status:'COUNSEL_APPROVAL_REQUIRED'},
  {license:'Apache-2.0',authoritativeUrl:'https://www.apache.org/licenses/LICENSE-2.0',displayLocation:'Data Sources & Licenses > License references',status:'COUNSEL_APPROVAL_REQUIRED'},
  {license:'CC0-1.0',authoritativeUrl:'https://creativecommons.org/publicdomain/zero/1.0/legalcode',displayLocation:'Data Sources & Licenses > License references',status:'COUNSEL_APPROVAL_REQUIRED'}
 ]};
 const foursquare={schemaVersion:'gridly.lp24112b.foursquare-notice-plan.v1',noticeStatus:'COUNSEL_APPROVAL_REQUIRED',runtimeActive:false,noticeTextPresent:false,noticeText:null,displayLocation:'Data Sources & Licenses > Foursquare NOTICE',acquisitionRequirement:'Obtain the exact applicable upstream Foursquare NOTICE from certified release evidence; preserve it verbatim with provenance; submit it to counsel before approval.',fabricated:false};
 const transformation={schemaVersion:'gridly.lp24112b.transformation-notice.v1',wordingStatus:'COUNSEL_APPROVAL_REQUIRED',technicalFactsOnly:true,legalEffectCharacterized:false,statement:'Gridly processes the source POI authority through Texas scoping, normalization, deduplication, taxonomy classification, destination eligibility, identity governance, child suppression, duplicate-member suppression, coverage certification, and compact runtime projection.',stages:['Texas scoping','normalization','deduplication','taxonomy classification','destination eligibility','identity governance','child suppression','duplicate-member suppression','coverage certification','compact runtime projection']};
 const gates={schemaVersion:'gridly.lp24112b.attribution-approval-gates.v1',...identity,legalClearanceStatus:'NOT_APPROVED',...approvals,providerGateEligible:false,providerGate:'OFF',runtimeActive:false,failClosedRule:'APPROVED + exact release + exact schema + exact source-inventory hash + every approval gate true',modeledEligibility:providerEligible({legalClearanceStatus:'NOT_APPROVED',...identity,...approvals}),activationPathPresent:false};
 const scope={census:{wordingStatus:'COUNSEL_APPROVAL_REQUIRED',acknowledgementText:null,role:'Census geography is used for Texas scoping and county context; it is not the POI source authority.'},osm:{merged:false,supplement:'not part of this POI release',odblLegalQuestion:'separate/future if OSM supplementation is proposed',otherGridlyLayerAttributionDistinct:true}};
 const certification={schemaVersion:'gridly.lp24112b.certification.v1',phaseState:'PHASE_LP24112B_ATTRIBUTION_COMPLIANCE_SURFACES_PREPARED',meaning:'TECHNICAL_COMPLIANCE_SURFACES_PREPARED_FOR_COUNSEL_REVIEW_ONLY',legalClearanceGranted:false,legalState:'LEGAL_REVIEW_REQUIRED',legalClearanceStatus:'NOT_APPROVED',providerGate:'OFF',providerGateEligible:false,runtimeActive:false,productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',productionBehaviorChanged:false,deployed:false,productionSupabaseMutation:false,remoteFetch:false,phoneTesting:false,osmMerged:false,nextOwnerAction:'Provide the preview, deterministic reports, exact upstream license references, and acquired Foursquare NOTICE to external counsel; obtain written release-specific wording and approval decisions without activating the provider.'};
 return {'lp24112b-runtime-license-exposure.json':exposure,'lp24112b-attribution-surface-contract.json':surface,'lp24112b-license-reference-plan.json':licensePlan,'lp24112b-foursquare-notice-plan.json':foursquare,'lp24112b-transformation-notice.json':transformation,'lp24112b-attribution-approval-gates.json':gates,'lp24112b-scope.json':scope,'lp24112b-certification.json':certification};
}

export function verify(){
 const r=reports(), e=r['lp24112b-runtime-license-exposure.json'], g=r['lp24112b-attribution-approval-gates.json'];
 if(e.combinations.reduce((n,x)=>n+x.count,0)!==e.total)throw Error('LICENSE_EXPOSURE_CONSERVATION_FAILED');
 if(providerEligible(g)||g.runtimeActive||g.activationPathPresent)throw Error('FAIL_CLOSED_BOUNDARY_VIOLATION');
 if(Object.keys(approvals).some(key=>g[key]!==false))throw Error('APPROVAL_DEFAULT_VIOLATION');
 return r;
}

if(path.resolve(process.argv[1]??'')===path.resolve(import.meta.filename)){
 const generated=verify(), args=new Set(process.argv.slice(2));
 if(args.has('--write')){fs.mkdirSync(out,{recursive:true});for(const [name,value] of Object.entries(generated))fs.writeFileSync(path.join(out,name),stable(value));console.log(`wrote ${Object.keys(generated).length} LP241.12B reports`);}
 else if(args.has('--verify')){for(const [name,value] of Object.entries(generated)){const file=path.join(out,name);if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==stable(value))throw Error(`stale/missing ${name}`);}console.log(`verified ${Object.keys(generated).length} LP241.12B reports`);}
 else console.log('use --write or --verify');
}
