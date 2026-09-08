const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {renderAuthorization,migrationSql}=require('./helpers/lp24422a-prelaunch.cjs');

const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8');
const suffix=`${process.pid}_${randomUUID().replaceAll('-','').slice(0,8)}`;
const dbs=[`gridly_role_a_${suffix}`,`gridly_role_b_${suffix}`];

function sql(query,db='postgres',{fail=false}={}){
  const result=spawnSync(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',db],{input:query,encoding:'utf8',env,windowsHide:true,timeout:30000});
  if(fail) assert.notEqual(result.status,0,'operation must fail closed');
  else assert.equal(result.status,0,result.stderr);
  return result;
}

function sqlAsync(query,db){
  return new Promise((resolve,reject)=>{
    const child=spawn(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',db],{env,windowsHide:true});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;});
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);
    child.on('close',status=>resolve({status,stdout,stderr}));
    child.stdin.end(query);
  });
}

function prepare(db){
  sql(`create database ${db}`);
  sql(fixture,db);
  sql(renderAuthorization({owner_authorization_id:randomUUID()}),db);
  sql(`create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$ begin null; end $$;
    grant execute on function public.rls_auto_enable() to public,anon,authenticated;
    create event trigger gridly_rls_auto_enable on ddl_command_end execute function public.rls_auto_enable();`,db);
}

function cleanup(){
  for(const db of dbs) sql(`drop database if exists ${db} with(force)`);
  sql('drop role if exists gridly_retention_monitor');
}

test('parallel setup accepts only a safe cluster-global monitoring role',async()=>{
  cleanup();
  try{
    for(const db of dbs) prepare(db);
    const results=await Promise.all(dbs.map(db=>sqlAsync(migrationSql(),db)));
    for(const result of results) assert.equal(result.status,0,result.stderr);
    const attributes=sql(`select row(rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
      exists(select 1 from pg_auth_members where roleid=r.oid or member=r.oid))::text
      from pg_roles r where rolname='gridly_retention_monitor'`).stdout.trim();
    assert.equal(attributes,'(f,f,f,f,f,f,f)');
    for(const db of dbs){
      const privileges=sql(`select row(
        has_schema_privilege('gridly_retention_monitor','report_retention','USAGE'),
        has_schema_privilege('gridly_retention_monitor','report_retention','CREATE'),
        has_table_privilege('gridly_retention_monitor','report_retention.health','SELECT'),
        has_table_privilege('gridly_retention_monitor','report_retention.health','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text`,db).stdout.trim();
      assert.equal(privileges,'(t,f,t,f)');
    }
    cleanup();
    sql('create role gridly_retention_monitor login superuser createdb createrole replication bypassrls');
    prepare(dbs[0]);
    const rejected=sql(migrationSql(),dbs[0],{fail:true});
    assert.match(rejected.stderr,/incompatible or elevated role attributes/);
  } finally {
    cleanup();
  }
});
