import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const deployment = JSON.parse(fs.readFileSync(new URL('../reports/lp1837/lp1837-summary.json', import.meta.url), 'utf8'));

test('protected preview evidence is an immutable manual deployment, not current-code parity', () => {
  assert.equal(deployment.hostname, 'preview.gridlygo.com');
  assert.equal(deployment.repositoryCommit, '945527f05918dc002742e76de74165e1c8b2ae41');
  assert.equal(deployment.gitIntegration, false);
  assert.equal(deployment.automaticDeployment, false);
  assert.equal(deployment.deploymentArtifactReconciled, true);
});

test('settings exposes a semantic, searchable manual awareness-area picker', () => {
  assert.match(index, /<form id="settingsAwarenessAreaSearchForm"/);
  assert.match(index, /<button type="submit"[^>]*id="settingsChangeAwarenessAreaBtn">Find Area<\/button>/);
  assert.match(index, /<button type="button"[^>]*id="settingsChooseCommunityManuallyBtn"[^>]*aria-expanded="false"[^>]*aria-controls="settingsAwarenessAreaChooser"/);
  assert.match(index, /id="settingsAwarenessAreaChooser"[^>]*aria-label="Choose an awareness area"[^>]*hidden/);
  assert.match(app, /manualCommunityBtn\.addEventListener\("click"/);
  assert.match(app, /renderGridlyManualAwarenessAreaPicker\(document\.getElementById\("settingsAwarenessAreaChooser"\)\)/);
  assert.match(app, /setGridlySettingsAwarenessChooserOpen\(open,/);
  assert.match(app, /settingsAwarenessAreaSearchForm\.addEventListener\("submit"/);
  assert.match(app, /searchGridlySettingsAwarenessArea/);
});

test('manual selection preserves county-qualified and multi-county identity paths', () => {
  assert.match(app, /data-gridly-awareness-county-select/);
  assert.match(app, /data-gridly-awareness-community-select/);
  assert.match(app, /gridlySaveCanonicalMultiCountyPlaceHome\(result, "settings_awareness_area_search", candidate\.countyId\)/);
  assert.match(app, /selectGridlySettingsAwarenessArea\(target\.value \|\| "", "legacy_settings_awareness_area"/);
});

test('manual fallback is independent of geolocation and remains in first-run setup', () => {
  assert.match(app, /id="gridlyV858ManualLocationForm"/);
  assert.match(app, /Location is optional\. Choose a watch area now/);
  assert.match(app, /No problem\. Location is optional — enter a ZIP code or town name/);
  assert.match(app, /input\?\.focus\?\.\(\{ preventScroll: true \}\)/);
});

test('service worker cannot serve cached app.js and navigation is online network-first', () => {
  assert.match(index, /js\/app\.js\?v=2403a/);
  assert.match(worker, /GRIDLY_SW_VERSION = "lp101\.1-runtime-recovery"/);
  assert.match(worker, /GRIDLY_CLOSURE_CACHE_NAME = "gridly-pwa-shell-lp235-v1"/);
  assert.doesNotMatch(worker, /["']\.\/js\/app\.js/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /fetch\(request, \{ cache: "no-store" \}\)/);
});
