import { CERTIFIED_COUNTIES } from "./certified-address-identities.mjs";

export const normalizeGovernedCounty = (value) => String(value || "").toLowerCase()
  .replace(/\bcounty\b/g, "").replace(/[^a-z0-9]/g, "");

const countyByFips = new Map(CERTIFIED_COUNTIES.map((county) => [county.fips, county]));
const supportedCountyNames = new Set(CERTIFIED_COUNTIES.map((county) => normalizeGovernedCounty(county.name)));

export function governedCountyAcceptance(returnedCounty, identity = {}) {
  const selectedFips = String(identity?.selectedFips || "");
  const returnedFips = String(identity?.returnedFips || "");
  const suppliedFips = [selectedFips, returnedFips].filter(Boolean);
  const normalizedCounty = normalizeGovernedCounty(returnedCounty);

  if (suppliedFips.length) {
    if (new Set(suppliedFips).size !== 1) return { accepted: false, reason: "county_fips_conflict" };
    const governedCounty = countyByFips.get(suppliedFips[0]);
    if (!governedCounty) return { accepted: false, reason: "unsupported_county_fips" };
    if (normalizedCounty && normalizedCounty !== normalizeGovernedCounty(governedCounty.name)) {
      return { accepted: false, reason: "county_fips_conflict" };
    }
    return { accepted: true, reason: "governed_fips_identity" };
  }

  return normalizedCounty && supportedCountyNames.has(normalizedCounty)
    ? { accepted: true, reason: "normalized_county_name" }
    : { accepted: false, reason: "unsupported_or_missing_county" };
}
