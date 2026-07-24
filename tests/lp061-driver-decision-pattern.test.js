const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /version: "LP061"/, 'Travel Brief model is advanced to LP061');
assert.match(app, /driverDecisionPattern: true/, 'Travel Brief model declares Driver Decision Pattern ownership');
assert.match(app, /key: "driver-decision"/, 'Driver Decision section is present');
assert.match(app, /pattern: "LP061 Driver Decision Pattern"/, 'Driver Decision section identifies LP061 pattern');
assert.match(app, /lines: Object\.freeze\(\[interpretation, reason, confidence, freshness\]\)/, 'Travel Brief orders interpretation, reason, confidence, freshness');
assert.match(app, /gridlyDecisionRole/, 'Driver Decision DOM preserves logical field roles');
assert.match(app, /sourceLine: ""/, 'Driver Decision suppresses technical source label in consumer presentation');
assert.match(app, /gridlyBuildTravelBriefDecisionSection\(\{ story, records, driveTexasRecords \}\),\n\s+Object\.freeze\(\{ key: "community"/, 'Driver Decision section renders before existing source sections');
assert.match(app, /gridlyStoryActiveRecords\(\)/, 'Travel Brief preserves active community source');
assert.match(app, /gridlyStoryTransportationConnectorRecords\(\)/, 'Travel Brief preserves official roadway source');
assert.match(app, /gridlyBriefInteractionWeatherModel\(\)/, 'Travel Brief preserves weather source');
assert.match(app, /window\.gridlyLp061DriverDecisionPatternAudit = gridlyLp061DriverDecisionPatternAudit/, 'LP061 browser audit is exposed');
assert.match(app, /existingActionsPreserved: preservedActionValues\.every\(Boolean\)/, 'LP061 audit checks contextual action preservation');
assert.match(app, /function gridlyTravelBriefIncidentActionApplicability/, 'LP061 audit has contextual incident action applicability helper');
assert.match(app, /confirm: Object\.freeze\(\{ applicable: contextualIncidentActionsApplicable\.confirm, preserved: confirmPathPreserved/, 'Confirm applicability is derived from current Travel Brief context while preserving capability');
assert.match(app, /markCleared: Object\.freeze\(\{ applicable: contextualIncidentActionsApplicable\.markCleared, preserved: clearPathPreserved/, 'Mark Cleared applicability is derived from current Travel Brief context while preserving capability');
assert.match(app, /visibleWhenApplicable: !contextualIncidentActionsApplicable\.confirm \|\| \/confirm\|still there\/i\.test\(actionText\)/, 'Applicable active-state confirm visibility remains protected');
assert.match(app, /visibleWhenApplicable: !contextualIncidentActionsApplicable\.markCleared \|\| \/mark cleared\|cleared\/i\.test\(actionText\)/, 'Applicable active-state clear visibility remains protected');
assert.match(app, /gridlyTravelBriefSettledFreshnessCopy/, 'Freshness copy is normalized through settled consumer wording');
assert.match(app, /data-gridly-decision-role=\"freshness\"/, 'LP061 audit validates semantic freshness role');
assert.match(app, /!\/checking now\/i.test\(renderedFreshnessText\)/, 'Settled freshness copy rejects checking now');
assert.match(app, /consumerPresentationLabelsSuppressed/, 'LP061 audit rejects exposed structural labels');
assert.match(app, /routeWatchLogic: "unchanged"/, 'LP061 audit protects Route Watch logic');
assert.match(app, /communityPulseLogic: "unchanged"/, 'LP061 audit protects Community Pulse logic');
assert.match(app, /officialRoadwayProcessing: "unchanged"/, 'LP061 audit protects official roadway processing');
assert.match(app, /weatherProcessing: "unchanged"/, 'LP061 audit protects weather processing');
assert.match(app, /hazardLifecycle: "unchanged"/, 'LP061 audit protects hazard lifecycle');
assert.match(app, /crossingLifecycle: "unchanged"/, 'LP061 audit protects crossing lifecycle');
assert.match(app, /reporting: "unchanged"/, 'LP061 audit protects reporting');
assert.match(app, /supabase: "unchanged"/, 'LP061 audit protects Supabase');
assert.match(app, /alertGeneration: "unchanged"/, 'LP061 audit protects alert generation');

const lp061Block = app.slice(app.indexOf('function gridlyTravelBriefSettledFreshnessCopy'), app.indexOf('function gridlyBuildTravelBriefModel'));
const renderBlock = app.slice(app.indexOf('function gridlyRenderTravelBrief'), app.indexOf('window.gridlyBuildTravelBriefModel'));
const css = fs.readFileSync('css/styles.css', 'utf8');
assert.doesNotMatch(lp061Block, /safe to proceed|guaranteed safety|guaranteed safe|all clear/i, 'Quiet-state language avoids safety guarantees');
assert.doesNotMatch(renderBlock, /Gridly interpretation/, 'Rendered consumer presentation does not expose Gridly interpretation');
assert.match(css, /gridly-travel-brief-item\[data-gridly-travel-brief-section="driver-decision"\] \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, 'Driver Decision is not constrained to narrow two-column layout');
assert.match(css, /data-gridly-decision-role="confidence"[\s\S]*data-gridly-decision-role="freshness"/, 'Confidence and freshness share compact metadata styling');
assert.match(lp061Block, /return `\$\{safePrefix\} just now`/, 'Quiet freshness renders settled just-now wording');
assert.doesNotMatch(lp061Block, /return .*checking now/i, 'checking now is not returned as final settled freshness copy');
assert.match(lp061Block, /no community travel conditions reported\|no official roadway advisories nearby\|no travel-impacting weather/i, 'Quiet Travel Brief sections are not classified as active incidents');
assert.match(lp061Block, /confirm: communityActive/, 'Confirm applicability follows active current context rather than global handler presence');
assert.match(lp061Block, /markCleared: communityActive/, 'Mark Cleared applicability follows active current context rather than global handler presence');
assert.match(app, /confirmPathPreserved = Boolean[\s\S]*confirmHazardStillThere/, 'Global confirm handler existence proves preservation only');
assert.match(app, /clearPathPreserved = Boolean[\s\S]*clearHazard/, 'Global clear handler existence proves preservation only');

const context = { Object, Array, RegExp, Number, Math, Date };
vm.createContext(context);
vm.runInContext(`
function gridlyTravelBriefCleanLine(value) { return String(value || '').trim(); }
${lp061Block}
`, context);
assert.strictEqual(context.gridlyTravelBriefFreshnessLine([], []), 'Checked just now', 'Quiet freshness renders settled consumer wording');
context.gridlyBriefInteractionText = () => 'Quiet conditions. · checking now...';
assert.strictEqual(context.gridlyTravelBriefFreshnessLine([], []), 'Checked just now', 'checking now is not final settled freshness copy');
context.gridlyBriefInteractionText = () => 'Reports: Updated 4 minutes ago';
assert.strictEqual(context.gridlyTravelBriefFreshnessLine([], []), 'Updated 4 minutes ago', 'Existing freshness timestamp copy is preserved and polished');
const quietModel = { sections: [{ key: 'community', lines: ['No community travel conditions reported.'] }, { key: 'drivetexas', lines: ['No official roadway advisories nearby.'] }, { key: 'weather', lines: ['No travel-impacting weather.'] }] };
const activeModel = { sections: [{ key: 'community', lines: ['Train blocking crossing reported nearby.'] }] };
const quietApplicability = context.gridlyTravelBriefIncidentActionApplicability(quietModel);
assert.strictEqual(quietApplicability.confirm, false, 'Quiet state does not classify Confirm as applicable');
assert.strictEqual(quietApplicability.markCleared, false, 'Quiet state does not classify Mark Cleared as applicable');
const activeApplicability = context.gridlyTravelBriefIncidentActionApplicability(activeModel);
assert.strictEqual(activeApplicability.confirm, true, 'Active confirmable state classifies Confirm as applicable');
assert.strictEqual(activeApplicability.markCleared, true, 'Active clearable state classifies Mark Cleared as applicable');

console.log('LP061 Driver Decision Pattern regression passed');
