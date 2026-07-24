const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const styles = fs.readFileSync('css/styles.css', 'utf8');

assert.match(source, /Local context from cleared community reports helps drivers recognize places that have experienced repeat delays or disruptions in the past\./, 'intro explains cleared-report local context without predictive framing');
assert.match(source, /Historical Intelligence is context only — not a live incident or prediction\./, 'sheet-level explanation distinguishes context from live incidents and predictions');
assert.match(source, /Past cleared reports only\. This is not a live incident or a prediction\./, 'expanded rows include a concise driver-focused context disclaimer');
assert.match(source, /<strong(?: [^>]*)?>Not enough history yet<\/strong>/, 'empty-state heading uses sentence case');
assert.doesNotMatch(source, /Not Enough History Yet/, 'title-case empty-state heading is removed from runtime presentation');
assert.match(source, /More cleared community reports are needed before Gridly identifies a reliable local pattern here\./, 'insufficient-history state explains transparent evidence requirements');
assert.match(source, /More cleared community reports are needed before Gridly identifies reliable local patterns\./, 'empty-history state explains transparent evidence requirements');
assert.match(source, /<span class="gridly-historical-intelligence-pattern"><span>Recurring pattern<\/span>\$\{patternSubtitle\}<\/span>/, 'collapsed rows label the recurring pattern for scanability');
assert.match(source, /<span class="gridly-historical-intelligence-line"><span>Why it matters<\/span>\$\{summary\}<\/span>/, 'collapsed rows label the why-it-matters line for scanability');
assert.match(source, /<span>Most reported<\/span>/, 'timing statistic remains present without changing evidence generation');
assert.match(styles, /\.gridly-historical-intelligence-subtitle[\s\S]*font-size:\s*0\.78rem[\s\S]*line-height:\s*1\.42/, 'intro typography improves readability');
assert.match(styles, /\.gridly-historical-intelligence-pattern span,\n\.gridly-historical-intelligence-line span[\s\S]*text-transform:\s*uppercase/, 'micro-label hierarchy is styled consistently');
assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.gridly-historical-intelligence-summary/, 'mobile portrait historical rows retain responsive spacing controls');

console.log('LP055.1 historical intelligence sheet presentation static coverage passed');
