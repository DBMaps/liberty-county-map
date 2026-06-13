(function initGridlyTxdotGeometryRetentionPrototype(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const PROTOTYPE_LABEL = "txdot-geometry-retention-prototype";
  const EARTH_RADIUS_METERS = 6371008.8;
  const DEFAULT_CORRIDOR_TOLERANCE_METERS = 60;

  function toSafeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function cloneJson(value) {
    if (value == null) return null;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return null;
    }
  }

  function readProperties(feature) {
    return feature && typeof feature.properties === "object" && feature.properties
      ? feature.properties
      : {};
  }

  function readGeometry(feature) {
    return feature && typeof feature.geometry === "object" && feature.geometry
      ? feature.geometry
      : null;
  }

  function normalizeBbox(feature, geometry) {
    const bbox = Array.isArray(feature?.bbox) ? feature.bbox : geometry?.bbox;
    const normalized = Array.isArray(bbox) ? bbox.map(toNumber) : [];
    return normalized.length === 4 && normalized.every((value) => Number.isFinite(value))
      ? normalized
      : null;
  }

  function normalizeCoordinatePair(pair) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const longitude = toNumber(pair[0]);
    const latitude = toNumber(pair[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return [longitude, latitude];
  }

  function readLineStringCoordinates(geometry) {
    if (!geometry || geometry.type !== "LineString") return [];
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.map(normalizeCoordinatePair).filter(Boolean)
      : [];
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return 0;
    const lon1 = toRadians(a[0]);
    const lat1 = toRadians(a[1]);
    const lon2 = toRadians(b[0]);
    const lat2 = toRadians(b[1]);
    const dLon = lon2 - lon1;
    const dLat = lat2 - lat1;
    const haversine = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  function lineDistanceMeters(coordinates) {
    const points = Array.isArray(coordinates) ? coordinates : [];
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      total += distanceMeters(points[index - 1], points[index]);
    }
    return total;
  }

  function projectPoint(point, origin, referenceLatitude) {
    const scale = Math.cos(toRadians(referenceLatitude || 0));
    return {
      x: toRadians(point[0] - origin[0]) * EARTH_RADIUS_METERS * scale,
      y: toRadians(point[1] - origin[1]) * EARTH_RADIUS_METERS
    };
  }

  function pointToSegmentDistanceMeters(point, segmentStart, segmentEnd) {
    if (!point || !segmentStart || !segmentEnd) return Number.POSITIVE_INFINITY;
    const referenceLatitude = (point[1] + segmentStart[1] + segmentEnd[1]) / 3;
    const p = projectPoint(point, segmentStart, referenceLatitude);
    const a = { x: 0, y: 0 };
    const b = projectPoint(segmentEnd, segmentStart, referenceLatitude);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
    const projected = { x: a.x + t * dx, y: a.y + t * dy };
    return Math.hypot(p.x - projected.x, p.y - projected.y);
  }

  function pointToLineDistanceMeters(point, lineCoordinates) {
    const routePoints = Array.isArray(lineCoordinates) ? lineCoordinates : [];
    if (!point || routePoints.length < 2) return Number.POSITIVE_INFINITY;
    let closest = Number.POSITIVE_INFINITY;
    for (let index = 1; index < routePoints.length; index += 1) {
      closest = Math.min(closest, pointToSegmentDistanceMeters(point, routePoints[index - 1], routePoints[index]));
    }
    return closest;
  }

  function retainedRecordFromFeature(feature) {
    const properties = readProperties(feature);
    const geometry = readGeometry(feature);
    const coordinates = readLineStringCoordinates(geometry);

    return {
      prototypeOnly: true,
      prototype: PROTOTYPE_LABEL,
      id: toSafeString(properties.GLOBALID) || toSafeString(feature?.id),
      condition: toSafeString(properties.condition),
      geometryType: toSafeString(geometry?.type),
      geometry: cloneJson(geometry),
      coordinates,
      bbox: normalizeBbox(feature, geometry),
      routeExtents: {
        fromLimit: toSafeString(properties.from_limit),
        toLimit: toSafeString(properties.to_limit)
      },
      rawTravelDirection: toSafeString(properties.travel_direction),
      markerReferences: {
        fromRefMarker: toSafeString(properties.from_ref_marker),
        fromMarkerDisplay: toNumber(properties.from_marker_disp),
        toRefMarker: toSafeString(properties.to_ref_marker),
        toMarkerDisplay: toNumber(properties.to_marker_disp)
      },
      routeReferences: {
        routeName: toSafeString(properties.route_name),
        roadway: toSafeString(properties.roadway),
        countyNum: toNumber(properties.county_num)
      },
      measuredLengthMeters: lineDistanceMeters(coordinates)
    };
  }

  function scoreRouteOverlap(retainedEvent, routeGeometry, options) {
    const eventCoordinates = Array.isArray(retainedEvent?.coordinates) ? retainedEvent.coordinates : [];
    const routeCoordinates = readLineStringCoordinates(routeGeometry);
    const toleranceMeters = Number.isFinite(Number(options?.toleranceMeters))
      ? Number(options.toleranceMeters)
      : DEFAULT_CORRIDOR_TOLERANCE_METERS;
    const eventLengthMeters = lineDistanceMeters(eventCoordinates);

    if (eventCoordinates.length < 2 || routeCoordinates.length < 2 || eventLengthMeters <= 0) {
      return {
        prototypeOnly: true,
        overlapDistanceMeters: 0,
        overlapPercentage: 0,
        corridorConfidence: 0,
        routeConfidence: 0,
        geometryConfidence: eventCoordinates.length >= 2 ? 0.5 : 0,
        confidence: 0,
        reason: "Insufficient retained TxDOT or route geometry for overlap scoring."
      };
    }

    let overlappingDistanceMeters = 0;
    let sampledSegments = 0;
    let overlappingSegments = 0;

    for (let index = 1; index < eventCoordinates.length; index += 1) {
      const start = eventCoordinates[index - 1];
      const end = eventCoordinates[index];
      const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const segmentLength = distanceMeters(start, end);
      sampledSegments += 1;
      if (pointToLineDistanceMeters(midpoint, routeCoordinates) <= toleranceMeters) {
        overlappingSegments += 1;
        overlappingDistanceMeters += segmentLength;
      }
    }

    const overlapPercentage = eventLengthMeters > 0 ? overlappingDistanceMeters / eventLengthMeters : 0;
    const corridorConfidence = Math.min(1, overlapPercentage * 1.15);
    const routeName = toSafeString(retainedEvent?.routeReferences?.routeName);
    const routeConfidence = routeName ? 0.85 : 0.45;
    const geometryConfidence = sampledSegments > 0
      ? Math.min(1, 0.5 + (overlappingSegments / sampledSegments) * 0.5)
      : 0;
    const confidence = Math.min(1, (corridorConfidence * 0.5) + (routeConfidence * 0.25) + (geometryConfidence * 0.25));

    return {
      prototypeOnly: true,
      overlapDistanceMeters: overlappingDistanceMeters,
      overlapPercentage,
      corridorConfidence,
      routeConfidence,
      geometryConfidence,
      confidence,
      toleranceMeters,
      sampledSegments,
      overlappingSegments,
      reason: overlapPercentage > 0
        ? "Retained TxDOT geometry overlaps the candidate route corridor."
        : "Retained TxDOT geometry did not overlap the candidate route corridor within tolerance."
    };
  }

  globalScope.gridlyTxdotGeometryRetentionPrototype = {
    retainedRecordFromFeature,
    scoreRouteOverlap
  };
})(typeof window !== "undefined" ? window : globalThis);
