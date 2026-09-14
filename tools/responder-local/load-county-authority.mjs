// LOCAL/DISPOSABLE ONLY. Never point this loader at a remote or production database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,
  'reports/responder/responder-v1-county-authority-manifest.json'), 'utf8'));

export function certifyCountySource() {
  const result = spawnSync('git', ['show', `HEAD:${manifest.sourcePath}`], {
    cwd: root, encoding: null, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error('Cannot read frozen geometry Git blob');
  const bytes = result.stdout;
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, manifest.sourceSha256, 'frozen geometry SHA-256');
  assert.equal(bytes.length, manifest.sourceByteLength, 'frozen geometry byte length');
  const source = JSON.parse(bytes.toString('utf8'));
  assert.equal(source.schemaVersion, manifest.sourceSchemaVersion);
  assert.equal(source.packageVersion, manifest.sourcePackageVersion);
  assert.equal(source.countyCount, 254);
  assert.equal(source.counties.length, 254);
  assert.equal(manifest.countyCount, 254);
  const fips = new Set();
  const ids = new Set();
  let coordinatePairs = 0;
  for (const county of source.counties) {
    assert.match(county.fips, /^48\d{3}$/);
    assert.match(county.countyId, /^[a-z0-9]+(?:-[a-z0-9]+)*-tx$/);
    assert.ok(!fips.has(county.fips), `duplicate FIPS ${county.fips}`);
    assert.ok(!ids.has(county.countyId), `duplicate county ID ${county.countyId}`);
    fips.add(county.fips); ids.add(county.countyId);
    assert.equal(county.geometry?.type, 'Polygon');
    assert.ok(Array.isArray(county.geometry.coordinates) && county.geometry.coordinates.length > 0);
    for (const ring of county.geometry.coordinates) {
      assert.ok(Array.isArray(ring) && ring.length >= 4, `short ring ${county.fips}`);
      assert.deepEqual(ring[0], ring.at(-1), `open ring ${county.fips}`);
      for (const pair of ring) {
        assert.ok(Array.isArray(pair) && pair.length === 2, `non-2D coordinate ${county.fips}`);
        assert.ok(Number.isFinite(pair[0]) && Number.isFinite(pair[1]), `nonfinite coordinate ${county.fips}`);
        assert.ok(pair[0] >= -180 && pair[0] <= 180 && pair[1] >= -90 && pair[1] <= 90,
          `out-of-range coordinate ${county.fips}`);
        coordinatePairs++;
      }
    }
  }
  assert.deepEqual([...fips].sort(), manifest.canonicalFipsInventory);
  return { counties: source.counties, hash, coordinatePairs, manifest };
}

export function loadCountyCatalog({ database, bin, port, user }) {
  assert.match(database, /^gridly_responder_p3_[a-f0-9]{20}$/);
  assert.match(String(port), /^\d{4,5}$/);
  assert.match(user, /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/);
  const certified = certifyCountySource();
  const rows = certified.counties.map(county =>
    `${county.fips}\t${county.countyId}\t${JSON.stringify(county.geometry)}`).join('\n');
  const script = `BEGIN;
CREATE TEMP TABLE phase3_county_load (county_fips text, county_id text, geometry_json text) ON COMMIT DROP;
COPY phase3_county_load FROM STDIN WITH (FORMAT text);
${rows}
\\.
INSERT INTO agency_private.county_geometry_catalog
  (county_fips,county_id,geometry,source_sha256,source_schema_version,source_package_version)
SELECT county_fips::char(5),county_id,public.ST_SetSRID(public.ST_GeomFromGeoJSON(geometry_json),4326),
  '${certified.hash}','${certified.manifest.sourceSchemaVersion}',
  '${certified.manifest.sourcePackageVersion}' FROM phase3_county_load;
DO $$ BEGIN IF (SELECT count(*) FROM agency_private.county_geometry_catalog) <> 254
  THEN RAISE EXCEPTION 'incomplete county catalog'; END IF; END $$;
COMMIT;
`;
  const result = spawnSync(path.join(bin, 'psql.exe'),
    ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',database], {
      cwd: root, env: { ...process.env, PGHOST: '127.0.0.1', PGPORT: String(port),
        PGUSER: user, PGCONNECT_TIMEOUT: '3' }, input: script, encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024, timeout: 180000, windowsHide: true,
    });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'load failed');
  return { counties: certified.counties.length, hash: certified.hash,
    coordinatePairs: certified.coordinatePairs };
}
