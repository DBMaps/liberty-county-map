import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
export const CATEGORIES=['FUEL','GROCERY','LODGING','HOSPITAL','PHARMACY','RESTAURANT','CONVENIENCE'];
export const BRANDS=['Walmart','H-E-B','Brookshire Brothers','Dollar General','Dollar Tree','Family Dollar','Shell','Chevron','Exxon','Valero',"O'Reilly Auto Parts",'AutoZone','Best Western','Holiday Inn Express','Hampton Inn','Motel 6','Starbucks','Subway','CVS','Walgreens'];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const stable=value=>`${JSON.stringify(value,null,2)}\n`;

function identityRows(reports){
 return [...reports.radius.rows.map(x=>({governedIdentity:x.communityId,identityClass:'CANONICAL_PLACE',placeGeoid:x.placeGeoid??x.communityId,displayLabel:x.displayLabel??null})),...reports.nonPlace.rows.map(x=>({governedIdentity:x.stableGovernedIdentity,identityClass:'GOVERNED_NON_PLACE',placeGeoid:null,displayLabel:x.displayLabel}))];
}

/** Recover only conclusions logically contained in the committed D.4 JSON. */
export function recoverCommittedEvidence(reports){
 const identities=identityRows(reports),access=reports.access.rows;
 const countyTotals=Object.fromEntries(CATEGORIES.map(category=>[category,reports.counties.rows.reduce((n,row)=>n+(row.coreCategoryCounts?.[category]??0),0)]));
 const categoryRows=CATEGORIES.map(category=>{
  const measured=access.filter(row=>row.gridly_category===category),byId=new Map(measured.map(row=>[row.governed_identity,row]));
  const missing=identities.filter(row=>!byId.has(row.governedIdentity));
  const statewideAuthorityCount=countyTotals[category];
  const recoverable=missing.length===0||statewideAuthorityCount===0;
  const rows=recoverable?identities.map(identity=>byId.get(identity.governedIdentity)??{governed_identity:identity.governedIdentity,gridly_category:category,nearest_miles:null,within_5:0,within_10:0,within_25:0,evidence:'STATEWIDE_D4_AUTHORITY_COUNT_ZERO'}):measured;
  return {category,originalMeasuredCount:measured.length,accountedCount:rows.length,missingGovernedIdentities:missing.map(x=>({...x})),statewideAuthorityCount,recoveredZeroRows:rows.length-measured.length,status:rows.length===1888?'MEASURED_RECONCILED':'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',rows};
 });
 const pharmacy=categoryRows.find(x=>x.category==='PHARMACY'),convenience=categoryRows.find(x=>x.category==='CONVENIENCE');
 return {
  schemaVersion:'gridly.lp24111.d5.recovered-evidence.v1',
  evidenceBasis:'EXISTING_D4_DERIVED_ARTIFACTS_ONLY',
  prohibitedWorkPerformed:[],runtimeActivated:false,productionBehaviorChanged:false,legalState:'LEGAL_REVIEW_REQUIRED',
  artifactAudit:{ownerLocalArtifactsPresent:[],quality:{status:'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',reason:'D.4 names six classes but records neither per-identity classifications nor deterministic classification thresholds.'},categories:{status:'PARTIALLY_RECOVERED'},metadata:{status:'NOT_RECOVERABLE_FROM_COMMITTED_SUMMARY'},brands:{status:'NOT_RECOVERABLE_FROM_COMMITTED_SUMMARY'}},
  quality:{expectedRows:1888,placeRows:1859,nonPlaceRows:29,status:'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',rows:[],reason:'Fail closed: EXISTING_DETERMINISTIC_D4_DESCRIPTIVE_POLICY contains no executable or stated row-classification rules.'},
  categories:{expectedPerCategory:1888,rows:categoryRows,pharmacyRca:{classification:'ZERO_RESULT_HANDLING_DEFECT',exactMissingIdentity:pharmacy.missingGovernedIdentities[0]??null,recovered:false,reason:'The statewide PHARMACY authority is nonzero, so its missing distance row cannot be reconstructed without an existing measured row.'},convenienceRca:{classification:'ACTUAL_NO_AUTHORITY_CATEGORY',taxonomyLabelMeasured:'CONVENIENCE',statewideAuthorityCount:convenience.statewideAuthorityCount,recovered:convenience.accountedCount===1888,reason:'All 254 committed county aggregates conserve to zero CONVENIENCE records; explicit zero-result rows are therefore deterministic and require no spatial rerun.'}},
  metadata:{status:'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',audited:reports.metadata.recordsAudited,conflict:reports.metadata.classifications.SPATIAL_METADATA_CONFLICT,incomplete:reports.metadata.classifications.SPATIAL_METADATA_INCOMPLETE,families:null,retainedSample:reports.metadata.retainedSample,reason:'The committed aggregate contains no 149-row field inventory.'},
  brands:{status:'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY',rows:BRANDS.map(brand=>({brand,status:'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',recordCount:null,countyCount:null,communityRadiusRepresentation:null,ruralTailPresence:null}))}
 };
}

function committedReports(){const dir=path.join(root,'reports/lp24111');return {radius:read(path.join(dir,'community-radius-coverage.json')),nonPlace:read(path.join(dir,'governed-non-place-coverage.json')),access:read(path.join(dir,'category-accessibility.json')),counties:read(path.join(dir,'county-coverage.json')),metadata:read(path.join(dir,'metadata-conflicts.json'))};}

function queryParquet(file,sql){
 const executable=process.env.DUCKDB||'duckdb',result=spawnSync(executable,['-json','-c',sql.replaceAll('$FILE',`'${file.replaceAll("'","''")}'`)],{encoding:'utf8',maxBuffer:256*1024*1024});
 if(result.error||result.status!==0)throw Error(`OWNER_ARTIFACT_READ failed for ${path.basename(file)}: ${String(result.stderr||result.error?.message).trim()}`);
 return result.stdout.trim()?JSON.parse(result.stdout):[];
}

export function recoverOwnerEvidence(directory=path.join(root,'owner-local/lp24111')){
 const evidence=recoverCommittedEvidence(committedReports()),present=[];
 const brandFile=path.join(directory,'brand-coverage.parquet');
 if(fs.existsSync(brandFile)){
  present.push(path.basename(brandFile));const measured=queryParquet(brandFile,'SELECT brand, standalone_record_count, counties_represented FROM read_parquet($FILE)');
  const lookup=new Map(measured.map(row=>[String(row.brand).toLocaleLowerCase('en-US'),row]));
  evidence.brands={status:'MEASURED_RECONCILED',authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY',rows:BRANDS.map(brand=>{const row=lookup.get(brand.toLocaleLowerCase('en-US'));return {brand,status:row?'MEASURED_PRESENT':'MEASURED_ZERO',recordCount:Number(row?.standalone_record_count??0),countyCount:Number(row?.counties_represented??0),communityRadiusRepresentation:null,ruralTailPresence:null};})};
 }
 const metadataFile=path.join(directory,'metadata-conflicts.parquet');
 if(fs.existsSync(metadataFile)){present.push(path.basename(metadataFile));evidence.metadata.ownerArtifactPresent=true;evidence.metadata.status='NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE';evidence.metadata.reason='The D.4 metadata Parquet projection lacks separate source region/postcode and governed spatial locality fields needed for the required four-family decomposition.';}
 for(const name of ['coverage-measurements.duckdb','community-radius-coverage.parquet','identity-governed-eligible.parquet'])if(fs.existsSync(path.join(directory,name)))present.push(name);
 evidence.artifactAudit.ownerLocalArtifactsPresent=[...new Set(present)].sort();return evidence;
}

const args=new Set(process.argv.slice(2));
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(isMain){
 if(args.has('--help'))console.log('Reads existing D.4 JSON/owner-local derived artifacts only; writes owner-local/lp24111/phase-d5-recovered-evidence.json.');
 else {const output=path.join(root,'owner-local/lp24111/phase-d5-recovered-evidence.json');fs.mkdirSync(path.dirname(output),{recursive:true});const evidence=recoverOwnerEvidence();fs.writeFileSync(output,stable(evidence));console.log(`${evidence.schemaVersion}: ${output}`);}
}
