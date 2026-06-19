import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const app = fs.readFileSync('js/app.js', 'utf8');
const changedPaths = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean);
const stagedRuntimeValidation = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/validation/montgomery-staged-runtime-validation-v585.json', 'utf8'));
const evidence = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/evidence/montgomery-staged-runtime-validation-evidence-v585.json', 'utf8'));
const readiness = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/validation/montgomery-observation-readiness-v585.json', 'utf8'));

assert.match(app, /const GRIDLY_DEFAULT_COUNTY_ID = "liberty-tx"/, 'Liberty must remain default county');
assert.match(app, /const GRIDLY_MONTGOMERY_RUNTIME_GATE = true/, 'Montgomery runtime gate must be true');
assert.match(app, /"montgomery-tx": Object\.freeze\(\{[\s\S]*?operational: true,[\s\S]*?productionEnabled: true,[\s\S]*?selectable: true,[\s\S]*?runtimeGateEnabled: GRIDLY_MONTGOMERY_RUNTIME_GATE/, 'Montgomery registry status must be operational, production-enabled, selectable, and gate-bound');
assert.doesNotMatch(app, /data\/montgomery|data\/counties\/montgomery-tx/, 'Montgomery assets must not be placed under data/');
assert.match(app, /historicalReadsEnabled:\s*false/, 'historical reads boundary must remain false');
assert.match(app, /historyUiEnabled:\s*false/, 'history UI boundary must remain false');
assert.match(app, /historicalApiExposure:\s*false/, 'historical API exposure boundary must remain false');
assert.match(app, /consumerFacingHistoryDashboard:\s*false/, 'consumer-facing history dashboard boundary must remain false');
assert.match(app, /DriveTexasPaused:\s*true/, 'DriveTexas must remain paused');
assert.match(app, /TransportationIntelligenceEnabled:\s*false/, 'Transportation Intelligence must remain disabled');
assert.match(app, /TransportationIntelligenceDisplay:\s*false/, 'Transportation Intelligence display must remain disabled');
assert.match(app, /TransportationIntelligenceActivation:\s*false/, 'Transportation Intelligence activation must remain disabled');
assert.equal(changedPaths.some((path) => path.startsWith('supabase/') || path.startsWith('migrations/')), false, 'Supabase and migration paths must not change');
assert.equal(changedPaths.some((path) => path.startsWith('data/')), false, 'data/ assets must not change for Montgomery staged validation');

assert.equal(evidence.protectedSystemValidation.supabaseChanged, false);


console.log('v585-staged-runtime-validation-audit.mjs passed');
