const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyNormalizeBriefingDuplicateText');
const end = app.indexOf('function gridlyBriefInteractionBuildModel');
assert(start > -1 && end > start, 'V883R briefing duplicate helpers must exist before briefing model assembly');

const context = {
  safeDisplayText(value, fallback = '') { return value == null ? fallback : String(value); },
  gridlyBriefNormalizeAwarenessAreaKey(value = '') { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); },
  gridlyBriefDetectCorridor(value = '') {
    const text = String(value).toLowerCase();
    if (/\bus\s*90\b|\bus-?90\b/.test(text)) return 'us-90';
    if (/\btx\s*321\b|\btx-?321\b/.test(text)) return 'tx-321';
    return '';
  }
};
vm.createContext(context);
vm.runInContext(app.slice(start, end), context);

const before = [
  { text: 'Road Closed on US 90 2 miles west of Dayton' },
  { text: 'Road Closed on 2 miles west of Dayton' },
  { text: 'Traffic Backup on TX 321 5 miles west of Kenefick' },
  { text: 'Also.' },
  { text: 'Allow extra travel time in this area.' }
];
const noTransitions = context.gridlySuppressStandaloneTransitionBriefItems(before);
const after = context.gridlySuppressDuplicateBriefingConditionItems(noTransitions, { awarenessContext: { key: 'dayton', label: 'Dayton' } }).map((item) => item.text);

assert(after.includes('Road Closed on US 90 2 miles west of Dayton'), 'stronger road-name road closure line is preferred');
assert(!after.includes('Road Closed on 2 miles west of Dayton'), 'weaker duplicate road closure line is suppressed');
assert(after.includes('Traffic Backup on TX 321 5 miles west of Kenefick'), 'distinct traffic backup condition remains separate');
assert(!after.some((line) => /^Also\.?$/i.test(line)), 'standalone Also remains suppressed');
assert(after.some((line) => /Allow extra travel time in this area\./i.test(line)), 'travel fallback line can still remain in briefing-support samples');
assert.match(app, /window\.gridlyBriefingDuplicateSuppressionAudit/, 'V883R audit helper must be exposed');

console.log('V883R briefing duplicate condition suppression checks passed');
