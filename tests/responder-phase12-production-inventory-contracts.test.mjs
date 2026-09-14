import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const inventoryPath='reports/responder/responder-phase12-production-schema-inventory.json';
const collisionPath='reports/responder/responder-phase12-collision-matrix.json';
const docPath='docs/RESPONDER/RESPONDER-PHASE12-PRODUCTION-SCHEMA-INVENTORY.md';
const inventory=JSON.parse(read(inventoryPath));
const collision=JSON.parse(read(collisionPath));
const doc=read(docPath);

test('production evidence is read-only, bounded and attached to the approved baseline',()=>{
  assert.equal(inventory.branch,'RESPONDER-PHASE12-production-schema-inventory');
  assert.equal(inventory.startingHead,'3952342e7334b56b09495d341b0fef15d9bcfa30');
  assert.equal(inventory.connection.transactionReadOnly,'on');
  assert.match(inventory.connection.verification,/BEGIN TRANSACTION READ ONLY/);
  assert.equal(inventory.noProductionWriteIssued,true);
  assert.equal(inventory.connection.serverVersion,'17.6');
  assert.equal(inventory.connection.postgisVersion,'3.3.7');
  assert.equal(inventory.status.b02,'B02 RESOLVED — PRODUCTION SCHEMA INVENTORY COMPLETE');
  assert.equal(doc.trimEnd().split('\n').at(-1),inventory.status.b02);
});

test('catalog inventory has exact schema, object and metadata counts',()=>{
  assert.deepEqual(inventory.counts,{
    nonSystemSchemas:12,relations:72,applicationColumns:182,
    applicationConstraints:72,applicationIndexes:36,
    applicationFunctions:15,applicationPolicies:7,
    applicationTriggers:9,deployedMigrations:14,trackedMigrations:14
  });
  for(const schema of ['auth','storage','public','history_capture','report_retention',
    'gridly_control','supabase_migrations']) assert.ok(inventory.schemas.some(x=>x.name===schema));
  assert.ok(!inventory.schemas.some(x=>x.name==='agency_private'||x.name==='responder_public'));
  for(const obj of ['public.reports','public.gridly_feedback',
    'public.gridly_texas_county_boundaries','report_retention.observation_receipts',
    'history_capture.historical_events'])
    assert.ok(inventory.objects.some(x=>x.schema+'.'+x.name===obj),obj);
  assert.equal(inventory.objects.find(x=>x.schema==='public'&&x.name==='reports').exactRows,0);
  assert.equal(inventory.objects.find(x=>x.schema==='public'&&x.name==='gridly_feedback').exactRows,7);
  assert.equal(inventory.objects.find(x=>x.schema==='public'&&x.name==='gridly_texas_county_boundaries').exactRows,0);
});

test('B03 stays blocked because deployed county table is empty despite compatible metadata',()=>{
  assert.equal(inventory.county.rows,0);
  assert.equal(inventory.county.uniqueFips,0);
  assert.equal(inventory.county.frozenLocalCountyCount,254);
  assert.equal(inventory.status.countyEquivalence,'PRODUCTION EQUIVALENCE NOT PROVEN');
  assert.match(inventory.status.b03,/STILL BLOCKED/);
  assert.ok(inventory.indexes.some(x=>x.object==='public.gridly_texas_county_boundaries'&&/USING gist \(geom\)/.test(x.definition)));
  assert.ok(inventory.columns.some(x=>x.object==='public.gridly_texas_county_boundaries'&&x.name==='geom'&&x.type==='geometry(MultiPolygon,4326)'));
  assert.ok(inventory.newBlockers.some(x=>x.id==='P12-01'));
});

test('tracked and deployed migration IDs and names match exactly',()=>{
  const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql'));
  const tracked=files.map(x=>({version:x.split('_')[0],name:x.slice(x.indexOf('_')+1,-4)}))
    .sort((a,b)=>a.version.localeCompare(b.version));
  assert.deepEqual(inventory.migrationHistory,tracked);
  assert.deepEqual(inventory.migrationComparison.trackedNotDeployed,[]);
  assert.deepEqual(inventory.migrationComparison.deployedNotTracked,[]);
  assert.deepEqual(inventory.migrationComparison.nameMismatches,[]);
  assert.equal(inventory.migrationComparison.orderingMatch,true);
});

test('Auth, ACL, RLS and receipt boundaries are represented without user data',()=>{
  assert.equal(inventory.authMetadata.usersObjectPresent,true);
  assert.deepEqual(new Set(inventory.authMetadata.functions.map(x=>x.name)),
    new Set(['uid','jwt','email','role']));
  assert.deepEqual(inventory.authMetadata.applicationForeignKeysToAuthUsers,[]);
  assert.equal(inventory.functions.filter(x=>x.securityDefiner).length,8);
  assert.equal(inventory.policies.filter(x=>x.object==='public.reports').length,5);
  assert.ok(inventory.objects.filter(x=>['public','gridly_control','history_capture','report_retention'].includes(x.schema)&&['r','p'].includes(x.kind)).every(x=>x.rls&&!x.forceRls));
  assert.ok(inventory.columnGrants.some(x=>x.object==='public.reports'&&x.column==='id'&&x.anonSelect));
  assert.ok(inventory.tableGrants.some(x=>x.object==='public.reports'&&!x.anonSelect));
  assert.ok(inventory.constraints.some(x=>x.object==='report_retention.observation_receipts'&&x.deleteAction==='c'));
  assert.equal(inventory.controls.reportingEnabled,false);
  assert.equal(inventory.controls.agencyPublishingObjectExists,false);
  assert.equal(inventory.controls.cronObjectExists,false);
});

test('collision matrix and local document retain distinct responder domains',()=>{
  assert.equal(collision.rows.length,21);
  assert.equal(collision.exactCollisionCount,0);
  assert.equal(collision.semanticCollisionCount,10);
  assert.ok(collision.rows.every(x=>!x.exactNameExists));
  for(const name of ['agency_private.agency_updates','agency_private.agency_operation_receipts',
    'agency_private.agency_program_controls','agency_private.county_geometry_catalog',
    'responder_public.agency_updates projection'])
    assert.ok(collision.rows.some(x=>x.proposedObject===name&&x.productionCollision==='SEMANTIC COLLISION'),name);
  for(const name of ['agency_private.local_auth_identities','agency_private.phase4_session_bindings'])
    assert.match(collision.rows.find(x=>x.proposedObject===name).migrationImplication,/FIXTURE-ONLY REMOVE/);
  assert.match(doc,/No mutation statement was issued/);
  assert.match(doc,/row count is zero/i);
});

test('all audit links resolve and generated evidence contains no connection secrets',()=>{
  const links=[...doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(x=>x[1]);
  assert.ok(links.length>=10);
  for(const link of links){
    assert.ok(!link.includes('://'),link);
    assert.ok(fs.existsSync(path.resolve(root,path.dirname(docPath),link)),link);
  }
  const generated=read(inventoryPath)+read(collisionPath)+doc;
  assert.doesNotMatch(generated,/SUPABASE_SERVICE_ROLE_KEY\s*[:=]|postgresql:\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{40,}\.eyJ[A-Za-z0-9_-]{40,}/);
  assert.ok(!fs.existsSync(path.join(root,'supabase/migrations/012_responder_production_apply.sql')));
});
