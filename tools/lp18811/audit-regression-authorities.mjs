#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

export function audit(root = ROOT) {
  const plan = read(root, 'reports/lp187/texas-activation-wave-plan.json');
  const owner = read(root, 'evidence/lp18811/execution-results/owner-result.json');
  const summary = read(root, 'reports/lp18811/lp18811-summary.json');
  const wave0 = plan.waves.find(w => w.wave === 'WAVE_0_REGRESSION_BASELINE');
  if (!wave0 || wave0.countyFips.length !== 28 || wave0.executionAuthorized !== false) throw Error('LP187 Wave 0 planning scope changed');
  if (owner.waveId !== 'LP18810-NP-001' || owner.results.length !== 215) throw Error('authoritative execution baseline changed');
  for (const [key, value] of Object.entries({deploymentConfirmedCount:215,runtimeValidatedCount:215,boundaryValidatedCount:215,regressionValidatedCount:0,consumerValidatedCount:0,telemetryValidatedCount:0,rollbackValidatedCount:0,operationallyValidatedCount:0,currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0})) if (summary[key] !== value) throw Error(`${key} changed`);
  return {
    schemaVersion: 'gridly.lp18811f1.regression-authority-audit.v1', milestone: 'LP188.11F1', waveId: 'LP18810-NP-001', targetCountyCount: 215,
    implementationPath: 'WAVE0_AUTHORITY_MISSING_BLOCKS_RUNNER',
    wave0Audit: { planningScopeReference: 'reports/lp187/texas-activation-wave-plan.json', planningCountyFips: wave0.countyFips, planningCountyCount: 28, executionAuthorized: false, governedComparisonAuthorityFound: false, missingFields: ['runtimeBuildIdentity','assertionDefinitions','expectedResults','executedControlEvidence'], conclusion: 'LP187 names the current operational counties as a proposed regression-baseline cohort, but supplies no executed comparison authority. LP132 earlier described a one-county control. Neither is an identity-bound Wave 0 result.' },
    defectAudit: { governedAuthorityFound: false, policyReference: 'LP132-TEXAS-STATEWIDE-ACTIVATION-ROADMAP.md', knownSemantics: ['unresolved severity-1/2 correctness, integrity, security, privacy, or rollback-readiness issue is a no-go'], missingFields: ['severity1Definition','severity2Definition','findingInventory','openClosedStatusAuthority','countyAndWaveScope'], conclusion: 'The repository states the zero-open gate but has no governed severity taxonomy or status inventory from which counts can be derived.' },
    assertionInventory: [
      {area:'protected access and package endpoint checks',classification:'REMOTE_PROTECTED_EXECUTABLE',selected:false,reason:'already used for deployment/runtime/package/boundary certification; relabeling is forbidden'},
      {area:'county discovery/search, community resolution, awareness, location context, route/watch, consumer fallback',classification:'LOCAL_ONLY_NOT_VALID_FOR_PROTECTED_REGRESSION',selected:false,reason:'repository tests use local DOM/module fixtures and are not an established protected HTTP contract'},
      {area:'LP188.5 package hash identity',classification:'STATIC_ONLY',selected:false,reason:'valid prerequisite already certified, not regression behavior'},
      {area:'restricted-county isolation',classification:'STATIC_ONLY',selected:false,reason:'existing governance/state assertions do not execute protected consumer behavior'},
      {area:'production-only operational checks',classification:'PRODUCTION_ONLY',selected:false,reason:'production execution is prohibited'}
    ],
    runner: {implemented:false,path:null,executionCommand:null,placeholdersRemain:false,reason:'fail-closed: both comparison and defect authorities are absent'},
    ingestion: {changed:false,reason:'no valid regression evidence can be produced; authoritative owner-result.json remains complementary and untouched'},
    state: {deploymentId:owner.deploymentIdentity.deploymentId,buildIdentity:owner.deploymentIdentity.expectedBuildIdentity,currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0,runtimeOperationalCountChanged:false,restrictedCountyStateChanged:false},
    overallClassification: 'PROTECTED_REGRESSION_BLOCKED_GOVERNED_WAVE0_AND_DEFECT_AUTHORITIES_REQUIRED',
    nextAction: 'Governance owner must publish immutable Wave 0 executed control evidence (exact FIPS, build/runtime identity, assertions and expected results) and an authoritative S1/S2 taxonomy plus open/closed defect inventory; then provision the read-only adapter.'
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'verify') throw Error('usage: audit-regression-authorities.mjs verify');
  const expected = read(ROOT, 'reports/lp18811f1/regression-authority-audit.json');
  if (JSON.stringify(audit()) !== JSON.stringify(expected)) throw Error('LP188.11F1 audit evidence is not deterministic/current');
  process.stdout.write('LP188.11F1 regression authority audit verified\n');
}
