#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geometrySourceState, readTigerPlaceGeometry, resolveOgr2ogr, shapefileParts } from './tiger-place-geometry-reader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv.includes('--write') ? 'write' : 'verify';
const rel = value => path.relative(root, value).replaceAll(path.sep, '/');
const bytes = value => fs.readFileSync(value);
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const sha256 = value => sha(bytes(value));
const json = value => JSON.parse(bytes(value).toString('utf8').replace(/^\uFEFF/, ''));
const fileAudit = value => value && fs.existsSync(value) ? { path: rel(value), sizeBytes: fs.statSync(value).size, sha256: sha256(value) } : null;

const sourceRoots = [...new Set([process.env.GRIDLY_SOURCE_DATA_ROOT, 'C:\\GitHub\\Gridly-Source-Data', path.join(root, 'Gridly-Source-Data')].filter(Boolean).map(value => path.resolve(value)))];
const sourceRoot = sourceRoots.find(value => fs.existsSync(value)) ?? null;
const placeRoot = sourceRoot && path.join(sourceRoot, 'Census', 'TIGER2025', 'PLACE');
const archive = placeRoot && path.join(placeRoot, 'original', 'tl_2025_48_place.zip');
const shape = placeRoot && path.join(placeRoot, 'derived', 'tl_2025_48_place.shp');
const crossingCandidates = [sourceRoot && path.join(sourceRoot, 'Crossing-Packages', 'Texas', 'fra-crossings-tx.geojson'), sourceRoot && path.join(sourceRoot, 'FRA', 'Processed', 'fra-crossings-tx.geojson'), path.join(root, 'Crossing-Packages', 'Texas', 'fra-crossings-tx.geojson')].filter(Boolean);
const crossing = crossingCandidates.find(fs.existsSync);
if (!crossing) throw new Error('No governed statewide crossing authority is accessible');

function onSegment(point, a, b) {
  const cross = (point[1] - a[1]) * (b[0] - a[0]) - (point[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(cross) > 1e-11) return false;
  return point[0] >= Math.min(a[0], b[0]) - 1e-11 && point[0] <= Math.max(a[0], b[0]) + 1e-11 && point[1] >= Math.min(a[1], b[1]) - 1e-11 && point[1] <= Math.max(a[1], b[1]) + 1e-11;
}
function ringLocation(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (onSegment(point, ring[j], ring[i])) return 'BOUNDARY';
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? 'INTERIOR' : 'EXTERIOR';
}
function polygonCovers(point, polygon) {
  const outer = ringLocation(point, polygon[0]);
  if (outer === 'EXTERIOR') return false;
  for (const hole of polygon.slice(1)) {
    const location = ringLocation(point, hole);
    if (location === 'BOUNDARY') return true;
    if (location === 'INTERIOR') return false;
  }
  return true;
}
function geometryCovers(point, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => polygonCovers(point, polygon));
}

const ogr = resolveOgr2ogr();
const sourceState = geometrySourceState(shape, Boolean(ogr));
const crossingData = json(crossing);
const crossingFeatures = crossingData.features ?? [];
const projection = json(path.join(root, 'data/generated/gridly-statewide-consumer-community-projection-v1.json'));
const canonicalByGeoid = new Map(projection.communities.map(community => [community.placeGeoid, community]));
let places = [], reader = null;
if (sourceState === 'PRESENT_READER_AVAILABLE') ({ features: places, reader } = readTigerPlaceGeometry(shape, { ogr }));

const geometryGeoids = places.map(place => place.GEOID);
const geometryPlacefps = places.map(place => place.PLACEFP);
const duplicateGeoids = geometryGeoids.filter((value, index) => geometryGeoids.indexOf(value) !== index);
const duplicatePlacefps = geometryPlacefps.filter((value, index) => geometryPlacefps.indexOf(value) !== index);
const missingCanonical = places.length ? [...canonicalByGeoid.keys()].filter(geoid => !geometryGeoids.includes(geoid)).sort() : [];
const extraGeometry = geometryGeoids.filter(geoid => !canonicalByGeoid.has(geoid)).sort();
const certificationPass = Boolean(archive && fs.existsSync(archive)) && places.length > 0 && duplicateGeoids.length === 0 && duplicatePlacefps.length === 0 && missingCanonical.length === 0 && extraGeometry.length === 0 && places.every(place => place.valid && !place.empty);

const memberships = [], ambiguous = [], unattributed = [], identityUnavailable = [];
if (certificationPass) for (const feature of crossingFeatures) {
  const stableId = String(feature.properties?.CROSSING ?? feature.id ?? '');
  const coordinates = feature.geometry?.coordinates;
  if (!stableId || feature.geometry?.type !== 'Point' || !coordinates?.slice(0, 2).every(Number.isFinite)) { identityUnavailable.push(stableId || null); continue; }
  const candidates = places.filter(place => coordinates[0] >= place.bbox[0] && coordinates[0] <= place.bbox[2] && coordinates[1] >= place.bbox[1] && coordinates[1] <= place.bbox[3] && geometryCovers(coordinates, place.geometry));
  if (candidates.length === 0) unattributed.push(stableId);
  else if (candidates.length > 1) ambiguous.push({ crossingId: stableId, placeGeoids: candidates.map(place => place.GEOID).sort() });
  else memberships.push({ crossingId: stableId, placeGeoid: candidates[0].GEOID, canonicalKey: `place-${candidates[0].GEOID}`, sourceCountyFips: String(feature.properties?.STCYFIPS ?? feature.properties?.CountyCode ?? ''), sourceCountyName: String(feature.properties?.COUNTYNAME ?? '') });
}
memberships.sort((a, b) => a.crossingId.localeCompare(b.crossingId));
ambiguous.sort((a, b) => a.crossingId.localeCompare(b.crossingId)); unattributed.sort(); identityUnavailable.sort();
const uniqueCrossingCount = new Set(crossingFeatures.map(feature => String(feature.properties?.CROSSING ?? feature.id))).size;
const crossingIdentityPass = certificationPass && uniqueCrossingCount === crossingFeatures.length && identityUnavailable.length === 0;
const countsByGeoid = Map.groupBy(memberships, row => row.placeGeoid);
const controls = ['Katy', 'Corpus Christi', 'Austin', 'Abilene', 'Midland', 'Sulphur Springs', 'Liberty', 'Fredericksburg', 'Town of Pecos'].map(name => {
  const canonical = projection.communities.find(value => value.displayName === name);
  const rows = countsByGeoid.get(canonical?.placeGeoid) ?? [];
  return { name: name === 'Town of Pecos' ? 'Pecos' : name, placeGeoid: canonical?.placeGeoid ?? null, crossingCount: certificationPass ? rows.length : null, bySourceCounty: certificationPass ? Object.fromEntries([...Map.groupBy(rows, row => row.sourceCountyName).entries()].sort().map(([county, values]) => [county, values.length])) : null };
});

const artifact = { schemaVersion: 'gridly.lp232.crossing-place-membership.v1', source: { tigerPlaceArchiveSha256: archive && fs.existsSync(archive) ? sha256(archive) : null, tigerPlaceShapefileSha256: shape && fs.existsSync(shape) ? sha256(shape) : null, fraCrossingsSha256: sha256(crossing) }, predicate: 'boundary-inclusive covers', memberships, ambiguous, unattributedCrossingIds: unattributed, identityUnavailableCrossingIds: identityUnavailable };
const artifactOutput = `${JSON.stringify(artifact, null, 2)}\n`;
const artifactPath = path.join(root, 'reports/lp232/crossing-place-memberships.json');
const finding = sourceState === 'NOT_PRESENT' ? 'NOT_PRESENT' : sourceState === 'PRESENT_READER_AVAILABLE' && certificationPass ? 'CERTIFIED' : sourceState === 'PRESENT_READER_AVAILABLE' ? 'PRESENT_REQUIRES_RECONCILIATION' : sourceState;
const parts = shape ? shapefileParts(shape) : {};
const prj = parts.prj && fs.existsSync(parts.prj) ? bytes(parts.prj).toString('utf8').trim() : null;
const report = {
  schemaVersion: 'gridly.lp232.crossing-place-attribution-certification.v2', generatedAt: '1970-01-01T00:00:00.000Z',
  finalClassification: crossingIdentityPass ? 'B. NEW_OFFLINE_CROSSING_PLACE_ATTRIBUTION_CERTIFIED' : certificationPass ? 'D. CROSSING_IDENTITY_REQUIRES_RECONCILIATION' : finding === 'PRESENT_REQUIRES_RECONCILIATION' ? 'C. SOURCE_GEOMETRY_REQUIRES_RECONCILIATION' : 'E. INSUFFICIENT_EVIDENCE', scope: 'OFFLINE_AUTHORITY_CERTIFICATION_ONLY_NO_PRODUCTION_ACTIVATION',
  sourceWorkspace: { configuredCandidates: sourceRoots.map(rel), resolvedPath: sourceRoot ? rel(sourceRoot) : null },
  geometryAuthority: { archive: fileAudit(archive), shapefile: fileAudit(shape), companionFiles: ['dbf', 'shx', 'prj'].map(extension => fileAudit(parts[extension])), sourceState, finding, reader, crs: { sourcePrj: prj, conversionOutput: reader ? 'OGC:CRS84 (RFC 7946)' : null }, featureCount: places.length || null, polygonCount: places.length ? places.filter(place => place.geometryType === 'Polygon').length : null, multiPolygonCount: places.length ? places.filter(place => place.geometryType === 'MultiPolygon').length : null, invalidGeometryCount: places.length ? places.filter(place => !place.valid).length : null, emptyGeometryCount: places.length ? places.filter(place => place.empty).length : null, interiorRingCount: places.length ? places.reduce((sum, place) => sum + (place.geometryType === 'Polygon' ? place.geometry.coordinates.length - 1 : place.geometry.coordinates.reduce((n, polygon) => n + polygon.length - 1, 0)), 0) : null, interiorRingsPreserved: places.length ? true : null, geoidUnique: places.length ? duplicateGeoids.length === 0 : null, placefpUniqueWithinTexas: places.length ? duplicatePlacefps.length === 0 : null, repairPerformed: false },
  identityReconciliation: { canonicalCommunities: canonicalByGeoid.size, exactGeoidMatches: places.length ? geometryGeoids.filter(geoid => canonicalByGeoid.has(geoid)).length : null, missingCanonicalGeoids: places.length ? missingCanonical : null, extraGeometryGeoids: places.length ? extraGeometry : null, pass: places.length ? certificationPass : null },
  crossingAuthority: { ...fileAudit(crossing), totalCrossingRecords: crossingFeatures.length, uniqueStableCrossingIds: uniqueCrossingCount, identityPass: certificationPass ? crossingIdentityPass : null },
  canonicalBaseline: { canonicalCommunities: 1859, governedMemberships: 2058, multiCountyIdentities: 163, counties: 254 },
  attribution: { artifactProduced: certificationPass, artifactPath: certificationPass ? rel(artifactPath) : null, artifactBytes: certificationPass ? Buffer.byteLength(artifactOutput) : null, artifactSha256: certificationPass ? sha(Buffer.from(artifactOutput)) : null, crossingsAttributedToCanonicalPlace: certificationPass ? memberships.length : null, crossingsOutsideAnyCanonicalPlace: certificationPass ? unattributed.length : null, crossingsWithMultiplePlaceMatches: certificationPass ? ambiguous.length : null, crossingsWithIdentityUnavailable: certificationPass ? identityUnavailable.length : null, controls },
  contract: { externalDownloadAllowed: false, stableGeoidJoinRequired: true, nameOnlyJoinAllowed: false, predicate: 'covers (interior and boundary), with multiple matches classified ambiguous', nearestPlaceAllowed: false, presentationRadiusAllowed: false, countyUnionAllowed: false, sourceCountyLineageRequired: true },
  safety: { productionCrossingChanged: false, driveTexasChanged: false, weatherChanged: false, localHazardChanged: false, alertsChanged: false, kbygChanged: false, multiCountyGovernanceChanged: false, unrelatedProductionChanged: false },
};
const reportOutput = `${JSON.stringify(report, null, 2)}\n`, reportPath = path.join(root, 'reports/lp232/statewide-crossing-place-attribution-certification.json');
if (mode === 'write') { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, reportOutput); if (certificationPass) fs.writeFileSync(artifactPath, artifactOutput); else fs.rmSync(artifactPath, { force: true }); }
else { if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, 'utf8') !== reportOutput) throw new Error('LP232 report is missing or stale; run npm run build:lp232'); if (certificationPass && (!fs.existsSync(artifactPath) || fs.readFileSync(artifactPath, 'utf8') !== artifactOutput)) throw new Error('LP232 attribution artifact is missing or stale; run npm run build:lp232'); }
console.log(`LP232 ${mode} PASS: ${report.finalClassification}; ${crossingFeatures.length} crossings inspected; geometry ${finding}`);
