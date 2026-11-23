import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
const candidate=fileURLToPath(new URL('../',import.meta.url)),root=resolve(candidate,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{cwd:root,encoding:'utf8',maxBuffer:32e6});
const manifest=JSON.parse(readFileSync(new URL('../evidence/source-copies.json',import.meta.url)));
for(const item of manifest.files){assert.equal(sha(readFileSync(resolve(candidate,item.copy))),item.sha256,item.copy);
 const b=item.source.startsWith(manifest.commit+':')?execFileSync('git',['--no-optional-locks','--git-dir',manifest.gitdir,'show',item.source],{maxBuffer:8e6}):readFileSync(item.source);
 assert.equal(sha(b),item.sha256,'protected original changed: '+item.source);
}
const pins=readFileSync(resolve(candidate,'reference/prototypes/ios-arcgis-labels-gateway-deploy/certification.sha256'),'utf8').trim().split(/\r?\n/);
for(const line of pins){const [,hash,path]=/^([a-f0-9]{64})  (.+)$/.exec(line);assert.equal(sha(readFileSync(resolve(candidate,'reference',path))),hash,path);}
const prior=JSON.parse(readFileSync(new URL('../evidence/preservation-before.json',import.meta.url)));
const current={root,head:git('rev-parse','HEAD').trim(),branch:git('rev-parse','--abbrev-ref','HEAD').trim(),refsSha256:sha(git('show-ref')),
 worktrees:git('worktree','list','--porcelain'),status:git('status','--porcelain=v1','--untracked-files=all').split('\n').filter(l=>!l.includes('prototypes/ios-arcgis-labels-authorization-candidate/')).join('\n')};
assert.deepEqual(current,prior,'outside candidate Git state changed');
assert.equal(git('diff','--stat'),'','no tracked source changes');
writeFileSync(new URL('../evidence/preservation-after.json',import.meta.url),JSON.stringify(current,null,2)+'\n');
const files=[];
function walk(dir){for(const d of readdirSync(dir,{withFileTypes:true})){if(d.name==='.scratch'||d.name==='inventory.json')continue;const p=resolve(dir,d.name);if(d.isDirectory())walk(p);else files.push(p);}}
walk(candidate);
for(const path of files.filter(p=>p.endsWith('.mjs')&&!p.includes('/reference/')&&!p.includes('\\reference\\'))){const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,path+': '+r.stderr);}
const inventory=files.map(path=>({path:relative(candidate,path).replaceAll('\\','/'),bytes:readFileSync(path).length,sha256:sha(readFileSync(path))}));
writeFileSync(new URL('../evidence/inventory.json',import.meta.url),JSON.stringify(inventory,null,2)+'\n');
console.log(`Verified ${manifest.files.length} original/copy identities, candidate module syntax, unchanged HEAD/refs/worktrees/status. ${files.length} files inventoried.`);
console.log(`Verified ${pins.length} certified gateway manifest entries.`);
