const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /version: "LP061"/, 'Travel Brief model is advanced to LP061');
assert.match(app, /driverDecisionPattern: true/, 'Travel Brief model declares Driver Decision Pattern ownership');
assert.match(app, /key: "driver-decision"/, 'Driver Decision section is present');
assert.match(app, /pattern: "LP061 Driver Decision Pattern"/, 'Driver Decision section identifies LP061 pattern');
assert.match(app, /lines: Object\.freeze\(\[interpretation, reason, confidence, freshness\]\)/, 'Travel Brief orders interpretation, reason, confidence, freshness');
assert.match(app, /gridlyBuildTravelBriefDecisionSection\(\{ story, records, driveTexasRecords \}\),\n\s+Object\.freeze\(\{ key: "community"/, 'Driver Decision section renders before existing source sections');
assert.match(app, /gridlyStoryActiveRecords\(\)/, 'Travel Brief preserves active community source');
assert.match(app, /gridlyStoryTransportationConnectorRecords\(\)/, 'Travel Brief preserves official roadway source');
assert.match(app, /gridlyBriefInteractionWeatherModel\(\)/, 'Travel Brief preserves weather source');
assert.match(app, /window\.gridlyLp061DriverDecisionPatternAudit = gridlyLp061DriverDecisionPatternAudit/, 'LP061 browser audit is exposed');
assert.match(app, /existingActionsPreserved/, 'LP061 audit checks action preservation');
assert.match(app, /routeWatchLogic: "unchanged"/, 'LP061 audit protects Route Watch logic');
assert.match(app, /communityPulseLogic: "unchanged"/, 'LP061 audit protects Community Pulse logic');
assert.match(app, /officialRoadwayProcessing: "unchanged"/, 'LP061 audit protects official roadway processing');
assert.match(app, /weatherProcessing: "unchanged"/, 'LP061 audit protects weather processing');
assert.match(app, /hazardLifecycle: "unchanged"/, 'LP061 audit protects hazard lifecycle');
assert.match(app, /crossingLifecycle: "unchanged"/, 'LP061 audit protects crossing lifecycle');
assert.match(app, /reporting: "unchanged"/, 'LP061 audit protects reporting');
assert.match(app, /supabase: "unchanged"/, 'LP061 audit protects Supabase');
assert.match(app, /alertGeneration: "unchanged"/, 'LP061 audit protects alert generation');
const lp061Block = app.slice(app.indexOf('function gridlyTravelBriefFreshnessLine'), app.indexOf('function gridlyRenderTravelBrief'));
assert.doesNotMatch(lp061Block, /safe to proceed|guaranteed safety|guaranteed safe|all clear/i, 'Quiet-state language avoids safety guarantees');

console.log('LP061 Driver Decision Pattern regression passed');
