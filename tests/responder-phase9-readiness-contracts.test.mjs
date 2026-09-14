import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const docPath=path.join(root,'docs/RESPONDER/RESPONDER-PHASE9-PRODUCTION-READINESS-AUDIT.md');
const doc=fs.readFileSync(docPath,'utf8');
const matrix=JSON.parse(fs.readFileSync(path.join(root,
  'reports/responder/responder-phase9-readiness-matrix.json'),'utf8'));
const phase8=JSON.parse(fs.readFileSync(path.join(root,
  'reports/responder/responder-phase8-vector-map.json'),'utf8'));
const blockerIds=Array.from({length:13},(_,i)=>`B${String(i+1).padStart(2,'0')}`);

test('readiness decision is scoped to planning and 54 frozen vectors',()=>{
  assert.equal(matrix.decision,'CONDITIONAL GO');
  assert.match(matrix.decisionScope,/planning only; no deployment authorization/);
  assert.equal(matrix.baseline.startingHead,'df21c4baf8c8154f58fb61b9bf099cc2e9c254df');
  assert.equal(phase8.counts.total,54);
  assert.equal(phase8.counts.totalComplete,54);
  assert.deepEqual(matrix.baseline.frozenVectors,{complete:54,total:54});
  assert.equal(doc.trimEnd().split('\n').at(-1),
    'PRODUCTION IMPLEMENTATION PLANNING: CONDITIONAL GO');
});

test('all blockers and minimum readiness areas are mapped exactly once',()=>{
  assert.deepEqual(matrix.blockers,blockerIds);
  const areas=matrix.areas.map(row=>row.area);
  assert.equal(new Set(areas).size,areas.length);
  for(const area of ['Schema','Auth','MFA','Membership','Authority','RLS','Commands',
    'Governance','Receipts','Rate limit','Consumer projection','Dashboard','Email',
    'Backups','Retention','Monitoring','Hosting','DNS/TLS','Rollback','Pilot'])
    assert.ok(areas.includes(area),area);
  for(const row of matrix.areas){
    for(const key of ['localCertification','productionTranslationStatus','blocker',
      'requiredAction','risk','ownerDecisionNeeded','deploymentPhase'])
      assert.ok(row[key]?.length,key+' for '+row.area);
    for(const id of row.blocker) assert.ok(blockerIds.includes(id),id);
  }
  for(const id of blockerIds){
    assert.match(doc,new RegExp(`\\| ${id} \\|`));
    assert.ok(matrix.areas.some(row=>row.blocker.includes(id)),id);
  }
});

test('audit preserves hard production boundaries',()=>{
  for(const phrase of ['No Supabase or production endpoint was contacted',
    'No production migration or deployment is authorized','gate=false',
    'local_auth_identities','phase4_session_bindings','BYPASSRLS',
    'public.gridly_texas_county_boundaries','AGENCY_OFFICIAL',
    '60 successful activations','responders.gridlygo.com'])
    assert.ok(doc.includes(phrase),phrase);
  assert.ok(!fs.existsSync(path.join(root,'supabase/migrations',
    '009_responder_production_apply.sql')));
});

test('all relative Markdown file and directory links resolve locally',()=>{
  const links=[...doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match=>match[1]);
  assert.ok(links.length>=20);
  for(const link of links){
    assert.ok(!link.includes('://'),'unexpected remote link '+link);
    assert.ok(fs.existsSync(path.resolve(path.dirname(docPath),link)),link);
  }
});

test('local certified baseline is not mislabeled as live production proof',()=>{
  assert.match(doc,/CONDITIONAL GO for guarded production implementation planning only/);
  assert.match(doc,/actual deployed completeness/);
  assert.match(doc,/unknown\*\*, not passed/);
  assert.match(doc,/explicit owner publishing authorization/);
});
