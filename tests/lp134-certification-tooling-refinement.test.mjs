import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const evidence = JSON.parse(await readFile(new URL('../evidence/lp134/certification-results.json', import.meta.url)));

test('LP134 reconciles the statewide baseline and rerun without changing artifact identities', () => {
  assert.equal(evidence.previous.pass + evidence.previous.fail, 254);
  assert.equal(evidence.current.pass + evidence.current.fail, 254);
  assert.equal(evidence.current.pass - evidence.previous.pass, evidence.resolved.length);
  for (const county of evidence.rerunCounties) {
    assert.equal(county.before.packageSha256, county.after.packageSha256);
    assert.equal(county.before.packageSize, county.after.packageSize);
    assert.equal(county.before.sidecarSha256, county.after.sidecarSha256);
    assert.equal(county.after.status, 'PASS');
  }
});

test('LP134 records a deterministic reason for every county still blocked', () => {
  assert.equal(evidence.remaining.length, evidence.current.fail);
  assert.ok(evidence.remaining.every(item => item.reasonCode === 'LOCAL_PACKAGE_UNAVAILABLE'));
});
