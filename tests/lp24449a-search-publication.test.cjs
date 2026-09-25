const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
const source=app.match(/function filterGridlyExplicitIntentRelevance\([\s\S]*?\n\}/)[0];
const canonical={provider:'gridly_canonical_place',placeGeoid:'4801514',requestedOperationalCountyId:'brooks-tx'};
const h={GRIDLY_DESTINATION_INTENTS:{ADDRESS:'address',BUSINESS_PLACE:'business'},window:{GRIDLY_LP101_SEARCH_QUALITY:{businessResultRelevant:()=>false,roadwayMatchesAddress:()=>false}},buildGridlyLp097AddressModel:()=>({}),classifyGridlyLp097Result:r=>({exactAddress:r.exactAddress===true,roadAgreement:false}),gridlyResolveGovernedPlaceSearchCandidates:q=>q==='Airport Road Addition, Brooks County, TX'?[{placeGeoid:'4801514',requestedOperationalCountyId:'brooks-tx'}]:q==='Airport Road Addition'?[{placeGeoid:'4801514'}]:[]};
vm.createContext(h);vm.runInContext(source,h);
for(const type of ['address','business'])test(`exact governed PLACE survives the shared ${type} publication filter, including renderer reuse`,()=>{
 const rows=[canonical,{...canonical,placeGeoid:'4801396'},{...canonical,requestedOperationalCountyId:'nueces-tx'},{...canonical,provider:'external'}];
 const accepted=h.filterGridlyExplicitIntentRelevance(rows,{query:'Airport Road Addition, Brooks County, TX',intent:{type}});
 assert.equal(accepted.length,1);assert.equal(accepted[0],canonical);
 assert.equal(h.filterGridlyExplicitIntentRelevance([canonical],{query:'123 Airport Road',intent:{type}}).length,0,'provider tag alone cannot bypass actual query identity');
});
test('ordinary exact addresses retain their existing relevance path',()=>{
 const address={provider:'external',exactAddress:true};
 assert.equal(h.filterGridlyExplicitIntentRelevance([address],{query:'123 Airport Road',intent:{type:'address'}})[0],address);
});
