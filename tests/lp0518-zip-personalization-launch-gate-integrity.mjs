import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyLp0518EvidenceStatus');
const end = app.indexOf('\nfunction gridlyLp0518ZipPersonalizationLaunchCertificationAudit', start);
assert.notEqual(start, -1, 'LP051.8 evidence helpers exist');
assert.notEqual(end, -1, 'LP051.8 audit follows evidence helpers');
const context = vm.createContext({ Object, Boolean, Number, Array, Math, RegExp, String });
vm.runInContext(`${app.slice(start, end)}; this.resolveGate = gridlyLp0518ResolveLaunchGate;`, context);

const passed = {
  canonicalHomeRecordValid: true,
  activeCountyMatchesHome: true,
  activeCommunityMatchesHome: true,
  activeAwarenessMatchesExpected: true,
  countyWideViewPreservesHome: true,
  homeAndCurrentViewDistinct: true,
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

gate = context.resolveGate({ ...passed, homeAndCurrentViewDistinct: true });
assert.equal(gate.launchCertificationStatus, 'launch_candidate', 'all mandatory conditions passed yields launch candidate');
assert.equal(gate.safeForLaunch, true, 'safeForLaunch only true when blockers and pending are zero');

assert.match(app, /currentViewIsCountyWide[\s\S]*homeAndCurrentViewDistinct = Boolean\(base\.homeAndCurrentViewDistinct \|\| evidence\.countyWideHomeSeparationPass \|\| \(record && currentViewIsCountyWide && validation\.valid\)\)/, 'county-wide Current View with valid saved Home proves ownership separation');
assert.match(app, /settingsEvidenceStatus = gridlyLp0518EvidenceStatus\(Boolean\(base\.settingsZipManagementPass \|\| evidence\.settingsVisiblePass\), visibleSettingsFailed\)/, 'closed Settings DOM is not collapsed to pass');

console.log('LP051.8 launch gate integrity truth-table checks passed');
