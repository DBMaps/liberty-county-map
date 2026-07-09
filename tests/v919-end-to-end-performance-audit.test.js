const assert = require('assert');
const fs = require('fs');

const auditSource = fs.readFileSync('js/gridlyEndToEndPerformanceAudit.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V919-END-TO-END-PERFORMANCE-AUDIT.md', 'utf8');

[
  'gridlyEndToEndPerformanceAudit',
  'gridlyRuntimeSchedulerAudit',
  'gridlyRunPerformanceSimulation',
  'gridlyPerformanceSimulationSummary'
].forEach((name) => {
  assert(auditSource.includes(`globalScope.${name}`), `${name} is exposed by the V919 audit module`);
  assert(docSource.includes(`window.${name}?.()`) || docSource.includes(`window.${name}`), `${name} is documented for browser validation`);
});

[
  'available', 'version', 'sessionStartedAt', 'deviceClass', 'connectionProfile', 'startup',
  'interactions', 'reporting', 'alerts', 'awareness', 'communityPulse', 'crossings',
  'hazards', 'search', 'routeWatch', 'map', 'network', 'storage', 'rendering',
  'longTasks', 'duplicateWork', 'eventListeners', 'timers', 'recommendations', 'safeForBeta'
].forEach((field) => assert(auditSource.includes(field), `consolidated audit includes ${field}`));

[
  'duplicateRequests',
  'duplicateListenerRisks',
  'hiddenTabWork',
  'PerformanceObserver',
  'pointerdown',
  'visualAcknowledgement',
  'simulatedReportWritesOnly',
  'noProductionWrite',
  'p95',
  'P0',
  'P1',
  'P2',
  'P3'
].forEach((token) => assert(auditSource.includes(token), `V919 audit includes ${token}`));

assert(indexSource.includes('js/gridlyEndToEndPerformanceAudit.js?v=919'), 'index loads the V919 audit module');
assert(appSource.includes('document.hidden'), 'live refresh loop checks document.hidden');
assert(appSource.includes('hiddenTabInterval'), 'hidden-tab polling suppression is auditable');
assert(docSource.includes('Protected-system confirmation'), 'documentation includes protected-system confirmation');
assert(docSource.includes('Exact browser testing commands'), 'documentation includes browser console commands');
assert(docSource.includes('Exact mobile validation checklist'), 'documentation includes mobile validation checklist');

console.log('v919-end-to-end-performance-audit.test.js passed');
