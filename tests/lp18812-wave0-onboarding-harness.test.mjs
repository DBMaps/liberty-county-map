import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contract } from '../tools/lp18812/statewide-validation-closure.mjs';

test('Wave 0 uses the current V858/V950 first-run consumer journey',()=>{
  const source=fs.readFileSync(new URL('./browser/lp18812-wave0.spec.mjs',import.meta.url),'utf8');
  for(const selector of ['#gridlyWelcomeOnboarding','#gridlyV950NextBtn','#gridlyV858LocationInput','#gridlyV858ManualLocationForm']) assert.match(source,new RegExp(selector));
  for(const removedSelector of ['gridlyWelcomeCountySelect','gridlyWelcomeHomeAreaSelect']) assert.doesNotMatch(source,new RegExp(removedSelector));
});

test('every Wave 0 fixture uses the canonical governed mobile portrait viewport',()=>{
  const source=fs.readFileSync(new URL('./browser/lp18812-wave0.spec.mjs',import.meta.url),'utf8');
  assert.match(source,/const GOVERNED_MOBILE_PORTRAIT_VIEWPORT=Object\.freeze\(\{width:390,height:844\}\)/);
  assert.match(source,/browser\.newContext\(\{viewport:GOVERNED_MOBILE_PORTRAIT_VIEWPORT\}\)/);
  assert.match(source,/expect\(page\.viewportSize\(\)\)\.toEqual\(GOVERNED_MOBILE_PORTRAIT_VIEWPORT\)/);
  assert.doesNotMatch(source,/browser\.newContext\(\s*\)/);
  assert.doesNotMatch(source,/devices\[/);
});

test('the one-test Wave 0 run has an explicit timeout budget derived for all 28 fixtures',()=>{
  const source=fs.readFileSync(new URL('./browser/lp18812-wave0.spec.mjs',import.meta.url),'utf8');
  const config=fs.readFileSync(new URL('../playwright.lp18812.config.mjs',import.meta.url),'utf8');
  assert.match(source,/const governedFixtures=c\.governedFixtures\.filter\(x=>x\.assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY'\)/);
  assert.match(source,/const GOVERNED_FIXTURE_EXECUTION_BUDGET_MS=30_000/);
  assert.match(source,/const GOVERNED_WAVE0_OVERHEAD_BUDGET_MS=60_000/);
  assert.match(source,/const GOVERNED_WAVE0_TEST_TIMEOUT_MS=\(governedFixtures\.length\*GOVERNED_FIXTURE_EXECUTION_BUDGET_MS\)\+GOVERNED_WAVE0_OVERHEAD_BUDGET_MS/);
  assert.match(source,/test\.setTimeout\(GOVERNED_WAVE0_TEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(source,/setTimeout\(0\)|timeout\s*:\s*0/);
  assert.doesNotMatch(config,/(?:actionTimeout|navigationTimeout|globalTimeout|timeout)\s*:/);

  const fixtureCount=contract().governedFixtures.filter(({assertionId})=>assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY').length;
  assert.equal(fixtureCount,28);
  assert.equal((fixtureCount*30_000)+60_000,900_000);
});

test('all 28 exact operational fixtures provide governed current-resolver ZIP input',()=>{
  const fixtures=contract().governedFixtures.filter(({assertionId})=>assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY');
  assert.equal(fixtures.length,28);
  assert.equal(new Set(fixtures.map(({fixtureId})=>fixtureId)).size,28);
  for(const fixture of fixtures){
    assert.match(fixture.input.awarenessAreaInput.value,/^\d{5}$/);
    assert.deepEqual({type:fixture.input.awarenessAreaInput.type,resolver:fixture.input.awarenessAreaInput.resolver},{type:'ZIP',resolver:'resolveGridlyAwarenessAreaQuery'});
    assert.equal(fixture.input.countyFips,fixture.applicableFips[0]);
  }
});
