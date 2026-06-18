import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const app = fs.readFileSync('js/app.js', 'utf8');
const changedPaths = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean);
const requiredArtifacts = [
  'assets/county-implementation/montgomery/observation/montgomery-controlled-observation-report-v587.json',
  'assets/county-implementation/montgomery/observation/montgomery-controlled-observation-findings-v587.json',
  'assets/county-implementation/montgomery/evidence/montgomery-controlled-observation-evidence-v587.json'
];
const artifacts = Object.fromEntries(requiredArtifacts.map((path) => [path, JSON.parse(fs.readFileSync(path, 'utf8'))]));

assert.match(app, /const GRIDLY_DEFAULT_COUNTY_ID = "liberty-tx"/, 'Liberty must remain default county');
assert.match(app, /const GRIDLY_MONTGOMERY_RUNTIME_GATE = false/, 'Montgomery runtime gate must remain false');
assert.match(app, /"montgomery-tx": Object\.freeze\(\{[\s\S]*?operational: false,[\s\S]*?productionEnabled: false,[\s\S]*?selectable: false,[\s\S]*?runtimeGateEnabled: GRIDLY_MONTGOMERY_RUNTIME_GATE/, 'Montgomery must remain disabled, production-disabled, non-selectable, and gate-bound');
assert.match(app, /productionActivationBlocked: true/, 'Montgomery production activation must remain blocked');
assert.match(app, /historicalReadsEnabled:\s*false/, 'historical reads boundary must remain false');
assert.match(app, /historyUiEnabled:\s*false/, 'history UI boundary must remain false');
assert.match(app, /historicalApiExposure:\s*false/, 'historical API exposure boundary must remain false');
assert.match(app, /consumerFacingHistoryDashboard:\s*false/, 'consumer-facing history dashboard boundary must remain false');
assert.match(app, /DriveTexasPaused:\s*true/, 'DriveTexas must remain paused');
assert.match(app, /TransportationIntelligenceEnabled:\s*false/, 'Transportation Intelligence must remain disabled');
assert.match(app, /TransportationIntelligenceDisplay:\s*false/, 'Transportation Intelligence display must remain disabled');
assert.match(app, /TransportationIntelligenceActivation:\s*false/, 'Transportation Intelligence activation must remain disabled');
assert.equal(changedPaths.some((path) => path.startsWith('supabase/') || path.startsWith('migrations/')), false, 'Supabase and migration paths must not change');
assert.equal(changedPaths.some((path) => path.startsWith('data/')), false, 'data/ assets must not change for Montgomery controlled observation execution');

for (const [path, artifact] of Object.entries(artifacts)) {
  assert.equal(artifact.artifactVersion, 'V587', `${path} must be a V587 artifact`);
  assert.equal(artifact.countyId, 'montgomery-tx', `${path} must be scoped to Montgomery`);
  assert.equal(artifact.finalDetermination, 'OBSERVATION COMPLETE WITH OBSERVATIONS', `${path} must record V587 final determination`);
  assert.equal(artifact.canProceedToV588LaunchDecisionPackage, true, `${path} must explicitly allow V588 package preparation`);
}

assert.equal(artifacts[requiredArtifacts[0]].activationAuthorized, false, 'V587 report must not authorize activation');
assert.equal(artifacts[requiredArtifacts[0]].runtimeRequirements.GRIDLY_MONTGOMERY_RUNTIME_GATE, false, 'V587 report must require runtime gate false');
assert.equal(artifacts[requiredArtifacts[2]].runtimeEvidence.activationAttemptsBlocked, true, 'V587 evidence must show activation attempts blocked');
assert.equal(artifacts[requiredArtifacts[2]].protectedSystemEvidence.supabaseChanges, false, 'V587 evidence must show no Supabase changes');

console.log('v587-controlled-observation-execution-audit.mjs passed');
