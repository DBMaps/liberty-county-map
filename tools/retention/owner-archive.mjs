import {spawnSync} from 'node:child_process';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,openSync,writeSync,closeSync,renameSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {bounds,PROJECT,DICTIONARY,analyticsQueries,snapshotSql,databaseLines,validateRow} from './owner-export.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const VERSION='gridly.owner-archive.v1';
export const ARCHIVE_DICTIONARY=Object.freeze({
  ...DICTIONARY,
  reports:{id:'Stable first-party report UUID',archive_ref:'Export-scoped report reference; HMAC key discarded',
    created_at:'Stored creation UTC',original_submitted_at:'Immutable origin UTC; date-range key',expires_at:'Stored expiry UTC, not transition time',
    cleanup_after:'Immutable day-149 cleanup target',linkage_deadline:'Immutable day-180 maximum',
    crossing_id:'Stored condition/location identifier; device-derived legacy values refused',crossing_name:'Submitted location label',
    railroad:'Submitted railroad text',lat:'Submitted latitude',lng:'Submitted longitude',county_id:'Stored county context or null',state:'Stored state or null',
    report_type:'Stored current classification',severity:'Stored current severity',detail:'Stored current submitted/edited content',
    source:'user only',confidence:'Stored current confirmation/clearing marker or submitted confidence',status:'Derived current active/expired/cleared state',
    provenance:'user_supplied; lifecycle/status fields are Gridly operational values'},
  feedback:{id:'Stable first-party feedback UUID',created_at:'Stored UTC creation; range key',category:'Submitted category',message:'Submitted feedback content',
    awareness_area:'Submitted location/awareness context',platform:'Submitted platform',gridly_version:'Submitted client version',county_id:'Stored county context',state:'Stored state',status:'Current operational review status',provenance:'user_supplied'},
  receipts:{report_ref:'Same export-scoped reference as reports.archive_ref',original_submitted_at:'Live receipt immutable origin UTC',first_accepted_at:'Ledger acceptance UTC; no digest/token exported',provenance:'security_control'}
});
export function archiveSql(from,to) {
  bounds(from,to);
  const queries=analyticsQueries(from,to);
  const scope=`r.source='user' and r.original_submitted_at >= '${from}'::timestamptz
    and r.original_submitted_at < '${to}'::timestamptz and r.cleanup_after>transaction_timestamp()
    and r.linkage_deadline>transaction_timestamp()`;
  queries.reports=`select r.id,r.id as archive_ref,r.created_at,r.original_submitted_at,r.expires_at,r.cleanup_after,r.linkage_deadline,
    r.crossing_id,r.crossing_name,r.railroad,r.lat,r.lng,r.county_id,r.state,r.report_type,r.severity,r.detail,r.source,r.confidence,
    case when r.report_type in ('cleared','hazard_cleared') then 'cleared' when r.expires_at<=transaction_timestamp() then 'expired' else 'active' end as status,
    'user_supplied'::text as provenance from public.reports r where ${scope}`;
  queries.feedback=`select id,created_at,category,message,awareness_area,platform,gridly_version,county_id,state,status,
    'user_supplied'::text as provenance from public.gridly_feedback
    where created_at >= '${from}'::timestamptz and created_at < '${to}'::timestamptz`;
  queries.receipts=`select r.id as report_ref,o.original_submitted_at,e.first_accepted_at,'security_control'::text as provenance
    from public.reports r join report_retention.observation_receipts o on o.report_id=r.id
    join report_retention.replay_evidence e on e.token_digest=o.token_digest where ${scope}`;
  // Inspect known device and authorization values entirely inside PostgreSQL.
  // Refuse contaminated content rather than sending identifiers to the exporter.
  const textProjection=`select concat_ws(' ',crossing_id,crossing_name,railroad,detail,confidence,county_id,state,report_type,severity) as value from (${queries.reports}) q
    union all select concat_ws(' ',category,message,awareness_area,platform,gridly_version,county_id,state,status) from (${queries.feedback}) q`;
  const safe=`not exists(select 1 from (${textProjection}) x where
    exists(select 1 from report_retention.device_links l where l.device_id<>'' and position(l.device_id in x.value)>0)
    or exists(select 1 from gridly_control.prelaunch_reset_authorization a where position(a.owner_authorization_id::text in lower(x.value))>0))`;
  return snapshotSql(queries,`, 'archive_content_safe',${safe}`);
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_TEXT=/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const HAZARD_UUID=/^hazard-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// UUID permission is provenance-bound. Keys are archive dataset/column names,
// and each value documents the authoritative database origin represented by
// that exported field. No other source column receives a UUID exemption.
export const UUID_BEARING_IDENTIFIER_COLUMNS=Object.freeze({
  'reports.id':'public.reports.id — stable report entity identity',
  'reports.archive_ref':'public.reports.id alias — export-scoped report relationship input',
  'reports.crossing_id':'public.reports.crossing_id — Gridly hazard entity identity in hazard-UUID form',
  'feedback.id':'public.gridly_feedback.id — stable feedback entity identity',
  'receipts.report_ref':'public.reports.id alias — receipt-to-report relationship input'
});
const REQUIRED_UUID_COLUMNS=new Set(['reports.id','reports.archive_ref','feedback.id','receipts.report_ref']);
function uuidSourceAllowsValue(dataset,key,value) {
  const source=`${dataset}.${key}`;
  if(!Object.hasOwn(UUID_BEARING_IDENTIFIER_COLUMNS,source)) return false;
  return source==='reports.crossing_id' ? HAZARD_UUID.test(value) : UUID.test(value);
}
const SECRET_PATTERNS=[
  /-----BEGIN [\w ]*PRIVATE KEY-----/i,
  /\b(?:access[_ -]?token|refresh[_ -]?token|submission[_ -]?token|operation[_ -]?token|authorization(?:[_ -]?(?:uuid|code|digest))?|revocation[_ -]?(?:id|identifier|token)|replay[_ -]?digest|password|passwd|credentials?|private[_ -]?key|provider(?:[_ -]?api)?[_ -]?(?:key|secret|token)|service[_ -]?role(?:[_ -]?(?:key|secret))?|api[_ -]?key|cookies?|session[_ -]?(?:secret|token)|secret)\b["']?\s*[:=]\s*["']?\S+/i,
  /\bBearer\s+\S+/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /\b(?:sk[-_]|sb_secret_|AKIA)[A-Za-z0-9_-]{12,}/,
  /\b(?:postgres(?:ql)?|https?):\/\/[^\s/]+:[^\s@]+@/i,
  /\b[0-9a-f]{64,}\b/i,
  /\b(?:device|installation)[_ -]?id\s*[:=]\s*\S+/i
];
export function validateArchiveRow(dataset,row,secrets=[]) {
  const fields=ARCHIVE_DICTIONARY[dataset];
  if(!fields || !row || JSON.stringify(Object.keys(row).sort())!==JSON.stringify(Object.keys(fields).sort())) throw Error('Archive allowlist mismatch');
  if(!['reports','feedback','receipts'].includes(dataset)) {validateRow(dataset,row);return;}
  for(const [key,value] of Object.entries(row)) {
    if(value===null) continue;
    const source=`${dataset}.${key}`;
    if(REQUIRED_UUID_COLUMNS.has(source)) {if(typeof value!=='string'||!uuidSourceAllowsValue(dataset,key,value)) throw Error('Invalid record identifier');}
    else if(/(_at|cleanup_after|linkage_deadline)$/.test(key)) {
      if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00(?::00)?)$/.test(value)) throw Error('Invalid archive timestamp');
    } else if(['lat','lng'].includes(key)) {if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>(key==='lat'?90:180)) throw Error('Invalid coordinate');}
    else if(typeof value!=='string'||value.length>12000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
      ||(UUID_TEXT.test(value)&&!uuidSourceAllowsValue(dataset,key,value))
      ||SECRET_PATTERNS.some(re=>re.test(value))||secrets.some(s=>s && value.includes(s))) throw Error('Archive content requires secret review');
  }
  if(dataset==='reports' && row.source!=='user') throw Error('Provider source forbidden');
  if(row.provenance!==(dataset==='receipts'?'security_control':'user_supplied')) throw Error('Invalid provenance');
}

export function verifyStorage(directory,{run=spawnSync,platform=process.platform}={}) {
  if(platform!=='win32') throw Error('Windows ACL verification required');
  const result=run('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(ROOT,'tools/retention/verify-owner-archive-storage.ps1'),'-LiteralPath',directory],
    {encoding:'utf8',windowsHide:true,timeout:15000,
      env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/PASSWORD|SECRET|TOKEN|API_KEY|ARCHIVE_KEY/i.test(k)))});
  let evidence;try {evidence=JSON.parse(result.stdout);} catch {throw Error('Storage verification unavailable');}
  if(result.status!==0 || !['ownerOnly','local','noReparse','ownerFullControl'].every(k=>evidence[k]===true)) throw Error('Restrictive owner storage required');
  return evidence;
}

// In-memory access for owner-controlled analysis tools. Never writes decrypted
// files or logs content. Callers must first verify COMPLETE + manifest hashes.
export function decryptArchiveBytes(bytes,key) {
  if(!Buffer.isBuffer(key)||key.length!==32||bytes.length<36||bytes.subarray(0,8).toString()!=='GRIDLYA1') throw Error('Invalid encrypted archive');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(8,20));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(20,-16)),decipher.final()]);
}
export function readArchiveManifest(directory,key) {
  if(existsSync(path.join(directory,'INCOMPLETE'))) throw Error('Incomplete archive');
  const complete=JSON.parse(readFileSync(path.join(directory,'COMPLETE'),'utf8'));
  const bytes=readFileSync(path.join(directory,'manifest.json.enc'));
  if(complete.complete!==true||complete.manifest!=='manifest.json.enc'||createHash('sha256').update(bytes).digest('hex')!==complete.sha256) throw Error('Invalid archive completion');
  const manifest=JSON.parse(decryptArchiveBytes(bytes,key));
  if(manifest.schemaVersion!==VERSION||manifest.level!==2||!Number.isFinite(Date.parse(manifest.deleteByUtc))||Date.parse(manifest.deleteByUtc)<=Date.now()) throw Error('Expired or incompatible archive');
  return manifest;
}
function encryptedFile(directory,name,key) {
  const fd=openSync(path.join(directory,name),'wx',0o600),nonce=randomBytes(12),hash=createHash('sha256'),contentHash=createHash('sha256');
  const cipher=createCipheriv('aes-256-gcm',key,nonce);
  const append=b=>{writeSync(fd,b);hash.update(b);};
  append(Buffer.concat([Buffer.from('GRIDLYA1'),nonce]));
  let closed=false;
  return {write(text){const bytes=Buffer.from(text);contentHash.update(bytes);append(cipher.update(bytes));},
    finish(){append(cipher.final());append(cipher.getAuthTag());closeSync(fd);closed=true;return {sha256:hash.digest('hex'),contentSha256:contentHash.digest('hex')};},
    close(){if(!closed){closeSync(fd);closed=true;}}};
}
export async function writeArchive(lines,directory,{from,to,key,generatedAt=new Date().toISOString(),verify=verifyStorage,secrets=[]}={}) {
  bounds(from,to);
  if(!Buffer.isBuffer(key)||key.length!==32) throw Error('32-byte archive key required');
  // The parent is verified BEFORE creating a child or reading any database row.
  verify(path.dirname(directory));mkdirSync(directory,{recursive:false,mode:0o700});
  const incomplete=path.join(directory,'INCOMPLETE');writeFileSync(incomplete,'Archive incomplete. No valid manifest. Delete incomplete files after review.\n',{mode:0o600});
  const files={};const scopeKey=randomBytes(32);let complete=false,schema=null,manifestFile;
  let deleteBy=Date.parse(generatedAt)+30*86400000;
  try {
    const storage=verify(directory);
    for await(const line of lines) {
      if(!line.trim()) continue;
      if(line.length>131072||complete) throw Error('Invalid archive stream');
      const msg=JSON.parse(line);
      if(msg.kind==='schema') {
        if(schema||!msg.owner||!msg.transition_present||!msg.legacy_history_empty||msg.archive_content_safe!==true
          ||!Array.isArray(msg.versions)||!msg.versions.includes('20260908200554')||msg.versions.some(v=>!/^\d{12,14}$/.test(v))) throw Error('Uncertified archive source');
        schema=msg.versions;
      } else if(msg.kind==='count') {
        if(!schema||!ARCHIVE_DICTIONARY[msg.dataset]||files[msg.dataset]||!Number.isSafeInteger(msg.count)||msg.count<0) throw Error('Invalid archive count');
        files[msg.dataset]={file:msg.dataset+'.jsonl.enc',count:0,expected:msg.count,sink:encryptedFile(directory,msg.dataset+'.jsonl.enc',key)};
      } else if(msg.kind==='row') {
        const file=files[msg.dataset];if(!file||file.count>=file.expected) throw Error('Unexpected archive row');
        validateArchiveRow(msg.dataset,msg.row,secrets);
        const row={...msg.row};
        for(const field of ['archive_ref','report_ref']) if(row[field]) row[field]=createHmac('sha256',scopeKey).update('report:'+row[field].toLowerCase()).digest('hex');
        if(msg.dataset==='reports') deleteBy=Math.min(deleteBy,Date.parse(row.cleanup_after),Date.parse(row.linkage_deadline));
        file.sink.write(JSON.stringify(Object.fromEntries(Object.keys(ARCHIVE_DICTIONARY[msg.dataset]).map(k=>[k,row[k]])))+'\n');file.count++;
      } else if(msg.kind==='complete') complete=true;
      else throw Error('Invalid archive message');
    }
    if(!complete||!schema||Object.keys(files).length!==Object.keys(ARCHIVE_DICTIONARY).length||Object.values(files).some(f=>f.count!==f.expected)||!Number.isFinite(deleteBy)||deleteBy<=Date.now()) throw Error('Incomplete or expired archive');
    verify(directory);
    const datasets=Object.fromEntries(Object.entries(files).map(([name,f])=>[name,{file:f.file,rows:f.count,fields:Object.keys(ARCHIVE_DICTIONARY[name]),...f.sink.finish()}]));
    const manifest={schemaVersion:VERSION,level:2,generatedAtUtc:generatedAt,dateRange:{fromInclusive:from,toExclusive:to},sourceMigrationVersions:schema,
      encryption:'AES-256-GCM; GRIDLYA1 + 12-byte nonce + ciphertext + 16-byte tag; key held separately',storage,
      referenceScope:'HMAC-SHA256 random in-memory per-archive key discarded; no actor/device grouping',
      classification:{reports:'user_supplied_and_operational',feedback:'user_supplied_and_operational',history:'gridly_operational_delinked',retention_runs:'gridly_operational',health:'gridly_operational',protocol:'security_control_counts',reset_compliance:'security_control_counts',receipts:'security_control_live_provenance'},
      limitations:'Current stored state, not an event log, database backup, restoration witness or complete replay ledger. No erased associations reconstructed.',
      deleteByUtc:new Date(deleteBy).toISOString(),storagePolicy:'Owner-requested local copy only. Delete archive and copies by deleteByUtc; no automated retention or upload.',
      datasets,dataDictionary:ARCHIVE_DICTIONARY};
    manifestFile=encryptedFile(directory,'manifest.json.enc',key);manifestFile.write(JSON.stringify(manifest,null,2)+'\n');const manifestHashes=manifestFile.finish();
    // Last operation publishes completeness. Failure anywhere earlier leaves
    // INCOMPLETE; even a partial encrypted manifest is never valid without it.
    writeFileSync(incomplete,JSON.stringify({complete:true,manifest:'manifest.json.enc',sha256:manifestHashes.sha256})+'\n');
    renameSync(incomplete,path.join(directory,'COMPLETE'));
    return manifest;
  } finally {scopeKey.fill(0);for(const f of Object.values(files)) f.sink.close();manifestFile?.close();}
}
export function archiveOptions(args,env) {
  if(args.length!==9||args[0]!=='--level-2'||args[1]!=='--confirm-project'||args[2]!==PROJECT||args[3]!=='--from'||args[5]!=='--to'||args[7]!=='--confirm-owner-storage'||args[8]!=='--confirm-first-party-content') throw Error('Explicit Level 2, project, range, storage and content confirmation required');
  const range=bounds(args[4],args[6]);
  if(env.PGHOST!==`db.${PROJECT}.supabase.co`||env.PGUSER!=='postgres'||env.PGDATABASE!=='postgres'||env.PGSSLMODE!=='verify-full'||env.PGSERVICE||env.PGHOSTADDR||(env.PGPORT&&env.PGPORT!=='5432')) throw Error('Owner direct connection required');
  if(!/^[0-9a-f]{64}$/i.test(env.GRIDLY_ARCHIVE_KEY||'')) throw Error('Separate archive encryption key required');
  return range;
}
export async function main(args=process.argv.slice(2),env=process.env) {
  if(args.length===1&&args[0]==='--help') {console.log(`node tools/retention/owner-archive.mjs --level-2 --confirm-project ${PROJECT} --from YYYY-MM-DD --to YYYY-MM-DD --confirm-owner-storage --confirm-first-party-content\nPreconfigure owner-only ACLs on owner-local/archives. Supply GRIDLY_ARCHIVE_KEY via secure environment (64 hex digits); keep it separately. Confirm selected content is first-party and contains no unrecognized secrets or third-party licensed material.`);return;}
  const {from,to}=archiveOptions(args,env),key=Buffer.from(env.GRIDLY_ARCHIVE_KEY,'hex');
  const parent=path.join(ROOT,'owner-local/archives');
  const directory=path.join(parent,new Date().toISOString().replaceAll(':','-'));
  const secrets=Object.entries(env).filter(([k,v])=>/PASSWORD|SECRET|TOKEN|API_KEY|ARCHIVE_KEY/i.test(k)&&v).map(([,v])=>v);
  const databaseEnv={...env};delete databaseEnv.GRIDLY_ARCHIVE_KEY;
  try {await writeArchive(databaseLines(archiveSql(from,to),databaseEnv),directory,{from,to,key,secrets});console.log('Encrypted Level 2 archive complete in owner-local/archives. Observe encrypted manifest deletion deadline.');}
  finally {key.fill(0);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Level 2 archive failed. INCOMPLETE output is unusable; no raw errors or connection details logged.');process.exitCode=1;});
