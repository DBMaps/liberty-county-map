export function consumerProhibitedCountyAbsent(fixture,candidateCountyFips) {
  const allowedCountyFips=fixture.prohibitedResult.consumerCountyFipsOutside;
  return Array.isArray(allowedCountyFips)&&allowedCountyFips.length>0&&candidateCountyFips.length>0&&candidateCountyFips.every(fips=>allowedCountyFips.includes(fips));
}
