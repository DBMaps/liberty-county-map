const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

assert(app.includes('function gridlyAwarenessSourceLabel'), 'shared awareness source label helper exists for presentation-only source context');
assert(app.includes('Official Source · DriveTexas'), 'official authority attribution remains visible');
assert(app.includes('Community reports from nearby drivers'), 'community source context remains community-driven');
assert(app.includes('Official advisory · Official Source · DriveTexas'), 'official popups use consumer advisory language with preserved authority');
assert(app.includes('Community report · Driver shared ·'), 'community popups use complementary source/freshness language');
assert(app.includes('What drivers should know · ${category}'), 'official consumer popup frames category as practical driver guidance');
assert(app.includes('No official roadway advisories nearby.'), 'official quiet state matches nearby-awareness framing');
assert(app.includes('className = "gridly-travel-brief-source"'), 'Travel Brief renders source context in each awareness section');
assert(css.includes('gridly-travel-brief-source'), 'Travel Brief source context has scoped presentation styling');
assert(!/LP039 authority ownership|Shared Geometry Authority|DriveTexas ingestion|Community reporting/.test(app.slice(app.indexOf('function gridlyAwarenessSourceLabel'), app.indexOf('function gridlyTravelBriefWeatherLines'))), 'LP048 presentation helper does not modify protected architecture owners');

console.log('LP048 unified official + community experience checks passed');
