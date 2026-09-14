#!/usr/bin/env node
// LOCAL REHEARSAL / NOT A PRODUCTION MIGRATION. No network or database access.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const sourcePath='assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json';
export const outputPath='db/responder-local/phase13_county_population_rehearsal.sql';
export const expectedSha256='6c6eeb549bb5e03d79efbc4d421783c06988c81c0f728c79add32f8c219e3d49';
export const loaderVersion='responder.phase13.countyPopulation.v1';
const expectedBounds=[-106.645646,25.837048,-93.508039,36.500704];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sqlText=value=>"'"+value.replaceAll("'","''")+"'";

export function validateSource(){
  const canonical=execFileSync('git',['cat-file','blob',`HEAD:${sourcePath}`],
    {cwd:root,maxBuffer:20*1024*1024});
  assert.equal(sha(canonical),expectedSha256,'frozen Git blob changed');
  assert.equal(canonical.length,13934264,'frozen Git blob byte length changed');
  const working=readFileSync(join(root,sourcePath));
  assert.ok(working.equals(canonical) ||
    (working.length===canonical.length+1 && canonical.at(-1)===10 &&
      working.at(-2)===13 && working.at(-1)===10 &&
      working.subarray(0,-2).equals(canonical.subarray(0,-1))),
    'working source differs from canonical Git blob beyond final LF/CRLF normalization');
  const packageData=JSON.parse(canonical.toString('utf8'));
  const manifest=JSON.parse(readFileSync(join(root,
    'reports/responder/responder-v1-county-authority-manifest.json'),'utf8'));
  assert.equal(packageData.schemaVersion,manifest.sourceSchemaVersion);
  assert.equal(packageData.packageVersion,manifest.sourcePackageVersion);
  assert.equal(manifest.sourceSha256,expectedSha256);
  assert.equal(packageData.counties.length,254);
  assert.equal(packageData.countyCount,254);
  assert.equal(manifest.countyCount,254);
  assert.equal(manifest.geometryTypeExpectation,'Polygon');
  assert.equal(packageData.sort,'ascending-fips');
  assert.equal(manifest.upstreamActivateRuntimeAuthorized,false);
  assert.equal(manifest.upstreamDeployAuthorized,false);
  const sorted=[...packageData.counties].sort((a,b)=>a.fips.localeCompare(b.fips));
  assert.deepEqual(packageData.counties.map(x=>x.fips),sorted.map(x=>x.fips),
    'source county order must already be ascending FIPS');
  assert.deepEqual(sorted.map(x=>x.fips),manifest.canonicalFipsInventory);
  assert.equal(new Set(sorted.map(x=>x.fips)).size,254);
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  let points=0,rings=0;
  for(const row of sorted){
    assert.match(row.fips,/^48\d{3}$/);
    assert.equal(row.geometry?.type,'Polygon',`unexpected geometry type for ${row.fips}`);
    assert.ok(Array.isArray(row.geometry.coordinates)&&row.geometry.coordinates.length>0);
    for(const ring of row.geometry.coordinates){
      assert.ok(Array.isArray(ring)&&ring.length>=4,`short ring ${row.fips}`);
      assert.deepEqual(ring[0],ring.at(-1),`unclosed ring ${row.fips}`);
      rings++;
      for(const xy of ring){
        assert.ok(Array.isArray(xy)&&xy.length===2,`non-2D coordinate ${row.fips}`);
        const [lon,lat]=xy;
        assert.ok(Number.isFinite(lon)&&Number.isFinite(lat) &&
          lon>=-180&&lon<=180&&lat>=-90&&lat<=90,`invalid coordinate ${row.fips}`);
        bounds[0]=Math.min(bounds[0],lon);bounds[1]=Math.min(bounds[1],lat);
        bounds[2]=Math.max(bounds[2],lon);bounds[3]=Math.max(bounds[3],lat);
        points++;
      }
    }
  }
  assert.equal(points,604979);
  assert.equal(rings,254);
  assert.deepEqual(bounds,expectedBounds);
  return {rows:sorted,sha256:expectedSha256,canonicalBytes:canonical.length,
    packageVersion:packageData.packageVersion,schemaVersion:packageData.schemaVersion,
    sourceGeneratedAt:packageData.generatedAt,fipsSha256:sha(sorted.map(x=>x.fips).join('\n')),
    points,rings,bounds};
}

export function buildPopulationSql({injectFailureAfterFirstBatch=false}={}){
  const source=validateSource();
  const pivot=source.rows[126].fips;
  const lines=[
    '-- LOCAL REHEARSAL / NOT A PRODUCTION MIGRATION.',
    '-- Future production use requires a separate owner authorization and guarded runbook.',
    `-- loaderVersion=${loaderVersion}`,
    `-- frozenSourceSha256=${source.sha256}`,
    `-- frozenSourceBytes=${source.canonicalBytes}`,
    `-- sourcePackageVersion=${source.packageVersion}`,
    `-- canonicalFipsSha256=${source.fipsSha256}`,
    '-- sourceCount=254; payload contains no generation timestamp.',
    'BEGIN;',
    'LOCK TABLE public.gridly_texas_county_boundaries IN SHARE ROW EXCLUSIVE MODE;',
    'CREATE TEMP TABLE phase13_source (county_fips text PRIMARY KEY, geom extensions.geometry(MultiPolygon,4326) NOT NULL, boundary_version text NOT NULL) ON COMMIT DROP;',
    'CREATE TEMP TABLE phase13_action (action text NOT NULL CHECK (action IN (\'load\',\'noop\'))) ON COMMIT DROP;'
  ];
  for(const row of source.rows){
    const geometry=JSON.stringify({type:row.geometry.type,coordinates:row.geometry.coordinates});
    lines.push('INSERT INTO pg_temp.phase13_source (county_fips,geom,boundary_version) VALUES ('+
      sqlText(row.fips)+',extensions.ST_Multi(extensions.ST_SetSRID('+
      'extensions.ST_GeomFromGeoJSON('+sqlText(geometry)+'),4326)),'+
      sqlText(source.packageVersion)+');');
  }
  lines.push(`DO $phase13$
DECLARE target_rows bigint;
BEGIN
  IF (SELECT count(*) FROM pg_temp.phase13_source)<>254
     OR (SELECT count(DISTINCT county_fips) FROM pg_temp.phase13_source)<>254
     OR EXISTS (SELECT 1 FROM pg_temp.phase13_source WHERE geom IS NULL
       OR extensions.ST_SRID(geom)<>4326
       OR extensions.ST_GeometryType(geom)<>'ST_MultiPolygon'
       OR NOT extensions.ST_IsValid(geom))
     OR (SELECT sum(extensions.ST_NPoints(geom)) FROM pg_temp.phase13_source)<>604979
  THEN RAISE EXCEPTION 'phase13_source_validation_failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='gridly_texas_county_boundaries'
      AND c.relkind='r' AND c.relrowsecurity AND NOT c.relforcerowsecurity
  ) OR (SELECT count(*) FROM pg_attribute a
    WHERE a.attrelid='public.gridly_texas_county_boundaries'::regclass
      AND a.attnum>0 AND NOT a.attisdropped)<>3
    OR NOT EXISTS (
      SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid
      WHERE i.indrelid='public.gridly_texas_county_boundaries'::regclass
        AND x.relname='gridly_texas_county_boundaries_geom_idx'
        AND i.indisvalid AND pg_get_indexdef(i.indexrelid) LIKE '%USING gist (geom)%')
    OR EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.gridly_texas_county_boundaries'::regclass
        AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'phase13_target_shape_drift'; END IF;
  SELECT count(*) INTO target_rows FROM public.gridly_texas_county_boundaries;
  IF target_rows=0 THEN
    INSERT INTO pg_temp.phase13_action VALUES ('load');
  ELSIF target_rows=254
    AND NOT EXISTS (SELECT 1 FROM public.gridly_texas_county_boundaries
      WHERE geom IS NULL OR extensions.ST_SRID(geom)<>4326
        OR extensions.ST_GeometryType(geom)<>'ST_MultiPolygon'
        OR NOT extensions.ST_IsValid(geom))
    AND NOT EXISTS (
      SELECT 1 FROM pg_temp.phase13_source s
      FULL JOIN public.gridly_texas_county_boundaries t USING(county_fips)
      WHERE s.county_fips IS NULL OR t.county_fips IS NULL
        OR t.boundary_version IS DISTINCT FROM s.boundary_version
        OR NOT extensions.ST_Equals(t.geom,s.geom)
        OR extensions.ST_AsBinary(t.geom)<>extensions.ST_AsBinary(s.geom))
  THEN
    INSERT INTO pg_temp.phase13_action VALUES ('noop');
  ELSE
    RAISE EXCEPTION 'phase13_nonempty_or_drifted_target';
  END IF;
END
$phase13$;`);
  lines.push(`INSERT INTO public.gridly_texas_county_boundaries (county_fips,geom,boundary_version)
SELECT county_fips,geom,boundary_version FROM pg_temp.phase13_source
WHERE county_fips<=${sqlText(pivot)}
  AND (SELECT action FROM pg_temp.phase13_action)='load' ORDER BY county_fips;`);
  if(injectFailureAfterFirstBatch)
    lines.push("DO $phase13$ BEGIN RAISE EXCEPTION 'phase13_injected_failure_after_127'; END $phase13$;");
  lines.push(`INSERT INTO public.gridly_texas_county_boundaries (county_fips,geom,boundary_version)
SELECT county_fips,geom,boundary_version FROM pg_temp.phase13_source
WHERE county_fips>${sqlText(pivot)}
  AND (SELECT action FROM pg_temp.phase13_action)='load' ORDER BY county_fips;`);
  lines.push(`DO $phase13$
BEGIN
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries)<>254
    OR EXISTS (SELECT 1 FROM public.gridly_texas_county_boundaries
      WHERE geom IS NULL OR extensions.ST_SRID(geom)<>4326
        OR extensions.ST_GeometryType(geom)<>'ST_MultiPolygon'
        OR NOT extensions.ST_IsValid(geom))
    OR (SELECT sum(extensions.ST_NPoints(geom))
      FROM public.gridly_texas_county_boundaries)<>604979
    OR EXISTS (
      SELECT 1 FROM pg_temp.phase13_source s
      FULL JOIN public.gridly_texas_county_boundaries t USING(county_fips)
      WHERE s.county_fips IS NULL OR t.county_fips IS NULL
        OR t.boundary_version IS DISTINCT FROM s.boundary_version
        OR NOT extensions.ST_Equals(t.geom,s.geom)
        OR extensions.ST_AsBinary(t.geom)<>extensions.ST_AsBinary(s.geom))
  THEN RAISE EXCEPTION 'phase13_postload_certification_failed'; END IF;
END
$phase13$;
SELECT md5(string_agg(county_fips || encode(extensions.ST_AsBinary(geom),'hex') ||
  boundary_version, '|' ORDER BY county_fips)) AS phase13_in_transaction_digest
FROM public.gridly_texas_county_boundaries;
COMMIT;`);
  return {sql:lines.join('\n')+'\n',source};
}

export function artifactMetadata(sql,source){
  const bytes=Buffer.from(sql,'utf8');
  return {path:outputPath,bytes:bytes.length,sha256:sha(bytes),
    sourceSha256:source.sha256,sourceCanonicalBytes:source.canonicalBytes,
    sourcePackageVersion:source.packageVersion,loaderVersion,
    countyCount:source.rows.length,fipsSha256:source.fipsSha256,
    sourcePoints:source.points,sourceRings:source.rings,
    deterministicPayload:true};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const check=process.argv.includes('--check');
  assert.ok(process.argv.length<=3 && (!process.argv[2] || process.argv[2]==='--check'));
  const {sql,source}=buildPopulationSql();
  const metadata=artifactMetadata(sql,source);
  const file=join(root,outputPath);
  if(check) assert.ok(readFileSync(file).equals(Buffer.from(sql,'utf8')),
    'generated SQL differs from committed local rehearsal artifact');
  else writeFileSync(file,sql,'utf8');
  process.stdout.write(JSON.stringify({...metadata,mode:check?'verified':'generated'})+'\n');
}
