import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { AUTHORIZATIONS, build, verify } from '../../tools/lp180/build-web-pwa-foundation.mjs';

const index = fs.readFileSync('index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const worker = fs.readFileSync('service-worker.js', 'utf8');

test('hostname gate explicitly allows candidate hosts and fails closed otherwise', () => {
  for (const host of ['gridlygo.com', 'www.gridlygo.com', 'preview.gridlygo.com']) assert.match(index, new RegExp(`"${host.replaceAll('.', '\\.')}"`));
  assert.match(index, /productionCandidateHosts\.indexOf\(hostname\) !== -1/);
  assert.match(index, /window\.location\.replace\(target\)/);
  assert.match(index, /hostname === "localhost"[\s\S]*hostname === "127\.0\.0\.1"/);
});

test('PWA paths and scope remain relative and origin portable', () => {
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.every(icon => icon.src.startsWith('./')));
  assert.match(index, /rel="manifest" href="manifest\.json"/);
  assert.match(worker, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(worker, /fetch\(request, \{ cache: "no-store" \}\)/);
});

test('reports preserve authorizations and report zero production operations', () => {
  const reports = build(); const summary = reports['lp180-summary.json']; const domain = reports['gridlygo-domain-readiness.json'];
  assert.ok(Object.values(AUTHORIZATIONS).every(value => value === 'NOT_AUTHORIZED'));
  assert.deepEqual(summary.authorizations, AUTHORIZATIONS);
  assert.ok(Object.values(domain.operationsPerformed).every(value => value === 0));
  assert.equal(summary.protectedRuntimeBusinessLogicChanged, false);
  assert.equal(summary.physicalDeviceValidationExecuted, false);
});

test('committed reports are deterministic, canonical, and secret-safe', () => assert.equal(verify(), true));
