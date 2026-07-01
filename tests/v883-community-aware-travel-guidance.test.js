const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /function resolveGridlyCommunityAwareTravelGuidance/, 'Community-aware travel guidance resolver must exist');
assert.match(app, /GRIDLY_COMMUNITY_TRAVEL_CONTEXT[\s\S]*dayton[\s\S]*liberty[\s\S]*cleveland[\s\S]*conroe/, 'Travel context must be extensible beyond Dayton');
assert.match(app, /gridlySuppressStandaloneTransitionBriefItems/, 'Standalone transition briefing items must be suppressed');
assert.doesNotMatch(app, /outlookItems\.push\(\{ icon: "", text: "Also:?" \}\)/, 'Briefing helper must not emit Also as a standalone line');
assert.doesNotMatch(app, /travelStatus\s*=\s*"Allow extra time if heading (?:west|east|north|south)\."/, 'Briefing helper must not prefer generic cardinal heading copy');
assert.match(app, /Allow extra travel time in this area\./, 'Neutral fallback wording must be available when confidence is insufficient');
assert.match(app, /gridlyCommunityAwareTravelGuidanceAudit/, 'V883 audit helper must be exposed');
assert.match(app, /communityPulseUnchanged:\s*true/, 'Audit must certify Community Pulse unchanged');
assert.match(app, /alertsUnchanged:\s*true/, 'Audit must certify Alerts unchanged');
assert.match(app, /protectedSystemsUnchanged:\s*true/, 'Audit must certify protected systems unchanged');

console.log('V883 community-aware travel guidance static checks passed');
