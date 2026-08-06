import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { BASELINE, PROTECTED_PATHS, REPORT_NAMES, ROOT, certify, encode, evidenceContentIdentity, reconcileEvidence, validateEvidence, writeReports } from '../../tools/lp169/certify-production-configuration.mjs';

const captureScriptPath = path.join(ROOT, 'tools/lp169/capture-owner-production-evidence.ps1');
const captureScript = fs.readFileSync(captureScriptPath, 'utf8');

const evidence = records => ({
  schemaVersion: 2,
  provenance: {
    evidenceIdentifier: 'LP169.1-OWNER-EVIDENCE', sourceSystem: 'OWNER_WINDOWS', captureMethod: 'SAFE_READ_ONLY_COMMANDS',
    commandFamily: 'SUPABASE_GH_PSQL', authentication: 'OWNER_AUTHENTICATED', readOnly: true, redactionStatus: 'SANITIZED',
    schemaVersion: 2, deterministicContentIdentity: evidenceContentIdentity(records), completeness: 'PARTIAL', status: 'OWNER_REVIEWED'
  }, records
});

test('reports disclose no secret values and accept statuses only', () => {
  const text=REPORT_NAMES.map(n=>fs.readFileSync(path.join(ROOT,'reports/lp169',n),'utf8')).join('\n');
  assert.doesNotMatch(text, /sb_(?:secret|service)_|postgres(?:ql)?:\/\/|PRIVATE KEY/);
  assert.equal(certify()['certification-summary.json'].secretValuesRead,0);
  assert.throws(()=>validateEvidence({schemaVersion:1,records:[{identifier:'X',status:'PRESENT',value:'secret'}]}),/forbidden/);
  assert.throws(()=>validateEvidence({schemaVersion:1,records:[{identifier:'X',status:'PRESENT',attestation:'sb_secret_abcdefghijklmnopqrstuv'}]}),/secret/);
});

test('certification is read-only and cannot authorize operations',()=>{
  const reports=certify(), summary=reports['certification-summary.json'];
  assert.deepEqual([summary.productionWrites,summary.deployments,summary.activations],[0,0,0]);
  assert.equal(summary.deploymentAuthorized,false); assert.equal(summary.activationAuthorized,false);
  assert.equal(reports['database-object-certification.json'].remoteWrites,0);
  assert.equal(reports['storage-inventory-certification.json'].objectsWritten,0);
  assert.equal(reports['storage-policy-certification.json'].policiesChanged,0);
});

test('missing credentials and owner evidence fail closed',()=>{
  const reports=certify();
  assert.equal(reports['supabase-project-certification.json'].status,'SOURCE_UNAVAILABLE');
  assert.equal(reports['storage-inventory-certification.json'].status,'SOURCE_UNAVAILABLE');
  assert.notEqual(reports['certification-summary.json'].overallClassification,'PRODUCTION_CONFIGURATION_CERTIFIED');
  assert.equal(reports['certification-summary.json'].overallClassification,'OWNER_EXECUTION_REQUIRED');
});

test('evidence validation detects duplicate identities and partial evidence stays partial',()=>{
  assert.throws(()=>validateEvidence({schemaVersion:1,records:[{identifier:'A',status:'PASS'},{identifier:'A',status:'PASS'}]}),/duplicate/);
  assert.doesNotThrow(()=>validateEvidence({schemaVersion:1,records:[{identifier:'SUPABASE_PROJECT',status:'PASS',method:'SAFE',attestation:'OWNER_ATTESTED'}]}));
});

test('schema v2 accepts sanitized provenance and rejects unknown fields',()=>{
  const safe=evidence([{identifier:'SUPABASE_PROJECT',status:'PASS',method:'SAFE_READ_ONLY',attestation:'TOOL_VERIFIED',readOnly:true,redactionStatus:'SANITIZED',completeness:'COMPLETE'}]);
  assert.doesNotThrow(()=>validateEvidence(safe));
  assert.throws(()=>validateEvidence({...safe, surprise:true}),/unknown top-level/);
  const records=[{...safe.records[0],surprise:true}];
  assert.throws(()=>validateEvidence(evidence(records)),/unknown record/);
});

test('secret-like evidence is rejected without accepting partial unsafe content',()=>{
  for (const record of [
    {identifier:'X',status:'PRESENT',attestation:'Bearer abcdefghijklmnopqrstuvwxyz'},
    {identifier:'X',status:'PRESENT',attestation:'Authorization: redacted'},
    {identifier:'X',status:'PRESENT',attestation:'sb_service_abcdefghijklmnopqrstuvwxyz'}
  ]) assert.throws(()=>validateEvidence({schemaVersion:1,records:[record]}),/secret|forbidden/);
});

test('ingester atomically accepts safe drafts and never echoes rejected material',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lp169-ingest-'));
  try {
    const provenance={evidenceIdentifier:'LP169.1-OWNER-EVIDENCE',sourceSystem:'OWNER_WINDOWS',captureMethod:'SAFE_READ_ONLY_COMMANDS',commandFamily:'SUPABASE_GH_PSQL',authentication:'OWNER_AUTHENTICATED',readOnly:true,redactionStatus:'SANITIZED',completeness:'PARTIAL',status:'OWNER_REVIEWED'};
    const safePath=path.join(temp,'safe.json'), unsafePath=path.join(temp,'unsafe.json'), output=path.join(temp,'owner-evidence.json');
    fs.writeFileSync(safePath,JSON.stringify({schemaVersion:2,provenance,records:[{identifier:'SUPABASE_PROJECT',status:'SOURCE_UNAVAILABLE'}]}));
    const accepted=spawnSync(process.execPath,['tools/lp169/ingest-owner-evidence.mjs',safePath,output],{cwd:ROOT,encoding:'utf8'});
    assert.equal(accepted.status,0); assert.equal(validateEvidence(JSON.parse(fs.readFileSync(output,'utf8'))).schemaVersion,2);
    const marker='Bearer abcdefghijklmnopqrstuvwxyz';
    fs.writeFileSync(unsafePath,JSON.stringify({schemaVersion:2,provenance,records:[{identifier:'SUPABASE_PROJECT',status:'PASS',attestation:marker}]}));
    const before=fs.readFileSync(output);
    const rejected=spawnSync(process.execPath,['tools/lp169/ingest-owner-evidence.mjs',unsafePath,output],{cwd:ROOT,encoding:'utf8'});
    assert.notEqual(rejected.status,0); assert.doesNotMatch(`${rejected.stdout}${rejected.stderr}`,/abcdefghijklmnopqrstuvwxyz/); assert.deepEqual(fs.readFileSync(output),before);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});

test('remote reconciliation fails closed for partial, mismatched, and missing evidence',()=>{
  const partial=reconcileEvidence({schemaVersion:1,records:[{identifier:'SUPABASE_PROJECT',status:'PASS'}]});
  assert.equal(partial.supabase,'SOURCE_UNAVAILABLE');
  const mismatch=reconcileEvidence({schemaVersion:1,records:[{identifier:'SUPABASE_PROJECT_IDENTITY',status:'PASS',safeSha256:'a'.repeat(64)}]},{expectedProjectSha256:'b'.repeat(64)});
  assert.equal(mismatch.projectIdentity,'FAIL'); assert.equal(mismatch.supabase,'FAIL');
  assert.equal(reconcileEvidence({schemaVersion:1,records:[{identifier:'SUPABASE_PROJECT_IDENTITY',status:'PASS',safeSha256:'a'.repeat(64)}]},{expectedProjectSha256:'a'.repeat(64)}).projectIdentity,'PASS');
  assert.equal(partial.database,'SOURCE_UNAVAILABLE'); assert.equal(partial.storage,'SOURCE_UNAVAILABLE');
});

test('statewide object counts and policy access require every detailed PASS',()=>{
  const records=['STORAGE_OBJECTS','STORAGE:ADDRESS_PACKAGES','STORAGE:ADDRESS_CERTIFICATES','STORAGE:STATEWIDE_COUNTS','STORAGE_POLICIES','POLICY:ANONYMOUS_WRITE_DISABLED','POLICY:PUBLIC_WRITE_DISABLED','POLICY:RUNTIME_READ'].map(identifier=>({identifier,status:'PASS',...(identifier.startsWith('POLICY:')?{attestation:'TOOL_VERIFIED'}:{})}));
  records.find(x=>x.identifier==='STORAGE:ADDRESS_PACKAGES').safeCount=254;
  records.find(x=>x.identifier==='STORAGE:ADDRESS_CERTIFICATES').safeCount=254;
  const reconciled=reconcileEvidence({schemaVersion:1,records});
  assert.equal(reconciled.storage,'PASS'); assert.equal(reconciled.storagePolicies,'PASS'); assert.equal(reconciled.policyEvidenceClassification,'TOOL_VERIFIED');
  records.find(x=>x.identifier==='STORAGE:ADDRESS_PACKAGES').safeCount=253;
  assert.equal(reconcileEvidence({schemaVersion:1,records}).storage,'FAIL');
  records.find(x=>x.identifier==='STORAGE:ADDRESS_PACKAGES').safeCount=254;
  records.find(x=>x.identifier==='POLICY:ANONYMOUS_WRITE_DISABLED').status='FAIL';
  assert.equal(reconcileEvidence({schemaVersion:1,records}).storagePolicies,'FAIL');
  records.filter(x=>x.identifier.startsWith('POLICY:')).forEach(x=>x.attestation='OWNER_ATTESTED');
  assert.equal(reconcileEvidence({schemaVersion:1,records}).policyEvidenceClassification,'OWNER_ATTESTED');
});

test('origin, legal, and mobile evidence reconcile independently',()=>{
  const originIds=['ORIGINS_REDIRECTS','PRODUCTION_ORIGIN','CANONICAL_DOMAIN','SUPABASE_REDIRECT_URLS','AUTH_CALLBACK_URLS','CORS_ORIGINS'];
  const records=[...originIds.map(identifier=>({identifier,status:'PASS'})),{identifier:'SUPPORT_URL',status:'OWNER_ACTION_REQUIRED'},{identifier:'LEGAL_URL',status:'SOURCE_UNAVAILABLE'},{identifier:'ANDROID_APPLICATION_ID',status:'PASS'},{identifier:'IOS_BUNDLE_ID',status:'PASS'}];
  const result=reconcileEvidence({schemaVersion:1,records});
  assert.equal(result.origins,'PASS'); assert.equal(result.legal,'SOURCE_UNAVAILABLE'); assert.equal(result.mobile,'PASS');
  const localhost=records.map(x=>x.identifier==='PRODUCTION_ORIGIN'?{...x,classification:'LOCALHOST_ONLY'}:x);
  assert.equal(reconcileEvidence({schemaVersion:1,records:localhost}).origins,'FAIL');
  const mismatched=records.map(x=>x.identifier==='PRODUCTION_ORIGIN'?{...x,safeSha256:'a'.repeat(64)}:x);
  assert.equal(reconcileEvidence({schemaVersion:1,records:mismatched},{expectedOriginSha256:'b'.repeat(64)}).origins,'FAIL');
});

test('record ordering does not change governed content identity',()=>{
  const a=[{identifier:'B',status:'PASS'},{identifier:'A',status:'PASS'}], b=[...a].reverse();
  assert.equal(evidenceContentIdentity(a),evidenceContentIdentity(b));
});

test('storage baseline and runtime risks are governed',()=>{
  const reports=certify();
  assert.equal(reports['storage-inventory-certification.json'].expectedBaseline.addressPackages,254);
  assert.equal(reports['storage-inventory-certification.json'].expectedBaseline.addressRuntimeCertificates,254);
  assert.ok(reports['runtime-configuration-alignment.json'].repositoryFindings.some(x=>x.identifier.includes('LOCALHOST')&&x.status==='FAIL'));
});

test('public client and server secret classifications remain distinct',()=>{
  const items=certify()['production-configuration-contract.json'].items;
  assert.equal(items.find(x=>x.identifier==='SUPABASE_ANON_KEY').secretClassification,'PUBLIC_CLIENT_CREDENTIAL');
  assert.equal(items.find(x=>x.identifier==='SUPABASE_SERVICE_ROLE_KEY').secretClassification,'HIGH_SECRET');
});

test('protected identity uses Git blobs and ignores CRLF working-tree materialization',()=>{
  const before=certify()['protected-artifact-identities.json'];
  assert.ok(before.protectedArtifacts.every(x=>x.authoritativeIdentitySource==='GIT_BLOB'));
  const p=PROTECTED_PATHS[0], original=fs.readFileSync(path.join(ROOT,p));
  try { fs.writeFileSync(path.join(ROOT,p),original.toString('utf8').replace(/\n/g,'\r\n')); const after=certify()['protected-artifact-identities.json']; assert.deepEqual(after,before); }
  finally { fs.writeFileSync(path.join(ROOT,p),original); }
  const committed=execFileSync('git',['show',`${BASELINE}:${p}`],{cwd:ROOT,maxBuffer:64*1024*1024}); assert.ok(committed.length>0);
});

test('two isolated runs are byte-identical canonical LF',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lp169-test-'));
  try {const a=path.join(temp,'a'),b=path.join(temp,'b');writeReports(a);writeReports(b);for(const n of REPORT_NAMES){const x=fs.readFileSync(path.join(a,n)),y=fs.readFileSync(path.join(b,n));assert.deepEqual(x,y);assert.equal(x.includes(13),false);assert.equal(x.toString(),encode(JSON.parse(x)));}}
  finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('owner capture uses the Windows PowerShell 5.1 UTF-8-no-BOM path',()=>{
  assert.doesNotMatch(captureScript, /-Encoding\s+utf8NoBOM/i);
  assert.match(captureScript, /\[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.doesNotMatch(captureScript, /\bNew-Object\b/,
    'the owner capture must use direct .NET constructors supported by Windows PowerShell 5.1');
  assert.match(captureScript, /\[System\.IO\.File\]::WriteAllText/);
  assert.doesNotMatch(captureScript, /\b(?:Set-Content|Out-File|Add-Content)\b|(?:^|\s)(?:>|>>)\s*[^&]/m);
});

test('capture encoding contract is deterministic UTF-8 without BOM and canonical LF',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lp169-ps51-bytes-'));
  try {
    const content='{\r\n  "name": "Gridly Platform"\r\n}\r\n'.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const first=path.join(temp,'first.json'), second=path.join(temp,'second.json');
    fs.writeFileSync(first,content,{encoding:'utf8'}); fs.writeFileSync(second,content,{encoding:'utf8'});
    for (const file of [first,second]) {
      const bytes=fs.readFileSync(file);
      assert.notDeepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf]);
      assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(bytes),content);
      assert.equal(bytes.includes(13),false);
    }
    assert.deepEqual(fs.readFileSync(first),fs.readFileSync(second));
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});

test('owner capture publishes atomically, cleans staging, and supports command shims',()=>{
  assert.match(captureScript,/\.lp169-capture-/);
  assert.match(captureScript,/finally\s*\{[\s\S]*Remove-Item[^\n]*\$CaptureDirectory/);
  assert.match(captureScript,/\.lp169-previous-/);
  assert.match(captureScript,/Move-Item[^\n]*\$BackupDirectory[^\n]*\$ReviewDirectory/);
  assert.match(captureScript,/& \$CommandName @Arguments/);
  assert.doesNotMatch(captureScript,/CommandType\s+(?:-eq\s+)?['"]?Application/i);
  assert.match(captureScript,/if \(\$LASTEXITCODE -ne 0\).*captured output was not displayed/);
});

test('owner capture remains secret-safe and metadata-only',()=>{
  for (const marker of ['authorization','bearer','PRIVATE KEY','postgresql','password','sb_']) assert.ok(captureScript.toLowerCase().includes(marker.toLowerCase()));
  assert.match(captureScript,/access\[_-\]\?token/);
  assert.match(captureScript,/Evidence capture rejected unsafe content; no captured content was displayed/);
  assert.doesNotMatch(captureScript,/supabase[^\n]*(?:db push|migration|functions deploy|storage|link)|gh[^\n]*(?:secret set|workflow run)/i);
  assert.doesNotMatch(captureScript,/\b(?:deploy|activate|upload|insert|update|delete)\b/i);
});

test('owner inventories use schema-aware PowerShell 5.1-safe normalization',()=>{
  assert.match(captureScript,/function Get-NormalizedInventoryNames/);
  assert.match(captureScript,/\.PSObject\.Properties\[\$_\]/);
  assert.match(captureScript,/\.PSObject\.Properties\[\$Supported\[0\]\]\.Value/);
  assert.doesNotMatch(captureScript,/Select-Object\s+-ExpandProperty\s+name/i);
  for (const source of [
    'supabase secrets list --output json',
    'gh secret list --repo --app actions --json name',
    'gh secret list --repo --env --app actions --json name'
  ]) assert.ok(captureScript.includes(`-SourceCommand '${source}'`));
  assert.match(captureScript,/\[string\[\]\]\$AllowedProperties/);
  assert.match(captureScript,/\[string\[\]\]\$WrapperProperties/);
  assert.match(captureScript,/\[switch\]\$AllowEmpty/);
  assert.match(captureScript,/ConvertFrom-Json -InputObject \$JsonText/);
  assert.match(captureScript,/\$JsonText -notmatch '\^\\s\*\\\[\\s\*\\\]\\s\*\$'/);
  assert.match(captureScript,/\[object\[\]\]\$Records = @\(\)/);
});

test('owner capture has no unnormalized cardinality checks',()=>{
  assert.doesNotMatch(captureScript,/\([^\n]*(?:\||ConvertFrom-Json|Select-Object|Where-Object|ForEach-Object)[^\n]*\)\.Count/);
  assert.doesNotMatch(captureScript,/\(ConvertFrom-Json[^\n]*\)\.(?:Count|Length)/i);
  const countReceivers=[...captureScript.matchAll(/\$([A-Za-z][A-Za-z0-9]*)\.Count\b/g)].map(match=>match[1]);
  assert.deepEqual([...new Set(countReceivers)].sort(),['Records','Supported','WrapperMatches']);
  assert.match(captureScript,/\[object\[\]\]\$Records = @\(\)/);
  assert.match(captureScript,/\$WrapperMatches = @\([^\n]*Where-Object/);
  assert.match(captureScript,/\$Supported = @\([^\n]*Where-Object/);
  assert.doesNotMatch(captureScript,/\$JsonText\.(?:Count|Length)\b/);
});

test('secret inventory callers explicitly accept valid zero-record observations',()=>{
  for (const source of [
    'supabase secrets list --output json',
    'gh secret list --repo --app actions --json name',
    'gh secret list --repo --env --app actions --json name'
  ]) {
    const escaped=source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(captureScript,new RegExp(`-SourceCommand '${escaped}'[^\\n]*-AllowEmpty`));
  }
  assert.match(captureScript,/if \(\$AllowEmpty\) \{ return ,\(\[object\[\]\]@\(\)\) \}/);
  assert.match(captureScript,/return ,\$NormalizedNames/);
  assert.match(captureScript,/ConvertTo-Json -InputObject \$Data -Depth 8/);
  assert.match(captureScript,/SOURCE_UNAVAILABLE; command returned (?:no|null) JSON/);
  assert.match(captureScript,/CAPTURE_FAILED; command returned invalid JSON/);
  assert.match(captureScript,/status = 'PRESENT'/);
  assert.doesNotMatch(captureScript,/AllowEmpty[\s\S]{0,80}status = 'PASS'/);
});

test('inventory normalization rejects every unsafe response family without values in diagnostics',()=>{
  for (const guard of [
    '$Records.Count -eq 0',
    '$Record -is [string]',
    '$Record.GetType().IsPrimitive',
    '$Supported.Count -ne 1',
    '-not ($Value -is [string])',
    '[string]::IsNullOrWhiteSpace($Value)'
  ]) assert.ok(captureScript.includes(guard), `missing fail-closed guard: ${guard}`);
  assert.match(captureScript,/observed properties only:/);
  assert.match(captureScript,/function Stop-InventoryNormalization\s*\{\s*\[CmdletBinding\(\)\]\s*param\(/);
  assert.match(captureScript,/\[System\.ArgumentException\]::new\(\$Message\)/);
  assert.match(captureScript,/\[System\.Management\.Automation\.ErrorRecord\]::new\(\s*\$Exception,\s*\$ErrorId,\s*\[System\.Management\.Automation\.ErrorCategory\]::InvalidData,\s*\$TargetObject\s*\)/);
  assert.match(captureScript,/\$PSCmdlet\.ThrowTerminatingError\(\$ErrorRecord\)/);
  for (const identifier of [
    'LP169InventorySchemaMismatch',
    'LP169InventoryBlankOutput',
    'LP169InventoryNullOutput',
    'LP169InventoryMalformedJson',
    'LP169InventoryScalarRoot',
    'LP169InventoryAmbiguousProperty',
    'LP169InventoryEmptyNotAllowed'
  ]) assert.ok(captureScript.includes(`'${identifier}'`), `missing governed diagnostic: ${identifier}`);
  const diagnosticCalls=[...captureScript.matchAll(/(?m)^\s*Stop-InventoryNormalization `\n\s+-ErrorId [^\n]+ `\n\s+-Message ([^\n]+) `\n\s+-TargetObject \$SourceCommand/g)];
  assert.ok(diagnosticCalls.length >= 10);
  assert.ok(diagnosticCalls.every(([,message])=>!message.includes('$Value')), 'failure diagnostics must never interpolate captured values');
  assert.ok(diagnosticCalls.every(([,message])=>message.includes('expected record properties:')),
    'every governed diagnostic must describe the expected record schema');
  assert.match(captureScript,/\$Names \| Sort-Object -Unique/);
});

test('PowerShell inventory response-shape regression matrix passes when PowerShell is available', { skip: process.platform !== 'win32' }, ()=>{
  const result=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'tests/lp169/inventory-normalization.ps1'),'-CaptureScriptPath',captureScriptPath],{cwd:ROOT,encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/inventory normalization regression tests passed/);
});
