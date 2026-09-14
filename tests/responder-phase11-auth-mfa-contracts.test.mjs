import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const docPath='docs/RESPONDER/RESPONDER-PHASE11-AUTH-MFA-PRODUCTION-MAPPING-AUDIT.md';
const doc=read(docPath);
const matrix=JSON.parse(read('reports/responder/responder-phase11-auth-mfa-matrix.json'));
const phase8=JSON.parse(read('reports/responder/responder-phase8-vector-map.json'));

test('local baseline and B01 scope are explicit, without claiming production proof',()=>{
  assert.equal(matrix.startingHead,'1395849f43ea9a6c455adcebfb20d4bde800736a');
  assert.deepEqual(matrix.frozenVectors,{complete:54,total:54});
  assert.equal(phase8.counts.totalComplete,54);
  assert.equal(matrix.b01Status,'RESOLVED LOCALLY — PRODUCTION CAPABILITY VERIFICATION REQUIRED');
  assert.match(matrix.releaseGate,/BLOCKED until production Auth/);
  assert.equal(doc.trimEnd().split('\n').at(-1),
    'B01 RESOLVED LOCALLY — PRODUCTION CAPABILITY VERIFICATION REQUIRED');
  assert.match(doc,/No Supabase or production endpoint was contacted/);
  assert.match(doc,/actual project before implementation/);
  assert.match(doc,/No Supabase access, production SQL, migration, deployment, stage, commit, push or merge/);
});

test('Auth inventory is real local evidence and separates fixture from public app',()=>{
  const byPath=new Map(matrix.inventory.map(x=>[x.path,x]));
  assert.equal(byPath.size,matrix.inventory.length);
  for(const row of matrix.inventory) {
    assert.ok(fs.existsSync(path.join(root,row.path)),row.path);
    assert.ok(['CURRENT PRODUCTION-INTENDED APP CODE — NO RESPONDER AUTH','LEGACY / UNUSED','FIXTURE-ONLY',
      'RESPONDER-ONLY LOCAL DESIGN'].includes(row.classification),row.classification);
    for(const key of ['authUsed','authUid','authJwt','mfaAal','clientSessionPersisted',
      'privilegedClientClaimsTrusted','appFacingServiceRole'])
      assert.equal(typeof row[key],'boolean',`${row.path}: ${key}`);
  }
  const app=read('js/app.js');
  const config=read('supabase/config.toml');
  const geocode=read('supabase/functions/gridly-geocode/index.ts');
  const phase2=read('db/responder-local/002_phase2_auth_membership_apply.sql');
  const phase4=read('db/responder-local/004_phase4_rls_authorization_apply.sql');
  assert.match(app,/supabase\.createClient|sdk\.createClient/);
  assert.doesNotMatch(app,/supabaseClient\.auth\.|supabase\.auth\./);
  assert.match(config,/verify_jwt = false/);
  assert.match(geocode,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(geocode,/persistSession: false/);
  assert.match(phase2,/local_auth_identities/);
  assert.match(phase2,/session_epoch/);
  assert.match(phase4,/phase4_session_bindings/);
  assert.match(phase4,/session_user/);
  assert.ok(doc.includes('not an Auth session'));
});

test('trust model and all seven stale-token defenses stay live',()=>{
  const claimNames=new Set(matrix.claims.map(x=>x.input));
  for(const name of ['user UUID / JWT sub','JWT aal','app role','organization ID',
    'membership status','organization state and verification','county authority',
    'update author','governance status','session epoch / invalid-before',
    'publishing eligibility']) assert.ok(claimNames.has(name),name);
  for(const row of matrix.claims) assert.ok(['SAFE TO TRUST FROM VERIFIED JWT',
    'MUST RECHECK IN LIVE DATABASE','MUST NEVER COME FROM CLIENT CLAIM'].includes(row.classification));
  assert.equal(matrix.staleJwtCases.length,7);
  assert.ok(matrix.staleJwtCases.some(x=>/MFA/.test(x.case)&&/old JWT denied/.test(x.defense)));
  assert.match(doc,/old signed `aal2` is insufficient after reset/);
  assert.match(doc,/without refresh/);
});

test('every privileged family enforces fresh aal2 and separate governance',()=>{
  assert.equal(matrix.privilegedPaths.length,6);
  for(const row of matrix.privilegedPaths.filter(x=>x.path!=='aal1 bootstrap'))
    assert.match(row.rule,/aal2/);
  assert.match(doc,/including VIEWER/);
  assert.match(doc,/distinct qualified activator/);
  assert.match(doc,/No agency role grants governance authority/);
  assert.match(doc,/target's fresh `aal2`/);
  assert.match(doc,/Auth factor recovery/);
  assert.match(doc,/Lost Agency Admin recovery/);
});

test('historical actor references cannot cascade and acceptance cases cover role/session edges',()=>{
  assert.equal(matrix.authForeignKeys.length,8);
  for(const row of matrix.authForeignKeys.slice(1)) assert.match(row.strategy,/no cascading Auth FK/);
  const cases=matrix.productionAcceptance.map(x=>x.case);
  for(const key of ['VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN','GRIDLY_ADMIN',
    'suspended','revoked','unknown','stale aal2','deleted Auth','wrong account'])
    assert.ok(cases.some(x=>x.includes(key)),key);
  assert.ok(matrix.productionAcceptance.length>=18);
  assert.ok(matrix.migrationImplications.some(x=>x.classification==='FIXTURE-ONLY REMOVE'));
  assert.ok(matrix.ownerDecisions.length>=3);
});

test('local Markdown links resolve and audit adds no production SQL',()=>{
  const links=[...doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(x=>x[1]);
  assert.ok(links.length>=15);
  for(const link of links) {
    assert.ok(!link.includes('://'),link);
    assert.ok(fs.existsSync(path.resolve(root,path.dirname(docPath),link)),link);
  }
  assert.deepEqual(matrix.inventory.filter(x=>x.path.startsWith('supabase/migrations/')),[]);
  assert.ok(!fs.existsSync(path.join(root,'supabase/migrations/011_responder_auth_apply.sql')));
});
