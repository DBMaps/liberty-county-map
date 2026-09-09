import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync, openSync, writeSync, closeSync, renameSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const VERSION = 'gridly.owner-export.v1';
export const PROJECT = 'nhwhkbkludzkuyxmkkcj';
const counties = JSON.parse(readFileSync(path.join(ROOT,'data/lp149/runtime-county-registry.json'),'utf8')).identities;
const literal = value => `'${value.replaceAll("'", "''")}'`;
const countyIds = counties.map(c => literal(c.countyId)).join(',');
export const DICTIONARY = Object.freeze({
  reports: {
    submitted_at:'Original UTC submission; range key', expires_at:'Current condition expiry; not a clearing timestamp',
    cleanup_after:'Immutable day-149 target', linkage_deadline:'Immutable day-180 maximum',
    county_id:'Validated Texas registry ID, otherwise null; never inferred',
    condition_family:'road or crossing', report_type:'Allowlisted condition classification, otherwise other',
    severity:'Allowlisted severity, otherwise other', status:'cleared, expired or active at snapshot',
    confirmation_received:'Current confirmation marker; not an event count', provenance:'community; only first-party user reports'
  },
  history: {submission_month:'UTC month; overlap with selected range',condition_family:'road or crossing',report_count:'Deleted, de-linked conditions; no individual historical rows'},
  retention_runs: {started_at:'UTC run start; range key',completed_at:'UTC completion or null',status:'running, succeeded or failed',deleted_reports:'Deletion count',error_code:'SQLSTATE only, never error text'},
  health: {last_success_at:'Latest successful cleanup; snapshot-wide',overdue_cleanup_count:'Day-149 overdue count',breached_deadline_count:'Day-180 overdue count',last_status:'Latest run status'},
  feedback: {created_at:'UTC creation; range key',status:'new, reviewing or closed',county_id:'Validated Texas registry ID or null',provenance:'first_party_feedback'},
  protocol: {protocol_version:'Current admission protocol',reporting_enabled:'Current admission state',replay_evidence_count:'Count only; security ledger is not exported',live_receipt_count:'Count only; no associations'},
  reset_compliance: {status:'consumed or launched',consumed_at:'UTC reset time; range key',deleted_reports:'Pre-launch deletion count',deleted_historical_events:'Pre-launch deletion count',deleted_writer_events:'Pre-launch deletion count',deleted_retention_runs:'Pre-launch deletion count'}
});
export function bounds(from,to) {
  for (const d of [from,to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || new Date(d).toISOString().slice(0,10)!==d) throw Error('Invalid UTC date');
  if (from>=to) throw Error('Range must be nonempty: from inclusive, to exclusive');
  return {from,to};
}
export function analyticsQueries(from,to) {
  bounds(from,to);
  const range = col => `${col} >= '${from}'::timestamptz and ${col} < '${to}'::timestamptz`;
  const queries = {
    reports:`select original_submitted_at as submitted_at,expires_at,cleanup_after,linkage_deadline,
      case when county_id in (${countyIds}) then county_id end as county_id,
      case when crossing_id like 'hazard-%' then 'road' else 'crossing' end as condition_family,
      case when report_type in ('blocked','flooded','debris','accident','construction','hazard','cleared','hazard_cleared','train','stopped_train','slow_train') then report_type else 'other' end as report_type,
      case when severity in ('low','medium','high','critical') then severity else 'other' end as severity,
      case when report_type in ('cleared','hazard_cleared') then 'cleared' when expires_at<=transaction_timestamp() then 'expired' else 'active' end as status,
      confidence='Community confirmation received' as confirmation_received,'community'::text as provenance
      from public.reports where ${range('original_submitted_at')} and cleanup_after>transaction_timestamp()
      and linkage_deadline>transaction_timestamp() and source='user'`,
    history:`select submission_month,condition_family,report_count from report_retention.condition_month_counts
      where submission_month < '${to}'::date and submission_month+interval '1 month' > '${from}'::date`,
    retention_runs:`select started_at,completed_at,status,deleted_reports,
      case when error_code ~ '^[0-9A-Z]{5}$' then error_code end as error_code
      from report_retention.runs where ${range('started_at')}`,
    // Read base tables: do not execute a restored/custom view or function.
    health:`select (select max(completed_at) from report_retention.runs where status='succeeded') as last_success_at,
      (select count(*) from public.reports where cleanup_after<=transaction_timestamp()) as overdue_cleanup_count,
      (select count(*) from public.reports where linkage_deadline<=transaction_timestamp()) as breached_deadline_count,
      (select status from report_retention.runs order by id desc limit 1) as last_status`,
    feedback:`select created_at,status,case when county_id in (${countyIds}) then county_id end as county_id,
      'first_party_feedback'::text as provenance from public.gridly_feedback where ${range('created_at')}`,
    protocol:`select protocol_version,reporting_enabled,
      (select count(*) from report_retention.replay_evidence) as replay_evidence_count,
      (select count(*) from report_retention.observation_receipts) as live_receipt_count from report_retention.admission_state`,
    reset_compliance:`select status,consumed_at,deleted_reports,deleted_historical_events,deleted_writer_events,deleted_retention_runs
      from gridly_control.prelaunch_reset_authorization where status in ('consumed','launched') and ${range('consumed_at')}`
  };
  return queries;
}
export function exportSql(from,to) { return snapshotSql(analyticsQueries(from,to)); }
export function snapshotSql(queries,extraSchema="") {
  return `begin isolation level repeatable read read only;
set local search_path=pg_catalog;
set local timezone='UTC';
set local statement_timeout='60s';
set local lock_timeout='5s';
select json_build_object('kind','schema','versions',(select json_agg(version order by version) from supabase_migrations.schema_migrations),
 'transition_present',to_regclass('report_retention.device_links') is not null,
 'legacy_history_empty',not exists(select 1 from history_capture.historical_events),
 'owner',current_user='postgres'${extraSchema});
${Object.entries(queries).map(([name,q])=>`select json_build_object('kind','count','dataset','${name}','count',count(*)) from (${q}) q;
select json_build_object('kind','row','dataset','${name}','row',row_to_json(q)) from (${q}) q order by row_to_json(q)::text collate "C";`).join('\n')}
commit;
select '{"kind":"complete"}';`;
}

// Strict keys even with a faulty adapter. No opaque text, identifiers, envelopes,
// provider records, or linkage columns are selected by the SQL.
export function validateRow(dataset,row) {
  if (!DICTIONARY[dataset] || !row || JSON.stringify(Object.keys(row).sort())!==JSON.stringify(Object.keys(DICTIONARY[dataset]).sort())) throw Error('Export field allowlist mismatch');
  for (const [key,value] of Object.entries(row)) {
    if (value===null) continue;
    if (/(_at|cleanup_after|linkage_deadline)$/.test(key)) { if (typeof value!=='string' || !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00(?::00)?)$/.test(value)) throw Error('Invalid timestamp'); }
    else if (key==='submission_month') { if (!/^\d{4}-\d\d-01$/.test(value)) throw Error('Invalid month'); }
    else if (key==='county_id') { if (!counties.some(c=>c.countyId===value)) throw Error('Invalid county'); }
    else if (key==='error_code') { if (!/^[0-9A-Z]{5}$/.test(value)) throw Error('Invalid SQLSTATE'); }
    else if (typeof value==='number') { if (!Number.isSafeInteger(value)||value<0) throw Error('Invalid count'); }
    else if (typeof value==='boolean') continue;
    else if (!['road','crossing','blocked','flooded','debris','accident','construction','hazard','cleared','hazard_cleared','train','stopped_train','slow_train','other','low','medium','high','critical','expired','active','community','first_party_feedback','running','succeeded','failed','new','reviewing','closed','consumed','launched'].includes(value)) throw Error('Invalid classification');
  }
}

export async function writeExport(lines,directory,{from,to,generatedAt=new Date().toISOString()}={}) {
  bounds(from,to);
  mkdirSync(directory,{recursive:false,mode:0o700});
  const pending=path.join(directory,'INCOMPLETE');
  writeFileSync(pending,'Export incomplete. Do not use or share. Delete after investigation.\n',{mode:0o600});
  const files={}; const usedCounties=new Set(); let schema=null, complete=false;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      if (line.length>65536 || complete) throw Error('Invalid export stream');
      const msg=JSON.parse(line);
      if (msg.kind==='schema') {
        if(schema || !msg.owner || !msg.transition_present || !msg.legacy_history_empty || !Array.isArray(msg.versions) || !msg.versions.includes('20260908200554') || msg.versions.some(v=>!/^\d{12,14}$/.test(v))) throw Error('Uncertified source schema');
        schema=msg.versions;
      } else if (msg.kind==='count') {
        if(!schema || !DICTIONARY[msg.dataset] || files[msg.dataset] || !Number.isSafeInteger(msg.count) || msg.count<0) throw Error('Invalid export count');
        files[msg.dataset]={fd:openSync(path.join(directory,msg.dataset+'.jsonl'),'wx',0o600),count:0,expected:msg.count,hash:createHash('sha256')};
      } else if (msg.kind==='row') {
        const file=files[msg.dataset]; if(!file || file.count>=file.expected) throw Error('Unexpected export row');
        validateRow(msg.dataset,msg.row);
        if(msg.row.county_id) usedCounties.add(msg.row.county_id);
        const data=JSON.stringify(Object.fromEntries(Object.keys(DICTIONARY[msg.dataset]).map(k=>[k,msg.row[k]])))+'\n';
        writeSync(file.fd,data);file.hash.update(data);file.count++;
      } else if (msg.kind==='complete') complete=true;
      else throw Error('Invalid export message');
    }
    if(!complete || !schema || Object.keys(files).length!==Object.keys(DICTIONARY).length || Object.values(files).some(f=>f.count!==f.expected)) throw Error('Incomplete export');
    const manifest={schemaVersion:VERSION,generatedAtUtc:generatedAt,dateRange:{fromInclusive:from,toExclusive:to},
      sourceMigrationVersions:schema,
      repositoryTransitionSha256:createHash('sha256').update(readFileSync(path.join(ROOT,'supabase/migrations/20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql'),'utf8').replaceAll('\r\n','\n')).digest('hex'),
      redactionProfile:'level1-no-linkage-no-free-text-no-provider',
      countyContext:counties.filter(c=>usedCounties.has(c.countyId)).map(c=>({countyId:c.countyId,countyName:c.countyName,fips:c.fips,state:'TX'})),
      deleteByUtc:new Date(Date.parse(generatedAt)+30*86400000).toISOString(),
      storagePolicy:'Owner-local, encrypted access-controlled storage. Delete within 30 days; retain only reviewed anonymous aggregates separately. Never import as operational data.',
      datasets:Object.fromEntries(Object.entries(files).map(([name,f])=>[name,{file:name+'.jsonl',rows:f.count,fields:Object.keys(DICTIONARY[name]),sha256:f.hash.digest('hex')}])),dataDictionary:DICTIONARY};
    writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
    renameSync(pending,path.join(directory,'COMPLETE'));
    writeFileSync(path.join(directory,'COMPLETE'),'Complete; validate manifest hashes before use.\n');
    return manifest;
  } finally {for(const f of Object.values(files)) closeSync(f.fd);}
}

export async function* databaseLines(sql,env=process.env) {
  const child=spawn(env.GRIDLY_RETENTION_PSQL||'psql',['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','FETCH_COUNT=500'],
    {env:{...env,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on'},windowsHide:true,stdio:['pipe','pipe','pipe']});
  let failed=false;
  const done=new Promise(resolve=>{child.on('error',()=>{failed=true;resolve(1);});child.on('close',resolve);});
  child.stderr.resume(); // Never expose SQL errors, connection strings, or credentials.
  child.stdin.on('error',()=>{failed=true;});
  child.stdin.end(sql);
  const timer=setTimeout(()=>child.kill(),300000);
  try {
    for await (const line of createInterface({input:child.stdout,crlfDelay:Infinity})) yield line;
    if(await done!==0 || failed) throw Error('Database export failed; details suppressed');
  } finally {clearTimeout(timer);child.kill();}
}

export async function main(args=process.argv.slice(2),env=process.env) {
  if(args.length===1 && args[0]==='--help') {console.log('node tools/retention/owner-export.mjs --confirm-project '+PROJECT+' --from YYYY-MM-DD --to YYYY-MM-DD\nCredentials: libpq environment/secure password file only. Output: owner-local/exports. Encrypt storage and delete within 30 days.');return;}
  if(args.length!==6 || args[0]!=='--confirm-project' || args[1]!==PROJECT || args[2]!=='--from' || args[4]!=='--to') throw Error('Explicit project and date range required; use --help');
  const {from,to}=bounds(args[3],args[5]);
  // Exact direct host binds confirmation to the connection. No arbitrary URI,
  // service-file target override, pooler ambiguity, or production fixture mode.
  if(env.PGHOST!==`db.${PROJECT}.supabase.co` || env.PGUSER!=='postgres' || env.PGDATABASE!=='postgres' || env.PGSSLMODE!=='verify-full' || env.PGSERVICE || env.PGHOSTADDR || (env.PGPORT && env.PGPORT!=='5432')) throw Error('Owner direct database configuration required');
  const parent=path.join(ROOT,'owner-local/exports');mkdirSync(parent,{recursive:true,mode:0o700});
  const dir=path.join(parent,new Date().toISOString().replaceAll(':','-'));
  await writeExport(databaseLines(exportSql(from,to),env),dir,{from,to});
  console.log('Owner export complete in owner-local/exports. Encrypt storage; delete within 30 days.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Owner export failed. Any INCOMPLETE directory is unusable. No connection details are logged.');process.exitCode=1;});
