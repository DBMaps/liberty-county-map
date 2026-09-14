// Disposable localhost PostGIS certification. Synthetic identities only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { certifyCountySource, loadCountyCatalog } from '../tools/responder-local/load-county-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.RESPONDER_LOCAL_PGBIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const port = process.env.RESPONDER_LOCAL_PGPORT;
const user = process.env.RESPONDER_LOCAL_PGUSER;
const dataDirectory = process.env.RESPONDER_LOCAL_PGDATA && path.resolve(process.env.RESPONDER_LOCAL_PGDATA);
if (!/^\d{4,5}$/.test(port || '') || Number(port) < 1024 || Number(port) > 65535
  || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(user || '')
  || !dataDirectory || !fs.existsSync(dataDirectory)
  || !path.basename(dataDirectory).startsWith('gridly-responder-phase3-')
  || path.relative(os.tmpdir(), dataDirectory).startsWith('..')) {
  throw new Error('Set explicit disposable Phase 3 localhost PGPORT, PGUSER, and PGDATA under Temp.');
}
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port,
  PGUSER: user, PGCONNECT_TIMEOUT: '3' };
const database = `gridly_responder_p3_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
let created = false;
let passed = 0;
let failed = 0;
function psql(db, args, allowFailure = false) {
  const result = spawnSync(path.join(bin, 'psql.exe'),
    ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args], {
      cwd: root, env, encoding: 'utf8', timeout: 180000, windowsHide: true,
    });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}
const q = statement => psql(database, ['-c', statement]).stdout.trim();
const apply = relative => psql(database, ['-f', path.join(root, relative)]);
function check(label, actual, expected) {
  const okay = String(actual) === String(expected);
  console.log(`${okay ? 'PASS' : 'FAIL'} ${label}${okay ? '' : ` expected=${expected} actual=${actual}`}`);
  okay ? passed++ : failed++;
}
function denial(label, statement) {
  const result = psql(database, ['-c', statement], true);
  const okay = result.status !== 0;
  console.log(`${okay ? 'PASS' : 'FAIL'} ${label}`);
  okay ? passed++ : failed++;
}
function status(label, expected, actor, org, point, fips = 'NULL', authority = 'NULL', version = 'NULL') {
  const result = JSON.parse(q(`SELECT agency_private.phase3_authorize_point(
    '${actor}'::uuid,'${org}'::uuid,${point},${fips},${authority},${version})`));
  check(label, result.status, expected);
  return result;
}
function cleanup() {
  if (!created) return;
  try {
    if (psql(database, ['-c', "SELECT count(*) FROM pg_namespace WHERE nspname='agency_private'"]).stdout.trim() === '1') {
      apply('db/responder-local/001_agency_private_rollback.sql');
    }
  } catch (error) { console.error(`FIXTURE SCHEMA TEARDOWN FAILED: ${error.message}`); failed++; }
  try { psql('postgres', ['-c', `DROP DATABASE ${database} WITH (FORCE)`]); created = false; }
  catch (error) { console.error(`FIXTURE DATABASE TEARDOWN FAILED: ${error.message}`); failed++; }
}
process.on('SIGINT', () => { cleanup(); process.exit(130); });

const orgs = Array.from({ length: 7 }, () => randomUUID());
const actors = Array.from({ length: 8 }, () => randomUUID());
const reviewer = randomUUID();
const viewer = randomUUID();
const [orgA,orgB,orgC,orgD,orgE,orgF,orgG] = orgs;
const [actorA,actorB,actorC,actorD,actorE,actorF,actorG,revokedActor] = actors;
const point = fips => `(SELECT public.ST_PointOnSurface(geometry) FROM agency_private.county_geometry_catalog WHERE county_fips='${fips}')`;
const boundary = fips => `(SELECT public.ST_PointN(public.ST_ExteriorRing(geometry),1) FROM agency_private.county_geometry_catalog WHERE county_fips='${fips}')`;
const quote = value => `'${value}'`;
const authorityFor = (org, fips, version, from, until = 'NULL') => q(`SELECT agency_private.phase3_create_county_authority(
  '${reviewer}'::uuid,'${org}'::uuid,'${fips}'::char(5),${version},${from},${until})`);

try {
  check('PostgreSQL 17.10',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  const actualDir = psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim();
  assert.equal(path.resolve(actualDir).toLowerCase(),dataDirectory.toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]); created = true;
  console.log(`FIXTURE_DATABASE=${database} HOST=127.0.0.1 PORT=${port}`);
  q('CREATE EXTENSION postgis');
  check('PostGIS 3.6.2',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  apply('db/responder-local/001_agency_private_apply.sql');
  apply('db/responder-local/002_phase2_auth_membership_apply.sql');
  apply('db/responder-local/003_phase3_county_authority_apply.sql');
  check('agency publishing gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const source = certifyCountySource();
  check('frozen source SHA-256',source.hash,source.manifest.sourceSha256);
  check('source count 254',source.counties.length,254);
  check('source coordinate pairs validated',source.coordinatePairs,604979);
  const loaded = loadCountyCatalog({ database, bin, port, user });
  check('loaded count 254',loaded.counties,254);
  check('catalog count 254',q('SELECT count(*) FROM agency_private.county_geometry_catalog'),254);
  check('all catalog polygons valid and 4326',q(`SELECT count(*) FROM agency_private.county_geometry_catalog
    WHERE public.ST_IsValid(geometry) AND public.ST_SRID(geometry)=4326
      AND public.ST_GeometryType(geometry)='ST_Polygon' AND NOT public.ST_IsEmpty(geometry)`),254);
  check('catalog FIPS distinct 254',q('SELECT count(DISTINCT county_fips) FROM agency_private.county_geometry_catalog'),254);
  check('catalog county IDs distinct 254',q('SELECT count(DISTINCT county_id) FROM agency_private.county_geometry_catalog'),254);
  check('no missing frozen FIPS',q(`SELECT count(*) FROM agency_private.county_geometry_catalog
    WHERE county_fips NOT IN (${source.manifest.canonicalFipsInventory.map(quote).join(',')})`),0);
  check('catalog hashes frozen',q(`SELECT count(*) FROM agency_private.county_geometry_catalog
    WHERE source_sha256='${source.hash}'`),254);
  denial('catalog update immutable',`UPDATE agency_private.county_geometry_catalog SET county_id='spoof-tx' WHERE county_fips='48291'`);
  denial('catalog delete immutable',`DELETE FROM agency_private.county_geometry_catalog WHERE county_fips='48291'`);
  denial('unknown county row rejected',`INSERT INTO agency_private.county_geometry_catalog
    SELECT '48999','unknown-tx',geometry,source_sha256,source_schema_version,source_package_version
    FROM agency_private.county_geometry_catalog WHERE county_fips='48291'`);
  denial('app fixture cannot read catalog',`SET ROLE responder_app_fixture;
    SELECT count(*) FROM agency_private.county_geometry_catalog`);

  q(`INSERT INTO agency_private.organizations(id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state)
    VALUES ${orgs.map((id,i)=>`('${id}','phase3-${i}','Phase 3 Synthetic ${i}','Phase 3 Synthetic ${i}','county_agency','verified','active')`).join(',')}`);
  q(`INSERT INTO agency_private.local_auth_identities(user_id,normalized_email,identity_kind,assurance,session_active,eligibility)
    VALUES ${actors.map((id,i)=>`('${id}','phase3-actor-${i}@example.test','RESPONDER','aal2',true,'eligible')`).join(',')},
      ('${reviewer}','phase3-reviewer@example.test','GRIDLY_ADMIN','aal2',true,'eligible'),
      ('${viewer}','phase3-viewer@example.test','RESPONDER','aal2',true,'eligible')`);
  q(`INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at,revoked_at)
    VALUES ${orgs.map((id,i)=>`('${id}','${actors[i]}','${i===1?'SUPERVISOR':'RESPONDER'}','active',now(),NULL)`).join(',')},
      ('${orgA}','${revokedActor}','RESPONDER','revoked',now()-interval '1 day',now()),
      ('${orgA}','${viewer}','VIEWER','active',now(),NULL)`);
  const initialAudit = Number(q('SELECT count(*) FROM agency_private.organization_governance_events'));
  const a1 = authorityFor(orgA,'48291',1,"now()-interval '1 day'","now()+interval '1 day'");
  const b1 = authorityFor(orgB,'48071',1,"now()-interval '1 day'","now()+interval '1 day'");
  authorityFor(orgC,'48291',1,"now()+interval '1 day'","now()+interval '2 days'");
  authorityFor(orgD,'48291',1,"now()-interval '2 days'","now()-interval '1 day'");
  authorityFor(orgE,'48291',1,"now()-interval '1 day'","now()+interval '1 day'");
  authorityFor(orgF,'48291',1,"now()-interval '1 day'","now()+interval '1 day'");
  authorityFor(orgG,'48291',1,"now()-interval '1 day'","now()+interval '1 day'");
  check('seven approvals append governance events',q('SELECT count(*) FROM agency_private.organization_governance_events'),initialAudit+7);
  check('authority source SHA bound',q(`SELECT source_sha256 FROM agency_private.organization_authorities WHERE id='${a1}'`),source.hash);
  check('authority geometry equals catalog',q(`SELECT public.ST_Equals(a.geometry,c.geometry)
    FROM agency_private.organization_authorities a JOIN agency_private.county_geometry_catalog c USING(county_fips)
    WHERE a.id='${a1}'`),'t');
  denial('duplicate current approval rejected',`SELECT agency_private.phase3_create_county_authority(
    '${reviewer}','${orgA}','48291',2,now(),NULL)`);
  denial('stale or equal version rejected',`SELECT agency_private.phase3_create_county_authority(
    '${reviewer}','${orgA}','48291',1,now(),NULL)`);
  denial('unknown FIPS authority rejected',`SELECT agency_private.phase3_create_county_authority(
    '${reviewer}','${orgA}','48999',1,now(),NULL)`);
  denial('non-Gridly reviewer denied',`SELECT agency_private.phase3_create_county_authority(
    '${actorA}','${orgA}','48071',1,now(),NULL)`);
  denial('direct authority geometry spoof rejected',`INSERT INTO agency_private.organization_authorities
    (organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,
    effective_from,approved_by,approved_at,status)
    SELECT '${orgA}',1,'48071',geometry,'${source.manifest.sourcePath}',source_sha256,
      source_schema_version,now(),'${reviewer}',now(),'approved'
    FROM agency_private.county_geometry_catalog WHERE county_fips='48291'`);
  denial('approved geometry mutation rejected',`UPDATE agency_private.organization_authorities
    SET geometry=(SELECT geometry FROM agency_private.county_geometry_catalog WHERE county_fips='48071')
    WHERE id='${a1}'`);
  denial('approved authority version mutation rejected',`UPDATE agency_private.organization_authorities
    SET authority_version=2 WHERE id='${a1}'`);
  denial('approved source hash mutation rejected',`UPDATE agency_private.organization_authorities
    SET source_sha256=repeat('a',64) WHERE id='${a1}'`);
  denial('app fixture cannot invoke authority resolver',`SET ROLE responder_app_fixture;
    SELECT agency_private.phase3_authorize_point('${actorA}','${orgA}',${point('48291')})`);

  const inside = point('48291');
  const neighbor = point('48071');
  const edge = boundary('48291');
  check('Liberty point strictly contained',q(`SELECT public.ST_Contains(geometry,${inside})
    FROM agency_private.county_geometry_catalog WHERE county_fips='48291'`),'t');
  check('boundary is touched',q(`SELECT public.ST_Touches(geometry,${edge})
    FROM agency_private.county_geometry_catalog WHERE county_fips='48291'`),'t');
  const shared = q(`SELECT public.ST_AsEWKT(public.ST_PointOnSurface(public.ST_Intersection(
    public.ST_Boundary(a.geometry),public.ST_Boundary(b.geometry))))
    FROM agency_private.county_geometry_catalog a, agency_private.county_geometry_catalog b
    WHERE a.county_fips='48291' AND b.county_fips='48071'`);
  check('Liberty/Chambers shared boundary point found',shared.startsWith('SRID=4326;POINT('),true);
  if (shared.startsWith('SRID=4326;POINT(')) {
    const sharedPoint=`public.ST_GeomFromEWKT('${shared}')`;
    check('shared point touches both county polygons',q(`SELECT public.ST_Touches(a.geometry,${sharedPoint})
      AND public.ST_Touches(b.geometry,${sharedPoint}) FROM agency_private.county_geometry_catalog a,
      agency_private.county_geometry_catalog b WHERE a.county_fips='48291' AND b.county_fips='48071'`),'t');
    status('shared county boundary rejected','out_of_scope',actorA,orgA,sharedPoint);
  }
  const accepted = status('strict Liberty interior accepted','accepted',actorA,orgA,inside);
  check('server resolves Liberty FIPS',accepted.county_fips,'48291');
  check('server resolves current authority ID',accepted.authority_id,a1);
  status('neighboring Chambers point rejected','out_of_scope',actorA,orgA,neighbor);
  status('Liberty boundary rejected','out_of_scope',actorA,orgA,edge);
  const near = q(`SELECT public.ST_AsEWKT(p) FROM (
    SELECT public.ST_LineInterpolatePoint(public.ST_MakeLine(${edge},${inside}),f) AS p
    FROM (VALUES (0.000001::float8),(0.00001::float8),(0.0001::float8),(0.001::float8)) x(f)) s
    WHERE (SELECT count(*) FROM agency_private.county_geometry_catalog WHERE public.ST_Contains(geometry,p))=1
      AND NOT EXISTS(SELECT 1 FROM agency_private.county_geometry_catalog WHERE public.ST_Touches(geometry,p))
    LIMIT 1`);
  check('near-boundary interior candidate found',near.startsWith('SRID=4326;POINT('),true);
  if (near) status('near-boundary strict interior accepted','accepted',actorA,orgA,`public.ST_GeomFromEWKT('${near}')`);
  status('null point invalid','invalid_request',actorA,orgA,'NULL::public.geometry');
  status('wrong SRID invalid','invalid_request',actorA,orgA,'public.ST_SetSRID(public.ST_MakePoint(-94.8,30.0),3857)');
  status('nonpoint invalid','invalid_request',actorA,orgA,'public.ST_SetSRID(public.ST_MakeLine(public.ST_MakePoint(-94.8,30),public.ST_MakePoint(-94.7,30)),4326)');
  status('out-of-range coordinate invalid','invalid_request',actorA,orgA,'public.ST_SetSRID(public.ST_MakePoint(190,30),4326)');
  status('NaN coordinate invalid','invalid_request',actorA,orgA,
    "public.ST_SetSRID(public.ST_MakePoint('NaN'::float8,30),4326)");
  status('spoofed unknown county rejected','out_of_scope',actorA,orgA,inside,"'48999'");
  status('PLACE GEOID rejected','out_of_scope',actorA,orgA,inside,"'place:12345'");
  status('fake authority ID rejected','out_of_scope',actorA,orgA,inside,'NULL',`'${randomUUID()}'::uuid`);
  status('other-org authority ID rejected','out_of_scope',actorA,orgA,inside,'NULL',`'${b1}'::uuid`);
  status('wrong-org member denied','forbidden',actorB,orgA,inside);
  status('viewer role denied','forbidden',viewer,orgA,inside);
  status('revoked member denied','forbidden',revokedActor,orgA,inside);
  status('future authority denied','out_of_scope',actorC,orgC,inside);
  status('expired authority denied','out_of_scope',actorD,orgD,inside);
  q(`UPDATE agency_private.organizations SET operation_state='suspended',suspended_at=now() WHERE id='${orgE}'`);
  status('suspended org denied','suspended',actorE,orgE,inside);
  q(`UPDATE agency_private.organizations SET operation_state='inactive' WHERE id='${orgF}'`);
  status('inactive org denied','forbidden',actorF,orgF,inside);
  q(`UPDATE agency_private.organizations SET operation_state='inactive',verification_state='revoked',revoked_at=now() WHERE id='${orgG}'`);
  status('revoked org denied','forbidden',actorG,orgG,inside);
  q(`UPDATE agency_private.organization_memberships SET status='suspended',suspended_at=now()
    WHERE organization_id='${orgA}' AND user_id='${actorA}'`);
  status('suspended member denied','suspended',actorA,orgA,inside);
  q(`UPDATE agency_private.organization_memberships SET status='active',suspended_at=NULL
    WHERE organization_id='${orgA}' AND user_id='${actorA}'`);
  q(`UPDATE agency_private.local_auth_identities SET assurance='aal1' WHERE user_id='${actorA}'`);
  status('aal1 privileged path denied','forbidden',actorA,orgA,inside);
  q(`UPDATE agency_private.local_auth_identities SET assurance='aal2',session_active=false WHERE user_id='${actorA}'`);
  status('inactive session denied','forbidden',actorA,orgA,inside);
  q(`UPDATE agency_private.local_auth_identities SET session_active=true WHERE user_id='${actorA}'`);
  q(`UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=now() WHERE id='${a1}'`);
  status('revoked authority denied','out_of_scope',actorA,orgA,inside);
  check('revoked authority remains historical',q(`SELECT count(*) FROM agency_private.organization_authorities WHERE id='${a1}' AND status='revoked'`),1);
  const a2 = authorityFor(orgA,'48291',2,"now()-interval '1 minute'","now()+interval '1 day'");
  const current = status('new higher authority version accepted','accepted',actorA,orgA,inside);
  check('new current authority version 2',current.authority_version,2);
  check('new current authority ID',current.authority_id,a2);
  status('old authority ID stale','out_of_scope',actorA,orgA,inside,'NULL',`'${a1}'::uuid`);
  status('old authority version stale','out_of_scope',actorA,orgA,inside,'NULL','NULL',1);
  check('both versions retained',q(`SELECT count(*) FROM agency_private.organization_authorities WHERE organization_id='${orgA}' AND county_fips='48291'`),2);
  check('approved geometry immutable after rollover',q(`SELECT public.ST_Equals(a.geometry,c.geometry)
    FROM agency_private.organization_authorities a JOIN agency_private.county_geometry_catalog c USING(county_fips)
    WHERE a.id='${a2}'`),'t');
  check('no agency updates published',q('SELECT count(*) FROM agency_private.agency_updates'),0);
  check('agency publishing still disabled',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
} catch (error) {
  failed++;
  console.error(`FAIL fixture: ${error.stack || error.message}`);
} finally {
  cleanup();
  console.log(`RESULT ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}
