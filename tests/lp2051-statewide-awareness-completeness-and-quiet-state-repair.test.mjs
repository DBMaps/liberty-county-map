import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('Crossing-Packages/production-crossing-manifest.json', 'utf8'));
function block(start, end) { const a=app.indexOf(start), b=app.indexOf(end,a); assert.ok(a>=0&&b>a); return app.slice(a,b); }
const sandbox={window:{},Object,Number,Math}; vm.createContext(sandbox);
vm.runInContext(block('const GRIDLY_AWARENESS_SOURCE_STATE','function classifyGridlyAwarenessTrustState'),sandbox);
const complete=(overrides={})=>sandbox.gridlyGetAwarenessEvidenceCompleteness(overrides);
const ZERO='HEALTHY_ZERO', RESULTS='HEALTHY_WITH_RESULTS', INACTIVE='INACTIVE', FAILED='FAILED', MISSING='MISSING_CAPABILITY';
const partial=(extra={})=>complete({reportReadState:'succeeded',communityReportCount:0,crossingsState:'AVAILABLE_WITH_CROSSINGS',driveTexasState:INACTIVE,nwsAlertState:INACTIVE,weatherConditionsState:MISSING,weatherForecastState:MISSING,...extra});

test('scenarios A-C distinguish report success zero, failure, and loading',()=>{
 assert.equal(partial().canStateCommunityQuiet,true);
 for(const reportReadState of ['failed','loading','not_started']) { const c=partial({reportReadState}); assert.equal(c.canStateCommunityQuiet,false); assert.equal(c.canStateTravelNormal,false); }
});
test('DriveTexas inactive/failed deny, while healthy zero permits only scoped roadway zero',()=>{
 assert.equal(partial().canStateNoOfficialRoadwayAdvisories,false);
 assert.equal(partial({driveTexasState:FAILED}).canStateNoOfficialRoadwayAdvisories,false);
 const c=partial({driveTexasState:ZERO}); assert.equal(c.canStateNoOfficialRoadwayAdvisories,true); assert.equal(c.canStateTravelNormal,false);
});
test('NWS zero is alert-scoped and missing weather or forecast denies broad weather/travel',()=>{
 assert.equal(partial().canStateNoActiveWeatherAlerts,false);
 const c=partial({nwsAlertState:ZERO,driveTexasState:ZERO}); assert.equal(c.canStateNoActiveWeatherAlerts,true); assert.equal(c.canStateNoWeatherImpact,false); assert.equal(c.canStateTravelNormal,false);
 assert.equal(partial({weatherConditionsState:ZERO}).canStateNoWeatherImpact,false);
 assert.equal(partial({weatherForecastState:ZERO}).canStateTravelNormal,false);
});
test('active reports preserve non-quiet semantics',()=>{const c=partial({communityReportCount:1});assert.equal(c.communityReportsKnown,true);assert.equal(c.canStateCommunityQuiet,false);});
test('ACTIVE_EMPTY and local crossing zero never independently authorize broad clear',()=>{
 for(const crossingsState of ['AVAILABLE_NO_GOVERNED_CROSSINGS','AVAILABLE_NO_LOCAL_CROSSINGS']) { const c=partial({crossingsState}); assert.equal(c.crossingsKnown,true); assert.equal(c.canStateTravelNormal,false); assert.equal(c.canStateAreaClear,false); }
});
test('future all-required-sources healthy-zero fixture authorizes broad claims',()=>{
 const c=partial({driveTexasState:ZERO,nwsAlertState:ZERO,weatherConditionsState:ZERO,weatherForecastState:ZERO});
 assert.equal(c.canStateNoWeatherImpact,true);assert.equal(c.canStateTravelNormal,true);assert.equal(c.canStateAreaClear,true);
});
test('all 254 counties and cohorts receive identical current-production permissions',()=>{
 assert.equal(manifest.records.length,254); const permissions=manifest.records.map(r=>partial({crossingsState:r.crossingCount?'AVAILABLE_WITH_CROSSINGS':'AVAILABLE_NO_GOVERNED_CROSSINGS'}));
 assert.ok(permissions.every(c=>!c.canStateTravelNormal&&!c.canStateAreaClear&&!c.canStateNoOfficialRoadwayAdvisories&&!c.canStateNoWeatherImpact));
 assert.equal(new Set(permissions.map(c=>JSON.stringify([c.canStateTravelNormal,c.canStateAreaClear,c.canStateNoOfficialRoadwayAdvisories,c.canStateNoWeatherImpact]))).size,1);
});
test('production builders gate quiet absence copy while preserving active facts',()=>{
 const drive=block('function gridlyTravelBriefDriveTexasLines','function gridlyTravelBriefWeatherLines');
 const weather=block('function gridlyTravelBriefWeatherLines','function gridlyTravelBriefSettledFreshnessCopy');
 assert.match(drive,/canStateNoOfficialRoadwayAdvisories/);assert.match(weather,/canStateNoWeatherImpact/);
 assert.match(app,/No official roadway advisories nearby\./);assert.match(app,/No travel-impacting weather\./);
 assert.match(drive,/impacted\.map/);assert.match(weather,/lines\.push/);
});
test('startup and report failure lifecycle cannot masquerade as succeeded',()=>{
 const loader=block('async function loadSharedReports','if (typeof window !== "undefined")');
 assert.match(loader,/state: "loading"/);assert.match(loader,/state: "succeeded"/);assert.match(loader,/state: "failed"/);
 const pulse=block('function getGridlyHomeCommunityPulseCopy','function gridlyCommunityPulseConsumerHeadlineAvailable');
 assert.match(pulse,/Monitoring nearby conditions/);assert.match(pulse,/No active local issues reported\./);
});
test('current production suppresses all four RCA broad quiet conclusions',()=>{
 const c=complete({reportReadState:'succeeded',communityReportCount:0,crossingsState:'AVAILABLE_WITH_CROSSINGS'});
 assert.deepEqual([...c.blockedClaims].sort(),['No official roadway advisories nearby.','No travel-impacting weather.','Travel normally today.','Your area is clear right now'].sort());
});
