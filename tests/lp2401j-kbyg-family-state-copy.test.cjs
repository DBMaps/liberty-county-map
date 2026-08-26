const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
function block(start, end) { return app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start))); }
const sandbox = {
  Object, window: {},
  gridlyTravelBriefCleanLine: (value) => String(value || '').trim(),
  gridlyStoryTransportationImpact: (record) => record.active ? { kind: 'construction' } : null,
  gridlyStoryWeatherMeaningfulImpact: (weather) => weather?.active ? { kind: 'heat' } : null,
  gridlyGetAwarenessEvidenceCompleteness: () => ({}),
  gridlyTravelBriefDriveTexasLines: (records) => records.filter((row) => row.active).map((row) => row.summary),
  gridlyTravelBriefWeatherLines: (weather) => weather?.active ? [weather.summary] : []
};
vm.createContext(sandbox);
vm.runInContext([
  block('const GRIDLY_KBYG_FAMILY_COPY', 'function gridlyTravelBriefDriveTexasLines'),
  block('function gridlyKbygRoadwayFamily', 'function gridlyTravelBriefWeatherLines'),
  block('function gridlyKbygWeatherFamily', 'function gridlyTravelBriefSettledFreshnessCopy')
].join('\n'), sandbox);
const plain = (value) => JSON.parse(JSON.stringify(value));

test('A-D: Weather ACTIVE, QUIET and UNAVAILABLE retain specifics and prevent false quiet', () => {
  assert.deepEqual(plain(sandbox.gridlyKbygWeatherFamily({ active: true, summary: 'Heat Advisory until 7 PM' })), { state: 'ACTIVE', summary: 'Heat Advisory until 7 PM', lines: ['Heat Advisory until 7 PM'] });
  sandbox.window.gridlyLP240WeatherAuthorityAudit = () => ({ weatherAuthorityState: 'QUIET' });
  assert.equal(sandbox.gridlyKbygWeatherFamily(null).summary, 'No active weather alerts.');
  sandbox.window.gridlyLP240WeatherAuthorityAudit = () => ({ weatherAuthorityState: 'UNAVAILABLE' });
  assert.equal(sandbox.gridlyKbygWeatherFamily(null).summary, 'Weather information temporarily unavailable.');
  assert.notEqual(sandbox.gridlyKbygWeatherFamily(null).summary, 'No active weather alerts.');
});

test('E-H: roadway authority envelope distinguishes ACTIVE, proven QUIET and UNAVAILABLE', () => {
  assert.equal(sandbox.gridlyKbygRoadwayFamily([{ active: true, summary: 'Construction on US 59' }], {}, {}).summary, 'Construction on US 59');
  assert.deepEqual(plain(sandbox.gridlyKbygRoadwayFamily([], {}, { healthyEmpty: true })), { state: 'QUIET', summary: 'No active official roadway conditions.', lines: ['No active official roadway conditions.'] });
  assert.equal(sandbox.gridlyKbygRoadwayFamily([], {}, { healthyEmpty: false }).summary, 'Official roadway updates temporarily unavailable.');
  assert.notEqual(sandbox.gridlyKbygRoadwayFamily([], {}, null).summary, 'No active official roadway conditions.');
});

test('I-N: community, mixed families, known-state completeness, order and compact copy', () => {
  assert.equal(sandbox.gridlyKbygFamilyPresentation('community', 'QUIET').summary, 'No community travel conditions reported.');
  const mixed = [
    sandbox.gridlyKbygFamilyPresentation('community', 'QUIET'),
    sandbox.gridlyKbygRoadwayFamily([{ active: true, summary: 'Construction on US 59' }], {}, {}),
    (sandbox.window.gridlyLP240WeatherAuthorityAudit = () => ({ weatherAuthorityState: 'QUIET' }), sandbox.gridlyKbygWeatherFamily(null))
  ];
  assert.deepEqual(mixed.map((row) => row.state), ['QUIET', 'ACTIVE', 'QUIET']);
  const activeUnavailable = [sandbox.gridlyKbygRoadwayFamily([], {}, null), sandbox.gridlyKbygWeatherFamily({ active: true, summary: 'Heat Advisory until 7 PM' })];
  assert.deepEqual(activeUnavailable.map((row) => row.state), ['UNAVAILABLE', 'ACTIVE']);
  assert.equal([...mixed, ...activeUnavailable].filter((row) => !row.summary).length, 0);
  assert.match(app, /key: "community"[\s\S]*key: "drivetexas"[\s\S]*key: "weather"/);
  for (const row of [sandbox.gridlyKbygFamilyPresentation('weather', 'QUIET'), sandbox.gridlyKbygFamilyPresentation('weather', 'UNAVAILABLE')]) assert.equal(row.lines.length, 1);
});

test('O-Q: change remains KBYG presentation-only and consumes existing authorities', () => {
  const familyArea = block('const GRIDLY_KBYG_FAMILY_COPY', 'function gridlyTravelBriefSettledFreshnessCopy');
  assert.doesNotMatch(familyArea, /fetch\(|XMLHttpRequest|api\.weather\.gov|point=0,0/);
  assert.match(familyArea, /gridlyLP240WeatherAuthorityAudit/);
  assert.match(familyArea, /sourceEnvelope\?\.healthyEmpty|sourceEnvelope\?\.quietEligible/);
  assert.match(app, /Why Gridly says this/);
});
