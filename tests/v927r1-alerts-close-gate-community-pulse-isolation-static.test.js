const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('document.querySelector("#gridlyPortraitV2Sheet")', 'Alerts sheet selector is exact');
includes('document.querySelector("#gridlyPortraitV2SheetClose")', 'real Alerts close button selector is exact');
includes('before.closeButton.click();', 'real click pathway is used');
const harness = app.slice(app.indexOf('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION'));
assert(!/classList\.remove\([^)]*is-open/.test(harness), 'Alerts gate does not directly remove open classes');
includes('!after.visible && !after.sheet.classList?.contains?.("is-open") && !after.sheet.classList?.contains?.("active") && !after.sheet.classList?.contains?.("open")', 'closure verification checks visibility and all open classes');
includes('recordFailure("alerts interaction", "alerts_sheet_not_closed", closeGate)', 'failed close records alerts_sheet_not_closed');
includes('stoppedBeforeCommunityPulse: true', 'failed close stops before Community Pulse');
includes('window.gridlyRunCommunityPulsePerformanceIsolation = gridlyRunCommunityPulsePerformanceIsolation', 'isolation runner is exposed');
includes('`v927r1-community-pulse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`', 'isolation runner creates unique runId');
includes('window.gridlyInvokePortraitLocalizedRefreshForAudit("community-pulse-isolation")', 'isolation runner invokes focused adapter reason');
includes('gridlyV927R1HasReuseEvidence(productionResult)', 'valid reuse result classifier is present');
includes('productionResult?.cacheReuseApplied', 'cacheReuseApplied is valid reuse evidence');
includes('Number(productionResult?.unchangedDomWriteSkipped || 0) > 0', 'unchangedDomWriteSkipped is valid reuse evidence');
includes('Number(counts.sharedActiveAwarenessReuseApplied || 0) > 0', 'shared active awareness reuse is valid reuse evidence');
includes('Number(counts.desktopCommunityPulseDomRenderSkipped || 0) > 0', 'desktop Community Pulse skip is valid reuse evidence');
includes('Number(counts.previewCardRenderSkippedForPortraitSharedModel || 0) > 0', 'preview shared-model skip is valid reuse evidence');
includes('p50: rendered ? audit.p50 : null, p95: rendered ? audit.p95 : null', 'reuse path reports null P50/P95');
assert(!/gridlyV926PushSample\("communityPulse",\s*0/.test(app), 'no zero timing fabrication');
includes('const rendered = audit.renderedSampleCount > 0', 'rendered path remains supported');
includes('gridlyResetCommunityPulsePerformanceIsolation', 'isolation reset helper exists');
includes('delete window.gridlyCommunityPulsePerformanceIsolationResult', 'reset clears isolation state');
assert(!/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|clearSharedReports\s*\(/.test(harness), 'no production writes added in harness block');
includes('sharedReports: "read-only"', 'protected systems marker remains unchanged');
console.log('V927R.1 Alerts close gate and Community Pulse isolation static test passed');
