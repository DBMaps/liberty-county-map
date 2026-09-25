const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(process.env.GRIDLY_B1_APP_SOURCE||'js/app.js','utf8');
const source=name=>{const match=app.match(new RegExp(`function ${name}\\([^]*?^\\}`,'m'));assert.ok(match,name);return match[0];};
test('same-area summary becomes ineligible when current community revision clears or removes one condition',()=>{
 let revision='active=a,b';const box={getGridlyAwarenessSummaryAreaIdentity:()=> 'place-a',getGridlyCurrentSelectedAwarenessAreaIdentity:()=> 'place-a',gridlyGetCanonicalActiveCommunityState:()=>({revision})};vm.createContext(box);vm.runInContext(source('isGridlyCachedAwarenessSummaryForCurrentArea'),box);
 const summary={canonicalCommunityRevision:revision};assert.equal(box.isGridlyCachedAwarenessSummaryForCurrentArea(summary),true);
 revision='active=b';assert.equal(box.isGridlyCachedAwarenessSummaryForCurrentArea(summary),false);
 revision='active=';assert.equal(box.isGridlyCachedAwarenessSummaryForCurrentArea(summary),false);
});
test('unversioned official-only published summaries retain legacy compatibility',()=>{
 const box={getGridlyAwarenessSummaryAreaIdentity:()=> 'place-a',getGridlyCurrentSelectedAwarenessAreaIdentity:()=> 'place-a'};vm.createContext(box);vm.runInContext(source('isGridlyCachedAwarenessSummaryForCurrentArea'),box);assert.equal(box.isGridlyCachedAwarenessSummaryForCurrentArea({activeIssueCount:1,official:true}),true);
});
function publicationHarness(){
 const stale={canonicalCommunityRevision:'active=a',activeHazardsInArea:[{id:'a'}]},fresh={canonicalCommunityRevision:'active=',activeHazardsInArea:[]};
 const box={gridlyCommunityPulseAuditState:{communityAwarenessSummary:stale},gridlyLastAuthoritativeCommunityAwarenessSummary:stale,gridlyGetAuthoritativeCommunityAwarenessSummary:()=>stale,gridlyGetCanonicalActiveCommunityState:()=>({revision:'active='}),gridlyGetGovernedActiveAwarenessRows:()=>[],gridlyRecordCommunitySummaryWrite:()=>{},gridlyGovernedActiveConditionParity:{convergeAuthoritativeSummary:s=>s},buildGridlyCommunityAwarenessIntelligenceSummary:()=>fresh};box.window=box;vm.createContext(box);vm.runInContext(source('publishGridlyCommunityPulseAuditState'),box);return{box,stale,fresh};
}
test('Pulse publication chooses current zero summary over same-area stale authority and publisher readback',()=>{
 const {box,fresh}=publicationHarness();const result=box.publishGridlyCommunityPulseAuditState({communityAwarenessSummary:fresh,activeAwareness:{activeAwarenessCount:0}});assert.equal(result.communityAwarenessSummary,fresh);assert.equal(box.gridlyLastAuthoritativeCommunityAwarenessSummary,fresh);assert.equal(result.communityAwarenessSummary.activeHazardsInArea.length,0);
});
test('late stale-only publication rebuilds from current authority rather than retaining old candidate',()=>{
 const {box,stale,fresh}=publicationHarness();const result=box.publishGridlyCommunityPulseAuditState({communityAwarenessSummary:stale});assert.equal(result.communityAwarenessSummary,fresh);assert.equal(result.communityAwarenessSummary.activeHazardsInArea.length,0);
});
