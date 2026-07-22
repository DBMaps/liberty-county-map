const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP051-2-AUTHORITATIVE-ZIP-CROSSWALK-AND-SPLIT-ZIP-GOVERNANCE.md', 'utf8');

assert(app.includes('window.gridlyLp0512ZipCrosswalkGovernanceAudit = gridlyBuildLp0512ZipCrosswalkGovernanceAudit'), 'LP051.2 audit helper is exposed');
assert(app.includes('po_box_not_supported'), 'PO Box-only policy is explicit');
assert(app.includes('unique_zip_not_supported'), 'unique ZIP policy is explicit');
assert(!app.includes('saveGridlyHomeTownPreference(gridlyResolveHomeZipAwareness'), 'ZIP resolver is not wired into manual setup persistence');
assert(doc.includes('No complete USPS/HUD/Census ZIP crosswalk source was present locally'), 'source limitation is documented');
assert(doc.includes('77084 remains explicitly ambiguous'), '77084 decision is documented');

const noop = () => {};
const node = { style: {}, dataset: {}, hidden: true, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop, setAttribute: noop, removeAttribute: noop, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, contains: () => false, getClientRects: () => [] };
const document = { addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => node, createElement: () => ({ ...node }), head: { appendChild: noop }, documentElement: { scrollWidth: 390, clientWidth: 390, classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, body: { ...node, classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, activeElement: null };
const sandbox = { window: { addEventListener: noop, removeEventListener: noop, location: { search: '' } }, document, localStorage: { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } }, sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, navigator: { serviceWorker: null, userAgent: "node" }, innerWidth: 390, innerHeight: 844, location: { search: '' }, console, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(), crypto: { randomUUID: () => 'test-uuid' }, URLSearchParams, getComputedStyle: () => ({ display: "block", visibility: "visible" }), ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} }, fetch: async () => ({ ok: false, json: async () => ({}) }) };
sandbox.window = Object.assign(sandbox.window, sandbox);
vm.runInNewContext(app, sandbox, { timeout: 5000 });

const audit = sandbox.window.gridlyLp0512ZipCrosswalkGovernanceAudit();
assert.strictEqual(audit.milestone, 'LP051.2');
assert.strictEqual(audit.supportedCountyCount, 28, 'all 28 supported counties are inventoried');
assert.strictEqual(audit.coveredCountyCount, 28, 'all 28 supported counties remain represented');
assert.strictEqual(audit.unknownCountyIdCount, 0, 'no unknown counties');
assert.strictEqual(audit.unknownAwarenessAreaCount, 0, 'no unknown awareness areas');
assert.strictEqual(audit.invalidRecordCount, 0, 'no invalid records');
assert.strictEqual(audit.duplicateZipCount, 0, 'duplicate ZIP ownership is blocked');
assert.strictEqual(audit.mergeReadyForUiIntegration, false, 'LP051.2 does not enable visible UI integration');
assert.notStrictEqual(audit.coverageCertificationStatus, 'ui_candidate', 'readiness cannot be claimed while unclassified gaps remain');
assert(audit.uncoveredEligibleCommunityCount > 0, 'remaining eligible gaps are classified honestly');

const ambiguous = sandbox.window.gridlyResolveHomeZipAwareness('77084');
assert.strictEqual(ambiguous.status, 'ambiguous');
assert.strictEqual(ambiguous.resolved, false);
assert.strictEqual(ambiguous.presentationChanged, false);
assert.strictEqual(ambiguous.routeIntelligenceTouched, false);

assert.strictEqual(sandbox.window.gridlyResolveHomeZipAwareness('abc').status, 'invalid');
assert.strictEqual(sandbox.window.gridlyResolveHomeZipAwareness('99999').status, 'unsupported');
assert.strictEqual(sandbox.window.gridlyResolveHomeZipAwareness('77201').status, 'po_box_not_supported');
assert.strictEqual(sandbox.window.gridlyResolveHomeZipAwareness('77210').status, 'unique_zip_not_supported');

const beforeStorage = JSON.stringify(sandbox.localStorage.data);
sandbox.window.gridlyResolveHomeZipAwareness('77535');
assert.strictEqual(JSON.stringify(sandbox.localStorage.data), beforeStorage, 'resolver performs no storage writes');
