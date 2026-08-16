import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { analyzeIdentityConservation, build, validateSourceIdentity } from '../tools/wave3a2/build-crossing-package-manufacture.mjs';
import { buildReconciliationLookup, selectIndexedFeatures } from '../tools/lp115/manufacture-candidate-crossings.mjs';

const feature={type:'Feature',geometry:{type:'Point',coordinates:[-100,31]},properties:{CROSSING:'X',STCYFIPS:'48001',COUNTYNAME:'ANDERSON'}};

test('LP115 geographic ownership join is exact and has no source-county fallback',()=>{
 const reassigned={entries:[{crossingId:'X',gridlyCountyFips:'48003',resolution:'CLEAR_GEOGRAPHIC_REASSIGNMENT'}]};
 const lookup=buildReconciliationLookup(reassigned);
 assert.equal(selectIndexedFeatures({features:[feature]},{fips:'48001'},lookup).length,0);
 assert.equal(selectIndexedFeatures({features:[feature]},{fips:'48003'},lookup).length,1);
 assert.throws(()=>selectIndexedFeatures({features:[{...feature,properties:{...feature.properties,CROSSING:'MISSING'}}]},{fips:'48001'},lookup),/missing index crossing/);
 assert.throws(()=>buildReconciliationLookup({entries:[reassigned.entries[0],reassigned.entries[0]]}),/duplicate index crossing/);
 assert.equal(selectIndexedFeatures({features:[feature]},{fips:'48001'},buildReconciliationLookup({entries:[{crossingId:'X',gridlyCountyFips:null,resolution:'OUTSIDE_TEXAS_BORDER_REVIEW'}]})).length,0);
});

test('Wave 3A.2 accepts the certified FRA source before manufacture',async()=>{
 const body=await readFile(new URL('../Crossing-Packages/Texas/fra-crossings-tx.geojson',import.meta.url));
 assert.equal(body.length,68200491);
 assert.deepEqual(await build({write:false,sourceValidationOnly:true}),{
  bytes:68200491,
  sha256:'e30bdd2502552fa5e578b2feefc5e2f599c0e8206067e4a87c65dadfa760113c'
 });
});

test('Wave 3A.2 rejects an isolated source with an incorrect identity',()=>{
 assert.throws(()=>validateSourceIdentity(Buffer.from('{}\n')),/FRA source identity changed/);
});

const historicalMissingIds=['021041M','021042U','021043B','430171M','764992R','765835B','765836H','765839D','765841E','765842L','765843T','765844A','765845G'];

async function conservationInputs(){
 const load=async path=>JSON.parse((await readFile(new URL(`../${path}`,import.meta.url),'utf8')).replace(/^\uFEFF/,''));
 const source=await load('Crossing-Packages/Texas/fra-crossings-tx.geojson'), inventory=await load('data/lp104/texas-counties.json'), classifications=await load('evidence/wave3a1b-fra-county-authority/exception-classification.json'), partition=await load('evidence/wave3a1b-fra-county-authority/projected-partition.json'), manifest=await load('Crossing-Packages/production-crossing-manifest.json');
 const byId=new Map(classifications.rows.map(x=>[x.crossingId,x]));
 const entries=source.features.map(f=>{const crossingId=String(f.properties.CROSSING).trim(),fra=String(f.properties.STCYFIPS||f.properties.CountyCode||''),exception=byId.get(crossingId);return {crossingId,gridlyCountyFips:exception?.coordinateResolvedCountyFips||(!exception?fra:null),resolution:exception?.classification||'SOURCE_AND_GEOGRAPHY_AGREE'}});
 return {source,entries,candidateFips:partition.countyFipsByClass.SOURCE_OR_GEOGRAPHIC_POSITIVE_INACTIVE,manifest,inventory,partition,load};
}

test('identity diagnostic preserves the historical active-package gap in an isolated fixture',async()=>{
 const inputs=await conservationInputs(), missing=new Set(historicalMissingIds), activePackageFixtures=new Map();
 for(const record of inputs.manifest.records){
  const packageFile=record.packageFile.replaceAll('\\','/'), pkg=await inputs.load(packageFile);
  activePackageFixtures.set(packageFile,{...pkg,features:pkg.features.filter(f=>!missing.has(String(f.properties.CROSSING||String(f.properties.gridlyId||'').replace(/^FRA-/,'')).trim()))});
 }
 const result=await analyzeIdentityConservation({...inputs,activePackageFixtures});
 assert.deepEqual(result.runtime.missing.ids,historicalMissingIds);
 assert.equal(result.counts.missingIdentityCount,13);
 assert.equal(result.counts.extraIdentityCount,0);
 assert.equal(result.counts.duplicateIdentityCount,0);
 assert.equal(result.sourcePartition.unionMatchesFra,true);
 assert.deepEqual(result.sourcePartition.blockedCrossingIds,['019788P','019791X']);
 assert.equal(result.cohorts.tylerAfterGeographicCount,0);
 assert.equal(result.cohorts.zeroGeographicInactiveAssignedCount,0);
 assert.equal(result.candidate.expectedMinusSelected.count,0);
});

test('current production has the complete post-migration active inventory and conserves every packageable identity',async()=>{
 const result=await analyzeIdentityConservation(await conservationInputs());
 const counties=new Map(result.active.countyAccounting.map(x=>[x.countyName,x]));
 assert.equal(counties.get('Brazos County').activePackageCount,95);
 assert.equal(counties.get('Lavaca County').activePackageCount,40);
 assert.equal(counties.get('Washington County').activePackageCount,44);
 assert.deepEqual(result.runtime.missing,{count:0,ids:[],truncated:false});
 assert.deepEqual(result.runtime.extra,{count:0,ids:[],truncated:false});
 assert.equal(result.active.duplicates.count,0);
 assert.equal(result.active.geographicOwnerMismatches.length,0);
 assert.equal(result.counts.activePackageIdentityCount,3784);
 assert.equal(result.counts.candidateExpectedIdentityCount,12315);
 assert.equal(result.counts.combinedActiveAndCandidateIdentityCount,16099);
 assert.equal(result.counts.geographicallyAssignedCount,16099);
 assert.equal(result.counts.missingIdentityCount,0);
 assert.equal(result.counts.extraIdentityCount,0);
 assert.equal(result.counts.duplicateIdentityCount,0);
 assert.equal(result.runtime.duplicates.count,0);
 assert.equal(result.status,'PASS');
 assert.deepEqual(result.sourcePartition.blockedCrossingIds,['019788P','019791X']);
});
