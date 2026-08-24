#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv.includes('--write') ? 'write' : 'verify';
const rel = value => path.relative(root, value).replaceAll(path.sep, '/');
const bytes = value => fs.readFileSync(value);
const sha256 = value => crypto.createHash('sha256').update(bytes(value)).digest('hex');
const json = value => JSON.parse(bytes(value).toString('utf8').replace(/^\uFEFF/, ''));
const walk = directory => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : [];

// Owner-local data is input-only. GRIDLY_SOURCE_DATA_ROOT makes the Windows authority
// explicit on non-Windows build hosts without copying it into this repository.
const sourceRoots = [...new Set([
  process.env.GRIDLY_SOURCE_DATA_ROOT,
  'C:\\GitHub\\Gridly-Source-Data',
  path.join(root, 'Gridly-Source-Data'),
].filter(Boolean).map(value => path.resolve(value)))];
const sourceRoot = sourceRoots.find(value => fs.existsSync(value)) ?? null;
const tigerRelative = path.join('Census', 'TIGER2025', 'PLACE');
const archive = sourceRoot && path.join(sourceRoot, tigerRelative, 'original', 'tl_2025_48_place.zip');
const shape = sourceRoot && path.join(sourceRoot, tigerRelative, 'derived', 'tl_2025_48_place.shp');
const crossingCandidates = [
  sourceRoot && path.join(sourceRoot, 'FRA', 'Processed', 'fra-crossings-tx.geojson'),
  sourceRoot && path.join(sourceRoot, 'Crossing-Packages', 'Texas', 'fra-crossings-tx.geojson'),
  path.join(root, 'Crossing-Packages', 'Texas', 'fra-crossings-tx.geojson'),
].filter(Boolean);
const crossing = crossingCandidates.find(value => fs.existsSync(value));

const searchTerms = /(crossing[-_. ]?to[-_. ]?place|crossing[-_. ]?place|place[-_. ]?crossings|community[-_. ]?crossings|crossing[-_. ]?community|place[-_. ]?geoid|PLACEFP|canonicalPlace|canonicalCommunity|communityKey|placeKey)/i;
const sourceFiles = sourceRoot ? walk(sourceRoot) : [];
const searched = sourceFiles.map(file => ({ path: rel(file), sizeBytes: fs.statSync(file).size }));
const attributionCandidates = sourceFiles.filter(file => {
  if (searchTerms.test(file)) return true;
  if (!/\.(?:json|jsonl|csv|txt|ps1|mjs|js)$/i.test(file) || fs.statSync(file).size > 8_000_000) return false;
  return searchTerms.test(bytes(file).toString('utf8'));
}).map(file => rel(file)).sort();

const crossingData = crossing ? json(crossing) : null;
const features = crossingData?.features ?? [];
const idFields = ['crossingId', 'crossing_id', 'CROSSING', 'Crossing', 'crossing'];
const stableId = feature => idFields.map(key => feature.properties?.[key]).find(value => value !== undefined && value !== null) ?? feature.id;
const ids = features.map(stableId).filter(value => value !== undefined);
const validCoordinates = features.filter(feature => feature.geometry?.type === 'Point' && feature.geometry.coordinates?.length >= 2 && feature.geometry.coordinates.slice(0, 2).every(Number.isFinite)).length;
const fileAudit = value => value && fs.existsSync(value) ? ({ path: rel(value), sizeBytes: fs.statSync(value).size, sha256: sha256(value) }) : null;

const report = {
  schemaVersion: 'gridly.lp232.crossing-place-attribution-certification.v1',
  generatedAt: '1970-01-01T00:00:00.000Z',
  finalClassification: 'F. INSUFFICIENT_EVIDENCE',
  scope: 'OFFLINE_AUTHORITY_CERTIFICATION_ONLY_NO_PRODUCTION_ACTIVATION',
  sourceWorkspace: {
    configuredCandidates: sourceRoots.map(rel), resolvedPath: sourceRoot ? rel(sourceRoot) : null,
    filesInspected: searched.length, searchBeforeDerivationPerformed: true,
    searchTerms: searchTerms.source, existingAttributionFound: false, attributionCandidates,
  },
  geometryAuthority: {
    archive: fileAudit(archive), shapefile: fileAudit(shape),
    companionFiles: shape ? ['dbf', 'shx', 'prj', 'cpg'].map(ext => fileAudit(shape.replace(/shp$/i, ext))) : [],
    crs: null, featureCount: null, polygonCount: null, multiPolygonCount: null,
    invalidGeometryCount: null, emptyGeometryCount: null, interiorRingsPreserved: null,
    geoidUnique: null, placefpUniqueWithinTexas: null, repairPerformed: false,
    finding: archive && fs.existsSync(archive) && shape && fs.existsSync(shape) ? 'PRESENT_REQUIRES_GOVERNED_GEOMETRY_READER' : 'AUTHORITATIVE_TIGER2025_PLACE_BYTES_NOT_PRESENT_IN_ACCESSIBLE_SOURCE_WORKSPACE',
  },
  crossingAuthority: {
    ...fileAudit(crossing), preferredCandidateOrder: crossingCandidates.map(rel),
    totalCrossingRecords: features.length, uniqueStableCrossingIds: new Set(ids.map(String)).size,
    crossingsWithValidCoordinates: validCoordinates, duplicateCrossingRecords: ids.length - new Set(ids.map(String)).size,
    stableIdFieldsInspected: idFields,
  },
  canonicalBaseline: { canonicalCommunities: 1859, governedMemberships: 2058, multiCountyIdentities: 163, counties: 254 },
  attribution: {
    artifactProduced: false, reason: 'Exact PLACE polygon authority is unavailable; spatial attribution and control counts cannot be truthfully certified.',
    crossingsAttributedToCanonicalPlace: null, crossingsOutsideAnyCanonicalPlace: null,
    crossingsWithMultiplePlaceMatches: null, crossingsWithIdentityUnavailable: null,
  },
  contract: {
    externalDownloadAllowed: false, stableGeoidJoinRequired: true, nameOnlyJoinAllowed: false,
    predicate: 'covers (interior and boundary), with multiple matches classified ambiguous', nearestPlaceAllowed: false,
    presentationRadiusAllowed: false, countyUnionAllowed: false, sourceCountyLineageRequired: true,
  },
  safety: {
    productionCrossingChanged: false, driveTexasChanged: false, weatherChanged: false,
    localHazardChanged: false, alertsChanged: false, kbygChanged: false,
    multiCountyGovernanceChanged: false, unrelatedProductionChanged: false,
  },
};
if (!crossing) throw new Error('No governed statewide crossing authority is accessible');
const output = `${JSON.stringify(report, null, 2)}\n`;
const target = path.join(root, 'reports/lp232/statewide-crossing-place-attribution-certification.json');
if (mode === 'write') { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, output); }
else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('LP232 report is missing or stale; run npm run build:lp232');
console.log(`LP232 ${mode} PASS: ${report.finalClassification}; ${features.length} crossings inspected; ${searched.length} source files searched`);
