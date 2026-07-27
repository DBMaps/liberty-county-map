const assert = require("node:assert/strict");
const fs = require("node:fs");
const kbApi = require("../js/historical-knowledge-base.js");
const retrieval = require("../js/historical-knowledge-retrieval.js");

const patterns = [
  { patternId:"p:cross",revision:1,lineageId:"l:cross",archiveId:"a:q2",crossingIdentity:"x:waco",roadwayIdentity:"r:90",awarenessArea:"aa:dayton",community:"c:dayton",county:"co:liberty",category:"rail-delay",lifecycleStatus:"active",qualityStatus:"stable",activeRevision:true,lineageValid:true,daysOfWeek:["Mon"],localTimeWindow:{start:"08:00",end:"09:00"},approvedNearWindowToleranceMinutes:15,evidenceStrength:8 },
  { patternId:"p:road",revision:1,lineageId:"l:road",archiveId:"a:q2",roadwayIdentity:"r:90",awarenessArea:"aa:dayton",community:"c:dayton",county:"co:liberty",category:"rail-delay",lifecycleStatus:"active",qualityStatus:"supported",activeRevision:true,lineageValid:true,daysOfWeek:["Mon"],localTimeWindow:{start:"08:00",end:"09:00"} },
  { patternId:"p:area",revision:1,lineageId:"l:area",archiveId:"a:q2",awarenessArea:"aa:dayton",community:"c:dayton",county:"co:liberty",category:"rail-delay",lifecycleStatus:"active",qualityStatus:"stable",activeRevision:true,lineageValid:true },
  { patternId:"p:bad",revision:1,lineageId:"l:bad",archiveId:"a:q2",county:"co:liberty",category:"rail-delay",lifecycleStatus:"retired",qualityStatus:"rejected",activeRevision:false,lineageValid:false }
];
const base = kbApi.createKnowledgeBase(patterns,[{source:"p:cross",target:"p:road",type:"related"},{source:"p:road",target:"p:cross",type:"related"}]);
const request = (extra={}) => ({ contractVersion:retrieval.VERSIONS.requestContract,policyVersions:retrieval.VERSIONS,requestIdentity:"req:1",retrievalMode:"crossing-context",crossingIdentity:"x:waco",roadwayIdentity:"r:90",awarenessAreaIdentity:"aa:dayton",communityIdentity:"c:dayton",countyIdentity:"co:liberty",patternCategory:"rail-delay",...extra });

assert.equal(retrieval.ACTIVATION.activationAuthorized,false);
assert.equal(retrieval.normalizeRequest(request()).accepted,true);
assert.equal(retrieval.normalizeRequest({...request(),contractVersion:"bad"}).failureCodes[0],retrieval.FAILURE_CODES.UNSUPPORTED_VERSION);
assert.equal(retrieval.normalizeRequest({...request(),retrievalMode:null}).failureCodes[0],retrieval.FAILURE_CODES.MODE_REQUIRED);
assert.equal(retrieval.normalizeRequest({...request(),surprise:true}).failureCodes[0],retrieval.FAILURE_CODES.UNKNOWN_FIELD);
const a=retrieval.normalizeRequest(request()), b=retrieval.normalizeRequest(Object.fromEntries(Object.entries(request()).reverse()));
assert.deepEqual(a,b); assert.equal(Object.isFrozen(a.normalizedRequest.policyVersions),true);
for(const [mode,field,value] of [["crossing-context","crossingIdentity","x:waco"],["roadway-context","roadwayIdentity","r:90"],["awareness-area-context","awarenessAreaIdentity","aa:dayton"],["community-context","communityIdentity","c:dayton"],["county-context","countyIdentity","co:liberty"]]) assert.equal(retrieval.retrieve(base,request({retrievalMode:mode,[field]:value})).accepted,true,mode);
assert.equal(retrieval.retrieve(base,request({countyIdentity:"co:wrong"})).failureCodes[0],retrieval.FAILURE_CODES.INCOMPATIBLE_GEOGRAPHY);
assert.equal(retrieval.retrieve(base,request({communityIdentity:"c:wrong"})).failureCodes[0],retrieval.FAILURE_CODES.INCOMPATIBLE_GEOGRAPHY);
assert.equal(retrieval.normalizeRequest(request({canonicalTimezone:"Mars/Olympus"})).failureCodes[0],retrieval.FAILURE_CODES.INVALID_TIMEZONE);
assert.equal(retrieval.normalizeRequest(request({patternCategory:"weather-magic"})).failureCodes[0],retrieval.FAILURE_CODES.UNSUPPORTED_CATEGORY);
assert.equal(retrieval.createPlan(a,base).planFingerprint,retrieval.createPlan(b,base).planFingerprint);
assert.deepEqual(retrieval.retrieve(base,request()).candidateIdentities,["p:cross"],"exact crossing excludes broader records");
assert.deepEqual(retrieval.retrieve(base,request({retrievalMode:"roadway-context",crossingIdentity:null})).candidateIdentities,["p:cross","p:road"],"roadway excludes area record");
const present=(time,tolerance=0)=>request({retrievalMode:"present-moment",canonicalTimestamp:time,localTimestamp:time,canonicalTimezone:"UTC",relevanceWindow:{nearWindowToleranceMinutes:tolerance}});
assert.deepEqual(retrieval.retrieve(base,present("2026-07-27T08:30:00Z")).candidateIdentities,["p:cross"]);
assert.equal(retrieval.retrieve(base,present("2026-07-27T09:10:00Z",15)).candidateRankingInputs[0].presentMomentRelevance,1);
assert.equal(retrieval.retrieve(base,present("2026-07-27T12:00:00Z")).quietResult.reasonCode,"no_time_relevant_knowledge");
const county=retrieval.retrieve(base,request({retrievalMode:"county-context",crossingIdentity:null,roadwayIdentity:null,awarenessAreaIdentity:null,communityIdentity:null}));
assert.ok(county.rejectedCandidateSummaries.find((x)=>x.identity==="p:bad").reasonCodes.includes(retrieval.REJECTION_CODES.LIFECYCLE_INELIGIBLE));
assert.ok(county.rejectedCandidateSummaries.find((x)=>x.identity==="p:bad").reasonCodes.includes(retrieval.REJECTION_CODES.QUALITY_INELIGIBLE));
assert.ok(county.rejectedCandidateSummaries.find((x)=>x.identity==="p:bad").reasonCodes.includes(retrieval.REJECTION_CODES.INVALID_LINEAGE));
assert.ok(county.rejectedCandidateSummaries.find((x)=>x.identity==="p:bad").reasonCodes.includes(retrieval.REJECTION_CODES.INACTIVE_REVISION));
assert.equal(retrieval.retrieve(base,request()).diagnostics.relationshipTraversalCount,0);
const traversed=retrieval.retrieve(base,request({relationshipTraversal:{authorized:true,maxDepth:3,types:["related"]}}));
assert.deepEqual(traversed.candidateIdentities,["p:cross","p:road"]); assert.equal(traversed.diagnostics.relationshipTraversalCount,1,"cycle is prevented");
const noFallback=retrieval.retrieve(base,request({crossingIdentity:"x:missing",roadwayIdentity:"r:90",countyIdentity:null,communityIdentity:null,awarenessAreaIdentity:null})); assert.equal(noFallback.accepted,false);
const fallbackReq=request({crossingIdentity:"x:absent",countyIdentity:null,communityIdentity:null,awarenessAreaIdentity:null,fallbackAuthorization:["crossing->roadway"]});
// Compatibility must remain valid to authorize fallback: an exact crossing can exist but be ineligible.
const inactiveCross={...patterns[0],lifecycleStatus:"retired"}; const fb=kbApi.createKnowledgeBase([inactiveCross,...patterns.slice(1)]);
const fallback=retrieval.retrieve(fb,fallbackReq); assert.equal(fallback.accepted,false); // absent identity fails closed, never silently broadens
const eligibleFallback=retrieval.retrieve(kbApi.createKnowledgeBase([inactiveCross,...patterns.slice(1)]),request({fallbackAuthorization:["crossing->roadway"]}));
assert.deepEqual(eligibleFallback.candidateIdentities,["p:road"]); assert.equal(eligibleFallback.diagnostics.fallbackUsed,true);
assert.equal(county.quietResult,null); assert.deepEqual(county.candidateIdentities,[...county.candidateIdentities].sort());
assert.equal(Object.hasOwn(county,"consumerNarrative"),false); assert.doesNotMatch(JSON.stringify(county),/current conditions|will happen|prediction/i);
const repeat=retrieval.retrieve(base,Object.fromEntries(Object.entries(request()).reverse())); assert.deepEqual(retrieval.retrieve(base,request()),repeat); assert.equal(repeat.resultFingerprint,retrieval.retrieve(base,request()).resultFingerprint);
assert.equal(Object.isFrozen(county),true); assert.equal(Object.isFrozen(county.diagnostics.fingerprints),true); assert.throws(()=>{"use strict";county.candidateIdentities.push("x");},TypeError);
assert.notEqual(retrieval.fingerprint(patterns),retrieval.fingerprint([{...patterns[0],revision:2},...patterns.slice(1)]));
for(const name of ["historical-pattern-intelligence","historical-narrative-generator","historical-narrative-ranking","historical-intelligence-activation-boundary","historical-observation-learning","historical-archive-persistence","historical-pattern-lifecycle","historical-learning-orchestration","historical-learning-quality-governance","historical-knowledge-base"]) assert.doesNotThrow(()=>require(`../js/${name}.js`));
for(const file of ["index.html","js/app.js"]) assert.doesNotMatch(fs.readFileSync(file,"utf8"),/LP082|historical-knowledge-retrieval/i);
const certification=fs.readFileSync("tests/lp082-browser-certification.html","utf8");
for(const key of ["passive","productionIsolationPreserved","retrievalRequestContractAvailable","explicitRetrievalModesAvailable","contextNormalizationAvailable","contextCompatibilityValidationAvailable","deterministicRetrievalPlanningAvailable","timeRelevanceGovernanceAvailable","geographicRelevanceGovernanceAvailable","knowledgeEligibilityFilteringAvailable","relationshipTraversalGovernanceAvailable","fallbackGovernanceAvailable","retrievalRankingInputsAvailable","oneOrQuietRetrievalAvailable","retrievalExplainabilityAvailable","retrievalIdempotencyPass","retrievalResultContractAvailable","policyVersionGovernanceAvailable","diagnosticsAvailable","deterministicRetrievalPass","lp067CompatibilityPreserved","lp068CompatibilityPreserved","lp069CompatibilityPreserved","lp070CompatibilityPreserved","lp076CompatibilityPreserved","lp077CompatibilityPreserved","lp078CompatibilityPreserved","lp079CompatibilityPreserved","lp080CompatibilityPreserved","lp081CompatibilityPreserved","activationStillDisabled","protectedSystemsUnchanged","safeToMerge"]) assert.ok(certification.includes(key),key);
console.log("LP082 Historical Knowledge Retrieval & Context Governance passed");
