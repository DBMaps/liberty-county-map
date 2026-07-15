const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

const foundationStart = source.indexOf('const GRIDLY_LP005_ALERTS_RENDERING_FOUNDATION');
const renderStart = source.indexOf('const renderAlertCard', foundationStart);
const groupingStart = source.indexOf('const normalizeAlertPresentationKey', renderStart);
const renderBlock = source.slice(renderStart, groupingStart);
const openStart = source.indexOf('function openAlertsSurfaceFromDock()');
const openEnd = source.indexOf('\n\nfunction invokeMobileAlertsEntry', openStart);
const openBlock = source.slice(openStart, openEnd);

assert(foundationStart > -1, 'LP005 renderer foundation exists');
assert(renderBlock.includes('options.firstVisible === true'), 'renderAlertCard has an explicit first-visible path');
assert(renderBlock.includes('RenderFirstVisibleAlertCard({ ...phase1Contract, phase2Contract })'), 'first-visible path reuses the Phase 1 contract and complete Phase 2 data');
assert(renderBlock.includes('return RenderCompleteAlertCard(phase2Contract);'), 'default card path remains the complete authoritative renderer');
assert(openBlock.includes('const firstVisibleAlert = presentationAlerts[0] || null;'), 'first visible card uses only the first presentation alert');
assert(openBlock.includes('renderAlertCard(firstVisibleAlert, 0, false, { firstVisible: true })'), 'Phase 1 renderer produces exactly one visible complete card');
assert(openBlock.includes('data-gridly-alerts-phase="first-visible-card"'), 'first insertion is marked as first-visible only');
assert(openBlock.includes('first visible card insertion'), 'first card is inserted before the complete sheet is assembled');
assert(openBlock.indexOf('first visible card insertion') < openBlock.indexOf('hidden-row generation'), 'first card insertion happens before hidden rows are generated');
assert(openBlock.indexOf('first visible card insertion') < openBlock.indexOf('outer sheet/header markup'), 'first card insertion happens before heading/count markup');
assert(openBlock.indexOf('const firstVisibleAlert = presentationAlerts[0] || null;') < openBlock.indexOf('presentationAlerts.forEach((alert) => {'), 'first visible card is rendered before remaining-card trust precomputation');
assert(!source.includes('global memoization'), 'no global memoization wording introduced');

console.log('LP005.2 first visible alert card rendering static checks passed');
