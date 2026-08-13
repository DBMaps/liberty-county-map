#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EXPECTED_FIPS = Object.freeze(['48061','48073','48113','48121','48135','48229','48329','48377','48401','48425','48441']);
export const INPUT = 'reports/lp1902/restricted-county-restoration-recertification.json';
export const OUTPUT_JSON = 'reports/lp1903/final-11-county-activation-reconciliation.json';
export const OUTPUT_MD = 'reports/lp1903/final-11-county-activation-reconciliation.md';
export const PROTECTED_RUNTIME = Object.freeze(['js/app.js','assets/package-registry/runtime-package-registry.json','js/gridlyPackageRegistry.js','assets/location-resolution/gridly-authoritative-county-geometry-v1.json','assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json']);
const read = (p, root=ROOT) => fs.readFileSync(path.join(root,p));
const readJson = (p, root=ROOT) => JSON.parse(read(p,root));
const stable = value => `${JSON.stringify(value,null,2)}\n`;

export function evidenceComplete(row, root=ROOT) {
  if (!row || !EXPECTED_FIPS.includes(row.countyFips) || row.restrictionCanBeCleared !== true || row.lp134Deterministic !== true) return false;
  if (!['RESTORED_EXACT','ALREADY_RESTORED_EXACT'].includes(row.restorationClassification)) return false;
  if (!Number.isInteger(row.expectedByteLength) || !/^[a-f0-9]{64}$/.test(row.expectedSha256 || '') || row.actualByteLength !== row.expectedByteLength || row.actualSha256 !== row.expectedSha256) return false;
  if (row.lp134Run1?.status !== 'PASS' || row.lp134Run2?.status !== 'PASS' || !row.lp134Run1.evidencePath || !row.lp134Run2.evidencePath) return false;
  try {
    const run1=readJson(row.lp134Run1.evidencePath,root), run2=readJson(row.lp134Run2.evidencePath,root);
    return run1.certificationStatus==='PASS' && run2.certificationStatus==='PASS' &&
      run1.sha256===row.expectedSha256 && run2.sha256===row.expectedSha256 &&
      run1.packageSize===row.expectedByteLength && run2.packageSize===row.expectedByteLength;
  } catch { return false; }
}

export function buildReport(input, root=ROOT) {
  const rows=new Map((input?.counties || []).map(x=>[x.countyFips,x]));
  const exactSet=rows.size===11 && EXPECTED_FIPS.every(f=>rows.has(f)) && [...rows.keys()].every(f=>EXPECTED_FIPS.includes(f));
  const counties=EXPECTED_FIPS.map(f=>{
    const x=rows.get(f), complete=exactSet && evidenceComplete(x,root);
    return {
      countyFips:f, countyName:x?.countyName ?? null,
      priorRestrictionReason:'LOCAL_PACKAGE_UNAVAILABLE',
      priorRestrictionAuthority:`LP135-${f}-PACKAGE_AVAILABILITY; evidence/lp135/statewide-certification.json`,
      lp1902EvidencePath:INPUT, lp134Run1Path:x?.lp134Run1?.evidencePath ?? null, lp134Run2Path:x?.lp134Run2?.evidencePath ?? null,
      expectedByteLength:x?.expectedByteLength ?? null, actualByteLength:x?.actualByteLength ?? null,
      expectedSha256:x?.expectedSha256 ?? null, actualSha256:x?.actualSha256 ?? null,
      reconciliationClassification:complete?'RESTRICTION_RECONCILED_ACTIVATION_ELIGIBLE':'LP1902_EVIDENCE_INCOMPLETE_FAIL_CLOSED',
      activationEligible:complete, remainingBlocker:complete?null:'COMPLETE_LP1902_EXACT_PAYLOAD_AND_DOUBLE_PASS_EVIDENCE_REQUIRED'
    };
  });
  const eligible=counties.filter(x=>x.activationEligible).length;
  const aggregate={expectedCountyCount:11,reconciledCount:eligible,alreadyReconciledCount:0,evidenceFailures:11-eligible,remainingGovernanceBlockers:11-eligible,ownerAuthorizationRequiredCount:0,activationEligibleCount:eligible,stillRestrictedByGovernanceCount:11-eligible,safeForGuardedRuntimeActivation:eligible===11};
  return {schemaVersion:'gridly.lp1903.activation-reconciliation.v1',milestone:'LP190.3',mode:'GOVERNANCE_RECONCILIATION_ONLY',restrictionAuthority:{sourceOfTruth:'evidence/lp135/statewide-certification.json',operativeReconciliationRegistry:'reports/lp186/county-restriction-reconciliation.json',derivedSummaries:['reports/lp186/texas-county-activation-inventory.json','reports/lp186/texas-county-activation-summary.json','reports/lp1888/restricted-county-readiness.json','reports/lp1889/lp1889-summary.json'],obsoleteReason:'LOCAL_PACKAGE_UNAVAILABLE',satisfiedBy:INPUT,ownerAuthorizationRemaining:false,reconciliationRule:'LP190.3 supersedes the obsolete package-availability restriction; historical reports remain immutable.'},aggregate,activationPerformed:false,runtime:{operationalCountyCount:243,restrictedCountyCount:11,changed:false},counties};
}

function markdown(r){const rows=r.counties.map(x=>`| ${x.countyFips} | ${x.countyName} | ${x.priorRestrictionReason} | ${x.reconciliationClassification} | ${x.activationEligible?'YES':'NO'} | ${x.remainingBlocker ?? 'NONE'} |`).join('\n');return `# LP190.3 final 11-county activation reconciliation\n\nLP190.3 reconciles governance only. It supersedes the obsolete LP135 package-availability restriction using committed LP190.2 evidence; it does not rewrite historical evidence or activate runtime. Runtime remains **243 operational / 11 restricted**.\n\n**Safe for guarded runtime activation:** ${r.aggregate.safeForGuardedRuntimeActivation?'YES':'NO'}\n\n| FIPS | County | Prior reason | Classification | Activation eligible | Remaining blocker |\n|---|---|---|---|---|---|\n${rows}\n`}
export function outputs(root=ROOT){const report=buildReport(readJson(INPUT,root),root);return new Map([[OUTPUT_JSON,stable(report)],[OUTPUT_MD,markdown(report)]]);}
export function run(mode='whatif',root=ROOT){const planned=outputs(root), report=JSON.parse(planned.get(OUTPUT_JSON));if(mode==='apply'){for(const [p,v] of planned){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),v);}}if(mode==='verify'){for(const [p,v] of planned){if(!fs.existsSync(path.join(root,p)) || read(p,root).toString()!==v) throw new Error(`LP190.3 fail closed: stale or missing ${p}`);}}return {...report,mode:mode.toUpperCase(),filesThatWouldChange:[...planned.keys()]};}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const flags=new Set(process.argv.slice(2)), modes=['--whatif','--apply','--verify'].filter(x=>flags.has(x));if([...flags].some(x=>!['--whatif','--apply','--verify','--json'].includes(x))||modes.length>1)throw new Error('LP190.3 fail closed: choose one supported mode');const mode=flags.has('--apply')?'apply':flags.has('--verify')?'verify':'whatif';const result=run(mode);process.stdout.write(flags.has('--json')?stable(result):`${mode.toUpperCase()} ${JSON.stringify(result,null,2)}\n`);if(!result.aggregate.safeForGuardedRuntimeActivation)process.exitCode=1;}catch(e){process.stderr.write(`${e.message}\n`);process.exitCode=1;}}
