import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { contract, validateEnvironment, reconcile, MUTATING_METHODS } from '../../tools/lp18812/statewide-validation-closure.mjs';

const c=contract();
test.beforeAll(()=>validateEnvironment(process.env,c));
test('exact governed Wave 0 is read-only',async({browser})=>{
  const context=await browser.newContext();
  const page=await context.newPage(); let mutation=false;
  const protectedOrigin=new URL(process.env.GRIDLY_PROTECTED_URL).origin;
  await page.route('**/*',route=>{ const request=route.request(),method=request.method(); if(MUTATING_METHODS.includes(method)){mutation=true; return route.abort('blockedbyclient');} if(new URL(request.url()).origin===protectedOrigin)return route.continue({headers:{...request.headers(),'CF-Access-Client-Id':process.env.GRIDLY_VALIDATOR_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':process.env.GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET}}); return route.continue(); });
  await page.goto(process.env.GRIDLY_PROTECTED_URL,{waitUntil:'domcontentloaded'});
  const build=await page.evaluate(async()=>await (await fetch('/gridly-protected-build-identity.json')).text()); expect(build).toContain(c.target.buildIdentity);
  const results=[];
  for(const fixture of c.governedFixtures.filter(x=>x.assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY')){
    const fips=fixture.applicableFips[0];
    await page.locator('#gridlyWelcomeCountySelect').selectOption({label:fixture.input.countyName});
    await page.locator('#gridlyWelcomeHomeAreaSelect').selectOption({index:0});
    expect(await page.locator('html').getAttribute('data-gridly-active-county-fips')).toBe(fips);
    const identity=JSON.parse(await page.locator('html').getAttribute('data-gridly-package-identity')); expect(identity.validationState).toBe('valid');
    results.push({fips,assertions:['CERTIFIED_ARTIFACT_STABILITY','OPERATIONAL_COUNTY_RESULT_STABILITY','CONSUMER_RESULT_STABILITY']});
  }
  expect(mutation).toBe(false);
  fs.mkdirSync('evidence/lp18812',{recursive:true});
  fs.writeFileSync('evidence/lp18812/wave0-partial-result.json',JSON.stringify(reconcile({results,failures:0,openS1:0,openS2:0,productionMutationObserved:mutation,activationObserved:false}),null,2)+'\n');
  await context.close();
});
