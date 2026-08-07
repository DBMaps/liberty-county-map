import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const extract = name => {
  const start = app.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const parametersStart = app.indexOf('(', start);
  let parameterDepth = 0;
  let bodyStart = -1;
  for (let i = parametersStart; i < app.length; i += 1) {
    if (app[i] === '(') parameterDepth += 1;
    if (app[i] === ')' && --parameterDepth === 0) { bodyStart = app.indexOf('{', i); break; }
  }
  let depth = 0;
  let opened = false;
  for (let i = bodyStart; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}' && opened && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
};

const context = {
  window: {},
  safeDisplayText: value => String(value ?? ''),
  getGridlySelectedAwarenessArea: () => ({ label: 'Dayton', countyId: 'liberty-tx' }),
  isGridlyRecordInAwarenessArea: (record, area) => record.community === area.label,
  Object, Array, Boolean, Number, String, RegExp
};
vm.createContext(context);
vm.runInContext(`${extract('gridlyStoryText')}\n${extract('gridlyStoryWeatherMeaningfulImpact')}\n${extract('gridlyQualifyDestinationWeatherEvidence')}`, context);
const qualify = input => context.gridlyQualifyDestinationWeatherEvidence(input);
const communityFlood = { type: 'flooding', source: 'community', providerId: null, community: 'Dayton' };
const currentFloodAlert = { providerRecordId: 'nws-alert-1', title: 'Flash Flood Warning', authority: { ownershipMethod: 'community' } };
const selection = (...situations) => ({ authorityStatus: situations.length ? 'ACTIVE' : 'QUIET', consumerVisibleSituations: situations });

test('community flooding, future_source and keywords cannot impersonate weather evidence', () => {
  const record = { ...communityFlood, description: 'rain flood weather storm future_source: txdot_flooding' };
  assert.equal(qualify({ records: [record], weatherSelection: selection() }), null);
  assert.equal(record.type, 'flooding');
});

test('connector capability with zero normalized/authority records suppresses weather support', () => {
  const connectorState = { connected: true, automaticPolling: true, normalizedRecordCount: 0 };
  assert.equal(connectorState.connected, true);
  assert.equal(qualify({ records: [communityFlood], weatherSelection: selection() }), null);
});

test('current authority-backed, consumer-eligible, local weather can corroborate flooding', () => {
  assert.equal(qualify({ records: [communityFlood], weatherSelection: selection(currentFloodAlert) })?.authorityBacked, true);
});

test('stale or expired weather excluded by governed consumer selector stays suppressed', () => {
  const governedSelection = { authorityStatus: 'QUIET', quietStateReason: 'all_records_expired', consumerVisibleSituations: [] };
  assert.equal(qualify({ records: [communityFlood], weatherSelection: governedSelection }), null);
});

test('wrong-locality evidence fails closed and Dayton-local semantics remain available', () => {
  const remote = { ...communityFlood, community: 'Goodrich' };
  assert.equal(qualify({ records: [remote], weatherSelection: selection(currentFloodAlert) }), null);
  assert.ok(qualify({ records: [communityFlood], weatherSelection: selection(currentFloodAlert) }));
});

test('rebuild converges when weather disappears without removing community evidence', () => {
  assert.ok(qualify({ records: [communityFlood], weatherSelection: selection(currentFloodAlert) }));
  assert.equal(qualify({ records: [communityFlood], weatherSelection: selection() }), null);
  assert.equal(communityFlood.source, 'community');
});

test('weather qualification is independent of official roadway support and stops without route records', () => {
  assert.ok(qualify({ records: [communityFlood], weatherSelection: selection(currentFloodAlert) }));
  assert.equal(qualify({ records: [], weatherSelection: selection(currentFloodAlert) }), null);
  assert.doesNotMatch(extract('gridlyQualifyDestinationWeatherEvidence'), /DriveTexas|officialCount|official roadway/i);
});

test('Destination Intelligence renders weather wording only from qualified evidence', () => {
  const render = extract('renderGridlyDestinationImpactPane');
  assert.match(render, /gridlyQualifyDestinationWeatherEvidence\(\{ records \}\)/);
  assert.match(render, /weatherActive: Boolean\(weatherEvidence\)/);
  assert.doesNotMatch(render, /weatherCount|\/weather\|rain\|storm\|flood/);
});
