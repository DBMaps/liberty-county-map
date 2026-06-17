const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../../js/history-capture/historyIntelligenceEngine.js');
require('../../js/history-capture/historyAwarenessAdapter.js');

(() => {
  const engine = globalThis.gridlyHistoricalIntelligenceEngine;
  const adapter = globalThis.gridlyHistoricalAwarenessAdapter;
  const appSource = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');

  assert.ok(adapter, 'adapter is available for visible-output audit');
  assert.match(appSource, /function getGridlyVisibleHistoricalAwarenessLine/, 'Awareness Brief uses a controlled visible historical context resolver');
  assert.match(appSource, /surface: "awarenessBrief"/, 'selected visible surface is Awareness Brief');
  assert.match(appSource, /historicalAwarenessContext|buildHistoricalAwarenessContext/, 'visible context is sourced from V432 adapter context');
  assert.doesNotMatch(appSource, /from\(['"]history_capture|select\([\s\S]{0,120}historical_events|historicalReadsEnabled\s*=\s*true/, 'UI code does not enable direct historical reads');

  const primaryEvents = [
    { eventType: 'report_created', observedAt: '2026-06-17T10:00:00.000Z', report: { id: 'fixture-1', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_cleared', observedAt: '2026-06-17T10:45:00.000Z', report: { id: 'fixture-1', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_created', observedAt: '2026-06-17T11:00:00.000Z', report: { id: 'fixture-2', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_cleared', observedAt: '2026-06-17T11:35:00.000Z', report: { id: 'fixture-2', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_created', observedAt: '2026-06-17T12:00:00.000Z', report: { id: 'fixture-3', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_cleared', observedAt: '2026-06-17T12:25:00.000Z', report: { id: 'fixture-3', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } }
  ];
  const primary = adapter.buildHistoricalAwarenessContext(engine.generateHistoricalIntelligence(primaryEvents));
  const low = adapter.buildHistoricalAwarenessContext(engine.generateHistoricalIntelligence(primaryEvents.slice(0, 1)));
  const primaryBrief = primary.surfaces.awarenessBrief[0];
  const lowBrief = low.surfaces.awarenessBrief[0];

  assert.strictEqual(primaryBrief.message, 'Repeated reports have been observed here.');
  assert.strictEqual(primaryBrief.consumerSafe, true);
  assert.strictEqual(primaryBrief.exposesRawHistory, false);
  assert.strictEqual(lowBrief.lowEvidence, true);
  assert.match(lowBrief.message, /historical evidence is still limited|limited historical evidence/i);

  const visibleMessages = `${primaryBrief.message} ${lowBrief.message}`;
  [
    'predicted', 'forecast', 'guaranteed', 'will happen', 'history_capture',
    'database', 'schema', 'table', 'raw event', 'confidence score',
    'user reliability', 'reputation'
  ].forEach((phrase) => assert.strictEqual(visibleMessages.toLowerCase().includes(phrase), false, `visible output excludes ${phrase}`));
  assert.doesNotMatch(visibleMessages, /(event_type|source_report_id|observed_at|created_at|cleared_at|historical_events|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/i);
  assert.deepStrictEqual(primary.protectedBoundaries, {
    historicalReadsEnabled: false,
    historyUiEnabled: false,
    historicalApiExposure: false,
    consumerFacingHistory: false,
    DriveTexasPaused: true
  });

  console.log('historicalVisibleAwarenessOutputAudit.test.js passed');
})();
