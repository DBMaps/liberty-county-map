const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('window.gridlyLp0456LiveOfficialAlertCardAudit'), 'LP045.6 visible Alerts sheet audit is exposed');
assert(app.includes('gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync.renderAlertCard -> RenderCompleteAlertCard'), 'exact live renderer is identified');
assert(app.includes('presentationAlerts from presentationCountModel.alerts fallback buildAlertPresentationGroups(alertsForRender)'), 'live collection is identified');
assert(app.includes('const officialDetection = typeof gridlyLp0456OfficialSourceDetection'), 'live renderer uses multi-field official source detection');
assert(app.includes('selectedDescriptionCandidates.map((candidate) => ({ field: candidate.field'), 'raw description candidates are traced');
assert(app.includes('gridlyLp0455OfficialFreshnessResult(alert).renderedFreshnessLine'), 'official alert cards use corrected freshness presentation');
assert(app.includes('likelyRootCause'), 'audit reports likely root cause');
assert(app.includes('gridlyLp045EnsureOfficialMarkersCurrent'), 'marker rendering path remains present');
assert(app.includes('gridlyLp0393ConsumerDriveTexasPopupHtml'), 'popup binding path remains present');
assert(app.includes('Official Source · DriveTexas'), 'popup attribution remains present');
assert(app.includes('focusPulseApplied'), 'focus pulse remains audited');
assert(app.includes('gridlyEvaluateDriveTexasGeographicOwnership'), 'LP039 authority remains present');
assert(app.includes('Travel Brief'), 'Travel Brief ownership remains present');

const sanitizerSource = app.match(/function gridlySanitizeOfficialConsumerProse[\s\S]*?\n}\n/)[0];
const detectionSource = app.match(/function gridlyLp0456OfficialSourceDetection[\s\S]*?function gridlyLp0456IsOfficialDriveTexasRecord[\s\S]*?\n}\n/)[0];
const freshnessSource = app.match(/function gridlyLp0455ParseOfficialFreshnessValue[\s\S]*?function gridlyLp0393OfficialPopupFreshnessLine/)[0].replace(/function gridlyLp0393OfficialPopupFreshnessLine$/, '');
const context = {
  Date,
  Number,
  String,
  RegExp,
  Math,
  formatGridlyAlertsFreshnessLine(value, fallback = '') {
    const minutes = Number(value?.minutesAgo ?? value?.newestMinutes ?? value?.age_minutes ?? value);
    if (!Number.isFinite(minutes)) return fallback || 'Updated just now';
    if (minutes <= 1) return 'Updated just now';
    return `Updated ${Math.round(minutes)} minutes ago`;
  }
};
vm.createContext(context);
vm.runInContext(`${sanitizerSource}\n${detectionSource}\nconst GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES = 60 * 24 * 14;\n${freshnessSource}`, context);

const liveRecord = {
  providerId: 'drivetexas',
  sourceType: 'official-roadways',
  recordType: 'official_roadway_situation',
  category: 'Construction',
  sourceLocationDescription: 'US 59, MAIN LANES not affected.<br> /<br>Construction of safety improvements consisting of installing cable median barrier.',
  updatedAt: '2025-04-08T08:42:00-05:00'
};
assert.strictEqual(context.gridlyLp0456IsOfficialDriveTexasRecord(liveRecord), true, 'live-shaped DriveTexas record is recognized as official');
const selected = liveRecord.sourceLocationDescription;
const sanitized = context.gridlySanitizeOfficialConsumerProse(selected);
assert(!/<\s*br\s*\/?\s*>/i.test(sanitized), 'literal break variants disappear');
assert(!/&lt;\s*br\s*\/?\s*&gt;/i.test(sanitized), 'escaped break variants disappear');
assert(!/(?:^|\s)[/|]+(?:\s|$)/.test(sanitized), 'slash-only separators disappear');
assert(/Construction of safety improvements/i.test(sanitized), 'meaningful text remains');
const laterFallback = sanitized || 'raw fallback';
assert.strictEqual(laterFallback, sanitized, 'later fallback does not overwrite sanitized string');
const community = 'Use <br> literally / if the neighbor typed it';
assert.strictEqual(community, 'Use <br> literally / if the neighbor typed it', 'community cards remain unchanged by scoped official sanitizer');
let freshness = context.gridlyLp0455OfficialFreshnessResult(liveRecord, Date.parse('2026-07-21T12:00:00Z'));
assert.strictEqual(freshness.freshnessReasonable, false, 'implausibly old timestamp is rejected');
assert.strictEqual(freshness.freshnessFallbackReason, 'implausibly_old');
assert.notStrictEqual(freshness.renderedFreshnessLine, 'Updated recently', 'old timestamp does not render Updated recently');
assert.strictEqual(freshness.renderedFreshnessLine, 'Update time unavailable');
freshness = context.gridlyLp0455OfficialFreshnessResult({}, Date.parse('2026-07-21T12:00:00Z'));
assert.strictEqual(freshness.renderedFreshnessLine, 'Update time unavailable', 'unknown freshness renders unavailable');
freshness = context.gridlyLp0455OfficialFreshnessResult({ updatedAt: '2026-07-21T11:45:00Z' }, Date.parse('2026-07-21T12:00:00Z'));
assert.strictEqual(freshness.renderedFreshnessLine, 'Updated 15 minutes ago', 'valid recent timestamps still render normally');

console.log('LP045.6 live official alert card renderer repair checks passed');
