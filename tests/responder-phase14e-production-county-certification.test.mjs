import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const evidence=JSON.parse(read('reports/responder/responder-phase14e-production-county-certification.json'));
const recovery=JSON.parse(read('reports/responder/responder-phase14b-recovery-checkpoint-evidence.json'));
const docPath='docs/RESPONDER/RESPONDER-PHASE14E-PRODUCTION-COUNTY-POPULATION.md';
const doc=read(docPath);

test('Phase 14E binds the successful run to the approved baseline',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE14E-production-county-population-final');
  assert.equal(evidence.starting_head,'7e6fae898da67c3163f5ff6ea637484eaf9159fc');
  assert.equal(evidence.required_ancestor,'ff22161701512ff661f178534cb75884f1c75dd7');
  assert.equal(evidence.required_ancestor_confirmed,true);
  assert.equal(evidence.outcome,'PRODUCTION COUNTY POPULATION CERTIFIED — B03 RESOLVED');
  assert.equal(evidence.evidence_origin,
    'OWNER_CERTIFIED_SUCCESSFUL_PRODUCTION_RUN_MATERIALIZED_LOCALLY_WITHOUT_DATABASE_ACCESS');
});

test('certified source and transaction-neutral payload remain exact locally',()=>{
  const input=evidence.certified_input;
  const source=execFileSync('git',['cat-file','blob',`HEAD:${input.source_path}`],
    {cwd:root,maxBuffer:20*1024*1024});
  const payload=fs.readFileSync(path.join(root,input.payload_path));
  assert.equal(sha(source),input.source_sha256);
  assert.equal(payload.length,input.payload_bytes);
  assert.equal(sha(payload),input.payload_sha256);
  const sql=payload.toString('utf8');
  assert.equal(sql.match(/^INSERT INTO public\.gridly_texas_county_boundaries /gm)?.length,254);
  assert.doesNotMatch(sql,/^\s*(?:BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|UPDATE|DELETE|MERGE)\b/im);
  assert.doesNotMatch(sql,/\bON\s+CONFLICT\b|\bUPSERT\b/i);
});

test('recovery gate and fresh production preflight are recorded as passed',()=>{
  assert.equal(recovery.retry_gate,'PHASE 14 RETRY RECOVERY GATE SATISFIED');
  assert.equal(evidence.recovery_gate.classification,'PHASE 14 RETRY RECOVERY GATE SATISFIED');
  const p=evidence.production_preflight;
  assert.equal(p.status,'PASS');
  assert.equal(p.observed_at,'2026-09-15T02:21:38.250888Z');
  assert.equal(p.authentication,'OWNER_POSTGRES');
  assert.equal(p.postgres_version,'17.6');
  assert.equal(p.postgis_version,'3.3.7');
  assert.equal(p.target.row_count,0);
  assert.equal(p.target.gist_index_valid,true);
  assert.equal(p.target.rls_enabled,true);
  assert.equal(p.target.policy_count,0);
  assert.equal(p.target.user_trigger_count,0);
  assert.equal(p.migrations.count,14);
  assert.equal(p.controls.reporting_enabled,false);
});

test('one backend and one transaction committed the authorized target transition',()=>{
  const x=evidence.production_execution;
  assert.equal(x.status,'COMMITTED_ONCE');
  assert.equal(x.session_count,1);
  assert.equal(x.backend_pid,2430731);
  assert.equal(x.write_transaction_count,1);
  assert.equal(x.transaction_id,27645);
  assert.equal(x.lock_mode,'ShareRowExclusiveLock');
  assert.equal(x.payload_transport,'PSQL_BACKSLASH_I');
  assert.equal(x.target_rows_before,0);
  assert.equal(x.target_rows_after,254);
  assert.equal(x.certification_gate,'PASS');
  assert.equal(x.commit_count,1);
  assert.equal(x.second_write_attempted,false);
});

test('postcommit FIPS certification is exact',()=>{
  const p=evidence.postcommit_certification;
  assert.equal(p.status,'PASS');
  assert.equal(p.observed_at,'2026-09-15T02:26:18.907971Z');
  assert.equal(p.rows,254);
  assert.equal(p.unique_fips,254);
  assert.equal(p.fips_sha256,'7e80dd17d4d295d904f986a193ab259850e607c6bdfde3a7454e9af5a54a2092');
  assert.equal(p.minimum_fips,'48001');
  assert.equal(p.maximum_fips,'48507');
  assert.equal(p.exact_texas_fips_sequence,true);
  assert.equal(p.null_fips,0);
});

test('postcommit geometry and provenance certification are exact',()=>{
  const p=evidence.postcommit_certification;
  assert.equal(p.null_geometry,0);
  assert.equal(p.null_version,0);
  assert.equal(p.wrong_srid,0);
  assert.equal(p.wrong_geometry_type,0);
  assert.equal(p.invalid_geometry,0);
  assert.equal(p.coordinate_pairs,604979);
  assert.deepEqual(p.statewide_bounds,[-106.645646,25.837048,-93.508039,36.500704]);
  assert.equal(p.boundary_version,'lp148-owner-built-statewide-runtime-geometry-v1');
  assert.equal(p.ordered_table_digest,'54f42bb9795dd2f4f6f743a14b4d86e7');
});

test('strict responder boundary semantics pass fail-closed',()=>{
  const b=evidence.postcommit_certification.strict_boundary;
  assert.equal(b.liberty_interior_strictly_contained,true);
  assert.equal(b.liberty_chambers_shared_boundary_touches,true);
  assert.equal(b.shared_boundary_strictly_contained_by_liberty,false);
  assert.equal(b.chambers_interior_authorizes_liberty,false);
});

test('production integrity and unrelated bounded state remain unchanged',()=>{
  const p=evidence.postcommit_certification;
  for(const key of ['gist_index_unchanged','table_shape_unchanged','rls_unchanged',
    'grants_unchanged','policies_unchanged','triggers_unchanged',
    'migration_history_unchanged','reporting_controls_unchanged_and_disabled',
    'publishing_controls_unchanged_and_disabled','responder_schemas_absent',
    'bounded_unrelated_counts_unchanged']) assert.equal(p[key],true,key);
  assert.equal(evidence.production_change_inventory.authorized_rows_inserted,254);
  assert.equal(evidence.production_change_inventory.unintended_production_mutation,false);
});

test('P12-01 and B03 close without responder activation or publishing',()=>{
  assert.equal(evidence.p12_01,'CLOSED');
  assert.equal(evidence.b03,'CLOSED');
  assert.equal(evidence.b03_classification,'PRODUCTION_SHARED_COUNTY_SOURCE_VERIFIED');
  assert.equal(evidence.responder_activation,'NONE');
  assert.equal(evidence.agency_publishing,'DISABLED');
  assert.equal(evidence.production_change_inventory.responder_schema_created,false);
  assert.equal(evidence.production_change_inventory.responder_rpc_deployed,false);
});

test('materialization itself performed no production or database access',()=>{
  assert.equal(evidence.production_or_supabase_access_during_local_materialization,false);
  assert.equal(evidence.psql_or_database_query_during_local_materialization,false);
});

test('all Phase 14E local Markdown links resolve',()=>{
  const full=path.join(root,docPath);
  for(const match of doc.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
    if(/^https?:\/\//.test(match[1])) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),
      `broken local link ${match[1]}`);
  }
});

test('Phase 14E evidence contains no credential-bearing material',()=>{
  const combined=doc+'\n'+JSON.stringify(evidence);
  assert.doesNotMatch(combined,/postgres(?:ql)?:\/\/[^\s]+/i);
  assert.doesNotMatch(combined,/SUPABASE_(?:ACCESS_TOKEN|SERVICE_ROLE|DB_PASSWORD)/i);
  assert.doesNotMatch(combined,/BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/i);
  assert.doesNotMatch(combined,/eyJ[A-Za-z0-9_-]{20,}/);
});
