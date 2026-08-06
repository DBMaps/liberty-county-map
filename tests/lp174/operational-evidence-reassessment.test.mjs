import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REPORT_NAMES, build, verify } from '../../tools/lp174/reassess-operational-readiness.mjs';

test('LP174 truthfully remains fail closed when authoritative evidence is absent', () => {
  const reports = build();
  const summary = reports['operational-evidence-summary.json'];
  const reassessment = reports['authorization-reassessment-report.json'];
  assert.equal(summary.classification, 'EVIDENCE_INCOMPLETE');
  assert.equal(summary.blockerCounts.total, 10);
  assert.equal(summary.blockerCounts.ownerActionRequired, 0);
  assert.equal(summary.ownerAttestedFacts.length, 14);
  assert.equal(reassessment.authorizationReassessment, 'NOT_READY_FOR_AUTHORIZATION_REASSESSMENT');
  assert.equal(reassessment.authorizationGranted, false);
  assert.ok(Object.values(reassessment.authorizations).every(value => value === 'NOT_AUTHORIZED'));
});

test('LP174 reports are canonical, metadata-only, and deterministic', () => {
  assert.equal(verify(), true);
  const reports = build();
  assert.equal(reports['operational-evidence-summary.json'].metadataOnly, true);
  assert.equal(reports['deterministic-validation-report.json'].classification, 'PASS');
  for (const name of REPORT_NAMES) {
    const bytes = fs.readFileSync(path.join('reports/lp174', name));
    assert.notEqual(bytes[0], 0xef);
    assert.equal(bytes.includes(13), false);
  }
});
