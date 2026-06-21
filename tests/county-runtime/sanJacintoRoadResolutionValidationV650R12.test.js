const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const validation = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/validation/san-jacinto-road-resolution-validation-v650r12.json', 'utf8'));

assert.strictEqual(validation.milestone, 'V650R.12', 'validation milestone is V650R.12');
assert.strictEqual(validation.activationStatus.validationOnly, true, 'San Jacinto remains validation-only');
assert.strictEqual(validation.activationStatus.productionEnabled, false, 'San Jacinto production remains disabled');
assert.strictEqual(validation.activationStatus.productionActivationBlocked, true, 'San Jacinto activation remains blocked');
assert.strictEqual(validation.activationStatus.reauthorizationRequired, true, 'San Jacinto reauthorization remains required');
assert.strictEqual(validation.finalDetermination, 'ROAD RESOLUTION VERIFIED WITH OBSERVATIONS', 'final determination documents verified road resolution with observations');
assert.strictEqual(validation.communityPreferenceFindings.recommendationClass, 'B. Road resolution available but location-selection logic needs adjustment', 'recommendation class documents available road resolution with selection observation');
assert.strictEqual(validation.roadCandidateFindings.classification, 'PASS', 'road candidate lookup passes');
assert.strictEqual(validation.roadResolutionFindings.roadwayNameAvailable, true, 'roadway name is available');
assert.strictEqual(validation.validationMatrix.roadResolution.result, 'PASS', 'road resolution matrix passes');
assert.strictEqual(validation.validationMatrix.consumerLanguage.result, 'OBSERVATION', 'consumer language remains an observation');
assert(validation.roadCandidateFindings.topCandidates.some((candidate) => candidate.name === 'State Hwy 150'), 'State Hwy 150 candidate is documented');
assert(validation.roadCandidateFindings.topCandidates.some((candidate) => candidate.name === 'FM 1514'), 'FM road candidate is documented');
assert(validation.remainingBlockers.some((entry) => entry.type === 'BLOCKER' && /Boundary credibility/.test(entry.item)), 'boundary credibility remains separately blocked');

assert(appSource.includes('function collectNearbyRoadCandidates'), 'nearby road candidate helper remains present');
assert(appSource.includes('function resolveNearestRoadName'), 'nearest road resolver remains present');
assert(appSource.includes('function resolveIncidentRoadLookupPayload'), 'shared incident road lookup payload remains present');
assert(appSource.includes('locationCandidates.push(resolvedRoadName);'), 'resolved road name is appended to location candidates');
assert(appSource.indexOf('if (resolvedRoadName) locationCandidates.push(resolvedRoadName);') < appSource.indexOf('locationCandidates.push(incident?.location_name'), 'resolved road context is considered before community/location fallback fields');
assert(appSource.includes('resolvedRoadLookup?.locationContext?.primaryRoad'), 'alert location model consumes shared resolved road context');
assert(appSource.includes('function buildGridlyAlertCardConsumerModel'), 'alert consumer model remains present');
assert(appSource.includes('function buildGridlyLightweightActiveAwareness'), 'awareness model remains present');

console.log('sanJacintoRoadResolutionValidationV650R12.test.js passed');
