import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { migrate } from '../tools/wave3a2a/reconcile-active-crossing-packages.mjs';
const load=async p=>JSON.parse((await readFile(new URL(`../${p}`,import.meta.url),'utf8')).replace(/^\uFEFF/,''));
test('Wave 3A.2A fails closed before writes when FRA source identity is not certified',async()=>{
 await assert.rejects(migrate({apply:false}),/FRA source changed/);
 const evidence=await load('evidence/wave3a2a-active-package-migration/summary.json');
 assert.equal(evidence.status,'BLOCKED');assert.equal(evidence.productionPackageWrites,0);assert.equal(evidence.inactiveCountiesActivated,0);
});
