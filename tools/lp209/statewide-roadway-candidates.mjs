#!/usr/bin/env node
/** LP209 owner-workspace orchestrator. It never writes runtime assets or remote services. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from '../lp118/extract-tiger-roadways.mjs';
import { manufacture, PARTITION_LIMITS } from '../lp116/manufacture-candidate-roadways.mjs';
import { verifyCommittedEvidence as verifyLP208 } from '../lp208/statewide-tiger2025-roadway-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COHORT = join(ROOT, 'reports/lp206/statewide-roadway-missing-build-cohort.json');
const RUNTIME = join(ROOT, 'data/roadway-runtime-manifest.json');
const BOUNDARIES = join(ROOT, 'assets/boundaries/texas-counties-boundaries.geojson');
const REPORTS = join(ROOT, 'reports/lp209');
export const OWNER_SOURCE_ROOT = 'C:\\GitHub\\Gridly-Source-Data\\Census\\TIGER2025\\ROADS';
export const OWNER_OUTPUT_ROOT = 'owner-local/lp209-roadway-manufacturing';
export const DEFAULT_GDAL_EXECUTABLE = 'C:\\Program Files\\QGIS 3.44.11\\bin\\ogr2ogr.exe';
export const CONTROL_FIPS = Object.freeze(['48287','48331','48395','48113','48029','48141','48181','48309','48423','48439','48453']);
const sha = b => createHash('sha256').update(b).digest('hex');
const json = x => `${JSON.stringify(x, null, 2)}\n`;
const exists = p => access(p).then(() => true, () => false);
const invariant = (v, message) => { if (!v) throw new Error(`LP209 fail-closed: ${message}`); };
const portable = p => relative(ROOT, p).replaceAll('\\', '/');

export async function loadPlan({ sourceRoot = OWNER_SOURCE_ROOT, outputRoot = OWNER_OUTPUT_ROOT } = {}) {
  const [{ manifest: sources }, cohort, runtimeBody, boundaryBody] = await Promise.all([
    verifyLP208(), readFile(COHORT, 'utf8').then(JSON.parse), readFile(RUNTIME), readFile(BOUNDARIES)
  ]);
  const runtime = JSON.parse(runtimeBody); const boundaries = JSON.parse(boundaryBody);
  const protectedIds = new Set(Object.keys(runtime.counties));
  const protectedFips = new Set(cohort.existingRuntimeCounties.map(x => x.countyFips));
  invariant(cohort.totalTexasCounties === 254 && cohort.missingRoadwayCountyCount === 226, 'LP206 254/226 conservation differs');
  invariant(protectedIds.size === 28 && protectedFips.size === 28, 'runtime protected cohort must contain 28 counties');
  invariant(boundaries.type === 'FeatureCollection' && boundaries.features?.length === 254, 'boundary authority must be a 254-feature FeatureCollection');
  invariant(sources.length === 226, 'LP208 source manifest must contain 226 rows');
  const sourceByFips = new Map(sources.map(x => [x.countyFips, x]));
  const rows = cohort.missingCounties.map(c => {
    const s = sourceByFips.get(c.countyFips);
    invariant(s && s.countyId === c.countyId && s.countyName === c.countyName, `missing/mismatched LP208 identity ${c.countyFips}`);
    invariant(s.zipValid && s.requiredMembersPresent && s.certificationStatus === 'PASS', `uncertified LP208 source ${c.countyFips}`);
    invariant(['EXISTING_VALID_SOURCE','ACQUIRED_NEW_SOURCE'].includes(s.acquisitionStatus), `invalid acquisition status ${c.countyFips}`);
    invariant(!protectedFips.has(c.countyFips) && !protectedIds.has(c.countyId), `protected overlap ${c.countyFips}`);
    const lp118 = join(outputRoot, 'lp118', c.countyFips);
    return { countyFips:c.countyFips, countyId:c.countyId, countyName:c.countyName, countySlug:c.countySlug,
      sourceFilename:s.filename, sourceSha256:s.sha256, sourceBytes:s.bytes, sourceAuthority:s.sourceAuthority,
      sourceProduct:s.sourceProduct, sourceVintage:s.sourceVintage, sourceOwnerPath:join(sourceRoot,s.filename),
      expectedLP118OutputPath:join(lp118,`${c.countyId}-${c.countyFips}.tiger-roadways.candidate.geojson`),
      expectedLP116OutputRoot:join(outputRoot,'lp116',c.countyFips), protectedExistingRuntime:false, manufacturingRequired:true };
  }).sort((a,b)=>a.countyFips.localeCompare(b.countyFips));
  invariant(rows.length === 226 && new Set(rows.map(x=>x.countyFips)).size === 226, 'plan must contain 226 unique FIPS');
  invariant(new Set([...protectedFips,...rows.map(x=>x.countyFips)]).size === 254, 'protected + manufacturing cohorts must conserve 254');
  return { rows, runtimeSha256:sha(runtimeBody), runtimeCount:protectedIds.size, boundarySha256:sha(boundaryBody) };
}

async function command(exe,args) { return new Promise((ok,no)=>{ let out=''; const p=spawn(exe,args,{windowsHide:true}); p.stdout.on('data',x=>out+=x); p.stderr.on('data',x=>out+=x); p.once('error',no); p.once('close',code=>code===0?ok(out.trim()):no(new Error(`${exe} exited ${code}: ${out.trim()}`))); }); }
export async function resolveGdalConfiguration(configured = DEFAULT_GDAL_EXECUTABLE) {
  invariant(typeof configured === 'string' && configured.trim(), 'GDAL executable or directory is required');
  const configuredPath = resolve(configured);
  let information;
  try { information = await stat(configuredPath); } catch { invariant(false, `GDAL path does not exist: ${configured}`); }
  const executable = information.isDirectory()
    ? join(configuredPath, process.platform === 'win32' ? 'ogr2ogr.exe' : 'ogr2ogr')
    : configuredPath;
  invariant(information.isDirectory() || information.isFile(), `GDAL path is neither a file nor directory: ${configured}`);
  invariant(/^ogr2ogr(?:\.exe)?$/i.test(basename(executable)), `GDAL executable must be ogr2ogr: ${configured}`);
  let executableInformation;
  try { executableInformation = await stat(executable); } catch { invariant(false, `ogr2ogr executable does not exist: ${executable}`); }
  invariant(executableInformation.isFile(), `ogr2ogr executable is not a file: ${executable}`);
  return { executable, directory: dirname(executable) };
}
export async function verifyGdal(gdalExecutable) {
  invariant(gdalExecutable, 'resolved GDAL executable is required');
  const identity=await command(gdalExecutable,['--version']);
  invariant(/GDAL 3\.13\./i.test(identity), `GDAL 3.13.x required; received ${identity}`);
  return identity;
}
async function sourceIdentity(row) { const body=await readFile(row.sourceOwnerPath); invariant(body.length===row.sourceBytes,`source byte mismatch ${row.countyFips}`); invariant(sha(body)===row.sourceSha256,`source SHA mismatch ${row.countyFips}`); }

export async function executeOwner({ mode='whatif', sourceRoot=OWNER_SOURCE_ROOT, outputRoot=resolve(ROOT,OWNER_OUTPUT_ROOT), gdal, writeReports=false, countyFips=null }={}) {
  invariant(['whatif','build','resume','verify'].includes(mode), `unsupported mode ${mode}`);
  const before=await loadPlan({sourceRoot,outputRoot});
  invariant(!resolve(outputRoot).startsWith(resolve(ROOT,'data')) && !resolve(outputRoot).startsWith(resolve(ROOT,'assets')), 'output root is production-adjacent');
  const ownerMounted=await exists(sourceRoot); let gdalIdentity=null; let gdalConfiguration=null;
  if (ownerMounted) { gdalConfiguration=await resolveGdalConfiguration(gdal); gdalIdentity=await verifyGdal(gdalConfiguration.executable); }
  if (mode==='whatif') return summarize(before.rows,[],before,{ownerMounted,gdalIdentity,writeReports:false});
  const executionRows=countyFips ? before.rows.filter(row=>countyFips.includes(row.countyFips)) : before.rows;
  if (countyFips) invariant(executionRows.length===countyFips.length, 'requested execution cohort is not wholly governed');
  if (mode==='build'||mode==='resume') {
    invariant(ownerMounted,'owner source root is not mounted (not classified globally missing)');
    await mkdir(outputRoot,{recursive:true});
    for (const row of executionRows) {
      await sourceIdentity(row);
      const lp118Root=join(outputRoot,'lp118');
      const extracted=await extract({fips:row.countyFips,candidate:true,source:row.sourceOwnerPath,boundaries:BOUNDARIES,gdal:gdalConfiguration.directory,reports:lp118Root,[mode==='resume'?'resume':'force']:true});
      const x=extracted.counties[0]; invariant(['GENERATED','RESUMED'].includes(x.status),`LP118 ${row.countyFips}: ${x.status}`);
      const made=await manufacture({fips:row.countyFips,candidate:true,source:resolve(x.output.path),boundaries:BOUNDARIES,reports:join(outputRoot,'lp116'),[mode==='resume'?'resume':'force']:true});
      invariant(made.counties[0].certificationStatus==='PASS',`LP116 ${row.countyFips} did not PASS`);
    }
  }
  const evidence=await collectEvidence(before.rows,outputRoot);
  const result=summarize(before.rows,evidence,before,{ownerMounted,gdalIdentity,writeReports});
  if(writeReports) await writeEvidence(result);
  if (mode!=='verify') invariant(result.readiness==='READY_FOR_STATEWIDE_ROADWAY_PUBLICATION','committed/local evidence is incomplete');
  return result;
}

export async function collectEvidence(rows,outputRoot) {
  const all=[];
  for(const row of rows){ const xp=join(outputRoot,'lp118',row.countyFips,'checkpoint.json'), mp=join(outputRoot,'lp116',row.countyFips,'checkpoint.json'); if(!await exists(xp)||!await exists(mp)) continue;
    const [x,m]=await Promise.all([readFile(xp,'utf8').then(JSON.parse),readFile(mp,'utf8').then(JSON.parse)]);
    all.push({row,x,m});
  } return all;
}
export function summarize(rows,evidence,plan,environment={}) {
  const byFips=new Map(evidence.map(x=>[x.row.countyFips,x]));
  const counties=rows.map(row=>{const e=byFips.get(row.countyFips), x=e?.x, m=e?.m; const packages=m?.packages||[]; return {
    countyFips:row.countyFips,countyId:row.countyId,countyName:row.countyName,countySlug:row.countySlug,
    sourceFilename:row.sourceFilename,sourceBytes:row.sourceBytes,sourceSha256:row.sourceSha256,sourceAuthority:row.sourceAuthority,sourceProduct:row.sourceProduct,sourceVintage:row.sourceVintage,
    lp118Status:x?.status||'PENDING_OWNER_EXECUTION',sourceFeatureCount:x?.sourceFeatureCount??null,retainedFeatureCount:x?.retainedFeatureCount??null,rejectedFeatureCount:x?.rejectedFeatureCount??null,
    rejectedGeometryCount:x?.rejectedGeometryCount??null,outOfCountyRejectionCount:x?.outOfCountyRejectionCount??null,duplicateCount:x?.duplicateCount??null,geometryTypeCounts:x?.geometryTypeCounts??null,candidateSourceBytes:x?.output?.sizeBytes??null,candidateSourceSha256:x?.output?.sha256??null,
    lp116Status:m?.status||'PENDING_OWNER_EXECUTION',finalFeatureCount:m?.featureCount??null,partitionCount:packages.length||null,partitions:packages.map(p=>({fileName:p.fileName,featureCount:p.featureCount,bytes:p.byteLength,sha256:p.sha256})),packageBytes:packages.reduce((n,p)=>n+p.byteLength,0)||null,packageSha256:packages.length===1?packages[0].sha256:null,
    manifestBytes:m?.manifest?.sizeBytes??null,manifestSha256:m?.manifest?.sha256??null,certificationStatus:m?.certificationStatus||'PENDING_OWNER_EXECUTION',determinismStatus:'PENDING_OWNER_RERUN',activated:false,published:false};});
  const pass=counties.filter(x=>x.certificationStatus==='PASS').length, lp118=counties.filter(x=>['GENERATED','RESUMED'].includes(x.lp118Status)).length;
  const readiness=pass===226&&lp118===226&&counties.every(x=>x.determinismStatus==='PASS')?'READY_FOR_STATEWIDE_ROADWAY_PUBLICATION':'BLOCKED_FOR_STATEWIDE_ROADWAY';
  return {schemaVersion:'gridly.lp209.statewide-roadway-manufacturing.v1',generatedAt:'2026-08-17T00:00:00.000Z',plan:rows, counties, accounting:{texasCounties:254,existingRuntimeRoadwayCount:28,planned:226,lp118Successful:lp118,lp116Manufactured:pass,certified:pass,failed:counties.filter(x=>x.certificationStatus==='FAIL').length,pending:226-pass,protectedOverlap:0,supabaseWrites:0,runtimeActivations:0,productionPackageModifications:0},productionRuntimeManifest:{path:'data/roadway-runtime-manifest.json',sha256Before:plan.runtimeSha256,sha256After:plan.runtimeSha256,countyCountBefore:28,countyCountAfter:28,unchanged:true},partitionLimits:PARTITION_LIMITS,environment,downstreamCompatibility:{status:'PENDING_OWNER_CANDIDATE_TESTS'},determinism:{status:'PENDING_OWNER_RERUN',controls:CONTROL_FIPS},readiness};
}
async function writeEvidence(result){await mkdir(REPORTS,{recursive:true}); await writeFile(join(REPORTS,'statewide-roadway-missing-cohort-manufacturing.json'),json({...result,counties:undefined})); await writeFile(join(REPORTS,'statewide-roadway-candidate-manifest.json'),json({schemaVersion:'gridly.lp209.statewide-roadway-candidate-manifest.v1',generatedAt:result.generatedAt,certificationComplete:result.readiness.startsWith('READY_'),counties:result.counties}));}
export async function writePlan(){const p=await loadPlan(); const result=summarize(p.rows,[],p,{ownerSourceMounted:false,evidenceState:'OWNER_EXECUTION_REQUIRED'}); await writeEvidence(result); return result;}
export async function verifyCommitted(){const [p,a,m]=await Promise.all([loadPlan(),readFile(join(REPORTS,'statewide-roadway-missing-cohort-manufacturing.json'),'utf8').then(JSON.parse),readFile(join(REPORTS,'statewide-roadway-candidate-manifest.json'),'utf8').then(JSON.parse)]); invariant(m.counties.length===226,'candidate manifest row count'); invariant(a.accounting.planned===226&&a.accounting.lp118Successful===226&&a.accounting.lp116Manufactured===226&&a.accounting.certified===226&&a.accounting.pending===0&&a.accounting.protectedOverlap===0,'committed owner manufacturing accounting'); invariant(a.readiness==='BLOCKED_FOR_STATEWIDE_ROADWAY','readiness must remain blocked until final owner evidence is ingested'); invariant(a.productionRuntimeManifest.sha256After===p.runtimeSha256,'runtime manifest changed'); return {readiness:a.readiness,accounting:a.accounting};}
async function main(){const args=process.argv.slice(2); if(args.includes('--write-plan')){console.log((await writePlan()).readiness);return;} if(args.includes('--verify')){console.log((await verifyCommitted()).readiness);return;} console.log((await executeOwner()).readiness);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
