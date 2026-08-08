import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const REPORT_DIR='reports/lp1837';
export const ARTIFACT_ID='sha256:c292ce65fd06f5f3265be988fa3fa8d152dbb0309aaf306e799646dd34b56a7f';
export const PROJECT='gridly-preview', HOSTNAME='preview.gridlygo.com';
const AT='1970-01-01T00:00:00.000Z';
const SECRET=/(CLOUDFLARE_API_TOKEN["']?\s*[=:]|["']authorization["']\s*:|cookie["']?\s*:|bearer\s+\S+|access[_-]?token|refresh[_-]?token|session[_-]?token|api[_-]?key|otp["']?\s*[=:])/i;
const globalAuthorizationState={deployment:'NOT_AUTHORIZED',distribution:'NOT_AUTHORIZED',activation:'NOT_AUTHORIZED',publicLaunch:'NOT_AUTHORIZED',restore:'NOT_AUTHORIZED',rollback:'NOT_AUTHORIZED',automaticDeployment:'NOT_AUTHORIZED'};
const pending='NOT_RUN_OWNER_EXECUTION_NOT_CAPTURED';
const read=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
export function rejectSecrets(value){if(SECRET.test(JSON.stringify(value)))throw Error('Secret-shaped evidence rejected');return value;}
export function validateOwnerEvidence(e){
  rejectSecrets(e);
  if(e.ownerAuthorization!=='AUTHORIZE_ONE_PROTECTED_PREVIEW_EXECUTION')throw Error('exact execution authorization missing');
  if(e.projectName!==PROJECT||e.hostname!==HOSTNAME)throw Error('target outside LP183.7 scope');
  if(e.artifactIdentity!==ARTIFACT_ID||e.fileCount!==493||e.oversizedFileCount!==0)throw Error('artifact identity drift');
  if(e.preUploadDeploymentCount!==0||e.preUploadCustomDomainCount!==0)throw Error('project is not empty');
  if(e.uploadCount!==1)throw Error('exactly one upload required');
  if(!e.deploymentId||!e.deploymentUrl||e.deploymentBranch!=='preview'||e.deploymentArtifactReconciled!==true)throw Error('deployment reconciliation required');
  if(e.bindingAttempted&&e.bindingAuthorization!=='AUTHORIZE_PREVIEW_GRIDLYGO_COM_BINDING')throw Error('exact binding authorization missing');
  if(e.bindingAttempted&&(!e.accessPreserved||e.approvedUserResult!=='ALLOW'||e.anonymousResult!=='DENY'||!['DENY','DENY_BEFORE_OTP'].includes(e.nonApprovedUserResult)))throw Error('Access validation failed');
  if(e.bindingAttempted&&e.productionIsolation!=='PASS')throw Error('production isolation failed');
  if(e.gitIntegration!==false||e.automaticDeployment!==false||e.projectDeletionAuthorized!==false)throw Error('closed authorization changed');
  return e;
}
function blocked(root){
  const artifact=read(root,'reports/lp1831/deployable-artifact-manifest.json');
  const montgomery=read(root,'reports/lp1833/montgomery-package-manifest.json');
  return {ownerAuthorization:'NOT_CAPTURED',authenticated:false,repositoryCommit:null,artifactIdentity:artifact.artifactIdentity,fileCount:artifact.fileCount,totalBytes:artifact.totalBytes,oversizedFileCount:artifact.files.filter(x=>x.bytes>=25*1024*1024).length,montgomery:{path:montgomery.path,bytes:montgomery.bytes,sha256:montgomery.sha256},projectName:PROJECT,hostname:HOSTNAME,preUploadDeploymentCount:null,preUploadCustomDomainCount:null,wranglerVersion:null,uploadCount:0,deploymentId:null,deploymentUrl:null,deploymentBranch:null,deploymentArtifactReconciled:false,defaultPagesDevExposure:'NOT_CREATED',bindingAuthorization:'NOT_CAPTURED',bindingAttempted:false,customDomainState:'NOT_BOUND',dnsState:'UNCHANGED',certificateState:'NOT_REQUESTED',accessPreserved:null,approvedUserResult:pending,anonymousResult:pending,nonApprovedUserResult:pending,physicalDeviceValidation:pending,productionIsolation:pending,withdrawalOccurred:false,withdrawalResult:'NOT_REQUIRED',tokenRemoved:null,tokenRevoked:null,gitIntegration:false,automaticDeployment:false,projectDeletionAuthorized:false,protectedRuntimeNativeDiff:'EMPTY',secretSafety:'PASS_NO_SECRET_SHAPED_MATERIAL'};
}
export function build(root=ROOT){
  let state=blocked(root), captured=false;
  const local=path.join(root,'evidence/lp1837/owner-execution-evidence.local.json');
  if(fs.existsSync(local)){state=validateOwnerEvidence(read(root,'evidence/lp1837/owner-execution-evidence.local.json'));captured=true;}
  const common={milestone:'LP183.7',generatedAt:AT,evidenceSource:captured?'OWNER_LOCAL_SAFE_SUMMARY':'NONE_FAIL_CLOSED'};
  const pre={schemaVersion:'gridly.lp1837.preExecutionReconciliation.v1',...common,ownerAuthorization:state.ownerAuthorization,authenticated:state.authenticated,repositoryCommit:state.repositoryCommit,artifactIdentity:state.artifactIdentity,fileCount:state.fileCount,totalBytes:state.totalBytes,oversizedFileCount:state.oversizedFileCount,montgomery:state.montgomery,projectName:state.projectName,preUploadDeploymentCount:state.preUploadDeploymentCount,preUploadCustomDomainCount:state.preUploadCustomDomainCount,protectedRuntimeNativeDiff:state.protectedRuntimeNativeDiff};
  const deployment={schemaVersion:'gridly.lp1837.deploymentEvidence.v1',...common,wranglerVersion:state.wranglerVersion,projectName:state.projectName,uploadCommandClass:'WRANGLER_PAGES_DIRECT_UPLOAD',uploadCount:state.uploadCount,deploymentId:state.deploymentId,deploymentUrl:state.deploymentUrl,branch:state.deploymentBranch,defaultPagesDevExposure:state.defaultPagesDevExposure};
  const reconciliation={schemaVersion:'gridly.lp1837.deploymentArtifactReconciliation.v1',...common,artifactIdentity:state.artifactIdentity,repositoryCommit:state.repositoryCommit,deploymentId:state.deploymentId,deploymentUrl:state.deploymentUrl,reconciled:state.deploymentArtifactReconciled};
  const domain={schemaVersion:'gridly.lp1837.customDomainEvidence.v1',...common,hostname:state.hostname,bindingAuthorization:state.bindingAuthorization,bindingAttempted:state.bindingAttempted,state:state.customDomainState,dnsState:state.dnsState,certificateState:state.certificateState};
  const access={schemaVersion:'gridly.lp1837.accessValidation.v1',...common,application:'preview',hostname:HOSTNAME,policy:'Gridly Preview Approved Testers',preserved:state.accessPreserved,approvedUser:state.approvedUserResult,anonymous:state.anonymousResult,authenticatedNonApprovedUser:state.nonApprovedUserResult};
  const physical={schemaVersion:'gridly.lp1837.physicalDeviceValidation.v1',...common,result:state.physicalDeviceValidation};
  const production={schemaVersion:'gridly.lp1837.productionIsolation.v1',...common,result:state.productionIsolation,automaticDeployment:false,gitIntegration:false};
  const withdrawal={schemaVersion:'gridly.lp1837.previewWithdrawalEvidence.v1',...common,occurred:state.withdrawalOccurred,result:state.withdrawalResult,scope:'ONLY_PREVIEW_GRIDLYGO_COM_DNS_AND_PAGES_CUSTOM_DOMAIN',deploymentRetained:true,projectDeletionAuthorized:false};
  const success=state.bindingAttempted&&state.accessPreserved&&state.approvedUserResult==='ALLOW'&&state.anonymousResult==='DENY'&&['DENY','DENY_BEFORE_OTP'].includes(state.nonApprovedUserResult)&&state.physicalDeviceValidation==='PASS'&&state.productionIsolation==='PASS';
  const partial=state.uploadCount===1&&state.deploymentArtifactReconciled&&!state.bindingAttempted;
  const classification=success?'PROTECTED_PREVIEW_DEPLOYED_ACCESS_VALIDATED_OWNER_TESTING_ACTIVE':partial?'PROTECTED_PREVIEW_DEPLOYED_DOMAIN_BINDING_PENDING_OWNER_CONFIRMATION':state.withdrawalOccurred?'PROTECTED_PREVIEW_WITHDRAWN_AFTER_ABORT':'PROTECTED_PREVIEW_EXECUTION_BLOCKED_PRECONDITION_FAILED';
  const summary={schemaVersion:'gridly.lp1837.summary.v1',...common,classification,...state,globalAuthorizationState,publicLaunch:'NOT_AUTHORIZED'};
  return {pre,deployment,reconciliation,domain,access,physical,production,withdrawal,summary};
}
const REPORTS={'pre-execution-reconciliation.json':'pre','deployment-evidence.json':'deployment','deployment-artifact-reconciliation.json':'reconciliation','custom-domain-evidence.json':'domain','access-validation.json':'access','physical-device-validation.json':'physical','production-isolation.json':'production','preview-withdrawal-evidence.json':'withdrawal','lp1837-summary.json':'summary'};
export function writeReports(out=path.join(ROOT,REPORT_DIR),root=ROOT){const made=build(root);fs.mkdirSync(out,{recursive:true});for(const [f,k] of Object.entries(REPORTS))fs.writeFileSync(path.join(out,f),JSON.stringify(made[k],null,2)+'\n');return made;}
export function verify(root=ROOT){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lp1837-'));try{for(const d of ['a','b'])writeReports(path.join(tmp,d),root);for(const f of Object.keys(REPORTS)){const expected=fs.readFileSync(path.join(root,REPORT_DIR,f));for(const d of ['a','b'])if(!expected.equals(fs.readFileSync(path.join(tmp,d,f))))throw Error(`LP183.7 report drift: ${f}`);}return true;}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv[2]||'build';if(mode==='build')writeReports();else if(mode==='verify')verify();else throw Error('unknown mode');console.log(`LP183.7 ${mode} PASS; external execution state is fail-closed unless owner evidence exists.`);}
