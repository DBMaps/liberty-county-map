export const TERMINAL_STATES = Object.freeze([
  'HEALTHY_WITH_DATA', 'HEALTHY_EMPTY', 'STALE_RETAINED', 'FAILED',
  'UNAVAILABLE', 'TIMEOUT', 'NOT_AVAILABLE_IN_RUNTIME'
]);

export function normalizeIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].sort();
}

/** Proves that the wraparound predecessor is already the current governed
 * selection. PLACE identity comes from the runtime audit's authoritative
 * fields; registry keys and labels are deliberately not identity fallbacks. */
export function currentOptionContextMatches(selected = {}, expected = {}) {
  const expectedCounty = expected.operationalActiveCounty || expected.countyId || null;
  const activeCounty = selected.activeCountyId || selected.activeCounty || null;
  if (!expectedCounty || activeCounty !== expectedCounty) return false;

  if (expected.placeGeoid) {
    const selectedPlaceGeoid = selected.selectedPlaceGeoid || selected.placeGeoid
      || selected.selectedCommunityId || selected.communityId || selected.canonicalPlaceGeoid || null;
    const selectedCounty = selected.selectedCountyId || selected.countyId
      || selected.resolvedGridlyCountyId || null;
    return Boolean(expected.placeGeoid
      && selectedPlaceGeoid === expected.placeGeoid
      && selectedCounty === expectedCounty);
  }

  return Boolean(expected.canonicalKey && selected.awarenessAreaKey === expected.canonicalKey);
}

export function exactIdParity(policy = [], leaflet = [], dom = []) {
  const sets = [policy, leaflet, dom].map(normalizeIds);
  return { pass: JSON.stringify(sets[0]) === JSON.stringify(sets[1]) && JSON.stringify(sets[1]) === JSON.stringify(sets[2]), policyVisibleIds: sets[0], leafletMarkerIds: sets[1], domMarkerIds: sets[2] };
}

export function classifyDriveTexas(envelope, timedOut = false) {
  if (timedOut) return 'TIMEOUT';
  if (!envelope || typeof envelope !== 'object') return 'NOT_AVAILABLE_IN_RUNTIME';
  const raw = String(envelope.sourceStatus || envelope.sourceHealthState || envelope.status || '').toUpperCase();
  if (raw === 'HEALTHY_WITH_DATA') return 'HEALTHY_WITH_DATA';
  // Zero is only healthy when the governed envelope explicitly confirms success.
  if (raw === 'HEALTHY_EMPTY' && (envelope.requestCompleted === true || envelope.successfulCurrentFetch === true || envelope.quietEligible === true)) return 'HEALTHY_EMPTY';
  if (/WITH_RETAINED|STALE/.test(raw)) return 'STALE_RETAINED';
  if (/UNAVAILABLE/.test(raw)) return 'UNAVAILABLE';
  if (/FAIL|ERROR|PROJECTION_DEFECT/.test(raw)) return 'FAILED';
  return null;
}

export function evaluateExpectedEmptyRail(expectedState, expectedCount, liveCount) {
  const expectedEmpty = expectedState === 'ACTIVE_EMPTY' && expectedCount === 0;
  return { classification: expectedEmpty ? 'RAIL_EXPECTED_EMPTY' : 'RAIL_WITH_DATA', pass: expectedEmpty ? liveCount === 0 : Number.isInteger(liveCount) && liveCount > 0 };
}

const cameraNear = (actual, expected) => Boolean(actual && expected
  && Math.abs(Number(actual.lat) - Number(expected.lat)) <= 0.001
  && Math.abs(Number(actual.lng) - Number(expected.lng)) <= 0.001);

/** Seed settlement is deliberately weaker than certification.  It proves that
 * every consumer has reached the selected predecessor generation, not that a
 * live provider returned useful data. */
export function evaluateSeedSettlement(row, runtime = {}) {
  const expectedEmptyRail = row.railManifestStatus === 'ACTIVE_EMPTY' && row.railGovernedCount === 0;
  const driveTerminal = TERMINAL_STATES.includes(runtime.driveState);
  const railCount = Number(runtime.railInventoryCount);
  const renderCalls = Number(runtime.railRenderCalls || 0);
  const conditions = {
    selectedCommunityMatchesExpected: runtime.selectedCommunity === row.canonicalKey,
    activeCountyMatchesExpected: runtime.activeCounty === row.countyId,
    cameraSettled: cameraNear(runtime.mapCenter, row.semanticCameraTarget) && Number(runtime.mapZoom) === Number(row.semanticCameraTarget?.zoom),
    roadwayCountyStateSettled: runtime.roadwayCounty === row.countyId,
    roadwayLoadTerminal: runtime.roadwayLoaded === true || TERMINAL_STATES.includes(runtime.roadwayState),
    driveTexasLifecycleTerminal: driveTerminal,
    officialRoadwayConsumerSettled: runtime.officialRoadwaySettled === true || driveTerminal,
    alertsConsumerSettled: runtime.alertsSettled === true || driveTerminal,
    railSourceCountySettled: runtime.railSourceCounty === row.countyId,
    railInventoryTerminal: expectedEmptyRail ? railCount === 0 && renderCalls > 0 : runtime.railInventoryTerminal === true,
    railPresentationTerminal: expectedEmptyRail ? railCount === 0 && renderCalls > 0 : runtime.railPresentationTerminal === true,
    staleStatePredecessorCleanupComplete: runtime.staleCleanupComplete !== false
  };
  const unsatisfied = Object.entries(conditions).filter(([, pass]) => !pass).map(([name]) => name);
  return { settled: unsatisfied.length === 0, conditions, unsatisfied };
}

export function evaluateAlerts({ eligibleCount, displayedCount, emptyReason, ownershipState }) {
  const countsValid = Number.isInteger(eligibleCount) && Number.isInteger(displayedCount);
  const emptyValid = eligibleCount === 0 && displayedCount === 0 && Boolean(emptyReason);
  return { pass: countsValid && (eligibleCount === 0 ? emptyValid : displayedCount === eligibleCount) && Boolean(ownershipState) };
}

export function compareStale(previous = {}, current = {}) {
  const checks = {};
  for (const key of ['selectedCommunity', 'activeCounty', 'roadwaySourceCounty', 'driveTexasRecordIds', 'railSourceCounty', 'railMarkerIds', 'alertCardIds', 'awarenessRecordIds']) {
    if (Array.isArray(previous[key])) checks[key] = !normalizeIds(current[key]).some(id => normalizeIds(previous[key]).includes(id));
    else checks[key] = previous[key] == null || current[key] !== previous[key];
  }
  return { checks, pass: Object.values(checks).every(Boolean) };
}

export function checkpointPayload(results, startedAt) {
  return { schemaVersion: 'gridly.lp215.live-checkpoint.v1', startedAt, results: [...results] };
}

export function resumeIndex(itinerary, checkpoint) {
  if (!checkpoint || !Array.isArray(checkpoint.results)) return 0;
  let index = 0;
  while (index < itinerary.length && checkpoint.results[index]?.countyFips === itinerary[index].countyFips) index += 1;
  return index;
}
