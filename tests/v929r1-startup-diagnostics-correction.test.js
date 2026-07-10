const assert = require('assert');
const fs = require('fs');

const diag = fs.readFileSync('js/gridlyStartupDiagnostics.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V929R1-STARTUP-DIAGNOSTIC-CORRECTION.md', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(diag.includes('lateCompletedStages'), 'late completion evidence is retained');
assert(diag.includes('watchdogTriggered'), 'watchdog durable fields exist');
assert(diag.includes('slowStartupThresholdMs'), 'slow startup threshold is exposed');
assert(diag.includes('crossedTimeout'), 'completed stages that exceed timeout are reclassified as timed-out');
assert(diag.includes('markPrepaintReleased'), 'prepaint lock release stage is available');
assert(diag.includes('completed: state.startupCompleted'), 'completed alias is exposed from startupCompleted');
assert(diag.includes('uiUsableAt = isoNow()'), 'uiUsableAt is populated when UI usability is marked');
assert(diag.includes('replayEarlyStartupEvents'), 'early visible-frame events are replayed after diagnostics load without blocking unlock');
assert(diag.includes('validationDidNotMutateLiveAudit'), 'validation proves simulated timeouts do not persist into live audit');
assert(diag.includes('restoreState(liveSnapshot)'), 'validation restores the original live startup audit state');
assert(html.includes('gridlyStartupEarlyEvents'), 'inline prepaint release queues visible-frame markers when diagnostics is not loaded yet');
assert(html.includes('type: "firstVisibleFrame"'), 'first visible frame marker is queued explicitly');

assert(diag.includes('uiUsableBlockedWhilePrepaintActive'), 'validation proves uiUsable cannot be set under prepaint lock');
assert(app.includes('const initialReportHydration = runStartupStage("initial report and incident loading"'), 'initial report hydration starts without blocking visible startup completion');
assert(!app.includes('await runStartupStage("initial report and incident loading"'), 'initial report hydration is not awaited by startup lock');
assert(app.includes('parentStage: startupParentStage'), 'initial report child stages are linked to parent stage');
assert(app.includes('reportStage("Supabase report fetch"'), 'Supabase fetch child-stage timing is captured');
assert(app.includes('reportStage("report awareness route-watch render refresh"'), 'render/awareness/route-watch refresh child-stage timing is captured');
assert(doc.includes('179,137.3 ms'), 'runtime evidence documents slow report stage');
assert(doc.includes('182,059 ms'), 'runtime evidence documents total startup duration');
assert(doc.includes('original audit result was incorrect'), 'documentation records original timeout classification failure');
console.log('V929R1 startup diagnostics correction static validation passed');
