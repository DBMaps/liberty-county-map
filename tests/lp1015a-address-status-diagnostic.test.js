const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/lp101-search-quality.js', 'utf8');

function harness(options = {}) {
  const tableRows = [];
  const logs = [];
  const results = {
    dataset: { lp101Case: options.containerCase || 'address', lp101RenderPhase: options.phase || 'final', lp101RenderInputCount: String(options.renderInputCount || 0) },
    get textContent() { return (options.statuses || []).filter((entry) => entry.inside !== false).map((entry) => entry.text).join(' '); },
    querySelectorAll(selector) {
      if (selector === '.gridly-search-result-item') return options.cards || [];
      if (selector === '.gridly-search-results-status') return nodes.filter((node) => node.inside);
      return [];
    },
    querySelector() { return null; }
  };
  const nodes = (options.statuses || []).map((entry) => ({
    textContent: entry.text, hidden: Boolean(entry.hidden), inside: entry.inside !== false,
    dataset: entry.caseName ? { lp101Case: entry.caseName } : {},
    getAttribute(name) { return name === 'aria-hidden' && entry.ariaHidden ? 'true' : null; },
    closest(selector) { return selector === '#gridlySearchResults' && this.inside ? results : null; }
  }));
  const evidence = options.evidence === false ? [] : (options.evidence || [{ requestType: 'destination_search', httpStatus: 200, requestSucceeded: true, canonicalSuccess: true, canonicalFailure: false }]);
  const window = {
    document: {
      getElementById: (id) => id === 'gridlySearchResults' && options.container !== false ? results : null,
      querySelectorAll: () => nodes
    },
    console: { table: (rows) => tableRows.push(rows), log: (message) => logs.push(message) },
    gridlyGeocodingClient: { evidence: () => evidence }, setTimeout,
    getComputedStyle: (node) => ({ display: node.hidden ? 'none' : 'block', visibility: 'visible' })
  };
  vm.runInNewContext(source, { window, Object, Set, RegExp, String, Number, Array, Boolean, Date, Promise });
  return { result: window.gridlyLp101AddressStatusDiagnostic(), tableRows, logs };
}

const cases = [
  ['confirmed_no_result', 'We couldn’t confirm that exact address. Try adding the city or ZIP code.'],
  ['confirmed_no_result', 'No matching destinations found.'],
  ['temporarily_unavailable', 'Address search is temporarily unavailable. Try again in a moment.'],
  ['temporarily_paused', 'Search is temporarily paused. Please try again shortly.'],
  ['empty_state', 'No destinations to display.'],
  ['unrecognized', 'Exact address not confirmed. Nearby matches are shown.']
];
for (const [classification, text] of cases) {
  const run = harness({ statuses: [{ text }] });
  assert.equal(run.result.statusClassification, classification);
  assert.equal(run.result.currentCaseIdentityAgreement, true);
  assert.equal(run.result.settledFinalRenderObserved, true);
}

let run = harness({ statuses: [{ text: 'No matching destination found.', hidden: true }] });
assert.equal(run.result.statusClassification, 'hidden');
assert.equal(run.result.hiddenStatusNodeCount, 1);

run = harness({ statuses: [{ text: 'No matching destination found.', inside: false }] });
assert.equal(run.result.statusClassification, 'outside_active_container');
assert.equal(run.result.statusInsideActiveContainer, false);

run = harness({ statuses: [{ text: 'No matching destination found.', caseName: 'business' }] });
assert.equal(run.result.statusClassification, 'stale');
assert.equal(run.result.staleStatusNodeCount, 1);
assert.equal(run.result.currentCaseIdentityAgreement, false);

run = harness();
assert.equal(run.result.statusClassification, 'absent');
assert.equal(run.result.statusNodeCount, 0);

run = harness({ statuses: [
  { text: 'No matching destination found.' },
  { text: 'We could not confirm the destination.' }
] });
assert.equal(run.result.statusClassification, 'confirmed_no_result');
assert.equal(run.result.statusNodeCount, 2);
assert.equal(run.result.visibleStatusNodeCount, 2);

run = harness({ statuses: [{ text: 'No matching destination found.' }], phase: 'searching' });
assert.equal(run.result.settledFinalRenderObserved, false);

run = harness({
  statuses: [{ text: 'Private status for 274 County Road 677' }],
  evidence: [{ requestType: 'destination_search', httpStatus: 200, requestSucceeded: true, canonicalSuccess: true, providerPayload: { private: true }, provider: 'private-provider' }]
});
const serialized = JSON.stringify(run.result);
assert.doesNotMatch(serialized, /Private status|274 County Road|private-provider|providerStatus|providerPayload|payload/i);
assert.deepEqual(Object.keys(run.tableRows[0][0]), [
  'statusClassification', 'statusNodeCount', 'visibleStatusNodeCount', 'statusInsideActiveContainer',
  'currentCaseIdentityAgreement', 'settledFinalRenderObserved', 'finalRenderInputCount',
  'activeVisibleResultCount', 'canonicalResponseObserved', 'noResultMessageObserved'
]);
assert.equal(run.logs.at(-1), 'LP101.5A ADDRESS STATUS DIAGNOSTIC COMPLETE');
assert.equal('statusText' in run.result, false);
assert.equal('providerPayload' in run.result, false);

console.log('LP101.5A address status diagnostic contracts passed.');
