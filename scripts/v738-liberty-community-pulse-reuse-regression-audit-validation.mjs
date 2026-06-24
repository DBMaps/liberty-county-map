import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V738-LIBERTY-COMMUNITY-PULSE-REUSE-REGRESSION-AUDIT.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v738-liberty-community-pulse-reuse-regression-audit.json', 'utf8'));

assert.match(app, /GRIDLY_V738_VOLATILE_REUSE_TIMESTAMP_FIELDS/, 'V738 volatile timestamp allowlist must exist');
assert.match(app, /function gridlyV738BuildCommunityPulseReuseAudit/, 'V738 cache hit\/miss audit must exist');
assert.match(app, /exactCacheMissReason: missReason/, 'V738 audit must expose exact cache miss reason');
assert.match(app, /gridlyV738NormalizeReuseCoordinate\(lat\)/, 'V738 signature must normalize latitude');
assert.match(app, /gridlyV738NormalizeReuseCoordinate\(lng\)/, 'V738 signature must normalize longitude');
assert.doesNotMatch(app, /record\.updated_at \|\| record\.updatedAt \|\| record\.lastUpdated/, 'V738 signature must not include volatile freshness timestamps');
assert.match(app, /v738CommunityPulseReuseAudit: gridlyV734RefreshReuseState\.communityPulseLastReuseAudit/, 'refresh breakdown must expose V738 reuse audit');
assert.match(app, /v738ReuseAudit: gridlyV734RefreshReuseState\.communityPulseLastReuseAudit/, 'Community Pulse state must expose V738 reuse audit');

[
  'Final determination',
  'Regression confirmed? yes/no',
  'Why V734 showed 0.8 ms and V737 showed 5193.4 ms',
  'Exact cache miss reason',
  'Exact volatile signature field if found',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise physical-device validation steps',
  'Merge recommendation'
].forEach((section) => assert(report.includes(`## ${section}`), `report missing section: ${section}`));

assert.equal(evidence.version, 'V738');
assert.equal(evidence.regressionConfirmed, true);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V738 Liberty Community Pulse reuse regression audit validation passed');
