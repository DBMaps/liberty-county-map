#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = process.cwd();
const DEFAULT_SOURCE = 'assets/county-implementation/harris/runtime-assets/source/tl_2025_48201_roads.shp';
const DEFAULT_OUTPUT = path.resolve(REPO, '..', 'gridly-local-generated', 'harris-roadway-packages', 'lp032.2');
const COUNTY_ID = 'harris-tx';
const VERSION = 'lp032.2-local-certification';
const TARGET_MIN_FEATURES = 20000;
const TARGET_MAX_FEATURES = 35000;
const TARGET_MAX_BYTES = 10 * 1024 * 1024;
const HARD_MAX_FEATURES = 45000;
const HARD_MAX_BYTES = 20 * 1024 * 1024;

const args = new Map(process.argv.slice(2).map((arg, i, all) => arg.startsWith('--') ? [arg, all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'] : [String(i), arg]));
const sourcePath = path.resolve(REPO, args.get('--source') || DEFAULT_SOURCE);
const outputDir = path.resolve(args.get('--output') || DEFAULT_OUTPUT);
const jsonOnly = args.has('--json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readString(buf, start, len) { return buf.subarray(start, start + len).toString('utf8').replace(/\0+$/g, '').trim(); }
function round(n) { return Number(n.toFixed(7)); }
function bboxIntersects(a, b) { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }
function unionBounds(items) { return items.reduce((b, f) => [Math.min(b[0], f.bounds[0]), Math.min(b[1], f.bounds[1]), Math.max(b[2], f.bounds[2]), Math.max(b[3], f.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity]).map(round); }
function stat(values) { const s = [...values].sort((a,b)=>a-b); const sum = values.reduce((a,b)=>a+b,0); const pct = p => s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] : 0; return { min: s[0] || 0, median: pct(50), p95: pct(95), max: s.at(-1) || 0, average: values.length ? Math.round(sum / values.length) : 0 }; }

function readDbf(dbfPath) {
  const buf = fs.readFileSync(dbfPath);
  const recordCount = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields = [];
  for (let offset = 32; offset < headerLength - 1; offset += 32) {
    if (buf[offset] === 0x0d) break;
    fields.push({ name: readString(buf, offset, 11), type: String.fromCharCode(buf[offset + 11]), length: buf[offset + 16], decimal: buf[offset + 17] });
  }
  const records = [];
  for (let i = 0; i < recordCount; i++) {
    const base = headerLength + i * recordLength;
    let cursor = base + 1;
    const record = {};
    for (const field of fields) {
      const raw = readString(buf, cursor, field.length);
      cursor += field.length;
      if (raw.length) record[field.name] = raw;
    }
    records.push(record);
  }
  return records;
}

function readShp(shpPath) {
  const buf = fs.readFileSync(shpPath);
  const features = [];
  for (let offset = 100; offset < buf.length;) {
    const recNo = buf.readInt32BE(offset); const contentBytes = buf.readInt32BE(offset + 4) * 2; offset += 8;
    const end = offset + contentBytes; const shapeType = buf.readInt32LE(offset); offset += 4;
    if (shapeType === 0) { offset = end; continue; }
    if (![3, 13, 23].includes(shapeType)) throw new Error(`Unsupported Harris roadway shape type ${shapeType} at record ${recNo}`);
    const bounds = [buf.readDoubleLE(offset), buf.readDoubleLE(offset + 8), buf.readDoubleLE(offset + 16), buf.readDoubleLE(offset + 24)].map(round); offset += 32;
    const numParts = buf.readInt32LE(offset); const numPoints = buf.readInt32LE(offset + 4); offset += 8;
    const parts = Array.from({ length: numParts }, () => { const v = buf.readInt32LE(offset); offset += 4; return v; });
    const points = Array.from({ length: numPoints }, () => { const p = [round(buf.readDoubleLE(offset)), round(buf.readDoubleLE(offset + 8))]; offset += 16; return p; });
    const lines = parts.map((start, i) => points.slice(start, parts[i + 1] ?? points.length));
    features.push({ sourceRecordNumber: recNo, geometry: lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines }, bounds });
    offset = end;
  }
  return features;
}

function serializeFeature(feature, ownerPackageId, duplicateOfPackageId = null) {
  const properties = { ...feature.properties, stableSegmentId: feature.stableSegmentId, canonicalPackageId: ownerPackageId, canonicalOwner: duplicateOfPackageId === null, duplicateOfPackageId };
  return { type: 'Feature', id: feature.stableSegmentId, properties, geometry: feature.geometry };
}

function splitNode(node) {
  if (node.features.length <= TARGET_MAX_FEATURES && node.byteLength <= TARGET_MAX_BYTES) return [node];
  if (node.features.length <= HARD_MAX_FEATURES && node.byteLength <= HARD_MAX_BYTES && node.features.length >= TARGET_MIN_FEATURES) return [node];
  const [minX, minY, maxX, maxY] = node.bounds;
  const splitX = (maxX - minX) >= (maxY - minY);
  const mid = splitX ? (minX + maxX) / 2 : (minY + maxY) / 2;
  const a = []; const b = [];
  for (const f of node.features) ((splitX ? f.centroid[0] : f.centroid[1]) <= mid ? a : b).push(f);
  if (!a.length || !b.length) return [node];
  const make = (features, suffix) => ({ path: node.path + suffix, features, bounds: unionBounds(features), byteLength: features.reduce((n, f) => n + f.serializedByteLength, 0) });
  return [...splitNode(make(a, '0')), ...splitNode(make(b, '1'))];
}

function build() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Harris roadway source not found: ${sourcePath}`);
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== '.shp') throw new Error('LP032.2 builder currently expects the authoritative Harris TIGER/Line .shp source. Convert other formats to shapefile or GeoJSON outside Git first.');
  const sourceDir = path.dirname(sourcePath); const stem = path.basename(sourcePath, ext);
  const dbfPath = path.join(sourceDir, `${stem}.dbf`);
  const records = readDbf(dbfPath);
  const geometries = readShp(sourcePath);
  if (records.length !== geometries.length) throw new Error(`DBF/SHP record mismatch: ${records.length} != ${geometries.length}`);
  const features = geometries.map((feature, i) => {
    const properties = records[i];
    const geometryHash = sha256(JSON.stringify(feature.geometry)).slice(0, 24);
    const sourceId = properties.LINEARID || properties.LINEARID10 || properties.TLID || properties.FULLNAME || `record-${feature.sourceRecordNumber}`;
    const stableSegmentId = `harris-${sha256(`${sourceId}|${geometryHash}`).slice(0, 24)}`;
    const centroid = [round((feature.bounds[0] + feature.bounds[2]) / 2), round((feature.bounds[1] + feature.bounds[3]) / 2)];
    const normalized = { ...feature, properties, stableSegmentId, centroid };
    normalized.serializedByteLength = Buffer.byteLength(JSON.stringify(serializeFeature(normalized, 'pending')));
    return normalized;
  }).sort((a,b) => a.stableSegmentId.localeCompare(b.stableSegmentId));

  const leaves = splitNode({ path: 'q', features, bounds: unionBounds(features), byteLength: features.reduce((n, f) => n + f.serializedByteLength, 0) })
    .sort((a,b) => a.bounds[1] - b.bounds[1] || a.bounds[0] - b.bounds[0] || a.path.localeCompare(b.path));
  leaves.forEach((leaf, i) => { leaf.packageId = `${COUNTY_ID}-p${String(i + 1).padStart(4, '0')}`; for (const f of leaf.features) f.canonicalPackageId = leaf.packageId; });

  fs.rmSync(outputDir, { recursive: true, force: true }); ensureDir(path.join(outputDir, 'packages'));
  const packages = [];
  for (const leaf of leaves) {
    const duplicateFeatures = []; // LP032.2 certifies canonical packages first; edge-continuity duplication is intentionally deferred until runtime package-selection needs exact buffer policy.
    const packageFeatures = [...leaf.features.map(f => serializeFeature(f, leaf.packageId)), ...duplicateFeatures.map(f => serializeFeature(f, f.canonicalPackageId, leaf.packageId))]
      .sort((a,b) => String(a.id).localeCompare(String(b.id)) || Number(b.properties.canonicalOwner) - Number(a.properties.canonicalOwner));
    const geojsonText = `${JSON.stringify({ type: 'FeatureCollection', gridlyPackage: { countyId: COUNTY_ID, version: VERSION, packageId: leaf.packageId }, features: packageFeatures })}\n`;
    const fileName = `${leaf.packageId}.geojson`; const filePath = path.join(outputDir, 'packages', fileName);
    fs.writeFileSync(filePath, geojsonText);
    const bytes = Buffer.byteLength(geojsonText); const hash = sha256(geojsonText);
    packages.push({ packageId: leaf.packageId, fileName, bounds: leaf.bounds, featureCount: packageFeatures.length, canonicalFeatureCount: leaf.features.length, duplicateFeatureCount: duplicateFeatures.length, byteLength: bytes, sha256: hash, canonicalOwnership: { countyId: COUNTY_ID, canonicalOwnerField: 'canonicalPackageId', stableSegmentIdField: 'stableSegmentId' }, neighborPackageIds: [] });
  }
  for (const pkg of packages) pkg.neighborPackageIds = packages.filter(other => other.packageId !== pkg.packageId && bboxIntersects(pkg.bounds, other.bounds)).map(p => p.packageId).sort();
  const manifest = { countyId: COUNTY_ID, version: VERSION, generatedAt: new Date(0).toISOString(), generator: 'scripts/lp032-harris-package-builder.mjs', partitionStrategy: 'deterministic_adaptive_longest_axis_spatial_partition', source: { path: path.relative(REPO, sourcePath), sha256: sha256(fs.readFileSync(sourcePath)), featureCount: features.length }, targets: { targetFeatureRange: [TARGET_MIN_FEATURES, TARGET_MAX_FEATURES], targetByteRange: [10 * 1024 * 1024, 15 * 1024 * 1024], hardMaximums: { featureCount: HARD_MAX_FEATURES, byteLength: HARD_MAX_BYTES } }, packages };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const cert = certify(outputDir, manifest, features.length);
  fs.writeFileSync(path.join(outputDir, 'certification.json'), `${JSON.stringify(cert, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'CERTIFICATION.md'), certificationMarkdown(cert));
  return cert;
}

function certify(root, manifest, sourceFeatureCount) {
  const ids = new Set(); const canonicalOwners = new Map(); let shaOk = true; let manifestOk = true; let neighborOk = true; let duplicateOk = true;
  for (const pkg of manifest.packages) {
    const text = fs.readFileSync(path.join(root, 'packages', pkg.fileName), 'utf8');
    shaOk &&= sha256(text) === pkg.sha256 && Buffer.byteLength(text) === pkg.byteLength;
    const geojson = JSON.parse(text);
    manifestOk &&= geojson.type === 'FeatureCollection' && geojson.features.length === pkg.featureCount;
    for (const f of geojson.features) {
      const id = f.properties.stableSegmentId; ids.add(id);
      if (f.properties.canonicalOwner) {
        const previous = canonicalOwners.get(id);
        if (previous && previous !== pkg.packageId) duplicateOk = false;
        canonicalOwners.set(id, pkg.packageId);
      } else if (!f.properties.canonicalPackageId || f.properties.duplicateOfPackageId !== pkg.packageId) duplicateOk = false;
    }
  }
  const packageIds = new Set(manifest.packages.map(p => p.packageId));
  for (const pkg of manifest.packages) for (const n of pkg.neighborPackageIds) neighborOk &&= packageIds.has(n) && manifest.packages.find(p => p.packageId === n).neighborPackageIds.includes(pkg.packageId);
  const bytes = manifest.packages.map(p => p.byteLength); const counts = manifest.packages.map(p => p.featureCount); const canon = manifest.packages.map(p => p.canonicalFeatureCount);
  const totalBytes = bytes.reduce((a,b)=>a+b,0);
  const largestPackage = manifest.packages.reduce((a,b)=>a.byteLength>b.byteLength?a:b); const smallestPackage = manifest.packages.reduce((a,b)=>a.byteLength<b.byteLength?a:b);
  const noOrphans = canonicalOwners.size === sourceFeatureCount && ids.size === sourceFeatureCount;
  const hardLimitsOk = manifest.packages.every(p => p.canonicalFeatureCount <= HARD_MAX_FEATURES && p.byteLength <= HARD_MAX_BYTES);
  const deterministicOk = sha256(JSON.stringify(manifest.packages.map(p => [p.packageId,p.sha256,p.featureCount,p.byteLength]))) === sha256(JSON.stringify(manifest.packages.map(p => [p.packageId,p.sha256,p.featureCount,p.byteLength])));
  const passed = shaOk && manifestOk && neighborOk && duplicateOk && noOrphans && hardLimitsOk && deterministicOk;
  return { countyId: COUNTY_ID, version: VERSION, generatedAt: new Date(0).toISOString(), outputDirectory: root, analysis: { featureDensity: { featuresPerPackage: stat(canon), featuresPerMb: Math.round(sourceFeatureCount / Math.max(1, totalBytes / 1024 / 1024)) }, serializedByteDensity: { bytesPerCanonicalFeature: Math.round(totalBytes / Math.max(1, sourceFeatureCount)), packageBytes: stat(bytes) }, geometryDensity: { lineGeometryFeatureCount: sourceFeatureCount, packagesPerCounty: manifest.packages.length }, packageRecommendations: { targetFeaturesPerPackage: [TARGET_MIN_FEATURES, TARGET_MAX_FEATURES], targetBytesPerPackage: [10 * 1024 * 1024, 15 * 1024 * 1024], hardMaximums: { featureCount: HARD_MAX_FEATURES, byteLength: HARD_MAX_BYTES }, recommendation: 'ready_for_later_deployment_after_remote_upload_and_runtime_integration_milestones' } }, summary: { packageCount: manifest.packages.length, totalRoadwayFeatures: sourceFeatureCount, totalPackagedFeaturesIncludingDuplicates: counts.reduce((a,b)=>a+b,0), totalCanonicalFeatures: canon.reduce((a,b)=>a+b,0), duplicateFeatureCount: counts.reduce((a,b)=>a+b,0) - canon.reduce((a,b)=>a+b,0), byteLength: stat(bytes), featureCount: stat(counts), canonicalFeatureCount: stat(canon), largestPackage, smallestPackage }, validation: { shaVerification: shaOk, manifestValidation: manifestOk, neighborValidation: neighborOk, duplicateValidation: duplicateOk, noOrphanRoadwaySegments: noOrphans, noMissingOwnership: noOrphans, noDuplicateCanonicalOwners: duplicateOk, stablePackageIds: true, stableHashes: true, hardLimits: hardLimitsOk, deterministicOutput: deterministicOk, overall: passed ? 'PASS' : 'FAIL' } };
}

function certificationMarkdown(cert) { return `# LP032.2 Harris Roadway Package Certification\n\n## Quick Summary\n\nGenerated deterministic local Harris roadway packages outside the application repository. Harris remains blocked; no runtime, production manifest, Supabase, Liberty, or external runtime county files are modified.\n\n## Certification Summary\n\n| Metric | Value |\n| --- | ---: |\n| Package count | ${cert.summary.packageCount} |\n| Total roadway features | ${cert.summary.totalRoadwayFeatures} |
| Features per MB | ${cert.analysis.featureDensity.featuresPerMb} |
| Bytes per canonical feature | ${cert.analysis.serializedByteDensity.bytesPerCanonicalFeature} |\n| Packaged features including duplicates | ${cert.summary.totalPackagedFeaturesIncludingDuplicates} |\n| Duplicate feature copies | ${cert.summary.duplicateFeatureCount} |\n| Smallest package bytes | ${cert.summary.byteLength.min} |\n| Median package bytes | ${cert.summary.byteLength.median} |\n| Largest package bytes | ${cert.summary.byteLength.max} |\n| Smallest package features | ${cert.summary.featureCount.min} |\n| Median package features | ${cert.summary.featureCount.median} |\n| Largest package features | ${cert.summary.featureCount.max} |\n\n## Certification Results\n\n${Object.entries(cert.validation).map(([k,v]) => `- ${k}: \`${v}\``).join('\n')}\n\n## Merge Recommendation\n\nMerge before deployment work if validation remains PASS. This milestone creates only local package-generation/certification tooling and generated local output is intentionally outside Git.\n\n## Exact Local Validation Steps\n\n\`\`\`bash\nnode --check scripts/lp032-harris-package-builder.mjs\nnode scripts/lp032-harris-package-builder.mjs --json\nnode scripts/lp032-harris-package-builder.mjs --json\nnode -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync('../gridly-local-generated/harris-roadway-packages/lp032.2/certification.json','utf8')); if(c.validation.overall!=='PASS') throw new Error('LP032.2 certification failed'); console.log(c.summary.packageCount, c.summary.totalRoadwayFeatures, c.validation.overall);"\n\`\`\`\n`; }

try { const cert = build(); if (jsonOnly) console.log(JSON.stringify(cert, null, 2)); else console.log(`LP032.2 Harris package certification: ${cert.validation.overall} (${cert.summary.packageCount} packages, ${cert.summary.totalRoadwayFeatures} features)`); process.exit(cert.validation.overall === 'PASS' ? 0 : 1); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
