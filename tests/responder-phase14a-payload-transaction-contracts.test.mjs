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
import {buildPayload,outputPath,root} from '../tools/responder-local/build-phase14a-county-payload.mjs';

const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const payload=path.join(root,outputPath);
const historical=path.join(root,'db/responder-local/phase13_county_population_rehearsal.sql');
const manifest=JSON.parse(read('reports/responder/responder-v1-county-authority-manifest.json'));
const certification=JSON.parse(read('reports/responder/responder-phase14a-payload-certification.json'));
const recovery=JSON.parse(read('reports/responder/responder-phase14a-recovery-checkpoint-template.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bin='C:\\Program Files\\PostgreSQL\\17\\bin';
const exe=n=>path.join(bin,n+'.exe');
const metrics={};

function tokensOutsideLiterals(sql){
  let clean='';
  for(let i=0;i<sql.length;){
    if(sql[i]==="'"){
      i++;
      while(i<sql.length){
        if(sql[i]==="'" && sql[i+1]==="'"){i+=2;continue;}
        if(sql[i++]==="'") break;
      }
      clean+=' ';
    }else if(sql.startsWith('--',i)){
      i=sql.indexOf('\n',i);if(i<0)break;clean+='\n';
    }else if(sql.startsWith('/*',i)){
      const end=sql.indexOf('*/',i+2);assert.ok(end>=0,'unclosed SQL comment');
      i=end+2;clean+=' ';
    }else clean+=sql[i++];
  }
  return clean.toUpperCase().match(/[A-Z_][A-Z0-9_]*|[;().]/g)??[];
}
function run(command,args,env,allowFailure=false){
  const r=spawnSync(command,args,{cwd:root,env:{...process.env,...env},encoding:'utf8',
    maxBuffer:25*1024*1024,windowsHide:true,timeout:120000,
    stdio:path.basename(command).toLowerCase()==='pg_ctl.exe'?'ignore':'pipe'});
  if(!allowFailure && (r.error||r.status!==0))
    throw new Error(`${path.basename(command)} failed: ${r.error?.message??r.stderr?.slice(-1800)}`);
  return r;
}
function sql(query,env,allowFailure=false){
  const r=run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-d','postgres','-c',query],env,allowFailure);
  return allowFailure?r:r.stdout.trim();
}
function fileSql(file,env){
  return run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-d','postgres','-f',file],env);
}
async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
function safeRemove(directory){
  const parent=fs.realpathSync(os.tmpdir()).toLowerCase();
  const target=fs.realpathSync(directory).toLowerCase();
  assert.ok(path.basename(target).startsWith('gridly-phase14a-'));
  assert.ok(target.startsWith(parent+path.sep.toLowerCase()));
  fs.rmSync(directory,{recursive:true,force:true});
}
const count=env=>Number(sql('SELECT count(*) FROM public.gridly_texas_county_boundaries',env));
function tableDigest(env){
  return sql(`BEGIN TRANSACTION READ ONLY;
    SELECT md5(string_agg(county_fips||encode(extensions.ST_AsBinary(geom),'hex')||
      boundary_version,'|' ORDER BY county_fips))
    FROM public.gridly_texas_county_boundaries; ROLLBACK;`,env);
}
function sentinelDigest(env){
  return sql(`SELECT md5(
    (SELECT string_agg(id::text||marker,',' ORDER BY id) FROM public.reports)||'|'||
    (SELECT string_agg(id::text||marker,',' ORDER BY id) FROM public.gridly_feedback)||'|'||
    (SELECT string_agg(id::text||marker,',' ORDER BY id) FROM history_capture.events)||'|'||
    (SELECT string_agg(id::text||marker,',' ORDER BY id) FROM gridly_control.controls)||'|'||
    (SELECT string_agg(version||name,',' ORDER BY version)
       FROM supabase_migrations.schema_migrations))`,env);
}
function wrapper(mode){
  const fips=manifest.canonicalFipsInventory.join(',');
  const version=manifest.sourcePackageVersion;
  const decision=mode==='commit'?'COMMIT':'ROLLBACK';
  const forced=mode==='forced-failure'?' AND false':'';
  return `\\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE public.gridly_texas_county_boundaries IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries)<>0
  THEN RAISE EXCEPTION 'nonempty_target'; END IF;
END $guard$;
SELECT 'TX_BEFORE='||txid_current();
\\i '${payload.replaceAll('\\','/')}'
SELECT 'TX_AFTER='||txid_current();
SELECT 'IN_TXN_ROWS='||count(*) FROM public.gridly_texas_county_boundaries;
SELECT 'IN_TXN_DIGEST='||md5(string_agg(county_fips||
  encode(extensions.ST_AsBinary(geom),'hex')||boundary_version,
  '|' ORDER BY county_fips)) FROM public.gridly_texas_county_boundaries;
WITH counts AS (
  SELECT count(*) AS rows,count(DISTINCT county_fips) AS unique_fips,
    count(*) FILTER (WHERE county_fips IS NULL OR geom IS NULL) AS nulls,
    count(*) FILTER (WHERE extensions.ST_SRID(geom)<>4326) AS wrong_srid,
    count(*) FILTER (WHERE extensions.ST_GeometryType(geom)<>'ST_MultiPolygon') AS wrong_type,
    count(*) FILTER (WHERE NOT extensions.ST_IsValid(geom)) AS invalid,
    sum(extensions.ST_NPoints(geom)) AS points,
    string_agg(county_fips,',' ORDER BY county_fips) AS fips,
    count(DISTINCT boundary_version) AS versions,
    min(boundary_version) AS version
  FROM public.gridly_texas_county_boundaries
), liberty AS (
  SELECT geom FROM public.gridly_texas_county_boundaries WHERE county_fips='48291'
), chambers AS (
  SELECT geom FROM public.gridly_texas_county_boundaries WHERE county_fips='48071'
), boundary AS (
  SELECT extensions.ST_Contains(liberty.geom,extensions.ST_PointOnSurface(liberty.geom)) AS interior,
    extensions.ST_Contains(liberty.geom,extensions.ST_PointOnSurface(chambers.geom)) AS neighbor,
    extensions.ST_Touches(liberty.geom,extensions.ST_PointOnSurface(
      extensions.ST_Intersection(extensions.ST_Boundary(liberty.geom),
      extensions.ST_Boundary(chambers.geom)))) AS shared_touch,
    extensions.ST_Contains(liberty.geom,extensions.ST_PointOnSurface(
      extensions.ST_Intersection(extensions.ST_Boundary(liberty.geom),
      extensions.ST_Boundary(chambers.geom)))) AS shared_contains
  FROM liberty,chambers
)
SELECT (counts.rows=254 AND counts.unique_fips=254 AND counts.nulls=0
  AND counts.wrong_srid=0 AND counts.wrong_type=0 AND counts.invalid=0
  AND counts.points=604979 AND counts.fips='${fips}'
  AND counts.versions=1 AND counts.version='${version}'
  AND boundary.interior AND NOT boundary.neighbor
  AND boundary.shared_touch AND NOT boundary.shared_contains
  AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid
    WHERE i.indrelid='public.gridly_texas_county_boundaries'::regclass
      AND x.relname='gridly_texas_county_boundaries_geom_idx' AND i.indisvalid)
  AND (SELECT count(*) FROM supabase_migrations.schema_migrations)=1
  ${forced}) AS certified FROM counts,boundary \\gset
\\if :certified
  SELECT 'CERTIFICATION=PASS';
  ${decision};
  SELECT 'DECISION=${decision}';
\\else
  ROLLBACK;
  SELECT 'DECISION=ROLLBACK_AFTER_CERTIFICATION_FAILURE';
\\endif
`;
}

test('historical Phase 13 SQL remains immutable and owns its transaction',()=>{
  const b=fs.readFileSync(historical);
  assert.equal(b.length,13965684);
  assert.equal(sha(b),'9e17bb6a0f08580aabcc4943ab9b3bdda6f41e7205a78a7dab8d696a8037815e');
  const s=b.toString('utf8');
  assert.match(s,/^BEGIN;$/m);
  assert.match(s,/^COMMIT;$/m);
  assert.doesNotMatch(s,/^ROLLBACK;$/m);
});

test('payload regenerates byte-for-byte and matches certification',()=>{
  const a=buildPayload(),b=buildPayload();
  const disk=fs.readFileSync(payload);
  assert.ok(Buffer.from(a.sql).equals(Buffer.from(b.sql)));
  assert.ok(disk.equals(Buffer.from(a.sql)));
  assert.equal(a.metadata.sha256,certification.payload.sha256);
  assert.equal(a.metadata.bytes,certification.payload.bytes);
  assert.equal(a.metadata.sourceSha256,certification.source.sha256);
  assert.equal(a.metadata.fipsSha256,certification.source.fipsSha256);
  assert.equal(a.metadata.countyCount,254);
  assert.equal(certification.rehearsal.testCountPassed,9);
  assert.equal(certification.rehearsal.testCountFailed,0);
  assert.equal(certification.rehearsal.intentionalRollbackToZero,true);
  assert.equal(certification.rehearsal.postInsertCertificationFailureRollbackToZero,true);
  assert.equal(certification.rehearsal.freshReadOnlyDigestMatched,true);
});

test('SQL tokens are data-only, with exactly 254 single-target inserts',()=>{
  const s=read(outputPath),t=tokensOutsideLiterals(s);
  const forbidden=new Set(['BEGIN','START','COMMIT','ROLLBACK','SAVEPOINT','RELEASE',
    'CREATE','ALTER','DROP','GRANT','REVOKE','TRUNCATE','DELETE','UPDATE','MERGE',
    'CONFLICT','END']);
  for(const word of t) assert.ok(!forbidden.has(word),`forbidden SQL token: ${word}`);
  assert.equal(t.filter(x=>x==='INSERT').length,254);
  assert.equal(t.filter(x=>x===';').length,254);
  assert.ok(t.join(' ').includes('INSERT INTO PUBLIC . GRIDLY_TEXAS_COUNTY_BOUNDARIES ( COUNTY_FIPS'));
  assert.equal((t.join(' ').match(/INSERT INTO PUBLIC \. GRIDLY_TEXAS_COUNTY_BOUNDARIES/g)??[]).length,254);
  assert.doesNotMatch(s,/ON\s+CONFLICT/i);
  assert.equal((s.match(/^INSERT INTO public\.gridly_texas_county_boundaries /gm)??[]).length,254);
  const fips=[...s.matchAll(/^INSERT INTO public\.gridly_texas_county_boundaries .* VALUES \('([0-9]{5})'/gm)]
    .map(x=>x[1]);
  assert.deepEqual(fips,manifest.canonicalFipsInventory);
  assert.equal(new Set(fips).size,254);
  assert.equal((s.match(/extensions\.ST_Multi\(extensions\.ST_SetSRID\(extensions\.ST_GeomFromGeoJSON\(/g)??[]).length,254);
  assert.equal((s.match(/\),4326\)\)/g)??[]).length,254);
});

test('recovery template and local documentation contain no fake acceptance',()=>{
  assert.equal(recovery.checkpoint.timestamp,null);
  assert.equal(recovery.checkpoint.evidenceSource,null);
  assert.equal(recovery.checkpoint.recoveryOwner,null);
  assert.equal(recovery.ownerAcceptance.accepted,false);
  assert.equal(certification.productionAccessed,false);
  for(const doc of ['docs/RESPONDER/RESPONDER-PHASE14A-PAYLOAD-TRANSACTION-REPAIR.md',
    'docs/RESPONDER/RESPONDER-PHASE14A-PRODUCTION-COUNTY-RETRY-RUNBOOK.md']){
    const full=path.join(root,doc);
    assert.ok(fs.existsSync(full));
    for(const match of fs.readFileSync(full,'utf8').matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),
        `broken local link ${match[1]} in ${doc}`);
  }
});

test('disposable PostgreSQL 17 proves executor rollback, commit and scope',async t=>{
  for(const name of ['initdb','pg_ctl','psql'])assert.ok(fs.existsSync(exe(name)),name);
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-phase14a-'));
  const data=path.join(base,'data'),log=path.join(base,'postgres.log');
  let started=false;
  const env={PGHOST:'127.0.0.1',PGPORT:String(await freePort()),PGUSER:'phase14a_owner',
    PGDATABASE:'postgres',PGPASSWORD:''};
  try{
    run(exe('initdb'),['-D',data,'-U','phase14a_owner','-A','trust','-E','UTF8',
      '--no-instructions'],env);
    run(exe('pg_ctl'),['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${env.PGPORT}`,
      '-w','start'],env);started=true;
    sql(`CREATE SCHEMA extensions; CREATE EXTENSION postgis WITH SCHEMA extensions;
      CREATE SCHEMA history_capture; CREATE SCHEMA gridly_control;
      CREATE SCHEMA supabase_migrations;
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
      CREATE TABLE history_capture.events(id int PRIMARY KEY,marker text);
      CREATE TABLE gridly_control.controls(id int PRIMARY KEY,marker text);
      CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
      INSERT INTO public.reports VALUES(1,'reports-sentinel');
      INSERT INTO public.gridly_feedback VALUES(1,'feedback-sentinel');
      INSERT INTO history_capture.events VALUES(1,'history-sentinel');
      INSERT INTO gridly_control.controls VALUES(1,'control-sentinel');
      INSERT INTO supabase_migrations.schema_migrations VALUES('baseline','sentinel');`,env);
    metrics.postgres=sql("SELECT current_setting('server_version')",env);
    metrics.postgis=sql("SELECT extversion FROM pg_extension WHERE extname='postgis'",env);
    const sentinel=sentinelDigest(env);
    assert.equal(count(env),0);
    for(const mode of ['rollback','forced-failure','commit']){
      await t.test(mode,()=>{
        const file=path.join(base,mode+'.sql');
        fs.writeFileSync(file,wrapper(mode));
        const start=performance.now();
        const output=fileSql(file,env).stdout;
        metrics[mode+'Ms']=Math.round(performance.now()-start);
        assert.match(output,/IN_TXN_ROWS=254/);
        const before=output.match(/TX_BEFORE=(\d+)/)?.[1];
        const after=output.match(/TX_AFTER=(\d+)/)?.[1];
        assert.ok(before && before===after,'payload crossed transaction boundary');
        const digest=output.match(/IN_TXN_DIGEST=([0-9a-f]{32})/)?.[1];
        assert.ok(digest);
        if(mode==='commit'){
          assert.match(output,/CERTIFICATION=PASS/);
          assert.match(output,/DECISION=COMMIT/);
          assert.equal(count(env),254);
          assert.equal(tableDigest(env),digest);
          metrics.committedDigest=digest;
        }else{
          assert.match(output,/DECISION=ROLLBACK/);
          assert.equal(count(env),0);
        }
        assert.equal(sentinelDigest(env),sentinel,'unrelated sentinel changed');
      });
    }
    await t.test('nonempty target is rejected before payload',()=>{
      const file=path.join(base,'nonempty.sql');
      fs.writeFileSync(file,wrapper('commit'));
      const failed=run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
        '-d','postgres','-f',file],env,true);
      assert.notEqual(failed.status,0);
      assert.match(failed.stderr,/nonempty_target/);
      assert.equal(count(env),254);
      assert.equal(sentinelDigest(env),sentinel);
    });
    metrics.finalRows=count(env);
  }finally{
    if(started)run(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],env,true);
    safeRemove(base);
  }
  process.stdout.write('PHASE14A_METRICS='+JSON.stringify(metrics)+'\n');
});
