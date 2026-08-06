import test from 'node:test';
import assert from 'node:assert/strict';
import { build, encode, validateEvidence, verify, OWNER_ACTION_REQUIRED } from '../../tools/lp172/collect-owner-operational-evidence.mjs';
import input from '../../evidence/lp172/owner-operational-evidence.json' with { type: 'json' };

test('unknown owner evidence remains explicit and fail closed', () => { const reports = build(); const summary = reports['owner-operational-evidence-summary.json']; assert.equal(summary.overallClassification, OWNER_ACTION_REQUIRED); assert.equal(summary.ownerActionRequired, true); assert.ok(['monitoring', 'backup', 'ownership', 'rollback', 'launchOperations'].every(key => summary[key] === OWNER_ACTION_REQUIRED)); });
test('LP172 never authorizes or performs production operations', () => { const summary = build()['owner-operational-evidence-summary.json']; assert.equal(summary.validation.deployment, 'NOT_AUTHORIZED'); assert.equal(summary.validation.activation, 'NOT_AUTHORIZED'); assert.equal(summary.validation.launchAuthorization, 'NOT_AUTHORIZED'); assert.ok(Object.values(summary.operationsPerformed).every(value => value === 0)); });
test('evidence is metadata-only and protected blobs are unchanged', () => { const reports = build(); assert.ok(Object.values(reports).every(report => report.metadataOnly)); assert.equal(reports['owner-operational-evidence-summary.json'].validation.protectedGitBlobIdentities, 'PASS'); });
test('secret-shaped evidence is rejected without echoing it', () => { const unsafe = structuredClone(input); unsafe.backup.backupProvider = 'password' + '=do-not-echo'; assert.throws(() => validateEvidence(unsafe), error => !error.message.includes('do-not-echo')); });
test('canonical reports are stable LF UTF-8 and match generated output', () => { assert.equal(encode({ b: 1, a: 2 }), encode({ a: 2, b: 1 })); assert.ok(!encode(input).includes('\r')); assert.equal(verify(), true); });
