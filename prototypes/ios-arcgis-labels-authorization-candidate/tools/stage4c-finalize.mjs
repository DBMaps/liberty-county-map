import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const base=fileURLToPath(new URL('../',import.meta.url)),root=resolve(base,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{cwd:root,encoding:'utf8',maxBuffer:32e6});
const prior=JSON.parse(readFileSync(resolve(base,'evidence/stage4c/preflight.json')));
const old=JSON.parse(readFileSync(resolve(base,'evidence/preservation-before.json')));
const refs=sha(git('show-ref')),worktrees=git('worktree','list','--porcelain'),head=git('rev-parse','HEAD').trim();
assert.equal(refs,prior.refsSha256,'Stage 4C refs changed');assert.equal(worktrees,prior.worktrees,'Stage 4C worktree registrations changed');assert.equal(head,prior.head);
assert.equal(git('diff','--stat'),'');
const outside=status=>status.split('\n').filter(l=>!l.includes('prototypes/ios-arcgis-labels-authorization-candidate/')).join('\n');
assert.equal(outside(git('status','--porcelain=v1','--untracked-files=all')),outside(prior.status));
const originals=JSON.parse(readFileSync(resolve(base,'evidence/source-copies.json')));
for(const row of originals.files){
 assert.equal(sha(readFileSync(resolve(base,row.copy))),row.sha256,row.copy);
 const bytes=row.source.startsWith(originals.commit+':')?execFileSync('git',['--no-optional-locks','--git-dir',originals.gitdir,'show',row.source],{maxBuffer:8e6}):readFileSync(row.source);
 assert.equal(sha(bytes),row.sha256,row.source);
}
writeFileSync(resolve(base,'evidence/stage4c/preservation-audit.json'),JSON.stringify({head,refsSha256:refs,unchangedDuringStage4c:true,
 worktreeRegistrationsUnchanged:true,originalSourceCopiesVerified:originals.files.length,historicalStage4bRefsSha256:old.refsSha256,
 historicalRefDriftPredatesStage4c:old.refsSha256!==prior.refsSha256,exactInterveningRefUnavailable:'Stage 4B baseline retained only a hash, not a ref map.'},null,2)+'\n');
console.log('Stage 4C HEAD/refs/worktrees/outside status unchanged; 141 source identities verified. Historical pre-stage ref discrepancy recorded.');
