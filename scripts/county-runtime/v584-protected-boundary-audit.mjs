import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
assert.match(app, /GRIDLY_MONTGOMERY_RUNTIME_GATE = true/, 'Montgomery runtime gate must be true');
assert.match(app, /productionEnabled: true/, 'Montgomery production must be enabled');
assert.doesNotMatch(app, /data\/montgomery|data\/counties\/montgomery-tx/, 'Montgomery runtime assets must not be placed under data/');
assert.match(app, /historicalReadsEnabled:\s*false/, 'historical reads boundary must remain false');
assert.match(app, /historyUiEnabled:\s*false/, 'history UI boundary must remain false');
assert.match(app, /historicalApiExposure:\s*false/, 'historical API exposure boundary must remain false');
assert.match(app, /consumerFacingHistoryDashboard:\s*false/, 'consumer-facing history dashboard boundary must remain false');
assert.match(app, /DriveTexasPaused:\s*true/, 'DriveTexas must remain paused');
assert.match(app, /TransportationIntelligenceEnabled:\s*false/, 'Transportation Intelligence must remain disabled');
assert.match(app, /TransportationIntelligenceDisplay:\s*false/, 'Transportation Intelligence display must remain disabled');
assert.match(app, /TransportationIntelligenceActivation:\s*false/, 'Transportation Intelligence activation must remain disabled');

const forbiddenSupabasePaths = ['supabase/', 'migrations/'];
const trackedChanges = await new Promise((resolve, reject) => {
  import('node:child_process').then(({ execFile }) => execFile('git', ['diff', '--name-only', 'HEAD'], (error, stdout) => error ? reject(error) : resolve(stdout.trim().split(/\n/).filter(Boolean))));
});
assert.equal(trackedChanges.some((path) => forbiddenSupabasePaths.some((prefix) => path.startsWith(prefix))), false, 'Supabase paths must not change');

console.log('v584-protected-boundary-audit.mjs passed');
