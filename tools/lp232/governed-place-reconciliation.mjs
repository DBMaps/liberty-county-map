import { CENSUS_TYPES, censusConsumerEligible } from '../lp188/community-package-identity-contract.mjs';

export const EXCLUSION_AUTHORITY = 'existing governed PLACE classification';

export function reconcileGovernedPlaceGeometry(places, governedPlaces, eligibleGeoids) {
  const authorityByGeoid = new Map(governedPlaces.map(place => [String(place.geoid), place]));
  const eligible = new Set([...eligibleGeoids].map(String));
  const geometryCounts = Map.groupBy(places, place => String(place.GEOID));
  const missing = [...eligible].filter(geoid => !geometryCounts.has(geoid)).sort();
  const duplicate = [...eligible].filter(geoid => (geometryCounts.get(geoid)?.length ?? 0) !== 1 && geometryCounts.has(geoid)).sort();
  const extra = [...geometryCounts.keys()].filter(geoid => !eligible.has(geoid)).sort();
  const excluded = [];
  const unknown = [];

  for (const geoid of extra) {
    const authority = authorityByGeoid.get(geoid);
    if (authority?.governedType === CENSUS_TYPES.C9 && censusConsumerEligible(authority.governedType) === false) {
      excluded.push({
        name: authority.officialName,
        geoid,
        placeFp: String(authority.placeFips),
        classFp: authority.classFp,
        funcStat: authority.funcStat,
        governedType: authority.governedType,
      });
    } else unknown.push(geoid);
  }

  const exact = [...eligible].filter(geoid => geometryCounts.get(geoid)?.length === 1).length;
  const pass = missing.length === 0 && duplicate.length === 0 && unknown.length === 0 &&
    places.every(place => place.valid && !place.empty);
  return {
    sourceGeometryCount: places.length,
    governedEligibleCanonicalCount: eligible.size,
    exactGovernedGeometryMatches: exact,
    missingGovernedGeometryCount: missing.length,
    missingGovernedGeometryGeoids: missing,
    duplicateGovernedGeometryCount: duplicate.length,
    duplicateGovernedGeometryGeoids: duplicate,
    extraSourceGeometryCount: extra.length,
    governedExcludedGeometryCount: excluded.length,
    unknownExtraGeometryCount: unknown.length,
    unknownExtraGeometryGeoids: unknown,
    excludedGeometryIdentities: excluded,
    exclusionAuthority: EXCLUSION_AUTHORITY,
    geometryReconciliationPass: pass,
  };
}
