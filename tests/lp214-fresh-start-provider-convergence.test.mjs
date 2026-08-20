import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const activationSource = fs.readFileSync('js/gridlyOfficialProviderActivation.js', 'utf8');

function runtime(configured) {
  let resolveReady;
  const calls = { starts: 0, fetches: 0 };
  const listeners = {};
  const sandbox = {
    Promise, Date, Object,
    setTimeout(callback) { callback(); return 1; },
    performance: { now: () => 1 },
    gridlyConfigurationReadiness: { started: true, completed: false },
    gridlyConfigurationReady: new Promise(resolve => { resolveReady = resolve; }),
    gridlyDriveTexasConnector: { startPolling() { calls.starts += 1; }, fetchNow() { calls.fetches += 1; } },
    gridlyWeatherConnector: { startPolling() {} },
    gridlyDriveTexasConnectorRuntimeAudit: () => ({ apiKeyConfigured: configured.value, configurationSource: configured.value ? 'GRIDLY_CONFIG.driveTexas.apiKey' : 'none', lastFetchSucceeded: false }),
    addEventListener(name, callback) { listeners[name] = callback; }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(activationSource, sandbox);
  return { sandbox, calls, resolveReady, listeners };
}

test('fresh start waits for configuration readiness before provider activation', async () => {
  const configured = { value: true };
  const rt = runtime(configured);
  assert.equal(rt.calls.starts, 0);
  rt.resolveReady();
  await Promise.resolve();
  assert.equal(rt.calls.starts, 1);
  assert.equal(rt.sandbox.gridlyOfficialProviderActivation.audit().stages.configurationResolution.completed, true);
});

test('delayed configuration recovers through the existing fetch lifecycle', async () => {
  const configured = { value: false };
  const rt = runtime(configured);
  rt.resolveReady();
  await Promise.resolve();
  assert.equal(rt.sandbox.gridlyOfficialProviderActivation.audit().stages.configurationResolution.failed, true);
  configured.value = true;
  rt.listeners['gridly:configuration-ready']();
  assert.equal(rt.calls.fetches, 1);
  assert.equal(rt.sandbox.gridlyOfficialProviderActivation.audit().stages.configurationResolution.completed, true);
});

test('configuration absence remains truthful and does not manufacture connectivity', async () => {
  const configured = { value: false };
  const rt = runtime(configured);
  rt.resolveReady();
  await Promise.resolve();
  const audit = rt.sandbox.gridlyOfficialProviderActivation.audit();
  assert.equal(audit.stages.configurationResolution.failed, true);
  assert.equal(rt.calls.fetches, 0);
});
