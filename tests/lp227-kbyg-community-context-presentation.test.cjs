const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const governedSource = fs.readFileSync('js/governed-awareness.js', 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const next = app.indexOf('\nfunction ', start + 10);
  return app.slice(start, next === -1 ? app.length : next).trim();
}

const sandbox = {
  gridlyTravelBriefCleanLine: value => String(value || '').trim().replace(/\s+/g, ' '),
  Object
};
vm.createContext(sandbox);
vm.runInContext([
  functionSource('gridlySelectKbygCommunityPresentationContext'),
  functionSource('gridlyFormatKbygCommunityCopy'),
  functionSource('gridlyTravelBriefCommunityLines')
].join('\n'), sandbox);
const select = sandbox.gridlySelectKbygCommunityPresentationContext;
const format = sandbox.gridlyFormatKbygCommunityCopy;
const lines = sandbox.gridlyTravelBriefCommunityLines;
const incident = { id: 'sulphur-traffic', countyId: 'hopkins-tx', canonicalCommunity: 'Sulphur Springs', roadName: 'State Loop 313', crossStreet: 'State Hwy 67V Bus', status: 'active' };
const selected = { label: 'Sulphur Springs', countyName: 'Hopkins County', countyId: 'hopkins-tx', countyWide: false, filterMode: 'town', selectedAwarenessArea: { countyId: 'hopkins-tx', placeGeoid: '4870928' } };

test('selected canonical community outranks county and produces community-level Sulphur Springs copy', () => {
  const context = select([incident], selected);
  assert.deepEqual({ label: context.label, type: context.type, source: context.source }, { label: 'Sulphur Springs', type: 'COMMUNITY', source: 'selected_canonical_community' });
  assert.equal(format([incident], context), 'A community report is active in Sulphur Springs.');
  assert.deepEqual(Array.from(lines([incident], selected)), ['A community report is active in Sulphur Springs.']);
});

test('evidence community, county, and generic fallbacks retain statewide precedence', () => {
  assert.equal(select([{ canonicalCommunity: 'Marfa' }], {}).label, 'Marfa');
  assert.deepEqual({ ...select([{ countyId: 'hopkins-tx' }], { countyName: 'Hopkins County', countyWide: true, filterMode: 'county' }) }, { label: 'Hopkins County', type: 'COUNTY', source: 'governed_county_fallback' });
  assert.deepEqual({ ...select([{}], {}) }, { label: '', type: 'GENERIC', source: 'generic_area_fallback' });
  assert.equal(format([{}], select([{}], {})), 'A community report is active nearby.');
  assert.equal(format([{}, {}], select([{}, {}], {})), '2 community reports are active nearby.');
});

test('KBYG excludes incident road detail while Alerts keeps its dedicated incident projection', () => {
  const copy = format([incident], select([incident], selected));
  assert.doesNotMatch(copy, /State Loop 313|State Hwy 67V Bus/);
  assert.match(app, /function gridlyProjectAlertIncidentLocation\(record = \{\}\)/);
  assert.match(app, /gridlyProjectAlertIncidentLocation\(row\.record\)/);
  assert.match(app, /__gridlyPresentationLocationLabel/);
  assert.match(app, /getGridlyIncidentLocationPresentation\(record\)/, 'existing map/popup incident presentation remains available');
});

test('repair is KBYG-specific and does not route through shared incident-location formatter', () => {
  const selector = functionSource('gridlySelectKbygCommunityPresentationContext');
  const formatter = functionSource('gridlyFormatKbygCommunityCopy');
  assert.doesNotMatch(`${selector}\n${formatter}`, /getGridlyIncidentLocationPresentation|gridlyProjectAlertIncidentLocation|roadName|crossStreet/);
  assert.match(app, /gridlyTravelBriefCommunityLines\(records, kbygPresentationContext\)/);
  assert.match(app, /data-gridly-travel-brief-section = section\.key|dataset\.gridlyTravelBriefSection = section\.key/);
});

test('county governance, eligibility, lifecycle, and multi-county membership remain outside presentation selector', () => {
  const selector = functionSource('gridlySelectKbygCommunityPresentationContext');
  assert.doesNotMatch(selector, /setActiveCounty|localStorage|countyMemberships\s*=|status\s*=|expires|ttl/i);
  assert.match(governedSource, /geographicEligible/);
  assert.match(governedSource, /lifecycle/);
  assert.match(app, /canonicalMultiCountyPlace: true/);
  assert.match(app, /selectedMembership/);
});

test('Location Context, top Awareness, Community Pulse, and report lifecycle remain separate consumers', () => {
  assert.match(app, /function buildGridlyCommunityPulseModel\(/);
  assert.match(app, /function gridlyGetCanonicalActiveCommunityState\(/);
  assert.match(app, /gridlyLocationContext|Location Context/i);
  const selector = functionSource('gridlySelectKbygCommunityPresentationContext');
  assert.doesNotMatch(selector, /CommunityPulse|locationContext|activeAwareness|expires|createdAt/);
});

test('owner console acceptance helper reports surface separation and governance fields', () => {
  const helper = functionSource('gridlyLp227KbygCommunityContextAcceptance');
  for (const field of ['canonicalCommunity','selectedMembership','activeCounty','governedKbygEvidenceCount','kbygPresentationContext','kbygPresentationContextType','kbygCommunityCopy','countyFallbackAvailable','incidentSpecificLocation','incidentSpecificLocationExcludedFromKbyg','alertsIncidentLocation','communityContextPass','surfaceSeparationPass','governancePreservedPass','overallPass']) assert.match(helper, new RegExp(field));
  assert.match(helper, /=== LP227 KBYG COMMUNITY CONTEXT ACCEPTANCE ===/);
});

test('production implementation is generic with no Sulphur Springs special case', () => {
  const production = [functionSource('gridlySelectKbygCommunityPresentationContext'), functionSource('gridlyFormatKbygCommunityCopy'), functionSource('gridlyTravelBriefCommunityLines')].join('\n');
  assert.doesNotMatch(production, /Sulphur Springs|Hopkins|State Loop 313|State Hwy 67V Bus/);
});
