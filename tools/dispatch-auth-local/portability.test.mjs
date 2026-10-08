// Disposable Git copies only. No commits, resets, production requests or secret reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,copyFileSync,lstatSync} from 'node:fs';
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
const repairBase='926902deafb4fded1fb0a91b2382b5415ea0f108';
const repairPaths=['tools/dispatch-auth-local/portability.test.mjs',manifestPath,'tools/dispatch-auth-local/verify-sources.ps1'];
const announcement='LOCAL DISPATCH URL: http://127.0.0.1:4180/';
function diagnostics(output,stage){
 const raw=output.match(/OWNER START\/SESSION REFUSED: ([^\r\n]+)/)?.[1];
 const known=/^(UI unreachable|UI isolation drift|Non-loopback UI reachable|Owner runtime startup timed out|Owner runtime startup refused(?: at [a-zA-Z-]+)?|Owner runtime ended unexpectedly|Guarded startup failed; private logs are not printed)$/;
 return {stage,refusal:raw?(known.test(raw)?raw:'startup refusal details withheld'):null,cleanupPass:output.includes('CLEANUP PASS:')};
}
async function waitLauncherReady({readOutput,workerReady,exited,now=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=200000}){
 const start=now();let workerReadyMs=null;
 while(now()-start<timeoutMs){
  const output=readOutput(),ready=workerReady();if(ready&&workerReadyMs===null)workerReadyMs=now()-start;
  const stage=workerReadyMs===null?'waiting-worker':'waiting-launcher';
  if(output.includes('OWNER START/SESSION REFUSED:')||exited()){const error=Error('Owner launcher startup refused');error.diagnostic=diagnostics(output,stage);throw error}
  if(ready&&(output.includes(announcement+'\r\n')||output.includes(announcement+'\n')))return {stage:'launcher-ready',workerReadyMs,launcherReadyMs:now()-start};
  await pause(200);
 }
 const error=Error('Owner launcher readiness timeout');error.diagnostic=diagnostics(readOutput(),workerReadyMs===null?'waiting-worker':'waiting-launcher');throw error;
}
function requestOwnedStop(runtime,{ready,failed}){
 if(!runtime||!existsSync(runtime))return false;
 assert.equal(dirname(runtime),tmpdir(),'Owned runtime root required');assert.match(runtime.split(/[\\/]/).at(-1),/^gridly-dispatch-auth-[a-f0-9]{12}$/);assert.ok(!lstatSync(runtime).isSymbolicLink(),'Runtime reparse refused');
 assert.ok(ready||failed,'Normal stop withheld until launcher readiness');writeFileSync(join(runtime,'stop.request'),'');return true;
}
function awaitExit(done,timeoutMs=240000){let timer;return Promise.race([done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owner cleanup deadline exceeded')),timeoutMs);timer.unref()})]).finally(()=>clearTimeout(timer))}
mkdirSync(temp);
try{
 const cloned=spawnSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'clone','--shared','--no-checkout','--branch',manifest.branch,root,copy],{encoding:'utf8',windowsHide:true});assert.equal(cloned.status,0,'Local clone failed');
 git(copy,['sparse-checkout','init','--cone']);git(copy,['sparse-checkout','set','dispatch','tools/dispatch-auth-local','tools/dispatch-ui','tools/responder/phase29/installer']);git(copy,['checkout',manifest.branch]);
 // Before closure, overlay only the reviewed source set into the base checkout.
 // After closure, no overlay is permitted: verification uses committed files alone.
 const head=git(copy,['rev-parse','HEAD']);
 if(head===manifest.baseRevision||head===repairBase)for(const name of head===repairBase?repairPaths:files){const target=join(copy,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,name),target)}
 await test('certified development or closure checkout passes provenance and all source hashes',()=>{const r=verify(root);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/SOURCE INTEGRITY PASS/)});
 await test('fresh local source copy works without generated certification evidence',()=>{assert.ok(!existsSync(join(copy,'reports/responder/dispatch-auth-local')));assert.ok(!existsSync(join(copy,'reports/responder/dispatch-auth-owner')));const r=verify();assert.equal(r.status,0,r.stderr);if(head!==manifest.baseRevision&&head!==repairBase)assert.equal(git(copy,['status','--porcelain']), '')});
 await test('every security-critical source alteration fails closed',()=>{for(const name of Object.keys(manifest.sources))edit(name,(path,original)=>{writeFileSync(path,Buffer.concat([original,Buffer.from('\n# altered source\n')]));assert.notEqual(verify().status,0,'Altered source accepted: '+name)})});
 await test('missing reviewed manifest fails closed',()=>edit(manifestPath,path=>{rmSync(path);assert.notEqual(verify().status,0)}));
 await test('missing security-critical adapter fails closed',()=>edit('tools/dispatch-auth-local/session.mjs',path=>{rmSync(path);assert.notEqual(verify().status,0)}));
 await test('manifest cannot omit coverage, add traversal, or substitute base provenance',()=>{for(const change of [m=>delete m.sources['tools/dispatch-auth-local/session.mjs'],m=>m.sources['../escape']='0'.repeat(64),m=>m.baseRevision='0'.repeat(40)])edit(manifestPath,path=>{const m=structuredClone(manifest);change(m);writeFileSync(path,JSON.stringify(m));assert.notEqual(verify().status,0)})});
 await test('unrelated branch fails closed',()=>{git(copy,['checkout','-b','unrelated-portability-test']);try{assert.notEqual(verify().status,0)}finally{git(copy,['checkout',manifest.branch])}});
 await test('incompatible existing Git revision fails closed without creating a test commit',()=>{const previous=git(copy,['rev-parse',manifest.baseRevision+'^']);git(copy,['update-ref','refs/heads/'+manifest.branch,previous,head]);try{assert.notEqual(verify().status,0)}finally{git(copy,['update-ref','refs/heads/'+manifest.branch,head,previous])}});
 await test('unrelated repository cannot borrow the reviewed source set',()=>{const unrelated=join(temp,'unrelated');mkdirSync(unrelated);git(unrelated,['init']);for(const name of files){const target=join(unrelated,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,name),target)}assert.notEqual(verify(unrelated).status,0)});
 await test('canonical text hashes support LF and Windows CRLF checkout conversion',()=>{if(head===manifest.baseRevision||head===repairBase)edit('tools/dispatch-auth-local/session.mjs',(path,original)=>{writeFileSync(path,original.toString().replaceAll('\r\n','\n').replaceAll('\n','\r\n'));const r=verify();assert.equal(r.status,0,r.stderr)});else{assert.equal(verify().status,0);assert.equal(git(copy,['diff','--name-only','HEAD']), '')}});
 await test('startup no longer depends on generated reports or a fixed current HEAD',()=>{const owner=readFileSync(join(copy,'tools/dispatch-auth-local/owner.ps1'),'utf8');assert.ok(owner.includes("'verify-sources.ps1'"));assert.ok(!owner.includes('certified-sources.json'));assert.ok(!owner.includes('4f685022e26a07297339750ae67219526384eef2'));assert.equal(manifest.format,'dispatch-local-auth-sha256-lf-v1')});
 await test('worker listener readiness does not complete launcher readiness',async()=>{let tick=0;const result=await waitLauncherReady({readOutput:()=>tick<2?'':announcement+'\n',workerReady:()=>true,exited:()=>false,now:()=>tick*200,pause:async()=>{tick++}});assert.equal(result.workerReadyMs,0);assert.equal(result.launcherReadyMs,400)});
 await test('normal stop is withheld until the complete readiness announcement',async()=>{let tick=0,completed=false;const result=await waitLauncherReady({readOutput:()=>tick===0?announcement:announcement+'\n',workerReady:()=>true,exited:()=>false,now:()=>tick*200,pause:async()=>{assert.equal(completed,false);tick++}});completed=result.stage==='launcher-ready';assert.equal(tick,1);assert.equal(completed,true)});
 await test('readiness timeout is bounded and retains only sanitized stage',async()=>{let tick=0;await assert.rejects(waitLauncherReady({readOutput:()=>'',workerReady:()=>true,exited:()=>false,now:()=>tick,pause:async()=>{tick+=200},timeoutMs:600}),error=>error.message==='Owner launcher readiness timeout'&&error.diagnostic.stage==='waiting-launcher');assert.equal(tick,600)});
 await test('genuine startup refusal preserves safe category without arbitrary details',async()=>{await assert.rejects(waitLauncherReady({readOutput:()=> 'OWNER START/SESSION REFUSED: UI unreachable\n',workerReady:()=>true,exited:()=>false}),error=>error.diagnostic.refusal==='UI unreachable');const safe=diagnostics('OWNER START/SESSION REFUSED: DO_NOT_RECORD_FAKE_VALUE\n','waiting-launcher');assert.ok(!JSON.stringify(safe).includes('DO_NOT_RECORD_FAKE_VALUE'));assert.equal(safe.refusal,'startup refusal details withheld')});
 await test('failed readiness permits exact owned cleanup but premature normal stop is refused',()=>{const runtime=join(tmpdir(),'gridly-dispatch-auth-'+randomUUID().replaceAll('-','').slice(0,12));mkdirSync(runtime);try{assert.throws(()=>requestOwnedStop(runtime,{ready:false,failed:false}),/withheld/);assert.ok(!existsSync(join(runtime,'stop.request')));assert.equal(requestOwnedStop(runtime,{ready:false,failed:true}),true)}finally{assert.equal(dirname(runtime),tmpdir());rmSync(runtime,{recursive:true,force:true})}});
 if(process.env.DISPATCH_PORTABILITY_OWNER_SMOKE==='1')await test('committed evidence-free checkout starts genuine local login and cleans up',{timeout:600000},async()=>{
  assert.notEqual(head,manifest.baseRevision,'Postcommit verification required');
  const owner=join(copy,'tools/dispatch-auth-local/owner.ps1'),docker=process.env.DISPATCH_SMOKE_DOCKER,supabase=process.env.DISPATCH_SMOKE_SUPABASE;assert.ok(docker&&supabase);
  const child=spawn(ps,['-NoProfile','-NonInteractive','-File',owner,'-Supabase',supabase,'-Docker',docker,'-Certification'],{cwd:copy,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);const done=new Promise(resolve=>child.once('close',resolve));let runtime,failure;
  const record={sourceRevision:head,sourceOverlay:head===repairBase,ready:false};
  try{
   record.readiness=await waitLauncherReady({readOutput:()=>output,workerReady:()=>{runtime=output.match(/OWNER SESSION: ([^\r\n]+)/)?.[1];return !!runtime&&existsSync(join(runtime,'ready.json'))},exited:()=>child.exitCode!==null});record.ready=true;
   const ready=JSON.parse(readFileSync(join(runtime,'ready.json')));assert.equal(ready.url,'http://127.0.0.1:4180/');assert.equal(ready.units.length,2);assert.equal(ready.catalogUnchanged,true);
   const response=await fetch(ready.url);record.loginHttpStatus=response.status;assert.equal(response.status,200);assert.match(await response.text(),/Gridly/i);const denied=await fetch(ready.url+'api/context',{headers:{'X-Gridly-Dispatch':'local-auth'}});record.anonymousContextStatus=denied.status;assert.equal(denied.status,401);
  }catch(error){failure=error;record.failure=error.diagnostic||diagnostics(output,record.ready?'http-checks':'waiting-readiness')}
  finally{
   try{record.stopRequested=requestOwnedStop(runtime,{ready:record.ready,failed:!!failure});record.stopAfterAnnouncement=output.includes(announcement+'\r\n')||output.includes(announcement+'\n');record.exitCode=await awaitExit(done);record.cleanup=diagnostics(output,'shutdown');record.runtimeRemoved=!runtime||!existsSync(runtime);if(record.exitCode!==0||!record.cleanup.cleanupPass||!record.runtimeRemoved){failure ||= Error('Owner shutdown verification failed')}}catch(error){failure ||= error;record.cleanupFailure={stage:'shutdown',category:'cleanup verification failed'}}
   const evidence=join(root,'reports/responder/dispatch-auth-owner');mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,'portability-smoke-'+randomUUID()+'.json'),JSON.stringify(record,null,2));
  }
  if(failure)throw Error('Owner smoke failed: '+JSON.stringify(record));
  assert.equal(record.stopAfterAnnouncement,true);assert.equal(record.exitCode,0);
 });
}finally{
 // Exact UUID-owned TEMP checkout only; never touch the source/protected worktrees.
 assert.equal(dirname(temp),tmpdir());assert.match(temp.split(/[\\/]/).at(-1),/^dispatch-portability-[a-f0-9-]{36}$/);rmSync(temp,{recursive:true,force:true});
}
