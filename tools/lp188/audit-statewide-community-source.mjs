#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2] || 'verify';
if (!['build', 'verify'].includes(mode)) throw new Error('usage: build|verify');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');

const identity = read('data/lp149/runtime-county-registry.json');
const lp157 = read('data/lp157/texas-community-intelligence-registry.json');
const lp187 = read('reports/lp187/texas-statewide-activation-foundation-summary.json');
const sourceGap = read('evidence/lp127a/texas-statewide-source-gap-report.json');
const restricted = read('reports/lp187/restricted-county-restoration-plan.json');
const countyFips = new Set(identity.identities.map(row => row.fips));
if (identity.identities.length !== 254 || countyFips.size !== 254) throw new Error('LP149 must provide 254 unique Texas county identities');

const inspected = [
  'data/lp157/texas-community-intelligence-registry.json',
  'reports/lp187/texas-county-community-readiness.json',
  'evidence/lp122/wave-1-authoritative-community-destination-evidence.json',
  'evidence/lp124/sources/census-tiger-2025-county-identity-source.json',
  'evidence/lp126/texas-statewide-multi-class-evidence.json',
  'evidence/lp127a/texas-statewide-source-gap-report.json',
  'Community-Packages/county-manifest.json'
].map(relativePath => ({ relativePath, sha256: sha256(relativePath) }));

const report = {
  milestone: 'LP188',
  title: 'Statewide Texas Community/Awareness Foundation Source Authority Gate',
  mode: 'AUDIT_SOURCE_AUTHORITY_FIRST',
  finalClassification: 'STATEWIDE_COMMUNITY_SOURCE_REQUIRED',
  target: '254 / 254 TEXAS COUNTIES OPERATIONAL',
  decision: {
    sourceGatePassed: false,
    manufacturingStarted: false,
    certificationStarted: false,
    reason: 'The repository has authoritative statewide county identity and geometry, but no preserved authoritative statewide Texas place source containing complete incorporated-place and CDP identities, classifications, county relationships, and geographic evidence.',
    prohibitedSubstitutionsRejected: ['28 hardcoded runtime awareness lists', 'LP157 partial seed records', 'address-derived locality strings', 'destination-derived locality strings', 'arbitrary geocoder results', 'manual or model-authored place lists']
  },
  sourceAuthorityAudit: {
    inspectedArtifacts: inspected,
    usableAuthorities: [
      { source: 'LP149 runtime county registry', scope: '254 Texas county identities only', usableForPlaces: false },
      { source: 'authoritative county geometry runtime artifact', scope: 'county containment validation after place acquisition', usableForPlaces: false }
    ],
    insufficientArtifacts: [
      { source: 'data/lp157/texas-community-intelligence-registry.json', recordCount: lp157.communities.length, finding: 'Partial governed seed, not statewide complete and not a source snapshot.' },
      { source: 'GRIDLY_COUNTY_REGISTRY.defaultAwarenessAreas', countyCount: lp187.communityCoverage.runtimeReadyCounties, finding: 'Untyped consumer runtime labels for the current 28; not statewide source authority.' },
      { source: 'Community-Packages', finding: 'Existing package manifests describe current county runtime assets; they do not preserve a statewide incorporated-place/CDP source.' },
      { source: 'LP127A source audit', finding: sourceGap.confirmedAbsentAccessibleLocations.find(row => row.dataset.includes('municipal boundaries'))?.status || 'SOURCE_NOT_PRESERVED' }
    ]
  },
  exactMissingSource: {
    requiredClass: 'AUTHORITATIVE_US_CENSUS_TIGER_LINE_TEXAS_PLACES_AND_PLACE_COUNTY_RELATIONSHIPS',
    recommendedAcquisition: [
      'Preserve an official Census TIGER/Line Texas place shapefile for one declared vintage (state FIPS 48).',
      'Preserve the matching official Census place-to-county relationship file, or derive memberships by deterministic intersection with the governed county geometry and retain intersection evidence.',
      'Record upstream URLs, vintage, retrieval metadata, byte size, and SHA-256 in a repository source manifest.',
      'Import only after license/public-domain status, schema, Texas scope, and source hashes validate.',
      'Run LP188 manufacturing twice in isolated directories and compare every byte before promoting generated artifacts.'
    ],
    requiredFields: ['STATEFP', 'PLACEFP', 'GEOID', 'NAME', 'NAMELSAD or LSAD', 'MTFCC or equivalent place classification', 'geometry', 'source vintage'],
    requiredRelationshipEvidence: ['county FIPS', 'canonical place GEOID', 'source-supported or geometry-intersection county membership', 'multi-county intersection evidence'],
    validationRequirements: ['state FIPS equals 48', 'unique canonical place GEOID', 'valid incorporated-place versus CDP classification', 'valid geometry', 'membership intersects governed Texas county geometry', 'all source places represented without silent dropping'],
    ownerActionRequired: true,
    optionalFutureLayer: { type: 'RECOGNIZED_UNINCORPORATED_COMMUNITY', status: 'DEFERRED_SOURCE_REQUIRED', recommendedSourceClass: 'authoritative GNIS Populated Place snapshot with explicit deterministic inclusion/exclusion policy; do not block incorporated-place/CDP/countywide foundation' }
  },
  governedSemanticsPrepared: {
    INCORPORATED_PLACE: 'Include when official source classification identifies an incorporated place.',
    CENSUS_DESIGNATED_PLACE: 'Include separately when official source classification identifies a CDP.',
    RECOGNIZED_UNINCORPORATED_COMMUNITY: 'Exclude from the base build until a preserved authoritative populated-place source and policy exist.',
    COUNTYWIDE: 'Exactly one record per county, created only after the place source gate passes; it uses county identity/geometry and no fabricated coordinate.'
  },
  identityContractPrepared: {
    countyIdentity: 'countyFips = 5-character Census county GEOID',
    canonicalPlaceIdentity: 'canonicalPlaceId = census-place:<7-character place GEOID>',
    awarenessAreaIdentity: 'place membership: tx:<countyFips>:place:<placeGEOID>; countywide: tx:<countyFips>:countywide',
    multiCountyPolicy: 'One canonical place identity plus one county-qualified awareness membership in each source-supported intersecting county.',
    duplicateNamePolicy: 'Names never identify records; selection is county-qualified and out-of-county labels may render as <name>, <county> without changing identity.'
  },
  counts: {
    texasCounties: 254,
    countyPackages: 0,
    countywideFallbacks: 0,
    canonicalPlaces: 0,
    incorporatedPlaces: 0,
    censusDesignatedPlaces: 0,
    recognizedUnincorporatedCommunities: 0,
    countyMemberships: 0,
    multiCountyPlaces: 0,
    duplicateDisplayNameGroups: 0,
    certifiedCounties: 0,
    failedCounties: 254
  },
  workAllowedBeforeAcquisition: ['source importer/schema validator', 'stable identity contract', 'county containment harness', 'deterministic serializer and two-pass comparator', 'current-28 reconciliation rules', 'on-demand package-loading documentation'],
  runtimeLoadingContract: 'Future runtime loads a lightweight manifest, then only the resolved active-county package, caches it by SHA-256, and switches packages on county change. It must not eagerly load 254 packages.',
  performance: { status: 'NOT_MEASURABLE_BEFORE_MANUFACTURING', manifestBytes: null, totalPackageBytes: null, minCountyPackageBytes: null, medianCountyPackageBytes: null, maxCountyPackageBytes: null, activeCountyPayloadEstimate: null },
  restrictedCountyStatus: restricted.map(row => ({ countyName: row.countyName, countyFips: row.countyFips, communityStatus: 'SOURCE_GATE_BLOCKED_WITH_ALL_COUNTIES', downstreamActivationBlocker: 'ADDRESS_RESTORATION_REQUIRED', restrictionPreserved: true })),
  downstreamIdentityMigration: {
    productionMutationPerformed: false,
    futureRequiredFields: {
      reports: ['countyFips', 'awarenessAreaId', 'canonicalPlaceId when place-scoped'],
      hazards: ['countyFips', 'awarenessAreaId', 'canonicalPlaceId when place-scoped'],
      alerts: ['countyFips', 'awarenessAreaId'],
      locationContext: ['countyFips', 'awarenessAreaId', 'canonicalPlaceId when resolved'],
      awarenessAndCrossingFiltering: ['countyFips', 'awarenessAreaId'],
      searchDestinationContext: ['countyFips', 'canonicalPlaceId when applicable']
    }
  },
  safety: { countiesActivated: false, countiesDeployed: false, operationalMembershipChanged: false, authorizationGranted: false, addressRestrictionsRemoved: false, productionSupabaseMutated: false, runtimeBehaviorChanged: false }
};

if (report.restrictedCountyStatus.length !== 11 || report.counts.failedCounties !== 254) throw new Error('fail-closed coverage does not reconcile');
const output = 'reports/lp188/statewide-community-source-gate.json';
const content = serialize(report);
const target = path.join(root, output);
if (mode === 'build') { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) throw new Error(`${output} is missing or stale`);
console.log(`LP188 ${mode} PASS: STATEWIDE_COMMUNITY_SOURCE_REQUIRED; 0 packages manufactured; 254 counties fail closed`);
