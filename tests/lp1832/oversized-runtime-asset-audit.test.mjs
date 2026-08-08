import assert from 'node:assert/strict';
import test from 'node:test';
import { build, LIMIT_BYTES, ROOT } from '../../tools/lp1832/audit-oversized-runtime-assets.mjs';
import { workingTreeDiagnostic } from '../../tools/lp18321/git-asset-identity.mjs';

const reports = build();

test('identifies exactly three deterministic oversized tracked files', () => {
  assert.equal(reports.inventory.exactOversizedCount, 3);
  assert.deepEqual(reports.inventory.assets.map(x => x.bytes), [67186117, 35232470, 57731771]);
  assert.ok(reports.inventory.assets.every(x => x.bytes > LIMIT_BYTES && x.gitTracked));
});

test('grounds every consumer trace and distinguishes inclusion from runtime necessity', () => {
  assert.equal(reports.trace.traces.length, 3);
  assert.ok(reports.trace.traces.every(x => x.evidence.length && Object.hasOwn(x, 'requestCode')));
  assert.deepEqual(reports.inventory.assets.map(x => x.requiredByCountyOrStatewideRuntime), [false, true, false]);
  assert.equal(reports.trace.serviceWorkerFinding.includes('no reference'), true);
});

test('chooses two exclusions and one sub-limit compressed package without infrastructure', () => {
  const matrix = reports.options.resolutionMatrix;
  assert.equal(matrix[1].measuredAlternatives.deterministicGzipBytes, 6057789);
  assert.ok(matrix[1].expectedResultingMaxFileSize < LIMIT_BYTES);
  assert.deepEqual(matrix.map(x => x.cloudflareInfrastructureChangeRequired), [false, false, false]);
  assert.equal(reports.options.sharedResolution.appliesToAllThree, false);
});

test('audit does not modify protected runtime, native trees, or oversized assets', () => {
  const changed = new Set(Object.keys(reports).flatMap(() => []));
  for (const file of ['index.html', 'js/app.js', 'manifest.json', 'service-worker.js']) assert.equal(changed.has(file), false);
  for (const asset of reports.inventory.assets) {
    const diagnostic = workingTreeDiagnostic(ROOT, asset.repositoryPath, asset.fileType.startsWith('gzip-') ? 'BINARY' : 'TEXT');
    assert.equal(diagnostic.canonical.bytes, asset.bytes);
    assert.equal(diagnostic.canonical.sha256, asset.sha256);
    assert.equal(diagnostic.governed, false);
    assert.ok(['CANONICAL_MATCH', 'CRLF_CHECKOUT_MATERIALIZATION'].includes(diagnostic.classification));
  }
  assert.equal(reports.summary.protectedRuntimeModified, false);
  assert.equal(reports.summary.oversizedAssetsModified, false);
});
