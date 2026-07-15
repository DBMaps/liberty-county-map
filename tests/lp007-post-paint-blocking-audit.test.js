const assert = require('assert');
const fs = require('fs');

const diagnostics = fs.readFileSync('js/gridlyStartupDiagnostics.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert(diagnostics.includes('window.gridlyPostPaintBlockingAudit = postPaintBlockingAudit'), 'gridlyPostPaintBlockingAudit exists');
assert(diagnostics.includes('architectureOnly: true'), 'architectureOnly is declared');
assert(diagnostics.includes('protectedSystemsChanged: false'), 'protectedSystemsChanged is false');
assert(diagnostics.includes('new PerformanceObserver'), 'longtask PerformanceObserver is installed passively');
assert(diagnostics.includes('entryTypes: ["longtask"]'), 'longtask entry type is observed');
assert(diagnostics.includes('document.addEventListener("pointerdown"'), 'passive pointer capture probe exists');
assert(diagnostics.includes('document.addEventListener("click"'), 'passive click capture probe exists');
assert(diagnostics.includes('markInteractionProbe'), 'handler-entry probe API exists');

assert(!/setTimeout\([^)]*loadCrossings\(/.test(app), 'no production scheduling behavior changed for crossing startup');
assert(!/requestAnimationFrame\([^)]*loadSharedReports\("initial_bootstrap"\)/.test(app), 'no production scheduling behavior changed for initial report startup');
assert(app.includes('await runStartupStage("crossing package loading and initial marker rendering"'), 'crossing startup function was not deferred');
assert(app.includes('const initialReportHydration = runStartupStage("initial report and incident loading"'), 'initial report hydration remains non-awaited and non-deferred as before');
assert(!/disabled\s*[:=]\s*true[^\n]*(DriveTexas|Weather|Provider|provider)/i.test(app + index), 'no provider was disabled');
assert(!app.includes('gridlyDisplayCandidateRuntime'), 'no Display Candidate runtime was introduced');

const openAlertsStart = app.indexOf('function openAlertsSurfaceFromDock()');
const openAlertsEnd = app.indexOf('\nfunction invokeMobileAlertsEntry', openAlertsStart);
assert(openAlertsStart > -1 && openAlertsEnd > openAlertsStart, 'openAlertsSurfaceFromDock block found');
const openAlertsBlock = app.slice(openAlertsStart, openAlertsEnd);
assert(openAlertsBlock.includes('const gridlyAlertsOpenAuditRun = gridlyAlertsOpenAuditBegin();'), 'Alert rendering behavior remains anchored to existing open audit');
assert(openAlertsBlock.includes('getAlertsSurfaceSnapshot'), 'Alert rendering still uses the existing snapshot path');
assert(!openAlertsBlock.includes('setTimeout(() => getAlertsSurfaceSnapshot'), 'Alert snapshot behavior was not scheduled/deferred');

console.log('LP007 post-paint blocking audit static guard passed');
