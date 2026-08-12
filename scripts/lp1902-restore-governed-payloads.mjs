#!/usr/bin/env node
/** LP190.2 exact-byte restoration and unchanged LP134 double certification. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { certifyCountyPackage } from '../tools/lp104/certify-texas-address-package.mjs';
import { EVIDENCE_PATH, EXPECTED_FIPS, governedExpectations, verifyOwnerEvidence } from './lp1901-owner-remote-payload-recovery-probe.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPORT_JSON = join(ROOT, 'reports/lp1902/restricted-county-restoration-recertification.json');
export const REPORT_MD = join(ROOT, 'reports/lp1902/restricted-county-restoration-recertification.md');
export const SCHEMA = 'gridly.lp1902.restricted-county-restoration-recertification.v1';
const runtimeCertificateFor = certificationPath => certificationPath?.replace('/certification/', '/certificates/').replace('.certification.json', '.runtime-certificate.json');

export function parseArguments(argv) {
  const modes = argv.filter(x => ['--whatif', '--apply', '--verify', '--certify-twice'].includes(x));
  const unknown = argv.filter(x => ![...modes, '--json'].includes(x));
  if (unknown.length) throw new Error(`unknown option: ${unknown[0]}`);
  if (modes.length !== 1) throw new Error('select exactly one of --whatif, --apply, --verify, or --certify-twice');
  return { mode: modes[0].slice(2), json: argv.includes('--json') };
}

export async function digestFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { byteLength: (await stat(path)).size, sha256: hash.digest('hex') };
}
const exact = (identity, row) => identity.byteLength === row.expectedByteLength && identity.sha256 === row.expectedSha256;
const portable = path => relative(ROOT, path).replaceAll(sep, '/');
const pathsFor = (row, options = {}) => ({
  source: join(options.quarantine || join(ROOT, 'evidence/lp1901/recovered-payloads.local'), basename(row.lp130ExpectedArtifact)),
  target: resolve(options.root || ROOT, row.lp130ExpectedArtifact)
});

export async function restoreCounty(row, mode, options = {}) {
  const { source, target } = pathsFor(row, options);
  const base = { ...row, quarantineSourcePath: portable(source), governedTargetPath: row.lp130ExpectedArtifact };
  try {
    const sourceIdentity = await digestFile(source);
    if (!exact(sourceIdentity, row)) return { ...base, actualByteLength: sourceIdentity.byteLength, actualSha256: sourceIdentity.sha256, restorationClassification: 'SOURCE_IDENTITY_MISMATCH', remainingBlocker: 'Quarantine source differs from governed identity.' };
    let targetIdentity;
    try { targetIdentity = await digestFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (targetIdentity && !exact(targetIdentity, row)) return { ...base, actualByteLength: targetIdentity.byteLength, actualSha256: targetIdentity.sha256, restorationClassification: 'TARGET_IDENTITY_MISMATCH_REFUSED', remainingBlocker: 'A non-matching governed target exists and was not overwritten.' };
    if (targetIdentity) return { ...base, actualByteLength: targetIdentity.byteLength, actualSha256: targetIdentity.sha256, restorationClassification: 'ALREADY_RESTORED_EXACT', remainingBlocker: null };
    if (mode !== 'apply') return { ...base, actualByteLength: null, actualSha256: null, restorationClassification: mode === 'whatif' ? 'PLANNED_EXACT_RESTORATION' : 'TARGET_MISSING', remainingBlocker: 'Exact governed target has not been restored.' };
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target, constants.COPYFILE_EXCL);
    const copied = await digestFile(target);
    if (!exact(copied, row) || copied.byteLength !== sourceIdentity.byteLength || copied.sha256 !== sourceIdentity.sha256) throw new Error('post-copy identity verification failed');
    return { ...base, actualByteLength: copied.byteLength, actualSha256: copied.sha256, restorationClassification: 'RESTORED_EXACT', remainingBlocker: null };
  } catch (error) {
    return { ...base, actualByteLength: null, actualSha256: null, restorationClassification: 'RESTORATION_FAILED', remainingBlocker: error.message };
  }
}

const agreementView = result => ({ status: result.certificationStatus, sha256: result.sha256, packageSize: result.packageSize, indexedAddressCount: result.indexedAddressCount, exactMatchStatistics: { sampled: result.exactMatchStatistics.sampled, passed: result.exactMatchStatistics.passed, failed: result.exactMatchStatistics.failed }, rejectionStatistics: result.rejectionStatistics, normalizationStatistics: result.normalizationStatistics, integrityStatistics: result.integrityStatistics, failures: result.failures });
export async function certifyTwice(rows, options = {}) {
  const reportRoot = options.reportRoot || join(ROOT, 'reports/lp1902/lp134');
  await mkdir(reportRoot, { recursive: true });
  for (const row of rows) {
    if (!['RESTORED_EXACT', 'ALREADY_RESTORED_EXACT'].includes(row.restorationClassification)) continue;
    const stem = basename(row.governedTargetPath, '.addresses.jsonl.gz');
    const runs = [];
    for (let run = 1; run <= 2; run += 1) {
      const evidencePath = join(reportRoot, `run-${run}`, `${stem}.certification.json`);
      if (!row.lp130RuntimeCertificatePath && !options.certifier) throw new Error(`governed LP130 runtime certificate is unavailable (${row.countyFips})`);
      const certificatePath = row.lp130RuntimeCertificatePath ? resolve(options.root || ROOT, row.lp130RuntimeCertificatePath) : undefined;
      const result = await (options.certifier || certifyCountyPackage)({ packagePath: resolve(options.root || ROOT, row.governedTargetPath), certificatePath, county: `${row.countyName} County`, fips: row.countyFips });
      await mkdir(dirname(evidencePath), { recursive: true }); await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`);
      runs.push({ status: result.certificationStatus, evidencePath: portable(evidencePath), artifactIdentity: { byteLength: result.packageSize, sha256: result.sha256 }, result });
    }
    row.lp134Run1 = { status: runs[0].status, evidencePath: runs[0].evidencePath, artifactIdentity: runs[0].artifactIdentity };
    row.lp134Run2 = { status: runs[1].status, evidencePath: runs[1].evidencePath, artifactIdentity: runs[1].artifactIdentity };
    row.lp134Deterministic = JSON.stringify(agreementView(runs[0].result)) === JSON.stringify(agreementView(runs[1].result));
    const doublePass = runs.every(x => x.status === 'PASS') && row.lp134Deterministic && runs[0].artifactIdentity.sha256 === row.expectedSha256 && runs[1].artifactIdentity.sha256 === row.expectedSha256;
    row.restrictionCanBeCleared = doublePass;
    row.remainingBlocker = doublePass ? null : 'LP134 requires two PASS results with deterministic agreement and the governed payload identity.';
    row.nextRequiredAction = doublePass ? 'READY_FOR_ACTIVATION_RECONCILIATION; owner-governed LP135/LP186-LP189 reconciliation remains separate.' : 'Resolve the certification blocker without changing LP134 logic or payload bytes.';
  }
  return rows;
}

export function buildReport(mode, counties) {
  for (const row of counties) {
    row.lp134Run1 ??= null; row.lp134Run2 ??= null; row.lp134Deterministic ??= false; row.restrictionCanBeCleared ??= false;
    row.nextRequiredAction ??= ['RESTORED_EXACT','ALREADY_RESTORED_EXACT'].includes(row.restorationClassification) ? 'Run unchanged LP134 certification twice.' : 'Complete exact governed restoration.';
  }
  const count = value => counties.filter(x => value.includes(x.restorationClassification)).length;
  const doublePass = counties.filter(x => x.lp134Run1?.status === 'PASS' && x.lp134Run2?.status === 'PASS' && x.lp134Deterministic).length;
  const aggregate = { expectedCountyCount: 11, restoredExactCount: count(['RESTORED_EXACT']), alreadyRestoredExactCount: count(['ALREADY_RESTORED_EXACT']), restorationFailures: count(['SOURCE_IDENTITY_MISMATCH','TARGET_IDENTITY_MISMATCH_REFUSED','TARGET_MISSING','RESTORATION_FAILED']), lp134DoublePassCount: doublePass, lp134Failures: counties.filter(x => x.lp134Run1 && !(x.lp134Run1.status === 'PASS' && x.lp134Run2?.status === 'PASS' && x.lp134Deterministic)).length, reconciliationReadyCount: counties.filter(x => x.restrictionCanBeCleared).length, stillRestrictedCount: 11, safeForActivationReconciliation: counties.length === 11 && counties.every(x => x.restrictionCanBeCleared) };
  return { schemaVersion: SCHEMA, milestone: 'LP190.2', mode, scope: 'EXACT_RESTORATION_AND_CERTIFICATION_ONLY', activationPerformed: false, runtime: { operationalCountyCount: 243, restrictedCountyCount: 11, changed: false }, aggregate, counties };
}
function markdown(report) {
  const rows = report.counties.map(x => `| ${x.countyFips} | ${x.countyName} | ${x.restorationClassification} | ${x.lp134Run1?.status || 'NOT_RUN'} | ${x.lp134Run2?.status || 'NOT_RUN'} | ${x.restrictionCanBeCleared ? 'YES' : 'NO'} |`).join('\n');
  return `# LP190.2 restoration and recertification\n\n**Classification:** ${report.aggregate.safeForActivationReconciliation ? 'READY_FOR_ACTIVATION_RECONCILIATION' : 'OWNER_EXECUTION_OR_CERTIFICATION_REQUIRED'}\n\nThis evidence does not activate counties; runtime remains 243 operational / 11 restricted.\n\n| FIPS | County | Restoration | LP134 run 1 | LP134 run 2 | Reconciliation ready |\n|---|---|---|---|---|---|\n${rows}\n`;
}
async function save(report, options = {}) { const json = options.reportJson || REPORT_JSON; const md = options.reportMd || REPORT_MD; await mkdir(dirname(json), { recursive: true }); await writeFile(json, `${JSON.stringify(report, null, 2)}\n`); await writeFile(md, markdown(report)); }

export async function run(argv = process.argv.slice(2), options = {}) {
  const cli = parseArguments(argv); const expectations = await governedExpectations(options.auditPath);
  const audit = JSON.parse(await readFile(options.auditPath || join(ROOT, 'reports/lp190/restricted-county-lp130-recovery-audit.json'), 'utf8'));
  for (const row of expectations) row.lp130RuntimeCertificatePath = runtimeCertificateFor(audit.counties.find(x => x.countyFips === row.countyFips)?.existingCertificationPath);
  if (!options.skipOwnerEvidence) {
    const verified = await verifyOwnerEvidence(expectations, { evidencePath: options.evidencePath || EVIDENCE_PATH });
    if (!verified.aggregate.safeForGovernedRestoration || verified.aggregate.exactMatches !== 11) throw new Error('LP190.1 owner evidence is not exactly 11 REMOTE_OBJECT_EXACT_MATCH rows');
  }
  let counties;
  if (cli.mode === 'certify-twice') {
    counties = await Promise.all(expectations.map(x => restoreCounty(x, 'verify', options)));
    if (!counties.every(x => ['RESTORED_EXACT','ALREADY_RESTORED_EXACT'].includes(x.restorationClassification))) throw new Error('all 11 governed targets must verify exact before LP134');
    await certifyTwice(counties, options);
  } else {
    counties = await Promise.all(expectations.map(x => restoreCounty(x, cli.mode, options)));
    if (cli.mode === 'verify') {
      try {
        const prior = JSON.parse(await readFile(options.reportJson || REPORT_JSON, 'utf8'));
        for (const row of counties) {
          const old = prior.counties?.find(x => x.countyFips === row.countyFips && x.actualSha256 === row.actualSha256 && x.actualByteLength === row.actualByteLength);
          if (old?.lp134Run1 && old?.lp134Run2) Object.assign(row, { lp134Run1: old.lp134Run1, lp134Run2: old.lp134Run2, lp134Deterministic: old.lp134Deterministic, restrictionCanBeCleared: old.restrictionCanBeCleared, remainingBlocker: old.remainingBlocker, nextRequiredAction: old.nextRequiredAction });
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const report = buildReport(cli.mode, counties); if (!options.noWrite) await save(report, options);
  if (!options.silent) console.log(cli.json ? JSON.stringify(report, null, 2) : markdown(report));
  if (cli.mode !== 'whatif' && (report.aggregate.restorationFailures || (cli.mode === 'certify-twice' && !report.aggregate.safeForActivationReconciliation))) process.exitCode = 1;
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch(error => { console.error(error.message); process.exitCode = 1; });
