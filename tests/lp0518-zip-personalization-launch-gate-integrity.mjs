import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyLp0518EvidenceStatus');
const end = app.indexOf('\nfunction gridlyLp0518ZipPersonalizationLaunchCertificationAudit', start);
assert.notEqual(start, -1, 'LP051.8 evidence helpers exist');
assert.notEqual(end, -1, 'LP051.8 audit follows evidence helpers');
const context = vm.createContext({ Object, Boolean, Number, Array, Math, RegExp, String });
vm.runInContext(`${app.slice(start, end)}; this.resolveGate = gridlyLp0518ResolveLaunchGate; this.evaluateOwnership = gridlyLp0518EvaluateHomeCurrentViewOwnership;`, context);

const passed = {
  canonicalHomeRecordValid: true,
  activeCountyMatchesHome: true,
  activeCommunityMatchesHome: true,
  activeAwarenessMatchesExpected: true,
  countyWideViewPreservesHome: true,
  homeAndCurrentViewDistinct: true,
  homeCurrentViewEvidenceStatus: 'pass',
  settingsZipManagementPass: true,
  startupRestorationPass: true,
  changeZipApplyPass: true,
  changeZipCancelPass: true,
  requiresConfirmationPass: true,
  protectedZipBehaviorPreserved: true,
  ambiguousSilentDefaultDetected: false,
  providerRefreshLoopDetected: false,
  duplicateRefreshDetected: false,
  stalePreviousAreaDetected: false,
  mobilePortraitPass: true,
  visualIntegrationPass: true,
  accessibilityBasicsPass: true,
  routeIntelligenceTouched: false,
  protectedSystemsUntouched: true,
  browserProofComplete: true
};

let gate = context.resolveGate({ ...passed, settingsZipManagementPass: false, browserProofComplete: true });
assert.equal(gate.launchCertificationStatus, 'blocked', 'manual proof cannot override settings failure');
assert.equal(gate.safeForLaunch, false, 'safeForLaunch remains false when a mandatory field is false');
assert(gate.certificationBlockers.includes('visible_settings_contract_failed'), 'proven settings failure is counted as blocker');
assert.equal(gate.certificationBlockerCount, 1, 'blocker count includes proven failure');

gate = context.resolveGate({ ...passed, mobilePortraitPass: false, browserProofComplete: true });
assert.equal(gate.launchCertificationStatus, 'blocked', 'manual proof cannot override mobile failure');
assert(gate.certificationBlockers.includes('mobile_portrait_failed'), 'mobile failure is a blocker');

gate = context.resolveGate({ ...passed, requiresConfirmationPass: false, browserProofComplete: true });
assert.equal(gate.launchCertificationStatus, 'blocked', 'manual proof cannot override requires-confirmation failure');
assert(gate.certificationBlockers.includes('requires_confirmation_failed'), 'requires-confirmation failure is a blocker');

gate = context.resolveGate({ ...passed, settingsZipManagementPass: null, browserProofComplete: true });
assert.equal(gate.launchCertificationStatus, 'partial', 'closed Settings/unobserved DOM is pending, not pass');
assert.equal(gate.safeForLaunch, false, 'launch_candidate cannot occur with pending evidence');
assert(gate.certificationEvidencePending.includes('settings_evidence_unobserved'), 'pending count includes unobserved Settings');
assert.equal(gate.certificationPendingCount, 1, 'pending count includes untested scenario');

gate = context.resolveGate({ ...passed, homeAndCurrentViewDistinct: true, homeCurrentViewEvidenceStatus: 'pass' });
assert.equal(gate.launchCertificationStatus, 'launch_candidate', 'all mandatory conditions passed yields launch candidate');
assert.equal(gate.safeForLaunch, true, 'safeForLaunch only true when blockers and pending are zero');

assert.match(app, /function gridlyLp0518EvaluateHomeCurrentViewOwnership/, 'centralized ownership evaluator is implemented');

const daytonRecord = { zip: '77535', countyId: 'liberty-tx', communityKey: 'dayton', awarenessAreaKey: 'dayton', consumerLabel: 'Dayton' };
const valid = { valid: true };
let ownership = context.evaluateOwnership({ base: {}, evidence: {}, record: daytonRecord, validation: valid, activeArea: { key: 'dayton', label: 'Dayton', countyId: 'liberty-tx' }, currentViewIsCountyWide: false });
assert.equal(ownership.status, 'pass', 'Home equals Current View passes ownership certification');
assert.equal(ownership.ownershipSeparated, true, 'matching values still preserve separate ownership contracts');
assert.equal(ownership.currentViewMatchesHome, true, 'value comparison reports matching Home and Current View');
gate = context.resolveGate({ ...passed, homeAndCurrentViewDistinct: ownership.ownershipSeparated, homeCurrentViewEvidenceStatus: ownership.status });
assert(!gate.certificationBlockers.includes('home_current_view_ownership_failed'), 'matching Home and Current View does not block launch');

ownership = context.evaluateOwnership({ base: {}, evidence: {}, record: daytonRecord, validation: valid, activeArea: { key: 'liberty-tx', label: 'Liberty County', countyId: 'liberty-tx', countyWide: true }, currentViewIsCountyWide: true });
assert.equal(ownership.status, 'pass', 'county-wide Current View passes when canonical Home is preserved');
assert.equal(ownership.ownershipSeparated, true, 'county-wide view preserves ownership separation');
assert.equal(ownership.currentViewMatchesHome, false, 'county-wide Current View does not match Home value');
gate = context.resolveGate({ ...passed, homeAndCurrentViewDistinct: ownership.ownershipSeparated, homeCurrentViewEvidenceStatus: ownership.status, countyWideViewPreservesHome: true });
assert(!gate.certificationBlockers.includes('home_current_view_ownership_failed'), 'county-wide preserved Home does not block launch');

ownership = context.evaluateOwnership({ base: {}, evidence: { currentViewOverwroteHome: true }, record: daytonRecord, validation: valid, activeArea: { key: 'liberty-tx', label: 'Liberty County', countyWide: true }, currentViewIsCountyWide: true });
assert.equal(ownership.status, 'fail', 'proven overwrite fails ownership certification');
gate = context.resolveGate({ ...passed, homeAndCurrentViewDistinct: false, homeCurrentViewEvidenceStatus: ownership.status });
assert(gate.certificationBlockers.includes('home_current_view_ownership_failed'), 'proven overwrite blocks launch');

ownership = context.evaluateOwnership({ base: {}, evidence: {}, record: null, validation: { valid: false }, activeArea: null, currentViewIsCountyWide: false });
assert.equal(ownership.status, 'unobserved', 'insufficient ownership proof remains unobserved');
gate = context.resolveGate({ ...passed, homeAndCurrentViewDistinct: null, homeCurrentViewEvidenceStatus: ownership.status });
assert(gate.certificationEvidencePending.includes('home_current_view_ownership_unobserved'), 'unobserved ownership proof is pending');
assert(!gate.certificationBlockers.includes('home_current_view_ownership_failed'), 'unobserved ownership proof is not a false blocker');

assert.match(app, /settingsEvidenceStatus = gridlyLp0518EvidenceStatus\(Boolean\(base\.settingsZipManagementPass \|\| evidence\.settingsVisiblePass\), visibleSettingsFailed\)/, 'closed Settings DOM is not collapsed to pass');

console.log('LP051.8 launch gate integrity truth-table checks passed');
