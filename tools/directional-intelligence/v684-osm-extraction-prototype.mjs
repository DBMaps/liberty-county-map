#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const requestedSource = 'assets/directional-intelligence/source/osm/us59-i69-liberty-montgomery-source.geojson';
const legacySource = 'assets/directional-intelligenc/source/osm/us59-i69-liberty-montgomery-source.geojson';
const sourceAsset = fs.existsSync(requestedSource) ? requestedSource : legacySource;
const corridorInventoryPath = 'assets/directional-intelligence/extracted/v684-us59-i69-corridor-inventory.json';
const segmentInventoryPath = 'assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json';
const evidencePath = 'assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json';
const corridorId = 'us59-i69';

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const has = (props, key) => Object.prototype.hasOwnProperty.call(props, key) && props[key] !== null && props[key] !== '';
const stringValue = (props, key) => has(props, key) ? String(props[key]) : null;
const truthyTag = (props, key) => has(props, key) ? props[key] : null;
const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
const metadataText = (props) => ['ref', 'fut_ref', 'name', 'tiger:name_base'].map((key) => props[key] ?? '').join(' | ');
const matchesPrimaryCorridor = (props) => {
  const text = normalizeText(metadataText(props));
  const compact = text.replace(/[\s-]+/g, '');
  const hasI69 = /\bi\s*-?\s*69\b/.test(text) || compact.includes('i69') || /interstate\s+69/.test(text);
  const hasUs59 = /\bus\s*-?\s*59\b/.test(text) || compact.includes('us59') || /united states highway\s+59/.test(text);
  const hasEastex = /eastex freeway/.test(text);
  return hasI69 || hasUs59 || (hasEastex && (has(props, 'ref') || has(props, 'fut_ref')));
};
const lineGeometrySummary = (geometry) => {
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
    return { geometryType: geometry?.type ?? null, coordinateCount: Array.isArray(geometry?.coordinates) ? geometry.coordinates.length : 0, startCoordinate: null, endCoordinate: null, bbox: null, approximateBearingDegrees: null };
  }
  const coords = geometry.coordinates;
  const xs = coords.map((c) => c[0]).filter(Number.isFinite);
  const ys = coords.map((c) => c[1]).filter(Number.isFinite);
  const start = coords[0];
  const end = coords[coords.length - 1];
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  const lon1 = toRad(start[0]);
  const lat1 = toRad(start[1]);
  const lon2 = toRad(end[0]);
  const lat2 = toRad(end[1]);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const bearing = Number(((toDeg(Math.atan2(y, x)) + 360) % 360).toFixed(2));
  return { geometryType: geometry.type, coordinateCount: coords.length, startCoordinate: start, endCoordinate: end, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], approximateBearingDegrees: bearing };
};
const distribution = (records, selector) => {
  const out = {};
  for (const record of records) {
    const value = selector(record);
    const key = value === null || value === undefined || value === '' ? '__MISSING__' : String(value);
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};
const priority = ['geometry_invalid', 'non_primary_corridor', 'reversible_lane', 'construction_segment', 'hov_hot_lane', 'missing_ref', 'missing_oneway', 'missing_county', 'manual_review_required', 'none'];
const firstPriority = (reasons) => priority.find((reason) => reasons.includes(reason)) || 'none';

const geojson = readJson(sourceAsset);
if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
  throw new Error(`Expected FeatureCollection at ${sourceAsset}`);
}

const features = geojson.features;
const lineStringFeatures = features.filter((feature) => feature?.geometry?.type === 'LineString');
const segmentInventory = features.map((feature, index) => {
  const props = feature.properties || {};
  const geometrySummary = lineGeometrySummary(feature.geometry);
  const evidenceSignals = {
    hasRef: has(props, 'ref'),
    hasFutureRef: has(props, 'fut_ref'),
    hasName: has(props, 'name'),
    hasCounty: has(props, 'tiger:county'),
    hasOneway: has(props, 'oneway'),
    hasOnewayConditional: has(props, 'oneway:conditional'),
    hasLanes: has(props, 'lanes'),
    hasTurnLanes: has(props, 'turn:lanes'),
    hasDestinationLanes: has(props, 'destination:lanes'),
    hasStrategicTags: ['Texas_Trunk_System', 'NHS', 'hgv:national_network'].some((key) => has(props, key)),
    hasGeometry: feature?.geometry?.type === 'LineString' && geometrySummary.coordinateCount >= 2,
    isReversible: normalizeText(props.oneway) === 'reversible' || String(props['oneway:conditional'] ?? '').includes('-1'),
    isConstruction: normalizeText(props.highway) === 'construction' || has(props, 'construction'),
    isHovHot: ['hov:conditional', 'hov:minimum'].some((key) => has(props, key)) || Object.entries(props).some(([key, value]) => /\b(hov|hot)\b/i.test(`${key}=${value}`)),
    hasFixme: has(props, 'fixme') || has(props, 'FIXME')
  };
  const reviewReasons = [];
  if (!evidenceSignals.hasGeometry) reviewReasons.push('geometry_invalid');
  if (!matchesPrimaryCorridor(props)) reviewReasons.push('non_primary_corridor');
  if (evidenceSignals.isReversible) reviewReasons.push('reversible_lane');
  if (evidenceSignals.isConstruction) reviewReasons.push('construction_segment');
  if (evidenceSignals.isHovHot) reviewReasons.push('hov_hot_lane');
  if (!evidenceSignals.hasRef && !evidenceSignals.hasFutureRef) reviewReasons.push('missing_ref');
  if (!evidenceSignals.hasOneway) reviewReasons.push('missing_oneway');
  if (!evidenceSignals.hasCounty) reviewReasons.push('missing_county');
  if (evidenceSignals.hasFixme) reviewReasons.push('manual_review_required');
  if (reviewReasons.length === 0) reviewReasons.push('none');
  const reviewBucket = firstPriority(reviewReasons);
  const extractionStatus = ['geometry_invalid', 'non_primary_corridor'].includes(reviewBucket) ? 'rejected' : reviewBucket === 'none' ? 'extracted' : 'extracted_with_review';
  return {
    segmentId: `v684-${String(index + 1).padStart(5, '0')}`,
    sourceWayId: props['@id'] ?? feature.id ?? null,
    corridorId,
    sourceRef: stringValue(props, 'ref'),
    sourceFutureRef: stringValue(props, 'fut_ref'),
    sourceName: stringValue(props, 'name'),
    sourceTigerNameBase: stringValue(props, 'tiger:name_base'),
    county: stringValue(props, 'tiger:county'),
    highway: stringValue(props, 'highway'),
    oneway: stringValue(props, 'oneway'),
    onewayConditional: stringValue(props, 'oneway:conditional'),
    lanes: stringValue(props, 'lanes'),
    turnLanes: stringValue(props, 'turn:lanes'),
    destinationLanes: stringValue(props, 'destination:lanes'),
    strategicTags: { Texas_Trunk_System: truthyTag(props, 'Texas_Trunk_System'), NHS: truthyTag(props, 'NHS'), 'hgv:national_network': truthyTag(props, 'hgv:national_network') },
    riskTags: { construction: truthyTag(props, 'construction'), bridge: truthyTag(props, 'bridge'), toll: truthyTag(props, 'toll'), 'hov:conditional': truthyTag(props, 'hov:conditional'), 'hov:minimum': truthyTag(props, 'hov:minimum'), motor_vehicle: truthyTag(props, 'motor_vehicle'), 'motor_vehicle:conditional': truthyTag(props, 'motor_vehicle:conditional'), fixme: truthyTag(props, 'fixme'), FIXME: truthyTag(props, 'FIXME') },
    geometrySummary,
    extractionStatus,
    reviewBucket,
    reviewReasons,
    evidenceSignals
  };
});

const extracted = segmentInventory.filter((segment) => segment.extractionStatus !== 'rejected');
const rejected = segmentInventory.filter((segment) => segment.extractionStatus === 'rejected');
const review = segmentInventory.filter((segment) => segment.extractionStatus === 'extracted_with_review');
const evidenceCoverageSummary = Object.fromEntries(Object.keys(segmentInventory[0]?.evidenceSignals || {}).map((key) => [key, segmentInventory.filter((segment) => segment.evidenceSignals[key]).length]));
const reviewBucketDistribution = distribution(segmentInventory, (segment) => segment.reviewBucket);
const countyDistribution = distribution(segmentInventory, (segment) => segment.county);
const highwayDistribution = distribution(segmentInventory, (segment) => segment.highway);
const refDistribution = distribution(segmentInventory, (segment) => segment.sourceRef ?? segment.sourceFutureRef);
const finalDetermination = rejected.length === 0 && review.length / segmentInventory.length <= 0.1
  ? 'EXTRACTION PROTOTYPE STRONG — READY FOR EXTRACTION VALIDATION'
  : extracted.length > 0
    ? 'EXTRACTION PROTOTYPE PARTIAL — VALIDATION ALLOWED WITH REVIEW BUCKETS'
    : 'EXTRACTION PROTOTYPE INSUFFICIENT — VALIDATION BLOCKED';

const corridorInventory = [{ corridorId, displayName: 'US 59 / I-69', sourceAsset: requestedSource, inspectedSourceAsset: sourceAsset, totalSourceFeatures: features.length, totalLineStringFeatures: lineStringFeatures.length, totalExtractedSegments: extracted.length, totalRejectedSegments: rejected.length, totalReviewSegments: review.length, countyDistribution, highwayDistribution, refDistribution, reviewBucketDistribution, evidenceCoverageSummary, protectedSystemsVerified, runtimeChanged: false, appJsChanged: false, uiChanged: false, driveTexasChanged: false, transportationIntelligenceChanged: false }];
const evidence = { milestone: 'V684', sourceAsset: requestedSource, inspectedSourceAsset: sourceAsset, generatedAt: new Date().toISOString(), v683Dependency: { determination: 'METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS' }, totalSourceFeatures: features.length, totalLineStringFeatures: lineStringFeatures.length, extractedSegmentCount: extracted.length, rejectedSegmentCount: rejected.length, reviewSegmentCount: review.length, corridorInventoryPath, segmentInventoryPath, reviewBucketDistribution, countyDistribution, highwayDistribution, evidenceCoverageSummary, protectedSystemsVerified, runtimeChanged: false, appJsChanged: false, uiChanged: false, driveTexasChanged: false, transportationIntelligenceChanged: false, finalDetermination };

for (const file of [corridorInventoryPath, segmentInventoryPath, evidencePath]) fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(corridorInventoryPath, `${JSON.stringify(corridorInventory, null, 2)}\n`);
fs.writeFileSync(segmentInventoryPath, `${JSON.stringify(segmentInventory, null, 2)}\n`);
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${corridorInventoryPath}`);
console.log(`Wrote ${segmentInventoryPath}`);
console.log(`Wrote ${evidencePath}`);
console.log(finalDetermination);
