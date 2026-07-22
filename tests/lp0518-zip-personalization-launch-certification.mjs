import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP051-8-ZIP-PERSONALIZATION-LAUNCH-CERTIFICATION.md', 'utf8');

assert.match(app, /function gridlyLp0518ZipPersonalizationLaunchCertificationAudit\(\)/, 'LP051.8 audit helper is implemented');
assert.match(app, /window\.gridlyLp0518ZipPersonalizationLaunchCertificationAudit = gridlyLp0518ZipPersonalizationLaunchCertificationAudit/, 'LP051.8 audit helper is exposed on window');
assert(app.includes('LP051.8.zip-personalization-launch-certification.v1'), 'LP051.8 audit reports version');
assert(app.includes('gridlyHomePersonalizationV1'), 'canonical storage remains inventoried');
assert(app.includes('LP051.7.home-personalization.v1'), 'canonical schema is preserved');
assert(app.includes('homeAndCurrentViewDistinct'), 'Home versus Current View distinction is audited');
assert(app.includes('countyWideViewPreservesHome'), 'county-wide view preservation is audited');
assert.match(app, /#gridlyPortraitV2Sheet\[data-active-sheet='settings'\][\s\S]*#gridlyPortraitV2SheetBody/, 'audit inspects visible Portrait V2 Settings DOM');
assert(app.includes('settingsChangeZipVisible') && app.includes('settingsManualFallbackVisible'), 'Settings ZIP management controls are audited');
assert(app.includes('startupRestorationPass'), 'startup restoration is audited');
assert(app.includes('existingUserMigrationSafe'), 'existing-user migration safety is audited');
assert(app.includes('changeZipApplyPass') && app.includes('changeZipCancelPass'), 'change-ZIP apply and cancel outcomes are reported');
assert(app.includes('ambiguousSilentDefaultDetected'), 'ambiguous ZIP silent defaults are blocked');
assert(app.includes('unsupportedWritesDetected') && app.includes('poBoxWritesDetected') && app.includes('uniqueZipWritesDetected') && app.includes('invalidZipWritesDetected'), 'protected ZIP no-write fields are reported');
assert(app.includes('duplicateApplyBlocked'), 'duplicate apply protection is audited');
assert(app.includes('transactionRollbackAvailable'), 'rollback contract is audited');
assert(app.includes('routeIntelligenceTouched'), 'Route Intelligence independence is audited');
assert(app.includes('launchCertificationStatus') && app.includes('safeForLaunch'), 'safe launch status rules are exposed');
assert(app.includes('browserProofComplete') && app.includes('__gridlyLp0518ManualBrowserCertificationPassed'), 'browser-only proof is represented honestly');
assert(app.includes('settingsEvidenceStatus') && app.includes('mobilePortraitEvidenceStatus') && app.includes('requiresConfirmationEvidenceStatus') && app.includes('homeCurrentViewEvidenceStatus'), 'pass/fail/unobserved evidence statuses are reported');
assert(app.includes('currentViewMatchesHome') && app.includes('currentViewMode') && app.includes('canonicalHomePreservedDuringCurrentView') && app.includes('homeCurrentViewFindings'), 'Home versus Current View ownership diagnostics are returned');
assert(app.includes('certificationEvidencePending') && app.includes('certificationPendingCount'), 'pending evidence is reported separately from blockers');
assert(app.includes('manualProofCannotOverrideFailures') && app.includes('launchGateIntegrityPass'), 'manual proof cannot override launch gate failures');
assert(doc.includes('window.gridlyLp0518ZipPersonalizationLaunchCertificationAudit?.()'), 'documentation includes audit command');
assert(doc.includes('Home versus Current View contract'), 'documentation covers Home versus Current View contract');
assert(doc.includes('Exact browser testing steps'), 'documentation includes browser-only validation steps');
assert(doc.includes('launch_candidate') && doc.includes('safeForLaunch'), 'documentation explains launch status rules');

console.log('LP051.8 ZIP personalization launch certification static checks passed');
