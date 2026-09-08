import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);
export const VERSION = 'LP244.22A-1';
const migrations = ['202609080001_community_report_retention.sql','202609080002_community_submission_protocol.sql','20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql'];
const sources = migrations.map(p=>readFileSync(new URL('supabase/migrations/'+p,root),'utf8').replace(/\r\n/g,'\n'));
export const migrationHash = createHash('sha256').update(sources.join('\n')).digest('hex');
const expectedFunctions = sources.flatMap(s=>Array.from(s.matchAll(/create function ([\w.]+)\([\s\S]*?as \$\$([\s\S]*?)\$\$/g), m=>({name:m[1],body:m[2].trim(),definer:/security definer/i.test(m[0].slice(0,m[0].indexOf('as $$')))})));

// Built-in/catalog reads only: never invoke restored RPCs or restored views.
// One repeatable read, READ ONLY transaction; no cleanup or hidden writes.
export const INSPECT_SQL = `begin isolation level repeatable read read only;
set local statement_timeout='20s';
set local search_path=pg_catalog;
set local timezone='UTC';
select json_build_object(
 'version','${VERSION}', 'observedAt',statement_timestamp(),
 'ledger',(select coalesce(json_agg(encode(token_digest,'hex') order by token_digest),'[]') from report_retention.replay_evidence),
 'functions',(select coalesce(json_agg(json_build_object('name',n.nspname||'.'||p.proname,'body',p.prosrc,'args',pg_get_function_identity_arguments(p.oid),'definer',p.prosecdef,'config',p.proconfig,'ownerSafe',not exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role') and pg_has_role(r.oid,p.proowner,'MEMBER')) ) order by n.nspname,p.proname),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='report_retention' or (n.nspname='public' and p.proname in ('submit_community_observation','mutate_community_observation','cancel_community_operation'))),
 'columns',(select json_object_agg(name,cols) from (select table_schema||'.'||table_name name,string_agg(column_name,',' order by ordinal_position) cols from information_schema.columns where table_schema='report_retention' and table_name<>'health' group by 1) x),
 'constraints',(select json_object_agg(conname,pg_get_constraintdef(oid)) from pg_constraint where conrelid in ('report_retention.replay_evidence'::regclass,'report_retention.observation_receipts'::regclass,'public.reports'::regclass,'report_retention.device_links'::regclass,'report_retention.condition_month_counts'::regclass)),
 'policy',(select json_build_object('restrictive',not polpermissive,'command',polcmd,'qual',pg_get_expr(polqual,polrelid)) from pg_policy where polrelid='public.reports'::regclass and polname='report_retention_read_boundary'),
 'cleanupIndex',(select coalesce(bool_and(i.indisvalid and i.indisready),false) from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname='reports_cleanup_after_idx' and pg_get_indexdef(i.indexrelid) like '%(cleanup_after)%'),
 'triggers',(select json_object_agg(t.tgname,json_build_object('enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid))) from pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.reports'::regclass,'report_retention.replay_evidence'::regclass,'report_retention.observation_receipts'::regclass,'history_capture.historical_events'::regclass,'history_capture.writer_monitoring_events'::regclass)),
 'violations',json_build_object(
  'overdueReports',(select count(*) from public.reports where cleanup_after<=statement_timestamp()),
  'expiredLinks',(select count(*) from report_retention.device_links l join public.reports r on r.id=l.report_id where r.cleanup_after<=statement_timestamp() or r.linkage_deadline<=statement_timestamp()),
  'untrustedOrigins',(select count(*) from public.reports r left join report_retention.observation_receipts o on o.report_id=r.id where o.report_id is null or r.original_submitted_at is null or not isfinite(r.original_submitted_at) or r.original_submitted_at>statement_timestamp() or r.created_at is distinct from r.original_submitted_at or r.original_submitted_at is distinct from o.original_submitted_at or r.linkage_deadline is distinct from r.original_submitted_at+interval '4320 hours' or r.cleanup_after is distinct from r.original_submitted_at+interval '3576 hours'),
  'missingReceipts',(select count(*) from public.reports r left join report_retention.observation_receipts o on o.report_id=r.id left join report_retention.replay_evidence e on e.token_digest=o.token_digest where e.token_digest is null),
  'resetAgainstAdmission',(select count(*) from public.reports r join report_retention.observation_receipts o on o.report_id=r.id join report_retention.replay_evidence e using(token_digest) where r.original_submitted_at>e.first_accepted_at),
  'orphanReceipts',(select count(*) from report_retention.observation_receipts o left join public.reports r on r.id=o.report_id where r.id is null),
  'duplicateTokens',(select count(*)-count(distinct token_digest) from report_retention.replay_evidence),
  'duplicateOriginalReceipts',(select count(*)-count(distinct token_digest) from report_retention.observation_receipts),
  'invalidDigests',(select count(*) from report_retention.replay_evidence where octet_length(token_digest)<>32 or first_accepted_at is null or not isfinite(first_accepted_at) or first_accepted_at>statement_timestamp()),
  'deviceInConditions',(select count(*) from public.reports r left join report_retention.device_links l on l.report_id=r.id where r.device_id is not null or r.crossing_id ~ '^hazard(?:-cleared)?-.+-[0-9]{10,}$' or (l.device_id<>'' and position(l.device_id in concat_ws(' ',r.crossing_id,r.crossing_name,r.detail,r.railroad,r.confidence,r.source))>0)),
  'plaintextTokens',(select count(*) from (select row_to_json(r)::text body from public.reports r union all select row_to_json(l)::text from report_retention.device_links l union all select row_to_json(h)::text from report_retention.runs h) stored cross join lateral regexp_matches(stored.body,'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}','g') m join report_retention.replay_evidence e on e.token_digest=extensions.digest(uuid_send(m[1]::uuid),'sha256')),
  'legacyHistory',(select count(*) from history_capture.historical_events)+(select count(*) from history_capture.writer_monitoring_events)+(select count(*) from history_capture.retention_runs),
  'unvalidatedConstraints',(select count(*) from pg_constraint where not convalidated and conrelid in ('public.reports'::regclass,'report_retention.device_links'::regclass,'report_retention.replay_evidence'::regclass,'report_retention.observation_receipts'::regclass)),
  'disabledRls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='report_retention' and c.relkind='r' or c.oid='public.reports'::regclass) and not c.relrowsecurity),
  'clientTableAccess',(select count(*) from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace where r.rolname in ('anon','authenticated','service_role') and c.relkind in ('r','v','m','p') and (n.nspname in ('report_retention','history_capture') or c.oid='public.reports'::regclass) and (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
  'clientFunctionAccess',(select count(*) from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace where r.rolname in ('anon','authenticated','service_role') and n.nspname in ('public','report_retention','history_capture') and has_function_privilege(r.oid,p.oid,'EXECUTE')),
  'replicationExposure',(select count(*) from pg_publication where puballtables)+(select count(*) from pg_publication_tables where schemaname in ('report_retention','history_capture') or schemaname='public' and tablename='reports'),
  'cleanupUnhealthy',case when (select status from report_retention.runs order by id desc limit 1)='succeeded' and (select max(completed_at) from report_retention.runs where status='succeeded')>statement_timestamp()-interval '5 minutes' and (select max(completed_at) from report_retention.runs where status='succeeded')<=statement_timestamp() then 0 else 1 end
 )
);
rollback;`;

const columns = {
 'report_retention.device_links':'report_id,device_id',
 'report_retention.replay_evidence':'token_digest,first_accepted_at',
 'report_retention.observation_receipts':'report_id,token_digest,original_submitted_at',
 'report_retention.admission_state':'singleton,protocol_version,reporting_enabled,changed_at',
 'report_retention.condition_month_counts':'submission_month,condition_family,report_count',
 'report_retention.runs':'id,started_at,completed_at,status,deleted_reports,error_code'
};
const requiredConstraints = {
 replay_evidence_pkey:/^PRIMARY KEY \(token_digest\)$/,
 replay_evidence_token_digest_check:/octet_length\(token_digest\) = 32/,
 observation_receipts_pkey:/^PRIMARY KEY \(report_id\)$/,
 observation_receipts_token_digest_key:/^UNIQUE \(token_digest\)$/,
 observation_receipts_token_digest_fkey:/FOREIGN KEY \(token_digest\) REFERENCES report_retention.replay_evidence\(token_digest\)/,
 observation_receipts_report_id_fkey:/FOREIGN KEY \(report_id\) REFERENCES public.reports\(id\) ON DELETE CASCADE/,
 device_links_report_id_fkey:/FOREIGN KEY \(report_id\) REFERENCES public.reports\(id\) ON DELETE CASCADE/ ,
 condition_month_counts_pkey:/PRIMARY KEY \(submission_month, condition_family\)/,
 reports_device_never_stored:/device_id IS NULL/
};
const triggers = {report_retention_origin:['BEFORE INSERT OR UPDATE','ON public.reports','report_retention.guard_report()'],replay_evidence_immutable:['BEFORE DELETE OR UPDATE','ON report_retention.replay_evidence','report_retention.preserve_replay_evidence()'],replay_evidence_no_truncate:['BEFORE TRUNCATE','ON report_retention.replay_evidence','report_retention.preserve_replay_evidence()'],observation_receipt_immutable:['BEFORE UPDATE','ON report_retention.observation_receipts','report_retention.preserve_replay_evidence()'],history_capture_closed:['BEFORE INSERT OR UPDATE','report_retention.reject_legacy_history()'],history_monitoring_closed:['BEFORE INSERT OR UPDATE','report_retention.reject_legacy_history()']};
export function ledgerFingerprint(ledger) {
 if(!Array.isArray(ledger)||ledger.some(x=>!/^[0-9a-f]{64}$/.test(x))||new Set(ledger).size!==ledger.length) throw Error('Invalid ledger');
 return {count:ledger.length,sha256:createHash('sha256').update([...ledger].sort().join('\n')).digest('hex')};
}
export function inspect({env=process.env,run=spawnSync}={}) {
 if(!env.PGHOST||!env.PGUSER||!env.PGDATABASE || (!['127.0.0.1','localhost','::1'].includes(env.PGHOST)&&env.PGSSLMODE!=='verify-full')) throw Error('Connection configuration missing');
 const result=run(env.GRIDLY_RETENTION_PSQL||'psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{input:INSPECT_SQL,encoding:'utf8',env:{...env,PGCONNECT_TIMEOUT:'10'},windowsHide:true,timeout:25000,maxBuffer:32*1024*1024});
 if(result.status!==0) throw Error('Read-only inspection failed');
 return JSON.parse(result.stdout.trim());
}
export function evaluate(snapshot,evidence,{now=Date.now()}={}) {
 const failures=[];
 try {
  if(snapshot.version!==VERSION) failures.push('schema_version');
  if(JSON.stringify(snapshot.columns)!==JSON.stringify(columns)) {
   if(Object.keys(snapshot.columns).length!==Object.keys(columns).length||Object.entries(columns).some(([k,v])=>snapshot.columns[k]!==v)) failures.push('schema_columns');
  }
  for(const expected of expectedFunctions) {
   const found=snapshot.functions.filter(f=>f.name===expected.name);
   if(found.length!==1||found[0].body.trim().replace(/\r\n/g,'\n')!==expected.body||found[0].definer!==expected.definer||!found[0].ownerSafe||JSON.stringify(found[0].config)!=='["search_path=pg_catalog"]') failures.push('function_contract:'+expected.name);
  }
  const rpcArgs={submit_community_observation:'submission_token text, report jsonb, reporter_device_id text',mutate_community_observation:'operation_id text, observation_id uuid, action text, changes jsonb, reporter_device_id text',cancel_community_operation:'operation_id text'};
  for(const [name,args] of Object.entries(rpcArgs)) if(snapshot.functions.find(f=>f.name==='public.'+name)?.args!==args) failures.push('rpc_signature:'+name);
  if(snapshot.functions.length!==expectedFunctions.length) failures.push('unexpected_protocol_function');
  if(snapshot.policy?.restrictive!==true||snapshot.policy?.command!=='r'||snapshot.policy?.qual!=='((cleanup_after > statement_timestamp()) AND (linkage_deadline > statement_timestamp()))') failures.push('read_policy');
  if(snapshot.cleanupIndex!==true) failures.push('cleanup_index');
  for(const [name,re] of Object.entries(requiredConstraints)) if(!re.test(snapshot.constraints[name]||'')) failures.push('constraint:'+name);
  for(const [name,parts] of Object.entries(triggers)) if(snapshot.triggers[name]?.enabled!=='O'||parts.some(p=>!snapshot.triggers[name]?.definition.includes(p))) failures.push('trigger:'+name);
  const keys=['overdueReports','expiredLinks','untrustedOrigins','missingReceipts','resetAgainstAdmission','orphanReceipts','duplicateTokens','duplicateOriginalReceipts','invalidDigests','deviceInConditions','plaintextTokens','legacyHistory','unvalidatedConstraints','disabledRls','clientTableAccess','clientFunctionAccess','replicationExposure','cleanupUnhealthy'];
  for(const key of keys) if(snapshot.violations[key]!==0) failures.push(key);
  const ledger=ledgerFingerprint(snapshot.ledger);
  if(!evidence||evidence.version!==VERSION||evidence.migrationHash!==migrationHash||evidence.sourceWritesStopped!==true||evidence.sourceContinuityVerified!==true||evidence.networkIsolationVerified!==true||!evidence.authorizationReference?.trim()||!evidence.sourceReference?.trim()||!Number.isFinite(Date.parse(evidence.capturedAt))||Date.parse(evidence.capturedAt)>now||!Number.isFinite(Date.parse(evidence.validUntil))||Date.parse(evidence.validUntil)<=now||now-Date.parse(evidence.capturedAt)>86400000||Date.parse(evidence.validUntil)-Date.parse(evidence.capturedAt)>86400000) failures.push('trusted_source_evidence_required');
  if(evidence?.ledger?.count!==ledger.count||evidence?.ledger?.sha256!==ledger.sha256) failures.push('ledger_continuity');
 } catch { failures.push('incomplete_or_invalid_inspection'); }
 return {version:VERSION,pass:failures.length===0,reconnectionAuthorized:false,failures:[...new Set(failures)],migrationHash};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 let result;
 try {
  if(process.argv.length===3&&process.argv[2]==='--source-ledger') {
   const snapshot=inspect();
   console.log(JSON.stringify({version:VERSION,migrationHash,ledger:ledgerFingerprint(snapshot.ledger),capturedAt:snapshot.observedAt,validUntil:null,sourceWritesStopped:false,sourceContinuityVerified:false,networkIsolationVerified:false,authorizationReference:'',sourceReference:''}));
   process.exit(0);
  }
  if(process.argv.length!==4||process.argv[2]!=='--evidence') throw Error('Explicit evidence required');
  const evidence=JSON.parse(readFileSync(process.argv[3],'utf8'));
  result=evaluate(inspect(),evidence);
 } catch { result={version:VERSION,pass:false,reconnectionAuthorized:false,failures:['configuration_evidence_or_inspection_failed'],migrationHash}; }
 // No raw rows, tokens, body, IDs, credentials or connection stderr in output.
 console.log(JSON.stringify(result));process.exitCode=result.pass?0:1;
}
