import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const appSource=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const loaderSource=fs.readFileSync(new URL('../js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js',import.meta.url),'utf8');
const geometryPackage=JSON.parse(fs.readFileSync(new URL('../assets/location-resolution/gridly-authoritative-county-geometry-v1.json',import.meta.url)));
const contract=JSON.parse(fs.readFileSync(new URL('../reports/lp18812/wave0-remaining-fixture-contract.json',import.meta.url)));
const boundaryFixtures=contract.fixtures.filter(x=>x.assertionId==='COUNTY_BOUNDARY_ISOLATION');
const fipsById={'liberty-tx':'48291','hardin-tx':'48199','chambers-tx':'48071'};
const cutoff=appSource.indexOf('const GRIDLY_AWARENESS_AREA_DEFINITIONS = [');

function runtime(activeCounty='liberty-tx',pkg=geometryPackage) {
  const window={GRIDLY_ACTIVE_COUNTY_ID:activeCounty,addEventListener(){},removeEventListener(){},setInterval(){return 0;},clearInterval(){},setTimeout(){return 0;},clearTimeout(){}};
  const sandbox={Object,String,Number,Boolean,Array,Math,console,window,fetch:async()=>({ok:true,json:async()=>pkg}),gridlyPostV818CountySwitchingAudit(){return {};},gridlyPostV818FiveCountySwitchingAudit(){return {};},gridlyRegionalRuntimeCertification(){return {};},setInterval(){return 0;},clearInterval(){},setTimeout(){return 0;},clearTimeout(){}};
  vm.createContext(sandbox);
  vm.runInContext(loaderSource,sandbox);
  window.gridlyLp0361cRuntimeCountyGeometryPackageLoader.install(pkg);
  vm.runInContext(`${appSource.slice(0,cutoff)}\nthis.resolve=gridlyResolveCountyIdForCoordinate;`,sandbox);
  return sandbox.resolve;
}

test('all four governed LP188.12 boundary fixtures resolve by authoritative polygon',()=>{
  for(const fixture of boundaryFixtures){const {latitude,longitude}=fixture.input.coordinate,result=runtime()(latitude,longitude),fips=fipsById[result.countyId];assert.equal(fips,fixture.expectedResult.resolvedCountyFips,`${fixture.fixtureId}:${JSON.stringify(result)}`);assert.notEqual(fips,fixture.prohibitedResult.resolvedCountyFips,fixture.fixtureId);assert.equal(result.authoritativeGeometryAvailable,true,fixture.fixtureId);}
});

test('active/default county cannot override the polygon-correct Hardin result',()=>{
  for(const active of ['liberty-tx','hardin-tx','chambers-tx']){const result=runtime(active)(30.489534,-94.732465);assert.equal(result.countyId,'hardin-tx');assert.equal(result.ambiguousCountyResolution,false);}
});

test('zero containment and ambiguous polygon interiors fail closed',()=>{
  const far={type:'Polygon',coordinates:[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]]};
  const zero=structuredClone(geometryPackage);for(const county of zero.counties)if(['liberty-tx','hardin-tx'].includes(county.countyId))county.geometry=far;
  assert.equal(runtime('liberty-tx',zero)(30.489534,-94.732465).countyId,null);
  const ambiguous=structuredClone(geometryPackage),hardin=ambiguous.counties.find(x=>x.countyId==='hardin-tx');ambiguous.counties.find(x=>x.countyId==='liberty-tx').geometry=structuredClone(hardin.geometry);
  const result=runtime('liberty-tx',ambiguous)(30.489534,-94.732465);assert.equal(result.countyId,null);assert.equal(result.ambiguousCountyResolution,true);
});
