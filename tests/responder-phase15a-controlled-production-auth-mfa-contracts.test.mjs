import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = {
  doc: 'docs/RESPONDER/RESPONDER-PHASE15A-CONTROLLED-PRODUCTION-AUTH-MFA-VERIFICATION.md',
  ps1: 'tools/responder/phase15a-auth-mfa-verification.ps1',
  helper: 'tools/responder/phase15a-auth-mfa-helper.mjs',
  preflight: 'tools/responder/phase15a-preflight.sql',
  evidence: 'tools/responder/phase15a-auth-evidence.sql'
};
const read = (name) => fs.readFileSync(path.join(root, paths[name]), 'utf8');
const doc = read('doc');
const ps1 = read('ps1');
const helper = read('helper');
const preflightSql = read('preflight');
const evidenceSql = read('evidence');

test('Phase 15A deliverables exist and preserve the owner-only production boundary', () => {
  for (const relative of Object.values(paths)) assert.ok(fs.existsSync(path.join(root, relative)), relative);
  assert.match(doc, /Codex prepared these files and ran local contract tests only\. It performed \*\*no production mutation and changed no production Auth user\*\*/);
  assert.match(doc, /OWNER EXECUTION REQUIRED/g);
  assert.match(doc, /Stage 0 — preflight/);
  assert.ok(doc.indexOf('Stage 0 — preflight') < doc.indexOf('Stage 1 — create'));
  assert.match(doc, /Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force/);
  assert.match(doc, /does not change machine\/user policy or production/);
});

test('every session or Auth mutation mode requires an explicit authorization switch', () => {
  assert.match(ps1, /\[switch\]\$AuthorizeProductionMutation/);
  for (const mode of ['CreateTestUser','InspectAal1','EnrollTotp','VerifyTotp','RevokeSession','RemoveFactor','RecoverUnverifiedTotpFactor','Cleanup']) {
    assert.match(ps1, new RegExp(`'${mode}'`), mode);
  }
  assert.match(ps1, /\$MutatingModes -contains \$Mode -and -not \$AuthorizeProductionMutation/);
  assert.match(ps1, /OWNER EXECUTION REQUIRED: mode \$Mode refuses to run without -AuthorizeProductionMutation/);
});

test('a production mutation mode refuses before credentials when authorization is absent', () => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const result = spawnSync(shell, ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root, paths.ps1),
    '-Mode','CreateTestUser'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /without -AuthorizeProductionMutation/);
});

test('exact TOTP recovery refuses before credentials when authorization is absent', () => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const result = spawnSync(shell, ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root, paths.ps1),
    '-Mode','RecoverUnverifiedTotpFactor',
    '-TestUserId','11111111-1111-4111-8111-111111111111',
    '-FactorId','22222222-2222-4222-8222-222222222222'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /without -AuthorizeProductionMutation/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /secret\/service-role key/);
});

test('PowerShell parses and modes remain individually dispatched', () => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const command = `$e=$null;$t=$null;[System.Management.Automation.Language.Parser]::ParseFile('${path.join(root, paths.ps1).replaceAll("'", "''")}',[ref]$t,[ref]$e)|Out-Null;if($e.Count){$e|% Message;exit 1}`;
  const result = spawnSync(shell, ['-NoProfile','-Command',command], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const mode of ['Preflight','InspectCorrelation','SimulateCutoff','InspectRevocation','InspectReset']) {
    assert.match(ps1, new RegExp(`'${mode}'`), mode);
  }
});

test('project, branch, worktree and explicit identity guards fail closed', () => {
  assert.match(ps1, /nhwhkbkludzkuyxmkkcj/);
  assert.match(ps1, /RESPONDER-PHASE15A-controlled-production-auth-mfa-verification/);
  assert.match(ps1, /Refusing to operate outside the dedicated Phase 15A responder worktree/);
  assert.match(ps1, /Refusing a dirty responder worktree/);
  assert.match(ps1, /-TestUserId with the one dedicated test UUID is required/);
  assert.match(helper, /Cleanup refused: supplied UUID is not marked as the dedicated Gridly test identity/);
  assert.match(helper, /supplied UUID and test email do not match/);
  assert.doesNotMatch(`${ps1}\n${helper}`, /deleteAllUsers|wildcard|\*\/factors/);
});

test('secret-bearing values are prompted/redacted and raw session tokens are never written', () => {
  assert.match(ps1, /Read-Host \$Prompt -AsSecureString/);
  assert.match(helper, /\[REDACTED_JWT\]/);
  assert.match(helper, /\[REDACTED_TOTP_URI\]/);
  assert.match(helper, /Bearer \[REDACTED\]/);
  const writes = [...helper.matchAll(/fs\.writeFileSync\(([^,]+)/g)].map((match) => match[1].trim());
  assert.deepEqual(writes, ['target']);
  assert.match(helper, /QR output must be one HTML file under the operating-system temporary directory/);
  assert.match(ps1, /TEMPORARY_TOTP_QR_DELETED/);
  assert.doesNotMatch(`${doc}\n${ps1}\n${helper}\n${preflightSql}\n${evidenceSql}`,
    /eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{30,}|sb_(?:secret|service)_[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
});

test('JWT evidence is an allowlisted summary with TOTP method and redacted subject', () => {
  for (const field of ['claim_names','sub_sha256_16','aal','session_id','iat','exp','amr_methods','amr_shape']) {
    assert.match(helper, new RegExp(field), field);
  }
  assert.match(helper, /delete claims\.subject_uuid/);
  assert.match(helper, /totp_in_amr/);
  assert.doesNotMatch(helper, /console\.log\(.*(?:access_token|refresh_token)/);
});

test('read-only SQL is bounded to project email or supplied UUID/session and emits no secrets', () => {
  for (const sql of [preflightSql, evidenceSql]) {
    assert.match(sql, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
    assert.match(sql, /SET LOCAL statement_timeout = '20s'/);
    assert.match(sql, /SET LOCAL search_path = pg_catalog/);
    assert.match(sql, /ROLLBACK/);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i);
  }
  assert.match(preflightSql, /lower\(email\) = lower\(:'test_email'\)/);
  assert.match(evidenceSql, /:'test_user_id'::uuid/);
  assert.match(evidenceSql, /nullif\(:'session_id', ''\)::uuid/);
  assert.match(evidenceSql, /WHERE x\.user_id = s\.user_id/);
  assert.match(evidenceSql, /WHERE f\.user_id = s\.user_id/);
  assert.doesNotMatch(evidenceSql, /SELECT \*|token\s*[,)]|ip|user_agent/i);
});

test('production application and responder schemas cannot be mutated by the harness', () => {
  const executable = `${ps1}\n${helper}\n${preflightSql}\n${evidenceSql}`;
  assert.doesNotMatch(executable, /(?:CREATE|ALTER|DROP)\s+(?:SCHEMA|TABLE|FUNCTION|POLICY|ROLE)/i);
  assert.doesNotMatch(executable, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.|agency_private\.|responder_public\.|report_retention\.)/i);
  assert.doesNotMatch(executable, /supabase\/migrations|migration up|db push/i);
  assert.doesNotMatch(executable, /\bpython(?:3)?\b/i);
  assert.match(helper, /\/rest\/v1\/reports\?select=id&limit=0/);
});

test('cleanup is exact-user scoped, marker checked, factor-first, and hard deletes only that UUID', () => {
  const marker = helper.indexOf('gridly_operator_test !== TEST_LABEL');
  const factorList = helper.indexOf('/factors`,', marker);
  const factorDelete = helper.indexOf('/factors/${encodeURIComponent(factor.id)}`', marker);
  const userDelete = helper.indexOf('body: { should_soft_delete: false }', marker);
  assert.ok(marker >= 0 && factorList > marker && factorDelete > factorList && userDelete > factorDelete);
  assert.match(helper, /encodeURIComponent\(userId\)/g);
  assert.match(ps1, /ValidatePattern\('\^\$\|\^\[0-9a-fA-F\]/);
  assert.match(doc, /Never delete rows with SQL or use an all-user operation/);
});

test('exact TOTP recovery validates marked user and one exact factor before deletion', () => {
  const start = helper.indexOf('async function recoverUnverifiedTotpFactor()');
  const end = helper.indexOf('\nasync function cleanup()', start);
  assert.ok(start >= 0 && end > start);
  const recovery = helper.slice(start, end);
  const userRead = recovery.indexOf('/auth/v1/admin/users/${encodeURIComponent(userId)}`');
  const userMatch = recovery.indexOf("admin response did not match the supplied test user UUID");
  const marker = recovery.indexOf('gridly_operator_test !== TEST_LABEL');
  const factorList = recovery.indexOf('/factors`');
  const cardinality = recovery.indexOf('matching.length !== 1');
  const type = recovery.indexOf("factorType !== 'totp'");
  const status = recovery.indexOf("factor.status !== 'unverified'");
  const deletion = recovery.indexOf('/factors/${encodeURIComponent(factorId)}`');
  assert.ok(userRead >= 0 && userMatch > userRead && marker > userMatch && factorList > marker);
  assert.ok(cardinality > factorList && type > cardinality && status > type && deletion > status);
  assert.match(recovery, /factor\.id\.toLowerCase\(\) === factorId/);
  assert.match(recovery, /factor\.user_id.*!== userId/s);
  assert.match(recovery, /method: 'DELETE', apiKey: key/);
});

test('exact TOTP recovery uses only the server-side admin credential', () => {
  const start = ps1.indexOf("'RecoverUnverifiedTotpFactor' {");
  const end = ps1.indexOf("\n    'Cleanup' {", start);
  assert.ok(start >= 0 && end > start);
  const dispatch = ps1.slice(start, end);
  assert.match(dispatch, /Require-TestUserId; Require-FactorId; Require-AdminKey/);
  assert.match(dispatch, /Invoke-SafeNode 'recover-unverified-totp-factor'/);
  assert.doesNotMatch(dispatch, /Require-TestEmail|Require-PublishableKey|Require-OperatorPassword|Require-TotpCode|Require-PsqlEnvironment/);
});

test('exact TOTP recovery has no session, refresh, user-delete, sign-in, challenge, or schema mutation path', () => {
  const start = helper.indexOf('async function recoverUnverifiedTotpFactor()');
  const end = helper.indexOf('\nasync function cleanup()', start);
  const recovery = helper.slice(start, end);
  assert.doesNotMatch(recovery, /signIn\(|elevateTotp\(|\/logout|grant_type=refresh_token|should_soft_delete|writeQrFile\(|\/rest\/v1/);
  assert.doesNotMatch(recovery, /(?:INSERT|UPDATE|DELETE)\s+(?:FROM|INTO)\s+auth\./i);
  assert.doesNotMatch(recovery, /agency_private|responder_public|gridly_control|\/rest\/v1/);
  for (const field of ['session_operation_performed','refresh_token_operation_performed',
    'user_delete_operation_performed','password_sign_in_performed','totp_challenge_performed']) {
    assert.match(recovery, new RegExp(`${field}: false`), field);
  }
});

test('exact TOTP recovery cannot perform wildcard or all-factor deletion', () => {
  const start = helper.indexOf('async function recoverUnverifiedTotpFactor()');
  const end = helper.indexOf('\nasync function cleanup()', start);
  const recovery = helper.slice(start, end);
  assert.match(recovery, /requireUuid\(env\('GRIDLY_RESPONDER_TEST_USER_ID'\)/);
  assert.match(recovery, /requireUuid\(env\('GRIDLY_RESPONDER_FACTOR_ID'\)/);
  assert.match(recovery, /encodeURIComponent\(userId\).*\/factors\/\$\{encodeURIComponent\(factorId\)\}/s);
  assert.doesNotMatch(recovery, /for\s*\(|forEach\s*\(|deleteAll|\/factors\/\*/);
});

test('runbook documents exact compromised-factor recovery and mandatory read-only correlation', () => {
  assert.match(doc, /Stage 3 recovery — delete one compromised unverified TOTP factor/);
  assert.match(doc, /-Mode RecoverUnverifiedTotpFactor/);
  assert.match(doc, /requires `factor_type=totp` and `status=unverified`/);
  assert.match(doc, /performs no sign-in, enrollment, challenge, verification, logout, user deletion, SQL DML/);
  assert.match(doc, /session_operation_performed/);
  assert.match(doc, /-Mode InspectCorrelation/);
  assert.match(doc, /Never rerun this recovery mode after `deleted=true`/);
});

test('Stage 5 is owner-authorized and refuses any historical session UUID credential', () => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const unauthorized = spawnSync(shell, ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root, paths.ps1),
    '-Mode','RevokeSession',
    '-TestUserId','11111111-1111-4111-8111-111111111111',
    '-FactorId','22222222-2222-4222-8222-222222222222'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(unauthorized.status, 0);
  assert.match(`${unauthorized.stdout}\n${unauthorized.stderr}`, /without -AuthorizeProductionMutation/);
  const start = ps1.indexOf("'RevokeSession' {");
  const end = ps1.indexOf("\n    'RemoveFactor' {", start);
  assert.ok(start >= 0 && end > start);
  const dispatch = ps1.slice(start, end);
  const mutatingModes = ps1.match(/\$MutatingModes = @\(([^)]*)\)/s)?.[1] || '';
  assert.match(mutatingModes, /'RevokeSession'/);
  assert.match(ps1, /\$MutatingModes -contains \$Mode -and -not \$AuthorizeProductionMutation/);
  assert.match(dispatch, /if \(\$SessionId\)/);
  assert.match(dispatch, /-SessionId is not accepted as a revocation credential/);
  assert.match(dispatch, /Require-TestEmail; Require-TestUserId; Require-FactorId; Require-PublishableKey; Require-OperatorPassword; Require-TotpCode/);
});

test('Stage 5 creates one password session and elevates that same session with one exact verified TOTP factor', () => {
  const start = helper.indexOf('async function revokeSession()');
  const end = helper.indexOf('\nasync function removeFactor()', start);
  assert.ok(start >= 0 && end > start);
  const stage5 = helper.slice(start, end);
  assert.equal((stage5.match(/await signIn\(/g) || []).length, 1);
  assert.equal((stage5.match(/await elevateTotp\(/g) || []).length, 1);
  assert.match(stage5, /gridly_operator_test !== TEST_LABEL/);
  assert.match(stage5, /matchingFactors\.length !== 1/);
  assert.match(stage5, /factor_type !== 'totp'.*status !== 'verified'/s);
  assert.match(stage5, /aal1Claims\.session_id !== aal2Claims\.session_id/);
  assert.match(stage5, /aal2Claims\.aal !== 'aal2'.*amr_methods\.includes\('totp'\)/s);
  assert.match(stage5, /new_password_session_created: true/);
  assert.match(stage5, /same_session_elevated_to_aal2: true/);
});

test('Stage 5 reuses one memory-only token for pre-probe, local logout, and post-probe', () => {
  const start = helper.indexOf('async function revokeSession()');
  const end = helper.indexOf('\nasync function removeFactor()', start);
  const stage5 = helper.slice(start, end);
  assert.match(stage5, /const preRevocationProbe = await probeOldToken\(baseUrl, staleAccessToken\)/);
  assert.match(stage5, /\/auth\/v1\/logout\?scope=local/);
  assert.match(stage5, /bearer: staleAccessToken/);
  assert.match(stage5, /const postRevocationProbe = await probeOldToken\(baseUrl, staleAccessToken\)/);
  assert.match(stage5, /same_token_reused: true/);
  assert.match(stage5, /token_exp_still_in_future: tokenExpStillInFuture/);
  const returnStart = stage5.indexOf('return {');
  const returnEnd = stage5.indexOf('\n    };', returnStart);
  const safeOutput = stage5.slice(returnStart, returnEnd);
  assert.doesNotMatch(safeOutput, /access_token|refresh_token|staleAccessToken|claim_names|sub_sha256|auth_user_accepted|postgrest_jwt_accepted|Authorization/);
  assert.doesNotMatch(stage5, /process\.stdout|console\.log/);
  assert.match(stage5, /finally \{[\s\S]*staleAccessToken = null;[\s\S]*clearSessionSecrets\(aal2\);[\s\S]*clearSessionSecrets\(aal1\)/);
  assert.doesNotMatch(stage5, /createHash|fs\.write|writeQrFile|process\.env\[[^\]]*TOKEN/);
  assert.doesNotMatch(stage5, /method: 'DELETE'|should_soft_delete|grant_type=refresh_token/);
});

test('Stage 5 probes are GET-only, zero-row bounded, body-suppressed, and followed by bounded SQL support', () => {
  const probeStart = helper.indexOf('async function probeOldToken(');
  const probeEnd = helper.indexOf('\nfunction clearSessionSecrets', probeStart);
  const probe = helper.slice(probeStart, probeEnd);
  assert.match(probe, /\/auth\/v1\/user/);
  assert.match(probe, /\/rest\/v1\/reports\?select=id&limit=0/);
  assert.doesNotMatch(probe, /method:\s*'(?:POST|PUT|PATCH|DELETE)'/);
  assert.match(probe, /restAccepted.*Array\.isArray\(rest\.data\).*rest\.data\.length !== 0/s);
  assert.doesNotMatch(probe.slice(probe.indexOf('return {')), /\.data|response body/i);
  assert.match(evidenceSql, /requested_session_count/);
  assert.match(evidenceSql, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(evidenceSql, /WHERE x\.user_id = s\.user_id AND s\.session_id IS NOT NULL AND x\.id = s\.session_id/);
  assert.doesNotMatch(evidenceSql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
});

test('Stage 6 requires explicit authorization and rejects a session UUID credential', () => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const unauthorized = spawnSync(shell, ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root, paths.ps1),
    '-Mode','RemoveFactor',
    '-TestUserId','11111111-1111-4111-8111-111111111111',
    '-FactorId','22222222-2222-4222-8222-222222222222'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(unauthorized.status, 0);
  assert.match(`${unauthorized.stdout}\n${unauthorized.stderr}`, /without -AuthorizeProductionMutation/);
  const start = ps1.indexOf("'RemoveFactor' {");
  const end = ps1.indexOf("\n    'RecoverUnverifiedTotpFactor' {", start);
  const dispatch = ps1.slice(start, end);
  assert.match(dispatch, /if \(\$SessionId\)/);
  assert.match(dispatch, /-SessionId is not accepted as a removal credential/);
  assert.match(dispatch, /Require-TestEmail; Require-TestUserId; Require-FactorId; Require-PublishableKey; Require-AdminKey; Require-OperatorPassword; Require-TotpCode/);
});

test('Stage 6 validates the exact live marked user and exact verified TOTP factor before mutation', () => {
  const start = helper.indexOf('async function removeFactor()');
  const end = helper.indexOf('\nasync function recoverUnverifiedTotpFactor()', start);
  const stage6 = helper.slice(start, end);
  const userRead = stage6.indexOf('/auth/v1/admin/users/${encodeURIComponent(userId)}`');
  const marker = stage6.indexOf('gridly_operator_test !== TEST_LABEL');
  const deleted = stage6.indexOf('user?.deleted_at');
  const factorList = stage6.indexOf('/factors`');
  const cardinality = stage6.indexOf('matching.length !== 1');
  const ownership = stage6.indexOf('exactFactor.user_id');
  const type = stage6.indexOf("factorType !== 'totp'");
  const status = stage6.indexOf("exactFactor.status !== 'verified'");
  const signIn = stage6.indexOf('await signIn(');
  assert.ok(userRead >= 0 && marker > userRead && deleted > marker && factorList > deleted);
  assert.ok(cardinality > factorList && ownership > cardinality && type > ownership && status > type && signIn > status);
  assert.match(stage6, /requireUuid\(env\('GRIDLY_RESPONDER_TEST_USER_ID'\)/);
  assert.match(stage6, /requireUuid\(env\('GRIDLY_RESPONDER_FACTOR_ID'\)/);
});

test('Stage 6 creates one pre-removal password session and proves same-session TOTP aal2', () => {
  const start = helper.indexOf('async function removeFactor()');
  const end = helper.indexOf('\nasync function recoverUnverifiedTotpFactor()', start);
  const stage6 = helper.slice(start, end);
  const deleteIndex = stage6.indexOf("label: 'Delete exact verified Stage 6 TOTP factor'");
  const beforeDelete = stage6.slice(0, deleteIndex);
  assert.equal((beforeDelete.match(/await signIn\(/g) || []).length, 1);
  assert.equal((beforeDelete.match(/await elevateTotp\(/g) || []).length, 1);
  assert.match(beforeDelete, /aal1Claims\.session_id !== staleClaims\.session_id/);
  assert.match(beforeDelete, /staleClaims\.aal !== 'aal2'/);
  assert.match(beforeDelete, /amr_methods\.includes\('password'\)/);
  assert.match(beforeDelete, /amr_methods\.includes\('totp'\)/);
  assert.match(beforeDelete, /const preRemovalProbe = await probeOldToken\(baseUrl, staleAccessToken\)/);
  assert.match(beforeDelete, /preRemovalProbe\.auth_user_http_status !== 200/);
  assert.match(beforeDelete, /!preRemovalProbe\.postgrest_jwt_accepted/);
  assert.match(beforeDelete, /preRemovalProbe\.postgrest_zero_rows_confirmed !== true/);
  assert.match(beforeDelete, /!preRemovalExpStillInFuture/);
});

test('Stage 6 uses one exact Admin factor deletion and no user-side deletion, logout, or session deletion', () => {
  const start = helper.indexOf('async function removeFactor()');
  const end = helper.indexOf('\nasync function recoverUnverifiedTotpFactor()', start);
  const stage6 = helper.slice(start, end);
  assert.equal((stage6.match(/method: 'DELETE'/g) || []).length, 1);
  assert.match(stage6, /\/auth\/v1\/admin\/users\/\$\{encodeURIComponent\(userId\)\}\/factors\/\$\{encodeURIComponent\(factorId\)\}/);
  assert.doesNotMatch(stage6, /request\(baseUrl, `\/auth\/v1\/factors\/\$\{encodeURIComponent\(factorId\)\}`,[\s\S]*method: 'DELETE'/);
  assert.doesNotMatch(stage6, /\/auth\/v1\/logout|should_soft_delete|\/sessions\//);
  assert.doesNotMatch(stage6, /(?:INSERT|UPDATE|DELETE)\s+(?:FROM|INTO)\s+auth\.(?:sessions|refresh_tokens)/i);
  assert.doesNotMatch(stage6, /writeQrFile|friendly_name|factor_type:\s*'totp'/);
  assert.doesNotMatch(stage6, /\/rest\/v1\/[^'`?]+(?:\?|`)[\s\S]*method:\s*'(?:POST|PUT|PATCH|DELETE)'/);
  assert.match(stage6, /explicit_logout_performed: false/);
  assert.match(stage6, /explicit_session_delete_performed: false/);
  assert.match(stage6, /user_delete_performed: false/);
  assert.match(stage6, /factor_replacement_performed: false/);
  assert.match(stage6, /factorDelete\.data = null/);
});

test('Stage 6 reuses the same old tokens, attempts refresh once, and signs in once after removal', () => {
  const start = helper.indexOf('async function removeFactor()');
  const end = helper.indexOf('\nasync function recoverUnverifiedTotpFactor()', start);
  const stage6 = helper.slice(start, end);
  const deleteIndex = stage6.indexOf("label: 'Delete exact verified Stage 6 TOTP factor'");
  const afterDelete = stage6.slice(deleteIndex);
  assert.match(afterDelete, /const postRemovalProbe = await probeOldToken\(baseUrl, staleAccessToken\)/);
  assert.match(stage6, /same_token_reused: true/);
  assert.equal((stage6.match(/grant_type=refresh_token/g) || []).length, 1);
  assert.match(stage6, /body: \{ refresh_token: staleRefreshToken \}/);
  assert.match(stage6, /attempted: true, accepted: true/);
  assert.match(stage6, /attempted: true, accepted: false/);
  assert.equal((afterDelete.match(/await signIn\(/g) || []).length, 1);
  assert.ok(afterDelete.indexOf('grant_type=refresh_token') < afterDelete.indexOf('fresh = await signIn'));
});

test('Stage 6 output is allowlisted and all secret-bearing references are cleared', () => {
  const start = helper.indexOf('async function removeFactor()');
  const end = helper.indexOf('\nasync function recoverUnverifiedTotpFactor()', start);
  const stage6 = helper.slice(start, end);
  const returnStart = stage6.indexOf('return {');
  const returnEnd = stage6.indexOf('\n    };', returnStart);
  const safeOutput = stage6.slice(returnStart, returnEnd);
  for (const field of ['pre_removal','admin_factor_delete','post_removal_old_access_token','old_refresh',
    'fresh_password_sign_in','postgrest_zero_rows_confirmed','sub_sha256_16']) {
    assert.match(safeOutput, new RegExp(field), field);
  }
  assert.doesNotMatch(safeOutput, /staleAccessToken|staleRefreshToken|refreshResponse|adminKey|Authorization|claim_names/);
  assert.doesNotMatch(stage6, /createHash|fs\.write|writeQrFile|process\.stdout|console\.log/);
  assert.match(stage6, /finally \{[\s\S]*staleAccessToken = null;[\s\S]*staleRefreshToken = null;/);
  for (const value of ['refreshResponse?.data','fresh','aal2','aal1']) assert.match(stage6, new RegExp(`clearSessionSecrets\\(${value.replace('?', '\\?')}\\)`));
  for (const name of ['GRIDLY_RESPONDER_TEST_PASSWORD','GRIDLY_RESPONDER_TOTP_CODE','GRIDLY_SUPABASE_PUBLISHABLE_KEY',
    'GRIDLY_SUPABASE_SECRET_KEY','GRIDLY_SUPABASE_SERVICE_ROLE_KEY']) assert.match(stage6, new RegExp(name));
  const dispatcherCleanup = ps1.slice(ps1.indexOf("if ($Mode -eq 'RemoveFactor')"));
  for (const name of ['GRIDLY_RESPONDER_TEST_PASSWORD','GRIDLY_SUPABASE_PUBLISHABLE_KEY',
    'GRIDLY_SUPABASE_SECRET_KEY','GRIDLY_SUPABASE_SERVICE_ROLE_KEY']) assert.match(dispatcherCleanup, new RegExp(name));
  assert.match(dispatcherCleanup, /SetEnvironmentVariable\(\$Name, \$null, \[EnvironmentVariableTarget\]::Process\)/);
});

test('Stage 6 retains bounded read-only reset correlation and documents outcome classification', () => {
  assert.match(evidenceSql, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(evidenceSql, /requested_session_count/);
  assert.match(evidenceSql, /'aal', x\.aal/);
  assert.match(evidenceSql, /'factor_id', x\.factor_id/);
  assert.match(evidenceSql, /auth\.mfa_amr_claims/);
  assert.doesNotMatch(evidenceSql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i);
  assert.match(doc, /OUTCOME A[^\n]*SESSION REVOKED/i);
  assert.match(doc, /OUTCOME B[^\n]*SESSION SURVIVES BUT IS DOWNGRADED/i);
  assert.match(doc, /OUTCOME C[^\n]*UNEXPECTED STATE/i);
  assert.match(doc, /one old-refresh-token grant attempt/i);
  assert.match(doc, /one post-removal password sign-in/i);
  assert.match(doc, /Cleanup, replacement enrollment, session revocation, and user deletion remain separately authorized/);
});

test('integer-second cutoff rejects the observed and same-second token', () => {
  const result = spawnSync(process.execPath, [path.join(root, paths.helper),'simulate-cutoff','1700000000','1700000001'], {
    cwd: root, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.minimum_iat, 1700000001);
  assert.equal(evidence.old_token_allowed, false);
  assert.equal(evidence.same_second_reissue_allowed, false);
  assert.equal(evidence.equality_at_boundary_allowed, true);
  assert.equal(evidence.candidate_new_token_allowed, true);
  assert.equal(evidence.comparison, 'jwt.iat >= minimum_iat');
});

test('runbook covers every stage, recovery state, evidence return and B01 decision', () => {
  for (let stage = 0; stage <= 10; stage += 1) assert.match(doc, new RegExp(`Stage ${stage} —`), `stage ${stage}`);
  for (const heading of ['Purpose.','Preconditions.','Expected output.','Pass condition.','Fail condition.','Rollback / stop.','Paste back.']) {
    assert.match(doc, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), heading);
  }
  for (const state of ['User exists, no session/factor','User + AAL1 session','User + TOTP factor, not verified',
    'User + verified factor','User + AAL2 session','Session revoked','Factor removed','Partial cleanup']) {
    assert.ok(doc.includes(state), state);
  }
  assert.match(doc, /candidate C with precision clarified/);
  assert.match(doc, /B01 can close only after owner evidence proves/);
  assert.match(doc, /Any missing production observation leaves B01 open/);
});
