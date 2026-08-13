#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_PROJECTION_PATH = path.join(repositoryRoot, 'data/generated/gridly-statewide-consumer-community-projection-v1.json');
export const DEFAULT_OUTPUT_PATH = path.join(repositoryRoot, 'data/generated/gridly-statewide-place-presentation-v1.json');
export const GOVERNED_SOURCE_IDENTITY = Object.freeze({
  sourceFile: 'tl_2025_48_place.zip',
  byteLength: 9782040,
  sha256: '5a0c4d49641f69028ee9f5c343bf09936ec00a378e5e6393115b106bab935e13'
});
const fail = message => { throw new Error(`Statewide PLACE presentation failed closed: ${message}`); };
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function readDbf(bytes) {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.length < 33) fail('DBF is truncated');
  const recordCount = view.readUInt32LE(4);
  const headerLength = view.readUInt16LE(8);
  const recordLength = view.readUInt16LE(10);
  if (headerLength < 33 || recordLength < 2 || headerLength + recordCount * recordLength > view.length) fail('DBF header or record bounds are invalid');
  const fields = [];
  for (let offset = 32; offset + 32 <= headerLength && view[offset] !== 0x0d; offset += 32) {
    const nul = view.indexOf(0, offset);
    fields.push({ name: view.toString('ascii', offset, Math.min(nul < 0 ? offset + 11 : nul, offset + 11)), length: view[offset + 16] });
  }
  const required = ['GEOID', 'INTPTLAT', 'INTPTLON'];
  for (const name of required) if (!fields.some(field => field.name === name)) fail(`DBF field ${name} is missing`);
  const records = [];
  for (let index = 0; index < recordCount; index++) {
    let cursor = headerLength + index * recordLength;
    const deleted = view[cursor++] === 0x2a;
    const row = {};
    for (const field of fields) {
      row[field.name] = view.toString('ascii', cursor, cursor + field.length).trim();
      cursor += field.length;
    }
    if (!deleted) records.push(row);
  }
  return records;
}

function parseProjection(projectionPath) {
  let projection;
  try { projection = JSON.parse(fs.readFileSync(projectionPath, 'utf8')); } catch (error) { fail(`cannot read projection: ${error.message}`); }
  if (projection?.schemaVersion !== 'gridly.statewide-consumer-community-projection.v1' || !Array.isArray(projection.communities) || !Array.isArray(projection.exclusions)) fail('projection schema is invalid');
  const eligible = projection.communities.map(row => row?.placeGeoid);
  const excluded = projection.exclusions.map(row => row?.placeGeoid);
  for (const geoid of [...eligible, ...excluded]) if (!/^48\d{5}$/.test(geoid || '')) fail(`projection contains invalid PLACE GEOID ${geoid}`);
  if (new Set(eligible).size !== eligible.length) fail('projection contains duplicate eligible PLACE GEOIDs');
  if (new Set(excluded).size !== excluded.length) fail('projection contains duplicate excluded PLACE GEOIDs');
  if (excluded.some(geoid => eligible.includes(geoid))) fail('a projection PLACE GEOID is both eligible and excluded');
  return { eligible, excluded };
}

export function buildPlacePresentation({
  archivePath,
  projectionPath = DEFAULT_PROJECTION_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  sourceIdentity = GOVERNED_SOURCE_IDENTITY,
  expectedEligibleCount = 1859,
  write = true
}) {
  if (!archivePath) fail('governed archive path is required');
  if (path.basename(archivePath).toLowerCase() !== sourceIdentity.sourceFile.toLowerCase()) fail(`source filename must be ${sourceIdentity.sourceFile}`);
  const stat = fs.statSync(archivePath);
  if (stat.size !== sourceIdentity.byteLength) fail(`source byte length mismatch: expected ${sourceIdentity.byteLength}, found ${stat.size}`);
  const archiveBytes = fs.readFileSync(archivePath);
  const actualHash = digest(archiveBytes);
  if (actualHash !== sourceIdentity.sha256) fail(`source SHA-256 mismatch: expected ${sourceIdentity.sha256}, found ${actualHash}`);

  let entries;
  try { entries = unzipSync(new Uint8Array(archiveBytes)); } catch (error) { fail(`cannot read governed ZIP: ${error.message}`); }
  const dbfNames = Object.keys(entries).filter(name => /(^|\/)tl_2025_48_place\.dbf$/i.test(name));
  if (dbfNames.length !== 1) fail(`ZIP must contain exactly one tl_2025_48_place.dbf; found ${dbfNames.length}`);
  const records = readDbf(entries[dbfNames[0]]);
  const sourcePlaces = new Map();
  for (const record of records) {
    if (!/^48\d{5}$/.test(record.GEOID)) fail(`invalid Census PLACE GEOID ${record.GEOID}`);
    if (sourcePlaces.has(record.GEOID)) fail(`duplicate Census PLACE GEOID ${record.GEOID}`);
    if (!/^[+-]?\d+\.\d+$/.test(record.INTPTLAT) || !/^[+-]?\d+\.\d+$/.test(record.INTPTLON)) fail(`invalid Census internal point for ${record.GEOID}`);
    const lat = Number(record.INTPTLAT), lon = Number(record.INTPTLON);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) fail(`non-finite Census internal point for ${record.GEOID}`);
    sourcePlaces.set(record.GEOID, { lat, lon });
  }

  const { eligible, excluded } = parseProjection(projectionPath);
  if (eligible.length !== expectedEligibleCount) fail(`eligible PLACE count must be ${expectedEligibleCount}; found ${eligible.length}`);
  const governedGeoids = new Set([...eligible, ...excluded]);
  const missing = [...governedGeoids].filter(geoid => !sourcePlaces.has(geoid));
  const ineligibleSource = [...sourcePlaces.keys()].filter(geoid => !governedGeoids.has(geoid));
  if (missing.length) fail(`missing governed PLACE GEOIDs: ${missing.join(', ')}`);
  if (ineligibleSource.length) fail(`Census records are absent from governed eligibility: ${ineligibleSource.join(', ')}`);

  const places = {};
  for (const geoid of [...eligible].sort()) places[geoid] = sourcePlaces.get(geoid);
  if (Object.keys(places).length !== expectedEligibleCount || excluded.some(geoid => places[geoid])) fail('presentation target coverage is not exact');
  const artifact = {
    schemaVersion: 'gridly.statewide-place-presentation.v1',
    source: { authority: 'United States Census Bureau', dataset: '2025 TIGER/Line Places Texas', sourceFile: sourceIdentity.sourceFile, byteLength: sourceIdentity.byteLength, sha256: sourceIdentity.sha256 },
    counts: { eligiblePlaceCount: expectedEligibleCount, presentationTargetCount: Object.keys(places).length },
    places
  };
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  if (write) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const stage = `${outputPath}.stage-${process.pid}`;
    fs.writeFileSync(stage, bytes);
    fs.renameSync(stage, outputPath);
  }
  return { artifact, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) fail('usage: node tools/build-statewide-place-presentation-v1.mjs <tl_2025_48_place.zip>');
    const result = buildPlacePresentation({ archivePath: path.resolve(process.argv[2]) });
    process.stdout.write(`Wrote ${DEFAULT_OUTPUT_PATH} (${result.bytes.length} bytes)\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
