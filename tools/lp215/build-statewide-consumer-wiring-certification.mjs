#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const output='reports/lp215/statewide-consumer-wiring-certification.json';
const stable=x=>`${JSON.stringify(x,null,2)}\n`;

export function buildCertification(){
 const inventory=read('data/generated/lp214-county-community-inventory.json');
 const cameras=read('data/generated/gridly-statewide-place-presentation-v1.json').places;
 const roadways=read('data/roadway-runtime-manifest.json').counties;
 const rails=read('reports/lp203/statewide-crossing-coverage-status-rca.json').counties;
 const railById=Object.fromEntries(rails.map(x=>[x.countyId,x]));
 const rows=[...inventory.counties].sort((a,b)=>a.countyFips.localeCompare(b.countyFips)).map((county,index)=>{
   const eligible=county.communities.filter(c=>c.identityType==='PLACE_GEOID'&&c.placeGeoid&&cameras[c.placeGeoid]);
   eligible.sort((a,b)=>a.canonicalKey.localeCompare(b.canonicalKey)||a.consumerLabel.localeCompare(b.consumerLabel));
   const community=eligible[0]||null, camera=community?cameras[community.placeGeoid]:null;
   const roadway=roadways[county.countyId], rail=railById[county.countyId];
   const roadwayFeatureCount=Number.isInteger(roadway?.featureCount)?roadway.featureCount:(Array.isArray(roadway?.partitions)?roadway.partitions.reduce((n,p)=>n+(Number(p.featureCount)||0),0):null);
   const roadwayOk=Boolean(roadway&&(roadway.url||roadway.manifestUrl)&&roadway.status&&roadwayFeatureCount!==0);
   const railOk=Boolean(rail&&['ACTIVE_POSITIVE','ACTIVE_EMPTY'].includes(rail.governedCrossingState)&&Number.isInteger(rail.governedCount));
   const contextOk=Boolean(community&&community.memberCountyFips.includes(county.countyFips)&&camera);
   const liveRequired=['DriveTexas source lifecycle/counts','Alerts rendered contract','rail viewport/Leaflet/DOM ID parity'];
   return {
    sequence:index+1,countyFips:county.countyFips,countyId:county.countyId,
    representativeCommunity:community?.consumerLabel||`${county.countyName} countywide`,canonicalKey:community?.canonicalKey||null,placeGeoid:community?.placeGeoid||null,
    selectionClassification:community?'CANONICAL_PLACE':'COUNTYWIDE_FALLBACK',governedCountyMembership:community?.memberCountyFips||[county.countyFips],
    operationalActiveCounty:county.countyId,selectedCommunityAfterTransition:community?.canonicalKey||null,
    semanticCameraTarget:camera?{lat:camera.lat,lng:camera.lon,zoom:Number(camera.zoom)||13}:null,settledCenter:null,settledZoom:null,contextPass:contextOk,
    roadwayStatus:roadwayOk?(Number(roadway.featureCount)>0?'ROADWAY_WITH_DATA':'ROADWAY_EXPECTED_EMPTY'):'ROADWAY_MANIFEST_FAILURE',
    roadwayManifestStatus:roadway?.status||null,roadwayLoaderPath:roadway?.status==='partition_runtime_ready'?'partitioned':(roadway?.status==='local_runtime'?'single':'generic'),roadwayPackageUrl:roadway?.url||roadway?.manifestUrl||null,
    roadwayFeatureCount,roadwaySourceCounty:county.countyId,roadwayPass:roadwayOk,
    driveTexasProviderId:'drivetexas',driveTexasConfigurationAvailable:null,driveTexasRequestAttempted:false,driveTexasRequestSuccess:null,
    driveTexasHealth:'NOT_STARTED',driveTexasAreaCount:null,driveTexasRetainedState:null,driveTexasConsumerPublicationCount:null,officialRoadwayConsumerCount:null,
    driveTexasPass:false,
    alertsEligibleRecordIds:null,alertsEligibleCount:null,alertsDisplayedCount:null,alertsEmptyStateReason:'OWNER_BROWSER_EVIDENCE_REQUIRED',
    driveTexasExpectedInAlerts:true,railExpectedInAlerts:false,alertsContractStatus:'NOT_STARTED',alertsPass:false,
    railManifestStatus:rail?.governedCrossingState||'MISSING',railGovernedCount:Number.isInteger(rail?.governedCount)?rail.governedCount:null,
    railNormalizedCount:null,railSourceCounty:county.countyId,railAwarenessCount:null,railPolicyVisibleCount:null,railLeafletCount:null,railDomCount:null,
    railRepositoryStatus:railOk?(rail.governedCount===0?'RAIL_EXPECTED_EMPTY':'RAIL_WITH_DATA'):'RAIL_MANIFEST_FAILURE',railPass:false,
    staleStatePass:false,repositoryWiringPass:contextOk&&roadwayOk&&railOk,liveSourceCertified:false,overallPass:false,
    failureReason:[...(!contextOk?['CONTEXT_REPOSITORY_FAILURE']:[]),...(!roadwayOk?['ROADWAY_REPOSITORY_FAILURE']:[]),...(!railOk?['RAIL_REPOSITORY_FAILURE']:[]),...liveRequired.map(x=>`LIVE_NOT_CERTIFIED: ${x}`)].join('; ')
   };
 });
 if(rows.length!==254||new Set(rows.map(x=>x.countyFips)).size!==254)throw new Error('exactly 254 unique counties required');
 const count=k=>rows.filter(x=>x[k]).length;
 return {schemaVersion:'gridly.lp215.statewide-consumer-wiring-certification.v1',mode:'READ_ONLY_AUDIT',productionPatchApplied:false,
  selectionMethodology:'For each county in ascending five-digit FIPS order, select the lexicographically smallest canonical PLACE key that has a PLACE GEOID, includes the county in governed membership, and has a production presentation target. Use an explicit countywide fallback only when none exists.',
  transitionOrder:'ascending county FIPS; each row predecessor is the preceding row (row 1 predecessor is row 254)',
  certificationBoundary:{repository:'Static governed identity, presentation, roadway manifest, and authoritative rail package state.',live:'Settled camera, connector lifecycle, consumer counts, Alerts DOM, rail viewport/Leaflet/DOM IDs, and transition cleanup require owner browser execution.',repositoryWiringCertified:rows.every(x=>x.repositoryWiringPass),liveSourceCertified:false},
  summary:{countiesExpected:254,countiesEvaluated:rows.length,context:{pass:count('contextPass'),fail:254-count('contextPass')},roadway:{pass:count('roadwayPass'),fail:254-count('roadwayPass')},driveTexas:{pass:count('driveTexasPass'),fail:254-count('driveTexasPass')},alerts:{pass:count('alertsPass'),fail:254-count('alertsPass')},rail:{pass:count('railPass'),fail:254-count('railPass')},staleState:{pass:count('staleStatePass'),fail:254-count('staleStatePass')},overall:{pass:count('overallPass'),fail:254-count('overallPass')},failingCounties:rows.filter(x=>!x.overallPass).map(x=>({countyFips:x.countyFips,countyId:x.countyId,failureReason:x.failureReason}))},
  fredericksburgControl:null,rows};
}

export function run({verify=false}={}){
 const result=buildCertification();
 result.fredericksburgControl=result.rows.find(x=>x.countyId==='gillespie-tx');
 const bytes=stable(result), target=path.join(root,output);
 if(verify){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==bytes)throw new Error(`${output} is missing or stale`);}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 return result;
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){try{const result=run({verify:process.argv.includes('--verify')});console.log(`${process.argv.includes('--verify')?'Verified':'Wrote'} ${result.rows.length} county rows; repository=${result.certificationBoundary.repositoryWiringCertified?'PASS':'FAIL'} live=${result.certificationBoundary.liveSourceCertified?'PASS':'NOT CERTIFIED'}`);}catch(e){console.error(e.message);process.exitCode=1;}}
