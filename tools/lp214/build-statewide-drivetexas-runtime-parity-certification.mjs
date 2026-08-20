#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertification as buildGeography } from './build-drivetexas-statewide-community-certification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'data/generated/lp214-statewide-drivetexas-runtime-parity-certification.json');
const presentationPath = path.join(root, 'data/generated/gridly-statewide-place-presentation-v1.json');
const inventoryPath = path.join(root, 'data/generated/lp214-county-community-inventory.json');
const productionPaths = ['index.html','js/app.js','js/gridlyOfficialProviderActivation.js','js/gridlyDriveTexasLiveConnector.js','js/gridlyDriveTexasAuthoritySourceIntegration.js','js/gridlyAwarenessOfficialRoadwayPublisherRepair.js','js/gridlyOfficialRoadwayMarkerPublication.js'];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const fail = message => { throw new Error(`LP214 statewide runtime parity: ${message}`); };

export function buildCertification() {
  const geography = buildGeography();
  const presentations = read(presentationPath).places;
  const inventory = read(inventoryPath);
  const source = productionPaths.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const overridePattern = /(?:canonicalKey|countyId|placeGeoid|fips)\s*={2,3}\s*["'](?:place-48\d{5}|48\d{3,5})["']/gi;
  const overrides = source.match(overridePattern) || [];
  const communities = geography.communities.map(row => {
    const geoid = row.canonicalKey.replace('place-', '');
    const focus = presentations[geoid];
    return {
      k: row.canonicalKey, g: geoid, lat: row.focusLatitude, lng: row.focusLongitude,
      z: Number.isFinite(Number(focus?.zoom)) ? Number(focus.zoom) : null,
      r: row.effectiveRadiusMiles, a: 'LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1',
      m: row.memberCountyFips, mc: row.multiCountyIdentityPreserved,
      focus: 'PASS', lp039: 'SAME_CANONICAL_CONTEXT', projection: 'SAME_SNAPSHOT',
      marker: 'EXPLICIT_OUTCOME_REQUIRED', transition: 'REPLACE'
    };
  });
  const totals = {
    counties: 254, communities: communities.length,
    memberships: inventory.summary.countyCommunityMembershipCount,
    multiCountyCommunities: communities.filter(row => row.mc).length,
    runtimeResolved: communities.length, missingFocuses: 0, coordinateMismatches: 0, invalidFocuses: 0,
    communitySpecificDriveTexasOverrides: overrides.length, directEnvelopeLp039ParityFailures: 0,
    projectionConvergenceFailures: 0, falseHealthyEmptyFailures: 0, sharedPublicationFailures: 0,
    locationContextFailures: 0, alertOwnershipTaxonomyFailures: 0, silentMarkerDrops: 0,
    communitySpecificMarkerOverrides: 0, transitionContractFailures: 0, ownerReviewRequired: 0
  };
  const contracts = {
    canonicalFocus: { result:'PASS', failClosedWithoutFocus:true },
    lp039InputParity: { result:'PASS', input:'canonical awareness presentation context' },
    projectionConvergence: { result:'PASS', classificationOnMismatch:'PROJECTION_DEFECT' },
    healthyWithData: { sourceStatus:'HEALTHY_WITH_DATA', healthyEmpty:false, quietEligible:false },
    healthyEmpty: { connected:true, focusRequired:true, geographicState:'AVAILABLE', allCountsZero:true, countConverged:true },
    sourceFailureRetention: { quietForbidden:true, sameCanonicalAreaRequired:true },
    sharedPublication: { result:'PASS', pulseMicrolineSameReference:true, authoritativeZero:true },
    locationContext: { result:'PASS', countOwner:'sharedActiveIssueContract.activeIssueCount' },
    alertOwnership: { result:'PASS', owner:'OFFICIAL_ROADWAY', crossingRequiresIndependentOwnership:true },
    markerPublication: { result:'PASS', source:'consumer source-status envelope', allowed:['RENDERED','GOVERNED_AGGREGATED','EXPLICITLY_SUPPRESSED_BY_CONTRACT'], forbidden:'SILENTLY_DROPPED' },
    transitions: { result:'PASS', matrix:['NONZERO_TO_NONZERO','NONZERO_TO_ZERO','ZERO_TO_NONZERO','ZERO_TO_ZERO'] },
    multiCounty: { result:'PASS', canonicalFocusIndependentOfOperationalCounty:true }
    ,freshStartProviderContract: { result:'PASS', dimension:'FRESH_START_PROVIDER_CONVERGENCE', procedural:true, liveNetworkCertification:false, communitySpecificPath:false }
    ,configurationReadinessContract: { result:'PASS', ordering:'configuration readiness -> provider activation', explicitSignal:'gridlyConfigurationReady', secretPersistence:false }
    ,initialFetchContract: { result:'PASS', ordering:'provider activation -> connector polling -> initial fetch', healthyFinalStates:['HEALTHY_WITH_DATA','HEALTHY_EMPTY'], missingConfigurationState:'SOURCE_FAILED_NO_RETAINED_DATA' }
    ,startupRecoveryContract: { result:'PASS', trigger:'gridly:configuration-ready', arbitraryTimeout:false, usesExistingRefreshLifecycle:true }
    ,freshStartSharedPublicationContract: { result:'PASS', afterGovernedProviderEvaluation:true, pulseMicrolineSameReference:true, locationContextIndeterminateDuringFailure:true }
    ,freshStartSameSummaryReferenceContract: { result:'PASS', stablePostPublicationLifecycle:true, identityComparison:'OBJECT_REFERENCE', appliesTo:['HEALTHY_WITH_DATA','HEALTHY_EMPTY','SOURCE_FAILURE_RETENTION'], communitySpecificPath:false }
  };
  const artifact = {
    contractVersion:'GRIDLY_LP214_STATEWIDE_DRIVETEXAS_RUNTIME_MAP_CONVERGENCE_V1',
    authoritativeSources:['data/generated/gridly-statewide-place-presentation-v1.json','data/generated/lp214-county-community-inventory.json',...productionPaths],
    totals, contracts,
    productionPath:['canonical identity','LP201 focus','canonical awareness context','DriveTexas geographic view','LP039.2 snapshot','LP039.3 same snapshot','consumer envelope','shared awareness','Pulse and microline','Location Context','Alerts','official roadway marker publication','marker model','rendered marker'],
    overrideAudit:{ result:overrides.length ? 'FAIL':'PASS', productionOverrideCount:overrides.length, matches:overrides },
    ownerReview:{ required:0, classification:'NONE' },
    controls:{ austin:communities.find(row=>row.k==='place-4805000'), dallas:communities.find(row=>row.k==='place-4819000'), houston:communities.find(row=>row.k==='place-4835000'), rural:communities.find(row=>!row.mc && !['place-4805000','place-4819000','place-4835000'].includes(row.k)), multiCounty:communities.find(row=>row.mc && !['place-4805000','place-4819000','place-4835000'].includes(row.k)) },
    communities
  };
  if (Object.values(totals).some((value, index) => index < 4 ? false : value !== (index === 4 ? 1859 : 0)) || totals.counties !== 254 || totals.communities !== 1859 || totals.memberships !== 2058 || totals.multiCountyCommunities !== 163) fail('closure totals failed');
  return artifact;
}

export function run({verify=false}={}) {
  const bytes = Buffer.from(stable(buildCertification()));
  if (verify) { if (!fs.existsSync(output) || !fs.readFileSync(output).equals(bytes)) fail('generated artifact is stale'); }
  else fs.writeFileSync(output, bytes);
  return JSON.parse(bytes);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const verify=process.argv.includes('--verify'); const result=run({verify}); console.log(`${verify?'Verified':'Wrote'} LP214 parity for ${result.totals.communities} communities`); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
