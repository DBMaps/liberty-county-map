const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /function gridlyLp0553PrimaryHistoricalTakeaway/, 'LP055.3 primary takeaway selector exists');
assert.match(source, /data-gridly-history-primary-takeaway-line/, 'Historical Intelligence renders a primary takeaway line');
assert.match(source, /data-gridly-history-supporting-detail/, 'Historical Intelligence keeps supporting detail below the primary takeaway');
assert.match(source, /data-gridly-history-disclaimer/, 'Historical Intelligence renders a historical-only disclaimer');
assert.doesNotMatch(source.slice(source.indexOf('function gridlyLp0553PrimaryHistoricalTakeaway'), source.indexOf('function gridlyLp0553SupportingHistoricalDetail')), /forecast|predict|alternate route|should take/i, 'Primary takeaway language avoids prediction, routing, and navigation ownership');

const start = source.indexOf('function gridlyLp0552PresentMomentRelationship');
const end = source.indexOf('function gridlyLp0543ResolveConsumerSubject');
const slice = source.slice(start, end);
const context = {
  safeDisplayText: (value, fallback = '') => String(value || fallback || '').trim(),
  gridlyLp0543SafeIdentityCandidate: (value) => String(value || '').trim(),
  gridlyLp0545InternalIdentifierSubjectDetected: () => false,
  gridlyLp0545NormalizeKey: (value) => String(value || '').toLowerCase(),
  GRIDLY_AWARENESS_AREA_BY_KEY: {},
  gridlyLp0543FormatAuthoritativeDuration: (minutes) => `${minutes} minutes`,
  gridlyLp0543FormatConsumerLocalMinute: (minutes) => `${minutes}`,
  Number,
  Boolean,
  String,
  Array,
  RegExp
};
vm.createContext(context);
vm.runInContext(slice, context);

const relevant = context.gridlyLp0553PrimaryHistoricalTakeaway({
  available: true,
  contextClassification: 'active_window',
  contextPrecisionSupported: true,
  supportedPatternDay: 'Friday',
  supportedWindowStartMinutes: 420,
  supportedWindowEndMinutes: 600,
  incidentCount: 6,
  statements: ['Waco Street Crossing is frequently blocked on Friday mornings.'],
  renderedDurationText: '45 minutes'
}, 'Waco Street Crossing');
assert.match(relevant, /Friday.*historically/i, 'Relevant current-time history produces contextual local-knowledge copy');
assert.match(context.gridlyLp0553TakeawayPresentation({
  available: true,
  contextClassification: 'active_window',
  contextPrecisionSupported: true,
  supportedPatternDay: 'Friday',
  supportedWindowStartMinutes: 420,
  supportedWindowEndMinutes: 600,
  incidentCount: 6,
  statements: ['Waco Street Crossing is frequently blocked on Friday mornings.'],
  renderedDurationText: '45 minutes'
}, 'Waco Street Crossing').durationSentence, /45 minutes/i, 'Relevant current-time history includes existing duration output');
assert.match(relevant, /Check current alerts/i, 'Relevant current-time history defers live-condition ownership to current alerts');

const irrelevant = context.gridlyLp0553PrimaryHistoricalTakeaway({
  available: true,
  contextClassification: 'same_day_outside_window',
  contextPrecisionSupported: true,
  supportedPatternDay: 'Friday',
  supportedWindowStartMinutes: 420,
  supportedWindowEndMinutes: 600,
  incidentCount: 6,
  statements: ['Waco Street Crossing is frequently blocked on Friday mornings.']
}, 'Waco Street Crossing');
assert.match(irrelevant, /No strong historical pattern matches the current time/i, 'Strong but current-time-irrelevant history suppresses the old record-viewer summary');

const sparse = context.gridlyLp0553PrimaryHistoricalTakeaway({ available: false }, 'Dayton');
assert.match(sparse, /Not enough historical community reports/i, 'Little-history context produces the approved sparse-history takeaway');

console.log('LP055.3 contextual historical intelligence coverage passed');
