import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync('js/app.js', 'utf8');
function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  let parens = 0;
  let brace = -1;
  for (let i = app.indexOf('(', start); i < app.length; i++) {
    if (app[i] === '(') parens++;
    if (app[i] === ')') parens--;
    if (parens === 0) { brace = app.indexOf('{', i); break; }
  }
  let depth = 0;
  for (let i = brace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}
const context = {
  console,
  globalThis: {},
  LIBERTY_COUNTY_CITY_RULES: [],
  DEFAULT_NEARBY_RADIUS_MILES: 7,
  normalizeGridlyAwarenessAreaLookupText: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  gridlyResolveCanonicalPlaceGeoid: area => /^48\d{5}$/.test(String(area?.placeGeoid || area?.communityId || '')) ? String(area.placeGeoid || area.communityId) : null,
  getGridlyAwarenessIntelligenceRecordCoordinate: record => Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng)) ? { lat: Number(record.lat), lng: Number(record.lng) } : null,
  getGridlyAwarenessIntelligenceCrossing: () => null,
  getGridlySelectedAwarenessArea: () => null,
  gridlyNormalizeCountyId: value => value,
  gridlyGetActiveCountyId: () => 'grayson-tx',
  GRIDLY_COUNTY_REGISTRY: {},
  GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
  gridlyGetReportCountyId: record => record.countyId,
  gridlyCoordinateInsideCountyBounds: () => false,
  getDistanceMiles(a,b,c,d) { const p=Math.PI/180; const x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2; return 3958.8*2*Math.asin(Math.sqrt(x)); }
};
vm.createContext(context);
for (const name of ['gridlyAuthoritativePointOnSegment','gridlyAuthoritativePointInRing','gridlyAuthoritativePointInGeometry','gridlyRecordTextMatchesAwarenessArea','gridlyGetGovernedAwarenessGeometry','isGridlyRecordInAwarenessArea','inferCrossingCity']) vm.runInContext(functionSource(name), context);

assert.equal(context.inferCrossingCity('', { CITYNAME: 'SHERMAN' }), 'Sherman');
assert.equal(context.inferCrossingCity('', { city: 'Denison', CITYNAME: 'SHERMAN' }), 'Denison');
const polygon = { type: 'Polygon', coordinates: [[[-97,33],[-96,33],[-96,34],[-97,34],[-97,33]]] };
assert.equal(context.isGridlyRecordInAwarenessArea({lat:33.5,lng:-96.5,city:'Elsewhere'}, {placeGeoid:'4867496',label:'Sherman',geometry:polygon}), true);
assert.equal(context.isGridlyRecordInAwarenessArea({lat:35,lng:-96.5,city:'Sherman'}, {placeGeoid:'4867496',label:'Sherman',geometry:polygon}), false, 'geometry is authoritative over text');
assert.equal(context.isGridlyRecordInAwarenessArea({city:'Sherman'}, {placeGeoid:'4867496',label:'Sherman'}), true, 'locality fallback needs no legacy bounds');
assert.equal(context.isGridlyRecordInAwarenessArea({lat:33.64,lng:-96.61,city:'Unassigned'}, {label:'Sherman',lat:33.635,lng:-96.608,radiusMiles:1}), true);
assert.equal(context.isGridlyRecordInAwarenessArea({lat:33.64,lng:-96.61,city:'Unassigned'}, {label:'Sherman'}), false, 'radius requires finite explicit focus');
assert.match(app, /if \(area\.countyWide \|\| area\.fallback\)/, 'countywide branch remains intact');
assert.match(app, /classification === "PUBLIC_ROADWAY"/, 'PUBLIC_ROADWAY policy remains intact');
assert.doesNotMatch(functionSource('isGridlyRecordInAwarenessArea'), /Dallas|Sherman|Liberty/, 'no control-specific production branch');

const manifest = JSON.parse(readFileSync('Crossing-Packages/production-crossing-manifest.json', 'utf8'));
for (const [county, city, expected] of [['Grayson','SHERMAN',83],['Dallas','DALLAS',392],['Liberty','LIBERTY',16],['El Paso','EL PASO',149],['Bexar','SAN ANTONIO',331],['McLennan','WACO',59],['Smith','TYLER',76]]) {
  const row = manifest.records.find(item => item.county === county);
  const payload = JSON.parse(readFileSync(row.packageFile, 'utf8').replace(/^\uFEFF/, ''));
  const publicRows = payload.features.filter(feature => String(feature.properties.gridlyClassification || '').toUpperCase() === 'PUBLIC_ROADWAY');
  const selected = publicRows.filter(feature => String(feature.properties.CITYNAME || '').toUpperCase() === city);
  assert.equal(selected.length, expected, `${county}/${city} governed locality selection`);
  assert.ok(publicRows.every(feature => !['PRIVATE_ROAD','INDUSTRIAL','RAIL_YARD','TEMPORARY_ACCESS'].includes(String(feature.properties.gridlyClassification).toUpperCase())));
}

const repairAudit = JSON.parse(readFileSync('reports/lp2022/statewide-crossing-awareness-ownership-repair.json', 'utf8'));
assert.equal(repairAudit.statewideImpact.activePositiveCountiesEvaluated, 202);
assert.equal(repairAudit.statewideImpact.previouslyVulnerableWithoutLegacyBounds, 175);
assert.equal(repairAudit.statewideImpact.governedContextsWithPositiveSelection, 194);
assert.equal(repairAudit.statewideImpact.zeroCountCases, 8);
assert.equal(repairAudit.statewideImpact.selectorFailures, 0);
assert.equal(repairAudit.controls.grayson.selectedGovernedContext.count, 83);
assert.equal(repairAudit.controls.dallas.selectedGovernedContext.count, 392);
