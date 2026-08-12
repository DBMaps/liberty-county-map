import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const AUDIT_PATH = 'reports/lp190/restricted-county-lp130-recovery-audit.json';
const EXPECTED = ['48061','48073','48113','48121','48135','48229','48329','48377','48401','48425','48441'];
const EXACT = new Set(['EXACT_GOVERNED_PAYLOAD_RECOVERABLE_FROM_REPOSITORY','EXACT_GOVERNED_PAYLOAD_RECOVERABLE_FROM_GIT_HISTORY','EXACT_GOVERNED_PAYLOAD_PRESENT_REQUIRES_RECONCILIATION']);
const ALLOWED = new Set([...EXACT,'OWNER_LOCAL_EVIDENCE_REQUIRED','EXTERNAL_SOURCE_RECOVERY_REQUIRED','INSUFFICIENT_EVIDENCE_FAIL_CLOSED']);
const PROTECTED = ['js/app.js','assets/package-registry/runtime-package-registry.json','js/gridlyPackageRegistry.js','assets/location-resolution/gridly-authoritative-county-geometry-v1.json','assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json'];
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gitBlob = (commit, path) => git(['rev-parse', `${commit}:${path}`]);
const gitBlobBytes = blob => execFileSync('git', ['cat-file', 'blob', blob], { maxBuffer: 1024 * 1024 * 1024 });
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export function verifyLp190() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  assert.equal(audit.counties.length, 11, 'exactly 11 counties must be audited');
  assert.deepEqual(audit.counties.map(c => c.countyFips).sort(), EXPECTED, 'restricted FIPS set drifted');
  assert.equal(audit.baseline.operationalCountyCount, 243);
  assert.equal(audit.baseline.restrictedCountyCount, 11);
  assert.equal(audit.noCountyActivated, true);
  assert.equal(audit.protectedProduction.changed, false);
  assert.equal(audit.protectedProduction.operationalCountyCount, 243);
  assert.equal(audit.protectedProduction.restrictedCountyCount, 11);
  assert.equal(audit.protectedProduction.identitySource, 'CANONICAL_GIT_BLOB');
  assert.equal(audit.protectedProduction.workingTreeBytes, 'IGNORED');
  assert.equal(audit.protectedProduction.baselineCommit, audit.baseline.commit);
  assert.equal(audit.protectedProduction.comparisonCommit, 'HEAD');
  for (const county of audit.counties) {
    assert.ok(ALLOWED.has(county.recoveryClassification), `invalid classification for ${county.countyFips}`);
    assert.match(county.expectedSha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(county.expectedByteLength) && county.expectedByteLength > 0);
    if (EXACT.has(county.recoveryClassification)) {
      assert.equal(county.exactByteIdentityProven, true, `exact claim lacks byte proof for ${county.countyFips}`);
      assert.ok(county.repositoryArtifactPath || (county.historicalGitCommit && county.historicalGitPath && county.historicalGitBlobIdentity), `exact claim lacks concrete identity for ${county.countyFips}`);
    } else {
      assert.equal(county.exactByteIdentityProven, false, `unknown evidence must remain fail-closed for ${county.countyFips}`);
    }
  }
  for (const path of PROTECTED) {
    const recorded = audit.protectedProduction.files[path];
    const expectedGitBlob = gitBlob(audit.protectedProduction.baselineCommit, path);
    const actualGitBlob = gitBlob(audit.protectedProduction.comparisonCommit, path);
    assert.equal(recorded.expectedGitBlob, expectedGitBlob, `recorded baseline Git blob identity drifted: ${path}`);
    assert.equal(recorded.actualGitBlob, actualGitBlob, `recorded HEAD Git blob identity drifted: ${path}`);
    assert.equal(recorded.expectedCanonicalBlobContentSha256, sha256(gitBlobBytes(expectedGitBlob)), `recorded baseline canonical blob SHA-256 drifted: ${path}`);
    assert.equal(recorded.actualCanonicalBlobContentSha256, sha256(gitBlobBytes(actualGitBlob)), `recorded HEAD canonical blob SHA-256 drifted: ${path}`);
    assert.equal(recorded.pass, expectedGitBlob === actualGitBlob, `recorded protected identity result is inconsistent: ${path}`);
    assert.equal(actualGitBlob, expectedGitBlob, `protected production surface changed: ${path}`);
  }
  return { pass: true, auditedCountyCount: 11, operationalCountyCount: 243, restrictedCountyCount: 11, exactRecoveryClaims: audit.counties.filter(c => EXACT.has(c.recoveryClassification)).length, protectedProductionSurfaceChanges: 0 };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) console.log(JSON.stringify(verifyLp190(), null, 2));
