const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = vm.createContext({ console, window: null, globalThis: null });
context.window = context;
context.globalThis = context;
vm.runInContext(fs.readFileSync('js/history-capture/historyIntelligenceEngine.js', 'utf8'), context);

const episode = (id, created, cleared, type = 'blocked_crossing') => ([
  { event_type: 'report_created', observed_at: created, source_report_id: id, payload: { crossingId: 'DOT-0542', reportType: type, roadName: 'Main St', lat: 30.10001, lng: -94.70001 } },
  { event_type: 'report_cleared', observed_at: cleared, source_report_id: id, payload: { crossingId: 'DOT-0542', reportType: type, roadName: 'Main St', lat: 30.10001, lng: -94.70001 } }
]);

const fixture = [
  ...episode('a', '2026-06-01T05:45:00.000Z', '2026-06-01T06:15:00.000Z'),
  ...episode('b', '2026-06-02T05:50:00.000Z', '2026-06-02T06:20:00.000Z'),
  ...episode('c', '2026-06-03T06:00:00.000Z', '2026-06-03T06:30:00.000Z'),
  ...episode('d', '2026-06-04T05:55:00.000Z', '2026-06-04T06:25:00.000Z')
];

const intelligence = context.gridlyHistoricalIntelligenceEngine.generateHistoricalIntelligence(fixture, { generatedAt: '2026-06-17T00:00:00.000Z' });
const pattern = intelligence.patternIntelligence;
const text = [pattern.title, ...pattern.statements].join(' ');

assert.strictEqual(pattern.title, 'Typical Pattern');
assert.strictEqual(pattern.consumerFacing, true);
assert.strictEqual(pattern.readOnly, true);
assert.ok(pattern.daysOfWeek.length >= 2);
assert.ok(pattern.timeOfDay.includes('morning'));
assert.strictEqual(pattern.frequency, 'frequently');
assert.strictEqual(pattern.averageDuration, 'about 30 minutes');
assert.ok(pattern.typicalResolutionTime);
assert.match(pattern.communityConfirmationPattern, /Community confirmations/);
assert.ok(pattern.recurringHazardTypes.includes('train crossing delays'));
assert.strictEqual(pattern.exposesRawRecords, false);
assert.strictEqual(pattern.exposesInternalIds, false);
assert.strictEqual(pattern.exposesTechnicalTimestamps, false);
assert.strictEqual(pattern.exposesAuditInformation, false);
assert.ok(!/(Reported:|Cleared:|source_report_id|observed_at|event_type|database|schema|table|2026-06-)/i.test(text));
assert.ok(/Typical Pattern|usually|frequently|often|Historically|Most reports|Community observations/i.test(text));

console.log('LP054.2 pattern intelligence foundation passed');
