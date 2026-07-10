const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('gridlyInvokePortraitLocalizedRefreshForAudit', 'narrow audit-only adapter is exposed');
includes('return refreshPortraitV2LocalizedIntelligence({ reason });', 'adapter invokes the exact lexical production function');
includes('invocation_adapter_unavailable', 'missing adapter fails explicitly');
includes('invocation.entered = true', 'production entry is recorded before audit invocation');
includes('invocation.exited = true', 'production exit is recorded after audit invocation');
includes('invocation.completionObserved = Boolean(gridlyV927CommunityPulseAuditState().validOutcomeCount > 0)', 'completion requires Community Pulse outcome evidence');
includes('gridlyV927RStatesDiffer(cpBefore, cpAfter)', 'Community Pulse scenario isolation compares before and after state');
includes('path.restoration.generationAtStart[label] = gridlyV927RGenerationSnapshot()', 'restoration captures generation state at wait start');
includes('path.restoration.generationAtCompletion[label] = gridlyV927RGenerationSnapshot()', 'restoration captures generation state at wait completion');
includes('path.restoration.timeoutPhases.push(label)', 'timeout diagnostics include phase labels');
includes('const finalMembership = await gridlyV927R2CaptureFinalMarkerMembership(options)', 'final expected and actual marker snapshots are aligned after restore settle');
includes('gridlyV927RResetSimulationPathState()', 'reset clears simulation path diagnostics');
includes('window.gridlyCommunityPulseSimulationPathAudit = gridlyCommunityPulseSimulationPathAudit', 'simulation path audit helper is exposed');
assert(!/gridlyV926PushSample\("communityPulse",\s*0/.test(app), 'no fake zero Community Pulse timing');
assert(!/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|clearSharedReports\s*\(/.test(app.slice(app.indexOf('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION'))), 'V927R helper does not introduce production write calls');
console.log('V927R Community Pulse simulation path repair static test passed');
