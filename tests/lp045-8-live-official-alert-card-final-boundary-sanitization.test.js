const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('function gridlyLp0458SanitizeOfficialAlertCardMarkup'), 'final-boundary official alert card sanitizer exists');
assert(app.includes('gridlyLp0458SanitizeOfficialAlertCardMarkup(cacheRead.cache.renderedMarkup)'), 'cached Alerts HTML is sanitized before openGridlyPortraitV2Sheet insertion');
assert(app.includes('html: gridlyLp0458SanitizeOfficialAlertCardMarkup(html)'), 'authoritative live Alerts HTML is sanitized at final insertion boundary');
assert(app.includes('gridlyLp0455OfficialFreshnessResult(alert).renderedFreshnessLine'), 'official freshness behavior is preserved');
assert(app.includes('gridlyLp0393ConsumerDriveTexasPopupHtml'), 'official popup path remains present');
assert(app.includes('gridlyLp045EnsureOfficialMarkersCurrent'), 'official marker rendering path remains present');
assert(app.includes('focusPulseApplied'), 'official marker pulse behavior remains present');
assert(app.includes('gridlyEvaluateDriveTexasGeographicOwnership'), 'LP039 authority remains present');
assert(app.includes('Travel Brief'), 'Travel Brief remains present');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const cleanDisplayValue = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const sanitizerSource = app.match(/function gridlySanitizeOfficialConsumerProse[\s\S]*?\n}\n/)[0];
const normalizeSource = app.match(/function gridlyLp0457NormalizeOfficialSummaryProse[\s\S]*?\n}\n/)[0];
const finalBoundarySource = app.match(/function gridlyLp0458SanitizeOfficialAlertCardMarkup[\s\S]*?\n}\n/)[0];
const context = { String, RegExp, esc, cleanDisplayValue };
vm.createContext(context);
vm.runInContext(`${sanitizerSource}\n${normalizeSource}\n${finalBoundarySource}`, context);

const constructionCard = `
<div class="gridly-alert-row gridly-alert-intel-card" data-gridly-alert-row="true" data-gridly-alert-id="official-construction">
  <div>
    <div class="gridly-alert-location-line" data-gridly-alert-location-line="true">US 59, MAIN LANES not affected.&lt;br/&gt;&lt;br/&gt;&lt;br/&gt;Construction of safety improvement projects consisting of installing cable median barrier.</div>
    <div class="gridly-alert-situation-summary" data-gridly-alert-situation-summary="true">Construction affecting travel on US 59, - MAIN LANES not affected.<br/><br/>Construction of safety improvement projects consisting of installing cable median barrier..</div>
    <div class="gridly-alert-evidence-line"><strong>Official Roadways</strong> DriveTexas</div>
    <div class="gridly-alert-trust-line">Official Source · DriveTexas</div>
  </div>
</div>`;

const roadClosedCard = `
<div class="gridly-alert-row gridly-alert-intel-card" data-gridly-alert-row="true" data-gridly-alert-id="official-road-closed">
  <div>
    <div class="gridly-alert-location-line" data-gridly-alert-location-line="true">US 59, Alternating lanes closed.&amp;lt;br&amp;gt; Motorists should expect delays.&lt;br /&gt;&lt;br&gt;FOR THE CONSTRUCTION of safety improvement projects consisting of installing cable median barrier.</div>
    <div class="gridly-alert-situation-summary" data-gridly-alert-situation-summary="true">Road Closed / US 59, - Alternating lanes closed.<BR/> Motorists should expect delays.<br/><br/>FOR THE CONSTRUCTION of safety improvement projects consisting of installing cable median barrier..</div>
    <div class="gridly-alert-evidence-line"><strong>Official Roadways</strong> DriveTexas</div>
  </div>
</div>`;

const communityCard = `
<div class="gridly-alert-row gridly-alert-intel-card" data-gridly-alert-row="true" data-gridly-alert-id="community-1">
  <div>
    <div class="gridly-alert-location-line" data-gridly-alert-location-line="true">Community reported / keep this separator</div>
    <div class="gridly-alert-situation-summary" data-gridly-alert-situation-summary="true">Community summary with &lt;br/&gt; intentionally unchanged.</div>
    <div class="gridly-alert-trust-line">2 community reports</div>
  </div>
</div>`;

const visibleHtml = context.gridlyLp0458SanitizeOfficialAlertCardMarkup(`${constructionCard}${roadClosedCard}${communityCard}`);

assert(visibleHtml.includes('US 59 main lanes not affected. Construction of safety improvement projects consisting of installing cable median barrier.'), 'live-shaped Construction location line is cleaned');
assert(visibleHtml.includes('US 59 alternating lanes closed. Motorists should expect delays. For the construction of safety improvement projects consisting of installing cable median barrier.'), 'live-shaped Road Closed location line is cleaned');
assert(!/<\s*br\s*\/?\s*>/i.test(visibleHtml), 'visible Alerts HTML contains no raw break tags for official cards');
assert(!/&(?:amp;)?lt;\s*br\s*\/?\s*&(?:amp;)?gt;/i.test(visibleHtml.replace(communityCard, '')), 'official visible Alerts HTML contains no escaped break tags');
assert(!/,\s*-/.test(visibleHtml), 'comma-hyphen artifacts are removed');
assert(!/\.\s*\./.test(visibleHtml), 'double periods are removed');
assert(visibleHtml.includes('Community reported / keep this separator'), 'community location text remains unchanged');
assert(visibleHtml.includes('Community summary with &lt;br/&gt; intentionally unchanged.'), 'community summary HTML remains unchanged');

console.log('LP045.8 live official alert card final-boundary sanitization checks passed');
