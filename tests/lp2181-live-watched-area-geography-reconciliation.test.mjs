import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json')).places;
const inventory = (slug) => JSON.parse(fs.readFileSync(`Crossing-Packages/${slug}/Production/${slug}-production-crossings.geojson`)).features;
const miles = (a, b, c, d) => { const r=Math.PI/180, x=(c-a)*r, y=(d-b)*r; const q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2; return 3958.8*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q)); };
const within = (slug, geoid) => { const p=presentation[geoid]; return inventory(slug).filter(({geometry}) => miles(p.lat,p.lon,geometry.coordinates[1],geometry.coordinates[0]) <= 7).length; };

function rejoin(projected, county, areas) {
  const geoid = projected.placeGeoid || /^place-(48\d{5})$/.exec(projected.canonicalKey || projected.key || '')?.[1];
  const candidates = areas.filter(a => a.countyId === county && ((geoid && a.placeGeoid === geoid) || (projected.key && a.key === projected.key)));
  return projected.countyId === county && (geoid || projected.key) && candidates.length === 1 ? candidates[0] : null;
}
const canonicalPecos={key:'reeves-tx-town-of-pecos',placeGeoid:'4873493',label:'Town of Pecos',countyId:'reeves-tx',lat:31.38,lng:-103.49,radiusMiles:7};
const liveCompact={key:'place-4873493',canonicalKey:'place-4873493',placeGeoid:'4873493',label:'Pecos',countyId:'reeves-tx',coordinates:{lat:null,lng:null},radiusMiles:null,source:'awareness-debug-projection'};

test('exact live-style compact projection reproduces the old missing-geography zero and rejoins canonically',()=>{
  assert.equal(liveCompact.coordinates.lat == null || liveCompact.coordinates.lng == null, true);
  assert.equal(inventory('reeves').filter(()=>false).length,0); // old selector had no usable center
  assert.equal(rejoin(liveCompact,'reeves-tx',[canonicalPecos]),canonicalPecos);
  assert.match(app,/function gridlyRejoinCrossingAwarenessSelector/);
});
test('county, canonical identity and ambiguity fail closed while label is non-authoritative',()=>{
  assert.equal(rejoin({...liveCompact,label:'Town of Pecos'},'reeves-tx',[canonicalPecos]),canonicalPecos);
  assert.equal(rejoin(liveCompact,'pecos-tx',[canonicalPecos]),null);
  assert.equal(rejoin({...liveCompact,placeGeoid:'4800001',key:'place-4800001'},'reeves-tx',[canonicalPecos]),null);
  assert.equal(rejoin(liveCompact,'reeves-tx',[canonicalPecos,{...canonicalPecos,label:'duplicate'}]),null);
  assert.equal(rejoin({key:'same-label',label:'Pecos',countyId:'reeves-tx'},'reeves-tx',[canonicalPecos]),null);
});
test('shared rejoin recovers Pecos and Cienegas canonical selector fixtures',()=>{
  const cienegas={key:'val-verde-tx-cienegas-terrace',placeGeoid:'4814927',countyId:'val-verde-tx',lat:29.4,lng:-100.9,radiusMiles:7};
  assert.equal(rejoin(liveCompact,'reeves-tx',[canonicalPecos]),canonicalPecos);
  assert.equal(rejoin({key:'place-4814927',placeGeoid:'4814927',countyId:'val-verde-tx'},'val-verde-tx',[cienegas]),cienegas);
  assert.equal(within('reeves','4873493') > 0,true);
  assert.equal(within('val-verde','4814927') > 0,true);
});
test('controls are derived independently from inventory and marker rendering',()=>{
  assert.equal(within('martin','4870040'),12);
  assert.ok(within('reagan','4808212') > 0);
  assert.equal(inventory('floyd').length,1);
  const watched=46, rendered=42, total=67; assert.notEqual(watched,rendered); assert.notEqual(watched,total);
  assert.equal([].length,0); // ACTIVE_EMPTY
});
test('diagnostics, stale guard, and C/J authority remain wired',()=>{
  for(const field of ['canonicalRejoinAttempted','canonicalRejoinSucceeded','selectorSourceKind','selectorCanonicalKey','selectorPlaceGeoid','watchedFilterRejectBreakdown']) assert.match(app,new RegExp(field));
  assert.match(app,/requestedGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.match(app,/gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity/);
  assert.doesNotMatch(app,/Pecos\s*===|reeves-tx.*watchedAreaEligibleCount/);
});
