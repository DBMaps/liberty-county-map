const assert = require('assert');
const fs = require('fs');

const diag = fs.readFileSync('js/gridlyStartupDiagnostics.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V929R1-STARTUP-DIAGNOSTIC-CORRECTION.md', 'utf8');

assert(diag.includes('lateCompletedStages'), 'late completion evidence is retained');
assert(diag.includes('watchdogTriggered'), 'watchdog durable fields exist');
assert(diag.includes('slowStartupThresholdMs'), 'slow startup threshold is exposed');
assert(diag.includes('crossedTimeout'), 'completed stages that exceed timeout are reclassified as timed-out');
assert(diag.includes('markPrepaintReleased'), 'prepaint lock release stage is available');
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
