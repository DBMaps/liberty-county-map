import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,openSync,closeSync,symlinkSync,realpathSync,rmSync,existsSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.platform!=='darwin')throw Error('hosted_macos_only');
const here=fileURLToPath(new URL('./',import.meta.url)),candidate=resolve(here,'../../..'),repo=resolve(candidate,'../..');
const runner=realpathSync(process.env.RUNNER_TEMP),bin=realpathSync(process.env.GRIDLY_CERT_PG_BIN),output=resolve(process.env.GRIDLY_CERT_OUTPUT);
mkdirSync(output,{recursive:true});
const scratch=resolve(runner,'gridly-first-party-certification','.scratch');mkdirSync(scratch,{recursive:true});
const shim=resolve(runner,'gridly-first-party-certification','bin');mkdirSync(shim,{recursive:true});
const psql=resolve(bin,'psql');assert.ok(existsSync(psql));symlinkSync(psql,resolve(shim,'psql.exe'));
const env={...process.env};for(const k of Object.keys(env))if(/^PG|^GRIDLY_LABELS_DISPOSABLE_|^SUPABASE_|^GRIDLY_APPLE_|^GRIDLY_ENTITLEMENT_|^GRIDLY_LABELS_ESRI_|^GITHUB_TOKEN$|^GH_TOKEN$/.test(k))delete env[k];
const run=(name,args,options={})=>{const r=spawnSync(resolve(bin,name),args,{env,encoding:'utf8',timeout:60000,...options});if(r.status!==0)throw Error('disposable_'+name+'_failed');return r.stdout??'';};
const version=run('postgres',['--version']).trim();assert.match(version,/PostgreSQL\) 17\./);console.log(version);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((done,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(e=>e?reject(e):done(port));});});
const summary=[];
for(const [name,file,passes] of [['postgres',resolve(candidate,'tests/postgres.test.mjs'),25],['first-party-postgres',resolve(candidate,'evidence/stage4f/package/tests/postgres.test.mjs'),3]]){
 const cluster=resolve(scratch,'pg-'+randomUUID().replaceAll('-',''));mkdirSync(cluster);
 const data=resolve(cluster,'data'),password=resolve(cluster,'local-pass');writeFileSync(password,randomBytes(32).toString('hex'),{mode:0o600});
 let child,fd;let stopped=false;
 try{
  run('initdb',['-D',data,'-U','postgres','-A','scram-sha-256','--pwfile='+password,'--no-locale','-E','UTF8']);
  const secret=readFileSync(password,'utf8');rmSync(password);
  const port=await freePort();fd=openSync(resolve(cluster,'postgres.log'),'a',0o600);
  child=spawn(resolve(bin,'postgres'),['-D',data,'-h','127.0.0.1','-p',String(port),'-k','','-c','log_statement=none','-c','log_min_error_statement=panic'],{env,stdio:['ignore',fd,fd]});
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('disposable_start_failed');const r=spawnSync(resolve(bin,'pg_isready'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-t','1','-q'],{env,timeout:2000});if(r.status===0){ready=true;break;}await sleep(100);}assert.ok(ready,'disposable_not_ready');
  const testEnv={...env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'postgres',PGPASSWORD:secret,PGDATABASE:'postgres',PGSSLMODE:'disable',PGOPTIONS:'-c statement_timeout=2000 -c lock_timeout=750',GRIDLY_LABELS_DISPOSABLE_ROOT:data,GRIDLY_LABELS_DISPOSABLE_BIN:shim};
  const r=spawnSync(process.execPath,['--import',resolve(candidate,'evidence/stage4f/package/tests/no-network.mjs'),'--test','--test-concurrency=1','--test-reporter=tap',file],{env:testEnv,cwd:repo,encoding:'utf8',timeout:180000,maxBuffer:16e6});
  const log=(r.stdout??'')+(r.stderr??'');writeFileSync(resolve(output,name+'.tap'),log);
  assert.equal(r.status,0,name+' failed; diagnostics retained');
  for(const [k,n]of [['pass',passes],['fail',0],['skipped',0],['cancelled',0]])assert.equal(Number(log.match(new RegExp('^# '+k+' (\\d+)','m'))?.[1]),n,name);
  summary.push({suite:name,pass:passes,fail:0,skip:0});console.log('CERTIFIED_SUITE '+name+' PASS='+passes+' FAIL=0 SKIP=0');
 }finally{
  if(child&&child.exitCode===null){run('pg_ctl',['-D',data,'-m','fast','-w','-t','20','stop']);stopped=true;}else stopped=true;
  if(fd!==undefined)closeSync(fd);
  if(stopped){const target=realpathSync(cluster);assert.equal(dirname(target),realpathSync(scratch));assert.match(basename(target),/^pg-[a-f0-9]{32}$/);rmSync(target,{recursive:true,force:true});console.log('DISPOSABLE_CLUSTER_STOPPED_AND_REMOVED '+name);}
 }
}
writeFileSync(resolve(output,'postgres-summary.json'),JSON.stringify({version,suites:summary,clustersRemoved:true},null,2)+'\n');

