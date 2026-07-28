'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'docs/LP096-DESTINATION-ADDRESS-SEARCH-CAPABILITY-AUDIT.md'), 'utf8');

const helperStart = app.indexOf('window.gridlyDestinationAddressSearchAudit = function');
const helperEnd = app.indexOf('\n};', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'LP096 passive helper must exist');
const helper = app.slice(helperStart, helperEnd + 3);
for (const field of [
  'milestone', 'passive', 'productionBehaviorChanged', 'externalGeocoderAvailable',
  'fullStreetAddressSearchSupported', 'ruralCountyRoadSearchSupported',
  'selectedResultCanBecomeDestination', 'launchRisk', 'recommendedNextAction',
  'protectedSystemsUnchanged', 'safeToProceed'
]) assert(helper.includes(field), `helper must expose ${field}`);
assert(!/\bfetch\s*\(/.test(helper), 'passive helper must not issue fetch requests');
assert(!/localStorage|sessionStorage|indexedDB/.test(helper), 'passive helper must not persist private query data');
assert(helper.includes('queryLooksLikeAddress && Boolean(exactAddressResult)'), 'integration presence alone must not claim address support');

assert(app.includes('setTimeout(() => {') && app.includes('}, 350);'), 'live input search must retain 350ms debounce');
assert(app.includes('if (query.length < 3)'), 'minimum query length guard must remain explicit');
assert(app.includes('https://nominatim.openstreetmap.org/search?'), 'Nominatim search integration must be inventoried');
assert(app.includes('countrycodes: countryCodes'), 'US country constraint must remain evidenced');
assert(app.includes('GRIDLY_DESTINATION_PROVIDER_MIN_REQUEST_INTERVAL_MS = 1250'), 'request throttle must remain evidenced');
assert(app.includes('buildGridlyDestinationRoutePreview({ reason:'), 'selection must retain route-preview handoff');
assert(!/id="gridlySearchSubmit|id="gridlySearchButton/.test(html), 'destination shell must not be documented as having a Search button');

for (const heading of [
  'Executive Summary', 'Current Destination Search Architecture', 'Current Provider Inventory',
  'Address Search Capability', 'Example Query Trace', 'Seeded and Roadway Result Ranking',
  'External Provider Behavior', 'Address Normalization Findings', 'Rendering Findings',
  'Route Handoff Findings', 'Consumer Impact', 'Root Cause', 'Launch Risk Classification',
  'Recommended Next Milestone', 'Protected Systems Confirmation', 'Files Inspected', 'Tests Performed'
]) assert(doc.includes(heading), `audit document must contain ${heading}`);
for (const protectedSystem of [
  'Shared Reports', 'Route Watch', 'Awareness Filtering', 'Hazard Lifecycle', 'Alert Generation',
  'Supabase Sync', 'Historical Intelligence', 'Official Source Integration', 'crossing interactions',
  'Saved Places', 'Home/Work personalization'
]) assert(doc.includes(protectedSystem), `audit must confirm ${protectedSystem}`);

console.log('LP096 destination address search audit contract passed.');
