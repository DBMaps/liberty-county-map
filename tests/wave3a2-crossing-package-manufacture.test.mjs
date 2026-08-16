import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { build } from '../tools/wave3a2/build-crossing-package-manufacture.mjs';
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

test('Wave 3A.2 stops before manufacture when certified FRA bytes are absent',async()=>{
 const body=await readFile(new URL('../Crossing-Packages/Texas/fra-crossings-tx.geojson',import.meta.url));
 assert.equal(body.length,67186117);
 await assert.rejects(build({write:false}),/FRA source identity changed/);
});
