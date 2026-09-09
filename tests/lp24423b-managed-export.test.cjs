const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {randomUUID,createHash,createDecipheriv,randomBytes}=require('node:crypto');
const {renderAuthorization,renderRevocation,migrationSql,BASELINE_EXPECTED}=require('./helpers/lp24422a-prelaunch.cjs');
const ROOT=path.resolve(__dirname,'..');
const PSQL=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const ENV=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
const db=`gridly_lp24423b_${process.pid}`;
const creator=`gridly_creator_${process.pid}`;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-export-fixture-'));
let exporter,archive;
function sql(q,database=db,fail=false) {
  const r=spawnSync(PSQL,['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',database],{input:q,encoding:'utf8',env:ENV,windowsHide:true,timeout:60000});
  if(fail) assert.notEqual(r.status,0);else assert.equal(r.status,0,r.stderr);
  return r.stdout.trim();
}
before(async()=>{
  exporter=await import('../tools/retention/owner-export.mjs');
  archive=await import('../tools/retention/owner-archive.mjs');
  sql(`create database ${db}`,'postgres');
  sql(fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8'));
  sql(fs.readFileSync(path.join(ROOT,'supabase/migrations/202606070001_create_gridly_feedback.sql'),'utf8'));
  sql(fs.readFileSync(path.join(ROOT,'supabase/migrations/202606110001_add_county_metadata_columns.sql'),'utf8'));
});
after(()=>{sql(`drop database if exists ${db} with(force)`,'postgres');sql(`drop role if exists gridly_retention_monitor; drop role if exists ${creator}`,'postgres');});

test('PostgreSQL 17.10/PostGIS 3.6.2 and non-superuser creator reproduce the old failing membership predicate',()=>{
  assert.match(sql('select version()'),/PostgreSQL 17\.10/);
  sql('create extension postgis');assert.match(sql('select postgis_lib_version()'),/^3\.6\.2$/);
  sql(`create role ${creator} nologin nosuperuser createrole; set role ${creator}; create role gridly_retention_monitor nologin; reset role`);
  const r=JSON.parse(sql(`select json_build_object('login',rolcanlogin,'super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,'replication',rolreplication,'bypass',rolbypassrls,'limit',rolconnlimit,'config',rolconfig,'membership',exists(select 1 from pg_auth_members where roleid=r.oid or member=r.oid)) from pg_roles r where rolname='gridly_retention_monitor'`));
  assert.deepEqual(r,{login:false,super:false,createdb:false,createrole:false,inherit:true,replication:false,bypass:false,limit:-1,config:null,membership:true});
  assert.equal(sql(`select row(admin_option,inherit_option,set_option,g.rolsuper)::text from pg_auth_members m join pg_roles g on g.oid=m.grantor where roleid='gridly_retention_monitor'::regrole and member='${creator}'::regrole`),'(t,f,f,t)');
  assert.equal(sql("select row(has_database_privilege('gridly_retention_monitor',current_database(),'CONNECT'),has_database_privilege('gridly_retention_monitor',current_database(),'CREATE'),has_database_privilege('gridly_retention_monitor',current_database(),'TEMP'),has_schema_privilege('gridly_retention_monitor','public','USAGE'),has_schema_privilege('gridly_retention_monitor','public','CREATE'))::text"),'(t,f,t,t,f)');
  sql('drop role gridly_retention_monitor');
});

test('rollback-only diagnostic proposal parses locally and proves the diagnostic role is absent',()=>{
  const script=fs.readFileSync(path.join(ROOT,'supabase/retention/diagnose-managed-role.PROPOSAL.sql'),'utf8');
  const result=JSON.parse(sql(`set role ${creator};\n`+script));
  assert.equal(result.rollback_verified,true);
  assert.equal(result.diagnostic.attributes.rolcanlogin,false);
  assert.equal(result.diagnostic.owned_objects,0);
  assert.match(result.diagnostic.diagnostic_role,/^gridly_diag_[0-9a-f]{32}$/);
  const membership=result.diagnostic.memberships;
  assert.equal(membership.length,1);assert.equal(membership[0].role,result.diagnostic.diagnostic_role);
  assert.equal(membership[0].member,creator);assert.equal(membership[0].admin,true);
  assert.equal(membership[0].inherit,false);assert.equal(membership[0].set,false);assert.equal(membership[0].grantor_superuser,true);
  assert.equal(sql(`select count(*) from pg_roles where rolname='${result.diagnostic.diagnostic_role}'`),'0');
  assert.doesNotMatch(script,/gridly_retention_monitor|prelaunch_reset_authorization|\bcommit\s*;/i);
  const before=sql("select count(*) from pg_roles where rolname like 'gridly_diag_%'");
  // One failing dedicated connection; no retry. Its disconnect must roll back
  // even when execution stops before the explicit ROLLBACK statement.
  sql(script.replace('select json_build_object(','select 1/0;\nselect json_build_object('),db,true);
  assert.equal(sql("select count(*) from pg_roles where rolname like 'gridly_diag_%'"),before);
});

test('armed authorization cannot be overwritten; wrong identity cannot disarm; revoke survives and blocks reset',()=>{
  sql(renderAuthorization());
  // Reproduce the old armed table's status constraints before upgrade.
  sql(`alter table gridly_control.prelaunch_reset_authorization drop constraint reset_status_allowed,
    drop constraint reset_status_timestamps,
    add check(status in ('authorized','consumed','launched')),
    add check((status='authorized' and consumed_at is null and launched_at is null)
      or (status='consumed' and consumed_at is not null and launched_at is null)
      or (status='launched' and consumed_at is not null and launched_at is not null));`);
  sql(renderAuthorization({owner_authorization_id:randomUUID()}),db,true);
  sql(renderRevocation(BASELINE_EXPECTED),db,true);
  assert.equal(sql('select status from gridly_control.prelaunch_reset_authorization'),'authorized');
  sql(`set gridly.failed_authorization_id='${BASELINE_EXPECTED.owner_authorization_id}';\n`+renderRevocation(BASELINE_EXPECTED));
  assert.equal(sql("select status||':'||(select reason from gridly_control.reset_revocations) from gridly_control.prelaunch_reset_authorization"),'revoked:failed deployment');
  sql(migrationSql(),db,true);
  sql(renderAuthorization(),db,true);
  sql('delete from gridly_control.reset_revocations',db,true);
  sql('truncate gridly_control.reset_revocations',db,true);
  assert.equal(sql('select count(*) from reports'),'7');
});

test('fresh replacement is single armed slot; changed fingerprint and revoked UUID reuse fail',()=>{
  sql(renderAuthorization({owner_authorization_id:randomUUID(),expected_reports:8}),db,true);
  const fresh=randomUUID();sql(renderAuthorization({owner_authorization_id:fresh}));
  assert.equal(sql("select count(*)||':'||min(status) from gridly_control.prelaunch_reset_authorization"),'1:authorized');
  sql(renderAuthorization({owner_authorization_id:randomUUID()}),db,true);
});

test('repair accepts only owner ADMIN without SET/INHERIT; exact attributes and private health remain enforced',()=>{
  // Model PG17 automatic owner grant with its bootstrap-superuser grantor.
  sql('create role gridly_retention_monitor nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 0; grant gridly_retention_monitor to postgres with admin true, inherit false, set false');
  sql(migrationSql());
  assert.equal(sql("select row(rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,rolconnlimit,rolconfig)::text from pg_roles where rolname='gridly_retention_monitor'"),'(f,f,f,f,f,f,f,0,)');
  assert.equal(sql('set role gridly_retention_monitor; select overdue_cleanup_count from report_retention.health'),'0');
  for(const role of ['anon','authenticated','service_role','gridly_retention_monitor']) {
    sql(`set role ${role}; select * from report_retention.device_links`,db,true);
    if(role!=='gridly_retention_monitor') sql(`set role ${role}; select * from report_retention.health`,db,true);
  }
  assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('report_retention','gridly_control') and p.prosecdef and a.grantee=0 and a.privilege_type='EXECUTE'"),'0');
  const source=migrationSql().replaceAll('\r\n','\n');
  const assertion=source.slice(source.indexOf('do $$\ndeclare monitor pg_roles%rowtype;'),source.indexOf('grant usage on schema report_retention to gridly_retention_monitor;'));
  assert.match(assertion,/incompatible or elevated role attributes/);
  for(const change of ['grant anon to gridly_retention_monitor','grant gridly_retention_monitor to anon','grant gridly_retention_monitor to postgres with set true','alter role gridly_retention_monitor login','alter role gridly_retention_monitor inherit',"alter role gridly_retention_monitor set search_path=public"]) {
    sql(`begin; ${change}; ${assertion} rollback;`,db,true);
  }
  const privileges=source.slice(source.indexOf('do $$\ndeclare monitor_oid oid;'),source.indexOf('-- Migration must abort if initial cleanup'));
  assert.match(privileges,/privileges exceed the monitoring minimum/);
  for(const change of ['grant select on report_retention.health to gridly_retention_monitor with grant option','grant select(id) on public.reports to gridly_retention_monitor','create table public.fixture_owned_by_monitor(a int); alter table public.fixture_owned_by_monitor owner to gridly_retention_monitor']) {
    sql(`begin; ${change}; ${privileges} rollback;`,db,true);
  }
  sql(renderAuthorization({owner_authorization_id:randomUUID()}),db,true);
});

test('export source fixture has community, provider, secret-bearing text, date edges and de-linked history',()=>{
  sql(`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key);
    insert into supabase_migrations.schema_migrations values ('20260908200554');
    insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id,detail,county_id,created_at)
    values ('DOT-1','private-device',30.123456,-95.123456,'blocked','high','fixture-device','fixture-secret plaintext-token 127.0.0.9','liberty-tx',date_trunc('day',now()));
    insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,source,created_at)
    values ('provider','Licensed place',30,-95,'blocked','high','licensed-provider',date_trunc('day',now()));
    insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,created_at)
    values ('DOT-before','Crossing',30,-95,'blocked','high',date_trunc('day',now())-interval '1 day');
    insert into gridly_feedback(category,message,user_agent,page_url,county_id) values ('fixture-secret','fixture-device plaintext-token','fingerprint','https://private.invalid','liberty-tx');
    insert into gridly_feedback(category,message,created_at) values ('fixture','excluded upper bound',(now() at time zone 'UTC')::date+interval '1 day');
    insert into report_retention.condition_month_counts values (date_trunc('month',now())::date,'crossing',2);`);
});
const today=()=>new Date().toISOString().slice(0,10);
const tomorrow=()=>new Date(Date.now()+86400000).toISOString().slice(0,10);
function lines(){return sql(exporter.exportSql(today(),tomorrow())).split('\n');}
test('default export allowlist, date bounds, counts and hashes are deterministic with no provider or credentials',async()=>{
  const before=sql('select json_agg(row(original_submitted_at,cleanup_after,linkage_deadline)) from reports');
  const stream=lines();
  for(const label of ['a','b']) {
    const dir=path.join(tmp,label);
    const manifest=await exporter.writeExport(stream,dir,{from:today(),to:tomorrow(),generatedAt:'2026-09-09T00:00:00.000Z'});
    assert.equal(manifest.datasets.reports.rows,1);
    assert.equal(manifest.datasets.feedback.rows,1);
    for(const [name,entry] of Object.entries(manifest.datasets)) {
      const bytes=fs.readFileSync(path.join(dir,entry.file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
      assert.doesNotMatch(bytes.toString(),/fixture-device|fixture-secret|plaintext-token|licensed-provider|fingerprint|127\.0\.0\.9|30\.123456|device_id|token_digest|authorization_id/);
      for(const row of bytes.toString().trim().split('\n').filter(Boolean)) exporter.validateRow(name,JSON.parse(row));
    }
  }
  assert.equal(fs.readFileSync(path.join(tmp,'a/manifest.json'),'utf8'),fs.readFileSync(path.join(tmp,'b/manifest.json'),'utf8'));
  assert.equal(sql('select json_agg(row(original_submitted_at,cleanup_after,linkage_deadline)) from reports'),before);
});
test('streaming psql adapter uses bounded FETCH_COUNT and a read-only transaction',async()=>{
  const env={...ENV,GRIDLY_RETENTION_PSQL:PSQL,PGHOST:'127.0.0.1',PGPORT:'55441',PGUSER:'postgres',PGDATABASE:db};
  const manifest=await exporter.writeExport(exporter.databaseLines(exporter.exportSql(today(),tomorrow()),env),path.join(tmp,'stream'),{from:today(),to:tomorrow()});
  assert.equal(manifest.datasets.reports.rows,1);
  await assert.rejects(async()=>{for await(const line of exporter.databaseLines('delete from public.reports;',env)) void line;});
});
test('incomplete streams, extra fields, poisoned values, SQL failure and unsafe targets fail visibly',async()=>{
  for(const [name,stream] of [['truncated',lines().slice(0,-1)],['bad',lines().map(l=>l.includes('"kind" : "row"')?l.replace('"row" : {','"row" : {"device_id":"secret",'):l)]]) {
    await assert.rejects(exporter.writeExport(stream,path.join(tmp,name),{from:today(),to:tomorrow()}));
    assert.ok(fs.existsSync(path.join(tmp,name,'INCOMPLETE')));
    assert.ok(!fs.existsSync(path.join(tmp,name,'manifest.json')));
  }
  assert.throws(()=>exporter.validateRow('reports',{device_id:'secret'}));
  assert.throws(()=>exporter.validateRow('feedback',{created_at:'2026-09-09T00:00:00Z',status:'secret',county_id:null,provenance:'first_party_feedback'}));
  for(const [from,to] of [['2026-02-30','2026-03-02'],['2026-09-09','2026-09-09'],["2026-01-01';delete",'2026-09-10']]) assert.throws(()=>exporter.bounds(from,to));
  await assert.rejects(exporter.main(['--confirm-project',exporter.PROJECT,'--from',today(),'--to',tomorrow()],{}));
});

const verified=()=>({ownerOnly:true,local:true,noReparse:true,ownerFullControl:true});
function decrypt(file,key) {
  const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(0,8).toString(),'GRIDLYA1');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(8,20));decipher.setAuthTag(bytes.subarray(-16));
  const plaintext=Buffer.concat([decipher.update(bytes.subarray(20,-16)),decipher.final()]).toString();
  assert.equal(archive.decryptArchiveBytes(bytes,key).toString(),plaintext);
  return plaintext;
}
test('Level 2 requires explicit flags, secure connection, separate key and verified restrictive Windows ACLs',()=>{
  const args=['--level-2','--confirm-project',exporter.PROJECT,'--from',today(),'--to',tomorrow(),'--confirm-owner-storage','--confirm-first-party-content'];
  const env={PGHOST:`db.${exporter.PROJECT}.supabase.co`,PGUSER:'postgres',PGDATABASE:'postgres',PGSSLMODE:'verify-full',GRIDLY_ARCHIVE_KEY:randomBytes(32).toString('hex')};
  assert.deepEqual(archive.archiveOptions(args,env),{from:today(),to:tomorrow()});
  assert.throws(()=>archive.archiveOptions(args.slice(1),env));
  assert.throws(()=>archive.archiveOptions(args,{...env,PGHOST:'wrong.example'}));
  assert.throws(()=>archive.archiveOptions(args,{...env,GRIDLY_ARCHIVE_KEY:''}));
  assert.throws(()=>archive.verifyStorage(tmp,{platform:'linux'}));
  assert.throws(()=>archive.verifyStorage(tmp,{platform:'win32',run:()=>({status:0,stdout:'{"ownerOnly":false}'})}));
  assert.deepEqual(archive.verifyStorage(tmp,{platform:'win32',run:()=>({status:0,stdout:JSON.stringify(verified())})}),verified());
});
test('real Windows ACL probe rejects broad access and accepts an isolated owner/SYSTEM fixture',()=>{
  const dir=path.join(tmp,'acl');fs.mkdirSync(dir);
  const setup=`$p=$env.GRIDLY_ACL_FIXTURE; $s=[Security.Principal.WindowsIdentity]::GetCurrent().User; $a=New-Object Security.AccessControl.DirectorySecurity; $a.SetOwner($s); $a.SetAccessRuleProtection($true,$false); $a.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))); $a.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))); [IO.Directory]::SetAccessControl($p,$a)`;
  const run=text=>spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',text.replaceAll('$env.GRIDLY_ACL_FIXTURE',"'"+dir.replaceAll("'","''")+"'")],{encoding:'utf8',windowsHide:true,env:ENV});
  const configured=run(setup);assert.equal(configured.status,0,configured.stderr);
  assert.deepEqual(archive.verifyStorage(dir),verified());
  assert.equal(run("$a=[IO.Directory]::GetAccessControl($env.GRIDLY_ACL_FIXTURE); $a.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','ContainerInherit,ObjectInherit','None','Allow'))); [IO.Directory]::SetAccessControl($env.GRIDLY_ACL_FIXTURE,$a)").status,0);
  assert.throws(()=>archive.verifyStorage(dir));
});
test('Level 2 refuses known linkage contamination before writing content, then archives intended first-party fields encrypted',async()=>{
  const key=randomBytes(32);
  const stream=()=>sql(archive.archiveSql(today(),tomorrow())).split('\n');
  const rejected=path.join(tmp,'archive-contaminated');
  await assert.rejects(archive.writeArchive(stream(),rejected,{from:today(),to:tomorrow(),key,verify:verified}));
  assert.ok(fs.existsSync(path.join(rejected,'INCOMPLETE')));assert.ok(!fs.existsSync(path.join(rejected,'manifest.json.enc')));
  sql(`update reports set crossing_name='Main Street crossing',detail='Standing water across the roadway',railroad='Local railroad',confidence='Community confirmation received' where source='user';
    update gridly_feedback set category='Road condition',message='The crossing sign is damaged',awareness_area='Liberty',platform='web',gridly_version='fixture-v1' where created_at<now();
    insert into report_retention.replay_evidence(token_digest) values (sha256('synthetic token'::bytea));
    insert into report_retention.observation_receipts(report_id,token_digest,original_submitted_at)
      select id,sha256('synthetic token'::bytea),original_submitted_at from reports where crossing_id='DOT-1';`);
  const frozen=stream();const generatedAt=new Date().toISOString();
  const before=sql('select json_agg(row(original_submitted_at,cleanup_after,linkage_deadline)) from reports');
  const dirs=['archive-a','archive-b'].map(n=>path.join(tmp,n));let refs=[];
  for(const dir of dirs) {
    const m=await archive.writeArchive(frozen,dir,{from:today(),to:tomorrow(),key,verify:verified,generatedAt});
    assert.equal(m.datasets.reports.rows,1);assert.equal(m.datasets.feedback.rows,1);assert.equal(m.datasets.receipts.rows,1);
    assert.deepEqual(JSON.parse(decrypt(path.join(dir,'manifest.json.enc'),key)),m);
    assert.deepEqual(archive.readArchiveManifest(dir,key),m);
    const report=JSON.parse(decrypt(path.join(dir,'reports.jsonl.enc'),key));
    const feedback=JSON.parse(decrypt(path.join(dir,'feedback.jsonl.enc'),key));
    const receipt=JSON.parse(decrypt(path.join(dir,'receipts.jsonl.enc'),key));
    assert.match(report.id,/^[0-9a-f-]{36}$/);assert.equal(report.detail,'Standing water across the roadway');
    assert.equal(report.crossing_name,'Main Street crossing');assert.equal(report.lat,30.123456);
    assert.equal(report.confidence,'Community confirmation received');assert.equal(feedback.message,'The crossing sign is damaged');
    assert.equal(receipt.report_ref,report.archive_ref);refs.push(report.archive_ref);
    for(const entry of Object.values(m.datasets)) {
      const cipher=fs.readFileSync(path.join(dir,entry.file)),plain=decrypt(path.join(dir,entry.file),key);
      assert.equal(createHash('sha256').update(cipher).digest('hex'),entry.sha256);
      assert.equal(createHash('sha256').update(plain).digest('hex'),entry.contentSha256);
      assert.doesNotMatch(cipher.toString(),/Standing water|crossing sign|Main Street/);
      assert.doesNotMatch(plain,/fixture-device|fixture-secret|plaintext-token|licensed-provider|fingerprint|token_digest|owner_authorization_id|synthetic token/);
    }
    const marker=JSON.parse(fs.readFileSync(path.join(dir,'COMPLETE'),'utf8'));
    assert.equal(marker.sha256,createHash('sha256').update(fs.readFileSync(path.join(dir,'manifest.json.enc'))).digest('hex'));
    assert.ok(!fs.existsSync(path.join(dir,'INCOMPLETE')));
    assert.throws(()=>decrypt(path.join(dir,'reports.jsonl.enc'),randomBytes(32)));
  }
  assert.notEqual(refs[0],refs[1],'references cannot be correlated between exports');
  assert.equal(sql('select json_agg(row(original_submitted_at,cleanup_after,linkage_deadline)) from reports'),before);
});
test('Level 2 secrets, truncation, validation and storage failures cannot publish a valid manifest',async()=>{
  const key=randomBytes(32),stream=sql(archive.archiveSql(today(),tomorrow())).split('\n');
  const report=stream.map(l=>JSON.parse(l)).find(x=>x.kind==='row'&&x.dataset==='reports').row;
  for(const content of ['password=hunter2','Authorization: Bearer test-token','access_token=secret-value','-----BEGIN PRIVATE KEY-----','sb_secret_1234567890123456','https://user:password@example.invalid','secret-from-environment']) {
    assert.throws(()=>archive.validateArchiveRow('reports',{...report,detail:content},['secret-from-environment']));
  }
  const poison=stream.map(l=>{const m=JSON.parse(l);if(m.kind==='row'&&m.dataset==='reports')m.row.detail='refresh_token=never-export';return JSON.stringify(m);});
  for(const [label,data] of [['truncated',stream.slice(0,-1)],['poison',poison]]) {
    const dir=path.join(tmp,'archive-'+label);await assert.rejects(archive.writeArchive(data,dir,{from:today(),to:tomorrow(),key,verify:verified}));
    assert.ok(fs.existsSync(path.join(dir,'INCOMPLETE')));assert.ok(!fs.existsSync(path.join(dir,'manifest.json.enc')));assert.ok(!fs.existsSync(path.join(dir,'COMPLETE')));
    assert.throws(()=>archive.readArchiveManifest(dir,key));
  }
  let reads=0;async function* rows(){reads++;yield*stream;}
  await assert.rejects(archive.writeArchive(rows(),path.join(tmp,'archive-storage-denied'),{from:today(),to:tomorrow(),key,verify:()=>{throw Error('ACL');}}));assert.equal(reads,0);
  const env={...ENV,GRIDLY_RETENTION_PSQL:PSQL,PGHOST:'127.0.0.1',PGPORT:'55441',PGUSER:'postgres',PGDATABASE:db};
  const dir=path.join(tmp,'archive-write-denied');
  await assert.rejects(archive.writeArchive(exporter.databaseLines(archive.archiveSql(today(),tomorrow()).replace('commit;','delete from public.reports;\ncommit;'),env),dir,{from:today(),to:tomorrow(),key,verify:verified}));
  assert.ok(fs.existsSync(path.join(dir,'INCOMPLETE')));assert.ok(!fs.existsSync(path.join(dir,'manifest.json.enc')));
  assert.doesNotMatch(archive.archiveSql(today(),tomorrow()),/gridly_geocode|gridly_texas|verified_rural|auth\.|storage\.|\b(?:insert|update|delete|create|alter|grant)\b/i);
});
test('post-cleanup export remains de-linked and cannot restore history associations',async()=>{
  sql("alter table reports disable trigger report_retention_origin; update reports set cleanup_after=now()-interval '1 second'; alter table reports enable trigger report_retention_origin; select report_retention.run_cleanup()");
  const manifest=await exporter.writeExport(lines(),path.join(tmp,'cleaned'),{from:today(),to:tomorrow()});
  assert.equal(manifest.datasets.reports.rows,0);assert.equal(sql('select count(*) from report_retention.device_links'),'0');
  const history=fs.readFileSync(path.join(tmp,'cleaned/history.jsonl'),'utf8');
  assert.doesNotMatch(history,/device|report_id|token|DOT-/);
  sql("insert into history_capture.historical_events(envelope) values ('{}')",db,true);
  const result=await archive.writeArchive(sql(archive.archiveSql(today(),tomorrow())).split('\n'),path.join(tmp,'archive-cleaned'),{from:today(),to:tomorrow(),key:randomBytes(32),verify:verified});
  assert.equal(result.datasets.reports.rows,0);assert.equal(result.datasets.receipts.rows,0);
});
test('owner output directory is Git ignored and no exporter database objects or provider tables are introduced',()=>{
  const r=spawnSync('git',['check-ignore','owner-local/exports/example/manifest.json'],{cwd:ROOT,encoding:'utf8',windowsHide:true});assert.equal(r.status,0);
  const q=exporter.exportSql(today(),tomorrow());
  assert.doesNotMatch(q,/gridly_geocode|address_points|rural_address|\bcreate\b|\bupdate\b|\bdelete\b|\binsert\b|device_id|token_digest|owner_authorization_id/i);
  const prepared=fs.readFileSync(path.join(ROOT,'supabase/retention/revoke-failed-prelaunch-reset.PREPARED.sql'),'utf8').replaceAll('\r\n','\n');
  assert.ok(prepared.endsWith(renderRevocation().replaceAll('\r\n','\n')));
  assert.equal(spawnSync('git',['check-ignore','owner-local/archives/example/manifest.json.enc'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).status,0);
});
