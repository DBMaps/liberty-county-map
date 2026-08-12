import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contract } from '../tools/lp18812/statewide-validation-closure.mjs';

test('Wave 0 uses the current V858/V950 first-run consumer journey',()=>{
  const source=fs.readFileSync(new URL('./browser/lp18812-wave0.spec.mjs',import.meta.url),'utf8');
  for(const selector of ['#gridlyWelcomeOnboarding','#gridlyV950NextBtn','#gridlyV858LocationInput','#gridlyV858ManualLocationForm']) assert.match(source,new RegExp(selector));
  for(const removedSelector of ['gridlyWelcomeCountySelect','gridlyWelcomeHomeAreaSelect']) assert.doesNotMatch(source,new RegExp(removedSelector));
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
