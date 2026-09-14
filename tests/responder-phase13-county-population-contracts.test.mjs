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
import {artifactMetadata,buildPopulationSql,expectedSha256,outputPath,validateSource}
  from '../tools/responder-local/build-phase13-county-population.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const inventory=JSON.parse(read('reports/responder/responder-phase12-production-schema-inventory.json'));
const manifest=JSON.parse(read('reports/responder/responder-v1-county-authority-manifest.json'));
const certification=JSON.parse(read('reports/responder/responder-phase13-county-population-certification.json'));
const artifact=path.join(root,outputPath);
const metrics={};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bin='C:\\Program Files\\PostgreSQL\\17\\bin';
const exe=name=>path.join(bin,name+'.exe');

function run(executable,args,env,allowFailure=false){
  const r=spawnSync(executable,args,{cwd:root,env:{...process.env,...env},encoding:'utf8',
    maxBuffer:25*1024*1024,windowsHide:true,timeout:120000,
    stdio:path.basename(executable).toLowerCase()==='pg_ctl.exe'?'ignore':'pipe'});
  if(!allowFailure && (r.error||r.status!==0))
    throw new Error(`${path.basename(executable)} failed: ${r.error?.message??r.stderr?.slice(-2000)}`);
  return r;
}
function sql(query,env,allowFailure=false){
  const r=run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-d','postgres','-c',query],env,allowFailure);
  return allowFailure?r:r.stdout.trim();
}
function fileSql(file,env,allowFailure=false){
  return run(exe('psql'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-d','postgres','-f',file],env,allowFailure);
}
function exactCount(env){
  return Number(sql('SELECT count(*) FROM public.gridly_texas_county_boundaries',env));
}
function resetAndLoad(env){
  sql('TRUNCATE public.gridly_texas_county_boundaries',env);
  const r=fileSql(artifact,env);
  assert.equal(r.status,0);
  assert.equal(exactCount(env),254);
}
function targetDigest(env){
  return sql(`SELECT md5(string_agg(county_fips||encode(extensions.ST_AsBinary(geom),'hex')||
    boundary_version||xmin::text,'' ORDER BY county_fips))
    FROM public.gridly_texas_county_boundaries`,env);
}
function tableDigest(env){
  return sql(`SELECT md5(string_agg(county_fips || encode(extensions.ST_AsBinary(geom),'hex') ||
    boundary_version,'|' ORDER BY county_fips))
    FROM public.gridly_texas_county_boundaries`,env);
}
async function freePort(){
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
function safeRemoveTemp(directory){
  const parent=fs.realpathSync(os.tmpdir()).toLowerCase();
  const target=fs.realpathSync(directory).toLowerCase();
  assert.ok(path.basename(target).startsWith('gridly-phase13-'));
  assert.ok(target.startsWith(parent+path.sep.toLowerCase()),'temporary cluster outside temp root');
  fs.rmSync(directory,{recursive:true,force:true});
}

test('frozen source, manifest and geometry contract stay exact',()=>{
  const s=validateSource();
  assert.equal(s.sha256,expectedSha256);
  assert.equal(s.rows.length,254);
  assert.equal(s.points,604979);
  assert.equal(s.rings,254);
  assert.equal(s.fipsSha256,
    sha(Buffer.from(manifest.canonicalFipsInventory.join('\n'))));
  assert.equal(inventory.county.rows,0);
  assert.equal(inventory.connection.serverVersion,'17.6');
  assert.equal(inventory.connection.postgisVersion,'3.3.7');
});

test('generated local SQL is reproducible and contains no unsafe overwrite',()=>{
  const started=performance.now();
  const {sql:generated,source}=buildPopulationSql();
  metrics.generationMs=Math.round(performance.now()-started);
  assert.ok(fs.readFileSync(artifact).equals(Buffer.from(generated,'utf8')));
  metrics.artifact=artifactMetadata(generated,source);
  assert.match(generated,/LOCAL REHEARSAL \/ NOT A PRODUCTION MIGRATION/);
  assert.match(generated,/LOCK TABLE public\.gridly_texas_county_boundaries IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(generated,/phase13_nonempty_or_drifted_target/);
  assert.doesNotMatch(generated,/ON CONFLICT|ST_Covers|ST_Buffer|ST_Simplify|ST_SnapToGrid|UPDATE public\.gridly_texas_county_boundaries/i);
  assert.equal(generated.match(/INSERT INTO pg_temp\.phase13_source /g)?.length,254);
  assert.equal(metrics.artifact.sha256,sha(fs.readFileSync(artifact)));
});

test('certification binds source, artifact and unresolved production gates',()=>{
  assert.equal(certification.source.sha256,expectedSha256);
  assert.equal(certification.artifact.sha256,sha(fs.readFileSync(artifact)));
  assert.equal(certification.artifact.bytes,fs.statSync(artifact).size);
  assert.equal(certification.source.countyCount,254);
  assert.equal(certification.localFixture.equivalentCount,254);
  assert.equal(certification.status.productionPopulationPerformed,false);
  assert.match(certification.status.p12_01,/^OPEN_/);
  assert.match(certification.status.b03,/^OPEN_/);
  for(const doc of ['docs/RESPONDER/RESPONDER-PHASE13-COUNTY-POPULATION-READINESS.md',
    'docs/RESPONDER/RESPONDER-PHASE13-PRODUCTION-COUNTY-POPULATION-RUNBOOK.md']){
    const full=path.join(root,doc);
    assert.ok(fs.existsSync(full));
    for(const match of fs.readFileSync(full,'utf8').matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),
        `broken local link ${match[1]} in ${doc}`);
  }
});

test('disposable PostgreSQL 17 production-shaped load and adversarial rehearsal',async t=>{
  for(const name of ['initdb','pg_ctl','psql']) assert.ok(fs.existsSync(exe(name)),name);
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-phase13-'));
  const data=path.join(base,'data'),log=path.join(base,'postgres.log');
  let started=false;
  const port=await freePort();
  const env={PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'phase13_owner',
    PGDATABASE:'postgres',PGPASSWORD:''};
  try{
    run(exe('initdb'),['-D',data,'-U','phase13_owner','-A','trust','-E','UTF8',
      '--no-instructions'],env);
    run(exe('pg_ctl'),['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${port}`,
      '-w','start'],env);
    started=true;
    sql('CREATE SCHEMA extensions; CREATE EXTENSION postgis WITH SCHEMA extensions',env);
    metrics.localPostgres=sql("SELECT current_setting('server_version')",env);
    metrics.localPostgis=sql("SELECT extversion FROM pg_extension WHERE extname='postgis'",env);
    assert.match(metrics.localPostgres,/^17\./);
    sql(`CREATE TABLE public.gridly_texas_county_boundaries (
      county_fips text PRIMARY KEY CHECK (county_fips ~ '^48[0-9]{3}$'),
      geom extensions.geometry(MultiPolygon,4326) NOT NULL,
      boundary_version text NOT NULL);
      CREATE INDEX gridly_texas_county_boundaries_geom_idx
      ON public.gridly_texas_county_boundaries USING gist(geom);
      ALTER TABLE public.gridly_texas_county_boundaries ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.gridly_texas_county_boundaries FROM PUBLIC`,env);
    await t.test('empty-table 254-county load, type, SRID, validity and bounds',()=>{
      assert.equal(exactCount(env),0);
      const start=performance.now();
      const loaded=fileSql(artifact,env);
      metrics.loadMs=Math.round(performance.now()-start);
      metrics.inTransactionDigest=loaded.stdout.trim();
      assert.match(metrics.inTransactionDigest,/^[0-9a-f]{32}$/);
      assert.equal(tableDigest(env),metrics.inTransactionDigest);
      const validationStart=performance.now();
      const values=sql(`SELECT count(*),count(DISTINCT county_fips),
        count(*) FILTER (WHERE geom IS NULL),
        count(*) FILTER (WHERE extensions.ST_SRID(geom)<>4326),
        count(*) FILTER (WHERE extensions.ST_GeometryType(geom)<>'ST_MultiPolygon'),
        count(*) FILTER (WHERE NOT extensions.ST_IsValid(geom)),
        sum(extensions.ST_NPoints(geom))
        FROM public.gridly_texas_county_boundaries`,env).split('|').map(Number);
      assert.deepEqual(values,[254,254,0,0,0,0,604979]);
      const fips=sql("SELECT string_agg(county_fips,',' ORDER BY county_fips) FROM public.gridly_texas_county_boundaries",env);
      assert.equal(fips,manifest.canonicalFipsInventory.join(','));
      const box=sql(`SELECT extensions.ST_Extent(geom)
        FROM public.gridly_texas_county_boundaries`,env);
      assert.match(box,/BOX\(-106\.645646 25\.837048,-93\.508039 36\.500704\)/);
      assert.equal(sql("SELECT count(DISTINCT boundary_version) FROM public.gridly_texas_county_boundaries",env),'1');
      metrics.validationMs=Math.round(performance.now()-validationStart);
    });
    await t.test('county-by-county source equivalence and exact no-op replay',()=>{
      const before=targetDigest(env);
      const start=performance.now();
      fileSql(artifact,env);
      metrics.noopMs=Math.round(performance.now()-start);
      assert.equal(targetDigest(env),before,'no-op changed geometry, version or xmin');
      assert.equal(exactCount(env),254);
      metrics.equivalentCount=254;
    });
    await t.test('strict interior, exact boundary and neighboring county',()=>{
      const start=performance.now();
      const result=sql(`WITH liberty AS
        (SELECT geom FROM public.gridly_texas_county_boundaries WHERE county_fips='48291'),
      chambers AS
        (SELECT geom FROM public.gridly_texas_county_boundaries WHERE county_fips='48071'),
      points AS
        (SELECT extensions.ST_PointOnSurface(liberty.geom) AS inside,
          extensions.ST_PointOnSurface(chambers.geom) AS neighbor,
          extensions.ST_PointN(extensions.ST_ExteriorRing(
            extensions.ST_GeometryN(liberty.geom,1)),1) AS edge,
          extensions.ST_PointOnSurface(extensions.ST_Intersection(
            extensions.ST_Boundary(liberty.geom),
            extensions.ST_Boundary(chambers.geom))) AS shared
          FROM liberty,chambers)
      SELECT extensions.ST_Contains(liberty.geom,points.inside),
        extensions.ST_Touches(liberty.geom,points.edge),
        extensions.ST_Contains(liberty.geom,points.edge),
        extensions.ST_Contains(liberty.geom,points.neighbor),
        extensions.ST_Touches(liberty.geom,points.shared),
        extensions.ST_Touches(chambers.geom,points.shared)
      FROM liberty,chambers,points`,env).split('|');
      metrics.boundaryMs=Math.round(performance.now()-start);
      assert.deepEqual(result,['t','t','f','f','t','t']);
      const plan=sql(`SET enable_seqscan=off;
        EXPLAIN SELECT county_fips FROM public.gridly_texas_county_boundaries
        WHERE geom OPERATOR(extensions.&&) extensions.ST_MakeEnvelope(-95,29,-94,31,4326)`,env);
      assert.match(plan,/gridly_texas_county_boundaries_geom_idx/);
      metrics.spatialIndexUsable=true;
    });
    await t.test('unexpected one-row and missing-county states fail closed',()=>{
      sql("DELETE FROM public.gridly_texas_county_boundaries WHERE county_fips<>'48001'",env);
      assert.equal(exactCount(env),1);
      assert.notEqual(fileSql(artifact,env,true).status,0);
      assert.equal(exactCount(env),1);
      resetAndLoad(env);
      sql("DELETE FROM public.gridly_texas_county_boundaries WHERE county_fips='48001'",env);
      assert.equal(exactCount(env),253);
      assert.notEqual(fileSql(artifact,env,true).status,0);
      assert.equal(exactCount(env),253);
      resetAndLoad(env);
    });
    await t.test('altered geometry and 254-row wrong-county swap fail closed',()=>{
      sql(`UPDATE public.gridly_texas_county_boundaries
        SET geom=extensions.ST_Translate(geom,0.01,0)
        WHERE county_fips='48001'`,env);
      const changed=targetDigest(env);
      assert.notEqual(fileSql(artifact,env,true).status,0);
      assert.equal(targetDigest(env),changed);
      resetAndLoad(env);
      sql(`UPDATE public.gridly_texas_county_boundaries a
        SET geom=b.geom FROM public.gridly_texas_county_boundaries b
        WHERE a.county_fips='48001' AND b.county_fips='48003'`,env);
      const swapped=targetDigest(env);
      assert.notEqual(fileSql(artifact,env,true).status,0);
      assert.equal(targetDigest(env),swapped);
      resetAndLoad(env);
    });
    await t.test('PK conflict and extra valid-but-out-of-scope FIPS fail closed',()=>{
      assert.notEqual(sql(`INSERT INTO public.gridly_texas_county_boundaries
        SELECT * FROM public.gridly_texas_county_boundaries WHERE county_fips='48001'`,env,true).status,0);
      assert.equal(exactCount(env),254);
      sql(`INSERT INTO public.gridly_texas_county_boundaries
        SELECT '48999',geom,boundary_version
        FROM public.gridly_texas_county_boundaries WHERE county_fips='48001'`,env);
      assert.equal(exactCount(env),255);
      assert.notEqual(fileSql(artifact,env,true).status,0);
      assert.equal(exactCount(env),255);
      resetAndLoad(env);
    });
    await t.test('injected failure after first 127 inserts rolls back entirely',()=>{
      sql('TRUNCATE public.gridly_texas_county_boundaries',env);
      const variant=path.join(base,'injected-failure.sql');
      fs.writeFileSync(variant,buildPopulationSql({injectFailureAfterFirstBatch:true}).sql);
      const start=performance.now();
      const failed=fileSql(variant,env,true);
      metrics.rollbackMs=Math.round(performance.now()-start);
      assert.notEqual(failed.status,0);
      assert.match(failed.stderr,/phase13_injected_failure_after_127/);
      assert.equal(exactCount(env),0);
      assert.equal(sql(`SELECT count(*) FROM pg_indexes
        WHERE schemaname='public' AND tablename='gridly_texas_county_boundaries'
          AND indexname='gridly_texas_county_boundaries_geom_idx'`,env),'1');
      resetAndLoad(env);
    });
    metrics.finalRows=exactCount(env);
    assert.equal(metrics.finalRows,254);
  }finally{
    if(started) run(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],env,true);
    safeRemoveTemp(base);
  }
  process.stdout.write('PHASE13_METRICS='+JSON.stringify(metrics)+'\n');
});
