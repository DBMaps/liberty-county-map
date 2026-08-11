#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2] || 'verify';
if (!['build', 'verify'].includes(mode)) throw new Error('usage: build|verify');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, ''));
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const map = (rows, key = 'fips') => new Map(rows.map(row => [row[key], row]));

const identity = read('data/lp149/runtime-county-registry.json');
const membership = read('data/lp150/membership-transition-registry.json');
const enablement = read('data/lp152/operational-enablement-registry.json');
const execution = read('data/lp153/operational-execution-registry.json');
const certification = read('evidence/lp135/statewide-certification.json');
const addresses = read('data/generated/lp104/txgio-addresses/manifest.json');
const crossings = read('Crossing-Packages/production-crossing-manifest.json');
const lp157 = read('data/lp157/texas-community-intelligence-registry.json');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

const byMembership = map(membership.counties);
const byEnablement = map(enablement.counties);
const byExecution = map(execution.counties);
const byCertification = map(certification.counties);
const byAddress = map(addresses.packages);
const crossingByName = new Map(crossings.records.map(row => [`${row.county} County`, row]));
const lp157ByFips = new Map();
for (const community of lp157.communities) {
  if (!lp157ByFips.has(community.countyFips)) lp157ByFips.set(community.countyFips, []);
  lp157ByFips.get(community.countyFips).push(community);
}

// The current runtime registry is executable source rather than JSON. Restrict parsing to its
// declared object and fail closed unless every operational county can be matched by county id.
const runtimePrefix = appSource.slice(0, appSource.indexOf('\n});\n\nfunction gridlyGetRoadwayRuntimeManifestEntry'));
const runtimeCommunities = new Map();
for (const match of runtimePrefix.matchAll(/"([a-z-]+-tx)": Object\.freeze\(\{([\s\S]*?)(?=\n  \}\),\n  "|\n  \}\)\n\}\);)/g)) {
  const countyId = match[1];
  const body = match[2];
  const name = body.match(/\n    name: "([^"]+ County)"/)?.[1];
  const areasText = body.match(/defaultAwarenessAreas: \[(.*?)\]/s)?.[1];
  const operational = /\n    operational: true,/.test(body);
  if (!name || !areasText || !operational) continue;
  const areas = [...areasText.matchAll(/"([^"]+)"/g)].map(x => x[1]);
  runtimeCommunities.set(countyId, { name, areas });
}

if (identity.identities.length !== 254 || new Set(identity.identities.map(x => x.fips)).size !== 254) throw new Error('identity authority must contain 254 unique counties');
for (const source of [byMembership, byEnablement, byExecution, byAddress]) if (source.size !== 254) throw new Error('governance evidence must reconcile to 254 counties');
if (runtimeCommunities.size !== 28) throw new Error(`runtime community extraction expected 28 operational counties, found ${runtimeCommunities.size}`);

const communityRows = [];
const matrix = identity.identities.map(id => {
  const member = byMembership.get(id.fips), enabled = byEnablement.get(id.fips), exec = byExecution.get(id.fips), cert = byCertification.get(id.fips), address = byAddress.get(id.fips);
  if (!member || !enabled || !exec || !address || (cert && cert.county !== id.countyName)) throw new Error(`missing or ambiguous evidence for ${id.fips}`);
  const operational = id.operationalMembership.active === true && member.currentOperationalMembership === true && exec.currentOperational === true;
  const runtime = runtimeCommunities.get(id.countyId);
  if (operational && !runtime) throw new Error(`operational county lacks runtime awareness inventory: ${id.countyId}`);
  const governed = (lp157ByFips.get(id.fips) || []).slice().sort((a,b) => a.name.localeCompare(b.name));
  const names = runtime ? runtime.areas.filter(name => name !== id.countyName && name !== `Entire ${id.countyName}`) : governed.map(x => x.name);
  const countywide = runtime ? runtime.areas.some(name => name === id.countyName || name === `Entire ${id.countyName}`) : false;
  const duplicateWithinCounty = [...new Set(names.filter((name, i) => names.findIndex(x => x.toLocaleLowerCase() === name.toLocaleLowerCase()) !== i))].sort();
  const inventoryPresent = names.length > 0;
  const communityRuntimeReady = Boolean(runtime && countywide && names.length);
  const restricted = cert?.certificationStatus === 'CERTIFICATION_BLOCKED';
  const crossing = crossingByName.get(id.countyName);
  const completeness = operational ? 'REFERENCE_RUNTIME_PRESENT_COMPLETENESS_NOT_AUTHORITATIVELY_CERTIFIED' : inventoryPresent ? 'PARTIAL_NOT_RUNTIME_INTEGRATED' : 'MISSING';
  const statewidePathStatus = operational ? 'ALREADY_OPERATIONAL' : restricted ? 'ADDRESS_RESTORATION_REQUIRED' : 'COMMUNITY_STRUCTURE_REQUIRED';
  const secondary = [];
  if (!communityRuntimeReady) secondary.push('COMMUNITY_INVENTORY_NOT_RUNTIME_READY', 'COUNTYWIDE_FALLBACK_NOT_RUNTIME_PROVEN', 'COMMUNITY_COMPLETENESS_NOT_CERTIFIED');
  if (!crossing) secondary.push('NO_PRODUCTION_CROSSING_PACKAGE_NON_BLOCKING');
  if (!operational) secondary.push('CANDIDACY_MEMBERSHIP_DEPLOYMENT_AND_ACTIVATION_GOVERNANCE_ABSENT');
  communityRows.push({
    countyName: id.countyName, countyFips: id.fips, countyId: id.countyId, currentOperationalStatus: operational ? 'OPERATIONAL' : 'NON_OPERATIONAL',
    inventoryPresent, inventorySource: runtime ? 'js/app.js#GRIDLY_COUNTY_REGISTRY.defaultAwarenessAreas' : governed.length ? 'data/lp157/texas-community-intelligence-registry.json' : null,
    communityCount: names.length, communityNames: names, classificationsRepresented: runtime ? ['RUNTIME_LABEL_UNTYPED'] : [...new Set(governed.map(x => x.classification))].sort(),
    incorporatedMunicipalitiesCoverage: governed.length ? (governed.some(x => ['city','town','village'].includes(x.classification)) ? 'PARTIAL_PRESENT_NOT_COMPLETE' : 'NOT_PRESENT') : 'NOT_AUDITABLE_FROM_RUNTIME_LABELS',
    censusDesignatedPlacesCoverage: governed.some(x => x.classification === 'cdp') ? 'PARTIAL_PRESENT_NOT_COMPLETE' : 'NOT_PROVEN',
    unincorporatedCommunityCoverage: governed.some(x => x.classification.includes('unincorporated')) ? 'PARTIAL_PRESENT_NOT_COMPLETE' : 'NOT_PROVEN',
    countywideFallbackPresent: countywide, countyQualifiedIdentity: governed.length ? 'YES_BY_COUNTY_FIPS' : runtime ? 'COUNTY_SCOPED_IN_RUNTIME_CONFIG' : 'NO',
    duplicateNamesWithinCounty: duplicateWithinCounty, coordinatesPresentCount: governed.filter(x => Number.isFinite(x.coordinates?.lat) && Number.isFinite(x.coordinates?.lon)).length,
    geometryPresentCount: 0, coordinateContainmentStatus: governed.length ? 'NOT_CERTIFIED_AGAINST_COUNTY_GEOMETRY' : 'NOT_APPLICABLE', runtimeSelectable: communityRuntimeReady,
    reportsHazardsAlertsAssociation: communityRuntimeReady ? 'NAME_BASED_RUNTIME_PATH_PRESENT_IDENTITY_WEAKNESS_REMAINS' : 'NOT_RUNTIME_READY',
    searchLocationResolution: communityRuntimeReady ? 'CURRENT_RUNTIME_LABEL_AND_ANCHOR_PATH_PRESENT_NOT_STATEWIDE_CERTIFIED' : 'NOT_RUNTIME_READY',
    crossingScoping: communityRuntimeReady && crossing ? 'CURRENT_RUNTIME_AREA_FILTER_PRESENT' : crossing ? 'COMMUNITY_SCOPE_NOT_RUNTIME_READY' : 'NO_PACKAGE_NON_BLOCKING',
    communityCompletenessStatus: completeness
  });
  return {
    countyName: id.countyName, countyFips: id.fips, currentOperationalStatus: operational ? 'OPERATIONAL' : 'NON_OPERATIONAL',
    addressIdentityPresent: true, addressPayloadAvailable: !restricted, addressCertified: !restricted,
    communityInventoryPresent: inventoryPresent, communityCount: names.length, communityNames: names, communityInventorySource: communityRows.at(-1).inventorySource,
    communityCountywideFallbackPresent: countywide, communityRuntimeReady, communityCompletenessStatus: completeness,
    crossingPackagePresent: Boolean(crossing), crossingCertified: crossing?.status === 'PASS', crossingCount: crossing?.crossingCount || 0,
    runtimeIdentityPresent: true, runtimeGeometryPresent: id.runtimeGeometry.present === true,
    candidateStatus: member.candidateMembershipStatus, membershipStatus: member.approvedMembershipStatus,
    deploymentAuthorizationStatus: enabled.deploymentAuthorization.state, deploymentStatus: enabled.deployment.state,
    activationAuthorizationStatus: enabled.activationAuthorization.state, activationStatus: enabled.activation.state,
    restrictionStatus: restricted ? 'ACTIVE_PRESERVED' : 'NONE', restrictionReason: restricted ? 'LOCAL_PACKAGE_UNAVAILABLE' : null,
    primaryBlocker: operational ? null : restricted ? 'EXACT_LP130_ADDRESS_PAYLOAD_RESTORATION_AND_RECERTIFICATION_REQUIRED' : 'COMMUNITY_STRUCTURE_AND_RUNTIME_INTEGRATION_REQUIRED_BEFORE_GOVERNANCE',
    secondaryBlockers: secondary, statewidePathStatus,
    recommendedNextAction: operational ? 'Retain as Wave 0 regression baseline; certify community completeness and stable identity.' : restricted ? 'Prepare community structure independently; preserve restriction until exact payload size/SHA-256 verification and two unchanged LP134 certification passes.' : 'Manufacture and certify authoritative county-qualified community inventory, countywide fallback, geographic containment, stable awareness identity, and runtime integration before candidacy.'
  };
});

matrix.sort((a,b) => a.countyFips.localeCompare(b.countyFips));
communityRows.sort((a,b) => a.countyFips.localeCompare(b.countyFips));
const countPath = status => matrix.filter(x => x.statewidePathStatus === status).length;
const duplicateNames = new Map();
for (const row of communityRows) for (const name of row.communityNames) {
  const key = name.toLocaleLowerCase(); if (!duplicateNames.has(key)) duplicateNames.set(key, []); duplicateNames.get(key).push(row.countyFips);
}
const crossCountyDuplicates = [...duplicateNames.entries()].filter(([,fips]) => new Set(fips).size > 1).map(([name,fips]) => ({normalizedName:name, countyFips:[...new Set(fips)].sort()})).sort((a,b)=>a.normalizedName.localeCompare(b.normalizedName));
const restrictedRows = matrix.filter(x => x.restrictionStatus === 'ACTIVE_PRESERVED');
const restrictions = restrictedRows.map(row => ({countyName:row.countyName,countyFips:row.countyFips,restrictionStatus:'PRESERVED',reason:'LOCAL_PACKAGE_UNAVAILABLE',communityPreparationIndependent:true,restorationSteps:['Restore or securely mount the exact immutable LP130 payload.','Verify the restored byte size against governed evidence.','Verify SHA-256 against governed evidence.','Run unchanged LP134 certification once and require PASS.','Run unchanged LP134 certification a second time and require PASS.','Rebuild downstream certification/governance inputs without clearing or inferring owner authorization.'],restrictionClearancePerformed:false}));
const waves = {
  milestone:'LP187',target:'254 / 254 TEXAS COUNTIES OPERATIONAL',authorizationState:'PROPOSED_NOT_AUTHORIZED',groupingPrinciple:'shared technical prerequisites, not arbitrary batch sizes',
  waves:[
    {wave:'WAVE_0_REGRESSION_BASELINE',prerequisite:'CURRENT_OPERATIONAL',countyFips:matrix.filter(x=>x.statewidePathStatus==='ALREADY_OPERATIONAL').map(x=>x.countyFips),executionAuthorized:false},
    {wave:'WAVE_1_STATEWIDE_COMMUNITY_MANUFACTURING',prerequisite:'AUTHORITATIVE_COMMUNITY_SOURCE_ACQUISITION_AND_DETERMINISTIC_MANUFACTURING',countyFips:matrix.filter(x=>x.statewidePathStatus==='COMMUNITY_STRUCTURE_REQUIRED').map(x=>x.countyFips),executionAuthorized:false},
    {wave:'WAVE_2_GOVERNANCE_PREPARATION',prerequisite:'COMMUNITY_COMPLETENESS_RUNTIME_IDENTITY_AND_CONTAINMENT_CERTIFIED',countyFips:matrix.filter(x=>x.statewidePathStatus==='COMMUNITY_STRUCTURE_REQUIRED').map(x=>x.countyFips),executionAuthorized:false},
    {wave:'FINAL_RESTRICTED_RESTORATION_AND_GOVERNANCE',prerequisite:'EXACT_PAYLOAD_RESTORED_SIZE_AND_SHA_VERIFIED_UNCHANGED_LP134_PASSES_TWICE_PLUS_COMMUNITY_CERTIFICATION',countyFips:restrictedRows.map(x=>x.countyFips),executionAuthorized:false}
  ],allCountyCoverageCount:new Set(matrix.map(x=>x.countyFips)).size,safety:{activationPerformed:false,deploymentPerformed:false,membershipChanged:false,restrictionRemoved:false,authorizationGranted:false}
};
const summary = {
  milestone:'LP187',mode:'STATEWIDE_FOUNDATION_AUDIT_GOVERNANCE_PREPARATION_ONLY',finalClassification:'NO_COMPLETE_STRUCTURAL_FOUNDATION',target:'254 / 254 TEXAS COUNTIES OPERATIONAL',
  deterministicPrecedence:['ALREADY_OPERATIONAL','ADDRESS_RESTORATION_REQUIRED','CERTIFICATION_REQUIRED','COMMUNITY_STRUCTURE_REQUIRED','RUNTIME_INTEGRATION_REQUIRED','STRUCTURE_READY_GOVERNANCE_REQUIRED','OWNER_EVIDENCE_REQUIRED','UNKNOWN_REQUIRES_RECONCILIATION'],
  counts:{total:254,currentOperational:countPath('ALREADY_OPERATIONAL'),unrestrictedNonOperational:215,restricted:countPath('ADDRESS_RESTORATION_REQUIRED'),structureReadyGovernanceRequired:countPath('STRUCTURE_READY_GOVERNANCE_REQUIRED'),communityStructureRequired:countPath('COMMUNITY_STRUCTURE_REQUIRED'),otherRepositoryWorkRequired:0,ownerEvidenceRequired:0,unknown:0},
  communityCoverage:{countiesWithAnyInventory:communityRows.filter(x=>x.inventoryPresent).length,zeroCommunityCounties:communityRows.filter(x=>!x.inventoryPresent).length,runtimeReadyCounties:communityRows.filter(x=>x.runtimeSelectable).length,countywideFallbackCounties:communityRows.filter(x=>x.countywideFallbackPresent).length,completeCounties:0,incompleteCounties:254,totalDistinctCountyCommunityRecords:communityRows.reduce((n,x)=>n+x.communityCount,0),crossCountyDuplicateNames:crossCountyDuplicates},
  communityModel:{authoritativeRuntimeOwner:'GRIDLY_COUNTY_REGISTRY.defaultAwarenessAreas in js/app.js, copied into GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY',countywideDefinition:'A county-scoped label equal to County Name or Entire County Name; only current operational registry entries prove it.',communityDefinition:'Current runtime uses untyped county-scoped human-readable awareness labels; LP157 separately models city, town, CDP, and recognized_unincorporated_community but is a 22-record seed, not statewide runtime authority.',semanticsNotEquivalent:true,completenessRequirement:'Must authoritatively cover incorporated places, applicable CDPs, governed relevant unincorporated communities, and countywide fallback, with stable county-qualified identity and geographic containment.',identityFinding:'Runtime filtering frequently accepts human-readable awarenessArea/community/city/town fields; statewide same-name collision safety is not certified.',reference28Reusable:false,referenceFinding:'All 28 have selectable lists and county fallback, but lists are hardcoded, mostly untyped, lack per-community geometry, and have no statewide completeness certificate.'},
  unrestricted215:{preparedTogetherNow:false,directGovernancePreparationCount:0,communityManufacturingRequiredCount:215,finding:'One deterministic manufacturing framework may process all 215 after an authoritative statewide source and completeness policy exist; current evidence does not justify candidacy or authorization as one cohort.'},
  restricted11:{count:11,communityPreparationIndependent:true,addressClearance:'Exact LP130 payload restored/securely mounted; size and SHA-256 verified; unchanged LP134 passes twice; restriction remains until governed clearance.'},
  crossings:{certifiedCountyPackages:crossings.passCount,certifiedCrossings:crossings.totalCrossings,countiesWithoutPackage:254-crossings.totalPackages,awarenessFirstActivationBlocker:false,finding:'Current governance does not make crossings an activation prerequisite. Community awareness can operate without them, but Route Watch/Destination Intelligence must truthfully expose unavailable crossing coverage and avoid completeness claims.'},
  sharedSystems:{statewideReady:false,finding:'County-aware runtime paths exist, but current operational county registry and awareness lists are explicit 28-county configuration; stable statewide community/awareness identity and end-to-end association certification are absent.',protectedRuntimeModified:false},
  supabaseIdentity:{statewideReady:false,productionConnectionPerformed:false,blocker:'Repository contracts accept several name fields and coordinates, but do not prove mandatory county FIPS plus stable awareness-area/community ID on every report/hazard/alert. Same-name collision handling is therefore not activation-safe statewide.'},
  performance:{statewideReadyForExpansion:false,currentBoundary:'County runtime sources are selected from registry and roadway/crossing assets load by active county or manifest entry; identity/community configuration itself is eagerly embedded in app.js.',blocker:'No measured 254-county community registry/loading certificate; do not embed manufactured statewide place geometry or address/crossing payloads eagerly.'},
  hardcodingAudit:[{location:'js/app.js#GRIDLY_DEFAULT_COUNTY_ID',classification:'CURRENT_OPERATIONAL_CONFIGURATION'},{location:'js/app.js#GRIDLY_COUNTY_REGISTRY',classification:'CURRENT_OPERATIONAL_CONFIGURATION_AND_STATEWIDE_BLOCKER_FOR_UNREGISTERED_COUNTIES'},{location:'js/gridlyPackageRegistry.js community awarenessAreas',classification:'SAFE_REFERENCE_DATA_FOR_CURRENT_PACKAGES_NOT_STATEWIDE_AUTHORITY'},{location:'data/lp157/texas-community-intelligence-registry.json Liberty benchmark aliases',classification:'SAFE_REFERENCE_DATA_PARTIAL'}],
  governancePath:['KNOWN_NOT_CANDIDATE','CANDIDATE','APPROVED / MEMBERSHIP AUTHORIZED','DEPLOYMENT AUTHORIZED','DEPLOYED','ACTIVATION AUTHORIZED','ACTIVATED','OPERATIONAL'],
  governanceEvidence:{identity:'LP149 runtime identity registry + test:lp149',membership:'LP150 membership transition registry + test:lp150',validation:'LP151 statewide operational validation + test:lp151',deploymentPreparation:'LP152 operational enablement registry + test:lp152',execution:'LP153 operational execution registry + test:lp153',address:'LP135 statewide certification; restricted restoration uses unchanged LP134 twice',candidateAuthorizationInputs:'LP140 wave plan, LP141 dossiers, LP142 audit, LP143 activation authorization framework, LP144 operational authorization manufacturing; owner authority must not be inferred.'},
  nextMilestone:'LP188 — acquire/govern an authoritative statewide Texas place/community source and manufacture a deterministic 254-county community/awareness registry with incorporated-place/CDP policy, reviewed unincorporated-community policy, stable IDs, county FIPS, countywide fallback, coordinates/geometry containment, duplicate-name qualification, runtime-loading contract, and certification. Do not manufacture candidacy until it passes.',
  safety:{candidateArtifactsPreparedOnly:true,authorizationGranted:false,activationPerformed:false,deploymentPerformed:false,membershipChanged:false,restrictionRemoved:false,productionSupabaseTouched:false}
};

if (summary.counts.currentOperational !== 28 || summary.counts.communityStructureRequired !== 215 || summary.counts.restricted !== 11) throw new Error('primary classifications do not reconcile to 254');
if (waves.allCountyCoverageCount !== 254 || restrictions.length !== 11) throw new Error('wave/restriction coverage mismatch');
const outputs = new Map([
  ['reports/lp187/texas-statewide-activation-foundation-summary.json',summary],
  ['reports/lp187/texas-county-community-readiness.json',communityRows],
  ['reports/lp187/texas-county-activation-prerequisite-matrix.json',matrix],
  ['reports/lp187/texas-activation-wave-plan.json',waves],
  ['reports/lp187/restricted-county-restoration-plan.json',restrictions]
]);
for (const [relative,value] of outputs) {
  const target=path.join(root,relative), content=stable(value);
  if (mode==='build') { fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content); }
  else if (!fs.existsSync(target) || fs.readFileSync(target,'utf8')!==content) throw new Error(`${relative} is missing or stale`);
}
console.log(`LP187 ${mode} PASS: 254 counties; 28 operational; 215 community structure required; 11 restricted; ${summary.communityCoverage.countiesWithAnyInventory} inventories; ${summary.communityCoverage.runtimeReadyCounties} runtime-ready`);
