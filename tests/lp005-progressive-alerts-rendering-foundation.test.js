const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

const foundationStart = source.indexOf('const GRIDLY_LP005_ALERTS_RENDERING_FOUNDATION');
assert(foundationStart > -1, 'LP005 phase ownership foundation is declared');
const renderStart = source.indexOf('const renderAlertCard', foundationStart);
assert(renderStart > foundationStart, 'renderAlertCard remains after LP005 contracts');
const foundationBlock = source.slice(foundationStart, renderStart);
const renderBlock = source.slice(renderStart, source.indexOf('const normalizeAlertPresentationKey', renderStart));

assert(source.includes('const buildGridlyFirstVisibleAlertCardContract'), 'Phase 1 contract builder exists');
assert(source.includes('const buildGridlyCompleteAlertCardContract'), 'Phase 2 contract builder exists');
assert(source.includes('const RenderFirstVisibleAlertCard'), 'Phase 1 renderer owner exists');
assert(source.includes('const RenderCompleteAlertCard'), 'Phase 2 renderer owner exists');

['id', 'title', 'situationLabel', 'locationLine', 'severity', 'freshnessToken', 'coordinates'].forEach((field) => {
  assert(foundationBlock.includes(field), `Phase 1 contract includes ${field}`);
});
['trust:', 'evidence:', 'counts:', 'historicalContext:', 'providerBadges:', 'richLocation:', 'secondaryDetails:'].forEach((field) => {
  assert(foundationBlock.includes(field), `Phase 2 contract includes ${field}`);
});

assert(renderBlock.includes('buildGridlyFirstVisibleAlertCardContract'), 'renderAlertCard creates Phase 1 contract');
assert(renderBlock.includes('buildGridlyCompleteAlertCardContract'), 'renderAlertCard creates Phase 2 contract');
assert(renderBlock.includes('return RenderCompleteAlertCard(phase2Contract);'), 'renderAlertCard delegates complete card rendering to Renderer B');
assert(foundationBlock.includes('data-gridly-alert-row="true"'), 'complete renderer owns existing alert row markup');
assert(foundationBlock.includes('gridly-alert-trust-line'), 'complete renderer preserves trust markup');
assert(foundationBlock.includes('${eventEvidenceHtml}'), 'complete renderer preserves evidence markup insertion point');

assert(!foundationBlock.includes('requestAnimationFrame'), 'LP005.1 does not introduce requestAnimationFrame scheduling');
assert(!foundationBlock.includes('setTimeout'), 'LP005.1 does not introduce setTimeout scheduling');
assert(!foundationBlock.includes('innerHTML'), 'LP005.1 foundation does not add insertion behavior');

console.log('LP005 progressive alerts rendering foundation static checks passed');
