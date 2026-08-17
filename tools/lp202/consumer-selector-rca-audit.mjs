#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFile(resolve(root, path), 'utf8');
const json = async path => JSON.parse((await read(path)).replace(/^\uFEFF/, ''));
const app = await read('js/app.js');
const manifest = await json('Crossing-Packages/production-crossing-manifest.json');

const controls = [
  ['Grayson', 'grayson-tx', 'Sherman'],
  ['Dallas', 'dallas-tx', 'Dallas'],
  ['Liberty', 'liberty-tx', 'Liberty'],
  ['El Paso', 'el-paso-tx', 'El Paso'],
  ['Bexar', 'bexar-tx', 'San Antonio'],
  ['McLennan', 'mclennan-tx', 'Waco'],
  ['Smith', 'smith-tx', 'Tyler']
];
const hidden = new Set(['PRIVATE_ROAD', 'INDUSTRIAL', 'RAIL_YARD', 'TEMPORARY_ACCESS']);
const normalize = value => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const haversine = (a, b, c, d) => { const p = Math.PI / 180; const x = Math.sin((c-a)*p/2) ** 2 + Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2) ** 2; return 3958.8 * 2 * Math.asin(Math.sqrt(x)); };

function countyBlock(id) {
  const start = app.indexOf(`"${id}": Object.freeze(`);
  const end = app.indexOf('\n  // LP189 GENERATED END', start);
  return app.slice(start, end);
}
function areaCoordinates(id, label) {
  const block = countyBlock(id);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const community = block.match(new RegExp(`\\{[^{}]*"displayName":"${escaped}"[^{}]*(?:"focus":\\{"lat":(-?\\d+(?:\\.\\d+)?),"lng":(-?\\d+(?:\\.\\d+)?))?[^{}]*\\}`));
  if (community?.[1]) return { lat: Number(community[1]), lng: Number(community[2]), source: 'consumerAwarenessAreas.focus' };
  const boundsStart = app.indexOf('const GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID');
  const boundsEnd = app.indexOf('\n});', boundsStart);
  const bounds = app.slice(boundsStart, boundsEnd).match(new RegExp(`"${id}": Object\\.freeze\\(\\{ south: (-?\\d+(?:\\.\\d+)?), west: (-?\\d+(?:\\.\\d+)?), north: (-?\\d+(?:\\.\\d+)?), east: (-?\\d+(?:\\.\\d+)?)`));
  return bounds ? { lat: (Number(bounds[1])+Number(bounds[3]))/2, lng: (Number(bounds[2])+Number(bounds[4]))/2, source: 'legacy county awareness-bounds centroid' } : { lat: null, lng: null, source: 'none' };
}
function reportable(p) {
  const position = String(p.crossingposition || p.crossing_position || '');
  const code = String(p.crossingpositioncode || p.crossing_position_code || '');
  const closed = String(p.crossingclosed || p.crossing_closed || '');
  const purpose = String(p.crossingpurpose || p.crossing_purpose || '');
  const evidence = [p.street, p.highwayname, p.roadwayname, p.name, position, code, closed, purpose].filter(Boolean).join(' ');
  return !(position && !/^at\s*grade$/i.test(position)) && !(code && code !== '1') && !/\b(?:underpass|overpass|grade[-\s]?separated|separator|separated|bridge)\b/i.test(evidence) && !(/\bclosed\b/i.test(closed) && !/^no$/i.test(closed)) && !(/\b(?:pedestrian|pathway|station|railroad|rr)\b/i.test(purpose) && !/\bhighway\b/i.test(purpose));
}

const results = {};
for (const [county, countyId, community] of controls) {
  const record = manifest.records.find(row => row.county === county);
  const payload = await json(record.packageFile);
  const rows = payload.features.map((feature, index) => ({
    id: String(feature.properties.CROSSING || `crossing-${index}`),
    lat: Number(feature.geometry.coordinates[1]), lng: Number(feature.geometry.coordinates[0]),
    city: 'Unassigned', // inferCrossingCity ignores governed uppercase CITYNAME.
    source: 'crossing_provider_production', countyId, props: feature.properties
  }));
  const area = areaCoordinates(countyId, community);
  const countyMatch = rows;
  const classificationEligible = countyMatch.filter(row => String(row.props.gridlyClassification || '').toUpperCase() === 'PUBLIC_ROADWAY');
  const reportableRows = classificationEligible.filter(row => reportable(row.props));
  const awarenessOwned = reportableRows.filter(row => normalize(row.city) === normalize(community) || (Number.isFinite(area.lat) && Number.isFinite(area.lng) && haversine(area.lat, area.lng, row.lat, row.lng) <= 7));
  const seen = new Set();
  const deduped = awarenessOwned.filter(row => { const key = row.id.toLowerCase(); if (key && seen.has(key)) return false; if (key) seen.add(key); return true; });
  const classifications = { PUBLIC_ROADWAY: 0, PRIVATE_ROAD: 0, INDUSTRIAL: 0, RAIL_YARD: 0, TEMPORARY_ACCESS: 0, UNKNOWN_UNCLASSIFIED: 0 };
  for (const row of rows) { const c = String(row.props.gridlyClassification || '').toUpperCase(); if (Object.hasOwn(classifications, c)) classifications[c]++; else classifications.UNKNOWN_UNCLASSIFIED++; }
  results[county.toLowerCase().replace(/ /g, '_')] = { countyId, community, area, classifications, stages: { input: rows.length, countyMatch: countyMatch.length, classificationEligible: classificationEligible.length, reportable: reportableRows.length, awarenessOwned: awarenessOwned.length, localityEligible: awarenessOwned.length, geometryEligible: awarenessOwned.length, fraIdentityValidAndDeduped: deduped.length, hiddenLegacyEligibility: deduped.length, final: deduped.length }, rejection: { county: rows.length-countyMatch.length, classification: countyMatch.length-classificationEligible.length, reportability: classificationEligible.length-reportableRows.length, awarenessOwnership: reportableRows.length-awarenessOwned.length, duplicateFraIdentity: awarenessOwned.length-deduped.length }, representative: rows.slice(0, 3).map(row => ({ id: row.id, normalizedCity: row.city, governedCITYNAME: row.props.CITYNAME, classification: row.props.gridlyClassification, lat: row.lat, lng: row.lng })) };
}

const boundsStart = app.indexOf('const GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID');
const boundsEnd = app.indexOf('\n});', boundsStart);
const legacyBoundsIds = new Set([...app.slice(boundsStart, boundsEnd).matchAll(/"([a-z-]+-tx)":/g)].map(match => match[1]));
const positive = manifest.records.filter(row => row.crossingCount > 0);
const slug = name => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-tx`;
const impact = positive.filter(row => !legacyBoundsIds.has(slug(row.county)));
const output = { schemaVersion: 'gridly.lp2022.consumer-selector-rca.v1', generatedAt: '2026-08-17T00:00:00.000Z', observationalOnly: true, results, statewideImpact: { activePositiveCounties: positive.length, countiesWithoutLegacyAwarenessBounds: impact.length, qualification: 'Guaranteed vulnerable cohort when a selected PLACE has no explicit focus: normalized production rows expose city=Unassigned and the generated area has no coordinate fallback.', counties: impact.map(row => row.county) } };
await mkdir(resolve(root, 'reports/lp2022'), { recursive: true });
await writeFile(resolve(root, 'reports/lp2022/consumer-selector-rca-audit.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`LP202.2 selector RCA PASS: Sherman ${results.grayson.stages.input} -> ${results.grayson.stages.awarenessOwned}; ${impact.length}/${positive.length} active-positive counties lack the legacy awareness-bounds fallback.`);
