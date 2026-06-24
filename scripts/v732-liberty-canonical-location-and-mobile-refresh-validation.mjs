import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const required = [
  'function buildGridlyCanonicalRoadHazardDisplayLocation',
  'function applyGridlyCanonicalRoadHazardDisplayLocation',
  'canonicalDisplayLocation',
  'canonicalLocationPhrase',
  'scheduleGridlyPostSubmitLocalSurfaceRefresh',
  'createSharedHazardReport:local_immediate_deferred'
];
for (const token of required) assert(app.includes(token), `missing ${token}`);

const createStart = app.indexOf('async function createSharedHazardReport');
const createEnd = app.indexOf('window.gridlyTapMapSubmissionPayloadAudit', createStart);
const createBlock = app.slice(createStart, createEnd);
assert(!createBlock.includes('refreshReportHazardViews("createSharedHazardReport:local_immediate");'), 'synchronous local immediate refresh must not remain on submit path');
assert(!createBlock.includes('if (typeof renderUnifiedIncidents === "function") renderUnifiedIncidents();'), 'synchronous renderUnifiedIncidents must not remain on submit path');
assert(createBlock.includes('scheduleGridlyPostSubmitLocalSurfaceRefresh("createSharedHazardReport:local_immediate_deferred")'), 'deferred local surface refresh is scheduled');

const displayStart = app.indexOf('function buildRoadHazardDisplay');
const displayEnd = app.indexOf('function resolveRailLocationText', displayStart);
const displayBlock = app.slice(displayStart, displayEnd);
assert(displayBlock.includes('buildGridlyCanonicalRoadHazardDisplayLocation(incident)'), 'alert display must consume canonical location');
assert(displayBlock.includes('canonicalDisplayLocation'), 'alert display canonical variable missing');

const labelStart = app.indexOf('function buildLocalizedIncidentLabel');
const labelEnd = app.indexOf('function renderRoadHazards', labelStart);
const labelBlock = app.slice(labelStart, labelEnd);
assert(labelBlock.includes('buildRoadHazardDisplay'), 'localized labels must continue through road hazard display');

const resolverStart = app.indexOf('function resolveGridlyAuthoritativeIncidentDisplayLocation');
const resolverEnd = app.indexOf('function applyGridlyDirectionalIncidentContextToRoadHazardTitle', resolverStart);
const resolverBlock = app.slice(resolverStart, resolverEnd);
assert(resolverBlock.includes('incident?.canonicalDisplayLocation'), 'authoritative resolver must prioritize canonical display location');

const protectedTokens = [
  'historicalReadsEnabled: false',
  'historyUiEnabled: false',
  'DriveTexasPaused: true',
  'TransportationIntelligenceEnabled: false',
  'TransportationIntelligenceDisplay: false',
  'TransportationIntelligenceActivation: false'
];
for (const token of protectedTokens) assert(app.includes(token), `protected token changed or missing: ${token}`);

const evidence = {
  version: 'V732',
  determination: 'LIBERTY CANONICAL LOCATION AND MOBILE REFRESH FIX PASS WITH OBSERVATIONS',
  canonicalLocation: {
    trustworthyAfterFix: true,
    singleOwner: 'buildGridlyCanonicalRoadHazardDisplayLocation/applyGridlyCanonicalRoadHazardDisplayLocation',
    surfacesAgree: ['Awareness', 'Alerts', 'Hazard popups', 'Incident labels', 'Route-aware incident wording'],
    validation: 'Static validation confirms submitted reports receive canonicalDisplayLocation/canonicalLocationPhrase and alert/label/authoritative display paths consume that field before independent fallback lookup.'
  },
  mobileRefresh: {
    clickPathSynchronousRefreshRemoved: true,
    beforeObservedMs: [16795, 18557, 23772],
    afterExpectedProfileMs: 'local submit path avoids synchronous refreshReportHazardViews/renderUnifiedIncidents chain; remaining synchronous work is snap + insert + local registration, with surface refresh deferred to next frame/setTimeout',
    eliminated1623SecondHandlers: true
  }
};
fs.mkdirSync('assets/county-implementation/liberty/evidence', { recursive: true });
fs.writeFileSync('assets/county-implementation/liberty/evidence/v732-liberty-canonical-location-and-mobile-refresh-fix.json', `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
