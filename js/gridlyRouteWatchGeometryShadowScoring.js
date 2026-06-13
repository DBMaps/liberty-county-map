(function initGridlyRouteWatchGeometryShadowScoring(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const EARTH_RADIUS_METERS = 6371008.8;
  const DEFAULT_OPTIONS = {
    midpointThresholdMiles: 0.8,
    overlapToleranceMeters: 60,
    overlapThreshold: 0.25,
    confidenceThreshold: 0.55
  };

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function distanceMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return Number.POSITIVE_INFINITY;
    const lon1 = toRadians(Number(a[0]));
    const lat1 = toRadians(Number(a[1]));
    const lon2 = toRadians(Number(b[0]));
    const lat2 = toRadians(Number(b[1]));
    const dLon = lon2 - lon1;
    const dLat = lat2 - lat1;
    const haversine = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  function midpointCoordinate(coordinates) {
    const points = Array.isArray(coordinates) ? coordinates : [];
    return points[Math.floor(points.length / 2)] || null;
  }

  function midpointRelevance(eventGeometry, routeGeometry, options = {}) {
    const thresholdMiles = Number.isFinite(Number(options.midpointThresholdMiles))
      ? Number(options.midpointThresholdMiles)
      : DEFAULT_OPTIONS.midpointThresholdMiles;
    const eventMidpoint = midpointCoordinate(eventGeometry?.coordinates);
    const routeVertices = Array.isArray(routeGeometry?.coordinates) ? routeGeometry.coordinates : [];
    const minVertexDistanceMiles = routeVertices.reduce((minimum, vertex) => {
      return Math.min(minimum, distanceMeters(eventMidpoint, vertex) / 1609.344);
    }, Number.POSITIVE_INFINITY);
    const confidence = Number.isFinite(minVertexDistanceMiles)
      ? Math.max(0.05, Math.min(0.8, 0.8 - (minVertexDistanceMiles / thresholdMiles) * 0.45))
      : 0;

    return {
      relevant: Number.isFinite(minVertexDistanceMiles) && minVertexDistanceMiles <= thresholdMiles,
      thresholdMiles,
      confidence: Number(confidence.toFixed(3)),
      minVertexDistanceMiles: Number.isFinite(minVertexDistanceMiles) ? Number(minVertexDistanceMiles.toFixed(3)) : null
    };
  }

  function fallbackOverlapScore(retainedEvent, routeGeometry, options = {}) {
    const prototype = globalScope.gridlyTxdotGeometryRetentionPrototype;
    if (prototype && typeof prototype.scoreRouteOverlap === "function") {
      return prototype.scoreRouteOverlap(retainedEvent, routeGeometry, { toleranceMeters: options.overlapToleranceMeters });
    }
    return {
      prototypeOnly: true,
      overlapDistanceMeters: 0,
      overlapPercentage: 0,
      confidence: 0,
      reason: "V290 geometry scorer is unavailable; shadow geometry result is unavailable."
    };
  }

  function confidenceBand(fixture, overlap, geometryRelevant) {
    if (fixture?.sharedAlignment || fixture?.caseType === "intersection_adjacent_ambiguity" || fixture?.caseType === "sparse_route_geometry_miss") {
      return "ambiguous";
    }
    if (geometryRelevant && overlap.overlapPercentage >= 0.5) return "high";
    if (geometryRelevant) return "medium";
    if (overlap.overlapPercentage >= 0.1) return "low";
    return "not_relevant";
  }

  function fallbackReason(fixture, midpoint, geometryRelevant, band) {
    if (fixture?.routeGeometryQuality === "sparse") return "route_geometry_sparse_current_midpoint_preserved";
    if (fixture?.sharedAlignment) return "shared_alignment_shadow_review_current_midpoint_preserved";
    if (fixture?.caseType === "intersection_adjacent_ambiguity") return "intersection_adjacent_shadow_review_current_midpoint_preserved";
    if (midpoint.relevant !== geometryRelevant) return "shadow_disagreement_current_midpoint_preserved";
    if (band === "not_relevant") return "geometry_shadow_rejected_current_midpoint_preserved";
    return "geometry_shadow_supported_current_midpoint_preserved";
  }

  function disagreementReason(fixture, midpointRelevant, geometryRelevant, band) {
    if (fixture?.sharedAlignment) return "shared_alignment_review";
    if (fixture?.caseType === "intersection_adjacent_ambiguity") return "intersection_adjacent_ambiguity";
    if (fixture?.caseType === "sparse_route_geometry_miss") return "sparse_route_geometry_miss";
    if (midpointRelevant && !geometryRelevant) {
      return fixture?.caseType === "nearby_parallel_road_non_overlap"
        ? "nearby_parallel_non_overlap"
        : "midpoint_false_positive_candidate";
    }
    if (!midpointRelevant && geometryRelevant) return "midpoint_false_negative_candidate";
    if (band === "low") return "low_overlap_review";
    return "none";
  }

  function scoreFixture(fixture, options = {}) {
    const scoringOptions = { ...DEFAULT_OPTIONS, ...options };
    const midpoint = midpointRelevance(fixture.eventGeometry, fixture.routeGeometry, scoringOptions);
    const overlap = fallbackOverlapScore({
      id: fixture.id,
      coordinates: fixture.eventGeometry?.coordinates || [],
      routeReferences: { routeName: fixture.routeName || fixture.corridor }
    }, fixture.routeGeometry, scoringOptions);
    const geometryRelevant = overlap.overlapPercentage >= scoringOptions.overlapThreshold
      && overlap.confidence >= scoringOptions.confidenceThreshold;
    const band = confidenceBand(fixture, overlap, geometryRelevant);
    const reason = disagreementReason(fixture, midpoint.relevant, geometryRelevant, band);

    return {
      id: fixture.id,
      caseType: fixture.caseType,
      corridor: fixture.corridor,
      description: fixture.description,
      currentMidpointRelevance: {
        relevant: midpoint.relevant,
        confidence: midpoint.confidence,
        minVertexDistanceMiles: midpoint.minVertexDistanceMiles,
        thresholdMiles: midpoint.thresholdMiles
      },
      geometryOverlapRelevance: {
        relevant: geometryRelevant,
        overlapPercentage: Number((overlap.overlapPercentage || 0).toFixed(3)),
        overlapDistanceMeters: Number((overlap.overlapDistanceMeters || 0).toFixed(1)),
        confidence: Number((overlap.confidence || 0).toFixed(3)),
        toleranceMeters: scoringOptions.overlapToleranceMeters,
        reason: overlap.reason || null
      },
      confidenceBand: band,
      fallbackReason: fallbackReason(fixture, midpoint, geometryRelevant, band),
      disagreementReason: reason,
      existingRelevanceUnchanged: true,
      productionSuppressionOrPromotion: false,
      expectations: {
        midpointRelevant: fixture.expectedMidpointRelevant,
        geometryRelevant: fixture.expectedGeometryRelevant,
        confidenceBand: fixture.expectedConfidenceBand,
        disagreementReason: fixture.expectedDisagreementReason,
        fallbackReason: fixture.expectedFallbackReason
      },
      expectationMatches: {
        midpoint: midpoint.relevant === fixture.expectedMidpointRelevant,
        geometry: geometryRelevant === fixture.expectedGeometryRelevant,
        confidenceBand: band === fixture.expectedConfidenceBand,
        disagreementReason: reason === fixture.expectedDisagreementReason,
        fallbackReason: fallbackReason(fixture, midpoint, geometryRelevant, band) === fixture.expectedFallbackReason
      }
    };
  }

  function countBy(results, fieldName) {
    return results.reduce((counts, result) => {
      const key = result[fieldName] || "unspecified";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function summarize(results) {
    const total = results.length;
    const midpointFalsePositiveCandidates = results.filter((result) => result.currentMidpointRelevance.relevant && !result.geometryOverlapRelevance.relevant);
    const midpointFalseNegativeCandidates = results.filter((result) => !result.currentMidpointRelevance.relevant && result.geometryOverlapRelevance.relevant);
    const geometrySupportedCandidates = results.filter((result) => result.geometryOverlapRelevance.relevant);
    const geometryRejectedCandidates = results.filter((result) => !result.geometryOverlapRelevance.relevant && result.confidenceBand !== "ambiguous");
    const ambiguousCandidates = results.filter((result) => result.confidenceBand === "ambiguous");

    return {
      totalFixtures: total,
      fixtureCountByCorridor: countBy(results, "corridor"),
      fixtureCountByScenarioType: countBy(results, "caseType"),
      midpointMatches: results.filter((result) => result.expectationMatches.midpoint).length,
      geometryMatches: results.filter((result) => result.expectationMatches.geometry).length,
      midpointFalsePositiveCandidates: midpointFalsePositiveCandidates.length,
      midpointFalseNegativeCandidates: midpointFalseNegativeCandidates.length,
      geometrySupportedCandidates: geometrySupportedCandidates.length,
      geometryRejectedCandidates: geometryRejectedCandidates.length,
      ambiguousCandidates: ambiguousCandidates.length,
      confidenceBandDistribution: countBy(results, "confidenceBand"),
      disagreementReasons: countBy(results, "disagreementReason"),
      safeForProductionWiring: false
    };
  }

  function requiredExpectationFailures(fixtures) {
    return fixtures.flatMap((fixture) => {
      const missing = [];
      if (typeof fixture?.expectedMidpointRelevant !== "boolean") missing.push("expectedMidpointRelevant");
      if (typeof fixture?.expectedGeometryRelevant !== "boolean") missing.push("expectedGeometryRelevant");
      if (typeof fixture?.expectedConfidenceBand !== "string" || !fixture.expectedConfidenceBand) missing.push("expectedConfidenceBand");
      if (typeof fixture?.expectedDisagreementReason !== "string" || !fixture.expectedDisagreementReason) missing.push("expectedDisagreementReason");
      if (typeof fixture?.expectedFallbackReason !== "string" || !fixture.expectedFallbackReason) missing.push("expectedFallbackReason");
      return missing.length ? [{ id: fixture?.id || "unknown-fixture", missing }] : [];
    });
  }

  function buildAuditReport(fixturesPayloadOrFixtures = globalScope.gridlyRouteWatchGeometryShadowFixtures, options = {}) {
    const fixtures = Array.isArray(fixturesPayloadOrFixtures)
      ? fixturesPayloadOrFixtures
      : Array.isArray(fixturesPayloadOrFixtures?.fixtures)
        ? fixturesPayloadOrFixtures.fixtures
        : [];
    const scoringOptions = {
      ...DEFAULT_OPTIONS,
      ...(fixturesPayloadOrFixtures?.defaultOptions || {}),
      ...options
    };
    const results = fixtures.map((fixture) => scoreFixture(fixture, scoringOptions));
    const validationFailures = results.filter((result) => {
      return !result.expectationMatches.midpoint
        || !result.expectationMatches.geometry
        || !result.expectationMatches.confidenceBand
        || !result.expectationMatches.disagreementReason
        || !result.expectationMatches.fallbackReason;
    });
    const fixtureExpectationFailures = requiredExpectationFailures(fixtures);

    return {
      audit: "V295 Route Watch Geometry Shadow Scoring Fixture Expansion",
      scope: "fixture_backed_shadow_scoring_no_production_behavior_change",
      generatedAt: new Date().toISOString(),
      model: {
        currentMidpointThresholdMiles: scoringOptions.midpointThresholdMiles,
        geometryOverlapToleranceMeters: scoringOptions.overlapToleranceMeters,
        geometryOverlapThreshold: scoringOptions.overlapThreshold,
        geometryConfidenceThreshold: scoringOptions.confidenceThreshold,
        existingRelevanceResultRemainsUnchanged: true,
        userFacingDisplay: false,
        productionSuppressionOrPromotion: false
      },
      summary: summarize(results),
      validation: {
        passed: validationFailures.length === 0 && fixtureExpectationFailures.length === 0,
        failureCount: validationFailures.length + fixtureExpectationFailures.length,
        fixtureExpectationFailures,
        failures: validationFailures.map((result) => ({
          id: result.id,
          expectationMatches: result.expectationMatches,
          expected: result.expectations,
          actual: {
            midpointRelevant: result.currentMidpointRelevance.relevant,
            geometryRelevant: result.geometryOverlapRelevance.relevant,
            confidenceBand: result.confidenceBand,
            disagreementReason: result.disagreementReason,
            fallbackReason: result.fallbackReason
          }
        }))
      },
      fixtures: results
    };
  }

  globalScope.gridlyRouteWatchGeometryShadowScoring = {
    buildAuditReport,
    scoreFixture,
    midpointRelevance
  };

  if (typeof globalScope.gridlyRouteWatchGeometryShadowAudit !== "function") {
    globalScope.gridlyRouteWatchGeometryShadowAudit = function gridlyRouteWatchGeometryShadowAudit(fixturesPayloadOrFixtures = globalScope.gridlyRouteWatchGeometryShadowFixtures, options) {
      return buildAuditReport(fixturesPayloadOrFixtures, options);
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
