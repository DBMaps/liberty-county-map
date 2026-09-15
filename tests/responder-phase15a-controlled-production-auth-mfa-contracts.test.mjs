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
  for (const mode of ['CreateTestUser','InspectAal1','EnrollTotp','VerifyTotp','RevokeSession','RemoveFactor','Cleanup']) {
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
