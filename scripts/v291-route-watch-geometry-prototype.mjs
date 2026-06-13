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
const focusCorridors = ["TX 146", "TX 321", "US 90", "US 59", "I-69", "FM 1960", "FM 1409", "FM 1011"];

function textForFeature(feature) {
  return Object.values(feature?.properties || {}).map((value) => String(value || "").toUpperCase()).join(" ");
}

function lineDistanceMeters(coordinates) {
  const earthRadiusMeters = 6371008.8;
  const radians = (value) => value * Math.PI / 180;
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [lon1, lat1] = coordinates[index - 1];
    const [lon2, lat2] = coordinates[index];
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    total += 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return total;
}

function featureCoordinates(feature) {
  const geometry = feature?.geometry;
  if (geometry?.type === "LineString") return geometry.coordinates;
  if (geometry?.type === "MultiLineString") return geometry.coordinates.flat();
  return [];
}

function geometryForFeature(feature) {
  const coordinates = featureCoordinates(feature);
  return { type: "LineString", coordinates };
}

function featureLengthMeters(feature) {
  return lineDistanceMeters(featureCoordinates(feature));
}

function matchingFeatures(corridor) {
  const aliases = corridor === "I-69"
    ? ["I-69", "IH 69", "US 59"]
    : corridor === "US 59"
      ? ["US 59", "I-69", "IH 69"]
      : [corridor];
  return (roadSegments.features || []).filter((feature) => {
    const haystack = textForFeature(feature);
    return aliases.some((alias) => haystack.includes(alias));
  });
}

function routeAvailabilitySummary() {
  return focusCorridors.map((corridor) => {
    const features = matchingFeatures(corridor);
    const totalLengthMeters = features.reduce((sum, feature) => sum + featureLengthMeters(feature), 0);
    const lineStringCount = features.filter((feature) => feature?.geometry?.type === "LineString").length;
    const multiLineStringCount = features.filter((feature) => feature?.geometry?.type === "MultiLineString").length;
    return {
      corridor,
      localRouteFeatureCount: features.length,
      lineStringCount,
      multiLineStringCount,
      approximateLocalGeometryMiles: Number((totalLengthMeters / 1609.344).toFixed(2))
    };
  });
}

function midpointCoordinate(coordinates) {
  return coordinates[Math.floor(coordinates.length / 2)];
}

function distanceMiles(a, b) {
  return lineDistanceMeters([a, b]) / 1609.344;
}

function currentMidpointRelevance(eventGeometry, routeGeometry, thresholdMiles = 0.8) {
  const eventMidpoint = midpointCoordinate(eventGeometry.coordinates || []);
  const routeVertices = routeGeometry.coordinates || [];
  const minVertexDistanceMiles = routeVertices.reduce((minimum, vertex) => {
    return Math.min(minimum, distanceMiles(eventMidpoint, vertex));
  }, Number.POSITIVE_INFINITY);
  return {
    relevant: Number.isFinite(minVertexDistanceMiles) && minVertexDistanceMiles <= thresholdMiles,
    thresholdMiles,
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

function compareSample(sample) {
  const midpoint = currentMidpointRelevance(sample.eventGeometry, sample.routeGeometry);
  const overlap = prototype.scoreRouteOverlap(
    retainedEvent(sample.id, sample.routeName, sample.eventGeometry.coordinates),
    sample.routeGeometry,
    { toleranceMeters: 60 }
  );
  const overlapRelevant = overlap.overlapPercentage >= 0.25 && overlap.confidence >= 0.55;
  return {
    id: sample.id,
    corridor: sample.corridor,
    scenario: sample.scenario,
    midpointRelevant: midpoint.relevant,
    midpointMinVertexDistanceMiles: midpoint.minVertexDistanceMiles,
    overlapRelevant,
    overlapPercentage: Number(overlap.overlapPercentage.toFixed(3)),
    overlapDistanceMeters: Number(overlap.overlapDistanceMeters.toFixed(1)),
    overlapConfidence: Number(overlap.confidence.toFixed(3)),
    confidenceDifference: Number((overlap.confidence - (midpoint.relevant ? 0.55 : 0.2)).toFixed(3)),
    ambiguityReduced: sample.ambiguityReduced,
    productMeaning: sample.productMeaning
  };
}

const tx146Features = matchingFeatures("TX 146").sort((a, b) => featureLengthMeters(b) - featureLengthMeters(a));
const tx321Features = matchingFeatures("TX 321").sort((a, b) => featureLengthMeters(b) - featureLengthMeters(a));
const us90Features = matchingFeatures("US 90").sort((a, b) => featureLengthMeters(b) - featureLengthMeters(a));

const tx146Route = geometryForFeature(tx146Features[0]);
const tx321Route = geometryForFeature(tx321Features[0]);
const us90Route = geometryForFeature(us90Features[0]);

function offsetGeometry(geometry, latOffset, lonOffset = 0) {
  return {
    type: "LineString",
    coordinates: geometry.coordinates.map(([lon, lat]) => [lon + lonOffset, lat + latOffset])
  };
}

const sparseRoute = { type: "LineString", coordinates: [[-94.90, 30.00], [-94.90, 30.08]] };
const sparseOverlappingEvent = { type: "LineString", coordinates: [[-94.90, 30.033], [-94.90, 30.047]] };

const samples = [
  {
    id: "tx146-true-overlap",
    corridor: "TX 146",
    scenario: "TxDOT event line follows the watched TX 146 geometry.",
    routeName: "TX 146",
    routeGeometry: tx146Route,
    eventGeometry: tx146Route,
    ambiguityReduced: true,
    productMeaning: "Both models identify relevance, but overlap adds high-confidence shared-segment evidence."
  },
  {
    id: "tx146-nearby-parallel",
    corridor: "TX 146",
    scenario: "Event midpoint sits near TX 146, but the retained line is offset from the route corridor.",
    routeName: "US 90",
    routeGeometry: tx146Route,
    eventGeometry: offsetGeometry(tx146Route, 0.004),
    ambiguityReduced: true,
    productMeaning: "Midpoint proximity can over-alert; overlap weakens relevance because the event line does not share the route."
  },
  {
    id: "tx321-true-overlap",
    corridor: "TX 321",
    scenario: "TxDOT event line follows the watched TX 321 geometry.",
    routeName: "TX 321",
    routeGeometry: tx321Route,
    eventGeometry: tx321Route,
    ambiguityReduced: true,
    productMeaning: "Overlap confirms a true TX 321 route impact rather than nearby local-street context."
  },
  {
    id: "us90-true-overlap",
    corridor: "US 90",
    scenario: "TxDOT event line follows the watched US 90 geometry.",
    routeName: "US 90",
    routeGeometry: us90Route,
    eventGeometry: us90Route,
    ambiguityReduced: true,
    productMeaning: "Overlap confirms shared-corridor relevance and can separate shared alignments from nearby-only incidents."
  },
  {
    id: "sparse-route-midpoint-miss",
    corridor: "Sparse route control",
    scenario: "Event overlaps the middle of a sparse route polyline while its midpoint is far from route vertices.",
    routeName: "TX 146",
    routeGeometry: sparseRoute,
    eventGeometry: sparseOverlappingEvent,
    ambiguityReduced: true,
    productMeaning: "Route-vertex distance can miss a true segment overlap when route vertices are sparse."
  }
];

const report = {
  prototype: "V291 Route Watch Geometry Prototype",
  scope: "audit_only_no_production_wiring",
  generatedAt: new Date().toISOString(),
  routeAvailability: routeAvailabilitySummary(),
  sampleComparisons: samples.map(compareSample)
};

console.log(JSON.stringify(report, null, 2));
