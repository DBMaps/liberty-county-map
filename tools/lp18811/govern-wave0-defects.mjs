#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = 'reports/lp18811f2';
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export const canonical = value => `${JSON.stringify(value, null, 2)}\n`;
export const digest = value => `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;

export const SEVERITIES = Object.freeze(['SEVERITY_1', 'SEVERITY_2']);
export const STATUSES = Object.freeze(['OPEN', 'CLOSED']);

export function validateWave0(value) {
  const required = ['schemaVersion','waveId','environmentClassification','exactFipsScope','runtimeDeploymentIdentity','buildIdentity','packageAuthority','assertions','requiredThresholds','executedOutcomes','assertionTotals','evidenceReferences','executorIdentityReference','productionMutationObserved','activationObserved','overallOutcome'];
  for (const key of required) if (!(key in value)) throw Error(`Wave 0 missing ${key}`);
  if (value.waveId !== 'WAVE_0') throw Error('Wave 0 waveId must be WAVE_0');
  if (!Array.isArray(value.exactFipsScope) || value.exactFipsScope.length === 0 || value.exactFipsScope.some(f => !/^48\d{3}$/.test(f)) || [...value.exactFipsScope].sort().join() !== value.exactFipsScope.join() || new Set(value.exactFipsScope).size !== value.exactFipsScope.length) throw Error('Wave 0 requires exact canonical FIPS scope');
  if (!value.runtimeDeploymentIdentity?.deploymentId || !value.runtimeDeploymentIdentity?.environmentId) throw Error('Wave 0 requires runtime/deployment identity');
  if (!/^sha256:[0-9a-f]{64}$/.test(value.buildIdentity)) throw Error('Wave 0 requires build identity');
  if (!Array.isArray(value.assertions) || value.assertions.length === 0) throw Error('Wave 0 requires named assertions');
  for (const a of value.assertions) for (const key of ['assertionId','description','scope','assertionSemantics','expectedResult','severityOnFailure','evidenceMethod']) if (!a[key]) throw Error(`assertion missing ${key}`);
  if (value.overallOutcome === 'PASS') {
    if (!Array.isArray(value.executedOutcomes) || value.executedOutcomes.length !== value.assertions.length || value.executedOutcomes.some(o => !['PASS','FAIL'].includes(o.outcome))) throw Error('Wave 0 requires real executed outcomes before PASS');
    if (!value.executorIdentityReference || value.evidenceReferences.length === 0) throw Error('Wave 0 PASS requires executor and evidence');
    if (value.assertionTotals.pass !== value.assertions.length || value.assertionTotals.fail !== 0) throw Error('Wave 0 PASS totals invalid');
  }
  return true;
}

export function validateTaxonomy(value) {
  if (value.severities.map(x => x.severity).join(',') !== SEVERITIES.join(',')) throw Error('taxonomy severity order/values invalid');
  for (const severity of value.severities) if (!severity.classificationRule || !Array.isArray(severity.governedBlockerClasses) || !severity.governedBlockerClasses.length) throw Error('taxonomy is not deterministic');
  return true;
}

export function validateInventory(value) {
  if (!value.scope?.scopeType || !Array.isArray(value.scope.applicableFips) || !Array.isArray(value.scope.waveIds)) throw Error('defect inventory scope is not explicit');
  for (const d of value.defects) {
    for (const key of ['defectId','title','severity','status','scopeType','applicableFips','waveScope','evidenceReference','openedAuthority','technicalDisposition','blocksRegressionPass']) if (!(key in d)) throw Error(`defect missing ${key}`);
    if (!SEVERITIES.includes(d.severity)) throw Error('defect severity is not governed');
    if (!STATUSES.includes(d.status)) throw Error('defect status is not governed');
    if (d.status === 'CLOSED' && (!Array.isArray(d.resolutionEvidence) || d.resolutionEvidence.length === 0)) throw Error('closed S1/S2 requires resolution evidence');
  }
  const counts = deriveCounts(value.defects);
  if (JSON.stringify(counts) !== JSON.stringify(value.derivedCounts)) throw Error('defect counts must be derived');
  if (value.completeness === 'COMPLETE' && (!value.sourceAudit?.reviewComplete || value.sourceAudit.reviewedSourceCount !== value.sourceAudit.sources.length || value.sourceAudit.sources.some(s => !s.technicalDisposition))) throw Error('complete inventory requires complete source review');
  return true;
}

export function deriveCounts(defects) {
  return {severity1OpenCount:defects.filter(d => d.severity === 'SEVERITY_1' && d.status === 'OPEN').length,severity2OpenCount:defects.filter(d => d.severity === 'SEVERITY_2' && d.status === 'OPEN').length};
}
export function regressionPassAllowed(wave0, inventory) {
  validateWave0(wave0); validateInventory(inventory);
  const c = deriveCounts(inventory.defects);
  return wave0.overallOutcome === 'PASS' && inventory.completeness === 'COMPLETE' && c.severity1OpenCount === 0 && c.severity2OpenCount === 0;
}

export function generate(root = ROOT) {
  const plan = read(root, 'reports/lp187/texas-activation-wave-plan.json');
  const owner = read(root, 'evidence/lp18811/execution-results/owner-result.json');
  const summary = read(root, 'reports/lp18811/lp18811-summary.json');
  const fips = plan.waves.find(w => w.wave === 'WAVE_0_REGRESSION_BASELINE').countyFips;
  const assertions = [
    ['CERTIFIED_ARTIFACT_STABILITY','Previously certified artifacts remain consumer-loadable without identity drift.','each exact Wave 0 FIPS','Resolve the governed package for the requested county and compare its immutable identity with packageAuthority.','SEVERITY_1','Protected read-only package resolution capture plus identity comparison.'],
    ['OPERATIONAL_COUNTY_RESULT_STABILITY','Existing operational-county discovery and selection remain correct.','each exact Wave 0 FIPS','A governed county query discovers and selects only the requested operational county.','SEVERITY_2','Protected consumer journey capture of county discovery and selection.'],
    ['COUNTY_BOUNDARY_ISOLATION','County-edge behavior does not spill results into an adjacent county.','governed edge fixture for each exact Wave 0 FIPS','Each edge fixture retains its governed county identity and returns no unexplained adjacent-county result.','SEVERITY_1','Protected consumer edge-journey capture compared with approved fixtures.'],
    ['CONSUMER_RESULT_STABILITY','Representative community, destination, crossing, and awareness results remain understandable and stable.','approved representative fixtures spanning exact Wave 0 FIPS','Every approved fixture loads the expected county-scoped result with no unexplained empty or ambiguous result.','SEVERITY_2','Protected consumer-visible journey capture and exact expected-result comparison.'],
    ['FALLBACK_BEHAVIOR_STABILITY','Empty and ambiguous inputs retain governed fallback behavior.','approved empty and ambiguous fixtures spanning exact Wave 0 FIPS','Each fixture produces its predeclared truthful empty/ambiguity outcome without cross-county substitution.','SEVERITY_2','Protected consumer-visible fallback capture and exact expected-result comparison.'],
    ['ROUTE_AWARENESS_STABILITY','Route/watch awareness remains county-correct for governed fixtures.','approved route/watch fixtures spanning exact Wave 0 FIPS','Each fixture retains expected route context, awareness area, and county identity.','SEVERITY_2','Protected read-only route/watch journey capture and exact expected-result comparison.']
  ].map(x => ({assertionId:x[0],description:x[1],scope:x[2],assertionSemantics:x[3],expectedResult:x[3],severityOnFailure:x[4],evidenceMethod:x[5]}));
  const wave0 = {schemaVersion:'gridly.wave0-authority.v1',waveId:'WAVE_0',authorityStatus:'PROPOSED_OWNER_APPROVAL_AND_EXECUTION_REQUIRED',environmentClassification:'PROTECTED_NON_PRODUCTION',exactFipsScope:fips,runtimeDeploymentIdentity:{deploymentId:owner.deploymentIdentity.deploymentId,environmentId:'gridly-statewide-validation'},buildIdentity:owner.deploymentIdentity.expectedBuildIdentity,packageAuthority:{type:'IMMUTABLE_PACKAGE_FAMILY_REGISTRY',reference:'reports/lp1885/community-package-identity-inventory.json'},assertions,requiredThresholds:{assertionPassPercent:100,severity1OpenCount:0,severity2OpenCount:0,productionMutationObserved:false,activationObserved:false},executedOutcomes:[],assertionTotals:{executed:0,pass:0,fail:0},evidenceReferences:[],executorIdentityReference:null,productionMutationObserved:false,activationObserved:false,overallOutcome:'NOT_EXECUTED'};
  const taxonomy = {schemaVersion:'gridly.defect-taxonomy.v1',authorityStatus:'PROPOSED_OWNER_APPROVAL_REQUIRED',sourceAuthorities:['LP132-TEXAS-STATEWIDE-ACTIVATION-ROADMAP.md'],severities:[{severity:'SEVERITY_1',classificationRule:'A reproducible release-correctness defect that can permit an invalid artifact or county identity to progress, cross a protected county/restriction boundary, compromise security/privacy/integrity, make activation unsafe, corrupt governed data, or make required rollback ineffective.',governedBlockerClasses:['ARTIFACT_OR_IDENTITY_INTEGRITY','PROTECTED_BOUNDARY_OR_RESTRICTION_BYPASS','SECURITY_OR_PRIVACY_INTEGRITY','UNSAFE_ACTIVATION_OR_INEFFECTIVE_ROLLBACK']},{severity:'SEVERITY_2',classificationRule:'A reproducible, release-blocking regression that significantly degrades governed runtime or consumer correctness, including control/threshold breach, county-scoped discovery/result failure, unexplained empty/ambiguous result, adjacent-county spillover, or missing operational readiness, without meeting SEVERITY_1 impact.',governedBlockerClasses:['RUNTIME_CONTROL_OR_THRESHOLD_REGRESSION','COUNTY_SCOPED_CONSUMER_CORRECTNESS','ADJACENT_COUNTY_SPILLOVER','OPERATIONAL_READINESS_BLOCKER']}],statusRules:{OPEN:'Reproducible supported defect without accepted technical resolution evidence.',CLOSED:'Defect has technical resolution evidence reproducing the fix against the same immutable identity/rules and independent review evidence.'},regressionGate:'Any OPEN SEVERITY_1 or SEVERITY_2 blocks regression PASS.'};
  const contractDigest = digest(wave0);
  const taxonomyDigest = digest(taxonomy);
  if (contractDigest !== 'sha256:a05d8fbb07bcdf1ee4b067d0aacbe6e690a8531f160396472f76757f3beeb257') throw Error('approved Wave 0 contract digest drift');
  if (taxonomyDigest !== 'sha256:f920f96e8a6175f594368e400bef26717662aa4e316503acd4c867fc95654329') throw Error('approved taxonomy digest drift');
  const ownerDecision = {
    schemaVersion:'gridly.lp18811f2.owner-governance-decision.v1', milestone:'LP188.11F2',
    approvedBindings:{wave0ContractDigest:contractDigest,severityTaxonomyDigest:taxonomyDigest},
    wave0ScopeApproval:'OWNER_APPROVED', exactFipsScope:fips,
    approvedAssertionIds:assertions.map(a=>a.assertionId), severityTaxonomyApproval:'OWNER_APPROVED',
    defectInventoryCompletenessApproval:'NOT_APPROVED_AS_COMPLETE', technicalDefectReviewAuthorized:true,
    protectedNonProductionWave0ExecutionAuthorized:true, regression215CountyExecutionAuthorized:false,
    productionActivationAuthorized:false, productionDeploymentAuthorized:false, publicLaunchAuthorized:false,
    supabaseProductionMutationAuthorized:false, restrictionClearingAuthorized:false,
    authorityStatementReference:'LP188.11F2 continuation owner decision supplied in milestone record'
  };
  const source = (sourceId, references, candidateIds, technicalDisposition) => ({sourceId,references,candidateIds,technicalDisposition});
  const sources = [
    source('ACTIVATION_AND_LAUNCH_BLOCKER_REGISTERS',['reports/lp167/blocker-register.json','reports/lp176/authorization-decision-report.json','reports/lp177/prerequisite-matrix.json','reports/lp178/launch-readiness-report.json','reports/lp179/launch-readiness-reassessment.json'],['LP167-B001','LP167-B002','LP167-B003','LP167-B005','LP167-B008'],'Reviewed all correctness, runtime, device, and rollback candidates; later scope/remediation evidence and candidate dispositions below determine Wave 0 applicability.'),
    source('PRODUCTION_READINESS_AND_CONFIGURATION',['reports/lp168/missing-prerequisites.json','reports/lp169/configuration-blockers.json'],['LP169-B007','LP169-B008','LP169-B009'],'Production evidence gaps are outside the protected non-production Wave 0 defect scope and are not observed security/privacy breaches.'),
    source('OPERATIONAL_AND_ROLLBACK_READINESS',['reports/lp170/operational-blockers.json','reports/lp171/operational-blockers.json','reports/lp174/operational-evidence-summary.json'],['LP170-B004','LP171-B006'],'Production operational-evidence gaps are outside Wave 0; LP174 reports zero remaining operational blockers, so no supported unresolved Wave 0 rollback defect exists.'),
    source('STATEWIDE_ROUTING',['reports/lp163/lp163-summary.json','reports/lp178/lp178-summary.json'],['LP167-B002'],'The launch-window attestation requirement is production-only; later governed route repairs do not establish an open protected Wave 0 defect.'),
    source('STATEWIDE_AWARENESS',['reports/lp164/lp164-summary.json','reports/lp178/lp178-summary.json'],['LP167-B003'],'Quiet/active/cleared production observation was an evidence prerequisite, not a reproduced protected Wave 0 correctness defect.'),
    source('CONSUMER_EXPERIENCE',['reports/lp166/lp166-summary.json','reports/lp1837/physical-device-validation.json'],['LP167-B005'],'Missing packaged-device evidence is distribution scope; protected browser validation later passed and no Wave 0 consumer defect is recorded.'),
    source('PROTECTED_PREVIEW',['reports/lp1835/deployment-blockers.json','reports/lp1836/lp1836-summary.json','reports/lp1837/lp1837-summary.json'],['LP1835-PREDEPLOYMENT'],'Predeployment authorization/access prerequisites were superseded by LP1837 protected-preview PASS; they are not open defects against the LP188.11C deployment.'),
    source('PROTECTED_ARTIFACT_REMEDIATION',['reports/lp1832/resolution-options.json','reports/lp18321/cross-platform-asset-identity.json','reports/lp1833/artifact-compatibility-verification.json'],['LP1832-FRA','LP1832-HARRIS','LP1832-MONTGOMERY'],'Artifact inclusion/compression candidates were technically repaired and verified before the later protected artifact; no unresolved finding binds the approved Wave 0 build.'),
    source('PRIVACY_AUDIT',['reports/lp1841a/location-privacy-audit.json','reports/lp1841a/community-reporting-privacy-audit.json','reports/lp1841b/store-privacy-uncertainty-register.json','reports/lp1841d/legal-readiness-reassessment.json'],['LP1841-STORE-UNCERTAINTIES'],'Store declarations, retention policy, and counsel questions are launch/legal uncertainties, not evidence of a reproduced security/privacy integrity breach in protected Wave 0.'),
    source('POST_PREVIEW_PRODUCT_HIT_LIST',['reports/lp185/post-preview-launch-readiness-reconciliation.json'],['LP185-G02','LP185-G03','LP185-G04','LP185-G05','LP185-G06','LP185-G07','LP185-G08','LP185-G09','LP185-G10','LP185-G11','LP185-G12','LP185-G13','LP185-G14','LP185-G15','LP185-G16','LP185-G17','LP185-G18'],'All 17 remaining gates were reviewed: they govern legal, store, native distribution, production, unrestricted statewide claims, operations, public web, or authorization; none records a reproduced defect in the exact protected 28-FIPS Wave 0 scope.'),
    source('COUNTY_RESTRICTIONS',['reports/lp186/county-restriction-reconciliation.json','reports/lp1888/restricted-county-readiness.json'],['LP167-B001'],'The 11 restricted counties are not in the exact approved Wave 0 FIPS scope; restrictions remain preserved and no bypass is recorded.'),
    source('WAVE_PLANNING',['reports/lp187/texas-activation-wave-plan.json','reports/lp187/texas-county-activation-prerequisite-matrix.json'],[],'Planning and prerequisites are not executed findings and were not converted into defects.'),
    source('COMMUNITY_PACKAGE_GOVERNANCE',['reports/lp1884/texas-community-package-promotion-readiness.json','reports/lp1885/community-package-identity-inventory.json','reports/lp1886/county-promotion-eligibility-review.json','reports/lp1887/lp1887-summary.json'],[],'Package identities and promotion evidence contain no supported unresolved S1/S2 finding for the approved scope.'),
    source('STATEWIDE_ACTIVATION_READINESS',['reports/lp1888/statewide-county-activation-readiness.json','reports/lp1889/county-readiness.json'],[],'Activation-readiness gaps are preserved authorization prerequisites, not reproduced defects in the already-operational Wave 0 scope.'),
    source('PROTECTED_DEPLOYMENT_VALIDATION',['reports/lp18811/lp18811-summary.json','reports/lp18811/county-validation-matrix.json','reports/lp18811e/remaining-validation-matrix.json'],[],'All 215 deployment/runtime/boundary results passed; regression and consumer evidence remain absent rather than failed. No S1/S2 defect is inferred from an unexecuted control.'),
    source('REGRESSION_AUTHORITY_AUDIT',['LP188.11F1-PROTECTED-REGRESSION-AUTHORITY-AUDIT.md','reports/lp18811f1/regression-authority-audit.json'],[],'Authority absence was a governance blocker, not a reproduced product defect; this milestone supplies the approved contracts.')
  ];
  const reviewedArtifactCount = new Set(sources.flatMap(s => s.references)).size;
  const candidateDispositions = [
    {candidateId:'LP167-B001',classification:'OUTSIDE_WAVE0_SCOPE',technicalDisposition:'Eleven known restricted counties are disjoint from the exact 28-FIPS scope; restriction state remains enforced.'},
    {candidateId:'LP167-B002',classification:'OUTSIDE_PROTECTED_WAVE0_SCOPE',technicalDisposition:'Production launch-window route attestation prerequisite; no protected Wave 0 failure evidence.'},
    {candidateId:'LP167-B003',classification:'OUTSIDE_PROTECTED_WAVE0_SCOPE',technicalDisposition:'Production live-source observation prerequisite; no protected Wave 0 failure evidence.'},
    {candidateId:'LP167-B005',classification:'OUTSIDE_WAVE0_DEFECT_TAXONOMY',technicalDisposition:'Packaged-app/device distribution evidence gap; not a reproduced correctness defect.'},
    {candidateId:'LP167-B008',classification:'SUPERSEDED_NO_OPEN_DEFECT',technicalDisposition:'Production rollback evidence was reconciled by LP174 with zero remaining operational blockers; also outside protected Wave 0.'},
    {candidateId:'LP1832-ASSET-REPAIRS',classification:'CLOSED_BEFORE_APPROVED_BUILD',technicalDisposition:'LP1833 technically verifies the repaired compatibility artifact used by later preview evidence; no unresolved defect against approved build identity.'},
    {candidateId:'LP1841-STORE-UNCERTAINTIES',classification:'OUTSIDE_WAVE0_DEFECT_TAXONOMY',technicalDisposition:'Legal/store disclosure uncertainty is not a reproduced security/privacy integrity breach.'},
    {candidateId:'LP185-G02-G18',classification:'OUTSIDE_PROTECTED_WAVE0_SCOPE',technicalDisposition:'Seventeen post-preview gates concern launch/legal/store/native/production/authorization scopes; LP185-G15 preserves restrictions and does not report an operational-cohort defect.'}
  ];
  const inventory = {schemaVersion:'gridly.defect-inventory.v1',authorityStatus:'TECHNICAL_COMPLETENESS_REVIEW_COMPLETE',scope:{scopeType:'WAVE_AND_EXACT_FIPS',applicableFips:fips,waveIds:['WAVE_0','LP18810-NP-001'],environmentClassification:'PROTECTED_NON_PRODUCTION'},sourceAudit:{reviewAuthorityReference:'reports/lp18811f2/owner-governance-decision.json',reviewMethod:'Deterministic review of governed blocker, readiness, protected-preview, correctness, integrity, privacy/security, rollback, statewide runtime, county restriction, LP185 hit-list, remediation, and LP188 protected-validation sources; every identified candidate has an explicit taxonomy disposition.',reviewedSourceCount:sources.length,reviewedArtifactCount,sources,candidateDispositions,reviewComplete:true},defects:[],derivedCounts:{severity1OpenCount:0,severity2OpenCount:0},completeness:'COMPLETE',completenessConclusion:'All identified governed in-scope source families and candidate findings were reviewed under the owner-approved taxonomy. No supported OPEN or CLOSED S1/S2 defect record applies to the exact protected 28-FIPS Wave 0 scope. Counts are authoritative for this immutable inventory snapshot only.'};
  const readiness = {schemaVersion:'gridly.lp18811f2.wave0-execution-readiness.v1',authorizationReference:'reports/lp18811f2/owner-governance-decision.json',authorized:true,existingDeployment:{deploymentId:owner.deploymentIdentity.deploymentId,buildIdentity:owner.deploymentIdentity.expectedBuildIdentity,validatedCapabilities:['protected root reachability','build identity document','read-only county package retrieval','package identity comparison'],evidenceReference:'evidence/lp18811/execution-results/owner-result.json'},approvedAssertionCapability:[{assertionId:'CERTIFIED_ARTIFACT_STABILITY',support:'PARTIAL_PACKAGE_IDENTITY_ONLY',blocker:'Existing evidence proves package retrieval/identity, not consumer-loadability.'},...assertions.slice(1).map(a=>({assertionId:a.assertionId,support:'NOT_EXPOSED_BY_EXISTING_PROTECTED_HARNESS',blocker:'No governed fixture inputs, expected fixture outputs, browser journey adapter, or assertion-specific protected evidence endpoint is established.'}))],executionReady:false,executed:false,stopReason:'EXISTING_PROTECTED_DEPLOYMENT_CONTRACT_EXPOSES_ONLY_ROOT_BUILD_IDENTITY_AND_COUNTY_PACKAGE_FILES; IT CANNOT TRUTHFULLY EXECUTE THE SIX APPROVED CONSUMER REGRESSION CONTROLS WITHOUT A SEPARATELY GOVERNED FIXTURE/EXPECTED-RESULT AUTHORITY AND READ-ONLY BROWSER EXECUTION ADAPTER. REDEPLOYMENT OR RUNTIME MUTATION IS NOT AUTHORIZED.',runnerImplemented:false};
  validateWave0(wave0); validateTaxonomy(taxonomy); validateInventory(inventory);
  const summaryOut = {schemaVersion:'gridly.lp18811f2.summary.v2',milestone:'LP188.11F2',ownerDecisionIngested:true,wave0ScopeApproval:'OWNER_APPROVED',severityTaxonomyApproval:'OWNER_APPROVED',historicalExecutedWave0Exists:false,newWave0ExecutionRequired:true,wave0ExecutionAuthorized:true,wave0ExecutionReady:false,wave0Executed:false,wave0ContractDigest:contractDigest,defectTaxonomyDigest:taxonomyDigest,defectInventoryDigest:digest(inventory),governedFindingSourceFamilyCount:sources.length,governedFindingSourceCount:reviewedArtifactCount,defectInventoryRecordCount:inventory.defects.length,defectInventoryCompleteness:'COMPLETE',severity1OpenCount:inventory.derivedCounts.severity1OpenCount,severity2OpenCount:inventory.derivedCounts.severity2OpenCount,state:{executionAttemptedCount:215,executionPendingCount:0,executionFailureCount:0,deploymentConfirmedCount:215,runtimeValidatedCount:215,boundaryValidatedCount:215,regressionValidatedCount:0,consumerValidatedCount:0,telemetryValidatedCount:0,rollbackValidatedCount:0,operationallyValidatedCount:0,independentReviewCompleteCount:0,structurallyActivationEligibleCount:0,currentOperationalCount:summary.currentOperationalCount,restrictedCountyCount:summary.restrictedCountyCount,newActivatedCount:summary.newActivatedCount},overallClassification:'WAVE0_EXECUTION_BLOCKED_EXISTING_PROTECTED_DEPLOYMENT_LACKS_APPROVED_CONTROL_CAPABILITY_DEFECT_AUTHORITY_COMPLETE',protectedRegressionRunnerUnblocked:false,nextAction:'Governance owner must separately authorize/provide immutable fixture inputs and exact fixture expected outputs plus a read-only protected browser adapter capable of the six approved controls against the existing deployment; otherwise authorize a separate non-production deployment. Then execute WAVE_0 only and return real executor/outcome evidence.'};
  return {'wave0-authority-contract.json':wave0,'severity-taxonomy.json':taxonomy,'owner-governance-decision.json':ownerDecision,'defect-inventory.json':inventory,'wave0-execution-readiness.json':readiness,'lp18811f2-summary.json':summaryOut};
}

function main(mode) {
  if (!['build','verify'].includes(mode)) throw Error('usage: govern-wave0-defects.mjs build|verify');
  const files = generate();
  if (mode === 'build') { fs.mkdirSync(path.join(ROOT, OUT), {recursive:true}); for (const [name,value] of Object.entries(files)) fs.writeFileSync(path.join(ROOT,OUT,name), canonical(value)); }
  else for (const [name,value] of Object.entries(files)) if (fs.readFileSync(path.join(ROOT,OUT,name),'utf8') !== canonical(value)) throw Error(`${name} is not deterministic/current`);
  process.stdout.write(`LP188.11F2 ${mode} complete; no execution or activation performed\n`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2]);
