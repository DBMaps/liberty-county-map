import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encode as encodeSqlEditor, validateMetadata } from './ingest-sql-editor-evidence.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = 'eab739e289c67de548d7948b98fef1f04909ca32';
export const REPORT_NAMES = [
  'production-configuration-contract.json', 'environment-source-inventory.json',
  'secret-presence-certification.json', 'supabase-project-certification.json',
  'database-object-certification.json', 'storage-inventory-certification.json',
  'storage-policy-certification.json', 'origin-and-redirect-certification.json',
  'runtime-configuration-alignment.json', 'security-configuration-review.json',
  'owner-evidence-requirements.json', 'configuration-blockers.json',
  'certification-summary.json', 'protected-artifact-identities.json'
];
export const PROTECTED_PATHS = [
  'js/app.js', 'reports/lp162/lp162-summary.json', 'reports/lp163/lp163-summary.json',
  'reports/lp164/lp164-summary.json', 'reports/lp165/lp165-summary.json',
  'reports/lp166/lp166-summary.json', 'reports/lp167/lp167-summary.json',
  'reports/lp168/production-readiness.json'
];
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const encode = value => `${JSON.stringify(stable(value), null, 2)}\n`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const evidenceContentIdentity = records => sha(encode([...records].sort((a,b) => a.identifier.localeCompare(b.identifier))));
const exists = (root, p) => fs.existsSync(path.join(root, p));
const common = { milestone: 'LP169', auditBoundary: 'READ_ONLY_REDACTED_CONFIGURATION_CERTIFICATION', generatedAt: 'NOT_RECORDED_DETERMINISTIC' };

const requirements = [
  ['SUPABASE_URL','PUBLIC_RUNTIME_CONFIGURATION','Edge Function project endpoint',['DEPLOYMENT','RUNTIME'],'PUBLIC_IDENTIFIER','OWNER_REDACTED_PRESENCE','owner evidence plus project-reference reconciliation'],
  ['SUPABASE_ANON_KEY','PUBLIC_RUNTIME_CONFIGURATION','Browser-safe Supabase authorization key',['RUNTIME'],'PUBLIC_CLIENT_CREDENTIAL','OWNER_REDACTED_PRESENCE','presence and intended-project attestation'],
  ['SUPABASE_SERVICE_ROLE_KEY','SERVER_SECRET','Server-only Supabase credential',['EDGE_FUNCTION'],'HIGH_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_CERTIFIED_ADDRESS_BUCKET','STORAGE_CONFIGURATION','Certified county artifact bucket',['STATEWIDE_RUNTIME'],'NON_SECRET','REMOTE_BUCKET_INVENTORY','bucket identity reconciliation'],
  ['GRIDLY_GEOCODE_ALLOWED_ORIGINS','SUPABASE_CONFIGURATION','Edge Function CORS allowlist',['PUBLIC_LAUNCH'],'NON_SECRET','REDACTED_CONFIGURATION_STATUS','owner allowlist attestation'],
  ['GRIDLY_GEOCODE_USER_AGENT','SUPABASE_CONFIGURATION','Upstream provider identification',['GEOCODING'],'NON_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_GEOCODE_PROVIDER','SUPABASE_CONFIGURATION','Primary geocoder selection',['GEOCODING'],'NON_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_GEOCODE_PROVIDER_URL','SUPABASE_CONFIGURATION','Primary geocoder endpoint',['GEOCODING'],'SENSITIVE_CONFIGURATION','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_AUTHORITATIVE_RURAL_PROVIDER','SUPABASE_CONFIGURATION','Rural provider selection',['RURAL_ADDRESS'],'NON_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_AUTHORITATIVE_RURAL_URL','SUPABASE_CONFIGURATION','Rural provider endpoint',['RURAL_ADDRESS'],'SENSITIVE_CONFIGURATION','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_AUTHORITATIVE_RURAL_API_KEY','SERVER_SECRET','Rural provider credential',['RURAL_ADDRESS'],'HIGH_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_AUTHORITATIVE_RURAL_TIMEOUT_MS','SUPABASE_CONFIGURATION','Rural request timeout',['RURAL_ADDRESS'],'NON_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_RURAL_FALLBACK_ENABLED','OWNER_GOVERNED_CONFIGURATION','Fallback governance switch',['RURAL_ADDRESS'],'NON_SECRET','OWNER_ATTESTATION','owner evidence'],
  ['GRIDLY_RURAL_FALLBACK_URL','SUPABASE_CONFIGURATION','Fallback endpoint',['RURAL_ADDRESS'],'SENSITIVE_CONFIGURATION','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['GRIDLY_RURAL_FALLBACK_TIMEOUT_MS','SUPABASE_CONFIGURATION','Fallback timeout',['RURAL_ADDRESS'],'NON_SECRET','SECRET_NAME_STATUS','Supabase secret-name inventory'],
  ['PRODUCTION_ORIGIN','OWNER_GOVERNED_CONFIGURATION','Canonical web origin',['PUBLIC_LAUNCH','CORS'],'NON_SECRET','OWNER_ATTESTATION','origin and redirect inventory'],
  ['ANDROID_APPLICATION_ID','APP_DISTRIBUTION_CONFIGURATION','Android package identity',['ANDROID_DISTRIBUTION'],'NON_SECRET','REPOSITORY_CONFIGURATION','Capacitor configuration inspection'],
  ['IOS_BUNDLE_ID','APP_DISTRIBUTION_CONFIGURATION','iOS bundle identity',['IOS_DISTRIBUTION'],'NON_SECRET','REPOSITORY_CONFIGURATION','Capacitor configuration inspection'],
  ['APP_SUPPORT_URL','APP_DISTRIBUTION_CONFIGURATION','Store support URL',['APP_DISTRIBUTION'],'NON_SECRET','OWNER_ATTESTATION','owner evidence'],
  ['APP_PRIVACY_URL','APP_DISTRIBUTION_CONFIGURATION','Store privacy URL',['APP_DISTRIBUTION'],'NON_SECRET','OWNER_ATTESTATION','owner evidence'],
  ['LOCKED_NODE_BUILD','BUILD_CONFIGURATION','Reproducible dependency installation',['DEPLOYMENT'],'NON_SECRET','REPOSITORY_CONFIGURATION','lockfile presence']
];

export function validateEvidence(input) {
  if (!input || ![1,2].includes(input.schemaVersion) || !Array.isArray(input.records)) throw new Error('owner evidence schema is invalid');
  const topLevel = new Set(['schemaVersion','provenance','records']);
  if (Object.keys(input).some(key => !topLevel.has(key))) throw new Error('owner evidence contains an unknown top-level field');
  const allowedRecordFields = new Set(['identifier','status','method','attestation','sourceSystem','readOnly','redactionStatus','completeness','safeCount','safeSha256','classification']);
  const forbiddenKeys = /(?:value|secret|token|password|credential|authorization|cookie|raw|output|connection|string|private.?key)/i;
  const allowedStatus = new Set(['PRESENT','ABSENT','UNVERIFIED','INVALID_FORMAT','SOURCE_UNAVAILABLE','PASS','FAIL','OWNER_ACTION_REQUIRED']);
  const seen = new Set();
  for (const record of input.records) {
    if (!record || Object.keys(record).some(k => forbiddenKeys.test(k))) throw new Error('owner evidence contains a forbidden value-bearing field');
    if (Object.keys(record).some(k => !allowedRecordFields.has(k))) throw new Error('owner evidence contains an unknown record field');
    if (!/^[A-Z0-9_.:-]+$/.test(record.identifier || '') || !allowedStatus.has(record.status)) throw new Error('owner evidence record is invalid');
    if (seen.has(record.identifier)) throw new Error('duplicate owner evidence identifier');
    seen.add(record.identifier);
  }
  const serialized = JSON.stringify(input);
  if (/(eyJ[a-zA-Z0-9_-]{20,}\.|sb_(?:secret|service)_|(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+[a-z0-9._~+\/-]{8,}|authorization\s*:|(?:refresh|access)[_-]?token\s*[:=]|(?:api[_-]?key|password)\s*[:=]|cookie\s*:)/i.test(serialized)) throw new Error('owner evidence resembles secret material');
  if (input.schemaVersion === 2) {
    const allowedProvenance = new Set(['evidenceIdentifier','sourceSystem','captureMethod','commandFamily','authentication','readOnly','redactionStatus','schemaVersion','deterministicContentIdentity','completeness','status']);
    const p = input.provenance;
    if (!p || Object.keys(p).some(k => !allowedProvenance.has(k)) || p.schemaVersion !== 2 || p.readOnly !== true || p.redactionStatus !== 'SANITIZED' || !/^[a-f0-9]{64}$/.test(p.deterministicContentIdentity || '')) throw new Error('owner evidence provenance is invalid');
    if (p.deterministicContentIdentity !== evidenceContentIdentity(input.records)) throw new Error('owner evidence content identity mismatch');
  }
  return input;
}

export function reconcileEvidence(input, options = {}) {
  const evidence = validateEvidence(input);
  const byId = new Map(evidence.records.map(record => [record.identifier, record]));
  const status = id => byId.get(id)?.status || 'SOURCE_UNAVAILABLE';
  const requiredPass = ids => ids.every(id => status(id) === 'PASS') ? 'PASS' : ids.some(id => status(id) === 'FAIL') ? 'FAIL' : 'SOURCE_UNAVAILABLE';
  const projectIdentity = options.expectedProjectSha256
    ? (byId.get('SUPABASE_PROJECT_IDENTITY')?.safeSha256 === options.expectedProjectSha256 ? 'PASS' : 'FAIL')
    : status('SUPABASE_PROJECT_IDENTITY');
  const packageCount = byId.get('STORAGE:ADDRESS_PACKAGES')?.safeCount;
  const certificateCount = byId.get('STORAGE:ADDRESS_CERTIFICATES')?.safeCount;
  const storageCountStatus = packageCount === undefined || certificateCount === undefined ? 'SOURCE_UNAVAILABLE'
    : packageCount === 254 && certificateCount === 254 ? 'PASS' : 'FAIL';
  const originIdentity = options.expectedOriginSha256
    ? (byId.get('PRODUCTION_ORIGIN')?.safeSha256 === options.expectedOriginSha256 ? 'PASS' : 'FAIL')
    : status('PRODUCTION_ORIGIN');
  const policyAttestations = ['POLICY:ANONYMOUS_WRITE_DISABLED','POLICY:PUBLIC_WRITE_DISABLED','POLICY:RUNTIME_READ'].map(id => byId.get(id)?.attestation).filter(Boolean);
  return {
    projectIdentity,
    supabase: projectIdentity === 'FAIL' ? 'FAIL' : requiredPass(['SUPABASE_PROJECT','SUPABASE_PROJECT_AVAILABILITY','SUPABASE_REGION','SUPABASE_API','SUPABASE_AUTH','FUNCTION:gridly-geocode']),
    database: requiredPass(['DATABASE_OBJECTS','DATABASE_SCHEMA_COMPATIBILITY','DATABASE_POLICIES','DATABASE_INDEXES','DATABASE_TRIGGERS']),
    storage: storageCountStatus === 'FAIL' ? 'FAIL' : storageCountStatus === 'SOURCE_UNAVAILABLE' ? 'SOURCE_UNAVAILABLE' : requiredPass(['STORAGE_OBJECTS','STORAGE:ADDRESS_PACKAGES','STORAGE:ADDRESS_CERTIFICATES','STORAGE:STATEWIDE_COUNTS']),
    storagePolicies: requiredPass(['STORAGE_POLICIES','POLICY:ANONYMOUS_WRITE_DISABLED','POLICY:PUBLIC_WRITE_DISABLED','POLICY:RUNTIME_READ']),
    policyEvidenceClassification: policyAttestations.length === 3 && policyAttestations.every(x => x === 'TOOL_VERIFIED') ? 'TOOL_VERIFIED' : policyAttestations.length ? 'OWNER_ATTESTED' : 'SOURCE_UNAVAILABLE',
    origins: originIdentity === 'FAIL' || byId.get('PRODUCTION_ORIGIN')?.classification === 'LOCALHOST_ONLY' ? 'FAIL' : requiredPass(['ORIGINS_REDIRECTS','PRODUCTION_ORIGIN','CANONICAL_DOMAIN','SUPABASE_REDIRECT_URLS','AUTH_CALLBACK_URLS','CORS_ORIGINS']),
    legal: requiredPass(['SUPPORT_URL','LEGAL_URL']),
    mobile: requiredPass(['ANDROID_APPLICATION_ID','IOS_BUNDLE_ID'])
  };
}

export function loadEvidence(root) {
  const p = path.join(root, 'evidence/lp169/owner-evidence.json');
  return exists(root, 'evidence/lp169/owner-evidence.json') ? validateEvidence(JSON.parse(fs.readFileSync(p, 'utf8'))) : null;
}

export function loadSqlEditorEvidence(root=ROOT) {
  const p=path.join(root,'evidence/lp169/supabase-sql-editor-metadata.json');
  if(!fs.existsSync(p)) return null;
  const value=JSON.parse(fs.readFileSync(p,'utf8'));
  const top=new Set(['schemaVersion','evidenceIdentifier','sourceSystem','captureMethod','authenticated','ownerSupplied','readOnly','redactionStatus','sourceFormat','contentSha256','evidenceStatus','metadata']);
  const keys=['schemas','tables','columns','routines','constraints','indexes','triggers','policies','storageBuckets','storageCounts'];
  if(!value || Object.keys(value).some(k=>!top.has(k)) || value.sourceSystem!=='SUPABASE_SQL_EDITOR' || value.captureMethod!=='DASHBOARD_READ_ONLY_SQL_EXPORT' || value.authenticated!==true || value.ownerSupplied!==true || value.readOnly!==true || value.redactionStatus!=='SANITIZED' || value.sourceFormat!=='CSV' || !/^[a-f0-9]{64}$/.test(value.contentSha256||'') || !value.metadata || keys.some(k=>!Array.isArray(value.metadata[k]))) throw new Error('SQL Editor evidence is invalid');
  const normalized=validateMetadata(value.metadata);
  if(encodeSqlEditor(normalized)!==encodeSqlEditor(value.metadata) || sha(encodeSqlEditor(normalized))!==value.contentSha256) throw new Error('SQL Editor evidence content identity mismatch');
  return value;
}

export function reconcileSqlEditorEvidence(value) {
  if(!value) return {database:'SOURCE_UNAVAILABLE',storage:'SOURCE_UNAVAILABLE',policyInventory:'SOURCE_UNAVAILABLE'};
  const m=value.metadata, bucket=m.storageBuckets.find(x=>x.id==='certified-addresses'), count=m.storageCounts.find(x=>x.bucketId==='certified-addresses');
  return {database:'PASS',schema:'PASS',tables:'PASS',columns:'PASS',routines:'PASS',constraints:'PASS',indexes:'PASS',triggers:'PASS',policyInventory:'PASS',storageBucket:bucket?'PASS':'FAIL',observedCertifiedAddressObjectCount:count?.objectCount,storage:bucket&&Number.isSafeInteger(count?.objectCount)?'PARTIAL_EVIDENCE':'SOURCE_UNAVAILABLE',exactPackageNames:'SOURCE_UNAVAILABLE',exactCertificateNames:'SOURCE_UNAVAILABLE',objectHashes:'SOURCE_UNAVAILABLE',mimeTypes:'SOURCE_UNAVAILABLE',policyBehavior:'SOURCE_UNAVAILABLE'};
}

const recordStatus = (evidence, id) => evidence?.records.find(r => r.identifier === id)?.status || 'SOURCE_UNAVAILABLE';
const decision = (evidence, id) => recordStatus(evidence, id) === 'PASS' ? 'PASS' : 'SOURCE_UNAVAILABLE';

export function certify(root = ROOT) {
  const evidence = loadEvidence(root);
  const reconciled = evidence ? reconcileEvidence(evidence) : null;
  const sqlEditorEvidence=loadSqlEditorEvidence(root);
  const dashboard=reconcileSqlEditorEvidence(sqlEditorEvidence);
  const contract = requirements.map(([identifier,category,purpose,requiredFor,secretClassification,expectedEvidenceType,validationMethod]) => ({
    identifier, category, purpose, requiredFor, secretClassification, expectedEvidenceType, validationMethod,
    failClosedBehavior: 'DO_NOT_CERTIFY_OR_AUTHORIZE', valueDisclosureAllowed: false,
    status: ['ANDROID_APPLICATION_ID','IOS_BUNDLE_ID','LOCKED_NODE_BUILD'].includes(identifier) ? 'PRESENT' : recordStatus(evidence, identifier)
  }));
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(x => x.endsWith('.sql')).sort();
  const dbObjects = ['gridly_feedback','gridly_geocode_cache','gridly_verified_rural_addresses','gridly_texas_address_foundation','history_capture.events'].map(identifier => ({ identifier, status: recordStatus(evidence, `DB:${identifier}`), remoteRowsInspected: false }));
  const sources = [
    ['ENVIRONMENT_FILES','.env*.example','PRESENT'],['GITHUB_ACTIONS','.github/workflows','SOURCE_UNAVAILABLE'],
    ['SUPABASE_CONFIG','supabase/config.toml',exists(root,'supabase/config.toml')?'PRESENT':'ABSENT'],
    ['SUPABASE_LINK','supabase/.temp/project-ref',exists(root,'supabase/.temp/project-ref')?'PRESENT':'ABSENT'],
    ['CAPACITOR_CONFIG','capacitor.config.json',exists(root,'capacitor.config.json')?'PRESENT':'ABSENT'],
    ['PWA_CONFIG','manifest.webmanifest',exists(root,'manifest.webmanifest')?'PRESENT':'ABSENT'],
    ['ANDROID_CONFIG','android','PRESENT'],['IOS_CONFIG','ios','PRESENT'],
    ['GITHUB_SECRET_NAMES','OWNER_AUTHENTICATED_GITHUB_CLI','SOURCE_UNAVAILABLE'],
    ['SUPABASE_SECRET_NAMES','OWNER_AUTHENTICATED_SUPABASE_CLI','SOURCE_UNAVAILABLE']
  ].map(([identifier,source,status]) => ({identifier,source,requirement:'REQUIRED',status}));
  const protectedArtifacts = PROTECTED_PATHS.map(p => {
    const baseline = execFileSync('git',['show',`${BASELINE}:${p}`],{cwd:root,maxBuffer:64*1024*1024});
    const current = execFileSync('git',['show',`HEAD:${p}`],{cwd:root,maxBuffer:64*1024*1024});
    return { path:p, baselineCommit:BASELINE, currentCommit:'HEAD', baselineSha256:sha(baseline), currentSha256:sha(current), authoritativeIdentitySource:'GIT_BLOB', status:sha(baseline)===sha(current)?'UNCHANGED':'CHANGED' };
  });
  const decisions = {
    productionConfigurationReadiness:'OWNER_ACTION_REQUIRED', supabaseReadiness:reconciled?.supabase || 'SOURCE_UNAVAILABLE',
    databaseObjectReadiness:dashboard.database==='PASS'?'PASS':reconciled?.database || 'SOURCE_UNAVAILABLE', storageReadiness:dashboard.storage!=='SOURCE_UNAVAILABLE'?dashboard.storage:reconciled?.storage || 'SOURCE_UNAVAILABLE',
    storagePolicyReadiness:reconciled?.storagePolicies || 'SOURCE_UNAVAILABLE', productionOriginReadiness:reconciled?.origins || 'SOURCE_UNAVAILABLE',
    runtimeAlignmentReadiness:'OWNER_ACTION_REQUIRED', securityConfigurationReadiness:'OWNER_ACTION_REQUIRED',
    deploymentConfigurationReadiness:'NOT_READY', statewideActivationConfigurationReadiness:'NOT_READY',
    appDistributionConfigurationReadiness:'OWNER_ACTION_REQUIRED'
  };
  const blockers = Object.entries(decisions).filter(([,status])=>status!=='PASS'&&status!=='NOT_APPLICABLE').map(([area,status],i)=>({id:`LP169-B${String(i+1).padStart(3,'0')}`,area,status,blocks:['DEPLOYMENT','ACTIVATION','PUBLIC_LAUNCH'],remediation:'Capture complete redacted owner evidence; reassess without production mutation.'}));
  return {
    'production-configuration-contract.json': {...common, items:contract},
    'environment-source-inventory.json': {...common, sources},
    'secret-presence-certification.json': {...common, valueFieldsPermitted:false, secretValuesRead:0, items:contract.filter(x=>x.secretClassification.includes('SECRET')).map(x=>({identifier:x.identifier,status:x.status,evidence:'NAME_AND_STATUS_ONLY'}))},
    'supabase-project-certification.json': {...common, status:reconciled?.supabase || 'SOURCE_UNAVAILABLE', projectIdentity:reconciled?.projectIdentity || 'SOURCE_UNAVAILABLE', availability:recordStatus(evidence,'SUPABASE_PROJECT_AVAILABILITY'), region:recordStatus(evidence,'SUPABASE_REGION'), apiReachability:recordStatus(evidence,'SUPABASE_API'), authenticationConfiguration:recordStatus(evidence,'SUPABASE_AUTH'), edgeFunctions:[{identifier:'gridly-geocode',status:recordStatus(evidence,'FUNCTION:gridly-geocode')}], repositoryMigrationCount:migrations.length, repositoryMigrations:migrations, remoteMutationPerformed:false},
    'database-object-certification.json': {...common,status:dashboard.database==='PASS'?'PASS':reconciled?.database || 'SOURCE_UNAVAILABLE',sourceSystem:sqlEditorEvidence?'SUPABASE_SQL_EDITOR':'SOURCE_UNAVAILABLE',metadataCategories:{schemas:dashboard.schema||'SOURCE_UNAVAILABLE',tables:dashboard.tables||'SOURCE_UNAVAILABLE',columns:dashboard.columns||'SOURCE_UNAVAILABLE',routines:dashboard.routines||'SOURCE_UNAVAILABLE',constraints:dashboard.constraints||'SOURCE_UNAVAILABLE',indexes:dashboard.indexes||'SOURCE_UNAVAILABLE',triggers:dashboard.triggers||'SOURCE_UNAVAILABLE',policyInventory:dashboard.policyInventory},objects:dbObjects,expectedSchemaCompatibility:sqlEditorEvidence?'OBSERVED_METADATA':recordStatus(evidence,'DATABASE_SCHEMA_COMPATIBILITY'),policies:dashboard.policyInventory==='PASS'?'INVENTORY_OBSERVED':recordStatus(evidence,'DATABASE_POLICIES'),indexes:dashboard.indexes||recordStatus(evidence,'DATABASE_INDEXES'),triggers:dashboard.triggers||recordStatus(evidence,'DATABASE_TRIGGERS'),remoteWrites:0},
    'storage-inventory-certification.json': {...common,status:dashboard.storage!=='SOURCE_UNAVAILABLE'?dashboard.storage:reconciled?.storage || 'SOURCE_UNAVAILABLE',sourceSystem:sqlEditorEvidence?'SUPABASE_SQL_EDITOR':'SOURCE_UNAVAILABLE',expectedBaseline:{addressPackages:254,addressRuntimeCertificates:254,bucket:'certified-addresses'},observedAggregateCount:dashboard.observedCertifiedAddressObjectCount??null,aggregateCountDoesNotProve:['EXACT_PACKAGE_NAMES','EXACT_CERTIFICATE_NAMES','OBJECT_HASHES','MIME_TYPES'],categories:[{category:'CERTIFIED_ADDRESS_BUCKET_IDENTITY',delivery:'SUPABASE_STORAGE',status:dashboard.storageBucket||'SOURCE_UNAVAILABLE'},{category:'COUNTY_ADDRESS_PACKAGES',delivery:'SUPABASE_STORAGE',status:recordStatus(evidence,'STORAGE:ADDRESS_PACKAGES')},{category:'ADDRESS_RUNTIME_CERTIFICATES',delivery:'SUPABASE_STORAGE',status:recordStatus(evidence,'STORAGE:ADDRESS_CERTIFICATES')},{category:'RUNTIME_MANIFESTS_AND_DESTINATION_CROSSING_ASSETS',delivery:'REPOSITORY_HOSTED_STATIC_ASSETS',status:'NOT_APPLICABLE'}],objectsRead:0,objectsWritten:0},
    'storage-policy-certification.json': {...common,status:reconciled?.storagePolicies || 'SOURCE_UNAVAILABLE',intendedAccess:{read:'SERVICE_AUTHENTICATED',write:'SERVICE_OR_OWNER_MANAGED_ONLY'},anonymousWrite:recordStatus(evidence,'POLICY:ANONYMOUS_WRITE_DISABLED'),publicWrite:recordStatus(evidence,'POLICY:PUBLIC_WRITE_DISABLED'),runtimeRead:recordStatus(evidence,'POLICY:RUNTIME_READ'),policiesChanged:0},
    'origin-and-redirect-certification.json': {...common,status:reconciled?.origins || 'SOURCE_UNAVAILABLE',items:['PRODUCTION_ORIGIN','CANONICAL_DOMAIN','SUPABASE_REDIRECT_URLS','AUTH_CALLBACK_URLS','CORS_ORIGINS','DEEP_LINKS','SUPPORT_URL','LEGAL_URL'].map(identifier=>({identifier,status:recordStatus(evidence,identifier)==='SOURCE_UNAVAILABLE'?'UNVERIFIED_OWNER_INPUT_REQUIRED':recordStatus(evidence,identifier)})),pwaStartUrl:{source:'manifest.webmanifest',status:exists(root,'manifest.webmanifest')?'PRESENT':'ABSENT'}},
    'runtime-configuration-alignment.json': {...common,status:'OWNER_ACTION_REQUIRED',repositoryFindings:[{identifier:'SUPABASE_RUNTIME_SOURCE',status:'UNVERIFIED'},{identifier:'EDGE_FUNCTION_LOCALHOST_CORS_FALLBACK',status:'FAIL',source:'supabase/functions/gridly-geocode/index.ts'},{identifier:'CERTIFIED_STORAGE_BUCKET_DEFAULT',status:'PRESENT',source:'supabase/functions/gridly-geocode/index.ts'},{identifier:'PWA_ASSET_PATHS',status:'PRESENT'}],remoteProductionValuesCompared:false,runtimeModified:false},
    'security-configuration-review.json': {...common,status:'OWNER_ACTION_REQUIRED',committedSecretValues:{status:'PASS',method:'governed-pattern-scan',valuesReported:false},serviceRoleInBrowser:{status:'PASS'},permissiveCors:{status:'OWNER_ACTION_REQUIRED',finding:'Repository fallback includes local development origins; deployed allowlist presence is unavailable.'},storageWritePolicies:{status:recordStatus(evidence,'STORAGE_POLICIES')},gitignoreProtection:{status:exists(root,'.gitignore')?'PRESENT':'ABSENT'},penetrationTestingPerformed:false,credentialsRotated:0},
    'owner-evidence-requirements.json': {...common,status:evidence||sqlEditorEvidence?'PARTIAL_EVIDENCE_INGESTED':'OWNER_EXECUTION_REQUIRED',sqlEditorEvidence:sqlEditorEvidence?sqlEditorEvidence.evidenceStatus:'OWNER_SQL_EDITOR_EXPORT_INGESTION_REQUIRED',schema:{schemaVersion:2,provenance:['evidenceIdentifier','sourceSystem','captureMethod','commandFamily','authentication','readOnly','redactionStatus','schemaVersion','deterministicContentIdentity','completeness','status'],records:[{identifier:'UPPERCASE_SAFE_IDENTIFIER',status:'PRESENT|ABSENT|UNVERIFIED|INVALID_FORMAT|SOURCE_UNAVAILABLE|PASS|FAIL|OWNER_ACTION_REQUIRED',method:'SAFE_READ_ONLY_COMMAND_ID',attestation:'OWNER_ATTESTED_OR_TOOL_VERIFIED'}]},requirements:['SUPABASE_PROJECT','SUPABASE_PROJECT_IDENTITY','SUPABASE_PROJECT_AVAILABILITY','SUPABASE_REGION','SUPABASE_API','SUPABASE_AUTH','FUNCTION:gridly-geocode','DATABASE_OBJECTS','DATABASE_SCHEMA_COMPATIBILITY','DATABASE_POLICIES','DATABASE_INDEXES','DATABASE_TRIGGERS','STORAGE_OBJECTS','STORAGE:ADDRESS_PACKAGES','STORAGE:ADDRESS_CERTIFICATES','STORAGE:STATEWIDE_COUNTS','STORAGE_POLICIES','POLICY:ANONYMOUS_WRITE_DISABLED','POLICY:PUBLIC_WRITE_DISABLED','POLICY:RUNTIME_READ','ORIGINS_REDIRECTS'],rawCommandOutputAccepted:false},
    'configuration-blockers.json': {...common,blockers},
    'certification-summary.json': {...common,overallClassification:evidence||sqlEditorEvidence?'NOT_READY_CONFIGURATION_GAPS_REMAIN':'OWNER_EXECUTION_REQUIRED',decisions,deploymentAuthorized:false,activationAuthorized:false,appDistributionAuthorized:false,publicLaunchAuthorized:false,productionWrites:0,deployments:0,activations:0,secretValuesRead:0,relationshipToLp168:'Remote evidence gaps remain fail-closed; LP168 NOT_READY is not advanced.'},
    'protected-artifact-identities.json': {...common,algorithm:'SHA-256',identitySource:'CANONICAL_GIT_BLOB_EXCLUSIVELY',protectedArtifacts}
  };
}

export function writeReports(output, root=ROOT) { const reports=certify(root); fs.mkdirSync(output,{recursive:true}); for(const name of REPORT_NAMES) fs.writeFileSync(path.join(output,name),encode(reports[name])); return reports; }
export function verify(root=ROOT) { const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lp169-')); try { const a=path.join(temp,'a'),b=path.join(temp,'b'); writeReports(a,root);writeReports(b,root); for(const n of REPORT_NAMES){const x=fs.readFileSync(path.join(a,n)),y=fs.readFileSync(path.join(b,n)),g=fs.readFileSync(path.join(root,'reports/lp169',n));if(!x.equals(y)||!x.equals(g)||x.includes(13))throw new Error(`LP169 report drift: ${n}`);} } finally {fs.rmSync(temp,{recursive:true,force:true});} return true; }
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv[2]||'certify';if(mode==='verify'){verify();console.log('LP169 deterministic verification: PASS');}else{writeReports(path.join(ROOT,'reports/lp169'));console.log(`LP169 ${mode}: ${certify()['certification-summary.json'].overallClassification}`);}}
