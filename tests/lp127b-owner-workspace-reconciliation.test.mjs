import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readEvidence = async (name) => JSON.parse(await readFile(new URL(`../evidence/lp127b/${name}`, import.meta.url), 'utf8'));
const inventory = await readEvidence('owner-source-data-logical-inventory.json');
const reconciliation = await readEvidence('lp127a-reconciliation-report.json');
const readiness = await readEvidence('source-manufacturing-readiness-report.json');

test('LP127B retains the governed owner-workspace inventory totals', () => {
  assert.equal(inventory.summary.physicalFileCount, 521);
  assert.equal(inventory.summary.physicalByteSize, 49056740181);
  assert.equal(inventory.summary.hashedPhysicalFileCount, 284);
  assert.equal(inventory.records.length, 336);
});

test('LP127B reconciles the TxGIO source as owner-local and present', () => {
  const txgio = reconciliation.records.find(({ lp127aGap }) => lp127aGap === 'TxGIO StratMap 2026 statewide address geodatabase');
  assert.ok(txgio);
  assert.equal(txgio.status, 'RESOLVED_PRESENT_IN_OWNER_WORKSPACE');
  assert.equal(txgio.ownerWorkspacePath, 'Texas-Address-Points/Raw/Texas-2026.gdb');
});

test('LP127B recommendation remains the three-county TxGIO wave without authorization', () => {
  assert.deepEqual(readiness.recommendedNextWave.targetCounties, ['Lee', 'Milam', 'Robertson']);
  assert.equal(readiness.recommendedNextWave.physicalSourcePath, 'Texas-Address-Points/Raw/Texas-2026.gdb');
  assert.deepEqual(readiness.recommendedNextWave.prohibitedActions, [
    'manufacturing in LP127B',
    'candidate activation',
    'production approval',
    'runtime integration'
  ]);
});
