#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_IDENTITY = Object.freeze({ filename: 'tl_2025_48_place.zip', bytes: 9782040, sha256: '5a0c4d49641f69028ee9f5c343bf09936ec00a378e5e6393115b106bab935e13' });
export const WORKING_CRS = Object.freeze({ authority: 'EPSG', code: 3083, name: 'NAD83 / Texas Centric Albers Equal Area', linearUnit: 'metre', areaUnit: 'square metre' });
export const EXPECTED_GDAL = 'GDAL 3.11.';
export const DEFAULTS = Object.freeze({
  projection: path.join(ROOT, 'data/generated/gridly-statewide-consumer-community-projection-v1.json'),
  focus: path.join(ROOT, 'data/generated/gridly-statewide-place-presentation-v1.json'),
  json: path.join(ROOT, 'reports/statewide-place-presentation-geometry-audit.json'),
  markdown: path.join(ROOT, 'reports/statewide-place-presentation-geometry-audit.md')
});
const SIX = new Set(['4824000', '4865000', '4819000', '4841464', '4854708', '4842568']);
const fail = message => { throw new Error(`Statewide PLACE geometry audit failed closed: ${message}`); };
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));

export function validateSource(archivePath, identity = SOURCE_IDENTITY) {
  if (!archivePath) fail('governed archive path is required');
  if (path.basename(archivePath).toLowerCase() !== identity.filename) fail(`source filename must be ${identity.filename}`);
  let bytes;
  try { bytes = fs.readFileSync(archivePath); } catch (error) { fail(`cannot read source: ${error.message}`); }
  if (bytes.length !== identity.bytes) fail(`source byte length mismatch: expected ${identity.bytes}, found ${bytes.length}`);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== identity.sha256) fail(`source SHA-256 mismatch: expected ${identity.sha256}, found ${sha256}`);
  return { filename: identity.filename, bytes: identity.bytes, sha256 };
}

export function loadGovernance(projectionPath = DEFAULTS.projection) {
  const doc = JSON.parse(fs.readFileSync(projectionPath, 'utf8'));
  if (doc.schemaVersion !== 'gridly.statewide-consumer-community-projection.v1') fail('projection schema is invalid');
  if (doc.counts?.uniquePlaceCount !== 1859 || doc.counts?.excludedIneligibleCount !== 4) fail('projection governed counts are not 1,859 eligible and 4 excluded');
  const eligible = new Map(), excluded = new Set();
  for (const row of doc.communities || []) {
    if (!/^48\d{5}$/.test(row.placeGeoid || '') || row.consumerEligible !== true || eligible.has(row.placeGeoid)) fail(`invalid or duplicate eligible GEOID ${row.placeGeoid}`);
    eligible.set(row.placeGeoid, row);
  }
  for (const row of doc.exclusions || []) {
    if (!/^48\d{5}$/.test(row.placeGeoid || '') || excluded.has(row.placeGeoid) || eligible.has(row.placeGeoid)) fail(`invalid, duplicate, or leaking excluded GEOID ${row.placeGeoid}`);
    excluded.add(row.placeGeoid);
  }
  if (eligible.size !== 1859 || excluded.size !== 4) fail(`exact eligibility reconciliation failed (${eligible.size} eligible, ${excluded.size} excluded)`);
  return { eligible, excluded };
}

function executable(name, env = process.env) {
  const bin = env.GRIDLY_GDAL_BIN;
  return bin ? path.join(bin, process.platform === 'win32' ? `${name}.exe` : name) : name;
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) fail(`${path.basename(command)} is unavailable; install/use the LP188.2A QGIS 3.44.11 GDAL path or set GRIDLY_GDAL_BIN (${result.error.message})`);
  if (result.status !== 0) fail(`${path.basename(command)} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

export function verifyGdal(env = process.env) {
  const ogrinfo = executable('ogrinfo', env), ogr2ogr = executable('ogr2ogr', env);
  const version = run(ogrinfo, ['--version']).trim();
  if (!version.startsWith(EXPECTED_GDAL)) fail(`GDAL version must be the governed QGIS 3.44.11 ${EXPECTED_GDAL}x line; found ${version}`);
  run(ogr2ogr, ['--version']);
  return { ogrinfo, ogr2ogr, version, qgisDistribution: 'QGIS 3.44.11', geometryEngine: 'GEOS through GDAL/OGR SQLite dialect', projectionEngine: 'PROJ through GDAL/OGR' };
}

export const GEOMETRY_SQL = `SELECT GEOID, NAME, LSAD, CLASSFP, INTPTLAT, INTPTLON,
 ST_Area(geom) AS areaSquareMeters, NumGeometries(geom) AS componentCount,
 ST_MinX(ST_Transform(geom,4269)) AS minX, ST_MinY(ST_Transform(geom,4269)) AS minY,
 ST_MaxX(ST_Transform(geom,4269)) AS maxX, ST_MaxY(ST_Transform(geom,4269)) AS maxY,
 ST_X(ST_Transform(Centroid(geom),4269)) AS centroidLon,
 ST_Y(ST_Transform(Centroid(geom),4269)) AS centroidLat,
 CASE WHEN ST_Intersects(geom,Centroid(geom)) THEN 1 ELSE 0 END AS centroidContained,
 ST_X(ST_Transform(PointOnSurface(geom),4269)) AS surfaceLon,
 ST_Y(ST_Transform(PointOnSurface(geom),4269)) AS surfaceLat
 FROM places ORDER BY GEOID`;

export function analyzeWithGdal(archivePath, stack, scratch) {
  const source = `/vsizip/${path.resolve(archivePath).replaceAll('\\', '/')}`;
  const info = run(stack.ogrinfo, ['-ro', '-so', '-al', source]);
  if (!/Feature Count:\s*1863\b/.test(info)) fail('source must contain exactly 1,863 Texas PLACE features');
  for (const field of ['GEOID', 'NAME', 'LSAD', 'CLASSFP', 'INTPTLAT', 'INTPTLON']) if (!new RegExp(`\\b${field}\\b`).test(info)) fail(`source field is absent: ${field}`);
  const epsg = [...info.matchAll(/(?:AUTHORITY|ID)\["EPSG",[" ]*(\d+)/g)].at(-1)?.[1];
  if (epsg !== '4269') fail(`source CRS must be EPSG:4269; found ${epsg || 'unresolved'}`);
  const db = path.join(scratch, 'audit.gpkg');
  run(stack.ogr2ogr, ['-f', 'GPKG', db, source, '-nln', 'places', '-nlt', 'PROMOTE_TO_MULTI', '-t_srs', 'EPSG:3083']);
  const projectedInfo = run(stack.ogrinfo, ['-ro', '-so', db, 'places']);
  const projectedEpsg = [...projectedInfo.matchAll(/(?:AUTHORITY|ID)\["EPSG",[" ]*(\d+)/g)].at(-1)?.[1];
  if (projectedEpsg !== '3083') fail(`working layer must declare EPSG:3083; found ${projectedEpsg || 'unresolved'}`);
  const invalid = run(stack.ogrinfo, ['-ro', db, '-dialect', 'SQLITE', '-sql', 'SELECT COUNT(*) AS n FROM places WHERE geom IS NULL OR ST_IsEmpty(geom) OR NOT ST_IsValid(geom)']);
  if (!/n \(Integer\) = 0\b/.test(invalid)) fail('source contains null, empty, or invalid geometry; geometry repair is prohibited');
  const output = path.join(scratch, 'analysis.geojson');
  run(stack.ogr2ogr, ['-f', 'GeoJSON', output, db, '-dialect', 'SQLITE', '-sql', GEOMETRY_SQL]);
  return JSON.parse(fs.readFileSync(output, 'utf8')).features.map(feature => feature.properties);
}

export function haversineMeters(a, b) {
  const rad = n => n * Math.PI / 180, radius = 6371008.8;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p, low = Math.floor(index), fraction = index - low;
  return round(sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * fraction, 3);
}
function distanceSummary(rows, key) {
  const values = rows.map(row => row.distancesMeters[key]).sort((a, b) => a - b);
  return { p50: percentile(values, .5), p90: percentile(values, .9), p95: percentile(values, .95), p99: percentile(values, .99), maximum: percentile(values, 1) };
}
function segment(rows) {
  return { count: rows.length, centroidOutsideCount: rows.filter(r => !r.centroid.contained).length, distancesMeters: {
    intptToCentroid: distanceSummary(rows, 'intptToCentroid'), intptToBboxMidpoint: distanceSummary(rows, 'intptToBboxMidpoint'),
    intptToPointOnSurface: distanceSummary(rows, 'intptToPointOnSurface'), centroidToPointOnSurface: distanceSummary(rows, 'centroidToPointOnSurface')
  } };
}
const areaBand = area => area < 2_589_988.110336 ? 'under_1_square_mile' : area < 25_899_881.10336 ? '1_to_under_10_square_miles' : area < 258_998_811.0336 ? '10_to_under_100_square_miles' : '100_plus_square_miles';

function knownFocuses(focusPath) {
  if (!focusPath || !fs.existsSync(focusPath)) return new Map();
  const doc = JSON.parse(fs.readFileSync(focusPath, 'utf8'));
  if (doc.schemaVersion !== 'gridly.statewide-place-presentation.v1' || doc.source?.sha256 !== SOURCE_IDENTITY.sha256) return new Map();
  return new Map(Object.entries(doc.places || {}).map(([geoid, point]) => [geoid, { ...point, lineage: 'gridly.statewide-place-presentation.v1 / governed TIGER2025 INTPTLAT,INTPTLON' }]));
}

export function buildAudit({ rawRows, governance, source = SOURCE_IDENTITY, toolchain, focusPath = DEFAULTS.focus }) {
  const seen = new Set(), sourceGeoids = new Set();
  for (const raw of rawRows) {
    const geoid = String(raw.GEOID || '');
    if (!/^48\d{5}$/.test(geoid)) fail(`invalid source GEOID ${geoid}`);
    if (seen.has(geoid)) fail(`duplicate source GEOID ${geoid}`);
    seen.add(geoid); sourceGeoids.add(geoid);
  }
  const missing = [...governance.eligible.keys()].filter(id => !sourceGeoids.has(id)).sort();
  const unknown = [...sourceGeoids].filter(id => !governance.eligible.has(id) && !governance.excluded.has(id)).sort();
  if (missing.length) fail(`missing eligible GEOIDs: ${missing.join(', ')}`);
  if (unknown.length) fail(`source GEOIDs absent from governance: ${unknown.join(', ')}`);
  const focuses = knownFocuses(focusPath);
  const rows = rawRows.filter(raw => governance.eligible.has(String(raw.GEOID))).map(raw => {
    const geoid = String(raw.GEOID), governed = governance.eligible.get(geoid);
    const numeric = ['INTPTLAT','INTPTLON','areaSquareMeters','minX','minY','maxX','maxY','centroidLat','centroidLon','surfaceLat','surfaceLon'].map(k => Number(raw[k]));
    if (numeric.some(value => !Number.isFinite(value)) || !(Number(raw.areaSquareMeters) > 0) || !(Number(raw.componentCount) >= 1)) fail(`unusable geometry analysis for ${geoid}`);
    const [intptLat,intptLon,area,minX,minY,maxX,maxY,centroidLat,centroidLon,surfaceLat,surfaceLon] = numeric;
    const intpt={lat:intptLat,lon:intptLon}, centroid={lat:centroidLat,lon:centroidLon,contained:Boolean(Number(raw.centroidContained))}, surface={lat:surfaceLat,lon:surfaceLon};
    const bbox={lat:(minY+maxY)/2,lon:(minX+maxX)/2}, candidates={intpt,centroid,pointOnSurface:surface,bboxMidpoint:bbox};
    const distancesMeters={intptToCentroid:haversineMeters(intpt,centroid),intptToBboxMidpoint:haversineMeters(intpt,bbox),intptToPointOnSurface:haversineMeters(intpt,surface),centroidToPointOnSurface:haversineMeters(centroid,surface)};
    Object.keys(distancesMeters).forEach(k => distancesMeters[k]=round(distancesMeters[k],3));
    const focus = focuses.get(geoid);
    const existingPresentationFocus = focus ? { point:{lat:focus.lat,lon:focus.lon}, lineage:focus.lineage, distancesMeters:Object.fromEntries(Object.entries(candidates).map(([k,v]) => [k,round(haversineMeters(focus,v),3)])) } : null;
    return { geoid, name:governed.displayName, governedType:governed.governedType, multiCounty:governed.countyMemberships.length>1, areaSquareMeters:round(area,3), areaBand:areaBand(area), componentCount:Number(raw.componentCount), multipart:Number(raw.componentCount)>1, bounds:{minLon:round(minX),minLat:round(minY),maxLon:round(maxX),maxLat:round(maxY)}, intpt, centroid, pointOnSurface:surface, bboxMidpoint:bbox, distancesMeters, existingPresentationFocus };
  }).sort((a,b)=>a.geoid.localeCompare(b.geoid));
  if (rows.length !== 1859) fail(`matched eligible geometry count must be 1859; found ${rows.length}`);
  const disagreement = row => Math.max(...Object.values(row.distancesMeters));
  const largestCandidateDisagreements = [...rows].sort((a,b)=>disagreement(b)-disagreement(a)||a.geoid.localeCompare(b.geoid)).slice(0,25).map(row=>({geoid:row.geoid,name:row.name,maximumPairDistanceMeters:round(disagreement(row),3),distancesMeters:row.distancesMeters}));
  const by = selector => Object.fromEntries([...Map.groupBy(rows, selector)].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,segment(value)]));
  return { schemaVersion:'gridly.statewide-place-presentation-geometry-audit.v1', auditOnly:true, productionTargetSelected:false, runtimeConsumptionAuthorized:false,
    source:{authority:'United States Census Bureau',dataset:'2025 TIGER/Line Places — Texas',...source,sourceCrs:'EPSG:4269'},
    algorithm:{workingCrs:WORKING_CRS,centroid:'OGC area-weighted polygon Centroid in EPSG:3083, transformed to EPSG:4269',centroidContainment:'ST_Intersects(feature, Centroid(feature)) in EPSG:3083 (inside or boundary)',pointOnSurface:'GEOS PointOnSurface in EPSG:3083, transformed to EPSG:4269',bboxMidpoint:'arithmetic midpoint of source-coordinate polygon bounds',distance:'IUGG mean-Earth-radius haversine; radius 6371008.8 metres',percentile:'linearly interpolated rank (n-1)*p',ordering:'ascending PLACE GEOID; disagreements descending distance then GEOID',toolchain},
    reconciliation:{eligiblePlaceCount:1859,matchedGeometryCount:rows.length,missingGeometryCount:0,duplicateGeometryCount:0,excludedIneligibleSourceCount:governance.excluded.size,excludedIneligibleLeakageCount:0},
    summary:{centroidOutsideCount:rows.filter(r=>!r.centroid.contained).length,multipartPlaceCount:rows.filter(r=>r.multipart).length,statewide:segment(rows),largestCandidateDisagreements,segments:{governedType:by(r=>r.governedType),areaBand:by(r=>r.areaBand),multipartStatus:by(r=>r.multipart?'multipart':'singlepart'),multiCountyStatus:by(r=>r.multiCounty?'multi_county':'single_county')}},
    requiredSixCityDetail:rows.filter(r=>SIX.has(r.geoid)),places:rows };
}

function markdown(report) {
  const s=report.summary, lines=[
    '# Statewide PLACE Presentation Geometry Audit', '',
    'Audit-only evidence. No production target is selected or authorized.', '',
    '## Source and method', '',
    `- Source: \`${report.source.filename}\` (${report.source.bytes} bytes; SHA-256 \`${report.source.sha256}\`).`,
    '- Source CRS: EPSG:4269. Working CRS: EPSG:3083 — NAD83 / Texas Centric Albers Equal Area.',
    `- Toolchain: ${report.algorithm.toolchain.version}; ${report.algorithm.toolchain.qgisDistribution}; GEOS/PROJ through GDAL/OGR.`,
    '- Area-weighted centroid and deterministic GEOS point-on-surface are computed only in EPSG:3083. Distances use the mean-radius haversine documented in JSON.', '',
    '## Reconciliation', '', '| Eligible | Matched | Missing | Duplicate | Excluded leakage |',
    '|---:|---:|---:|---:|---:|', `| 1859 | ${report.reconciliation.matchedGeometryCount} | 0 | 0 | 0 |`, '',
    '## Statewide summary', '', `- Centroids outside their feature: **${s.centroidOutsideCount}**`,
    `- Multipart PLACEs: **${s.multipartPlaceCount}**`, '', '## Required six-city detail', '',
    '| GEOID | Place | Area m² | Parts | Centroid contained | INTPT→centroid m | INTPT→bbox m | INTPT→surface m | Centroid→surface m |',
    '|---|---|---:|---:|---|---:|---:|---:|---:|'
  ];
  for(const r of report.requiredSixCityDetail) lines.push(`| ${r.geoid} | ${r.name} | ${r.areaSquareMeters} | ${r.componentCount} | ${r.centroid.contained} | ${r.distancesMeters.intptToCentroid} | ${r.distancesMeters.intptToBboxMidpoint} | ${r.distancesMeters.intptToPointOnSurface} | ${r.distancesMeters.centroidToPointOnSurface} |`);
  lines.push('','Exact coordinates, bounds, candidate distances, segment statistics, focus comparisons, and all 1,859 records are preserved in the companion JSON.',''); return lines.join('\n');
}
export function serializeReports(report) { return { json:Buffer.from(`${JSON.stringify(report,null,2)}\n`), markdown:Buffer.from(markdown(report)) }; }
function atomicWrite(target, bytes) { fs.mkdirSync(path.dirname(target),{recursive:true}); const stage=`${target}.stage-${process.pid}`; fs.writeFileSync(stage,bytes); fs.renameSync(stage,target); }

export function runAudit({ archivePath, outputJson=DEFAULTS.json, outputMarkdown=DEFAULTS.markdown }={}) {
  const source=validateSource(archivePath), governance=loadGovernance(), stack=verifyGdal();
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-place-geometry-audit-'));
  try {
    const first=path.join(scratch,'run-1'), second=path.join(scratch,'run-2'); fs.mkdirSync(first); fs.mkdirSync(second);
    const report=buildAudit({rawRows:analyzeWithGdal(archivePath,stack,first),governance,source,toolchain:stack});
    const repeated=buildAudit({rawRows:analyzeWithGdal(archivePath,stack,second),governance,source,toolchain:stack});
    const bytes=serializeReports(report), repeatedBytes=serializeReports(repeated);
    if(!bytes.json.equals(repeatedBytes.json)||!bytes.markdown.equals(repeatedBytes.markdown)) fail('two independent geometry runs did not produce byte-identical reports');
    atomicWrite(outputJson,bytes.json); atomicWrite(outputMarkdown,bytes.markdown); return {report,bytes};
  }
  finally { fs.rmSync(scratch,{recursive:true,force:true}); }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{if(process.argv.length!==3)fail('usage: node tools/audit-statewide-place-presentation-geometry.mjs <tl_2025_48_place.zip>'); const result=runAudit({archivePath:path.resolve(process.argv[2])}); process.stdout.write(`Wrote ${DEFAULTS.json} and ${DEFAULTS.markdown} for ${result.report.places.length} eligible PLACEs.\n`);}catch(error){console.error(error.message);process.exitCode=1;}}
