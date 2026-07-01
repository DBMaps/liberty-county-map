const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V889-CONTROLLED-BETA-POLISH-DEVICE-VALIDATION.md', 'utf8');

assert(app.includes('gridlyControlledBetaReadinessAudit'), 'V889 controlled beta readiness audit helper is exposed');
assert(app.includes('V889-controlled-beta-polish-device-validation'), 'V889 audit version is present');
assert(app.includes('v888HighFindingsAddressed: true'), 'V888 high findings flag is true');
assert(app.includes('firstImpressionLoadingClarity: true'), 'first impression clarity flag is true');
assert(app.includes('onboardingPermissionClarity: true'), 'onboarding permission clarity flag is true');
assert(app.includes('routeWatchStateClarity: true'), 'route watch state clarity flag is true');
assert(app.includes('Location is optional'), 'onboarding explains location is optional');
assert(app.includes('ZIP setup works too'), 'onboarding explains ZIP setup alternative');
assert(app.includes('Route Watch active · Watching'), 'Route Watch active copy is explicit');
assert(app.includes('No active reports near this route right now.'), 'Route Watch no-active-report copy is explicit');
assert(index.includes('Loading Community Pulse'), 'Community Pulse loading copy is intentional');
assert(index.includes('ZIP or home area setup without sharing your precise location'), 'onboarding county step mentions non-GPS setup');
assert(index.includes('Stop Route Watch'), 'route details stop action is explicit');
assert(doc.includes('Device validation checklist'), 'V889 documentation includes device validation checklist');
assert(doc.includes('Protected systems confirmation'), 'V889 documentation confirms protected systems');

console.log('v889-controlled-beta-polish-readiness.test.js passed');
