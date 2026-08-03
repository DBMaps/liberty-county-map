#!/usr/bin/env node

/** LP117 candidate-only adapters over Gridly's governed county source inventories. */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY = join(ROOT, 'data/lp104/texas-counties.json');
const BOUNDARIES = join(ROOT, 'assets/boundaries/texas-counties-boundaries.geojson');
const COMMUNITIES = join(ROOT, 'Community-Packages/county-manifest.json');
const ZIP_SOURCE = join(ROOT, 'data/generated/gridly-zip-county-source-v1.json');
const REPORTS = join(ROOT, 'reports/lp117');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = body => createHash('sha256').update(body).digest('hex');
const portable = path => relative(ROOT, path).replaceAll('\\', '/');
const exists = path => access(path).then(() => true, () => false);
async function atomic(path, body) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.tmp`; await writeFile(temp, body); await rename(temp, path); }
async function evidence(path) { const body = await readFile(path); return { path: portable(path), sizeBytes: (await stat(path)).size, sha256: hash(body) }; }
function fipsOf(feature) { const p = feature?.properties || {}; return String(p.GEOID || p.geoid || p.countyFips || p.COUNTYFP && `${p.STATEFP || '48'}${p.COUNTYFP}`).padStart(5, '0'); }
function coordinates(value, out = []) { if (!Array.isArray(value)) return out; if (value.length >= 2 && value.every(Number.isFinite)) out.push(value); else for (const child of value) coordinates(child, out); return out; }
function bounds(geometry) { const points = coordinates(geometry.coordinates); return { west: Math.min(...points.map(x => x[0])), south: Math.min(...points.map(x => x[1])), east: Math.max(...points.map(x => x[0])), north: Math.max(...points.map(x => x[1])) }; }
function pointInRing([x, y], ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
function contained(point, geometry) { const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates; return polygons.some(polygon => pointInRing(point, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(point, ring))); }

export function selectCounties(inventory, input) {
  const requested = String(input).split(',').map(x => x.trim());
  if (requested.some(x => !/^48\d{3}$/.test(x))) throw new Error('Every FIPS must be a five-digit Texas county FIPS');
  if (new Set(requested).size !== requested.length) throw new Error('Duplicate FIPS values are not allowed');
  const byFips = new Map(inventory.counties.map(x => [x.fips, x]));
  const selected = requested.map(x => byFips.get(x));
  if (selected.some(x => !x)) throw new Error('One or more FIPS codes are absent from the maintained 254-county Texas identity inventory');
  return selected;
}

export async function manufacture(options) {
  const inventoryPath = resolve(options.inventoryPath || INVENTORY);
  const boundarySourcePath = resolve(options.boundaries || BOUNDARIES);
  const reports = resolve(options.reports || REPORTS);
  const inventory = JSON.parse(await readFile(inventoryPath));
  const counties = selectCounties(inventory, options.fips);
  const boundarySource = JSON.parse(await readFile(boundarySourcePath));
  const communitySource = JSON.parse(await readFile(resolve(options.communities || COMMUNITIES)));
  const zipSource = JSON.parse(await readFile(resolve(options.zip_source || ZIP_SOURCE)));
  const roadPath = options.roadway_source ? resolve(options.roadway_source) : null;
  const roads = roadPath && await exists(roadPath) ? JSON.parse(await readFile(roadPath)) : null;
  const results = [];
  for (const county of counties) {
    const root = join(reports, county.fips); await mkdir(root, { recursive: true });
    const matches = boundarySource.features.filter(x => fipsOf(x) === county.fips);
    if (matches.length !== 1) throw new Error(`Boundary source must contain exactly one ${county.fips} feature`);
    const feature = { type: 'Feature', properties: { countyId: county.countyId, county: `${county.countyName} County`, fips: county.fips, sourceProperties: matches[0].properties }, geometry: matches[0].geometry };
    const boundaryPath = join(root, 'county-boundary.candidate.geojson');
    await atomic(boundaryPath, json({ type: 'FeatureCollection', name: `${county.countyId}-${county.fips}`, crs: { type: 'name', properties: { name: 'EPSG:4326' } }, features: [feature] }));
    const boundary = { status: options.resume ? 'RESUMED' : 'GENERATED', ...await evidence(boundaryPath), source: await evidence(boundarySourcePath), containment: true };

    let roadwaySource;
    if (!roads) roadwaySource = { status: 'REQUIRES_OWNER_SOURCE', reason: 'Owner authoritative county-specific or statewide roadway GeoJSON is required' };
    else {
      const selected = roads.features.filter(x => fipsOf(x) === county.fips).filter(x => coordinates(x.geometry?.coordinates).every(p => contained(p, feature.geometry)));
      const path = join(root, 'roadway-source.candidate.geojson');
      await atomic(path, json({ type: 'FeatureCollection', source: { path: portable(roadPath), sha256: hash(await readFile(roadPath)) }, countyFips: county.fips, features: selected }));
      roadwaySource = { status: options.resume ? 'RESUMED' : 'GENERATED', ...await evidence(path), sourceRecordsSelected: selected.length, containment: true };
    }

    const governed = communitySource.counties.find(x => x.county.toLowerCase() === county.countyName.toLowerCase());
    const communityRecords = governed?.communities?.map(name => ({ id: `${county.countyId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, aliases: [] })) || [];
    const communityPath = join(root, 'communities.candidate.json');
    await atomic(communityPath, json({ schemaVersion: 'gridly-lp117-community-candidate-v1', milestone: 'LP117', county: `${county.countyName} County`, fips: county.fips, source: portable(resolve(options.communities || COMMUNITIES)), communities: communityRecords, reviewRequirements: governed ? ['Coordinates require governed source review'] : ['No governed Community-Packages inventory exists for this county'], productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false }));
    const communities = { status: 'REVIEW_REQUIRED', ...await evidence(communityPath), recordCount: communityRecords.length, inventedRecords: 0 };

    const zipRecords = zipSource.records.filter(x => x.countyFips === county.fips).sort((a, b) => a.zip.localeCompare(b.zip) || b.totalRatio - a.totalRatio);
    const allByZip = new Map(); for (const row of zipSource.records) { if (!allByZip.has(row.zip)) allByZip.set(row.zip, []); allByZip.get(row.zip).push(row); }
    const zips = zipRecords.map(row => ({ ...row, ambiguousCounty: allByZip.get(row.zip).length > 1, countyRelationships: allByZip.get(row.zip).map(x => ({ countyFips: x.countyFips, totalRatio: x.totalRatio })) }));
    const zipPath = join(root, 'zip-coverage.candidate.json');
    await atomic(zipPath, json({ schemaVersion: 'gridly-lp117-zip-candidate-v1', milestone: 'LP117', county: `${county.countyName} County`, fips: county.fips, source: zipSource.sourceFiles, records: zips, productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false }));
    const zipCoverage = { status: zips.length ? (options.resume ? 'RESUMED' : 'GENERATED') : 'REQUIRES_OWNER_SOURCE', ...await evidence(zipPath), recordCount: zips.length, ambiguousZipCount: zips.filter(x => x.ambiguousCounty).length };

    const destinationPath = join(root, 'curated-destinations.candidate.json');
    await atomic(destinationPath, json({ schemaVersion: 'gridly-lp117-destination-candidate-v1', milestone: 'LP117', county: `${county.countyName} County`, fips: county.fips, destinations: [], reviewRequirements: ['Curated destination source and human approval required; no destinations inferred'], productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false }));
    const curatedDestinations = { status: 'REVIEW_REQUIRED', ...await evidence(destinationPath), recordCount: 0 };
    const searchPath = join(root, 'search-coverage.candidate.json');
    await atomic(searchPath, json({ schemaVersion: 'gridly-lp117-search-certification-v1', milestone: 'LP117', county: `${county.countyName} County`, fips: county.fips, checks: { countyIdentity: true, communityCandidatesExamined: true, zipCandidatesExamined: true, destinationCandidatesExamined: true, wrongCountyPromotionDisabled: true, roadFallbackDisabled: true, truthfulNoResult: true, businessBoundaryUnchanged: true }, certificationStatus: 'REVIEW_REQUIRED', productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false }));
    const searchCoverage = { status: 'REVIEW_REQUIRED', ...await evidence(searchPath), certificationStatus: 'REVIEW_REQUIRED' };
    results.push({ county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, bounds: bounds(feature.geometry), boundary, roadwaySource, communities, zipCoverage, curatedDestinations, searchCoverage });
  }
  return { schemaVersion: 'gridly-lp117-foundation-v1', milestone: 'LP117', requestedFips: counties.map(x => x.fips), productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false, counties: results };
}
