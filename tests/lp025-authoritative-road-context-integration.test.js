const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');

const bodyOf = (name, nextName) => {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} exists`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.indexOf('\n}\n\nfunction ', start + 20);
  return source.slice(start, end > start ? end : source.length);
};

const contextBody = bodyOf('gridlyLp025ResolveAuthoritativeRoadContext', 'gridlyLp025LocationSpecificityRank');
assert(contextBody.includes('resolveNearestRoadName(coords.lat, coords.lng)'), 'LP025 reuses the proven reverse-road lookup used by the Dayton path');
assert(contextBody.includes('resolveNearbyRoadPair(coords.lat, coords.lng, primaryForPair)'), 'LP025 reuses the proven intersection/road-pair lookup that can retain US 90 and Waco Street');
assert(contextBody.includes('selectedRoadName') && contextBody.includes('resolvedRoadName'), 'LP025 preserves selected/resolved road ownership fields before coordinate lookup');
assert(contextBody.includes('street') && contextBody.includes('highwayName'), 'LP025 reads certified/runtime crossing package roadway fields');

const communityBody = bodyOf('gridlyLp023CommunityReportLocationAdapter', 'gridlyLp023CrossingLocationAdapter');
assert(communityBody.indexOf('gridlyLp025ResolveAuthoritativeRoadContext') < communityBody.indexOf('gridlyLp023CommunityRelative'), 'community adapter resolves authoritative road context before community-relative fallback');
assert(communityBody.includes('coordinates: gridlyLp023Coordinates(record)'), 'community adapter keeps the submitted/report coordinate while adding road metadata');
assert(communityBody.includes('communityRelativeUsedDespiteRoadContext'), 'community adapter records fallback despite road-context provenance');

const crossingBody = bodyOf('gridlyLp023CrossingLocationAdapter', 'gridlyLp023OfficialLocationAdapter');
assert(crossingBody.indexOf('roadContext.crossingPackageRoadway') < crossingBody.indexOf('calculatedPrivateCrossingCommunityRelative'), 'crossing package roadway outranks private/community fallback');
assert(crossingBody.includes('crossingPackageRoadway') && crossingBody.includes('street') && crossingBody.includes('highwayName'), 'FRA-755943V can resolve a roadway from authoritative source fields when available');
assert(crossingBody.includes('! /^(?:private|private crossing|restricted access crossing)$/i'.replace('! ', '')), 'PRIVATE classification is explicitly rejected as a roadway label');
assert(!crossingBody.includes('crossingid') && !crossingBody.includes('crossing_id ||'), 'crossing adapter does not expose FRA identifiers as display location');

const officialBody = bodyOf('gridlyLp023OfficialLocationAdapter', 'gridlyLp023AdapterType');
assert(officialBody.includes('providerGeographicLocation'), 'official adapter preserves provider geographic details');
assert(officialBody.includes('providerAdvisoryTextRejected') && source.includes('GRIDLY_LP023_ADVISORY_PROSE'), 'official adapter continues rejecting advisory prose');
assert(officialBody.includes('trustedOfficialRouteWithCoordinateCommunity') && officialBody.includes('${label} near ${community}'), 'official route plus coordinate-backed community can produce roadway-near-community wording');

const auditBody = bodyOf('gridlyLp023ConsumerLocationAdapterAudit', 'normalizeGridlyAlertCardLocationLabel');
[
  'roadContextAvailable','roadContextInvoked','roadContextSource','resolvedRoadName','resolvedIntersection','crossingPackageRoadway','strongerRoadContextAvailable','roadContextDiscarded','communityRelativeUsedDespiteRoadContext','privateCrossingUsedDespiteRoadway','roadwayOnlyUsedDespiteCommunityContext','decisionUsefulLocation','locationSpecificityRank','locationSpecificityPass','visualRoadContextValidationRequired','sharedContractOwnershipPass','strongestTruthfulLocationPass','safeForBrowserValidation','safeForMerge'
].forEach((field) => assert(auditBody.includes(field), `LP025 audit reports ${field}`));
assert(auditBody.includes('sharedContractOwnershipPass && strongestTruthfulLocationPass'), 'safeForMerge is not based on alert/popup equality alone');
assert(source.includes('buildGridlyRoadEvaluationOperationContext()'), 'LP016 operation-scoped road-context build path remains present');
assert(!/buildGridlyRoadEvaluationContext\(\)[\s\S]{0,80}map\(/.test(communityBody + crossingBody + officialBody), 'LP025 adapters avoid per-renderer road-context hot loops');

console.log('LP025 authoritative road context integration static checks passed');
