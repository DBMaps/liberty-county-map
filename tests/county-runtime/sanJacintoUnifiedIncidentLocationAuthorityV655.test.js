const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

includes('function isGridlyHazardCategoryOnlyLocationAuthority(value = "", incident = {})', 'hazard/category text is explicitly rejected as location authority');
includes('function hasGridlyRealCrossingLocationAuthority(value = "", incident = {})', 'crossing authority requires real crossing/location evidence');
includes('function resolveGridlyAuthoritativeIncidentDisplayLocation(incident = {}, options = {})', 'shared authoritative incident display-location resolver exists');
includes('gridlyResolveQualifiedRoadLocationLabel(incident, resolvedLookup)', 'authority consumes existing qualified resolved road helper');
includes('collectNearbyRoadCandidates(coords.lat, coords.lng, 0.45, 8)', 'authority exposes nearby road candidate diagnostics from existing collector');
includes('selectedReason: "empty fallback"', 'authority returns structured selected reason metadata');
includes('rejectedCandidates.push({ label, source, reason, kind });', 'authority returns rejected candidates');
includes('const authoritativeDisplayLocation = resolveGridlyAuthoritativeIncidentDisplayLocation(item, { roadHazard: true });', 'top awareness uses shared authoritative resolver');
includes('const authoritativeDisplayLocation = resolveGridlyAuthoritativeIncidentDisplayLocation(alert, { roadHazard: !isGridlyAlertCardCrossingRelated(alert) });', 'alert detail uses shared authoritative resolver');
includes('const authoritativeRoadHazardHeadline = buildGridlyRoadHazardAuthoritativeHeadline(subtypeAwareAlert, title);', 'alert title remains routed through authoritative headline helper');
includes('return normalizeGridlyCountyAwareDisplayText(`${titleOnly} near ${label}`, record);', 'road-hazard authoritative headlines use near phrasing');
includes('const activeIssueCount = Math.max(hazardCount + reportCount + crossingReportCount, visibleIncidentCount);', 'location card active/quiet state honors visible incident count');
includes('authoritativeDisplayLocationLabel: authoritativeDisplayLocation?.label || "",', 'audit exposes authoritative label');
includes('authoritativeDisplayLocationSource: authoritativeDisplayLocation?.source || "",', 'audit exposes authoritative source');
includes('authoritativeDisplayLocationKind: authoritativeDisplayLocation?.kind || "",', 'audit exposes authoritative kind');
includes('rejectedLocationCandidates: authoritativeDisplayLocation?.rejectedCandidates || [],', 'audit exposes rejected candidates');
includes('roadCandidateCount: authoritativeDisplayLocation?.roadCandidateCount || 0,', 'audit exposes road candidate count');
includes('topRoadCandidates: authoritativeDisplayLocation?.topRoadCandidates || [],', 'audit exposes top road candidates');
includes('coordinateStatus: authoritativeDisplayLocation?.coordinateStatus || "",', 'audit exposes missing-coordinate status');
includes('missingCoordinateReason: authoritativeDisplayLocation?.missingCoordinateReason || "",', 'audit exposes missing-coordinate reason');
includes('const auditIncident = currentVisibleAudit?.countLineage?.incidents?.[0]?.incident', 'San Jacinto audit resolves the original incident object, not only classification metadata');
includes('const alertCount = Math.max(0, Number(countModel.visibleAlertIncidentCount ?? 0) || 0, Number(alertsSurfaceCount || 0));', 'alert visibility/count includes alerts-surface rows');

const helperStart = source.indexOf('function resolveGridlyAuthoritativeIncidentDisplayLocation');
const qualifiedIndex = source.indexOf('qualified resolved road geometry candidate', helperStart);
const explicitIndex = source.indexOf('qualified explicit road/corridor field', helperStart);
const crossingIndex = source.indexOf('verified crossing location', helperStart);
const placeIndex = source.indexOf('specific named place fallback', helperStart);
const communityIndex = source.indexOf('community fallback only after no qualified road or place exists', helperStart);
assert(qualifiedIndex > helperStart, 'qualified resolved road candidate is first in authority order');
assert(explicitIndex > qualifiedIndex, 'explicit road fields follow resolved geometry');
assert(source.indexOf('!isGridlyHazardCategoryOnlyLocationAuthority(qualifiedResolvedRoad, incident)', helperStart) > helperStart, 'qualified roads reject hazard/category-only text');
assert(source.indexOf('!isGridlyHazardCategoryOnlyLocationAuthority(explicitRoad, incident)', helperStart) > helperStart, 'explicit road fields reject hazard/category-only text');
assert(source.indexOf('hasGridlyRealCrossingLocationAuthority(crossingEvidence.locationLineLabel, incident)', helperStart) > helperStart, 'crossing evidence must pass real crossing authority guard');
assert(crossingIndex > explicitIndex, 'verified crossing follows road candidates');
assert(placeIndex > crossingIndex, 'specific named place follows crossing evidence');
assert(communityIndex > placeIndex, 'community fallback is last');

assert(!/Crash \/ Wreck on Coldspring/.test(source), 'bad San Jacinto headline fixture is not hard-coded');
assert(!/Reported near Coldspring/.test(source), 'bad San Jacinto detail fixture is not hard-coded');
assert(!/Reported on San Jacinto County/.test(source), 'county name is not hard-coded as road label');
assert(!source.slice(helperStart, source.indexOf('function resolveGridlyRoadHazardAuthoritativeLocationLabel', helperStart)).includes('Unknown road'), 'authority does not introduce unknown road copy');

console.log('sanJacintoUnifiedIncidentLocationAuthorityV655.test.js passed');
