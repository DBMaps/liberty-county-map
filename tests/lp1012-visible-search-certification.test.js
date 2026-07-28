const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/lp101-search-quality.js', 'utf8');

function harness(options = {}) {
  const evidence = [];
  const order = [];
  let cards = [];
  let status = '';
  let previewReady = false;
  const input = { value: '', dispatchEvent() {} };
  const shell = { hidden: true };
  const command = { textContent: 'Choose where you are going' };
  const results = {
    get textContent() { return [status, ...cards.map((card) => card.textContent)].join(' '); },
    querySelectorAll(selector) { return selector === '.gridly-search-result-item' ? cards : []; },
    querySelector(selector) { return selector === '.gridly-search-results-status' && status ? { textContent: status } : null; }
  };
  const card = (text) => ({ textContent: text, hidden: false, getAttribute: () => null, click() {
    window.GridlySearchState.selectedDestination = { selected: true };
    command.textContent = `Route preview for ${text}`;
    previewReady = true;
  } });
  const action = { click() {
    const query = input.value;
    order.push(query === '274 County Road 677, Dayton, TX 77535' ? 'address'
      : query === 'Dayton Walmart' ? 'business' : query === 'Hospital' ? 'category' : 'governed_destination');
    status = 'Checking nearby places…'; cards = [];
    if (options.neverSettles) return;
    setTimeout(() => {
      const statusCode = options.httpFailure || 200;
      evidence.push({ requestType: 'destination_search', httpStatus: statusCode,
        requestSucceeded: statusCode === 200, canonicalSuccess: statusCode === 200,
        canonicalFailure: false, providerBoundaryUsed: statusCode === 200,
        directProviderRequestDetected: Boolean(options.directProvider) });
      status = '';
      if (order.at(-1) === 'address') {
        if (options.misleadingRoad) cards = [card('County Road 615 Best Match')];
        else status = 'We couldn’t confirm that exact address. Try adding the city or ZIP code.';
      } else if (order.at(-1) === 'business') cards = [card('Walmart Supercenter Dayton, Liberty County retail')];
      else if (order.at(-1) === 'category') cards = [card('Liberty Dayton Regional Hospital medical')];
      else cards = [card('Liberty County Courthouse Liberty government')];
    }, 2);
  } };
  const clear = { click() { input.value = ''; cards = []; status = ''; } };
  const elements = { gridlySearchShell: shell, gridlyAddressSearchInput: input, gridlyRemoteSearchBtn: action,
    gridlySearchResults: results, gridlySearchClearBtn: clear, mobileDestinationCommandMeta: command };
  if (options.missingUi) delete elements.gridlyAddressSearchInput;
  const window = {
    Event: function Event() {}, setTimeout, console: { log() {}, table() {} },
    document: { getElementById: (id) => elements[id] || null },
    GridlySearchState: {}, openGridlyDestinationSearchSurface() { shell.hidden = false; },
    gridlyDestinationPerformanceAudit: () => ({ routePreviewStatus: previewReady ? 'ready' : 'idle' }),
    gridlyGeocodingClient: { endpoint: 'https://gridly.test/functions/v1/gridly-geocode', functionSlug: 'gridly-geocode',
      evidence: () => evidence.slice(), directProviderRequestCount: () => options.directProvider ? 1 : 0 }
  };
  vm.runInNewContext(source, { window, Object, Set, RegExp, String, Number, Array, Boolean, Date, Promise });
  return { window, order, evidence };
}

(async () => {
  let run = harness();
  let result = await run.window.gridlyLp101VisibleSearchCertification({ timeoutMs: 100, routeTimeoutMs: 100 });
  assert.deepEqual(run.order, ['address', 'business', 'category', 'governed_destination'], 'visible searches run sequentially');
  assert.equal(result.safeToMerge, true, 'truthful safeToMerge passes only the complete contract');
  assert.equal(result.cases[0].passed, true, 'canonical no-result is accepted');
  assert.equal(result.cases[1].relevantResultObserved, true, 'business relevance is visible');
  assert.equal(result.cases[2].relevantResultObserved, true, 'medical category relevance is visible');
  assert.equal(result.cases[3].governedPrecedencePreserved, true, 'governed destination has precedence');
  assert.equal(result.routePreviewVerified, true, 'a real result-selection click verifies preview state');
  assert.doesNotMatch(JSON.stringify(result), /274 County Road|Dayton Walmart|Hospital|Liberty Courthouse/, 'result is privacy safe');
  assert.ok(run.evidence.every((entry) => !Object.hasOwn(entry, 'query')));

  run = harness({ misleadingRoad: true });
  result = await run.window.gridlyLp101VisibleSearchCertification({ timeoutMs: 100, routeTimeoutMs: 100 });
  assert.equal(result.safeToMerge, false);
  assert.equal(result.cases[0].misleadingRoadFallbackAbsent, false, 'misleading roadway fallback is rejected');

  run = harness({ missingUi: true });
  result = await run.window.gridlyLp101VisibleSearchCertification({ timeoutMs: 100 });
  assert.equal(result.safeToMerge, false, 'missing UI controls fail closed');
  assert.ok(result.failedChecks.includes('searchInputAvailable'));

  run = harness({ neverSettles: true });
  result = await run.window.gridlyLp101VisibleSearchCertification({ timeoutMs: 100 });
  assert.equal(result.safeToMerge, false, 'settled-state timeout fails closed');
  assert.ok(result.failedChecks.some((check) => check.includes('resultStateSettled')));

  for (const scenario of [{ httpFailure: 503 }, { directProvider: true }]) {
    run = harness(scenario);
    result = await run.window.gridlyLp101VisibleSearchCertification({ timeoutMs: 100, routeTimeoutMs: 100 });
    assert.equal(result.safeToMerge, false, 'HTTP failures and direct-provider evidence fail closed');
  }
  console.log('LP101.2 automated visible search certification contracts passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
