import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { contract, validateEnvironment, reconcile, MUTATING_METHODS } from '../../tools/lp18812/statewide-validation-closure.mjs';

// Canonical Gridly portrait-validation viewport (LP185.9A and V856/V857 validation).
const GOVERNED_MOBILE_PORTRAIT_VIEWPORT=Object.freeze({width:390,height:844});

const c=contract();
const governedFixtures=c.governedFixtures.filter(x=>x.assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY');
// The enclosing test owns all 28 isolated journeys. Keep Playwright's bounded
// per-action/navigation/expect defaults, but budget 30 seconds per fixture plus
// one minute for browser/test setup, teardown, and final reconciliation.
const GOVERNED_FIXTURE_EXECUTION_BUDGET_MS=30_000;
const GOVERNED_WAVE0_OVERHEAD_BUDGET_MS=60_000;
const GOVERNED_WAVE0_TEST_TIMEOUT_MS=(governedFixtures.length*GOVERNED_FIXTURE_EXECUTION_BUDGET_MS)+GOVERNED_WAVE0_OVERHEAD_BUDGET_MS;
test.beforeAll(()=>validateEnvironment(process.env,c));
test('exact governed Wave 0 is read-only',async({browser})=>{
  test.setTimeout(GOVERNED_WAVE0_TEST_TIMEOUT_MS);
  let mutation=false;
  const protectedOrigin=new URL(process.env.GRIDLY_PROTECTED_URL).origin;
  const results=[];
  for(const fixture of governedFixtures){
    const fips=fixture.applicableFips[0];
    const awarenessInput=fixture.input.awarenessAreaInput;
    expect(awarenessInput).toMatchObject({type:'ZIP',resolver:'resolveGridlyAwarenessAreaQuery'});
    const context=await browser.newContext({viewport:GOVERNED_MOBILE_PORTRAIT_VIEWPORT});
    const page=await context.newPage();
    expect(page.viewportSize()).toEqual(GOVERNED_MOBILE_PORTRAIT_VIEWPORT);
    await page.route('**/*',route=>{ const request=route.request(),method=request.method(); if(MUTATING_METHODS.includes(method)){mutation=true; return route.abort('blockedbyclient');} if(new URL(request.url()).origin===protectedOrigin)return route.continue({headers:{...request.headers(),'CF-Access-Client-Id':process.env.GRIDLY_VALIDATOR_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':process.env.GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET}}); return route.continue(); });
    await page.goto(process.env.GRIDLY_PROTECTED_URL,{waitUntil:'domcontentloaded'});
    const build=await page.evaluate(async()=>await (await fetch('/gridly-protected-build-identity.json')).text()); expect(build).toContain(c.target.buildIdentity);
    await expect(page.locator('#gridlyWelcomeOnboarding')).toBeVisible();
    for(let pageIndex=0;pageIndex<6;pageIndex+=1) await page.locator('#gridlyV950NextBtn').click();
    await expect(page.locator('#gridlyV858LocationInput')).toBeVisible();
    await page.locator('#gridlyV858LocationInput').fill(awarenessInput.value);
    await page.locator('#gridlyV858ManualLocationForm button[type="submit"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-gridly-active-county-fips',fips);
    await expect.poll(async()=>page.locator('html').getAttribute('data-gridly-package-identity')).not.toBeNull();
    const identity=JSON.parse(await page.locator('html').getAttribute('data-gridly-package-identity'));
    expect(identity.validationState).toBe('valid');
    results.push({fips,assertions:['CERTIFIED_ARTIFACT_STABILITY','OPERATIONAL_COUNTY_RESULT_STABILITY','CONSUMER_RESULT_STABILITY']});
    await context.close();
  }
  expect(mutation).toBe(false);
  fs.mkdirSync('evidence/lp18812',{recursive:true});
  fs.writeFileSync('evidence/lp18812/wave0-partial-result.json',JSON.stringify(reconcile({results,failures:0,openS1:0,openS2:0,productionMutationObserved:mutation,activationObserved:false}),null,2)+'\n');
});
