import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});
const decision=read('reports/lp24449b1/decision.json');
const inventory=read('reports/lp24449b1/final-changed-file-inventory.json');
assert.equal(decision.localGatePass,true);
assert.equal(decision.decision,'CONDITIONAL');
assert.deepEqual(decision.blockers,[]);
assert.equal(git('branch','--show-current').trim(),'LP244.48-destination-quick-check-around-me');
assert.equal(git('rev-parse','HEAD').trim(),'5538432be3bfe12c6dc0d3f34dcc9fd97c6edc3c');
assert.deepEqual(inventory.unexpectedTrackedChanges,[]);
for(const record of inventory.files){
  assert.ok(fs.existsSync(record.file),record.file);
  if(record.sha256)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(record.file)).digest('hex'),record.sha256,record.file);
}
const staged=git('diff','--cached','--name-only','-z').split('\0').filter(Boolean).sort();
if(process.argv.includes('--staged'))assert.deepEqual(staged,inventory.files.map(r=>r.file).sort());
else assert.equal(staged.length,0,'Unexpected pre-existing staged changes');
git('diff','--check');git('diff','--cached','--check');
console.log(JSON.stringify({passed:true,phase:process.argv.includes('--staged')?'staged':'before-stage',files:inventory.files.length,sourceHash:decision.sourceHash}));
