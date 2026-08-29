export const RELEASE_BINDING = Object.freeze({
  authorityReleaseId: 'lp24111-d5-standalone-2026-08-28',
  runtimeSchemaVersion: 'gridly.poi.runtime.v2',
  sourceInventorySha256: 'a9d7a77b964af35fcb21ad3cd061ceb1e1a33ae4dc5091a25a119bada92cec13',
  authorityInputSha256: '6c63fc555ea4a887162541cb1a4587f9d3edb52fb70cb3e81982598b9a82f85c',
  foursquareNoticeSha256: '07cef40d0b0d1f5786b3e29983970aa0729ee6e508d1c4e3e18bbe0eef8878a3',
  expectedGovernedPoiCount: 391772,
  providerGate: 'OFF'
});

export const POI_REQUIRED_FIELDS = Object.freeze(['id', 'displayName', 'gridlyCategory', 'latitude', 'longitude', 'countyContextId']);
export const POI_OPTIONAL_FIELDS = Object.freeze(['brand', 'provenanceSummary']);
export const REQUEST_FIELDS = Object.freeze(['communityIdentity', 'countyContextId', 'originType', 'latitude', 'longitude', 'radiusMiles']);
const ORIGINS_WITH_COMMUNITY = new Set(['CANONICAL_PLACE', 'GOVERNED_NON_PLACE']);
const ORIGINS_WITHOUT_COMMUNITY = new Set(['MAP_CENTER', 'COUNTY_ONLY', 'RURAL_COORDINATE', 'DIRECT_COORDINATE', 'UNINCORPORATED']);

function fail(code) { throw new Error(code); }
function finite(value, min, max, code) {
  if (!Number.isFinite(value) || value < min || value > max) fail(code);
}

export function validatePoi(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail('INVALID_POI');
  const allowed = new Set([...POI_REQUIRED_FIELDS, ...POI_OPTIONAL_FIELDS]);
  for (const key of Object.keys(record)) if (!allowed.has(key)) fail(`FORBIDDEN_POI_FIELD:${key}`);
  for (const key of POI_REQUIRED_FIELDS) if (record[key] === undefined || record[key] === null || record[key] === '') fail(`MISSING_POI_FIELD:${key}`);
  for (const key of ['id', 'displayName', 'gridlyCategory', 'countyContextId']) if (typeof record[key] !== 'string') fail(`INVALID_POI_FIELD:${key}`);
  finite(record.latitude, -90, 90, 'INVALID_POI_FIELD:latitude');
  finite(record.longitude, -180, 180, 'INVALID_POI_FIELD:longitude');
  for (const key of POI_OPTIONAL_FIELDS) if (key in record && (typeof record[key] !== 'string' || !record[key])) fail(`INVALID_POI_FIELD:${key}`);
  return Object.freeze({ ...record });
}

export function resolveCountyContextId(countyFips, countyRegistry) {
  if (typeof countyFips !== 'string' || !/^48\d{3}$/.test(countyFips)) fail('MALFORMED_COUNTY_FIPS');
  if (!Array.isArray(countyRegistry)) fail('INVALID_COUNTY_REGISTRY');
  const matches = countyRegistry.filter(({ fips }) => fips === countyFips);
  if (matches.length === 0) fail('UNKNOWN_COUNTY_FIPS');
  if (matches.length !== 1) fail('AMBIGUOUS_COUNTY_FIPS');
  if (typeof matches[0].countyId !== 'string' || !matches[0].countyId) fail('INVALID_COUNTY_CONTEXT_ID');
  return matches[0].countyId;
}

export function validateCountyRegistry(countyRegistry) {
  if (!Array.isArray(countyRegistry) || countyRegistry.length !== 254) fail('COUNTY_REGISTRY_MUST_REPRESENT_254_COUNTIES');
  for (const entry of countyRegistry) resolveCountyContextId(entry.fips, countyRegistry);
  return true;
}

export function validateRequestContext(context, governedIdentities) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) fail('INVALID_REQUEST_CONTEXT');
  for (const key of Object.keys(context)) if (!REQUEST_FIELDS.includes(key)) fail(`FORBIDDEN_REQUEST_FIELD:${key}`);
  if (![...ORIGINS_WITH_COMMUNITY, ...ORIGINS_WITHOUT_COMMUNITY].includes(context.originType)) fail('INVALID_ORIGIN_TYPE');
  finite(context.latitude, -90, 90, 'INVALID_REQUEST_LATITUDE');
  finite(context.longitude, -180, 180, 'INVALID_REQUEST_LONGITUDE');
  if (!Number.isFinite(context.radiusMiles) || context.radiusMiles <= 0) fail('INVALID_RADIUS_MILES');
  const identity = context.communityIdentity ?? null;
  if (ORIGINS_WITHOUT_COMMUNITY.has(context.originType) && identity !== null) fail('COMMUNITY_IDENTITY_FORBIDDEN_FOR_ORIGIN');
  if (ORIGINS_WITH_COMMUNITY.has(context.originType)) {
    if (!identity || !['CANONICAL_PLACE', 'GOVERNED_NON_PLACE'].includes(identity.identityClass)) fail('GOVERNED_COMMUNITY_IDENTITY_REQUIRED');
    if (!(governedIdentities instanceof Map) || governedIdentities.get(identity.stableGovernedIdentity) !== identity.identityClass) fail('STALE_OR_UNKNOWN_COMMUNITY_IDENTITY');
    if (identity.identityClass === 'CANONICAL_PLACE' && !/^48\d{5}$/.test(identity.placeGeoid ?? '')) fail('CANONICAL_PLACE_GEOID_REQUIRED');
    if (identity.identityClass === 'GOVERNED_NON_PLACE' && identity.placeGeoid != null) fail('NON_PLACE_GEOID_FORBIDDEN');
  }
  if ('countyContextId' in context && context.countyContextId !== null && (typeof context.countyContextId !== 'string' || !context.countyContextId)) fail('INVALID_REQUEST_COUNTY_CONTEXT_ID');
  return Object.freeze({ ...context, communityIdentity: identity });
}

export function cachePath(authorityReleaseId, runtimeSchemaVersion, shardId) {
  assertReleaseBinding({ ...RELEASE_BINDING, authorityReleaseId, runtimeSchemaVersion });
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(shardId)) fail('INVALID_SHARD_ID');
  return `gridly-poi/${authorityReleaseId}/${runtimeSchemaVersion}/${shardId}.json.gz`;
}

export function assertReleaseBinding(binding) {
  for (const key of ['authorityReleaseId', 'runtimeSchemaVersion', 'sourceInventorySha256', 'authorityInputSha256', 'foursquareNoticeSha256', 'expectedGovernedPoiCount', 'providerGate']) {
    if (binding[key] !== RELEASE_BINDING[key]) fail(`RELEASE_BINDING_MISMATCH:${key}`);
  }
  return true;
}
