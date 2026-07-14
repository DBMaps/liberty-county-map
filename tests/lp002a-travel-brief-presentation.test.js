const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

assert.match(html, /data-gridly-travel-brief/, 'Travel Brief replaces expanded Know Before You Go presentation');
assert.match(html, /data-gridly-travel-brief-list/, 'Travel Brief has a runtime-rendered list');
assert.match(html, /TRAVEL BRIEF/, 'Travel Brief heading is present');
assert.doesNotMatch(html, /data-gridly-evidence-experience/, 'Old nested evidence details are removed from the expanded presentation');

assert.match(app, /function gridlyBuildTravelBriefModel/, 'Travel Brief model builder exists');
assert.match(app, /title: "Community"/, 'Travel Brief includes Community section');
assert.match(app, /title: "DriveTexas"/, 'Travel Brief includes DriveTexas section');
assert.match(app, /title: "Weather"/, 'Travel Brief includes Weather section');
assert.match(app, /gridlyStoryActiveRecords\(\)/, 'Travel Brief reuses active community records');
assert.match(app, /gridlyStoryTransportationConnectorRecords\(\)/, 'Travel Brief reuses existing DriveTexas connector records');
assert.match(app, /gridlyBriefInteractionWeatherModel\(\)/, 'Travel Brief reuses existing weather model');
assert.match(app, /No active community reports\./, 'Community empty state is consumer friendly');
assert.match(app, /No official roadway advisories\./, 'DriveTexas empty state is consumer friendly');
assert.match(app, /No travel-impacting weather\./, 'Weather empty state is travel-impact only');
assert.match(app, /gridlyRenderTravelBrief\(model\.story\)/, 'Existing expand render path renders the Travel Brief');

assert.match(css, /LP002A — Travel Brief presentation refresh/, 'Travel Brief presentation styles are scoped and documented');

console.log('LP002A Travel Brief presentation audit passed');
