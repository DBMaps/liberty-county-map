import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REQUIRED_SIDECARS = ['shp', 'dbf', 'shx', 'prj'];

export function shapefileParts(shapefile) {
  return Object.fromEntries(REQUIRED_SIDECARS.map(extension => [extension, shapefile.replace(/\.shp$/i, `.${extension}`)]));
}

export function geometrySourceState(shapefile, readerAvailable) {
  if (!shapefile || !REQUIRED_SIDECARS.every(extension => fs.existsSync(shapefileParts(shapefile)[extension]))) return 'NOT_PRESENT';
  return readerAvailable ? 'PRESENT_READER_AVAILABLE' : 'PRESENT_REQUIRES_GOVERNED_GEOMETRY_READER';
}

export function resolveOgr2ogr(environment = process.env, platform = process.platform) {
  const executable = platform === 'win32' ? 'ogr2ogr.exe' : 'ogr2ogr';
  const candidates = [
    environment.GRIDLY_OGR2OGR,
    environment.GRIDLY_GDAL_BIN && path.join(environment.GRIDLY_GDAL_BIN, executable),
    platform === 'win32' && `C:\\Program Files\\QGIS 3.44.11\\bin\\${executable}`,
    executable,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (result.status === 0) return { executable: candidate, version: (result.stdout || result.stderr).trim() };
  }
  return null;
}

function bboxOfCoordinates(coordinates, bbox = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (typeof coordinates?.[0] === 'number') {
    bbox[0] = Math.min(bbox[0], coordinates[0]); bbox[1] = Math.min(bbox[1], coordinates[1]);
    bbox[2] = Math.max(bbox[2], coordinates[0]); bbox[3] = Math.max(bbox[3], coordinates[1]);
  } else for (const child of coordinates ?? []) bboxOfCoordinates(child, bbox);
  return bbox;
}

export function inspectPlaceFeatures(featureCollection) {
  if (featureCollection?.type !== 'FeatureCollection') throw new Error('OGR_OUTPUT_NOT_A_FEATURE_COLLECTION');
  return featureCollection.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const geometryType = feature.geometry?.type ?? null;
    if (!['Polygon', 'MultiPolygon'].includes(geometryType)) throw new Error(`NON_POLYGON_PLACE_GEOMETRY:${index}:${geometryType}`);
    const geoid = String(properties.GEOID ?? '');
    const placefp = String(properties.PLACEFP ?? '');
    if (!geoid || !placefp || !properties.NAME) throw new Error(`PLACE_IDENTITY_FIELDS_MISSING:${index}`);
    return {
      GEOID: geoid, PLACEFP: placefp, NAME: String(properties.NAME), geometry: feature.geometry,
      geometryType, bbox: bboxOfCoordinates(feature.geometry.coordinates),
      valid: Number(properties.__gridly_valid ?? 1) === 1,
      empty: Number(properties.__gridly_empty ?? 0) === 1,
    };
  });
}

export function readTigerPlaceGeometry(shapefile, { ogr = resolveOgr2ogr(), runner = spawnSync, tempRoot = os.tmpdir() } = {}) {
  if (geometrySourceState(shapefile, Boolean(ogr)) === 'NOT_PRESENT') throw new Error('TIGER_PLACE_SHAPEFILE_SET_NOT_PRESENT');
  if (!ogr) throw new Error('PRESENT_REQUIRES_GOVERNED_GEOMETRY_READER');
  const directory = fs.mkdtempSync(path.join(tempRoot, 'gridly-lp232-'));
  const output = path.join(directory, 'places.geojson');
  const layer = path.basename(shapefile, path.extname(shapefile));
  const sql = `SELECT GEOID, PLACEFP, NAME, ST_IsValid(geometry) AS __gridly_valid, ST_IsEmpty(geometry) AS __gridly_empty, geometry FROM "${layer}" ORDER BY GEOID`;
  try {
    const result = runner(ogr.executable, ['-f', 'GeoJSON', output, shapefile, '-dialect', 'SQLite', '-sql', sql, '-lco', 'RFC7946=YES', '-lco', 'WRITE_BBOX=YES'], { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 64 });
    if (result.status !== 0) throw new Error(`GOVERNED_OGR2OGR_READ_FAILED:${(result.stderr || result.stdout || '').trim()}`);
    const collection = JSON.parse(fs.readFileSync(output, 'utf8').replace(/^\uFEFF/, ''));
    return { reader: { name: 'GDAL ogr2ogr', executable: ogr.executable, version: ogr.version, dialect: 'SQLite', output: 'RFC 7946 GeoJSON' }, features: inspectPlaceFeatures(collection) };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
