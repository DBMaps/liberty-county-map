import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const app = fs.readFileSync('js/app.js', 'utf8');
const changedPaths = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean);

const artifactPaths = [
  'assets/county-implementation/montgomery/observation/montgomery-controlled-observation-plan-v586.json',
  'assets/county-implementation/montgomery/observation/montgomery-observation-success-criteria-v586.json',
  'assets/county-implementation/montgomery/observation/montgomery-observation-failure-thresholds-v586.json',
  'assets/county-implementation/montgomery/evidence/montgomery-controlled-observation-evidence-v586.json'
];

const artifacts = Object.fromEntries(artifactPaths.map((path) => [path, JSON.parse(fs.readFileSync(path, 'utf8'))]));

assert.match(app, /const GRIDLY_DEFAULT_COUNTY_ID = "liberty-tx"/, 'Liberty must remain default county');
assert.match(app, /const GRIDLY_MONTGOMERY_RUNTIME_GATE = false/, 'Montgomery runtime gate must remain false');
assert.match(app, /"montgomery-tx": Object\.freeze\(\{[\s\S]*?operational: false,[\s\S]*?productionEnabled: false,[\s\S]*?selectable: false[\s\S]*?runtimeGateEnabled: GRIDLY_MONTGOMERY_RUNTIME_GATE/, 'Montgomery must remain staged, disabled, non-selectable, and gate-bound');
assert.match(app, /historicalReadsEnabled:\s*false/, 'historical reads boundary must remain false');
assert.match(app, /historyUiEnabled:\s*false/, 'history UI boundary must remain false');
assert.match(app, /historicalApiExposure:\s*false/, 'historical API exposure boundary must remain false');
assert.match(app, /consumerFacingHistoryDashboard:\s*false/, 'consumer-facing history dashboard boundary must remain false');
assert.match(app, /DriveTexasPaused:\s*true/, 'DriveTexas must remain paused');
assert.match(app, /TransportationIntelligenceEnabled:\s*false/, 'Transportation Intelligence must remain disabled');
assert.match(app, /TransportationIntelligenceDisplay:\s*false/, 'Transportation Intelligence display must remain disabled');
assert.match(app, /TransportationIntelligenceActivation:\s*false/, 'Transportation Intelligence activation must remain disabled');
assert.equal(changedPaths.some((path) => path.startsWith('supabase/') || path.startsWith('migrations/')), false, 'Supabase and migration paths must not change');
assert.equal(changedPaths.some((path) => path.startsWith('data/')), false, 'data/ assets must not change for Montgomery controlled observation preparation');

for (const [path, artifact] of Object.entries(artifacts)) {
  assert.equal(artifact.artifactVersion, 'V586', `${path} must be a V586 artifact`);
  assert.equal(artifact.countyId, 'montgomery-tx', `${path} must be scoped to Montgomery`);
}

assert.equal(artifacts[artifactPaths[0]].activationAuthorized, false, 'V586 plan must not authorize activation');
assert.equal(artifacts[artifactPaths[0]].runtimeRequirements.GRIDLY_MONTGOMERY_RUNTIME_GATE, false, 'V586 plan must require runtime gate false');
assert.equal(artifacts[artifactPaths[1]].overallDeterminationRules['CONTROLLED OBSERVATION READY WITH OBSERVATIONS'].includes('No monitored area is FAIL'), true);
assert.equal(artifacts[artifactPaths[2]].automaticFailConditions.includes('GRIDLY_MONTGOMERY_RUNTIME_GATE is not false'), true);
assert.equal(artifacts[artifactPaths[3]].finalDetermination, 'CONTROLLED OBSERVATION READY WITH OBSERVATIONS');

console.log('v586-controlled-observation-preparation-audit.mjs passed');
