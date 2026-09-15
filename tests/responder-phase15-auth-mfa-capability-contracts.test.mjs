import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const docPath='docs/RESPONDER/RESPONDER-PHASE15-PRODUCTION-AUTH-MFA-CAPABILITY-AUDIT.md';
const evidencePath='reports/responder/responder-phase15-production-auth-mfa-capability.json';
const doc=read(docPath);
const evidence=JSON.parse(read(evidencePath));

test('Phase 15 preserves the exact baseline and gives a bounded decision',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE15-production-auth-mfa-capability-audit');
  assert.equal(evidence.startingHead,'5adf3d01e4c44ae30f8c12cd4c55f796022bceaf');
  assert.equal(evidence.decision,'CONDITIONAL GO');
  assert.equal(evidence.b01Disposition,'OPEN');
  assert.match(doc,/Historical Phase 15 blocker disposition: B01 OPEN/);
  assert.equal(doc.trimEnd().split('\n').at(-1),'B01 CLOSED WITH IMPLEMENTATION REQUIREMENTS — PHASE 15A PRODUCTION VERIFICATION COMPLETE');
});

test('production evidence is read-only, aggregate-only, and secret-free',()=>{
  assert.equal(evidence.production.transactionReadOnly,'on');
  assert.equal(evidence.production.serverVersion,'17.6');
  assert.equal(evidence.production.responderSchemaCount,0);
  assert.deepEqual(evidence.production.finalReadOnlyConfirmation,{
    capturedAt:'2026-09-15T12:26:04.181947Z',transactionReadOnly:'on',
    authUsers:0,authSessions:0,authRefreshTokens:0,authMfaFactors:0,
    authMfaAmrClaims:0,responderSchemaCount:0
  });
  assert.deepEqual(evidence.production.exactCounts,{
    'auth.users':0,'auth.sessions':0,'auth.refresh_tokens':0,
    'auth.mfa_factors':0,'auth.mfa_amr_claims':0
  });
  assert.equal(evidence.productionMutations,'NONE');
  assert.equal(evidence.secretsExposed,'NONE');
  const generated=doc+read(evidencePath);
  assert.doesNotMatch(generated,/postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{30,}/);
});

test('actual UUID, AAL, factor, session and helper shapes are captured',()=>{
  assert.match(evidence.production.types['auth.users.id'],/^uuid/);
  assert.deepEqual(evidence.production.enumValues['auth.factor_type'],['totp','webauthn','phone']);
  assert.deepEqual(evidence.production.enumValues['auth.factor_status'],['unverified','verified']);
  assert.deepEqual(evidence.production.enumValues['auth.aal_level'],['aal1','aal2','aal3']);
  assert.match(evidence.production.helpers['auth.uid()'],/sub cast to uuid/);
  assert.match(evidence.production.helpers['auth.jwt()'],/jsonb/);
});

test('capability matrix distinguishes direct support, adapters, operations and follow-up',()=>{
  const statuses=new Set(evidence.capabilities.map(x=>x.status));
  for(const status of ['SUPPORTED DIRECTLY','SUPPORTED WITH ADAPTER','REQUIRES OPERATIONAL CONTROL','REQUIRES CONTROLLED FOLLOW-UP VERIFICATION'])
    assert.ok(statuses.has(status),status);
  for(const required of ['immutable Auth UUID identity','aal2 visible to PostgreSQL','TOTP capability',
    'TOTP-specific method evidence','session_id and live session check','iat cutoff','factor reset / emergency offboarding',
    'individual GRIDLY_ADMIN mapping','browser/service-role separation'])
    assert.ok(evidence.capabilities.some(x=>x.requirement===required),required);
  for(const classification of ['SUPPORTED DIRECTLY','SUPPORTED WITH ADAPTER',
    'REQUIRES OPERATIONAL CONTROL','REQUIRES CONTROLLED FOLLOW-UP VERIFICATION'])
    assert.ok(doc.includes(`**${classification}**`),classification);
  assert.match(doc,/No B01 element is blocked by a missing database primitive/);
});

test('minimum freshness predicate requires TOTP, live session, cutoff and live authority',()=>{
  const predicate=evidence.minimumFreshnessDesign.requestPredicate.join('\n');
  for(const required of ['auth.uid()','aal2','method totp','session_id','auth.sessions','iat','valid_after',
    'principal is enabled','live membership']) assert.match(predicate,new RegExp(required.replace(/[.()]/g,'\\$&'),'i'),required);
  assert.ok(evidence.minimumFreshnessDesign.notRequired.includes('security_epoch claim'));
  assert.equal(evidence.minimumFreshnessDesign.securityEventOrder.length,4);
});

test('all seven stale-session cases and Phase 16 fail-closed constraints are present',()=>{
  for(let i=1;i<=7;i++) assert.match(doc,new RegExp(`\\| ${i}\\.`),`case ${i}`);
  for(const term of ['SET search_path = \'\'','default `PUBLIC` execute revoked','No production signature accepts',
    'GRIDLY_ADMIN uses a separate','currently observed `aal3` as unsupported/fail-closed']) assert.ok(doc.includes(term),term);
  assert.match(doc,/`aal2` means that some second factor was used; it does not identify which one/);
});

test('repository browser boundary remains publishable-client/server-secret separated',()=>{
  const app=read('js/app.js');
  const shell=read('index.html');
  const edge=read('supabase/functions/gridly-geocode/index.ts');
  assert.match(app,/SUPABASE_PUBLIC_KEY/);
  assert.doesNotMatch(app,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  assert.doesNotMatch(shell,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  assert.match(edge,/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(edge,/persistSession: false/);
});

test('local document links resolve and no responder production migration exists',()=>{
  const links=[...doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(x=>x[1]).filter(x=>!x.includes('://'));
  assert.ok(links.length>=8);
  for(const link of links) assert.ok(fs.existsSync(path.resolve(root,path.dirname(docPath),link)),link);
  assert.ok(!fs.readdirSync(path.join(root,'supabase/migrations')).some(x=>/responder/i.test(x)));
  assert.equal(evidence.pushed,false);
  assert.equal(evidence.merged,false);
});
