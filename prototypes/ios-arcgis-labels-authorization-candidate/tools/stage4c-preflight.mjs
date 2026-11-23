import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const base=fileURLToPath(new URL('../',import.meta.url)),out=resolve(base,'evidence/stage4c');
const hash=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(out,{recursive:true});
if(existsSync(resolve(out,'preflight.json')))throw Error('preflight already recorded');
const bytes=readFileSync(resolve(base,'evidence/inventory.json')),inventory=JSON.parse(bytes);
for(const row of inventory)assert.equal(hash(readFileSync(resolve(base,row.path))),row.sha256,'unexpected Stage 4B drift: '+row.path);
writeFileSync(resolve(out,'stage4b-inventory.json'),bytes);
for(const f of ['candidate.tap','postgres.tap','protected-regression.tap','gateway-regression.tap','disposable-cleanup.txt','postgres-startup.log']){
 mkdirSync(resolve(out,'stage4b-evidence'),{recursive:true});writeFileSync(resolve(out,'stage4b-evidence',f),readFileSync(resolve(base,'evidence',f)));
}
const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{cwd:resolve(base,'../..'),encoding:'utf8',maxBuffer:32e6});
writeFileSync(resolve(out,'preflight.json'),JSON.stringify({head:git('rev-parse','HEAD').trim(),branch:git('rev-parse','--abbrev-ref','HEAD').trim(),
refsSha256:hash(git('show-ref')),worktrees:git('worktree','list','--porcelain'),verifiedStage4BFiles:inventory.length,
inventorySha256:hash(bytes),status:git('status','--porcelain=v1','--untracked-files=all')},null,2)+'\n');
console.log(`${inventory.length} Stage 4B inventory entries match; archived evidence and Git/worktree preflight.`);
