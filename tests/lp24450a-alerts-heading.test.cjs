const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const app=fs.readFileSync('js/app.js','utf8');
const start=app.indexOf('const mountLP236AlertsPresentation ='),end=app.indexOf('  const transaction =',start);
assert.ok(start>0&&end>start,'Exact current production title writer found');
function title(alerts,families,coverage={forecast:true,crossing:true}){
 let written;
 const box={document:{},gridlyLP236AlertsOpenAuditState:{},gridlyLp0458SanitizeOfficialAlertCardMarkup:x=>x,
  gridlyReadAlertsFamilyAuthority:()=>families,
  gridlyWeatherConnectorRuntimeAudit:()=>({forecastRequestSucceeded:coverage.forecast}),
  getGridlyAwarenessCoverageState:()=>({crossingAvailable:coverage.crossing,semanticCoverageState:coverage.crossing?'AVAILABLE_NO_GOVERNED_CROSSINGS':'LOADING'})};
 box.window={gridlyLP236RenderAlertsPresentation:()=>'',openGridlyPortraitV2Sheet:(_sheet,args)=>{written=args;return true;}};
 box.window.gridlyWeatherConnectorRuntimeAudit=box.gridlyWeatherConnectorRuntimeAudit;
 vm.createContext(box);vm.runInContext(app.match(/function gridlyGetLocalSourceCoverage\([^]*?^\}/m)[0]+'\n'+app.slice(start,end)+'\nthis.mount=mountLP236AlertsPresentation;',box);
 // Browser evidence proves this flag represents projection availability,
 // including when a provider's family authority is STALE/UNAVAILABLE.
 box.mount({activeConditionAuthorityAvailable:true,activeConditionAuthorityReason:'governed Alerts consumer projection available'},alerts,'');
 return written.title;
}
const healthy=()=>Object.fromEntries(['official_roadway','weather','community_report'].map(k=>[k,{state:'QUIET',available:true}]));
test('healthy confirmed empty may use No Active Alerts',()=>assert.equal(title([],healthy()),'No Active Alerts'));
test('positive governed data retains Alerts heading',()=>assert.equal(title([{id:'known-live-observation'}],healthy()),'Alerts'));
for(const family of ['official_roadway','weather'])for(const state of ['UNAVAILABLE','STALE'])test(`${family} ${state}: empty projection is not a no-alerts assertion`,()=>{
 const families=healthy();families[family]={state,available:false};
 assert.doesNotMatch(title([],families),/no active alerts/i,'Do not claim no alerts while this source is unknown');
});
for(const family of ['official_roadway','weather','community_report'])for(const state of ['LOADING','UNAVAILABLE'])test(`${family} ${state} then recovery restores quiet and active headings`,()=>{
 const families=healthy();families[family]={state,available:false};
 assert.equal(title([],families),'Alerts');
 assert.equal(title([{id:'active'}],families),'Alerts','positive evidence stays visible despite incomplete coverage');
 families[family]={state:'QUIET',available:true};assert.equal(title([],families),'No Active Alerts');
 families[family]={state:'ACTIVE',available:true};assert.equal(title([{id:'recovered-active'}],families),'Alerts');
});
test('mixed empty/unavailable families and missing forecast/crossing coverage cannot imply quiet',()=>{
 const families=healthy();families.weather={available:false,state:'UNAVAILABLE'};assert.equal(title([],families),'Alerts');
 assert.equal(title([],healthy(),{forecast:false,crossing:true}),'Alerts');
 assert.equal(title([],healthy(),{forecast:true,crossing:false}),'Alerts');
});
