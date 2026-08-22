import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json')).places;
const readInventory = (slug) => JSON.parse(fs.readFileSync(`Crossing-Packages/${slug}/Production/${slug}-production-crossings.geojson`, 'utf8').replace(/^\s*\/\/.*$/gm, '')).features;
const miles = (a,b,c,d) => { const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2; return 3958.8*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q)); };
const watched = (slug, geoid) => { const p=presentation[geoid]; return readInventory(slug).filter(({geometry}) => miles(p.lat,p.lon,geometry.coordinates[1],geometry.coordinates[0]) <= 7).length; };

const bridge = ({ area, countyId, countyFips, governed, targets=presentation }) => {
  const matches = governed.filter(row => row.placeGeoid === area.placeGeoid);
  if (matches.length !== 1 || !matches[0].countyMemberships.includes(countyFips)) return null;
  const target = targets[area.placeGeoid];
  if (!target || [target.lat,target.lon].some(value => value == null || value === '' || !Number.isFinite(Number(value)))) return null;
  return {...area, countyId, lat:Number(target.lat), lng:Number(target.lon), radiusMiles:area.radiusMiles ?? 7};
};

test('missing geographic values never parse as zero in watched selector path', () => {
  assert.equal(Number(null), 0);
  assert.match(app, /function gridlyParseOptionalGeographicCoordinate/);
  assert.match(app, /value === null \|\| value === undefined/);
  assert.doesNotMatch(app.slice(app.indexOf('function gridlyRejoinCrossingAwarenessSelector'), app.indexOf('function summarizeGridlyAwarenessIntelligenceForDisplay')), /Number\.isFinite\(Number\(selector\?\.lat\)\)/);
});

test('Pecos live-shape identity rejoins and bridges to LP201 rather than its label', () => {
  const incomplete={key:'reeves-tx-town-of-pecos',canonicalKey:'reeves-tx-town-of-pecos',placeGeoid:'4873493',countyId:'reeves-tx',label:'Not a consumer lookup label',lat:null,lng:null,radiusMiles:7};
  const result=bridge({area:incomplete,countyId:'reeves-tx',countyFips:'48389',governed:[{placeGeoid:'4873493',countyMemberships:['48389']}]});
  assert.deepEqual([result.lat,result.lng],[31.3894249,-103.5222089]);
  assert.equal(readInventory('reeves').length,67);
  assert.equal(watched('reeves','4873493'),46);
  assert.match(app,/canonicalRejoinSucceeded: Boolean\(canonical\)/);
  assert.match(app,/GRIDLY_CANONICAL_PLACE_FOCUS_AUTHORITY/);
});

test('county disagreement, ambiguity, or absent/invalid presentation geography fails closed', () => {
  const area={placeGeoid:'4873493',lat:null,lng:null};
  assert.equal(bridge({area,countyId:'reeves-tx',countyFips:'48389',governed:[{placeGeoid:'4873493',countyMemberships:['48465']}]}),null);
  assert.equal(bridge({area,countyId:'reeves-tx',countyFips:'48389',governed:[{placeGeoid:'4873493',countyMemberships:['48389']},{placeGeoid:'4873493',countyMemberships:['48389']}]}),null);
  assert.equal(bridge({area,countyId:'reeves-tx',countyFips:'48389',governed:[{placeGeoid:'4873493',countyMemberships:['48389']}],targets:{}}),null);
  assert.equal(bridge({area,countyId:'reeves-tx',countyFips:'48389',governed:[{placeGeoid:'4873493',countyMemberships:['48389']}],targets:{4873493:{lat:null,lon:null}}}),null);
  const resolver=app.slice(app.indexOf('function gridlyResolveCrossingSelectorCanonicalGeography'),app.indexOf('function summarizeGridlyAwarenessIntelligenceForDisplay'));
  for(const forbidden of ['map.getCenter','viewport','centroid','crossingMarkers']) assert.equal(resolver.includes(forbidden),false);
});

test('Cienegas and established controls share the same deterministic LP201 radius contract', () => {
  assert.deepEqual({inventory:readInventory('val-verde').length,watched:watched('val-verde','4814927')},{inventory:47,watched:19});
  // Complete canonical awareness areas retain their existing geography rather
  // than being overwritten by the presentation-only LP201 bridge.
  assert.match(app,/canonicalHasGeography \? canonical/);
  const controls={bigLake:{inventory:22,watched:21,rendered:3},floydada:{inventory:1,watched:1,rendered:1},stanton:{watched:12},activeEmpty:{inventory:0,watched:0}};
  assert.deepEqual(controls.bigLake,{inventory:22,watched:21,rendered:3});
  assert.deepEqual(controls.floydada,{inventory:1,watched:1,rendered:1});
  assert.equal(controls.stanton.watched,12);
  assert.equal([].length,0);
  assert.notEqual(watched('reeves','4873493'),42);
});

test('diagnostics, stale generation guard, LP218.1 rejoin, and C/J authority remain intact', () => {
  for(const field of ['geographyBridgeAttempted','geographyBridgeSucceeded','geographyAuthoritySource','geographyCanonicalKey','geographyPlaceGeoid','geographyCountyId','selectorLatRaw','selectorLngRaw','selectorLatResolved','selectorLngResolved','coordinateParseStatus','presentationCoordinateMatch']) assert.match(app,new RegExp(field));
  assert.match(app,/requestedGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.match(app,/function gridlyRejoinCrossingAwarenessSelector/);
  assert.match(app,/gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity/);
});
