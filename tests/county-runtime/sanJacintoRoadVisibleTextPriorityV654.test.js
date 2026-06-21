const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

includes('function gridlyResolveQualifiedRoadLocationLabel(record = {}, resolvedLookup = null)', 'shared qualified road label resolver exists');
includes('lookup?.locationContext?.primaryRoad || lookup?.locationContext?.phrasing || lookup?.resolvedRoadName', 'qualified road resolver consumes shared resolved road lookup context');
includes('const primary = qualifiedResolvedRoad\n    ? { value: qualifiedResolvedRoad, source: "sharedResolvedRoadLookup.locationContext.primaryRoad" }', 'top awareness lightweight location selection prefers qualified resolved road before label/community fields');
includes('const locationLabel = crossingLocationEvidence?.locationLineLabel || qualifiedResolvedRoad || normalizeGridlyAlertCardLocationLabel(alert);', 'alert card consumer model prefers qualified resolved road before community fallback labels');
includes('const road = qualifiedResolvedRoad || (/^Local\\s+(?:road|crossing)\\s+impact$/i.test(inferredRoad) ? "" : inferredRoad);', 'localized location phrase generation prefers qualified resolved road before inferred town/community context');
includes('const resolvedRoadLabel = options?.preferResolvedRoad !== false && typeof gridlyResolveQualifiedRoadLocationLabel === "function"', 'county-aware fallback location phrase can use qualified resolved road context');

const lightweightIndex = source.indexOf('const primary = qualifiedResolvedRoad');
const labelIndex = source.indexOf('label.value && (labelIsSpecificLocation || !roadFieldCandidate.value)', lightweightIndex);
assert(lightweightIndex > 0 && labelIndex > lightweightIndex, 'qualified resolved road is evaluated before label/community fallback in active awareness selection');

const alertIndex = source.indexOf('const locationLabel = crossingLocationEvidence?.locationLineLabel || qualifiedResolvedRoad || normalizeGridlyAlertCardLocationLabel(alert);');
const lineIndex = source.indexOf('const locationLine = normalizeGridlyCountyAwareDisplayText(`Reported ${locationVerb} ${locationLabel}`, alert);', alertIndex);
assert(alertIndex > 0 && lineIndex > alertIndex, 'alert location line is built from qualified road-prioritized location label');

assert(!/Crash \/ Wreck on Coldspring/.test(source), 'runtime does not hard-code observed bad San Jacinto top awareness wording');
assert(!/Reported on Coldspring/.test(source), 'runtime does not hard-code observed bad San Jacinto alert-card wording');

console.log('sanJacintoRoadVisibleTextPriorityV654.test.js passed');
