const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
assert(app.includes('window.gridlyLp0455OfficialCopyFreshnessAudit'), 'LP045.5 audit helper is exposed');
assert(app.includes('openAlertsSurfaceFromDock.renderAlertCard RenderCompleteAlertCard displaySubtitle'), 'alert-card renderer boundary is audited');
assert(app.includes('gridlyLp0393ConsumerDriveTexasPopupHtml'), 'official popup path remains present');
assert(app.includes('Official Source · DriveTexas'), 'popup still includes Official Source · DriveTexas');
assert(app.includes('gridlyLp045EnsureOfficialMarkersCurrent'), 'marker creation path remains present');
assert(app.includes('markerLayerInsertSucceeded'), 'official layer insertion audit remains present');
assert(app.includes('focusPulseApplied'), 'focus pulse audit remains present');
assert(app.includes('Travel Brief'), 'Travel Brief ownership text remains present');
assert(app.includes('gridlyEvaluateDriveTexasGeographicOwnership'), 'LP039 authority remains present');

const sanitizerSource = app.slice(app.indexOf('function gridlyOfficialConsumerSentenceCase'), app.indexOf('const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES'));
const freshnessSource = app.match(/const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES[\s\S]*?function gridlyLp0393OfficialPopupFreshnessLine[\s\S]*?\n}\n/)[0];
const context = {
  Date,
  Number,
  String,
  RegExp,
  Math,
  window: {},
  formatGridlyAlertsFreshnessLine(value, fallback = '') {
    const minutes = Number(value?.minutesAgo ?? value?.newestMinutes ?? value?.age_minutes ?? value);
    if (!Number.isFinite(minutes)) return fallback || 'Updated just now';
    if (minutes <= 1) return 'Updated just now';
    return `Updated ${Math.round(minutes)} minutes ago`;
  },
  gridlyLp0452OfficialMarkerConstructionTraceState: { lastTrace: null }
};
vm.createContext(context);
vm.runInContext(`${sanitizerSource}\n${freshnessSource}`, context);

const liveShape = 'US 59, MAIN LANES not affected.<br> /<br>Construction of safety improvements consisting of installing cable median barrier.';
const sanitized = context.gridlySanitizeOfficialConsumerProse(liveShape);
assert(!/<\s*br\s*\/?\s*>/i.test(sanitized), 'literal <br> is removed');
assert(!/(?:^|\s)[/|]+(?:\s|$)/.test(sanitized), 'slash-only separators are removed');
assert(sanitized.includes('US 59 Main lanes remain open.'), 'meaningful route and lane prose remains in consumer language');
assert(sanitized.includes('Crews are installing a cable median barrier.'), 'meaningful construction prose remains in consumer language');

['A<br>B', 'A<br/>B', 'A<br />B', 'A&lt;br&gt;B', 'A<br><br/> /<br />B'].forEach((sample) => {
  const result = context.gridlySanitizeOfficialConsumerProse(sample);
  assert(!/<\s*br|&lt;\s*br|(?:^|\s)[/|]+(?:\s|$)/i.test(result), `break/slash artifacts removed for ${sample}`);
});
assert(!context.gridlySanitizeOfficialConsumerProse('<p>Official marker popup<br/>prose</p>').includes('<'), 'official marker popup prose sanitizer removes tags');

const now = Date.parse('2026-07-21T12:00:00Z');
let result = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: '2026-07-21T11:45:00Z' }, now);
assert.strictEqual(result.calculatedAgeMinutes, 15, 'ISO timestamp age is reasonable');
assert.strictEqual(result.freshnessReasonable, true);
result = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: Math.floor((now - 20 * 60000) / 1000) }, now);
assert.strictEqual(result.freshnessUnitClassification, 'epoch_seconds', 'epoch seconds are classified');
assert.strictEqual(result.calculatedAgeMinutes, 20);
result = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: now - 30 * 60000 }, now);
assert.strictEqual(result.freshnessUnitClassification, 'epoch_milliseconds', 'epoch milliseconds are classified');
assert.strictEqual(result.calculatedAgeMinutes, 30);
result = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: 42 }, now);
assert.strictEqual(result.freshnessUnitClassification, 'non_date_numeric_rejected', 'minute counts are not mistaken for timestamps');
assert.strictEqual(result.renderedFreshnessLine, 'Update time unavailable');
assert.strictEqual(result.freshnessFallbackReason, 'invalid_or_unknown');
result = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: 'not a date' }, now);
assert.strictEqual(result.renderedFreshnessLine, 'Update time unavailable', 'invalid timestamps fall back safely');
result = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: '2020-01-01T00:00:00Z' }, now);
assert.strictEqual(result.renderedFreshnessLine, 'Update time unavailable', 'implausibly old timestamps fall back safely');
assert.strictEqual(result.freshnessFallbackReason, 'implausibly_old');
assert(!/754673 minutes ago|NaN minutes ago|Invalid Date|undefined/.test(result.renderedFreshnessLine), 'unsafe freshness copy is not rendered');

assert(!/community[^\n]{0,120}gridlySanitizeOfficialConsumerProse/i.test(app), 'community alert cards are not globally sanitized');
console.log('LP045.5 official copy/freshness regression checks passed');
