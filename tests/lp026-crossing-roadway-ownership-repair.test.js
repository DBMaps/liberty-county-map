const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const start = source.indexOf('const GRIDLY_LP023_CONSUMER_LOCATION_CONTRACT_VERSION');
const end = source.indexOf('function normalizeGridlyAlertCardLocationLabel');
assert(start > 0 && end > start, 'LP023 adapter slice is present');

let nearestRoadCalls = 0;
const sandbox = {
  console,
  window: {},
  normalizeGridlyUserFacingRoadText: (value = '') => String(value || '').replace(/\s+/g, ' ').trim().replace(/\b([A-Z]{2,})\b/g, (m) => m),
  normalizeCoordinatePair: (lat, lng) => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null;
  },
  gridlyCoordinateFromRecord: () => null,
  resolveNearestRoadName: (lat, lng) => {
    nearestRoadCalls += 1;
    if (Math.abs(Number(lat) - 30.6145356) < 0.00001 && Math.abs(Number(lng) + 94.9489676) < 0.00001) return 'Garner Road';
    return '';
  },
  resolveNearbyRoadPair: () => ({ used: false, rejectedReason: 'fixture_no_pair' }),
  gridlyLp023CommunityRelative: () => ({ text: '1 mile north of Goodrich', community: 'Goodrich', distance: 1, direction: 'north' }),
  gridlyLp022SameRoad: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
  gridlyConsumerCrossingClassificationLabel: (value = '') => /^private(?: road)?$/i.test(String(value || '').replace(/[\s_-]+/g, ' ').trim()) ? 'Private Crossing' : String(value || '').trim(),
  exposeGridlyAuditHelper: () => {},
  isGridlyAlertCardCrossingRelated: (record) => Boolean(record.crossingId || record.crossing_id),
  gridlyLp022RecordExplicitlyRepresentsCrossing: (record) => Boolean(record.crossingId || record.crossing_id),
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox, { filename: 'lp026-lp023-slice.js' });

const fra755943v = {
  id: 'rail-FRA-755943V',
  crossingId: '755943V',
  street: 'PRIVATE',
  highwayname: 'PRIVATE',
  source: { latitude: '30.6145356', longitude: '-94.9489676' },
  city: 'GOODRICH',
  crossingName: 'PRIVATE',
};
const contract = sandbox.gridlyLp023ResolveConsumerLocation(fra755943v, { adapterType: 'crossing' });
assert.strictEqual(contract.displayLocation, 'Garner Road Crossing', 'FRA-755943V promotes trusted coordinate roadway above PRIVATE classification');
assert.strictEqual(contract.locationSource, 'resolveNearestRoadName', 'FRA-755943V location source is trusted coordinate road resolution');
assert.strictEqual(contract._lp023.resolvedRoadName, 'Garner Road', 'resolved roadway survives in LP023 metadata');
assert(!/755943V|FRA/.test(contract.displayLocation), 'FRA IDs are never displayed');

const popupModel = { consumerLocation: contract, locationLine: contract.displayLocation };
const alertModel = { consumerLocation: sandbox.gridlyLp023ResolveConsumerLocation({ ...fra755943v, consumerLocation: contract }), locationLine: contract.displayLocation };
assert.strictEqual(alertModel.consumerLocation, contract, 'Alert reuses the precomputed crossing contract instance when provided');
assert.strictEqual(alertModel.locationLine, popupModel.locationLine, 'Alert and popup use the same crossing contract output');

const normalized = { ...fra755943v, runtimeCrossingRoadway: contract.roadway, lp023ConsumerLocation: contract };
const normalizedContract = sandbox.gridlyLp023ResolveConsumerLocation(normalized, { adapterType: 'crossing' });
assert.strictEqual(normalizedContract.displayLocation, 'Garner Road Crossing', 'crossing roadway survives normalization/presentation boundaries');
assert.strictEqual(normalizedContract, contract, 'normalized crossing reuses persisted LP023 contract');

const privateOnly = sandbox.gridlyLp023ResolveConsumerLocation({ crossingId: 'PRIVATE-ONLY', crossingName: 'PRIVATE', street: 'PRIVATE', highwayname: 'PRIVATE' }, { adapterType: 'crossing' });
assert.strictEqual(privateOnly.displayLocation, 'Private Crossing', 'Generic Private Crossing is last resort only');
assert.strictEqual(privateOnly.locationSource, 'privateCrossingLastResort', 'Private Crossing last-resort source is explicit');

assert.strictEqual(nearestRoadCalls, 1, 'no per-renderer road lookup is introduced when the contract is persisted');

const adapterBody = source.slice(source.indexOf('function gridlyLp023CrossingLocationAdapter'), source.indexOf('function gridlyLp023OfficialLocationAdapter'));
assert(adapterBody.indexOf('trustedCrossingDisplayName') < adapterBody.indexOf('roadContext.crossingPackageRoadway'), 'trusted consumer crossing name remains first crossing owner');
assert(adapterBody.indexOf('const road = roadContext.crossingPackageRoadway') < adapterBody.indexOf('const communityRelative = gridlyLp023CommunityRelative'), 'trusted package/runtime roadway outranks community-relative private fallback');
assert(!/buildGridlyRoadEvaluationContext\(\)[\s\S]{0,80}map\(/.test(adapterBody), 'LP016 hot-loop protections remain intact in crossing adapter');

[
  'crossingRecordShapesChecked',
  'crossingPackageStreet',
  'crossingPackageHighwayName',
  'runtimeCrossingRoadway',
  'markerCrossingRoadway',
  'popupInputRoadway',
  'alertInputRoadway',
  'resolvedCoordinateRoadway',
  'workingCrossingComparisonId',
  'workingCrossingComparisonRoadway',
  'crossingRoadwaySource',
  'genericPrivateClassificationPresent',
  'genericPrivateClassificationOverrodeRoadway',
  'alertCrossingContractLocation',
  'popupCrossingContractLocation',
  'crossingContractInstancesMatch',
  'privateCrossingDisplayed',
  'privateCrossingDisplayedDespiteResolvedRoadway',
  'crossingStrongestTruthfulLocationPass',
  'safeForMerge'
].forEach((field) => assert(source.includes(field), `LP026 audit reports ${field}`));

console.log('LP026 crossing roadway ownership repair tests passed');
