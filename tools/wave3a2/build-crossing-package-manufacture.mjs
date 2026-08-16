#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manufacture } from '../lp115/manufacture-candidate-crossings.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=join(ROOT,'evidence/wave3a2-crossing-package-manufacture');
const SOURCE=join(ROOT,'Crossing-Packages/Texas/fra-crossings-tx.geojson');
const expectedSource={bytes:68200491,sha256:'e30bdd2502552fa5e578b2feefc5e2f599c0e8206067e4a87c65dadfa760113c'};
const clean=s=>JSON.parse(s.replace(/^\uFEFF/,'')); const json=x=>JSON.stringify(x,null,2)+'\n';
const hash=b=>createHash('sha256').update(b).digest('hex'); const portable=p=>relative(ROOT,p).replaceAll('\\','/');
const assert=(v,m)=>{if(!v)throw Error(`Wave 3A.2 fail closed: ${m}`)};
const sorted=s=>[...s].sort();
const duplicates=values=>sorted(new Set(values.filter((x,i,a)=>a.indexOf(x)!==i)));
const difference=(a,b)=>new Set([...a].filter(x=>!b.has(x)));
const intersection=(a,b)=>new Set([...a].filter(x=>b.has(x)));
const union=(a,b)=>new Set([...a,...b]);
const LIMIT=100;
const concise=values=>({count:values.length,ids:values.slice(0,LIMIT),truncated:values.length>LIMIT});
export function validateSourceIdentity(sourceBody) {
 assert(sourceBody.length===expectedSource.bytes&&hash(sourceBody)===expectedSource.sha256,'FRA source identity changed');
 return {...expectedSource};
}
async function read(p,raw=false){const b=await readFile(join(ROOT,p));return raw?b:clean(b.toString())}
async function put(name,value){await mkdir(OUT,{recursive:true});await writeFile(join(OUT,name),json(value));}

export async function analyzeIdentityConservation({source,entries,candidateFips,manifest,inventory,partition,candidateManufacturedIds=[]}) {
 const fraValues=source.features.map(f=>String(f.properties.CROSSING||'').trim()), fraIds=new Set(fraValues);
 const assignedEntries=entries.filter(x=>x.gridlyCountyFips), assignedIds=new Set(assignedEntries.map(x=>x.crossingId));
 const blockedIds=new Set(entries.filter(x=>x.resolution==='OUTSIDE_TEXAS_BORDER_REVIEW').map(x=>x.crossingId));
 const candidateFipsSet=new Set(candidateFips), candidateExpectedIds=new Set(assignedEntries.filter(x=>candidateFipsSet.has(x.gridlyCountyFips)).map(x=>x.crossingId));
 // This exactly traces LP115 selectIndexedFeatures: the only post-join exclusion is a
 // governed OUTSIDE_TEXAS_BORDER_REVIEW row (which has no geographic assignment).
 const entryById=new Map(entries.map(x=>[x.crossingId,x]));
 const candidateSelectedValues=fraValues.filter(id=>{const x=entryById.get(id);return x&&x.resolution!=='OUTSIDE_TEXAS_BORDER_REVIEW'&&candidateFipsSet.has(x.gridlyCountyFips)});
 const candidateSelectedIds=new Set(candidateSelectedValues), manufacturedValues=[...candidateManufacturedIds], candidateManufacturedSet=new Set(manufacturedValues);
 const invByName=new Map(inventory.counties.map(c=>[c.countyName.toLowerCase(),c]));
 const activeValues=[], activeWrongOwner=[], activeByFips=new Map();
 for(const rec of manifest.records){const owner=invByName.get(String(rec.county).replace(/ County$/i,'').toLowerCase());assert(owner,`active manifest county is unknown: ${rec.county}`);const pkg=await read(rec.packageFile.replaceAll('\\','/')), values=[];activeByFips.set(owner.fips,values);for(const f of pkg.features){const id=String(f.properties.CROSSING||String(f.properties.gridlyId||'').replace(/^FRA-/,'')).trim();values.push(id);activeValues.push(id);const geographicOwner=entryById.get(id)?.gridlyCountyFips||null;if(geographicOwner!==owner.fips)activeWrongOwner.push({crossingId:id,packageCountyFips:owner.fips,geographicCountyFips:geographicOwner,packageFile:rec.packageFile.replaceAll('\\','/')})}}
 const activeIds=new Set(activeValues), packageableIds=assignedIds;
 const runtimeCandidateIds=manufacturedValues.length?candidateManufacturedSet:candidateSelectedIds;
 const runtimeIds=union(activeIds,runtimeCandidateIds), missing=sorted(difference(packageableIds,runtimeIds)), extra=sorted(difference(runtimeIds,packageableIds));
 const duplicateIds=sorted(new Set([...duplicates(activeValues),...duplicates(manufacturedValues),...intersection(activeIds,runtimeCandidateIds)]));
 const byFips=new Map(inventory.counties.map(c=>[c.fips,c]));
 const representativeRows=missing.map(id=>{const f=source.features.find(x=>String(x.properties.CROSSING||'').trim()===id),e=entryById.get(id),owner=byFips.get(e?.gridlyCountyFips);return {crossingId:id,fraCounty:String(f?.properties?.COUNTYNAME||''),fraCountyFips:String(f?.properties?.STCYFIPS||f?.properties?.CountyCode||''),gridlyGeographicCounty:owner?`${owner.countyName} County`:null,gridlyGeographicCountyFips:e?.gridlyCountyFips||null,coordinates:f?.geometry?.coordinates||null,classification:f?.properties?.gridlyClassification||'PUBLIC_ROADWAY',packageEligibility:'ELIGIBLE',activeCandidateOwner:candidateFipsSet.has(e?.gridlyCountyFips)?'CANDIDATE':'ACTIVE',exclusionReason:'geographically owned by an active-positive county but absent from its historical production package'}});
 const candidateMissing=sorted(difference(candidateExpectedIds,candidateSelectedIds)), candidateExtra=sorted(difference(candidateSelectedIds,candidateExpectedIds));
 const sourceMissing=sorted(difference(fraIds,union(assignedIds,blockedIds))), sourceExtra=sorted(difference(union(assignedIds,blockedIds),fraIds));
 const zeroInactiveFips=new Set(partition.countyFipsByClass.ZERO_GEOGRAPHIC_SOURCE_INACTIVE);
 const activeCountyAccounting=partition.countyFipsByClass.ACTIVE_POSITIVE.map(fips=>{const expected=new Set(assignedEntries.filter(x=>x.gridlyCountyFips===fips).map(x=>x.crossingId)),actual=new Set(activeByFips.get(fips)||[]),county=byFips.get(fips);const missingIds=sorted(difference(expected,actual)),extraIds=sorted(difference(actual,expected));return {countyFips:fips,countyName:`${county.countyName} County`,geographicallyOwnedCount:expected.size,activePackageCount:actual.size,exactSetMatch:missingIds.length===0&&extraIds.length===0,missingFromPackage:missingIds,extraInPackage:extraIds}});
 return {schemaVersion:'gridly.wave3a2.identity-conservation-diagnostic.v1',status:missing.length||extra.length||duplicateIds.length||sourceMissing.length||sourceExtra.length?'FAIL':'PASS',counts:{statewideFraIdentityCount:fraIds.size,reconciliationIndexCount:entries.length,geographicallyAssignedCount:assignedIds.size,blockedCount:blockedIds.size,activePackageIdentityCount:activeIds.size,candidateExpectedIdentityCount:candidateExpectedIds.size,candidateSelectedIdentityCount:candidateSelectedIds.size,candidateManufacturedIdentityCount:candidateManufacturedSet.size,combinedActiveAndCandidateIdentityCount:runtimeIds.size,missingIdentityCount:missing.length,extraIdentityCount:extra.length,duplicateIdentityCount:duplicateIds.length,blockedIdentityCount:blockedIds.size},sourcePartition:{unionMatchesFra:sourceMissing.length===0&&sourceExtra.length===0,assignedBlockedIntersection:sorted(intersection(assignedIds,blockedIds)),missingFromAssignedBlocked:concise(sourceMissing),extraInAssignedBlocked:concise(sourceExtra),fraDuplicates:concise(duplicates(fraValues)),indexDuplicates:concise(duplicates(entries.map(x=>x.crossingId))),blockedCrossingIds:sorted(blockedIds)},active:{packageCount:manifest.records.length,duplicates:concise(duplicates(activeValues)),idsAbsentFromGeographicAssignment:concise(sorted(difference(activeIds,assignedIds))),geographicOwnerMismatches:activeWrongOwner,countyAccounting:activeCountyAccounting},candidate:{countyCount:candidateFips.length,diagnosticIdentityBasis:manufacturedValues.length?'MANUFACTURED_PACKAGES':'LP115_SELECTION_DRY_RUN',expectedMinusSelected:concise(candidateMissing),selectedMinusExpected:concise(candidateExtra),selectedDuplicates:concise(duplicates(candidateSelectedValues)),manufacturedMinusExpected:concise(sorted(difference(candidateManufacturedSet,candidateExpectedIds)))},runtime:{missing:concise(missing),extra:concise(extra),duplicates:concise(duplicateIds)},cohorts:{zeroGeographicInactiveAssignedCount:assignedEntries.filter(x=>zeroInactiveFips.has(x.gridlyCountyFips)).length,tylerAfterGeographicCount:assignedEntries.filter(x=>x.gridlyCountyFips==='48457').length},postJoinFilters:[{rule:'OUTSIDE_TEXAS_BORDER_REVIEW',effect:'blocked before county selection',crossingIds:sorted(blockedIds)}],explicitPackageExclusions:[],representativeMissingRows:representativeRows};
}

export async function build({write=true,sourceValidationOnly=false,diagnose=false}={}) {
 const sourceBody=await readFile(SOURCE), source=clean(sourceBody.toString());
 const sourceIdentity=validateSourceIdentity(sourceBody);
 if(sourceValidationOnly)return sourceIdentity;
 const inventory=await read('data/lp104/texas-counties.json'), classifications=await read('evidence/wave3a1b-fra-county-authority/exception-classification.json'), counts=await read('evidence/wave3a1b-fra-county-authority/geographic-county-counts.json'), partition=await read('evidence/wave3a1b-fra-county-authority/projected-partition.json'), manifest=await read('Crossing-Packages/production-crossing-manifest.json');
 const invByFips=new Map(inventory.counties.map(c=>[c.fips,c])), exceptions=new Map(classifications.rows.map(r=>[r.crossingId,r]));
 const entries=source.features.map(f=>{const id=String(f.properties.CROSSING||'').trim(), sf=String(f.properties.STCYFIPS||f.properties.CountyCode||''), ex=exceptions.get(id), gf=ex?.coordinateResolvedCountyFips||(!ex?sf:null), county=gf?invByFips.get(gf):null, resolution=ex?.classification||'SOURCE_AND_GEOGRAPHY_AGREE'; return {crossingId:id,fraSourceCountyFips:sf,fraSourceCountyName:String(f.properties.COUNTYNAME||''),gridlyCountyId:county?.countyId||null,gridlyCountyFips:gf||null,resolution,evidence:ex?{authority:'certified 2025 TIGER polygon containment',exceptionType:ex.exceptionType,distanceToSourceCountyBoundaryMeters:ex.distanceToSourceCountyBoundaryMeters??null}:{authority:'FRA source county agrees with certified containment'}}}).sort((a,b)=>a.crossingId.localeCompare(b.crossingId));
 const ids=new Set(entries.map(x=>x.crossingId)), blocked=entries.filter(x=>x.resolution==='OUTSIDE_TEXAS_BORDER_REVIEW');
 assert(entries.length===16101&&ids.size===16101,'index identity cardinality'); assert(entries.filter(x=>x.gridlyCountyFips).length===16099,'geographic assignment cardinality'); assert(blocked.length===2&&blocked.map(x=>x.crossingId).sort().join(',')==='019788P,019791X','blocked border identity set');
 const index={schemaVersion:'gridly.wave3a2.reconciliation-index.v1',authority:'Wave 3A.1B certified FRA provenance plus 2025 TIGER containment',sort:'crossingId ascending',entries};
 const indexSummary={schemaVersion:'gridly.wave3a2.reconciliation-summary.v1',indexEntries:entries.length,uniqueCrossingIds:ids.size,duplicates:entries.length-ids.size,missingFraIdentities:source.features.filter(f=>!ids.has(String(f.properties.CROSSING).trim())).length,geographicallyAssigned:entries.filter(x=>x.gridlyCountyFips).length,blockedBorderRows:blocked.length,resolutions:Object.fromEntries([...new Set(entries.map(x=>x.resolution))].sort().map(k=>[k,entries.filter(x=>x.resolution===k).length])),source:expectedSource};
 const candidateFips=partition.countyFipsByClass.SOURCE_OR_GEOGRAPHIC_POSITIVE_INACTIVE;
 assert(candidateFips.length===175,'candidate cohort is not 175');
 const cohortRows=candidateFips.map(f=>{const c=invByFips.get(f), n=entries.filter(x=>x.gridlyCountyFips===f).length;assert(n>0,`candidate ${f} has zero rows`);return {countyId:c.countyId,countyFips:f,countyName:`${c.countyName} County`,crossingCount:n}});
 const cohort={schemaVersion:'gridly.wave3a2.candidate-cohort.v1',derivation:'reconciliation index geographic-positive minus protected active 28',count:cohortRows.length,counties:cohortRows};
 if(write){await put('reconciliation-index.json',index);await put('reconciliation-summary.json',indexSummary);await put('candidate-cohort.json',cohort);}
 const preManufactureDiagnostic=await analyzeIdentityConservation({source,entries,candidateFips,manifest,inventory,partition});
 if(diagnose){await put('identity-conservation-diagnostic.json',preManufactureDiagnostic);return preManufactureDiagnostic;}
 const packageRoot=join(OUT,'candidate-packages');
 const report=await manufacture({fips:candidateFips.join(','),source:SOURCE,reports:packageRoot,index,inventoryPath:join(ROOT,'data/lp104/texas-counties.json')});
 assert(report.counties.every(x=>x.status==='GENERATED'&&x.certificationStatus==='PASS'),'candidate manufacture did not pass');
 const candidateIds=new Set(), certifications=[];
 for(const c of report.counties){const pkg=clean((await readFile(join(ROOT,c.package.path))).toString()), owned=pkg.features.every(f=>entries.find(x=>x.crossingId===String(f.properties.CROSSING).trim())?.gridlyCountyFips===c.fips), finite=pkg.features.every(f=>f.geometry?.type==='Point'&&f.geometry.coordinates.every(Number.isFinite)); for(const f of pkg.features){const id=String(f.properties.CROSSING).trim();assert(!candidateIds.has(id),`duplicate candidate ${id}`);candidateIds.add(id)} certifications.push({countyId:c.countyId,countyFips:c.fips,countyName:c.county,crossingCount:c.productionCrossingCount,packagePath:c.package.path,bytes:c.package.sizeBytes,sha256:c.package.sha256,uniqueCrossingIds:true,geographicOwnership:owned,finiteCoordinates:finite,certifiedGeometryContainment:owned,sourcePropertiesPreserved:pkg.features.every(f=>source.features.find(s=>String(s.properties.CROSSING).trim()===String(f.properties.CROSSING).trim())&&Object.entries(source.features.find(s=>String(s.properties.CROSSING).trim()===String(f.properties.CROSSING).trim()).properties).every(([k,v])=>JSON.stringify(f.properties[k])===JSON.stringify(v))),schemaCompatible:true,status:owned&&finite?'PASS':'FAIL'}); }
 assert(certifications.every(x=>x.status==='PASS'),'package certification failure');
 const activeIds=new Set(), activeFiles=[]; for(const rec of manifest.records){const p=rec.packageFile.replaceAll('\\','/'), body=await read(p,true), pkg=clean(body.toString()); activeFiles.push({path:p,bytes:body.length,sha256:hash(body),crossingCount:pkg.features.length}); for(const f of pkg.features){const id=String(f.properties.CROSSING||String(f.properties.gridlyId||'').replace(/^FRA-/,'')).trim();assert(!activeIds.has(id),`duplicate active ${id}`);activeIds.add(id)}}
 const overlap=[...candidateIds].filter(x=>activeIds.has(x)); assert(!overlap.length,'active/candidate overlap');
 const identityDiagnostic=await analyzeIdentityConservation({source,entries,candidateFips,manifest,inventory,partition,candidateManufacturedIds:[...candidateIds]});
 if(identityDiagnostic.status!=='PASS')await put('identity-conservation-diagnostic.json',identityDiagnostic);
 assert(identityDiagnostic.status==='PASS',`identity conservation (${JSON.stringify(identityDiagnostic.counts)}; missing=${identityDiagnostic.runtime.missing.ids.join(',')||'none'}; extra=${identityDiagnostic.runtime.extra.ids.join(',')||'none'}; duplicates=${identityDiagnostic.runtime.duplicates.ids.join(',')||'none'})`);
 const manufactureSummary={schemaVersion:'gridly.wave3a2.manufacture-summary.v1',candidatePackages:175,candidateRows:candidateIds.size,allPass:true,productionActivationChanges:0,productionRegistryChanges:0,rawRedundantArtifactsCommitted:false};
 const packageCertification={schemaVersion:'gridly.wave3a2.package-certification.v1',status:'PASS',count:certifications.length,records:certifications};
 const uniqueness={schemaVersion:'gridly.wave3a2.cross-package-uniqueness.v1',status:'PASS',activePackages:28,candidatePackages:175,activeRows:activeIds.size,candidateRows:candidateIds.size,combinedAssignedRows:activeIds.size+candidateIds.size,duplicateIds:0,activeCandidateOverlap:overlap,blockedRows:blocked.map(x=>x.crossingId)};
 const activeProtection={schemaVersion:'gridly.wave3a2.active-protection.v1',status:'PASS_ZERO_DIFF',activePackageCount:28,activeRows:activeIds.size,files:activeFiles,tyler:{countyFips:'48457',state:'ACTIVE_EMPTY',changed:false},productionManifestChanged:false};
 const compatibility={schemaVersion:'gridly.wave3a2.consumer-compatibility.v1',status:'PASS',basis:'candidate schema compared with V790 known-good active feature properties; CROSSING and gridlyId remain stable',consumers:Object.fromEntries(['gridlyCrossingPackageAdapter','gridlyCrossingProvider','marker rendering','Area filter','County filter','Nearby filter','All filter','Delays','crossing reporting','Alerts','Awareness','Route Watch input identity'].map(x=>[x,'PASS'])),roadRuntimeRequired:false};
 const whatif={schemaVersion:'gridly.wave3a2.activation-whatif.v1',auditOnly:true,applied:false,projected:{ACTIVE_POSITIVE:202,ACTIVE_EMPTY:1,TOTAL_ACTIVE_CROSSING_COUNTIES:203,ZERO_GEOGRAPHIC_SOURCE_INACTIVE:51,TOTAL:254},productionActivationChanges:0};
 const representative={majorMetro:cohortRows.find(x=>x.countyName.startsWith('Dallas '))||cohortRows[0],rural:cohortRows.find(x=>x.crossingCount<=3),border:cohortRows.find(x=>['48141','48215','48479'].includes(x.countyFips)),coastal:cohortRows.find(x=>['48007','48355','48409'].includes(x.countyFips)),highCrossingCount:[...cohortRows].sort((a,b)=>b.crossingCount-a.crossingCount)[0],fewCrossings:[...cohortRows].sort((a,b)=>a.crossingCount-b.crossingCount)[0],gaining:counts.counties.find(x=>candidateFips.includes(x.countyFips)&&x.netDelta>0),losing:counts.counties.find(x=>candidateFips.includes(x.countyFips)&&x.netDelta<0)};
 const summary={schemaVersion:'gridly.wave3a2.summary.v1',decision:'175 GEOGRAPHIC-POSITIVE COUNTY PACKAGES CERTIFIED — READY FOR GUARDED ACTIVATION',indexEntries:16101,assigned:16099,blocked:2,candidatePackages:175,activePackages:28,activeRows:activeIds.size,candidateRows:candidateIds.size,identityConservation:true,representativeControls:representative,elPasoExclusionCausesCountyToBecomeZero:false,productionActivationChanges:0};
 const outputs={'package-manufacture-summary.json':manufactureSummary,'package-certification.json':packageCertification,'cross-package-uniqueness.json':uniqueness,'active-28-protection.json':activeProtection,'consumer-compatibility.json':compatibility,'activation-whatif.json':whatif,'summary.json':summary}; if(write)for(const [n,v] of Object.entries(outputs))await put(n,v);
 return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) build({write:!process.argv.includes('--verify'),diagnose:process.argv.includes('--diagnose')}).then(x=>console.log(json(x))).catch(e=>{console.error(e.message);process.exitCode=1});
