import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { audit, ROOT } from '../tools/lp18811/audit-regression-authorities.mjs';

test('fails closed on both missing governed authorities without disturbing state', () => {
  const ownerPath = `${ROOT}/evidence/lp18811/execution-results/owner-result.json`;
  const before = crypto.createHash('sha256').update(fs.readFileSync(ownerPath)).digest('hex');
  const result = audit();
  assert.equal(result.waveId, 'LP18810-NP-001');
  assert.equal(result.targetCountyCount, 215);
  assert.equal(result.wave0Audit.governedComparisonAuthorityFound, false);
  assert.equal(result.wave0Audit.planningCountyCount, 28);
  assert.equal(result.defectAudit.governedAuthorityFound, false);
  assert.equal(result.runner.implemented, false);
  assert.equal(result.runner.executionCommand, null);
  assert.deepEqual(result.state, {deploymentId:'lp18811c-c5cc6370-412c-487e-b3d3-3ff8350b6f98',buildIdentity:'sha256:1f277cfa3a7512d3df8dd0ec11bdf54bfcfd98b45e140b45640e8e50156979a5',currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0,runtimeOperationalCountChanged:false,restrictedCountyStateChanged:false});
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ownerPath)).digest('hex'), before);
});

test('committed audit is deterministic and contains no execution or mutation capability', () => {
  const expected = JSON.parse(fs.readFileSync(`${ROOT}/reports/lp18811f1/regression-authority-audit.json`, 'utf8'));
  assert.deepEqual(audit(), expected);
  const source = fs.readFileSync(`${ROOT}/tools/lp18811/audit-regression-authorities.mjs`, 'utf8');
  for (const forbidden of ['fetch(', 'supabase', 'wrangler', 'activateCounty', 'CF-Access-Client-Secret']) assert.equal(source.includes(forbidden), false);
});
