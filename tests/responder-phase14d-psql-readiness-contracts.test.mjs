import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const payloadPath=path.join(root,'db/responder-local/phase14a_county_population_payload.sql');
const executorPath=path.join(root,'db/responder-local/phase14d_county_population_executor.sql');
const evidence=JSON.parse(read('reports/responder/responder-phase14d-psql-readiness-certification.json'));
const manifest=JSON.parse(read('reports/responder/responder-v1-county-authority-manifest.json'));
const docPath='docs/RESPONDER/RESPONDER-PHASE14D-PSQL-FILE-EXECUTION-READINESS.md';
const bin='C:\\Program Files\\PostgreSQL\\17\\bin';
const exe=name=>path.join(bin,name+'.exe');
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const metrics={};

function run(command,args,env,allowFailure=false){
  const result=spawnSync(command,args,{cwd:root,env:{...process.env,...env},encoding:'utf8',
    maxBuffer:25*1024*1024,windowsHide:true,timeout:120000,
    stdio:path.basename(command).toLowerCase()==='pg_ctl.exe'?'ignore':'pipe'});
  if(!allowFailure&&(result.error||result.status!==0)){
    throw new Error(`${path.basename(command)} failed: ${result.error?.message??result.stderr?.slice(-2400)}`);
  }
  return result;
}
function sql(query,env,allowFailure=false){
  const result=run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-d','postgres','-c',query],env,allowFailure);
  return allowFailure?result:result.stdout.trim();
}
function execute(env,payload,{commit=false,forceFailure=false,forceSqlError=false}={}){
  return run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-v',`phase14d_payload_path=${payload.replaceAll('\\','/')}`,
    '-v',`phase14d_commit_authorized=${commit}`,
    '-v',`phase14d_force_certification_failure=${forceFailure}`,
    '-v',`phase14d_force_certification_sql_error=${forceSqlError}`,
    '-d','postgres','-f',executorPath],env,true);
}
async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
function safeRemove(directory){
  const temp=fs.realpathSync(os.tmpdir()).toLowerCase();
  const target=fs.realpathSync(directory).toLowerCase();
  assert.ok(path.basename(target).startsWith('gridly-phase14d-'));
  assert.ok(target.startsWith(temp+path.sep.toLowerCase()));
  fs.rmSync(directory,{recursive:true,force:true});
}
const count=env=>Number(sql('SELECT count(*) FROM public.gridly_texas_county_boundaries',env));
function freshReadOnly(env){
  const output=sql(`BEGIN TRANSACTION READ ONLY;
    SELECT count(*)||'|'||count(DISTINCT county_fips)||'|'||
      sum(extensions.ST_NPoints(geom))||'|'||
      md5(string_agg(county_fips||encode(extensions.ST_AsBinary(geom),'hex')||
        boundary_version,'|' ORDER BY county_fips))
    FROM public.gridly_texas_county_boundaries; ROLLBACK;`,env);
  const [rows,fips,points,digest]=output.split('|');
  return {rows:Number(rows),fips:Number(fips),points:Number(points),digest};
}
function sentinelDigest(env){
  return sql(`SELECT md5((SELECT string_agg(id::text||marker,',' ORDER BY id)
    FROM public.reports)||'|'||(SELECT string_agg(id::text||marker,',' ORDER BY id)
    FROM public.gridly_feedback))`,env);
}
function assertSingleSession(output){
  const before=output.match(/PHASE14D_TX_BEFORE=(\d+)/)?.[1];
  const after=output.match(/PHASE14D_TX_AFTER=(\d+)/)?.[1];
  const pidBefore=output.match(/PHASE14D_PID_BEFORE=(\d+)/)?.[1];
  const pidAfter=output.match(/PHASE14D_PID_AFTER=(\d+)/)?.[1];
  assert.ok(before&&before===after,'transaction changed across \\i');
  assert.ok(pidBefore&&pidBefore===pidAfter,'backend changed across \\i');
  assert.match(output,/PHASE14D_IN_TRANSACTION=true/);
  assert.match(output,/PHASE14D_LOCK_MODE=ShareRowExclusiveLock/);
  assert.match(output,/PHASE14D_IN_TX_ROWS=254/);
}

test('Phase 14D binds the Phase 14C baseline and local-only result',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE14D-psql-file-execution-readiness');
  assert.equal(evidence.starting_head,'9552228cf64973b41bf0c42e6843b568eb514217');
  assert.equal(evidence.phase14c_ancestor,true);
  assert.equal(evidence.recommendation,'PSQL FILE STREAMING READY');
  assert.equal(evidence.production_authorization_granted,false);
  assert.equal(evidence.production_accessed,false);
  assert.equal(evidence.supabase_accessed,false);
});

test('certified payload is byte-exact, complete and transaction-neutral',()=>{
  const payload=fs.readFileSync(payloadPath);
  const text=payload.toString('utf8');
  assert.equal(payload.length,13965052);
  assert.equal(sha(payload),'464565b291946ff12e948d683e402c83caa39e2737748996f669fa2327a25a9e');
  assert.equal(text.match(/^INSERT INTO public\.gridly_texas_county_boundaries /gm)?.length,254);
  assert.doesNotMatch(text,/^\s*(?:BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|END)\b/im);
  assert.equal(manifest.validation.coordinatePairCount,604979);
  assert.equal(sha(Buffer.from(manifest.canonicalFipsInventory.join('\n'))),
    '7e80dd17d4d295d904f986a193ab259850e607c6bdfde3a7454e9af5a54a2092');
});

test('executor is credential-free, one-session, error-stopping and decision-gated',()=>{
  const executor=fs.readFileSync(executorPath,'utf8');
  assert.match(executor,/LOCAL CERTIFIED EXECUTOR TEMPLATE/);
  assert.match(executor,/NOT A MIGRATION/);
  assert.match(executor,/REQUIRES SEPARATE PRODUCTION AUTHORIZATION/);
  assert.match(executor,/\\set ON_ERROR_STOP on/);
  assert.match(executor,/^BEGIN;$/m);
  assert.match(executor,/SHARE ROW EXCLUSIVE/);
  assert.match(executor,/\\i :phase14d_payload_path/);
  assert.match(executor,/\\if :phase14d_commit_authorized[\s\S]*COMMIT;/);
  assert.ok(executor.indexOf('PHASE14D_CERTIFICATION=PASS')<executor.indexOf('COMMIT;'));
  assert.doesNotMatch(executor,/postgres(?:ql)?:\/\/|password\s*=|service_role|supabase\.co/i);
});

test('Phase 14D evidence records open blockers and no production action',()=>{
  assert.equal(evidence.b03,'OPEN');
  assert.equal(evidence.p12_01,'OPEN');
  assert.equal(evidence.production_population_retried,false);
  assert.equal(evidence.database_migration_created,false);
  assert.equal(evidence.executor.safe_default,'ROLLBACK');
});

test('all Phase 14D Markdown links resolve',()=>{
  const full=path.join(root,docPath);
  const doc=fs.readFileSync(full,'utf8');
  for(const match of doc.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
    assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),
      `broken local link ${match[1]}`);
  }
});

test('disposable PostgreSQL proves single-session file streaming and safe errors',async t=>{
  for(const name of ['initdb','pg_ctl','psql']) assert.ok(fs.existsSync(exe(name)),name);
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-phase14d-'));
  const data=path.join(base,'data');
  const log=path.join(base,'postgres.log');
  let started=false;
  const env={PGHOST:'127.0.0.1',PGPORT:String(await freePort()),PGUSER:'phase14d_owner',
    PGDATABASE:'postgres',PGPASSWORD:''};
  try{
    run(exe('initdb'),['-D',data,'-U','phase14d_owner','-A','trust','-E','UTF8',
      '--no-instructions'],env);
    run(exe('pg_ctl'),['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${env.PGPORT}`,
      '-w','start'],env);started=true;
    sql(`CREATE SCHEMA extensions; CREATE EXTENSION postgis WITH SCHEMA extensions;
      CREATE TABLE public.gridly_texas_county_boundaries(
        county_fips text PRIMARY KEY CHECK(county_fips ~ '^48[0-9]{3}$'),
        geom extensions.geometry(MultiPolygon,4326) NOT NULL,
        boundary_version text NOT NULL);
      CREATE INDEX gridly_texas_county_boundaries_geom_idx
        ON public.gridly_texas_county_boundaries USING gist(geom);
      ALTER TABLE public.gridly_texas_county_boundaries ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.gridly_texas_county_boundaries FROM PUBLIC;
      CREATE TABLE public.reports(id int PRIMARY KEY,marker text);
      CREATE TABLE public.gridly_feedback(id int PRIMARY KEY,marker text);
      INSERT INTO public.reports VALUES(1,'reports-sentinel');
      INSERT INTO public.gridly_feedback VALUES(1,'feedback-sentinel');`,env);
    metrics.postgres=sql("SELECT current_setting('server_version')",env);
    metrics.postgis=sql("SELECT extversion FROM pg_extension WHERE extname='postgis'",env);
    const sentinel=sentinelDigest(env);

    await t.test('successful include deliberately rolls back to zero',()=>{
      const start=performance.now();
      const result=execute(env,payloadPath);
      metrics.rollbackMs=Math.round(performance.now()-start);
      assert.equal(result.status,0,result.stderr);
      assertSingleSession(result.stdout);
      assert.match(result.stdout,/PHASE14D_CERTIFICATION=PASS/);
      assert.match(result.stdout,/PHASE14D_DECISION=ROLLBACK_SAFE_DEFAULT/);
      assert.equal(count(env),0);
    });

    await t.test('successful include commits only after certification',()=>{
      const start=performance.now();
      const result=execute(env,payloadPath,{commit:true});
      metrics.commitMs=Math.round(performance.now()-start);
      assert.equal(result.status,0,result.stderr);
      assertSingleSession(result.stdout);
      assert.match(result.stdout,/PHASE14D_CERTIFICATION=PASS/);
      assert.match(result.stdout,/PHASE14D_DECISION=COMMIT/);
      const fresh=freshReadOnly(env);
      assert.deepEqual(fresh,{rows:254,fips:254,points:604979,
        digest:'54f42bb9795dd2f4f6f743a14b4d86e7'});
      metrics.committedDigest=fresh.digest;
      sql('TRUNCATE public.gridly_texas_county_boundaries',env);
    });

    await t.test('forced certification failure after include rolls back to zero',()=>{
      const result=execute(env,payloadPath,{commit:true,forceFailure:true});
      assert.equal(result.status,0,result.stderr);
      assertSingleSession(result.stdout);
      assert.match(result.stdout,/PHASE14D_CERTIFICATION=FAIL/);
      assert.match(result.stdout,/PHASE14D_DECISION=ROLLBACK_CERTIFICATION_FAILURE/);
      assert.equal(count(env),0);
    });

    await t.test('certification SQL error stops before commit and closes with rollback',()=>{
      const result=execute(env,payloadPath,{commit:true,forceSqlError:true});
      assert.notEqual(result.status,0);
      assert.match(result.stderr,/division by zero/);
      assert.doesNotMatch(result.stdout,/PHASE14D_DECISION=COMMIT/);
      assert.equal(count(env),0);
      metrics.certificationErrorExit=result.status;
    });

    await t.test('included payload SQL error stops before commit and rolls back partial work',()=>{
      const failing=path.join(base,'synthetic-failing-payload.sql');
      fs.writeFileSync(failing,`INSERT INTO public.gridly_texas_county_boundaries
        (county_fips,geom,boundary_version) VALUES
        ('48001',extensions.ST_Multi(extensions.ST_GeomFromText(
        'POLYGON((-96 30,-95 30,-95 31,-96 31,-96 30))',4326)),'local-error-proof');
        SELECT 1/0;\n`);
      const result=execute(env,failing,{commit:true});
      assert.notEqual(result.status,0);
      assert.match(result.stderr,/division by zero/);
      assert.doesNotMatch(result.stdout,/PHASE14D_DECISION=COMMIT/);
      assert.equal(count(env),0);
      metrics.payloadErrorExit=result.status;
    });

    assert.equal(sentinelDigest(env),sentinel,'unrelated sentinel changed');
    metrics.finalRows=count(env);
  }finally{
    if(started) run(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],env,true);
    safeRemove(base);
  }
  process.stdout.write('PHASE14D_METRICS='+JSON.stringify(metrics)+'\n');
});
