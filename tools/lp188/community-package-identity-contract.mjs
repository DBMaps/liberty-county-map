const CENSUS_TYPES = Object.freeze({
  C1: 'INCORPORATED_PLACE',
  CDP: 'CENSUS_DESIGNATED_PLACE',
  C9: 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE'
});

const fail = message => { throw new Error(message); };
const text = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
};
const countyFips = value => {
  const normalized = text(value, 'countyFips');
  if (!/^48\d{3}$/.test(normalized)) fail('countyFips must be a Texas Census county GEOID');
  return normalized;
};
const placeGeoid = value => {
  const normalized = text(value, 'placeGeoid');
  if (!/^48\d{5}$/.test(normalized)) fail('placeGeoid must be a Texas Census PLACE GEOID');
  return normalized;
};

export function censusConsumerEligible(governedType) {
  if (governedType === CENSUS_TYPES.C1 || governedType === CENSUS_TYPES.CDP) return true;
  if (governedType === CENSUS_TYPES.C9) return false;
  fail(`unsupported governed Census place type: ${governedType}`);
}

export function createCensusPlace({ geoid, officialName, governedType, countyMemberships }) {
  const memberships = [...new Set((countyMemberships || []).map(countyFips))].sort();
  if (!memberships.length) fail('Census place must retain at least one certified county membership');
  return Object.freeze({
    identitySource: 'CENSUS_PLACE',
    placeGeoid: placeGeoid(geoid),
    displayName: text(officialName, 'officialName'),
    governedType,
    includedInCensusFoundation: true,
    consumerEligible: censusConsumerEligible(governedType),
    countyMemberships: Object.freeze(memberships)
  });
}

export function createLegacyAwarenessArea({ legacyIdentity, displayName, consumerEligible = true }) {
  const identity = text(legacyIdentity, 'legacyIdentity');
  if (/^48\d{5}$/.test(identity)) fail('legacyIdentity must not masquerade as a Census PLACE GEOID');
  return Object.freeze({
    identitySource: 'LEGACY_NON_CENSUS',
    legacyIdentity: identity,
    displayName: text(displayName, 'displayName'),
    consumerEligible: consumerEligible === true
  });
}

export function createCommunityIdentityPackage({ county, censusPlaces = [], legacyAwarenessAreas = [], communities }) {
  const governedCountyFips = countyFips(county?.countyFips);
  const seenCensus = new Set();
  for (const place of censusPlaces) {
    if (place.identitySource !== 'CENSUS_PLACE') fail('censusPlaces may contain only Census PLACE records');
    placeGeoid(place.placeGeoid);
    text(place.displayName, 'Census place displayName');
    if (place.includedInCensusFoundation !== true) fail(`${place.placeGeoid} must remain included in the Census foundation`);
    if (place.consumerEligible !== censusConsumerEligible(place.governedType)) fail(`${place.placeGeoid} consumer eligibility conflicts with governed type`);
    if (!Array.isArray(place.countyMemberships) || !place.countyMemberships.length) fail(`${place.placeGeoid} lacks county memberships`);
    const normalizedMemberships = place.countyMemberships.map(countyFips);
    if (new Set(normalizedMemberships).size !== normalizedMemberships.length) fail(`${place.placeGeoid} has duplicate county memberships`);
    if (!place.countyMemberships.includes(governedCountyFips)) fail(`${place.placeGeoid} is not a member of package county ${governedCountyFips}`);
    if (seenCensus.has(place.placeGeoid)) fail(`duplicate Census PLACE identity ${place.placeGeoid}`);
    seenCensus.add(place.placeGeoid);
  }
  const seenLegacy = new Set();
  for (const area of legacyAwarenessAreas) {
    if (area.identitySource !== 'LEGACY_NON_CENSUS') fail('legacyAwarenessAreas may contain only non-Census records');
    text(area.legacyIdentity, 'legacyIdentity');
    text(area.displayName, 'legacy displayName');
    if ('placeGeoid' in area) fail('legacy awareness area must not have a Census PLACE GEOID');
    if (seenLegacy.has(area.legacyIdentity)) fail(`duplicate legacy awareness identity ${area.legacyIdentity}`);
    seenLegacy.add(area.legacyIdentity);
  }
  const compatibility = communities === undefined
    ? legacyAwarenessAreas.filter(area => area.consumerEligible).map(area => area.displayName)
    : communities.map(value => text(value, 'communities entry'));
  return Object.freeze({
    schemaVersion: 'gridly.community-package.identity.v1',
    county: Object.freeze({ countyFips: governedCountyFips, displayName: text(county.displayName, 'county displayName') }),
    censusPlaces: Object.freeze([...censusPlaces].sort((a, b) => a.placeGeoid.localeCompare(b.placeGeoid))),
    legacyAwarenessAreas: Object.freeze([...legacyAwarenessAreas].sort((a, b) => a.legacyIdentity.localeCompare(b.legacyIdentity))),
    communities: Object.freeze([...compatibility])
  });
}

export { CENSUS_TYPES };
