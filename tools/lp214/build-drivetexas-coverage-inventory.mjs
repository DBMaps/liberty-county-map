#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const paths = Object.freeze({
  phase1: path.join(root, 'data/generated/lp214-county-community-inventory.json'),
  presentation: path.join(root, 'data/generated/gridly-statewide-place-presentation-v1.json'),
  output: path.join(root, 'data/generated/lp214-drivetexas-coverage-inventory.json')
});

export const TAXONOMY = Object.freeze({
  applicability: ['APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN'],
  staticCapability: ['SUPPORTED', 'PARTIAL', 'UNSUPPORTED', 'UNKNOWN'],
  spatialResolutionCapability: ['MIXED_GEOMETRY_AND_PROXIMITY_SUPPORTED', 'COUNTY_ONLY', 'UNSUPPORTED', 'UNKNOWN'],
  sourceHealthCapability: ['HEALTHY_WITH_DATA_DISTINGUISHABLE', 'HEALTHY_EMPTY_DISTINGUISHABLE', 'SOURCE_FAILURE_DISTINGUISHABLE', 'AMBIGUOUS_EMPTY_FAILURE_STATE', 'NO_SOURCE_HEALTH_CONTRACT', 'NOT_APPLICABLE', 'OWNER_RUNTIME_REVIEW_REQUIRED', 'UNKNOWN'],
  liveVerificationStatus: ['NOT_PERFORMED', 'EXISTING_CERTIFIED_EVIDENCE', 'OWNER_RUNTIME_REQUIRED', 'NOT_APPLICABLE']
});

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const fail = message => { throw new Error(`LP214 DriveTexas coverage inventory: ${message}`); };
const ordered = rows => rows.every((row, i) => !i || rows[i - 1].canonicalKey.localeCompare(row.canonicalKey) < 0);

// Models the connector result contract without importing or activating browser runtime code.
export function classifySourceOutcome(outcome) {
  if (outcome?.connected === true) return Number(outcome.normalizedRecordCount) > 0 ? 'HEALTHY_WITH_DATA_DISTINGUISHABLE' : 'HEALTHY_EMPTY_DISTINGUISHABLE';
  if (outcome?.connected === false && outcome?.error) return 'SOURCE_FAILURE_DISTINGUISHABLE';
  return 'UNKNOWN';
}

function canonicalPhase1Communities(phase1) {
  const byKey = new Map();
  for (const county of phase1.counties || []) for (const row of county.communities || []) {
    const prior = byKey.get(row.canonicalKey);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) fail(`conflicting Phase 1 identity ${row.canonicalKey}`);
    byKey.set(row.canonicalKey, row);
  }
  return [...byKey.values()].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
}

export function validateInventory(artifact, phase1 = read(paths.phase1)) {
  if (artifact?.schemaVersion !== 'gridly.lp214.drivetexas-coverage-inventory.v1') fail('unsupported schemaVersion');
  if (!Array.isArray(artifact.communities) || artifact.communities.length !== 1859 || !ordered(artifact.communities)) fail('communities must contain 1,859 uniquely ordered records');
  const phase1Rows = canonicalPhase1Communities(phase1);
  if (JSON.stringify(artifact.communities.map(row => row.canonicalKey)) !== JSON.stringify(phase1Rows.map(row => row.canonicalKey))) fail('Phase 2 identities differ from Phase 1');
  const phase1ByKey = new Map(phase1Rows.map(row => [row.canonicalKey, row]));
  for (const row of artifact.communities) {
    const source = phase1ByKey.get(row.canonicalKey);
    if (row.placeGeoid !== source.placeGeoid || JSON.stringify(row.memberCountyFips) !== JSON.stringify(source.memberCountyFips)) fail(`identity or memberships changed for ${row.canonicalKey}`);
    for (const [field, taxonomy] of Object.entries(TAXONOMY)) if (!taxonomy.includes(row[field])) fail(`invalid ${field} for ${row.canonicalKey}`);
    if (!Array.isArray(row.findingCodes) || row.findingCodes.some(code => typeof code !== 'string')) fail(`invalid finding codes for ${row.canonicalKey}`);
    const prohibited = ['geometry', 'incidents', 'payload', 'sourceResponse', 'consumerLabel'];
    if (Object.keys(row).some(key => prohibited.includes(key))) fail(`embedded or duplicated data in ${row.canonicalKey}`);
  }
  const dallas = artifact.communities.find(row => row.placeGeoid === '4819000');
  if (JSON.stringify(dallas?.memberCountyFips) !== JSON.stringify(['48085', '48113', '48121', '48257', '48397'])) fail('Dallas memberships were not preserved');
  const summary = {
    communityCount: 1859, applicableCount: 1859, supportedCount: 0, partialCount: 1859,
    unsupportedCount: 0, unknownCount: 0,
    sourceHealthClassifications: { AMBIGUOUS_EMPTY_FAILURE_STATE: 1859 },
    ownerRuntimeReviewRequiredCount: 1859, ambiguousEmptyFailureCount: 1859
  };
  if (JSON.stringify(artifact.summary) !== JSON.stringify(summary)) fail('summary does not match governed classifications');
  return summary;
}

export function buildInventory() {
  const phase1 = read(paths.phase1);
  const presentation = read(paths.presentation);
  const phase1Rows = canonicalPhase1Communities(phase1);
  if (phase1.summary?.uniqueCanonicalCommunityCount !== 1859 || phase1Rows.length !== 1859) fail('Phase 1 denominator is not authoritative');
  if (presentation.counts?.presentationTargetCount !== 1859) fail('statewide presentation evidence is incomplete');
  const communities = phase1Rows.map(source => {
    if (!presentation.places?.[source.placeGeoid]) fail(`presentation location missing for ${source.canonicalKey}`);
    return {
      canonicalKey: source.canonicalKey,
      placeGeoid: source.placeGeoid,
      memberCountyFips: [...source.memberCountyFips],
      applicability: 'APPLICABLE',
      staticCapability: 'PARTIAL',
      spatialResolutionCapability: 'MIXED_GEOMETRY_AND_PROXIMITY_SUPPORTED',
      sourceHealthCapability: 'AMBIGUOUS_EMPTY_FAILURE_STATE',
      liveVerificationStatus: 'OWNER_RUNTIME_REQUIRED',
      findingCodes: ['PLACE_IDENTITY_AND_LOCATION_AVAILABLE', 'ALL_COUNTY_MEMBERSHIPS_PRESERVED', 'CONSUMER_EMPTY_CAN_MASK_SOURCE_FAILURE']
    };
  });
  const artifact = {
    schemaVersion: 'gridly.lp214.drivetexas-coverage-inventory.v1',
    generatedMode: 'STATIC_ARCHITECTURAL_INVENTORY',
    sources: ['data/generated/lp214-county-community-inventory.json', 'data/generated/gridly-statewide-place-presentation-v1.json'],
    summary: {},
    implementation: {
      providerPath: ['js/gridlyDriveTexasProvider.js: normalizeRecords', 'js/gridlyDriveTexasLiveConnector.js: getAllNormalizedRecords/getNormalizedRecords'],
      requestPath: ['js/gridlyDriveTexasLiveConnector.js: fetchNowInternal -> requestPayload', 'GET api.drivetexas.org conditions GeoJSON; timeout/retry owned by connector'],
      normalizationPath: ['FeatureCollection validation', 'gridlyDriveTexasProvider.normalizeRecords preserves Point/LineString/MultiLineString authority geometry'],
      spatialFilteringPath: ['connector awareness view: point-radius or text fallback', 'LP039 authority: retained complete records and selected-awareness point/geometry qualification', 'LP044 passive audit: community radius plus complete incident geometry'],
      sourceHealthHandling: ['connector result and lifecycle audit distinguish connected empty from error', 'retained last-successful records survive connector fetch failure', 'direct array consumers do not receive source-health state'],
      liveEvidence: 'OWNER_RUNTIME_REQUIRED',
      passiveGuarantees: { noRuntimeActivation: true, noFetches: true, noPolling: true, noWrites: true, noRemoteMutation: true },
      ambiguousPaths: [
        { file: 'js/gridlyDriveTexasProvider.js', function: 'refresh', failureCondition: 'request, response validation, or normalization error', downstreamRepresentation: 'normalizedStore=[] with connected=false only in separate runtime state', consumerRisk: 'array-only consumers can render failure as no advisories', productionPatchRequiredLater: true },
        { file: 'js/gridlyDriveTexasLiveConnector.js', function: 'fetchNowInternal/getNormalizedRecords', failureCondition: 'network, timeout, rejected request, malformed response, or provider initialization failure', downstreamRepresentation: 'fetch result/lifecycle has error but record getter returns retained or empty array', consumerRisk: 'direct record consumers can mistake unavailable source for a quiet source', productionPatchRequiredLater: true }
      ]
    },
    communities
  };
  artifact.summary = validateInventory({ ...artifact, summary: { communityCount: 1859, applicableCount: 1859, supportedCount: 0, partialCount: 1859, unsupportedCount: 0, unknownCount: 0, sourceHealthClassifications: { AMBIGUOUS_EMPTY_FAILURE_STATE: 1859 }, ownerRuntimeReviewRequiredCount: 1859, ambiguousEmptyFailureCount: 1859 } }, phase1);
  validateInventory(artifact, phase1);
  return artifact;
}

export function run({ verify = false } = {}) {
  const bytes = Buffer.from(stableJson(buildInventory()));
  if (verify) {
    if (!fs.existsSync(paths.output) || !fs.readFileSync(paths.output).equals(bytes)) fail('generated artifact does not match deterministic expected output');
  } else {
    fs.mkdirSync(path.dirname(paths.output), { recursive: true });
    fs.writeFileSync(paths.output, bytes);
  }
  return { bytes, artifact: JSON.parse(bytes) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--verify') || args.length > 1) fail('usage: node tools/lp214/build-drivetexas-coverage-inventory.mjs [--verify]');
    const result = run({ verify: args.includes('--verify') });
    console.log(`${args.includes('--verify') ? 'Verified' : 'Wrote'} ${path.relative(root, paths.output)} (${result.bytes.byteLength} bytes, ${result.artifact.communities.length} records)`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
