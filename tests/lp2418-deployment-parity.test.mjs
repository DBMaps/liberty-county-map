import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('LP241.8 current build identity remains bound to audited application sources', async () => {
  const [identity, pkg, indexBytes, app, sw] = await Promise.all([
    readJson('reports/lp2418/current-build-identity.json'),
    readJson('package.json'),
    readFile(new URL('../index.html', import.meta.url)),
    readText('js/app.js'),
    readText('service-worker.js')
  ]);
  const index = indexBytes.toString('utf8').replace(/^\uFEFF/, '');

  assert.equal(identity.packageVersion, pkg.version);
  assert.equal(identity.appVersion, /GRIDLY_APP_VERSION_LABEL = "([^"]+)"/.exec(app)?.[1]);
  assert.equal(identity.appScriptVersion, /<script src="js\/app\.js\?v=([^"]+)"/.exec(index)?.[1]);
  assert.equal(identity.serviceWorkerVersion, /GRIDLY_SW_VERSION = "([^"]+)"/.exec(sw)?.[1]);
  assert.equal(identity.serviceWorkerCache, /GRIDLY_CLOSURE_CACHE_NAME = "([^"]+)"/.exec(sw)?.[1]);
  assert.equal(identity.sourceHashes.indexHtmlSha256, sha256(indexBytes));
  assert.equal(identity.sourceHashes.appScriptSha256, sha256(app));
  assert.equal(identity.sourceHashes.serviceWorkerSha256, sha256(sw));
});

test('LP241.8 fails closed when live authenticated remote identity is unavailable', async () => {
  const parity = await readJson('reports/lp2418/deployment-parity.json');
  assert.equal(parity.performsDeployment, false);
  assert.equal(parity.currentRemoteObservation.accountStateInspected, false);
  assert.equal(parity.currentRemoteObservation.remoteBytesInspected, false);
  assert.equal(parity.classification, 'AUTHENTICATED_OWNER_EVIDENCE_REQUIRED');
  assert.equal(parity.lastProvenArtifactComparison, 'VERSION_SKEW_CONFIRMED');
  assert.equal(parity.lastRepositoryProvenRemote.gitIntegration, false);
  assert.equal(parity.lastRepositoryProvenRemote.automaticDeployment, false);
  assert.notEqual(parity.currentApproved.gitCommit, parity.lastRepositoryProvenRemote.sourceCommit);
});
