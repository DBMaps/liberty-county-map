const test=require('node:test'),assert=require('node:assert/strict');
test('every county uses governed NWS point lifecycle or the existing fail-closed countywide contract',async()=>{
 const result=await require('../tools/community-loading-repair/statewide-nws.cjs').main();assert.equal(result.auditedCounties,254);assert.equal(result.pointLifecycleTested,254);assert.equal(result.countywideFailClosedTested,0);assert.equal(result.allAssertionsPassed,true);
});
