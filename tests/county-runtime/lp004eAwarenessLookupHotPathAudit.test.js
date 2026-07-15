const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) {
  assert(source.includes(text), message);
}

includes('function gridlyAwarenessLookupHotPathAudit()', 'audit helper exists');
includes('window.gridlyAwarenessLookupHotPathAudit = gridlyAwarenessLookupHotPathAudit;', 'audit helper is exposed on window');
includes('awarenessLookupMemo: null', 'Alerts open state owns the scoped memo slot');
includes('gridlyAlertsAwarenessLookupHotPathAuditBegin(run);', 'memo/audit begins with an Alerts open run');
includes('gridlyAlertsAwarenessLookupHotPathAuditFinish(run);', 'memo/audit finalizes from Alerts open finish');
includes('gridlyAlertsOpenPerformanceAuditState.awarenessLookupMemo = null;', 'memo clears after Alerts open completes');
includes('const originalLookupString = String(value || "");', 'memo key preserves the original lookup string');
includes('if (memo && memo.has(originalLookupString))', 'identical lookup strings use the scoped memo');
includes('memo.set(originalLookupString, normalized);', 'different original strings normalize independently before storage');
includes('cacheHits += 1', 'audit records cache hits');
includes('cacheMisses += 1', 'audit records cache misses');
includes('callerBreakdown', 'audit returns ranked caller breakdown');
includes('originatingCallChains', 'audit returns originating call chains');
includes('repairPass: selected?.repairPass || "scoped_per_alerts_open_normalization_memo"', 'audit certifies the narrow repair pass');

const normalizeStart = source.indexOf('function normalizeGridlyAwarenessAreaLookupText');
const normalizeEnd = source.indexOf('\nfunction resolveGridlyAwarenessArea', normalizeStart);
const normalizeBody = source.slice(normalizeStart, normalizeEnd);
assert(!normalizeBody.includes('localStorage'), 'normalization memo does not touch startup/local storage');
assert(!normalizeBody.includes('sessionStorage'), 'normalization memo does not persist across opens');
assert(!normalizeBody.includes('getGridlySelectedAwarenessArea'), 'normalization memo does not cache awareness selections');
assert(!normalizeBody.includes('GRIDLY_COUNTY_REGISTRY'), 'normalization memo does not cache provider/county data');

console.log('lp004eAwarenessLookupHotPathAudit.test.js passed');
