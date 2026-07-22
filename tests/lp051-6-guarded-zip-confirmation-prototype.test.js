const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP051-6-GUARDED-ZIP-CONFIRMATION-UX-PROTOTYPE.md', 'utf8');

assert(app.includes('GRIDLY_LP0516_ZIP_CONFIRMATION_PROTOTYPE_ENABLED = false'), 'prototype feature flag is default-off');
assert(app.includes('window.gridlyOpenLp0516ZipConfirmationPrototype = gridlyOpenLp0516ZipConfirmationPrototype'), 'open helper is exposed');
assert(app.includes('window.gridlyCloseLp0516ZipConfirmationPrototype = gridlyCloseLp0516ZipConfirmationPrototype'), 'close helper is exposed');
assert(app.includes('window.gridlyResetLp0516ZipConfirmationPrototype = gridlyResetLp0516ZipConfirmationPrototype'), 'reset helper is exposed');
assert(app.includes('window.gridlyResolveHomeZipAwareness'), 'prototype reuses the existing resolver contract');
assert(app.includes('function gridlyLp0516FocusZipInput()'), 'prototype has dedicated ZIP focus repair helper');
assert(app.includes('document.activeElement === input'), 'prototype verifies the ZIP input receives active focus');
assert(app.includes('input.disabled = false; input.readOnly = false'), 'prototype keeps ZIP input enabled and writable');
assert(app.includes('inputmode="numeric"'), 'prototype keeps numeric keyboard hint');
assert(app.includes('type="text" inputmode="numeric"'), 'prototype preserves paste and editing behavior with text input plus numeric hint');
assert(!app.includes('saveGridlyHomeTownPreference(gridlyLp0516'), 'prototype is not wired to setup persistence');
assert(!app.includes('safeForProductionActivation: true'), 'prototype cannot claim production activation safety');

assert(app.includes('#gridly-lp0516-zip-input{'), 'prototype has scoped ZIP input styling');
assert(app.includes('color:var(--lp0516-text)'), 'ZIP input has explicit text color');
assert(app.includes('background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035)),var(--lp0516-sheet-strong)'), 'ZIP input has explicit dark/glass background');
assert(app.includes('caret-color:var(--lp0516-focus)'), 'ZIP input has explicit caret color');
assert(app.includes('-webkit-text-fill-color:var(--lp0516-text)'), 'ZIP input has explicit WebKit text fill color');
assert(app.includes('#gridly-lp0516-zip-input::placeholder'), 'ZIP input placeholder has explicit visibility styling');
assert(app.includes('#gridly-lp0516-zip-input:-webkit-autofill'), 'ZIP input autofill remains readable');
assert(app.includes('--lp0516-sheet:var(--card'), 'prototype reuses Gridly card theme token');
assert(app.includes('--lp0516-border:var(--border'), 'prototype reuses Gridly border theme token');
assert(!app.includes('background:#fff;border-radius:28px 28px 0 0'), 'prototype no longer uses a hardcoded bright white sheet');
assert(app.includes('gridly-lp0516-primary') && app.includes('gridly-lp0516-secondary') && app.includes('gridly-lp0516-tertiary'), 'prototype has primary/secondary/tertiary button hierarchy');
assert(app.includes('.gridly-lp0516-option[aria-checked="true"]'), 'candidate selected-state styling is present');
assert(app.includes('.gridly-lp0516-validation'), 'validation styling is present');

const noop = () => {};
const makeNode = () => ({ style: {}, dataset: {}, hidden: true, innerHTML: '', classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop, setAttribute: noop, removeAttribute: noop, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, contains: () => false, getClientRects: () => [], focus: noop, remove: noop });
const nodes = {};
const document = { addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: (id) => nodes[id] || null, createElement: (tag) => makeNode(), head: { appendChild: noop }, documentElement: { scrollWidth: 390, clientWidth: 390, classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, body: { ...makeNode(), appendChild(node) { if (node.id) nodes[node.id] = node; } }, activeElement: null };
const sandbox = { window: { addEventListener: noop, removeEventListener: noop, location: { search: '' } }, document, localStorage: { data: {}, get length() { return Object.keys(this.data).length; }, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } }, sessionStorage: { data: {}, get length() { return Object.keys(this.data).length; }, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } }, navigator: { serviceWorker: null, userAgent: 'node' }, innerWidth: 390, innerHeight: 844, location: { search: '' }, console, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(), crypto: { randomUUID: () => 'test-uuid' }, URLSearchParams, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }), ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} }, fetch: async () => ({ ok: false, json: async () => ({}) }) };
sandbox.window = Object.assign(sandbox.window, sandbox);
vm.runInNewContext(app, sandbox, { timeout: 5000 });

assert.strictEqual(sandbox.window.GRIDLY_ZIP_CONFIRMATION_PROTOTYPE_ENABLED, false, 'browser flag is default-off');
assert.strictEqual(typeof sandbox.window.gridlyOpenLp0516ZipConfirmationPrototype, 'function');
assert.strictEqual(typeof sandbox.window.gridlyLp0516ZipConfirmationPrototypeAudit, 'function');

const audit = sandbox.window.gridlyLp0516ZipConfirmationPrototypeAudit();
assert.strictEqual(audit.milestone, 'LP051.6');
assert.strictEqual(audit.prototypeOnly, true);
assert.strictEqual(audit.enabledByDefault, false);
assert.strictEqual(audit.resolverAvailable, true);
assert.strictEqual(audit.zipInputFocusRepairAvailable, true);
assert.strictEqual(audit.resolvedFlowAvailable, true);
assert.strictEqual(audit.requiresConfirmationFlowAvailable, true);
assert.strictEqual(audit.ambiguousFlowAvailable, true);
assert.strictEqual(audit.poBoxFlowAvailable, true);
assert.strictEqual(audit.uniqueZipFlowAvailable, true);
assert.strictEqual(audit.productionSetupWrites, 0);
assert.strictEqual(audit.productionStorageWrites, 0);
assert.strictEqual(audit.activeAwarenessMutations, 0);
assert.strictEqual(audit.mapFocusMutations, 0);
assert.strictEqual(audit.providerRefreshes, 0);
assert.strictEqual(audit.routeIntelligenceTouched, false);
assert.strictEqual(audit.safeForProductionActivation, false);
assert.strictEqual(audit.prototypeCertificationStatus, 'guarded_test_candidate');
assert.strictEqual(audit.safeForGuardedUserTesting, true);
assert.strictEqual(audit.internalMetadataLeakDetected, false);

assert.strictEqual(audit.themeAlignmentPass, true);
assert.strictEqual(audit.inputTextVisibilityPass, true);
assert.strictEqual(audit.inputCaretVisibilityPass, true);
assert.strictEqual(audit.placeholderVisibilityPass, true);
assert.strictEqual(audit.buttonHierarchyPass, true);
assert.strictEqual(audit.candidateContrastPass, true);
assert.strictEqual(audit.validationContrastPass, true);
assert.strictEqual(audit.visualIntegrationPass, true);
assert.strictEqual(audit.lightSurfaceLeakDetected, false);
assert.strictEqual(audit.unreadableTextDetected, false);

const byZip = Object.fromEntries(audit.testedZipScenarios.map((scenario) => [scenario.zip, scenario]));
assert.strictEqual(byZip['77535'].step, 'resolved');
assert.strictEqual(byZip['77075'].consumerLabel, 'Southeast Houston / Hobby');
assert.strictEqual(byZip['75834'].step, 'requires_confirmation');
assert(byZip['75834'].candidateOptions.length > 1, 'requires-confirmation scenario has choices');
assert.strictEqual(byZip['77084'].step, 'ambiguous', '77084 remains ambiguous');
assert.notStrictEqual(byZip['77084'].step, 'resolved', '77084 has no silent default');
assert.strictEqual(byZip['77201'].step, 'po_box_not_supported');
assert.strictEqual(byZip['77210'].step, 'unique_zip_not_supported');
assert.strictEqual(byZip['abc'].step, 'entry');
assert.strictEqual(byZip['99999'].step, 'unsupported');

const before = JSON.stringify(sandbox.localStorage.data) + JSON.stringify(sandbox.sessionStorage.data);
sandbox.window.gridlyOpenLp0516ZipConfirmationPrototype();
const state = sandbox.window.__gridlyLp0516PrototypeState;
state.zipInput = '77535';
sandbox.window.gridlyLp0516ZipConfirmationPrototypeAudit();
sandbox.window.gridlyCloseLp0516ZipConfirmationPrototype();
const after = JSON.stringify(sandbox.localStorage.data) + JSON.stringify(sandbox.sessionStorage.data);
assert.strictEqual(before, after, 'open/audit/close performs no storage writes');

assert(doc.includes('window.gridlyOpenLp0516ZipConfirmationPrototype?.()'), 'doc includes owner launch command');
assert(doc.includes('safeForProductionActivation remains false'), 'doc blocks production activation');
