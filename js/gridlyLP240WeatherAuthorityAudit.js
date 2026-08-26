(function initGridlyLP240WeatherAuthorityAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const freeze = (value) => value && typeof value === "object" ? Object.freeze(value) : value;
  const count = (value) => Array.isArray(value) ? value.length : Math.max(0, Number(value) || 0);
  const text = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function classifyWeatherAuthority(input = {}) {
    const sourceConfigured = input.sourceConfigured === true;
    const sourceRequestAttempted = input.sourceRequestAttempted === true;
    const sourceRequestSucceeded = input.sourceRequestSucceeded === true;
    const sourceHealthy = input.sourceHealthy === true;
    const sourceFreshEnough = input.sourceFreshEnough === true;
    const canonicalGeographyResolved = input.canonicalGeographyResolved === true;
    const geographyAgreementPass = input.geographyAgreementPass === true;
    const currentApplicableCount = count(input.currentApplicableCount);
    const presentationCount = count(input.presentationCount);
    const presentationEmptyState = text(input.presentationEmptyState);
    const claimsQuiet = presentationCount === 0 && /no active weather alerts/i.test(presentationEmptyState);
    let weatherAuthorityState = "UNAVAILABLE";
    let authorityReason = "Weather authority has not established source and geographic availability.";
    let firstLosingStage = "SOURCE_CONFIGURATION";

    if (!sourceConfigured) authorityReason = "Weather source is not configured or activated.";
    else if (!sourceRequestAttempted) {
      authorityReason = "Weather source has not been requested for this runtime context.";
      firstLosingStage = "SOURCE_REQUEST";
    } else if (!sourceRequestSucceeded || !sourceHealthy) {
      authorityReason = text(input.sourceError) || "Weather source request failed or is unhealthy.";
      firstLosingStage = "SOURCE_HEALTH";
    } else if (!sourceFreshEnough) {
      authorityReason = "Weather source evidence is not fresh enough for authority.";
      firstLosingStage = "SOURCE_FRESHNESS";
    } else if (!canonicalGeographyResolved || !geographyAgreementPass) {
      authorityReason = "Provider geography is not authoritatively associated with the selected governed geography.";
      firstLosingStage = "GOVERNED_GEOGRAPHY";
    } else if (currentApplicableCount > 0) {
      weatherAuthorityState = "ACTIVE";
      authorityReason = `${currentApplicableCount} current applicable weather alert${currentApplicableCount === 1 ? "" : "s"} survived authority selection.`;
      firstLosingStage = null;
    } else {
      weatherAuthorityState = "QUIET";
      authorityReason = "A healthy source successfully evaluated the governed geography with zero current applicable weather alerts.";
      firstLosingStage = null;
    }

    const quietProven = weatherAuthorityState === "QUIET";
    const presentationAgreementPass = weatherAuthorityState === "ACTIVE"
      ? presentationCount === currentApplicableCount && !claimsQuiet
      : weatherAuthorityState === "QUIET"
        ? presentationCount === 0 && claimsQuiet
        : !claimsQuiet;
    return freeze({
      weatherAuthorityState,
      authorityReason,
      firstLosingStage,
      quietProven,
      unavailableReason: weatherAuthorityState === "UNAVAILABLE" ? authorityReason : null,
      presentationAgreementPass
    });
  }

  function safeCall(fn) {
    try { return typeof fn === "function" ? fn() : null; } catch (error) { return { auditError: text(error?.message || error) }; }
  }

  function getWeatherAuthorityEnvelope(options = {}) {
    const provider = options.provider || globalScope.gridlyWeatherProvider || null;
    const providerRuntime = options.providerRuntime || safeCall(provider?.getRuntimeState) || {};
    const connectorRuntime = options.connectorRuntime || safeCall(globalScope.gridlyWeatherConnectorRuntimeAudit) || {};
    const snapshot = options.snapshot || safeCall(globalScope.gridlyGetWeatherAuthoritySnapshot) || {};
    const now = Number(options.now) || Date.now();
    const freshnessLimitMs = Math.max(1, Number(connectorRuntime.refreshIntervalMs) || 120000) * 2;
    const lastSuccessMs = Date.parse(connectorRuntime.lastSuccessAt || "");
    const freshEnoughForAuthority = connectorRuntime.requestSucceeded === true
      && Number.isFinite(lastSuccessMs) && now - lastSuccessMs >= 0 && now - lastSuccessMs <= freshnessLimitMs;
    const selected = options.selected || safeCall(globalScope.getGridlySelectedAwarenessArea) || null;
    const canonical = options.canonical || safeCall(globalScope.gridlyGetCanonicalActiveCommunityState) || {};
    const pointMode = connectorRuntime.applicabilityMode === "NWS_POINT_QUERY";
    const point = connectorRuntime.selectedPoint || null;
    const canonicalGeographyResolved = pointMode ? Boolean(point?.awarenessKey && point?.stableIdentity && Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))) : Boolean(selected && (canonical.community || selected.storageValue || selected.label) && (canonical.countyId || selected.countyId));
    const geographyAgreementPass = pointMode ? connectorRuntime.pointRequestIdentity === connectorRuntime.currentAwarenessIdentity : options.geographyAgreementPass === true;
    return freeze({
      configured: pointMode || providerRuntime.enabled === true,
      enabled: pointMode || providerRuntime.enabled === true,
      requestAttempted: connectorRuntime.requestAttempted === true,
      requestSucceeded: connectorRuntime.requestSucceeded === true,
      lastAttemptAt: connectorRuntime.lastRequestAt || null,
      lastSuccessAt: connectorRuntime.lastSuccessAt || null,
      lastFailureAt: connectorRuntime.lastFailureAt || null,
      error: providerRuntime.lastError || connectorRuntime.lastError || null,
      healthy: (pointMode || providerRuntime.enabled === true) && connectorRuntime.requestSucceeded === true && connectorRuntime.connected === true && connectorRuntime.responseValid !== false && !connectorRuntime.lastError,
      freshEnoughForAuthority: pointMode ? connectorRuntime.freshEnough === true : freshEnoughForAuthority,
      freshness: (pointMode ? connectorRuntime.freshEnough === true : freshEnoughForAuthority) ? "FRESH" : (connectorRuntime.lastSuccessAt ? "STALE" : "UNKNOWN"),
      canonicalGeographyResolved,
      geographyAgreementPass,
      geographyEvaluation: geographyAgreementPass ? "GOVERNED_AGREEMENT_PROVEN" : "UNSUPPORTED_OR_UNRESOLVED",
      currentApplicableCount: Number(snapshot.authorityEligibleRecordCount || 0)
    });
  }

  function geometryType(record) {
    const value = record?.geometry || record?.__geometry || record?.alertGeometry || null;
    return value?.type === "Polygon" || value?.type === "MultiPolygon" ? value.type : (record?.geographyAudit?.geometryType || null);
  }

  function affectedZones(record) {
    const value = record?.affectedZones || record?.zones || record?.geography?.affectedZones || record?.geographyAudit?.affectedZones;
    return Array.isArray(value) ? value.filter((zone) => typeof zone === "string" && zone.trim()) : [];
  }

  function rings(geometry) {
    if (geometry?.type === "Polygon") return [geometry.coordinates?.[0]].filter(Array.isArray);
    if (geometry?.type === "MultiPolygon") return (geometry.coordinates || []).map((polygon) => polygon?.[0]).filter(Array.isArray);
    return [];
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
      if (((yi > point[1]) !== (yj > point[1])) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function orientation(a, b, c) { return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); }
  function segmentsIntersect(a, b, c, d) {
    return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
  }
  function ringIntersects(a, b) {
    if (a.some((point) => pointInRing(point, b)) || b.some((point) => pointInRing(point, a))) return true;
    for (let i = 1; i < a.length; i += 1) for (let j = 1; j < b.length; j += 1) if (segmentsIntersect(a[i - 1], a[i], b[j - 1], b[j])) return true;
    return false;
  }
  function geometriesIntersect(a, b) { return rings(a).some((left) => rings(b).some((right) => ringIntersects(left, right))); }

  const GOVERNED_GEOMETRY_SOURCE = "assets/location-resolution/gridly-authoritative-county-geometry-v1.json";
  const GOVERNED_GEOMETRY_RESOLVER = "gridlyLp0361cRuntimeCountyGeometryPackageLoader.getCandidateGeometries";

  // This is deliberately an adapter over the production county package, not a
  // second geometry registry.  A PLACE is joined to every governed membership
  // and all membership polygons are retained.  Consequently this geometry is
  // authoritative for the governed county/PLACE operational scope, but is not
  // mislabelled as the (currently absent) Census PLACE boundary.
  function resolveGovernedCommunityGeometry({ placeGeoid, membership, geometryLoader } = {}) {
    const fips = [...new Set((membership?.governedCountyFips || []).map(String))].sort();
    const countyIds = fips.map((value) => globalScope.gridlyRuntimeCountyIdentity?.resolveFips?.(value)?.countyId
      || Object.entries(globalScope.GRIDLY_COUNTY_REGISTRY || {}).find(([, row]) => String(row?.countyFips || "") === value)?.[0]
      || null).filter(Boolean);
    const loader = geometryLoader || globalScope.gridlyLp0361cRuntimeCountyGeometryPackageLoader;
    const records = loader?.getCandidateGeometries?.(countyIds);
    const complete = Boolean(placeGeoid && fips.length && countyIds.length === fips.length
      && Array.isArray(records) && records.length === countyIds.length
      && records.every((row) => rings(row?.geometry).length));
    if (!complete) return freeze({ available: false, placeGeoid: placeGeoid || null, lookupKey: countyIds.join("+") || null, countyIds: freeze(countyIds), records: freeze(records || []), geometry: null, valid: false });
    const polygons = records.flatMap((row) => row.geometry.type === "Polygon" ? [row.geometry.coordinates] : row.geometry.coordinates);
    return freeze({ available: true, placeGeoid, lookupKey: countyIds.join("+"), countyIds: freeze(countyIds), records: freeze(records),
      geometry: freeze({ type: "MultiPolygon", coordinates: freeze(polygons) }), valid: polygons.length > 0,
      featureId: `governed-memberships:${countyIds.join("+")}` });
  }

  function certifyGovernedGeometryCoverage() {
    const places = globalScope.gridlyCanonicalCrossingRuntime?.state?.data?.places || null;
    const loader = globalScope.gridlyLp0361cRuntimeCountyGeometryPackageLoader;
    if (!places || !loader) return null;
    let resolvable = 0; let invalid = 0; let single = 0; let multi = 0;
    for (const [placeGeoid, row] of Object.entries(places)) {
      const resolved = resolveGovernedCommunityGeometry({ placeGeoid, membership: { governedCountyFips: row.m }, geometryLoader: loader });
      if (resolved.available) { resolvable += 1; if (row.m.length > 1) multi += 1; else single += 1; }
      else if (resolved.records.length && !resolved.valid) invalid += 1;
    }
    const total = Object.keys(places).length;
    return freeze({ canonicalPlaceCount: total, governedGeometryResolvableCount: resolvable,
      governedGeometryMissingCount: total - resolvable, invalidGovernedGeometryCount: invalid,
      singleCountyResolvableCount: single, multiCountyResolvableCount: multi });
  }

  // LP240.1D describes (but does not alter) the production DriveTexas
  // community gate.  The selected PLACE contributes a presentation anchor,
  // not a boundary.  A provider point or trusted provider road line must come
  // within the configured awareness radius; text and county membership do not
  // override that spatial result in LP039.2/LP043.
  function describeCommunitySpatialSelection(options = {}) {
    const selected = options.selected || safeCall(globalScope.getGridlySelectedAwarenessArea) || null;
    const driveTexas = options.driveTexas || safeCall(globalScope.gridlyGetDriveTexasAuthoritySnapshot) || {};
    const authority = driveTexas.authority || driveTexas;
    const anchor = options.anchor || authority.selectedAwarenessAnchor || (Number.isFinite(Number(selected?.lat)) && Number.isFinite(Number(selected?.lng))
      ? { lat: Number(selected.lat), lng: Number(selected.lng) } : null);
    const radius = Number(options.radiusMiles ?? authority.selectedAwarenessRadiusMiles ?? selected?.radiusMiles ?? 7);
    return freeze({
      communitySpatialSelectionAvailable: Boolean(anchor && Number.isFinite(radius)),
      communitySpatialSelectionOwner: "gridlySelectDriveTexasAuthority (LP039.2/LP043 geometry authority)",
      communitySpatialSelectionFunction: "buildEligibilityProof -> gridlyQualifyDriveTexasGeometryAuthority.qualify",
      communitySpatialSelectionSource: "js/gridlyDriveTexasAuthoritySourceIntegration.js + js/gridlyDriveTexasGeometryAuthority.js",
      communitySpatialSelectionMode: "PRESENTATION_ANCHOR_RADIUS_WITH_TRUSTED_PROVIDER_POINT_OR_ROAD_LINE",
      communitySpatialSignals: freeze([
        "COUNTY_AUTHORITY: upstream governed county scope only",
        "PRESENTATION_ANCHOR: LP201 canonical PLACE focus",
        "DETERMINISTIC_PROXIMITY: inclusive distance <= awareness radius",
        "AUTHORITATIVE_NETWORK_GEOMETRY: trusted DriveTexas LineString/MultiLineString distance to anchor radius",
        "TEXTUAL_ASSOCIATION: retained metadata, never an LP039.2 eligibility override"
      ]),
      communityBoundaryGeometryAvailable: false,
      communityBoundaryGeometrySource: null,
      communityBoundaryGeometryType: null,
      communityPresentationCoordinateUsed: Boolean(anchor),
      communityPresentationCoordinate: anchor ? freeze({ latitude: Number(anchor.lat), longitude: Number(anchor.lng) }) : null,
      communityAwarenessRadiusUsed: Number.isFinite(radius),
      communityAwarenessRadiusMiles: Number.isFinite(radius) ? radius : null,
      communityDistancePredicateUsed: true,
      communityRoadwayGeometryUsed: true,
      communityRoadwayGeometryRole: "Trusted provider LineString/MultiLineString qualifies when its closest segment is within the same circular awareness radius; it does not prove municipal containment or use a named-road/corridor association.",
      communityTextAssociationUsed: false,
      communityTextAssociationRole: "Provider city, locality, county, route, title, and description are preserved for identity/presentation only; they cannot override the spatial gate.",
      communityCountyContainmentUsed: true,
      communitySelectionFallbackUsed: false,
      communitySelectionFallbackReason: null,
      communitySelectionAuthorityClass: "HYBRID_DETERMINISTIC_PROXIMITY_AUTHORITATIVE_NETWORK_GEOMETRY",
      exactCommunityApplicabilityProven: false,
      driveTexasCommunityPrecisionReason: "Dayton is distinguished by distance from its canonical presentation anchor (or distance from trusted provider roadway geometry to that anchor), not by a Dayton boundary.",
      weatherReuseClassification: "REUSABLE_FOR_WEATHER_AS_AWARENESS_ONLY",
      weatherReuseReason: "The circular proximity gate can approximate local awareness, but roadway-line authority is provider-domain-specific and neither signal proves that an area-hazard polygon intersects the canonical PLACE.",
      canonicalPlaceCount: 1859,
      communitySelectorSupportedCount: 1859,
      communitySelectorUnsupportedCount: 0,
      exactBoundarySupportedCount: 0,
      proximityOnlyCount: 1859,
      roadwayAuthorityCount: null,
      textFallbackCount: 0
    });
  }

  // Audit-only capability evaluator. It never promotes records or changes Weather state.
  function evaluatePlaceAlertGeography({ placeGeometry, alerts = [], zoneGeometries = {} } = {}) {
    const applicableAlertIds = []; const nonApplicableAlertIds = []; const unresolvedAlertIds = []; let evaluatedCount = 0;
    for (const [index, alert] of alerts.entries()) {
      const id = text(alert?.id || alert?.identifier) || `alert-${index}`;
      const explicit = alert?.geometry || alert?.__geometry || null;
      if (geometryType({ geometry: explicit }) && rings(placeGeometry).length) {
        evaluatedCount += 1;
        if (geometriesIntersect(placeGeometry, explicit)) applicableAlertIds.push(id); else nonApplicableAlertIds.push(id);
        continue;
      }
      const resolved = affectedZones(alert).map((zone) => zoneGeometries[zone]).filter((geometry) => rings(geometry).length);
      if (resolved.length && rings(placeGeometry).length) {
        evaluatedCount += 1;
        if (resolved.some((geometry) => geometriesIntersect(placeGeometry, geometry))) applicableAlertIds.push(id); else nonApplicableAlertIds.push(id);
      } else unresolvedAlertIds.push(id);
    }
    return freeze({ placeAlertIntersectionEvaluated: evaluatedCount > 0, placeAlertIntersectionCount: evaluatedCount, applicableAlertIds: freeze(applicableAlertIds), nonApplicableAlertIds: freeze(nonApplicableAlertIds), unresolvedAlertIds: freeze(unresolvedAlertIds) });
  }

  function auditRuntime() {
    const provider = globalScope.gridlyWeatherProvider || null;
    const connector = globalScope.gridlyWeatherConnector || null;
    const providerRuntime = safeCall(provider?.getRuntimeState) || {};
    const providerAudit = safeCall(globalScope.gridlyWeatherProviderAudit) || {};
    const connectorAudit = safeCall(globalScope.gridlyWeatherConnectorRuntimeAudit) || {};
    const snapshot = safeCall(globalScope.gridlyGetWeatherAuthoritySnapshot) || {};
    const consumer = safeCall(globalScope.gridlySelectConsumerVisibleWeatherSituations) || {};
    const alertsAudit = safeCall(globalScope.gridlyLP236AlertsInformationArchitectureAudit) || {};
    const canonical = safeCall(globalScope.gridlyGetCanonicalActiveCommunityState) || {};
    const selected = safeCall(globalScope.getGridlySelectedAwarenessArea) || canonical.selectedAwarenessArea || null;
    const providerRecords = safeCall(provider?.getNormalizedRecords) || [];
    const canonicalCommunity = canonical.community || selected?.storageValue || selected?.label || snapshot.activeCommunity || null;
    const resolvedPlaceId = safeCall(() => globalScope.gridlyResolveCanonicalPlaceGeoid?.(selected)) || null;
    const canonicalPlaceId = canonical.canonicalPlaceId || canonical.placeId || selected?.canonicalPlaceId || selected?.placeId || resolvedPlaceId || null;
    const membership = canonicalPlaceId ? safeCall(() => globalScope.gridlyCanonicalCrossingRuntime?.lookup?.({ placeGeoid: canonicalPlaceId })) : null;
    const governedFips = [...(membership?.governedCountyFips || selected?.countyMemberships || [])];
    const countyRegistry = globalScope.GRIDLY_COUNTY_REGISTRY || {};
    const governedMemberships = freeze(governedFips.map((fips) => Object.entries(countyRegistry).find(([, county]) => String(county?.countyFips || "") === String(fips))?.[0] || fips));
    const selectedGovernedMembership = canonical.authoritativeMembership || canonical.membership || selected?.countyId || null;
    const governedGeometry = resolveGovernedCommunityGeometry({ placeGeoid: canonicalPlaceId, membership });
    const statewideCoverage = certifyGovernedGeometryCoverage();
    const geographyEvaluation = evaluatePlaceAlertGeography({ placeGeometry: governedGeometry.geometry, alerts: providerRecords });
    const communitySelection = describeCommunitySpatialSelection({ selected });

    const connectorRecords = safeCall(connector?.getNormalizedRecords) || [];
    const weatherDoms = Array.from(globalScope.document?.querySelectorAll?.('[data-gridly-lp236-source="weather"]') || []);
    const weatherDom = weatherDoms.find((node) => node.querySelector?.('[data-gridly-lp236-condition-id]')) || weatherDoms[0] || null;
    const displayedWeatherNodes = Array.from(weatherDom?.querySelectorAll?.('[data-gridly-lp236-condition-id]') || []);
    const presentationCount = displayedWeatherNodes.length || Number(weatherDom?.dataset?.gridlyLp236Count ?? alertsAudit.weatherRenderedCount ?? 0) || 0;
    const presentationText = text(weatherDom?.textContent);
    const envelope = getWeatherAuthorityEnvelope({ provider, providerRuntime, connectorRuntime: connectorAudit, snapshot, selected, canonical, geographyAgreementPass: governedGeometry.available });
    const sourceConfigured = envelope.configured;
    const sourceRequestAttempted = envelope.requestAttempted;
    const sourceRequestSucceeded = envelope.requestSucceeded;
    const sourceHealthy = envelope.healthy;
    const canonicalGeographyResolved = envelope.canonicalGeographyResolved;
    const geographyAgreementPass = envelope.geographyAgreementPass;
    const currentApplicableCount = Number(envelope.currentApplicableCount ?? consumer.consumerVisibleSituationCount ?? 0) || 0;
    const classification = classifyWeatherAuthority({
      sourceConfigured, sourceRequestAttempted, sourceRequestSucceeded, sourceHealthy,
      sourceFreshEnough: envelope.freshEnoughForAuthority,
      sourceError: providerRuntime.lastError || connectorAudit.auditError || null,
      canonicalGeographyResolved, geographyAgreementPass, currentApplicableCount,
      presentationCount, presentationEmptyState: presentationText
    });
    const alertsStages = globalScope.__gridlyLp2194AlertStages || {};
    const isWeather = (record) => text(record?.sourceKind).toLowerCase() === "weather_provider";
    const alertsWeatherInputCount = Array.isArray(alertsStages.presentationCandidates) ? alertsStages.presentationCandidates.filter(isWeather).length : Number(alertsAudit.weatherInputCount || 0);
    const alertsWeatherPublishedCount = Array.isArray(alertsStages.finalAlertData) ? alertsStages.finalAlertData.filter(isWeather).length : Number(alertsAudit.weatherConditionCount ?? alertsWeatherInputCount) || 0;
    const selectedContextIdentity = connectorAudit.currentAwarenessIdentity || null;
    const requestIdentity = connectorAudit.pointRequestIdentity || null;
    const responseIdentity = connectorAudit.responseIdentity || null;
    const authorityIdentity = snapshot.authorityIdentity || null;
    const weatherFamilyIdentity = consumer.weatherFamilyIdentity || null;
    const alertsHandoff = globalScope.__gridlyLp2194AlertStages?.weatherAuthorityHandoff || {};
    const alertsWeatherCandidateIdentity = alertsHandoff.candidateIdentity || null;
    const alertsWeatherIdentity = alertsHandoff.acceptedIdentity
      || (alertsWeatherInputCount === currentApplicableCount && alertsWeatherPublishedCount === currentApplicableCount ? weatherFamilyIdentity : null);
    const selectedRequestAgreement = Boolean(selectedContextIdentity && selectedContextIdentity === requestIdentity);
    const requestResponseAgreement = Boolean(requestIdentity && requestIdentity === responseIdentity);
    const responseAuthorityAgreement = Boolean(responseIdentity && responseIdentity === authorityIdentity);
    const authorityFamilyAgreement = Boolean(authorityIdentity && authorityIdentity === weatherFamilyIdentity);
    const familyAlertsAgreement = Boolean(weatherFamilyIdentity && weatherFamilyIdentity === alertsWeatherIdentity);
    const allIdentityLineageAgreement = selectedRequestAgreement && requestResponseAgreement && responseAuthorityAgreement && authorityFamilyAgreement && familyAlertsAgreement;
    const result = {
      available: true,
      auditOnly: true,
      applicabilityMode: connectorAudit.applicabilityMode || null,
      selectedAwarenessKey: connectorAudit.selectedPoint?.awarenessKey || selected?.key || null,
      selectedIdentityClass: connectorAudit.selectedPoint?.identityClass || null,
      selectedCountyId: connectorAudit.selectedPoint?.countyId || selected?.countyId || null,
      selectedGovernedLat: connectorAudit.selectedPoint?.lat ?? null,
      selectedGovernedLng: connectorAudit.selectedPoint?.lng ?? null,
      pointAlertEndpoint: connectorAudit.pointAlertEndpoint || null,
      pointRequestAttempted: connectorAudit.requestAttempted === true,
      pointRequestSucceeded: connectorAudit.requestSucceeded === true,
      pointResponseValid: connectorAudit.responseValid === true,
      pointFetchedAt: connectorAudit.fetchedAt || null,
      pointFreshEnough: connectorAudit.freshEnough === true,
      pointActiveAlertCount: Number(connectorAudit.pointActiveAlertCount || 0),
      pointActiveAlertIds: connectorAudit.pointActiveAlertIds || freeze([]),
      pointActiveAlertEvents: connectorAudit.pointActiveAlertEvents || freeze([]),
      pointRequestIdentity: connectorAudit.pointRequestIdentity || null,
      currentAwarenessIdentity: connectorAudit.currentAwarenessIdentity || null,
      identityAgreementPass: Boolean(connectorAudit.pointRequestIdentity && connectorAudit.pointRequestIdentity === connectorAudit.currentAwarenessIdentity),
      selectedContextIdentity,
      requestIdentity,
      responseIdentity,
      authorityIdentity,
      weatherFamilyIdentity,
      alertsWeatherCandidateIdentity,
      alertsWeatherIdentity,
      alertsWeatherCandidateCount: Number(alertsHandoff.candidateCount || 0),
      alertsWeatherAcceptedCount: Number(alertsHandoff.acceptedCount || 0),
      alertsWeatherRejectedCount: Number(alertsHandoff.rejectedCount || 0),
      alertsWeatherFirstLosingStage: alertsHandoff.firstLosingStage || null,
      alertsWeatherRejectionReason: alertsHandoff.rejectionReason || null,
      selectedRequestAgreement,
      requestResponseAgreement,
      responseAuthorityAgreement,
      authorityFamilyAgreement,
      familyAlertsAgreement,
      allIdentityLineageAgreement,
      staleResponseSuppressedCount: Number(connectorAudit.staleResponseSuppressedCount || 0),
      canonicalCommunity,
      canonicalPlaceId,
      canonicalPlaceResolved: Boolean(canonicalPlaceId && membership),
      canonicalPlaceResolutionSource: canonicalPlaceId ? (resolvedPlaceId === canonicalPlaceId ? "LP239_LIVE_CANONICAL_PLACE_REGISTRY_RESOLVER" : "EXPLICIT_SELECTED_CANONICAL_PLACE_ID") : null,
      governedMembership: selectedGovernedMembership,
      governedMemberships,
      selectedGovernedMembership,
      canonicalPlaceGeometryAvailable: false,
      canonicalPlaceGeometrySource: null,
      canonicalPlaceGeometryType: null,
      canonicalPlaceGeometryFeatureId: null,
      canonicalPlaceGeometryValid: false,
      canonicalPlaceCount: 1859,
      placeGeometryAvailableCount: 0,
      placeGeometryMissingCount: 1859,
      invalidPlaceGeometryCount: 0,
      governedGeometryAvailable: governedGeometry.available,
      governedGeometrySource: GOVERNED_GEOMETRY_SOURCE,
      governedGeometryResolver: GOVERNED_GEOMETRY_RESOLVER,
      governedGeometryLookupKey: governedGeometry.lookupKey,
      governedGeometryFeatureId: governedGeometry.featureId || null,
      governedGeometryType: governedGeometry.geometry?.type || null,
      governedGeometryValid: governedGeometry.valid,
      governedGeometryAuthorityFamily: "STATEWIDE_GOVERNED_COUNTY_GEOMETRY",
      governedGeometryUnit: "county/PLACE membership composite (not Census PLACE boundary)",
      governedGeometryResolvableCount: statewideCoverage?.governedGeometryResolvableCount ?? 0,
      governedGeometryMissingCount: statewideCoverage?.governedGeometryMissingCount ?? 1859,
      invalidGovernedGeometryCount: statewideCoverage?.invalidGovernedGeometryCount ?? 0,
      singleCountyResolvableCount: statewideCoverage?.singleCountyResolvableCount ?? 0,
      multiCountyResolvableCount: statewideCoverage?.multiCountyResolvableCount ?? 0,
      driveTexasGeometryAgreement: governedGeometry.available,
      alertsGeometryAgreement: governedGeometry.available,
      weatherUsesSharedGovernedGeometry: governedGeometry.available,
      singleCountyPlaceCount: 1696,
      multiCountyPlaceCount: 163,
      activeCounty: canonical.countyId || selected?.countyId || snapshot.activeCounty || null,
      awarenessArea: selected || snapshot.selectedAwarenessArea || null,
      ...communitySelection,
      weatherProvider: provider?.name || providerAudit.provider || "Weather / NWS api.weather.gov",
      sourceConfigured,
      sourceRequestAttempted,
      sourceRequestSucceeded,
      sourceHealthy,
      sourceFreshness: envelope.freshness,
      sourceFreshEnough: envelope.freshEnoughForAuthority,
      sourceLastAttemptAt: envelope.lastAttemptAt,
      sourceLastSuccessAt: envelope.lastSuccessAt,
      sourceLastFailureAt: envelope.lastFailureAt,
      sourceError: providerRuntime.lastError || connectorAudit.auditError || null,
      providerGeographyType: "Texas statewide NWS active-alert feed; record centroid/radius or locality-text runtime filter",
      providerGeographyValue: globalScope.GRIDLY_CONFIG?.weather?.endpointTemplate || "https://api.weather.gov/alerts/active?area=TX",
      canonicalGeographyResolved,
      geographyAgreementPass,
      nwsRawAlertCount: Number(snapshot.rawRecordCount ?? providerRecords.length) || 0,
      nwsAlertsWithGeometryCount: providerRecords.filter((record) => geometryType(record)).length,
      nwsAlertsWithExplicitGeometryCount: providerRecords.filter((record) => geometryType(record)).length,
      nwsAlertsWithoutGeometryCount: providerRecords.filter((record) => !geometryType(record)).length,
      nwsAlertsWithAffectedZonesCount: providerRecords.filter((record) => affectedZones(record).length).length,
      nwsZoneResolutionAvailable: false,
      weatherPolygonEvaluationAvailable: governedGeometry.available,
      weatherPolygonEvaluationMode: governedGeometry.available ? "NWS_EXPLICIT_GEOMETRY_INTERSECTS_GOVERNED_MEMBERSHIP_COUNTY_COMPOSITE" : "UNAVAILABLE",
      weatherGeographyEvaluationMode: governedGeometry.available ? "AUDIT_ONLY_SHARED_GOVERNED_GEOMETRY" : "UNSUPPORTED",
      legacyRadiusTextMatchUsed: false,
      legacyRadiusTextAuthoritative: false,
      ...geographyEvaluation,
      geographyAuthorityReason: governedGeometry.available ? "Shared production county geometry resolves every governed membership; this proves county/PLACE composite evaluation but not exact Census PLACE-boundary precision." : "The shared production county geometry package is not yet cached or the canonical membership join is unresolved.",
      firstGeographyLosingStage: !canonicalPlaceId ? "CANONICAL_PLACE_IDENTITY" : (!governedGeometry.available ? "GOVERNED_GEOMETRY_RESOLUTION" : null),
      rawWeatherRecordCount: Number(snapshot.rawRecordCount ?? providerRecords.length) || 0,
      normalizedWeatherRecordCount: Number(snapshot.uniqueProviderRecordCount ?? providerRecords.length) || 0,
      geographicallyApplicableCount: Number(snapshot.authorityEligibleRecordCount ?? connectorRecords.length) || 0,
      currentApplicableCount,
      alertsWeatherInputCount,
      alertsWeatherPublishedCount,
      alertsWeatherDisplayedCount: presentationCount,
      alertsWeatherDomIdentityCount: new Set(displayedWeatherNodes.map((node) => node?.dataset?.gridlyLp236ConditionId).filter(Boolean)).size,
      weatherEvent: consumer?.consumerVisibleSituations?.[0]?.event || consumer?.consumerVisibleSituations?.[0]?.title || null,
      weatherDisplayLabel: text(weatherDom?.querySelector?.('[data-gridly-weather-event="true"]')?.textContent) || null,
      alertsDetailEvent: text(weatherDom?.querySelector?.('[data-gridly-weather-event="true"]')?.textContent) || null,
      alertsDetailTiming: text(weatherDom?.querySelector?.('[data-gridly-weather-timing="true"]')?.textContent) || null,
      alertsDetailSource: text(weatherDom?.querySelector?.('[data-gridly-weather-source="true"]')?.textContent) || null,
      kbygWeatherSummary: text(globalScope.document?.querySelector?.('[data-gridly-travel-brief-section="weather"]')?.textContent) || null,
      ...classification,
      presentationCount,
      presentationEmptyState: presentationText || null,
      presentationText: presentationText || null,
      overallPass: classification.presentationAgreementPass && (connectorAudit.applicabilityMode !== "NWS_POINT_QUERY" || allIdentityLineageAgreement)
    };
    return freeze(result);
  }

  globalScope.gridlyLP240ClassifyWeatherAuthority = classifyWeatherAuthority;
  globalScope.gridlyGetWeatherRuntimeAuthorityEnvelope = getWeatherAuthorityEnvelope;
  globalScope.gridlyLP240WeatherAuthorityAudit = auditRuntime;
  if (typeof module !== "undefined" && module.exports) module.exports = freeze({ classifyWeatherAuthority, getWeatherAuthorityEnvelope, evaluatePlaceAlertGeography, geometriesIntersect, resolveGovernedCommunityGeometry, describeCommunitySpatialSelection, auditRuntime });
})(typeof window !== "undefined" ? window : globalThis);
