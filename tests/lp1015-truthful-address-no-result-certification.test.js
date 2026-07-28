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
    dataset: {},
    get textContent() { return [status, ...cards.map((card) => card.textContent)].join(' '); },
    querySelectorAll(selector) {
      if (selector === '.gridly-search-result-item') return cards;
      if (selector === '.gridly-search-results-status' && status) return [{ textContent: status, hidden: false, getAttribute: () => null, closest: () => results }];
      return [];
    },
    querySelector(selector) { return selector === '.gridly-search-results-status' && status ? { textContent: status } : null; }
  };
  const card = (text) => ({ textContent: text, hidden: false, dataset: { lp101Case: order.at(-1) }, closest: () => results, getAttribute: () => null, click() {
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
        requestSucceeded: statusCode === 200, canonicalSuccess: statusCode === 200 && !options.noCanonical,
        canonicalFailure: false, providerBoundaryUsed: statusCode === 200,
        directProviderRequestDetected: Boolean(options.directProvider) });
      status = '';
      if (order.at(-1) === 'address') {
        if (options.misleadingRoad) cards = [card('County Road 615 Best Match')];
        else if (options.addressResult) cards = [card('274 County Road 677 Dayton address')];
        else if (options.staleNodes) { cards = [card('Walmart prior case')]; cards[0].dataset.lp101Case = 'business'; }
        else if (!options.missingNoResultMessage) status = 'We couldn’t confirm that exact address. Try adding the city or ZIP code.';
      } else if (order.at(-1) === 'business') cards = [card('Walmart Supercenter Dayton, Liberty County retail')];
      else if (order.at(-1) === 'category') cards = [card('Liberty Dayton Regional Hospital medical')];
      else cards = [card('Liberty County Courthouse Liberty government')];
      results.dataset.lp101Case = options.pipelineDisagreement && order.at(-1) === 'address' ? 'business' : order.at(-1);
      results.dataset.lp101RenderPhase = 'final';
      results.dataset.lp101RenderInputCount = String(options.domDisagreement && order.at(-1) === 'address' ? cards.length + 1 : cards.length);
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
  async function certify(options = {}) {
    const run = harness(options);
    return { run, result: await run.window.gridlyLp101VisibleSearchCertification({ timeoutMs: 100, routeTimeoutMs: 100 }) };
  }

  let certification = await certify({ addressResult: true });
  assert.equal(certification.result.cases[0].passed, true, 'relevant address result passes');
  assert.equal(certification.result.cases[0].addressOutcome, 'relevant_result');

  certification = await certify();
  const address = certification.result.cases[0];
  assert.equal(address.passed, true, 'canonical zero-card no-result passes');
  assert.equal(address.truthfulNoResultObserved, true);
  assert.equal(address.noResultMessageObserved, true);
  assert.equal(address.canonicalNoResultAccepted, true);
  assert.equal(address.addressOutcome, 'truthful_no_result');
  assert.equal(address.visibleResultCount, 0);
  assert.equal(address.statusClassification, 'confirmed_no_result');
  assert.equal(address.statusNodeCount, 1);
  assert.equal(address.visibleStatusNodeCount, 1);
  assert.equal(address.hiddenStatusNodeCount, 0);
  assert.equal(address.staleStatusNodeCount, 0);
  assert.equal(address.statusInsideActiveContainer, true);
  assert.equal(address.settledFinalRenderObserved, true);
  assert.equal(address.currentCaseIdentityAgreement, true);
  assert.equal(address.diagnosticValid, true);
  assert.equal(address.capturePhase, 'active_address_final_render');
  assert.equal(address.capturedBeforeCaseReset, true);
  assert.equal(certification.result.safeToMerge, true, 'truthful complete aggregation is safe to merge');
  assert.equal(certification.result.milestone, 'LP101.6');
  assert.equal(certification.result.cases[1].passed, true, 'business remains passing');
  assert.equal(certification.result.cases[2].passed, true, 'category remains passing');
  assert.equal(certification.result.cases[3].passed, true, 'governed destination remains passing');
  assert.equal(certification.result.routePreviewVerified, true, 'Route Preview remains passing');
  assert.ok(certification.run.evidence.every((entry) => entry.providerBoundaryUsed), 'provider boundary remains unchanged');
  assert.ok(certification.run.evidence.every((entry) => !entry.directProviderRequestDetected), 'no direct upstream browser call');
  assert.doesNotMatch(JSON.stringify(certification.result), /274 County Road|Dayton Walmart|Hospital|Liberty Courthouse/, 'certification remains privacy safe');
  const capturedDiagnostic = certification.run.window.gridlyLp101AddressStatusDiagnostic();
  assert.equal(capturedDiagnostic.capturePhase, 'fresh_session_capture');
  assert.equal(capturedDiagnostic.statusClassification, 'confirmed_no_result', 'business transition does not overwrite address evidence');
  assert.equal(capturedDiagnostic.diagnosticValid, true, 'fresh certification capture remains valid after reset');

  for (const [options, reason] of [
    [{ missingNoResultMessage: true }, 'visible settled no-result message is required'],
    [{ noCanonical: true }, 'canonical evidence is required'],
    [{ httpFailure: 503 }, 'HTTP failure fails closed'],
    [{ staleNodes: true }, 'stale prior-case nodes fail'],
    [{ misleadingRoad: true }, 'unrelated roadway fallback fails'],
    [{ pipelineDisagreement: true }, 'pipeline identity disagreement fails'],
    [{ domDisagreement: true }, 'DOM count disagreement fails'],
    [{ directProvider: true }, 'direct upstream evidence fails']
  ]) {
    certification = await certify(options);
    assert.equal(certification.result.cases[0].passed, false, reason);
    assert.equal(certification.result.safeToMerge, false, `${reason}: unsafe aggregation`);
  }

  console.log('LP101.5 truthful address no-result certification contracts passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
