const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const styles = fs.readFileSync('css/styles.css', 'utf8').replace(/\r\n/g, '\n');

// LP055.3 supersedes LP055.1's record-viewer copy with a primary takeaway.
// Execute the current renderer's unavailable and insufficient-history branches.
const vm = require('vm');
const start=source.indexOf('function gridlyBuildHistoricalIntelligenceSheetHtmlWithBuilderMemo');
const end=source.indexOf('function buildGridlyHistoricalIntelligenceSheetHtml(',start);
let classification='no_history';
const context={
 gridlyHistoricalProtectedState:()=>({historyUiEnabled:false,historicalReadsEnabled:false}),
 gridlyLp0543BuildVisibleHistoricalPatternModel:()=>({patternResultAvailable:false,evidenceClassification:classification,privateReceipt:'must-not-render'}),
 gridlyLp0552ResolveConsumerSubjectLabel:()=>({label:'Selected area',source:'governed',fallbackUsed:false}),
 gridlyLp0552CurrentAwarenessIdentitySnapshot:()=>({identity:'PLACE_GEOID:synthetic',subjectLabel:'Selected area'}),
 buildGridlyIntelligencePreviewCardModel:()=>({dedupedRankedFindings:[]}),
 sanitizeText:x=>String(x??'')
};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
for(const state of ['no_history','insufficient_history','unavailable']) {
 classification=state;
 const html=context.gridlyBuildHistoricalIntelligenceSheetHtmlWithBuilderMemo({ignoreRuntimeSelection:true});
 assert.match(html,/Not enough historical community reports are available/,'missing evidence stays unknown, not zero');
 assert.match(html,/Historical context only\. Current conditions may differ\./);
 assert.match(html,/Local knowledge from cleared community reports/);
 assert.doesNotMatch(html,/must-not-render|device_id|replay_evidence|observation_receipts|0 reports|all clear|no incidents/i);
}
assert.match(source,/data-gridly-history-primary-takeaway-line/);
assert.match(source,/data-gridly-history-supporting-detail/);
assert.match(source,/data-gridly-history-disclaimer/);
assert.match(styles, /\.gridly-historical-intelligence-subtitle[\s\S]*font-size:\s*0\.78rem[\s\S]*line-height:\s*1\.42/, 'intro typography improves readability');
assert.match(styles, /\.gridly-historical-intelligence-pattern span,\n\.gridly-historical-intelligence-line span[\s\S]*text-transform:\s*uppercase/, 'micro-label hierarchy is styled consistently');
assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.gridly-historical-intelligence-summary/, 'mobile portrait historical rows retain responsive spacing controls');

console.log('LP055.1 historical intelligence sheet presentation static coverage passed');
