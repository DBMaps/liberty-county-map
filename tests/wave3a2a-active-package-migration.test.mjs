import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { FRA_SOURCE_ID, migrate, validateFraSourceIdentity } from '../tools/wave3a2a/reconcile-active-crossing-packages.mjs';
const productionPaths=['Crossing-Packages/brazos/Production/brazos-production-crossings.geojson','Crossing-Packages/lavaca/Production/lavaca-production-crossings.geojson','Crossing-Packages/washington/Production/washington-production-crossings.geojson','Crossing-Packages/production-crossing-manifest.json'];
const bytes=async p=>readFile(new URL(`../${p}`,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('Wave 3A.2A source validator retains the certified identity contract',()=>{
 assert.deepEqual(FRA_SOURCE_ID,{bytes:68200491,sha256:'e30bdd2502552fa5e578b2feefc5e2f599c0e8206067e4a87c65dadfa760113c'});
});

test('Wave 3A.2A certified governed FRA source passes owner integration without writes',async t=>{
 const source=await bytes('Crossing-Packages/Texas/fra-crossings-tx.geojson');
 if(source.length!==FRA_SOURCE_ID.bytes||sha(source)!==FRA_SOURCE_ID.sha256){t.skip('owner-source integration requires the certified governed FRA artifact');return}
 const before=await Promise.all(productionPaths.map(bytes));
 assert.deepEqual(validateFraSourceIdentity(source),FRA_SOURCE_ID);
 const after=await Promise.all(productionPaths.map(bytes));
 assert.deepEqual(after,before);
});

test('Wave 3A.2A isolated invalid FRA source fails closed before production writes',async()=>{
 const invalidSource=Buffer.from('{"type":"FeatureCollection","features":[]}');
 const before=await Promise.all(productionPaths.map(bytes));
 assert.throws(()=>validateFraSourceIdentity(invalidSource),/FRA source changed/);
 await assert.rejects(migrate({apply:true,fraSourceBody:invalidSource}),/FRA source changed/);
 const after=await Promise.all(productionPaths.map(bytes));
 assert.deepEqual(after,before);
});
