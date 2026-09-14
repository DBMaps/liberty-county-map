import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {audit} from '../tools/responder-local/audit-phase10-county-sources.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const matrix=JSON.parse(fs.readFileSync(path.join(root,
  'reports/responder/responder-phase10-county-source-matrix.json'),'utf8'));
const docPath=path.join(root,'docs/RESPONDER/RESPONDER-PHASE10-COUNTY-SOURCE-DECISION-AUDIT.md');
const doc=fs.readFileSync(docPath,'utf8');
const result=audit();

test('frozen Git blob hash and 254-county identity stay exact',()=>{
  assert.equal(result.frozenCanonicalGitBlob.sha256,
    '6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49');
  assert.equal(result.frozenCanonicalGitBlob.bytes,13934264);
  assert.equal(result.candidates.responderFrozen.count,254);
  assert.equal(result.candidates.responderFrozen.uniqueFips,254);
  assert.deepEqual(result.candidates.responderFrozen.invalidFips,[]);
  assert.equal(matrix.frozen.canonicalGitBlobSha256,result.frozenCanonicalGitBlob.sha256);
});

test('shared runtime and LP137 have exact frozen coordinates by FIPS',()=>{
  for(const key of ['lp137','sharedRuntime']){
    const c=result.candidates[key];
    assert.equal(c.count,254);
    assert.equal(c.uniqueFips,254);
    assert.equal(c.duplicateFips,0);
    assert.deepEqual(c.invalidFips,[]);
    assert.deepEqual(c.versusFrozen.missingFips,[]);
    assert.deepEqual(c.versusFrozen.extraFips,[]);
    assert.equal(c.versusFrozen.exactGeometryMatches,254);
    assert.equal(c.versusFrozen.geometryDifferentCount,0);
    assert.equal(c.geometry.points,604979);
    assert.equal(c.geometry.closedRings,254);
    assert.deepEqual(c.geometry.coordinateDimensions,[2,2]);
    assert.equal(c.geometry.invalidCoordinates,0);
  }
  assert.equal(result.candidates.sharedRuntime.sha256,
    '891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316');
  assert.equal(matrix.comparison.sharedVsFrozenExactGeometryMatches,254);
});

test('synthetic cartographic and older per-county files are not substitutes',()=>{
  assert.equal(result.candidates.cartographic.versusFrozen.exactGeometryMatches,0);
  assert.equal(result.candidates.cartographic.geometry.points,1270);
  assert.equal(result.perCountyBoundaryFiles.count,28);
  assert.equal(result.perCountyBoundaryFiles.exactFrozenGeometryMatches,0);
  assert.equal(result.perCountyBoundaryFiles.differentFips.length,28);
  assert.deepEqual(result.perCountyBoundaryFiles.missing,[]);
  assert.deepEqual(matrix.perCountyBoundaryFiles,result.perCountyBoundaryFiles.entries);
  assert.equal(result.candidates.legacyLiberty.count,1);
  assert.deepEqual(result.candidates.legacyLiberty.versusFrozen.geometryDifferentFips,['48291']);
});

test('decision retains strict responder boundary semantics and production block',()=>{
  assert.equal(matrix.recommendation,'REUSE EXISTING GRIDLY COUNTY GEOMETRY');
  assert.equal(matrix.b03Status,'STILL BLOCKED');
  const responderSql=fs.readFileSync(path.join(root,
    'db/responder-local/003_phase3_county_authority_apply.sql'),'utf8');
  const consumer=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
  assert.match(responderSql,/ST_Touches\(geometry,p_point\)/);
  assert.match(responderSql,/ST_Contains\(geometry,p_point\)/);
  assert.match(consumer,/inclusive-deterministic-lowest-county-id/);
  assert.match(doc,/Geometry reuse is \*\*not resolver reuse\*\*/);
  assert.equal(doc.trimEnd().split('\n').at(-1),
    'REUSE EXISTING GRIDLY COUNTY GEOMETRY');
});

test('matrix has all required criteria and no unstated production proof',()=>{
  const names=matrix.criteria.map(x=>x.criterion);
  assert.equal(new Set(names).size,names.length);
  for(const name of ['Canonicality','254-county completeness','FIPS stability',
    'Geometry equivalence','Boundary semantics','Versioning','Provenance',
    'Authorization fitness','Maintenance','Storage','Migration complexity',
    'Auditability','Rollback','Operational simplicity','Risk of drift','Test impact'])
    assert.ok(names.includes(name),name);
  assert.match(doc,/production county table's actual existence/);
  assert.match(doc,/activateRuntimeAuthorized=false and deployAuthorized=false/);
});

test('all audit Markdown links resolve within the local repository',()=>{
  const links=[...doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(x=>x[1]);
  assert.ok(links.length>=20);
  for(const link of links){
    assert.ok(!link.includes('://'),link);
    assert.ok(fs.existsSync(path.resolve(path.dirname(docPath),link)),link);
  }
});
