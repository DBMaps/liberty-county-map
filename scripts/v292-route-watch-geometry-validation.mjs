#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

await import(path.join(repoRoot, "js/gridlyTxdotGeometryRetentionPrototype.js"));

const prototype = globalThis.gridlyTxdotGeometryRetentionPrototype;
if (!prototype || typeof prototype.scoreRouteOverlap !== "function") {
  throw new Error("V290 TxDOT geometry retention prototype is unavailable.");
}

const roadSegments = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/liberty-county-road-segments.geojson"), "utf8"));
const focusCorridors = ["TX 146", "TX 321", "US 90", "US 59 / I-69", "FM 1960", "FM 1409", "FM 1011"];
const thresholdCandidates = [0.1, 0.25, 0.5, 0.75];
const defaultOverlapThreshold = 0.25;
const defaultConfidenceThreshold = 0.55;

function toRadians(value) {
  return value * Math.PI / 180;
}

function distanceMeters(a, b) {
  const earthRadiusMeters = 6371008.8;
  const lon1 = toRadians(a[0]);
  const lat1 = toRadians(a[1]);
  const lon2 = toRadians(b[0]);
  const lat2 = toRadians(b[1]);
  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function lineDistanceMeters(coordinates) {
  const points = Array.isArray(coordinates) ? coordinates : [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceMeters(points[index - 1], points[index]);
  }
  return total;
}

function textForFeature(feature) {
  return Object.values(feature?.properties || {}).map((value) => String(value || "").toUpperCase()).join(" ");
}

function featureCoordinates(feature) {
  const geometry = feature?.geometry;
  if (geometry?.type === "LineString") return geometry.coordinates;
  if (geometry?.type === "MultiLineString") return geometry.coordinates.flat();
  return [];
}

function geometryForFeature(feature) {
  return { type: "LineString", coordinates: featureCoordinates(feature) };
}

function featureLengthMeters(feature) {
  return lineDistanceMeters(featureCoordinates(feature));
}

function corridorAliases(corridor) {
  if (corridor === "US 59 / I-69") return ["US 59", "I-69", "IH 69"];
  return [corridor];
}

function matchingFeatures(corridor) {
  const aliases = corridorAliases(corridor);
  return (roadSegments.features || []).filter((feature) => {
    const haystack = textForFeature(feature);
    return aliases.some((alias) => haystack.includes(alias));
  });
}

function routeFeatureFor(corridor) {
  const features = matchingFeatures(corridor)
    .filter((feature) => featureCoordinates(feature).length >= 2)
    .sort((a, b) => featureLengthMeters(b) - featureLengthMeters(a));
  if (!features.length) {
    throw new Error(`No route geometry found for ${corridor}`);
  }
  return features[0];
}

function routeAvailabilitySummary() {
  return focusCorridors.map((corridor) => {
    const features = matchingFeatures(corridor);
    const totalLengthMeters = features.reduce((sum, feature) => sum + featureLengthMeters(feature), 0);
    return {
      corridor,
      localRouteFeatureCount: features.length,
      lineStringCount: features.filter((feature) => feature?.geometry?.type === "LineString").length,
      multiLineStringCount: features.filter((feature) => feature?.geometry?.type === "MultiLineString").length,
      approximateLocalGeometryMiles: Number((totalLengthMeters / 1609.344).toFixed(2))
    };
  });
}

function midpointCoordinate(coordinates) {
  return coordinates[Math.floor(coordinates.length / 2)];
}

function currentMidpointRelevance(eventGeometry, routeGeometry, thresholdMiles = 0.8) {
  const eventMidpoint = midpointCoordinate(eventGeometry.coordinates || []);
  const routeVertices = routeGeometry.coordinates || [];
  const minVertexDistanceMiles = routeVertices.reduce((minimum, vertex) => {
    return Math.min(minimum, distanceMeters(eventMidpoint, vertex) / 1609.344);
  }, Number.POSITIVE_INFINITY);
  return {
    relevant: Number.isFinite(minVertexDistanceMiles) && minVertexDistanceMiles <= thresholdMiles,
    thresholdMiles,
    confidence: Number.isFinite(minVertexDistanceMiles)
      ? Math.max(0.05, Math.min(0.8, 0.8 - (minVertexDistanceMiles / thresholdMiles) * 0.45))
      : 0,
    minVertexDistanceMiles: Number.isFinite(minVertexDistanceMiles) ? Number(minVertexDistanceMiles.toFixed(3)) : null
  };
}

function retainedEvent(id, routeName, coordinates) {
  return {
    id,
    prototypeOnly: true,
    coordinates,
    routeReferences: { routeName }
  };
}

function offsetGeometry(geometry, latOffset, lonOffset = 0) {
  return {
    type: "LineString",
    coordinates: geometry.coordinates.map(([lon, lat]) => [lon + lonOffset, lat + latOffset])
  };
}

function subsetGeometry(geometry, startRatio, endRatio) {
  const coordinates = geometry.coordinates || [];
  const startIndex = Math.max(0, Math.min(coordinates.length - 2, Math.floor((coordinates.length - 1) * startRatio)));
  const endIndex = Math.max(startIndex + 1, Math.min(coordinates.length - 1, Math.ceil((coordinates.length - 1) * endRatio)));
  return { type: "LineString", coordinates: coordinates.slice(startIndex, endIndex + 1) };
}

function sparseRouteFrom(geometry) {
  const coordinates = geometry.coordinates || [];
  return { type: "LineString", coordinates: [coordinates[0], coordinates[coordinates.length - 1]] };
}

function interpolateCoordinate(start, end, ratio) {
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio
  ];
}

function sparseMiddleEvent(routeGeometry, startRatio = 0.42, endRatio = 0.58) {
  const sparseRoute = sparseRouteFrom(routeGeometry);
  const [start, end] = sparseRoute.coordinates;
  return {
    type: "LineString",
    coordinates: [
      interpolateCoordinate(start, end, startRatio),
      interpolateCoordinate(start, end, 0.5),
      interpolateCoordinate(start, end, endRatio)
    ]
  };
}

function partialOverlapEvent(routeGeometry, overlapRatio = 0.5) {
  const overlap = subsetGeometry(routeGeometry, 0.2, 0.2 + (0.4 * overlapRatio));
  const last = overlap.coordinates[overlap.coordinates.length - 1];
  const tail = [last[0] + 0.01, last[1] + 0.01];
  return { type: "LineString", coordinates: [...overlap.coordinates, tail] };
}

function ambiguousThresholdEvent(routeGeometry) {
  const overlap = subsetGeometry(routeGeometry, 0.32, 0.42);
  const last = overlap.coordinates[overlap.coordinates.length - 1];
  const tail1 = [last[0] + 0.006, last[1] + 0.006];
  const tail2 = [last[0] + 0.014, last[1] + 0.014];
  return { type: "LineString", coordinates: [...overlap.coordinates, tail1, tail2] };
}

function midpointNearNonOverlap(routeGeometry) {
  return offsetGeometry(subsetGeometry(routeGeometry, 0.35, 0.65), 0.004, 0);
}

function crossingNearNonOverlap(routeGeometry) {
  const coordinates = routeGeometry.coordinates || [];
  const centerIndex = Math.floor(coordinates.length / 2);
  const before = coordinates[Math.max(0, centerIndex - 1)];
  const center = coordinates[centerIndex];
  const after = coordinates[Math.min(coordinates.length - 1, centerIndex + 1)];
  const dx = after[0] - before[0];
  const dy = after[1] - before[1];
  const magnitude = Math.hypot(dx, dy) || 1;
  const perpendicular = [-dy / magnitude, dx / magnitude];
  const offset = 0.006;
  return {
    type: "LineString",
    coordinates: [
      [center[0] - perpendicular[0] * offset, center[1] - perpendicular[1] * offset],
      [center[0], center[1]],
      [center[0] + perpendicular[0] * offset, center[1] + perpendicular[1] * offset]
    ]
  };
}

function buildSamples() {
  const samples = [];
  for (const corridor of focusCorridors) {
    const routeFeature = routeFeatureFor(corridor);
    const routeGeometry = geometryForFeature(routeFeature);
    const routeName = corridor === "US 59 / I-69" ? "US 59 / I-69" : corridor;
    const slug = corridor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    samples.push({
      id: `${slug}-retained-geometry-overlap`,
      corridor,
      sampleType: "retained_geometry_sample",
      scenario: "Retained TxDOT event geometry follows the watched route geometry.",
      expectedRelevant: true,
      expectedClass: "A. Both correct",
      routeName,
      routeGeometry,
      eventGeometry: subsetGeometry(routeGeometry, 0.05, 0.95),
      cause: "same-corridor retained geometry",
      routeRelationship: "same route alignment",
      corridorRelationship: "direct corridor overlap"
    });

    samples.push({
      id: `${slug}-partial-corridor-overlap`,
      corridor,
      sampleType: "overlap_example",
      scenario: "TxDOT geometry partly follows the watched route and then leaves the route corridor.",
      expectedRelevant: true,
      expectedClass: "A. Both correct",
      routeName,
      routeGeometry,
      eventGeometry: partialOverlapEvent(routeGeometry, 0.65),
      cause: "partial construction extent shares route",
      routeRelationship: "partial same-route alignment",
      corridorRelationship: "partial corridor overlap"
    });

    samples.push({
      id: `${slug}-nearby-parallel-not-overlap`,
      corridor,
      sampleType: "nearby_but_not_overlapping_example",
      scenario: "Nearby parallel/frontage-style geometry has a midpoint close to route vertices but does not share the route corridor.",
      expectedRelevant: false,
      expectedClass: "B. Midpoint false positive",
      routeName: "nearby parallel road",
      routeGeometry,
      eventGeometry: midpointNearNonOverlap(routeGeometry),
      cause: "parallel or frontage-style road close to the watched route",
      routeRelationship: "nearby parallel alignment",
      corridorRelationship: "near corridor, no retained-geometry overlap"
    });


    samples.push({
      id: `${slug}-nearby-intersection-not-overlap`,
      corridor,
      sampleType: "nearby_but_not_overlapping_example",
      scenario: "A cross-street/intersection-style event has a midpoint on the watched route but its retained line crosses rather than follows the route corridor.",
      expectedRelevant: false,
      expectedClass: "B. Midpoint false positive",
      routeName: "nearby cross street",
      routeGeometry,
      eventGeometry: crossingNearNonOverlap(routeGeometry),
      cause: "nearby intersection or cross-street event touches the watched corridor at one point",
      routeRelationship: "crosses route without following it",
      corridorRelationship: "intersection proximity, no sustained corridor overlap"
    });

    samples.push({
      id: `${slug}-sparse-route-missed-overlap`,
      corridor,
      sampleType: "route_geometry_sample",
      scenario: "A sparse Route Watch polyline spans the corridor while a retained event overlaps its middle away from route vertices.",
      expectedRelevant: true,
      expectedClass: "C. Midpoint false negative",
      routeName,
      routeGeometry: sparseRouteFrom(routeGeometry),
      eventGeometry: sparseMiddleEvent(routeGeometry),
      cause: "route vertices are too sparse for midpoint-to-vertex proximity",
      routeRelationship: "same route segment between sparse vertices",
      corridorRelationship: "direct corridor overlap"
    });

    samples.push({
      id: `${slug}-threshold-ambiguity`,
      corridor,
      sampleType: "corridor_sample",
      scenario: "Short shared alignment or limit text creates a low-percentage overlap that is sensitive to threshold selection.",
      expectedRelevant: null,
      expectedClass: "D. Geometry ambiguity",
      routeName,
      routeGeometry,
      eventGeometry: ambiguousThresholdEvent(routeGeometry),
      cause: "short shared alignment with most retained geometry outside the watched route",
      routeRelationship: "limited shared alignment",
      corridorRelationship: "threshold-sensitive overlap"
    });
  }

  return samples;
}

function classify(sample, midpointRelevant, overlapRelevant) {
  if (sample.expectedClass === "D. Geometry ambiguity") return "D. Geometry ambiguity";
  if (sample.expectedRelevant === true && midpointRelevant === false && overlapRelevant === true) return "C. Midpoint false negative";
  if (sample.expectedRelevant === false && midpointRelevant === true && overlapRelevant === false) return "B. Midpoint false positive";
  return "A. Both correct";
}

function compareSample(sample) {
  const midpoint = currentMidpointRelevance(sample.eventGeometry, sample.routeGeometry);
  const overlap = prototype.scoreRouteOverlap(
    retainedEvent(sample.id, sample.routeName, sample.eventGeometry.coordinates),
    sample.routeGeometry,
    { toleranceMeters: 60 }
  );
  const overlapRelevant = overlap.overlapPercentage >= defaultOverlapThreshold && overlap.confidence >= defaultConfidenceThreshold;
  const resultClass = classify(sample, midpoint.relevant, overlapRelevant);
  return {
    id: sample.id,
    corridor: sample.corridor,
    sampleType: sample.sampleType,
    scenario: sample.scenario,
    expectedRelevant: sample.expectedRelevant,
    midpointRelevant: midpoint.relevant,
    midpointConfidence: Number(midpoint.confidence.toFixed(3)),
    midpointMinVertexDistanceMiles: midpoint.minVertexDistanceMiles,
    overlapRelevant,
    overlapPercentage: Number(overlap.overlapPercentage.toFixed(3)),
    overlapDistanceMeters: Number(overlap.overlapDistanceMeters.toFixed(1)),
    overlapConfidence: Number(overlap.confidence.toFixed(3)),
    confidenceDifference: Number((overlap.confidence - midpoint.confidence).toFixed(3)),
    agreement: midpoint.relevant === overlapRelevant,
    classification: resultClass,
    cause: sample.cause,
    routeRelationship: sample.routeRelationship,
    corridorRelationship: sample.corridorRelationship
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
}

function summarizeResults(results) {
  const counts = countBy(results, "classification");
  const total = results.length;
  const classificationSummary = Object.entries(counts).map(([classification, count]) => ({
    classification,
    count,
    percentage: Number(((count / total) * 100).toFixed(1))
  }));
  const agreements = results.filter((result) => result.agreement).length;
  const falsePositiveCandidates = results.filter((result) => result.classification === "B. Midpoint false positive");
  const falseNegativeCandidates = results.filter((result) => result.classification === "C. Midpoint false negative");
  return {
    totalSamples: total,
    agreementCount: agreements,
    disagreementCount: total - agreements,
    agreementPercentage: Number(((agreements / total) * 100).toFixed(1)),
    classificationSummary,
    falsePositiveReductionPotential: {
      candidates: falsePositiveCandidates.length,
      percentageOfDataset: Number(((falsePositiveCandidates.length / total) * 100).toFixed(1)),
      midpointRelevantButOverlapNotRelevant: falsePositiveCandidates.length
    },
    missedRouteWatchImpactPotential: {
      candidates: falseNegativeCandidates.length,
      percentageOfDataset: Number(((falseNegativeCandidates.length / total) * 100).toFixed(1)),
      midpointNotRelevantButOverlapRelevant: falseNegativeCandidates.length
    },
    averageConfidenceDifference: Number((results.reduce((sum, result) => sum + result.confidenceDifference, 0) / total).toFixed(3))
  };
}

function thresholdAnalysis(results) {
  return thresholdCandidates.map((threshold) => {
    let truePositive = 0;
    let falsePositive = 0;
    let trueNegative = 0;
    let falseNegative = 0;
    let ambiguousRelevant = 0;

    for (const result of results) {
      const relevantAtThreshold = result.overlapPercentage >= threshold && result.overlapConfidence >= defaultConfidenceThreshold;
      if (result.expectedRelevant === true) {
        if (relevantAtThreshold) truePositive += 1;
        else falseNegative += 1;
      } else if (result.expectedRelevant === false) {
        if (relevantAtThreshold) falsePositive += 1;
        else trueNegative += 1;
      } else if (relevantAtThreshold) {
        ambiguousRelevant += 1;
      }
    }

    const judged = truePositive + falsePositive + trueNegative + falseNegative;
    return {
      thresholdPercentage: Number((threshold * 100).toFixed(0)),
      truePositive,
      falsePositive,
      trueNegative,
      falseNegative,
      ambiguousRelevant,
      judgedAccuracyPercentage: Number((((truePositive + trueNegative) / judged) * 100).toFixed(1))
    };
  });
}

const validationSamples = buildSamples();
const sampleComparisons = validationSamples.map(compareSample);
const report = {
  validation: "V292 Route Watch Geometry Validation",
  scope: "validation_only_no_production_wiring",
  generatedAt: new Date().toISOString(),
  datasetConstruction: {
    sourceData: "data/liberty-county-road-segments.geojson plus retained-geometry-style synthetic TxDOT LineString samples",
    corridors: focusCorridors,
    sampleTypes: ["retained_geometry_sample", "route_geometry_sample", "corridor_sample", "overlap_example", "nearby_but_not_overlapping_example"],
    defaultOverlapModel: {
      toleranceMeters: 60,
      overlapThreshold: defaultOverlapThreshold,
      confidenceThreshold: defaultConfidenceThreshold
    }
  },
  routeAvailability: routeAvailabilitySummary(),
  summary: summarizeResults(sampleComparisons),
  thresholdAnalysis: thresholdAnalysis(sampleComparisons),
  sampleComparisons
};

console.log(JSON.stringify(report, null, 2));
