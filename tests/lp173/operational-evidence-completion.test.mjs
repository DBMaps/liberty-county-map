import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, validate, verify } from '../../tools/lp173/complete-operational-evidence.mjs';
import template from '../../evidence/lp173/owner-evidence.template.json' with { type: 'json' };

const fact = (classification, value = 'metadata value') => ({ classification, collectionMethod: 'metadata-only collection', evidenceType: 'governed operational metadata', source: 'owner-supplied source description', sourceArtifactIdentity: null, sourceReportedTime: null, value, verificationMethod: classification === 'OWNER_ATTESTED' ? 'owner attestation review' : 'machine metadata comparison' });

test('missing evidence fails closed field-by-field', () => {
  const reports = build(undefined, structuredClone(template));
  const summary = reports['lp173-summary.json'];
  assert.equal(summary.evidenceClassification, 'EVIDENCE_INCOMPLETE');
  assert.equal(summary.authorizationReassessment, 'NOT_READY_FOR_AUTHORIZATION_REASSESSMENT');
  assert.equal(summary.ownerActionRequiredFacts.length, 24);
});

test('partial evidence completes only supported fields and preserves provenance distinctions', () => {
  const input = structuredClone(template);
  input.monitoring.monitoringProviders = fact('MACHINE_VERIFIED');
  input.operationalOwnership.primaryOperationalOwner = fact('OWNER_ATTESTED', 'role: primary operations owner');
  const summary = build(undefined, input)['lp173-summary.json'];
  assert.deepEqual(summary.machineVerifiedFacts, ['monitoring.monitoringProviders']);
  assert.deepEqual(summary.ownerAttestedFacts, ['operationalOwnership.primaryOperationalOwner']);
  assert.ok(summary.ownerActionRequiredFacts.includes('backup.backupProvider'));
  assert.equal(summary.evidenceClassification, 'EVIDENCE_INCOMPLETE');
});

test('malformed, unknown, unsupported, incomplete, and secret-shaped input fails closed', () => {
  const unknown = structuredClone(template); unknown.monitoring.extra = {};
  assert.throws(() => validate(unknown), /schema is invalid/);
  const unsupported = structuredClone(template); unsupported.monitoring.monitoringProviders.classification = 'PASS';
  assert.throws(() => validate(unsupported), /schema is invalid/);
  const incomplete = structuredClone(template); incomplete.monitoring.monitoringProviders = fact('MACHINE_VERIFIED'); incomplete.monitoring.monitoringProviders.source = null;
  assert.throws(() => validate(incomplete), /lacks provenance/);
  const unsafe = structuredClone(template); unsafe.backup.backupProvider = fact('OWNER_ATTESTED', 'password=do-not-echo');
  assert.throws(() => validate(unsafe), error => !error.message.includes('do-not-echo'));
  assert.throws(() => validate(null), /invalid/);
});

test('LP173 never authorizes or performs an operation', () => {
  const report = build(undefined, structuredClone(template))['launch-authorization-readiness-report.json'];
  assert.equal(report.authorizationGranted, false);
  assert.ok(Object.values(report.authorizations).every(value => value === 'NOT_AUTHORIZED'));
  assert.ok(Object.values(report.operationsPerformed).every(value => value === 0));
});

test('protected identity is canonical Git-blob based and deterministic output is canonical', () => {
  const summary = build(undefined, structuredClone(template))['lp173-summary.json'];
  assert.equal(summary.validation.protectedGitBlobIdentities, 'PASS');
  assert.equal(summary.validation.protectedIdentityProvenance.identitySource, 'CANONICAL_GIT_BLOB');
  assert.equal(summary.validation.protectedIdentityProvenance.workingTreeIgnored, true);
  assert.ok(summary.protectedArtifacts.every(item => item.classification === 'PASS'));
  assert.equal(verify(), true);
  for (const name of ['operational-evidence-completion-report.json', 'launch-authorization-readiness-report.json', 'lp173-summary.json']) {
    const bytes = fs.readFileSync(new URL(`../../reports/lp173/${name}`, import.meta.url));
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(bytes.includes(13), false);
  }
});
