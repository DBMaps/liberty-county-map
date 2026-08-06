import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = 'b61bf18481ecda858d2146345fff566ab6331e31';
export const REPORT_NAMES = ['operational-readiness-summary.json','monitoring-readiness.json','backup-readiness.json','restoration-readiness.json','rollback-readiness.json','incident-response-readiness.json','owner-evidence-requirements.json','operational-blockers.json','protected-artifact-verification.json'];
export const PROTECTED = ['js/app.js', ...[162,163,164,165,166,167,168,169].map(n => `reports/lp${n}`)];
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const encode = value => `${JSON.stringify(stable(value), null, 2)}\n`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const common = { milestone:'LP170', boundary:'READ_ONLY_OPERATIONAL_EVIDENCE_AUDIT', generatedAt:'NOT_RECORDED_DETERMINISTIC' };
const secretPattern = /(?:eyJ[A-Za-z0-9_-]{20,}\.|sb_(?:secret|service)_|(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+[A-Za-z0-9._~+\/-]{8,}|authorization\s*:|(?:refresh|access)[_-]?token\s*[:=]|(?:api[_-]?key|password|service[_-]?role)\s*[:=]|cookie\s*:)/i;
const allowed = new Set(['PASS','PARTIAL_EVIDENCE','OWNER_ACTION_REQUIRED','SOURCE_UNAVAILABLE','NOT_CONFIGURED','NOT_TESTED','NOT_READY','NOT_APPLICABLE']);

export function validateEvidence(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.records)) throw new Error('LP170 owner evidence schema is invalid');
  if (secretPattern.test(JSON.stringify(value))) throw new Error('LP170 owner evidence resembles secret material');
  const keys = new Set(['identifier','classification','sourceSystem','method','readOnly','metadataOnly','attestation']);
  const seen = new Set();
  for (const record of value.records) {
    if (!record || Object.keys(record).some(k => !keys.has(k)) || !/^[A-Z0-9_.:-]+$/.test(record.identifier || '') || !allowed.has(record.classification) || record.readOnly !== true || record.metadataOnly !== true || seen.has(record.identifier)) throw new Error('LP170 owner evidence record is invalid');
    seen.add(record.identifier);
  }
  return value;
}
export const evidenceIdentity = records => sha(encode([...records].sort((a,b)=>a.identifier.localeCompare(b.identifier))));
function loadEvidence(root) { const p=path.join(root,'evidence/lp170/owner-evidence.json'); return fs.existsSync(p)?validateEvidence(JSON.parse(fs.readFileSync(p,'utf8'))):null; }
const get = (map,id) => map.get(id)?.classification || 'SOURCE_UNAVAILABLE';
const complete = values => values.every(x=>x==='PASS') ? 'PASS' : values.some(x=>x==='PASS'||x==='PARTIAL_EVIDENCE') ? 'PARTIAL_EVIDENCE' : values.some(x=>x==='OWNER_ACTION_REQUIRED') ? 'OWNER_ACTION_REQUIRED' : 'SOURCE_UNAVAILABLE';
const dimensions=['signalExists','signalAccessible','ownerAssigned','alertThreshold','alertDestination','responseProcedure','behaviorValidated'];
const signals=['APPLICATION_AVAILABILITY','SEARCH_FAILURES','ROUTING_PROVIDER_FAILURES','EDGE_FUNCTION_FAILURES','SUPABASE_FAILURES','STORAGE_FAILURES','INCIDENT_INGESTION_FAILURES','REPORT_SUBMISSION_FAILURES','UNEXPECTED_AUTHENTICATION_FAILURES','CRITICAL_CLIENT_ERRORS','DEPLOYMENT_FAILURES'];

export function build(root=ROOT, supplied=null) {
  const evidence=supplied ? validateEvidence(supplied) : loadEvidence(root); const map=new Map((evidence?.records||[]).map(r=>[r.identifier,r]));
  const monitoringSignals=signals.map(identifier=>{const checks=Object.fromEntries(dimensions.map(d=>[d,get(map,`MONITORING:${identifier}:${d.toUpperCase()}`)])); return {identifier,checks,classification:complete(Object.values(checks))};});
  const backupChecks={configured:get(map,'BACKUP:CONFIGURED'),frequency:get(map,'BACKUP:FREQUENCY'),retention:get(map,'BACKUP:RETENTION'),pointInTimeRecovery:get(map,'BACKUP:PITR'),latestSuccessfulBackup:get(map,'BACKUP:LATEST_SUCCESS'),ownerAssigned:get(map,'BACKUP:OWNER')};
  const restorationChecks={prerequisitesDocumented:get(map,'RESTORE:PREREQUISITES'),ownerAssigned:get(map,'RESTORE:OWNER'),procedureDocumented:get(map,'RESTORE:PROCEDURE'),validationDefined:get(map,'RESTORE:VALIDATION'),productionRehearsal:get(map,'RESTORE:REHEARSAL')};
  const rollbackAreas=['APPLICATION_RUNTIME','GITHUB_RELEASE','DEPLOYMENT_ARTIFACT','SUPABASE_EDGE_FUNCTION','CONFIGURATION','DATA_SCHEMA','COUNTY_ACTIVATION','PUBLIC_LAUNCH'];
  const rollback=rollbackAreas.map(identifier=>{const checks={priorReleaseIdentifiable:get(map,`ROLLBACK:${identifier}:PRIOR_RELEASE`),artifactIdentityPreserved:get(map,`ROLLBACK:${identifier}:ARTIFACT_IDENTITY`),processDocumented:get(map,`ROLLBACK:${identifier}:PROCESS`),ownerAssigned:get(map,`ROLLBACK:${identifier}:OWNER`),validationDefined:get(map,`ROLLBACK:${identifier}:VALIDATION`),rehearsed:get(map,`ROLLBACK:${identifier}:REHEARSAL`)};return {identifier,checks,classification:complete(Object.values(checks))};});
  const incidentItems=['PRIMARY_OWNER','BACKUP_OWNER','SUPPORT_CONTACT','SEVERITY_LEVELS','INITIAL_TRIAGE','SERVICE_CONTAINMENT','ROLLBACK_DECISION','USER_COMMUNICATION','EVIDENCE_PRESERVATION','POST_INCIDENT_REVIEW','ESCALATION_PATH'].map(identifier=>({identifier,classification:get(map,`INCIDENT:${identifier}`)}));
  const monitorStatus=complete(monitoringSignals.map(x=>x.classification)); const backupStatus=complete(Object.values(backupChecks)); const restorationStatus=restorationChecks.productionRehearsal==='PASS'&&Object.values(restorationChecks).every(x=>x==='PASS')?'PASS':restorationChecks.productionRehearsal==='PASS'?'PARTIAL_EVIDENCE':Object.values(restorationChecks).some(x=>x==='PASS')?'NOT_TESTED':'OWNER_ACTION_REQUIRED';
  const rollbackStatus=complete(rollback.map(x=>x.classification)); const incidentStatus=incidentItems.every(x=>x.classification==='PASS')?'PASS':'OWNER_ACTION_REQUIRED';
  const files=execFileSync('git',['ls-tree','-r','--name-only',BASELINE],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(p=>PROTECTED.some(prefix=>p===prefix||p.startsWith(`${prefix}/`))).sort();
  const protectedArtifacts=files.map(file=>{const options={cwd:root,maxBuffer:128*1024*1024};const baseline=execFileSync('git',['show',`${BASELINE}:${file}`],options); const current=execFileSync('git',['show',`HEAD:${file}`],options); return {path:file,baselineSha256:sha(baseline),currentSha256:sha(current),identitySource:'GIT_BLOB',classification:sha(baseline)===sha(current)?'PASS':'NOT_READY'};});
  const statuses={monitoring:monitorStatus,backup:backupStatus,restoration:restorationStatus,rollback:rollbackStatus,incidentResponse:incidentStatus};
  const blockers=Object.entries(statuses).filter(([,v])=>v!=='PASS').map(([area,classification],i)=>({id:`LP170-B${String(i+1).padStart(3,'0')}`,area,classification,remediation:'Capture complete read-only owner evidence and reassess; do not perform a production operation.'}));
  return {
    'operational-readiness-summary.json':{...common,overallClassification:Object.values(statuses).every(x=>x==='PASS')?'PASS':'NOT_READY',findings:statuses,authorization:{activation:'NOT_AUTHORIZED',deployment:'NOT_AUTHORIZED',distribution:'NOT_AUTHORIZED',publicLaunch:'NOT_AUTHORIZED'},operationsPerformed:{deployments:0,restores:0,rollbacks:0,productionMutations:0,workflowTriggers:0},futureLp167ReassessmentOnly:true},
    'monitoring-readiness.json':{...common,classification:monitorStatus,principle:'LOG_PRESENCE_ALONE_DOES_NOT_CERTIFY_ALERTING',requiredSignals:monitoringSignals,serviceHealth:{supabaseProject:get(map,'HEALTH:SUPABASE_PROJECT'),database:get(map,'HEALTH:DATABASE'),storage:get(map,'HEALTH:STORAGE'),edgeFunctions:get(map,'HEALTH:EDGE_FUNCTIONS'),githubDeployments:get(map,'HEALTH:GITHUB_DEPLOYMENTS')}},
    'backup-readiness.json':{...common,classification:backupStatus,checks:backupChecks,configuredBackupDoesNotCertifyRestoration:true,productionRestoreExecuted:false},
    'restoration-readiness.json':{...common,classification:restorationStatus,checks:restorationChecks,productionRestorationRemainsUntested:restorationChecks.productionRehearsal!=='PASS',productionRestoreExecuted:false},
    'rollback-readiness.json':{...common,classification:rollbackStatus,areas:rollback,documentationAloneDoesNotCertifyRehearsal:true,productionRollbackExecuted:false,dataSchemaBoundary:'NO_DATA_OR_SCHEMA_ROLLBACK_AUTHORIZED'},
    'incident-response-readiness.json':{...common,classification:incidentStatus,unknownContactsRemainOwnerActionRequired:true,items:incidentItems},
    'owner-evidence-requirements.json':{...common,classification:evidence?'PARTIAL_EVIDENCE':'OWNER_ACTION_REQUIRED',workflow:'npm run capture:lp170:owner-evidence -- -Repository <owner/repo> -ProjectRef <ref>',requirements:['MONITORING_SIGNAL_DIMENSIONS','SUPABASE_SERVICE_HEALTH','BACKUP_PLAN_AND_LATEST_SUCCESS','RESTORE_OWNERSHIP_AND_REHEARSAL','ROLLBACK_ARTIFACTS_OWNERSHIP_AND_REHEARSAL','INCIDENT_CONTACTS_AND_ESCALATION'],captureRules:{readOnly:true,metadataOnly:true,secretValuesAllowed:false,atomic:true,windowsPowerShellVersion:'5.1'}},
    'operational-blockers.json':{...common,classification:blockers.length?'NOT_READY':'PASS',blockers},
    'protected-artifact-verification.json':{...common,classification:protectedArtifacts.every(x=>x.classification==='PASS')?'PASS':'NOT_READY',algorithm:'SHA-256',identitySource:'CANONICAL_GIT_BLOB',baselineCommit:BASELINE,artifacts:protectedArtifacts}
  };
}
export function writeReports(output,pathRoot=ROOT,evidence=null){const reports=build(pathRoot,evidence);fs.mkdirSync(output,{recursive:true});for(const name of REPORT_NAMES)fs.writeFileSync(path.join(output,name),encode(reports[name]));return reports;}
export function verify(root=ROOT){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lp170-'));try{const a=path.join(tmp,'a'),b=path.join(tmp,'b');writeReports(a,root);writeReports(b,root);for(const name of REPORT_NAMES){const x=fs.readFileSync(path.join(a,name)),y=fs.readFileSync(path.join(b,name)),g=fs.readFileSync(path.join(root,'reports/lp170',name));if(!x.equals(y)||!x.equals(g)||x[0]===0xef||x.includes(13))throw new Error(`LP170 report drift: ${name}`);}}finally{fs.rmSync(tmp,{recursive:true,force:true});}return true;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv[2]||'audit';if(mode==='verify'){verify();console.log('LP170 deterministic verification: PASS');}else{const r=writeReports(path.join(ROOT,'reports/lp170'));console.log(`LP170 ${mode}: ${r['operational-readiness-summary.json'].overallClassification}`);}}
