const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
assert.match(source, /data-gridly-historical-intelligence-sheet="true"/, 'stable visible Historical Intelligence sheet selector is rendered');
assert.match(source, /visibleHistoricalSheetFound/, 'browser audit reports visible sheet discovery');
assert.match(source, /historicalDisclaimerMatchesVisibleSheet/, 'browser audit binds disclaimer detection to the visible sheet');
assert.match(source, /visible_historical_sheet_missing/, 'audit fails when no visible sheet is inspected');
assert.doesNotMatch(source.slice(source.indexOf('function gridlyLp0553PrimaryHistoricalTakeaway'), source.indexOf('function gridlyLp0543ResolveConsumerSubject')), /\blikely\b|\bexpected\b|\bprobably\b|\bpredicted\b|\bshould\b|\bwill\b|\brisk\b|\bsafe\b|\bavoid\b/i, 'takeaway presentation avoids predictive and routing words');

const start = source.indexOf('function gridlyLp0552PresentMomentRelationship');
const end = source.indexOf('function gridlyLp0543ResolveConsumerSubject');
const context = {
  safeDisplayText: (value, fallback = '') => String(value || fallback || '').trim(),
  gridlyLp0543SafeIdentityCandidate: (value) => String(value || '').trim(),
  gridlyLp0545InternalIdentifierSubjectDetected: () => false,
  gridlyLp0545NormalizeKey: (value) => String(value || '').toLowerCase(),
  GRIDLY_AWARENESS_AREA_BY_KEY: {},
  gridlyLp0543FormatAuthoritativeDuration: (minutes) => `about ${minutes} minutes`,
  gridlyLp0543FormatConsumerLocalMinute: (minutes) => minutes === 420 ? '7:00 AM' : (minutes === 600 ? '10:00 AM' : `${minutes}`),
  GRIDLY_LP0543_MIN_PRECISE_WINDOW_INCIDENTS: 3,
  GRIDLY_AWARENESS_AREA_BY_KEY: {},
  gridlyLp0545InternalIdentifierSubjectDetected: () => false,
  gridlyLp0545NormalizeKey: (value) => String(value || '').toLowerCase(),
  Number, Boolean, String, Array, RegExp, Object
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const fridayCrossing = {
  available: true,
  findingId: 'finding-waco-friday',
  contextClassification: 'active_window',
  contextPrecisionSupported: true,
  supportedPatternDay: 'Friday',
  supportedWindowStartMinutes: 420,
  supportedWindowEndMinutes: 600,
  incidentCount: 6,
  statements: ['Train blockage reports at Waco Street and US 90.'],
  renderedDurationText: 'about 45 minutes'
};
const relevant = context.gridlyLp0553TakeawayPresentation(fridayCrossing, 'Waco Street and US 90');
assert.equal(relevant.quietStateUsed, false);
assert.match(relevant.primary, /Fridays around this time.*train blockages at Waco Street and US 90/i);
assert.match(relevant.durationSentence, /Train blockages at Waco Street and US 90 have typically lasted about 45 minutes\./);
assert.equal(relevant.allTakeawayFieldsShareFinding, true);
assert.deepStrictEqual(new Set(Object.values(relevant.selectedTakeawayFieldProvenance)).size, 1);

const irrelevant = context.gridlyLp0553TakeawayPresentation({ ...fridayCrossing, contextClassification: 'different_day' }, 'Waco Street and US 90');
assert.equal(irrelevant.quietStateUsed, true);
assert.match(irrelevant.primary, /No strong historical pattern matches the current time for Waco Street and US 90\. Check current alerts for live conditions\./);
assert.equal(irrelevant.durationSentence, '');
assert.equal(irrelevant.selectedTakeawaySubject, '');

const countyRelevant = context.gridlyLp0553TakeawayPresentation(fridayCrossing, 'Waco Street and US 90');
assert.match(countyRelevant.primary, /Waco Street and US 90/);
assert.doesNotMatch(countyRelevant.primary, /Liberty County is often|Liberty County.*common time/);

const countyQuiet = context.gridlyLp0553TakeawayPresentation({ ...fridayCrossing, contextClassification: 'same_day_outside_window' }, 'Liberty County');
assert.equal(countyQuiet.quietStateUsed, true);
assert.match(countyQuiet.primary, /^No strong historical pattern matches the current time for Liberty County\./);
assert.equal(countyQuiet.durationSentence, '');

assert.equal(context.gridlyLp0553HistoricalDurationSentence({ ...fridayCrossing }, ''), '', 'duration cannot render without a named subject');
assert.equal(context.gridlyLp0553HistoricalDurationSentence({ ...fridayCrossing, statements: ['Community report'], renderedDurationText: '1 minute' }, 'Waco Street and US 90'), '', 'one-minute unattributed duration is suppressed');
assert.match(relevant.primary, /Check current alerts for live conditions\./, 'approved live-ownership language is used');

console.log('LP055.3A specific-or-quiet historical takeaway checks passed');
