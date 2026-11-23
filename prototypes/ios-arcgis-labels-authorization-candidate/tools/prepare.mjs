// Source acquisition is local/read-only. No fetch, checkout, registry or provider access.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const candidate=fileURLToPath(new URL('../',import.meta.url)),root=resolve(candidate,'../..');
const reference='C:/Users/gulfi/.codex/worktrees/f695/liberty-county-map';
const gitdir=reference+'/.artifacts/lk18s/.git',commit='8cb40f70fc29bcfb441245751b667790b0e9e6b2';
const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{cwd:root,encoding:'utf8',maxBuffer:32e6});
const hash=b=>createHash('sha256').update(b).digest('hex');
const put=(p,b)=>{const t=resolve(candidate,p);if(existsSync(t))throw Error('existing target: '+p);mkdirSync(dirname(t),{recursive:true});writeFileSync(t,b);};
const before={root,head:git('rev-parse','HEAD').trim(),branch:git('rev-parse','--abbrev-ref','HEAD').trim(),
 refsSha256:hash(git('show-ref')),worktrees:git('worktree','list','--porcelain'),
 status:git('status','--porcelain=v1','--untracked-files=all').split('\n').filter(l=>!l.includes('prototypes/ios-arcgis-labels-authorization-candidate/')).join('\n')};
put('evidence/preservation-before.json',JSON.stringify(before,null,2)+'\n');
const manifest=[];
function copyTree(source,destination){for(const entry of readdirSync(source,{withFileTypes:true})){
 if(entry.name==='node_modules'||entry.name==='.git')continue;
 const path=resolve(source,entry.name),dest=destination+'/'+entry.name;
 if(entry.isDirectory())copyTree(path,dest);else{const b=readFileSync(path);put(dest,b);manifest.push({source:path,copy:dest,sha256:hash(b)});}
}}
for(const name of ['ios-arcgis-labels-gateway-deploy','ios-arcgis-labels-live-candidate','ios-arcgis-labels-integration','ios-arcgis-labels-gateway'])
 copyTree(reference+'/prototypes/'+name,'reference/prototypes/'+name);
const paths=git('--git-dir',gitdir,'ls-tree','-r','--name-only',commit).trim().split('\n').filter(p=>
 p.startsWith('supabase/functions/_shared/entitlement/')||p==='supabase/functions/_shared/paid-report.mjs'||
 (p.startsWith('js/gridly-')&&p.endsWith('.mjs'))||
 p==='supabase/migrations/20260926205345_lp24462_store_entitlement_cache.sql'||
 p==='supabase/migrations/20260928030000_lp24466_native_authorization.sql'||
 (p.startsWith('ios/App/App/')&&p.endsWith('.swift')));
for(const path of paths){const b=execFileSync('git',['--no-optional-locks','--git-dir',gitdir,'show',commit+':'+path],{maxBuffer:8e6});
 const dest='reference/build18/'+path;put(dest,b);manifest.push({source:commit+':'+path,copy:dest,sha256:hash(b)});}
put('evidence/source-copies.json',JSON.stringify({commit,gitdir,reference,files:manifest},null,2)+'\n');
console.log(`Captured preflight and ${manifest.length} byte-preserved reference files.`);
