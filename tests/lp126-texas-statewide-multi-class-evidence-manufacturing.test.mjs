import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { EVIDENCE_CLASSES, TERMINAL_OUTCOMES, manufacture, seal } from '../tools/lp126/lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const artifact = JSON.parse(await readFile(path.join(root, 'evidence/lp126/texas-statewide-multi-class-evidence.json')));

test('manufactures exactly 254 counties, 8 classes, and 2,032 unique cells', () => {
  assert.equal(artifact.countyCount, 254); assert.deepEqual(artifact.evidenceClasses, EVIDENCE_CLASSES); assert.equal(artifact.matrixCellCount, 2032); assert.equal(artifact.matrix.length, 2032);
  assert.equal(new Set(artifact.matrix.map(x => `${x.countyFips}:${x.evidenceClass}`)).size, 2032);
  assert.ok(artifact.matrix.every(x => TERMINAL_OUTCOMES.includes(x.terminalOutcome)));
});

test('reconciles LP124, LP125, and limited LP122 evidence without invention', () => {
  assert.equal(artifact.summary.acceptedRecordsByClass.GOVERNMENT, 254); assert.equal(artifact.summary.outcomesByClass.GOVERNMENT.EVIDENCE_ACQUIRED, 254);
  assert.equal(artifact.summary.acceptedRecordsByClass.PUBLIC_SAFETY, 254); assert.equal(artifact.summary.outcomesByClass.PUBLIC_SAFETY.EVIDENCE_ACQUIRED, 253); assert.equal(artifact.summary.outcomesByClass.PUBLIC_SAFETY.REVIEW_REQUIRED, 1);
  const young = artifact.records.find(x => x.evidenceClass === 'PUBLIC_SAFETY' && x.county === 'Young County'); assert.equal(young.sourceEntries.length, 2);
  const yoakum = artifact.records.find(x => x.evidenceClass === 'PUBLIC_SAFETY' && x.county === 'Yoakum County'); assert.equal(yoakum.reviewStatus, 'REVIEW_REQUIRED'); assert.equal(yoakum.reconciliationIssue, 'COUNTY_NOT_REPRESENTED_AT_LATEST_REPORTING_DATE');
  for (const c of ['COMMUNITY', 'DESTINATION']) { assert.equal(artifact.summary.acceptedRecordsByClass[c], 3); assert.equal(artifact.summary.outcomesByClass[c].REVIEW_REQUIRED, 3); assert.equal(artifact.summary.outcomesByClass[c].SOURCE_UNAVAILABLE, 251); }
});

test('preserves complete provenance, nulls, deterministic IDs, and production boundary', () => {
  const required = ['recordId','evidenceClass','assertionType','county','countyFips','officialName','sourcePublisher','sourceUrl','sourceArtifactSha256','observationDate','evidenceDate','sourcePriority','confidence','reviewStatus','reviewer','acquisitionMethod','jurisdictionLevel','countyContainment'];
  for (const record of artifact.records) { for (const key of required) assert.ok(Object.hasOwn(record, key), `${record.recordId}.${key}`); assert.equal(record.candidateApproval, false); assert.equal(record.productionAuthorization, false); assert.equal(record.runtimeEligible, false); }
  assert.ok(artifact.records.some(x => x.evidenceDate === null)); assert.ok(artifact.records.every(x => x.reviewer === null)); assert.equal(new Set(artifact.records.map(x => x.recordId)).size, artifact.records.length);
  for (const cell of artifact.matrix) { assert.equal(cell.candidateApproval, false); assert.equal(cell.productionAuthorization, false); assert.equal(cell.runtimeEligible, false); }
  assert.deepEqual(artifact.summary.productionBoundary, { runtimeModified:false, countiesActivated:false, evidenceUploaded:false, supabaseStorageMutated:false, deployed:false, protectedSystemsModified:false, candidateApproval:false, productionAuthorization:false });
});

test('registry and source inventory state roles and truthful owner gaps', async () => {
  const registry = JSON.parse(await readFile(path.join(root, 'evidence/lp126/adapter-registry.json'))); const inventory = JSON.parse(await readFile(path.join(root, 'evidence/lp126/source-inventory.json')));
  assert.equal(registry.adapters.length, 8); assert.deepEqual(registry.adapters.map(x => x.evidenceClass), EVIDENCE_CLASSES); assert.ok(registry.adapters.every(x => x.runtimeIsolated && x.deterministic));
  assert.ok(inventory.sources.every(x => ['CONTROL_INVENTORY','ACQUISITION_SOURCE','CORROBORATING_SOURCE','UNSUPPORTED'].includes(x.role)));
  assert.deepEqual(registry.adapters.filter(x => !x.enabled).map(x => x.evidenceClass), ['HEALTHCARE','EDUCATION','TRANSPORTATION','PARK']);
});

test('summary and seal reconcile deterministically', async () => {
  const { seal: artifactSeal, ...body } = artifact; assert.equal(artifactSeal.value, seal(body));
  const rerun = await manufacture({ root }); assert.deepEqual(rerun, artifact);
  assert.equal(Object.values(artifact.summary.acceptedRecordsByClass).reduce((a,b)=>a+b,0), artifact.records.length);
});

test('partial adapter failure is isolated and output writes are idempotent', async () => {
  const failed = await manufacture({ root, adapterFailure: 'PUBLIC_SAFETY' }); assert.equal(failed.summary.outcomesByClass.PUBLIC_SAFETY.FAIL, 254); assert.equal(failed.summary.outcomesByClass.GOVERNMENT.EVIDENCE_ACQUIRED, 254);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lp126-')); const output = path.join(dir, 'result.json'); const cli = path.join(root, 'tools/lp126/manufacture-statewide-evidence.mjs');
  execFileSync(process.execPath, [cli, '--source-root', root, '--output', output]); const first = await readFile(output, 'utf8'); execFileSync(process.execPath, [cli, '--source-root', root, '--output', output, '--resume']); assert.equal(await readFile(output, 'utf8'), first);
});
