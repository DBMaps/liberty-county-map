// Disposable Git copies only. No commits, resets, production requests or secret reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const temp=join(tmpdir(),'dispatch-portability-'+randomUUID()),copy=join(temp,'checkout');
const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
const env={...process.env,PSModulePath:join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','Modules')};
const manifestPath='tools/dispatch-auth-local/source-integrity.json';
const manifest=JSON.parse(readFileSync(join(root,manifestPath),'utf8'));
const files=[...Object.keys(manifest.sources),manifestPath];
function git(repo,args){const r=spawnSync('git',['-c','safe.directory='+repo.replaceAll('\\','/'),'-C',repo,...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Disposable Git operation failed: '+r.stderr);return r.stdout.trim()}
function verify(repo=copy){return spawnSync(ps,['-NoProfile','-NonInteractive','-File',join(repo,'tools/dispatch-auth-local/verify-sources.ps1'),'-Repository',repo],{encoding:'utf8',windowsHide:true,env})}
function edit(name,fn){const path=join(copy,name),original=readFileSync(path);try{fn(path,original)}finally{writeFileSync(path,original)}}
mkdirSync(temp);
try{
 const cloned=spawnSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'clone','--shared','--no-checkout','--branch',manifest.branch,root,copy],{encoding:'utf8',windowsHide:true});assert.equal(cloned.status,0,'Local clone failed');
 git(copy,['sparse-checkout','init','--cone']);git(copy,['sparse-checkout','set','dispatch','tools/dispatch-auth-local','tools/dispatch-ui','tools/responder/phase29/installer']);git(copy,['checkout',manifest.branch]);
 // Before closure, overlay only the reviewed source set into the base checkout.
 // After closure, no overlay is permitted: verification uses committed files alone.
 const head=git(copy,['rev-parse','HEAD']);
 if(head===manifest.baseRevision)for(const name of files){const target=join(copy,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,name),target)}
 await test('certified development or closure checkout passes provenance and all source hashes',()=>{const r=verify(root);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/SOURCE INTEGRITY PASS/)});
 await test('fresh local source copy works without generated certification evidence',()=>{assert.ok(!existsSync(join(copy,'reports/responder/dispatch-auth-local')));assert.ok(!existsSync(join(copy,'reports/responder/dispatch-auth-owner')));const r=verify();assert.equal(r.status,0,r.stderr);if(head!==manifest.baseRevision)assert.equal(git(copy,['status','--porcelain']), '')});
 await test('every security-critical source alteration fails closed',()=>{for(const name of Object.keys(manifest.sources))edit(name,(path,original)=>{writeFileSync(path,Buffer.concat([original,Buffer.from('\n# altered source\n')]));assert.notEqual(verify().status,0,'Altered source accepted: '+name)})});
 await test('missing reviewed manifest fails closed',()=>edit(manifestPath,path=>{rmSync(path);assert.notEqual(verify().status,0)}));
 await test('missing security-critical adapter fails closed',()=>edit('tools/dispatch-auth-local/session.mjs',path=>{rmSync(path);assert.notEqual(verify().status,0)}));
 await test('manifest cannot omit coverage, add traversal, or substitute base provenance',()=>{for(const change of [m=>delete m.sources['tools/dispatch-auth-local/session.mjs'],m=>m.sources['../escape']='0'.repeat(64),m=>m.baseRevision='0'.repeat(40)])edit(manifestPath,path=>{const m=structuredClone(manifest);change(m);writeFileSync(path,JSON.stringify(m));assert.notEqual(verify().status,0)})});
 await test('unrelated branch fails closed',()=>{git(copy,['checkout','-b','unrelated-portability-test']);try{assert.notEqual(verify().status,0)}finally{git(copy,['checkout',manifest.branch])}});
 await test('incompatible existing Git revision fails closed without creating a test commit',()=>{const previous=git(copy,['rev-parse',manifest.baseRevision+'^']);git(copy,['update-ref','refs/heads/'+manifest.branch,previous,head]);try{assert.notEqual(verify().status,0)}finally{git(copy,['update-ref','refs/heads/'+manifest.branch,head,previous])}});
 await test('unrelated repository cannot borrow the reviewed source set',()=>{const unrelated=join(temp,'unrelated');mkdirSync(unrelated);git(unrelated,['init']);for(const name of files){const target=join(unrelated,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,name),target)}assert.notEqual(verify(unrelated).status,0)});
 await test('canonical text hashes support LF and Windows CRLF checkout conversion',()=>{if(head===manifest.baseRevision)edit('tools/dispatch-auth-local/session.mjs',(path,original)=>{writeFileSync(path,original.toString().replaceAll('\r\n','\n').replaceAll('\n','\r\n'));const r=verify();assert.equal(r.status,0,r.stderr)});else{assert.equal(verify().status,0);assert.equal(git(copy,['diff','--name-only','HEAD']), '')}});
 await test('startup no longer depends on generated reports or a fixed current HEAD',()=>{const owner=readFileSync(join(copy,'tools/dispatch-auth-local/owner.ps1'),'utf8');assert.ok(owner.includes("'verify-sources.ps1'"));assert.ok(!owner.includes('certified-sources.json'));assert.ok(!owner.includes('4f685022e26a07297339750ae67219526384eef2'));assert.equal(manifest.format,'dispatch-local-auth-sha256-lf-v1')});
 if(process.env.DISPATCH_PORTABILITY_OWNER_SMOKE==='1')await test('committed evidence-free checkout starts genuine local login and cleans up',{timeout:300000},async()=>{
  assert.notEqual(head,manifest.baseRevision,'Postcommit verification required');
  const owner=join(copy,'tools/dispatch-auth-local/owner.ps1'),docker=process.env.DISPATCH_SMOKE_DOCKER,supabase=process.env.DISPATCH_SMOKE_SUPABASE;assert.ok(docker&&supabase);
  const child=spawn(ps,['-NoProfile','-NonInteractive','-File',owner,'-Supabase',supabase,'-Docker',docker,'-Certification'],{cwd:copy,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);const done=new Promise(resolve=>child.once('close',resolve));let runtime;
  try{for(let i=0;i<1000;i++){runtime=output.match(/OWNER SESSION: ([^\r\n]+)/)?.[1];if(runtime&&existsSync(join(runtime,'ready.json')))break;if(child.exitCode!==null)throw Error('Fresh checkout owner startup refused');await new Promise(r=>setTimeout(r,200))}
   assert.ok(runtime&&existsSync(join(runtime,'ready.json')));const ready=JSON.parse(readFileSync(join(runtime,'ready.json')));assert.equal(ready.url,'http://127.0.0.1:4180/');assert.equal(ready.units.length,2);assert.equal(ready.catalogUnchanged,true);
   const response=await fetch(ready.url);assert.equal(response.status,200);assert.match(await response.text(),/Gridly/i);const denied=await fetch(ready.url+'api/context',{headers:{'X-Gridly-Dispatch':'local-auth'}});assert.equal(denied.status,401);
  }finally{if(runtime&&existsSync(runtime))writeFileSync(join(runtime,'stop.request'),'');const code=await done;assert.equal(code,0,'Fresh owner session failed');assert.match(output,/CLEANUP PASS/);assert.ok(!runtime||!existsSync(runtime));}
 });
}finally{
 // Exact UUID-owned TEMP checkout only; never touch the source/protected worktrees.
 assert.equal(dirname(temp),tmpdir());assert.match(temp.split(/[\\/]/).at(-1),/^dispatch-portability-[a-f0-9-]{36}$/);rmSync(temp,{recursive:true,force:true});
}
