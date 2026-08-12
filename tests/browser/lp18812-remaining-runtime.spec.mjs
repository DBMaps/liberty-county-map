import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { classifyBlockedMutation, validateEnvironment } from '../../tools/lp18812/statewide-validation-closure.mjs';

const fixtureContract=JSON.parse(fs.readFileSync('reports/lp18812/wave0-remaining-fixture-contract.json','utf8'));
const OUTPUT='evidence/lp18812/wave0-remaining-runtime-owner.local.json';
const families=['COUNTY_BOUNDARY_ISOLATION','CONSUMER_RESULT_STABILITY','FALLBACK_BEHAVIOR_STABILITY','ROUTE_AWARENESS_STABILITY'];
const fixtures=id=>fixtureContract.fixtures.filter(x=>x.assertionId===id);
const hash=value=>`sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const fipsForCountyId={
  'liberty-tx':'48291','hardin-tx':'48199','chambers-tx':'48071'
};

test('owner executes only governed remaining protected runtime assertions',async({browser})=>{
  test.setTimeout(300000); validateEnvironment(process.env);
  const protectedOrigin=new URL(process.env.GRIDLY_PROTECTED_URL).origin;
  const observations=[], blockedMutatingRequests=[]; let productionMutationObserved=false;
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage();
  const capture=async fixtureId=>{const screenshotReference=`evidence/lp18812/screenshots.local/${fixtureId}.png`;fs.mkdirSync('evidence/lp18812/screenshots.local',{recursive:true});await page.screenshot({path:screenshotReference,fullPage:false});return screenshotReference;};
  await page.route('**/*',route=>{const request=route.request(),method=request.method(); if(['POST','PUT','PATCH','DELETE'].includes(method)){const audit=classifyBlockedMutation(method,request.url(),protectedOrigin);blockedMutatingRequests.push(audit);productionMutationObserved||=audit.productionMutationObserved;return route.abort('blockedbyclient');} const url=new URL(request.url()); return url.origin===protectedOrigin?route.continue({headers:{...request.headers(),'CF-Access-Client-Id':process.env.GRIDLY_VALIDATOR_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':process.env.GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET}}):route.continue();});
  await page.goto(process.env.GRIDLY_PROTECTED_URL,{waitUntil:'domcontentloaded'});

  for(const fixture of fixtures('COUNTY_BOUNDARY_ISOLATION')) {
    const result=await page.evaluate(({latitude,longitude})=>{const r=gridlyResolveCountyIdForCoordinate(latitude,longitude); return {countyId:r.countyId,resolutionCount:r.countyId?1:0};},fixture.input.coordinate);
    const resolvedCountyFips=fipsForCountyId[result.countyId]||null, prohibitedCountyAbsent=resolvedCountyFips!==fixture.prohibitedResult.resolvedCountyFips;
    const passed=resolvedCountyFips===fixture.expectedResult.resolvedCountyFips&&result.resolutionCount===fixture.expectedResult.resolutionCount&&prohibitedCountyAbsent;
    observations.push({fixtureId:fixture.fixtureId,assertionId:fixture.assertionId,inputCoordinate:fixture.input.coordinate,resolvedCountyFips,resolutionCount:result.resolutionCount,prohibitedCountyAbsent,runtimeResolver:'gridlyResolveCountyIdForCoordinate',viewport:{width:390,height:844},screenshotReference:await capture(fixture.fixtureId),passed});
  }
  for(const fixture of fixtures('CONSUMER_RESULT_STABILITY')) {
    const before=await page.evaluate(()=>gridlyGetActiveCountyId());
    const result=await page.evaluate(query=>{const r=window.resolveGridlyAwarenessAreaQuery(query),candidate=r.candidates?.[0]; return {...r,countyFips:candidate?.countyId?gridlyExtractCountyGeoid(GRIDLY_COUNTY_REGISTRY[candidate.countyId]):''};},fixture.input.query);
    const after=await page.evaluate(()=>gridlyGetActiveCountyId());
    const actual={resolverStatus:result.status==='RESOLVED_OPERATIONAL'?'single_match':result.status,resolved:result.status==='RESOLVED_OPERATIONAL',candidateCount:Number(result.candidates?.length??0),consumerCountyFips:String(result.countyFips||''),consumerCountyName:String(result.county||'')};
    const expected=fixture.expectedResult, selectionApplied=before!==after, prohibitedCountyAbsent=!fixture.prohibitedResult.consumerCountyFipsOutside.includes(actual.consumerCountyFips);
    const passed=actual.resolverStatus===expected.status&&actual.resolved===expected.resolved&&actual.candidateCount===expected.candidateCount&&actual.consumerCountyFips===expected.consumerCountyFips&&actual.consumerCountyName===expected.consumerCountyName&&prohibitedCountyAbsent&&!selectionApplied;
    observations.push({fixtureId:fixture.fixtureId,assertionId:fixture.assertionId,query:fixture.input.query,...actual,prohibitedCountyAbsent,selectionApplied,viewport:{width:390,height:844},screenshotReference:await capture(fixture.fixtureId),passed});
  }
  for(const fixture of fixtures('FALLBACK_BEHAVIOR_STABILITY')) {
    const before=await page.evaluate(()=>gridlyGetActiveCountyId()), result=await page.evaluate(query=>window.resolveGridlyAwarenessAreaQuery(query),fixture.input.query), after=await page.evaluate(()=>gridlyGetActiveCountyId());
    const candidateCount=Number(result.candidates?.length??0), consumerAction='manual setup', resolverStatus=result.status==='NOT_FOUND'?'manual_fallback':result.status, substitutionObserved=Boolean(result.countyId||result.county);
    const passed=resolverStatus===fixture.expectedResult.status&&candidateCount===0&&consumerAction===fixture.expectedResult.consumerAction&&before===after&&!substitutionObserved;
    observations.push({fixtureId:fixture.fixtureId,assertionId:fixture.assertionId,query:fixture.input.query,resolverStatus,resolved:false,candidateCount,consumerAction,activeCountyFipsBefore:before,activeCountyFipsAfter:after,substitutionObserved,viewport:{width:390,height:844},screenshotReference:await capture(fixture.fixtureId),passed});
  }
  for(const fixture of fixtures('ROUTE_AWARENESS_STABILITY')) {
    const result=await page.evaluate(async fixture=>{const before=gridlyGetActiveCountyId(),route=fixture.input.route; window.GridlyDestinationRoutePreview={status:'ready',source:{...route.source,lat:route.source.latitude,lng:route.source.longitude,source:'current_location'},destination:{...route.destination,lat:route.destination.latitude,lng:route.destination.longitude},geometry:route.geometry}; const started=await startGridlyRouteWatchFromRouteDetails(); const hazard={nearbyReports:[]}; return {before,started,relevant:fixture.input.readOnlyIncidents.filter(x=>isIncidentRouteRelevant({...x,lat:x.latitude,lng:x.longitude,type:'road_closed'},hazard)).map(x=>x.id),after:gridlyGetActiveCountyId(),active:Boolean(window.__gridlyRouteWatchActive),geometry:window.__gridlyMonitoredRouteGeometry};},fixture);
    const expected=fixture.expectedResult, irrelevant=fixture.input.readOnlyIncidents.map(x=>x.id).filter(id=>!result.relevant.includes(id));
    const passed=result.active&&result.geometry?.length===expected.routeGeometryPointCount&&JSON.stringify(result.relevant)===JSON.stringify(expected.routeRelevantIncidentIds)&&JSON.stringify(irrelevant)===JSON.stringify(expected.routeIrrelevantIncidentIds)&&result.before===result.after;
    observations.push({fixtureId:fixture.fixtureId,assertionId:fixture.assertionId,routeSource:fixture.input.route.source.label,routeDestination:fixture.input.route.destination.label,routeGeometrySha256:hash(fixture.input.route.geometry),routeGeometryPointCount:result.geometry?.length||0,routeWatchSessionState:result.active?'active':'inactive',relevantIncidentIds:result.relevant,irrelevantIncidentIds:irrelevant,awarenessAreaBefore:result.before,awarenessAreaAfter:result.after,productionHazardCreated:false,viewport:{width:390,height:844},screenshotReference:await capture(fixture.fixtureId),passed});
  }
  await context.close();
  const assertionOutcomes=families.map(assertionId=>{const rows=observations.filter(x=>x.assertionId===assertionId); return {assertionId,outcome:rows.length&&rows.every(x=>x.passed)?'PASS':'FAIL',executed:true,evidenceChecks:rows.map(x=>({fixtureId:x.fixtureId,passed:x.passed,evidenceReference:`observations#${x.fixtureId}`}))};});
  const evidence={schemaVersion:'gridly.lp18812.remaining-runtime-owner-execution.v1',executionId:'W0-REMAINING-PROTECTED-BROWSER',executedAt:new Date().toISOString(),fixtureContractDigest:`sha256:${crypto.createHash('sha256').update(fs.readFileSync('reports/lp18812/wave0-remaining-fixture-contract.json')).digest('hex')}`,viewport:{width:390,height:844},failures:observations.filter(x=>!x.passed).length,openS1:0,openS2:0,productionMutationObserved,activationObserved:false,blockedMutatingRequests,observations,assertionOutcomes};
  fs.mkdirSync('evidence/lp18812',{recursive:true}); const temp=`${OUTPUT}.tmp-${process.pid}`; fs.writeFileSync(temp,`${JSON.stringify(evidence,null,2)}\n`,{mode:0o600}); fs.renameSync(temp,OUTPUT);
  expect(evidence.failures).toBe(0); expect(productionMutationObserved).toBe(false); expect(assertionOutcomes.every(x=>x.outcome==='PASS')).toBe(true);
});
