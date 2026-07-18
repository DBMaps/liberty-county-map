const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('js/app.js', 'utf8');

const slice = source.slice(source.indexOf('const GRIDLY_LP023_CONSUMER_LOCATION_CONTRACT_VERSION'), source.indexOf('function normalizeGridlyAlertCardLocationLabel'));
assert(slice.includes('GRIDLY_LP027_HISTORICAL_INTERSECTION_CRITERIA'), 'LP027 records the historical road-pair/intersection criteria in production code');
assert(slice.includes('introducedByCommit: "22b02e7"'), 'LP027 identifies the commit that introduced the restored criteria');
assert(slice.includes('firstKnownBrokenCommit: "de41097"'), 'LP027 identifies LP026 as the first broken commit for this path');
assert(slice.includes('primaryRoadMaximumDistanceMiles: 1.2'), 'Historical primary road threshold is retained');
assert(slice.includes('secondaryRoadMaximumDistanceMiles: 0.35'), 'Historical secondary road threshold is retained');
assert(slice.includes('nearbyCandidateScanMiles: 0.45'), 'Historical paired-road candidate scan radius is retained');
assert(slice.includes('crossingFallbackMaximumDistanceMiles: 0.8'), 'Historical crossing fallback radius is retained');
assert(slice.includes('gridlyLp027ParseRoadPairLabel(resolved)'), 'Resolved US 90 & Waco Street output is promoted to canonical intersection context');
assert(slice.includes('intersectionLabel: resolvedIntersection'), 'Canonical road context persists the intersection label');
assert(slice.includes('crossingRoadway: primaryRoad'), 'Canonical road context persists crossing roadway');
assert(slice.includes('record.canonicalRoadContext = context'), 'Canonical road context is persisted on the record');
assert(slice.includes('return gridlyLp027PersistConsumerLocation(record, contract);'), 'LP023 resolver persists a shared consumer contract');
assert(slice.includes('const road = roadContext.resolvedIntersection || roadContext.crossingPackageRoadway || roadContext.resolvedRoadName'), 'Crossings prefer historical intersection before weaker roadway crossing text');
assert(slice.includes('record?.consumerLocation?.displayLocation ? record.consumerLocation'), 'Audit reads already-resolved consumer contracts passively');
assert(!slice.includes('buildGridlyAlertCardConsumerModel(record)'), 'Audit does not call Alert rendering');
assert(!slice.includes('buildGridlyCrossingPopupConsumerModel(record)'), 'Audit does not call crossing popup rendering');
assert(!slice.includes('buildGridlyHazardPopupConsumerModel(record)'), 'Audit does not call hazard popup rendering');
assert(slice.includes('auditPerformedResolverCalls'), 'Audit reports resolver-call delta');
assert(slice.includes('lp016InvariantPreserved'), 'Audit reports LP016 invariant status');
assert(slice.includes('historicalDaytonPass'), 'Audit blocks safeForMerge if Dayton loses Waco Street context');
assert(slice.includes('duplicateRoadContextResolutionDetected'), 'Audit reports duplicate canonical road-context resolution');

const registry = source.slice(source.indexOf('"liberty-tx": Object.freeze'), source.indexOf('"walker-tx": Object.freeze'));
assert(registry.includes('roadSegmentsPath: "data/liberty-county-road-segments.geojson"'), 'Liberty has loadable road geometry for US 90/Waco validation');
assert(registry.includes('"polk-tx": Object.freeze') && registry.includes('roadSegmentsPath: null'), 'Polk lacks a loadable runtime road geometry package, documenting the Garner Road data gap');

const polkCrossings = fs.readFileSync('Crossing-Packages/polk/polk-crossings.geojson', 'utf8');
assert(polkCrossings.includes('755943V'), 'Livingston FRA-755943V is present in the Polk crossing package');
assert(polkCrossings.includes('"STREET":  "PRIVATE"') || polkCrossings.includes('"street":"PRIVATE"'), 'Polk FRA-755943V package provides only PRIVATE roadway fields');

const libertyOverrides = fs.readFileSync('data/gridly-crossing-review-overrides.json', 'utf8');
assert(libertyOverrides.includes('762790L') && libertyOverrides.includes('US 90'), 'Dayton FRA-762790L has trusted US 90 crossing override context');
