const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
assert(app.includes('function gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom'), 'LP046.2 final visible DOM sanitizer exists');
assert(app.includes('"final visible official card DOM sanitation", () => gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom(body)'), 'LP046.2 sanitizer runs after Alerts HTML insertion and before reveal style/class writes');
assert(app.indexOf('body.innerHTML = templateHtml || ""') < app.indexOf('gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom(body)'), 'sanitizer runs after body HTML insertion');
assert(app.indexOf('gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom(body)') < app.indexOf('const applyInitialStyles = () => { body.hidden = false'), 'sanitizer runs before sheet body reveal');

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

class FakeElement {
  constructor(attrs = {}, text = '') {
    this.attrs = attrs;
    this.dataset = {};
    this.innerHTML = text;
    this.textContent = decodeEntities(text.replace(/<br\s*\/?\s*>/gi, ''));
    this.children = [];
  }
  getAttribute(name) { return this.attrs[name] || ''; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    if (selector.includes('gridly-alert-row')) return this.children;
    if (selector.includes('gridly-alert-location-line')) return this.children.filter((child) => /gridly-alert-location-line/.test(child.attrs.class || '') || child.attrs['data-gridly-alert-location-line'] === 'true');
    if (selector.includes('gridly-alert-situation-summary')) return this.children.filter((child) => /gridly-alert-situation-summary/.test(child.attrs.class || '') || child.attrs['data-gridly-alert-situation-summary'] === 'true');
    return [];
  }
}

function card(id, title, location, summary, official = false) {
  const row = new FakeElement({ 'data-gridly-alert-row': 'true', 'data-gridly-alert-id': id, 'data-gridly-alert-title': title });
  const loc = new FakeElement({ class: 'gridly-alert-location-line', 'data-gridly-alert-location-line': 'true' }, location);
  const sum = new FakeElement({ class: 'gridly-alert-situation-summary', 'data-gridly-alert-situation-summary': 'true' }, summary);
  row.children = [loc, sum];
  row.textContent = `${title} ${loc.textContent} ${sum.textContent} ${official ? 'Official Roadways DriveTexas' : 'Community reports'}`;
  return { row, loc, sum };
}

const construction = card(
  'official-construction',
  'Construction',
  'US 59, MAIN LANES not affected.<br/><br/>Construction of safety improvement projects consisting of installing cable median barrier.',
  'Construction affecting travel on US 59, - MAIN LANES not affected.&lt;br/&gt;&lt;br/&gt;Construction of safety improvement projects consisting of installing cable median barrier..',
  true
);
const roadClosed = card(
  'official-road-closed',
  'Road Closed',
  'US 59, Alternating lanes closed.&lt;br&gt; Motorists should expect delays.<br />FOR THE CONSTRUCTION of safety improvement projects consisting of installing cable median barrier.',
  'Road Closed / US 59, - Alternating lanes closed.<BR/> Motorists should expect delays.<br/><br/>FOR THE CONSTRUCTION of safety improvement projects consisting of installing cable median barrier..',
  true
);
const flooding = card('community-flooding', 'Flooding', 'Community reported / keep this separator', 'Community Flooding summary with &lt;br/&gt; intentionally unchanged.', false);
const train = card('community-train', 'Train Blocking Crossing', 'Community train / keep this separator', 'Train Blocking Crossing summary with &lt;br/&gt; intentionally unchanged.', false);
const root = new FakeElement();
root.children = [construction.row, roadClosed.row, flooding.row, train.row];

const source = [
  app.slice(app.indexOf('function gridlyOfficialConsumerSentenceCase'), app.indexOf('const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES')),
  app.match(/function gridlyLp0456OfficialSourceDetection[\s\S]*?\n}\n\nfunction gridlyLp0456IsOfficialDriveTexasRecord/)[0].replace('\nfunction gridlyLp0456IsOfficialDriveTexasRecord', ''),
  app.match(/function gridlyLp0462DecodeVisibleAlertElementProse[\s\S]*?if \(typeof window !== "undefined"\) window\.gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom = gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom;/)[0]
].join('\n');
const context = { console, String, RegExp, Array, Boolean, document: { createElement: () => ({ innerHTML: '', get value() { return decodeEntities(this.innerHTML); } }) }, cleanDisplayValue: (value) => String(value ?? '').replace(/\s+/g, ' ').trim(), window: {} };
vm.createContext(context);
vm.runInContext(source, context);
context.gridlyLp0462SanitizeVisibleOfficialAlertsSheetDom(root, [
  { id: 'official-construction', source: 'DriveTexas', routeName: 'US 59' },
  { id: 'official-road-closed', provider: 'DriveTexas', routeName: 'US 59' },
  { id: 'community-flooding', source: 'community' },
  { id: 'community-train', source: 'community' }
]);

assert.strictEqual(construction.loc.textContent, 'US 59 main lanes remain open. Crews are installing a cable median barrier.');
assert.strictEqual(roadClosed.loc.textContent, 'Alternating lane closures on US 59. Expect delays. Crews are installing a cable median barrier.');
assert(!/<\s*br\s*\/?\s*>|&lt;\s*br\s*\/?\s*&gt;/i.test(`${construction.loc.textContent} ${construction.sum.textContent} ${roadClosed.loc.textContent} ${roadClosed.sum.textContent}`), 'official cards contain no break-tag text');
assert.strictEqual(flooding.loc.textContent, 'Community reported / keep this separator');
assert.strictEqual(flooding.sum.textContent, 'Community Flooding summary with <br/> intentionally unchanged.');
assert.strictEqual(train.loc.textContent, 'Community train / keep this separator');
assert.strictEqual(train.sum.textContent, 'Train Blocking Crossing summary with <br/> intentionally unchanged.');
console.log('LP046.2 visible Alerts sheet final DOM sanitization checks passed');
