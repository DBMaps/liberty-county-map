const test=require('node:test'),assert=require('node:assert/strict');
test('all governed counties retain exact production crossing, PLACE, eligibility, hydration and cache contracts',async()=>{
 const result=await require('../tools/community-loading-repair/statewide-certification.cjs').main();
 assert.equal(result.coverage.auditedCounties,254);assert.equal(result.coverage.functionLevelCounties,254);assert.equal(result.coverage.positive,202);assert.equal(result.coverage.empty,52);assert.equal(result.coverage.sourceCrossings,16099);assert.equal(result.coverage.canonicalPlaces,1859);assert.equal(result.coverage.countyPlaceMemberships,2058);assert.equal(result.allAssertionsPassed,true);
});
