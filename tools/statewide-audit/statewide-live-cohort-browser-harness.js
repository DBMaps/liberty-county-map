(function installGridlyStatewideCohortHarness(global) {
  'use strict';

  const AUDIT_VERSION = 'gridly.statewide-live-cohort-audit.v7';
  const COHORT_URL = '/reports/statewide-audit/gridly-live-certification-cohort-v1.json';
  const CHECKPOINT_KEY = 'GRIDLY_STATEWIDE_COHORT_AUDIT_V7';
  const REPOSITORY_HEAD = 'b1b5707';
  const CLASS_STATUSES = new Set(['NOT_REQUIRED', 'PASS', 'FAIL', 'INCOMPLETE']);
  const DRIVE_TERMINAL = new Set(['HEALTHY_WITH_DATA', 'HEALTHY_EMPTY', 'SOURCE_FAILURE', 'RETAINED_DATA', 'UNAVAILABLE', 'TIMEOUT']);
  const REQUIRED_ROW_FIELDS = ['sequence', 'countyFips', 'countyId', 'community', 'placeGeoid', 'canonicalKey', 'stateVectorId', 'coverageReasons', 'liveClassesCovered', 'requiredDriveTexasObservation', 'requiredAlertsObservation', 'requiredOfficialRoadwayObservation', 'requiredMapObservation', 'transitionAssertions', 'ownerActions', 'passAssertions', 'failureAssertions'];
  const state = { cohort: null, rows: [], results: [], index: 0, running: false, stopped: false, waiting: null, manualActionStatus: null, startedAt: null, completedAt: null, previous: null };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const safe = (fn, fallback = null) => { try { return fn(); } catch (_) { return fallback; } };
  const call = (name, fallback = null) => typeof global[name] === 'function' ? safe(() => global[name](), fallback) : fallback;
  const ids = value => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].sort();
  const sameIds = (a, b) => JSON.stringify(ids(a)) === JSON.stringify(ids(b));
  const required = (row, classId) => row.liveClassesCovered.includes(classId);

  function validateCohort(cohort) {
    if (!cohort || cohort.schemaVersion !== 'gridly.live-certification-cohort.v1' || !Array.isArray(cohort.itinerary)) throw new Error('MALFORMED_COHORT_ARTIFACT');
    const rows = cohort.itinerary;
    if (rows.length !== 14) throw new Error('COHORT_MUST_CONTAIN_14_ROWS');
    if (new Set(rows.map(row => row.stateVectorId)).size !== 14) throw new Error('COHORT_MUST_CONTAIN_14_UNIQUE_STATE_VECTORS');
    const ownerRows = rows.filter(row => row.alreadyCertifiedByOwnerEvidence === true);
    if (ownerRows.length !== 1 || rows.filter(row => row.alreadyCertifiedByOwnerEvidence !== true).length !== 13) throw new Error('COHORT_OWNER_EVIDENCE_CONTRACT_INVALID');
    if (!Array.isArray(cohort.sixLiveBrowserClasses) || cohort.sixLiveBrowserClasses.length !== 6) throw new Error('COHORT_LIVE_CLASS_CONTRACT_INVALID');
    rows.forEach((row, index) => {
      for (const field of REQUIRED_ROW_FIELDS) if (!(field in row)) throw new Error(`COHORT_ROW_${index + 1}_MISSING_${field}`);
      if (row.sequence !== index + 1 || !Array.isArray(row.coverageReasons) || !Array.isArray(row.liveClassesCovered) || !Array.isArray(row.transitionAssertions) || !Array.isArray(row.ownerActions) || !Array.isArray(row.passAssertions) || !Array.isArray(row.failureAssertions)) throw new Error(`COHORT_ROW_${index + 1}_INVALID`);
    });
    return rows;
  }

  const available = value => value === undefined ? null : value;
  const identity = value => String(value || '').replace(/^place-/, '') || null;

  function driveTexasState(evidence, timedOut = false) {
    if (!evidence) return timedOut ? 'TIMEOUT' : 'UNAVAILABLE';
    const raw = String(evidence.consumerEnvelopeHealth || evidence.sourceStatus || evidence.sourceHealthState || evidence.status || '').toUpperCase();
    const currentOwned = evidence.currentRequestOwnership === 'PROVEN';
    if (evidence.retainedDataPresent === true || /RETAIN|STALE/.test(raw)) return 'RETAINED_DATA';
    if (evidence.requestAttempted === true && (evidence.requestSuccess === false || evidence.consumerEnvelopeFetchFailed === true) || /FAIL|ERROR|DEFECT/.test(raw)) return 'SOURCE_FAILURE';
    if (evidence.requestAttempted === true && evidence.requestCompletedAt == null && evidence.requestSuccess !== false) return timedOut ? 'TIMEOUT' : 'IN_FLIGHT';
    if (currentOwned && evidence.requestSuccess === true && evidence.consumerEnvelopeRecordCount > 0) return 'HEALTHY_WITH_DATA';
    if (currentOwned && evidence.requestSuccess === true && evidence.consumerEnvelopeRecordCount === 0) return 'HEALTHY_EMPTY';
    if (/UNAVAILABLE|NOT_AVAILABLE/.test(raw) || evidence.networkingAvailable === false || evidence.providerActivated === false) return 'UNAVAILABLE';
    return timedOut ? 'TIMEOUT' : null;
  }

  function driveTexasEvidence(row, envelope, connector, awareness, official, alertsSurface) {
    const lifecycle = connector?.lifecycle || connector?.currentRequest || {};
    const currentIdentity = identity(row.placeGeoid);
    const areaIdentity = identity(envelope?.areaIdentity ?? envelope?.awarenessAreaIdentity ?? lifecycle.areaIdentity);
    const lifecycleIdentity = identity(lifecycle.areaIdentity ?? connector?.lifecycleAreaIdentity);
    const generation = available(lifecycle.generation ?? connector?.requestGeneration ?? envelope?.requestGeneration);
    const retainedOwner = identity(envelope?.retainedDataOwnerIdentity ?? connector?.retainedDataOwnerIdentity);
    const records = Array.isArray(envelope?.records) ? envelope.records : [];
    const evidence = {
      connectorConnected: available(connector?.connected ?? envelope?.connected), networkingAvailable: available(connector?.networkingAvailable), providerActivated: available(connector?.providerActivated),
      requestGeneration: generation, requestStartedAt: available(lifecycle.startedAt ?? connector?.requestStartedAt), requestCompletedAt: available(lifecycle.completedAt ?? connector?.requestCompletedAt), requestAttempted: available(lifecycle.attempted ?? connector?.requestAttempted), requestSuccess: available(lifecycle.success ?? connector?.requestSuccess), requestHttpStatus: available(lifecycle.httpStatus ?? connector?.requestHttpStatus), requestFailureReason: available(lifecycle.failureReason ?? connector?.requestFailureReason),
      currentAwarenessAreaIdentity: currentIdentity, currentAwarenessAreaCanonicalKey: available(row.canonicalKey), currentAwarenessAreaCountyId: available(row.countyId), lifecycleAreaIdentity: lifecycleIdentity, lifecycleRecordCount: available(lifecycle.recordCount ?? connector?.lifecycleRecordCount),
      consumerEnvelopeAreaIdentity: areaIdentity, consumerEnvelopeConnected: available(envelope?.connected), consumerEnvelopeFetchFailed: available(envelope?.fetchFailed), consumerEnvelopeHealthyEmpty: available(envelope?.healthyEmpty), consumerEnvelopeHealth: available(envelope?.sourceStatus ?? envelope?.sourceHealthState ?? envelope?.status), consumerEnvelopeRecordCount: records.length,
      retainedDataPresent: available(envelope?.retainedDataPresent ?? connector?.retainedDataPresent), retainedDataOwnerIdentity: retainedOwner, retainedDataGeneration: available(envelope?.retainedDataGeneration ?? connector?.retainedDataGeneration), publicationRevision: available(envelope?.publicationRevision ?? official?.publicationRevision), officialRoadwaySourceCount: available(official?.sourceRecordCount), publishedAlertsCount: available(alertsSurface?.publishedAlertCount ?? awareness?.activeIssueCount)
    };
    const generationOwned = generation != null && available(envelope?.requestGeneration) === generation;
    const areaOwned = areaIdentity === currentIdentity && (!lifecycleIdentity || lifecycleIdentity === currentIdentity);
    evidence.currentRequestOwnership = evidence.retainedDataPresent === true ? 'RETAINED' : evidence.requestSuccess === false || evidence.consumerEnvelopeFetchFailed === true ? 'FAILED' : evidence.requestSuccess === true && areaOwned && (generationOwned || envelope?.requestGeneration == null) ? 'PROVEN' : 'NOT_PROVEN';
    return evidence;
  }

  function settlement(row, observation) {
    const contextReady = observation.context.activeCountyId === row.countyId
      && String(observation.context.canonicalPlaceGeoid || '').replace(/^place-/, '') === String(row.placeGeoid);
    const roadwayReady = row.roadwayState === 'ROADWAY_EXPECTED_EMPTY'
      ? observation.roadway.loadedRoadwayCounty === row.countyId && observation.roadway.activeCountyPackageLoaded !== false
      : observation.roadway.loadedRoadwayCounty === row.countyId && observation.roadway.activeCountyPackageLoaded === true && Number(observation.roadwayFeatureCount) > 0;
    const railReady = row.railState === 'ACTIVE_EMPTY'
      ? Number(observation.rail.runtimeCrossingInventoryCount) === 0
      : observation.context.runtimeInventoryCounty === row.countyId && Number(observation.rail.runtimeCrossingInventoryCount) > 0 && sameIds(observation.railPolicyIds, observation.railLeafletIds) && sameIds(observation.railLeafletIds, observation.railDomIds);
    const driveReady = !required(row, 'DRIVETEXAS_LIVE_BROWSER_REQUIRED') || DRIVE_TERMINAL.has(observation.driveTexasState);
    return { ready: contextReady && roadwayReady && railReady && driveReady, contextReady, roadwayReady, railReady, driveReady };
  }

  function snapshot(row, timedOut = false) {
    const context = call('gridlyActiveCountyRuntimeAudit', {}) || {};
    const roadway = call('gridlyLp028RegionalRoadwayRuntimeAudit', {}) || {};
    const roadwayFeatureCount = call('gridlyRoadwayRuntimeAudit', {})?.roadwayFeatureCount ?? null;
    const rail = call('gridlyCrossingRenderAudit', {}) || {};
    const railParity = call('gridlyCrossingGenerationConsistencyAudit', {}) || {};
    const envelope = call('gridlyGetDriveTexasConsumerSourceStatusEnvelope', null);
    const connector = call('gridlyDriveTexasConnectorRuntimeAudit', null) || safe(() => global.gridlyDriveTexasConnector?.getRuntimeState?.(), null);
    const awareness = call('gridlyGetAuthoritativeCommunityAwarenessSummary', null)?.sharedActiveIssueContract || {};
    const alertsSurface = call('getAlertsSurfaceSnapshot', null);
    const official = call('gridlyLp214OfficialRoadwayMarkerPublicationAudit', {}) || {};
    const mapAudit = call('gridlyMapRuntimeAudit', {}) || {};
    const alertNodes = [...(global.document?.querySelectorAll?.('[data-gridly-alert-report-id], [data-gridly-canonical-incident-id]') || [])];
    const markerNodes = [...(global.document?.querySelectorAll?.('[data-gridly-official-roadway-id], [data-consumer-situation-id]') || [])];
    const railDomNodes = [...(global.document?.querySelectorAll?.('[data-gridly-crossing-id], [data-crossing-id]') || [])];
    const records = Array.isArray(envelope?.records) ? envelope.records : [];
    const driveTexasRecordIds = ids(records.map(record => record.consumerSituationId || record.sourceProviderRecordId || record.id));
    const officialMarkerIds = ids(official.markerIds || official.renderedMarkerIds || markerNodes.map(node => node.dataset.gridlyOfficialRoadwayId || node.dataset.consumerSituationId));
    const alertsPresentationOwner = {
      countyId: context.activeCountyId || null,
      placeGeoid: String(context.canonicalPlaceGeoid || '').replace(/^place-/, '') || null,
      canonicalKey: context.awarenessAreaKey || null
    };
    const alertsSheetOpen = String(call('gridlyPortraitV2RuntimeAudit', {})?.alertsSurfaceMode || '') === 'alerts_sheet_open';
    const driveEvidence = driveTexasEvidence(row, envelope, connector, awareness, official, alertsSurface);
    return {
      context, roadway, roadwayFeatureCount, rail, envelope, connector, driveEvidence, awareness, alertsSurface, official, mapAudit,
      alertsPresentationOwner, alertsSheetOpen,
      driveTexasState: driveTexasState(driveEvidence, timedOut), driveTexasRecordIds,
      railPolicyIds: ids(railParity.expectedMarkerIds), railLeafletIds: ids(railParity.actualMarkerIds),
      railDomIds: ids(railDomNodes.map(node => node.dataset.gridlyCrossingId || node.dataset.crossingId)),
      alertCardIds: ids(alertNodes.map(node => node.dataset.gridlyAlertReportId || node.dataset.gridlyCanonicalIncidentId)), officialMarkerIds,
      markerRegistryCount: markerNodes.length,
      matchingMarkerCount: markerNodes.filter(node => (node.dataset.gridlyOfficialRoadwayId || node.dataset.consumerSituationId) === officialMarkerIds[0]).length
    };
  }

  async function waitForSettlement(row, timeoutMs = 45000) {
    const started = performance.now(); let value;
    do { value = snapshot(row); if (settlement(row, value).ready) return { settled: true, value, elapsedMs: Math.round(performance.now() - started) }; await sleep(400); } while (!state.stopped && performance.now() - started < timeoutMs);
    value = snapshot(row, true);
    return { settled: false, value, elapsedMs: Math.round(performance.now() - started) };
  }

  function selectionContext(row, bridge) {
    const context = call('gridlyActiveCountyRuntimeAudit', {}) || {};
    const lexical = name => safe(() => global.eval(name), null);
    const selected = typeof global.getGridlySelectedAwarenessArea === 'function'
      ? safe(() => global.getGridlySelectedAwarenessArea(), null)
      : (typeof lexical('getGridlySelectedAwarenessArea') === 'function' ? safe(() => lexical('getGridlySelectedAwarenessArea')(), null) : null);
    const expectedPlaceGeoid = String(row.placeGeoid || row.canonicalKey || '').replace(/^place-/, '');
    const selectedPlaceGeoid = String(selected?.placeGeoid || selected?.communityId || '').replace(/^place-/, '');
    const operands = {
      expectedPlaceGeoid, expectedCountyId: row.countyId,
      bridgeResolvedPlaceGeoid: bridge?.placeGeoid || null,
      bridgeResolvedCountyId: bridge?.countyId || null,
      bridgeProductionKey: bridge?.productionKey || null,
      bridgeProductionStorageValue: bridge?.productionStorageValue || null,
      bridgeIdentityShape: bridge?.identityShape || null,
      bridgeGovernedIdentityCount: bridge?.governedIdentityCount ?? null,
      bridgeProductionTargetCount: bridge?.productionTargetCount ?? null,
      selectedRuntimeKey: selected?.key || context.awarenessAreaKey || null,
      selectedRuntimeStorageValue: selected?.storageValue || null,
      selectedRuntimeCountyId: selected?.countyId || context.resolvedGridlyCountyId || null,
      selectedRuntimePlaceGeoid: selectedPlaceGeoid || null,
      activeCountyId: context.activeCountyId || null,
      mapCameraTarget: null
    };
    const checks = bridge?.identityShape === 'MODERN_FULL'
      ? [
          ['MODERN_RUNTIME_PLACE_MATCHES_EXPECTED', Boolean(expectedPlaceGeoid && selectedPlaceGeoid === expectedPlaceGeoid)],
          ['SELECTED_RUNTIME_COUNTY_MATCHES_EXPECTED', operands.selectedRuntimeCountyId === row.countyId],
          ['ACTIVE_COUNTY_MATCHES_EXPECTED', operands.activeCountyId === row.countyId]
        ]
      : [
          ['BRIDGE_GOVERNED_IDENTITY_COUNT_EXACTLY_ONE', bridge?.governedIdentityCount === 1],
          ['BRIDGE_PLACE_MATCHES_EXPECTED', bridge?.placeGeoid === expectedPlaceGeoid],
          ['BRIDGE_COUNTY_MATCHES_EXPECTED', bridge?.countyId === row.countyId && bridge?.membershipMatched === true],
          ['BRIDGE_PRODUCTION_TARGET_COUNT_EXACTLY_ONE', bridge?.productionTargetCount === 1],
          ['SELECTED_RUNTIME_TARGET_MATCHES_BRIDGE', operands.selectedRuntimeKey === bridge?.productionKey && operands.selectedRuntimeStorageValue === bridge?.productionStorageValue],
          ['SELECTED_RUNTIME_COUNTY_MATCHES_EXPECTED', operands.selectedRuntimeCountyId === row.countyId],
          ['ACTIVE_COUNTY_MATCHES_EXPECTED', operands.activeCountyId === row.countyId]
        ];
    const firstFalseOperand = checks.find(([, passed]) => !passed)?.[0] || null;
    return { context, selected, operands, checks: Object.fromEntries(checks), firstFalseOperand, canonicalReady: firstFalseOperand === null, countyReady: operands.activeCountyId === row.countyId };
  }

  async function waitForSelectionContext(row, bridge, timeoutMs = 15000) {
    const started = performance.now(); let observed; let sawCanonical = false; let sawCounty = false;
    do {
      observed = selectionContext(row, bridge); sawCanonical ||= observed.canonicalReady; sawCounty ||= observed.countyReady;
      if (observed.canonicalReady && observed.countyReady) return { settled: true, value: observed.context, convergence: { operands: observed.operands, checks: observed.checks, firstFalseOperand: null } };
      await sleep(200);
    } while (!state.stopped && performance.now() - started < timeoutMs);
    observed = selectionContext(row, bridge);
    const error = new Error((sawCanonical || sawCounty || observed.canonicalReady || observed.countyReady) ? 'SELECTION_CONTEXT_MISMATCH' : 'SELECTION_CONTEXT_TIMEOUT');
    error.observedContext = observed.context;
    error.selectionConvergenceOperands = observed.operands;
    error.firstFalseOperand = observed.firstFalseOperand;
    throw error;
  }

  function compareStale(previous, current, assertions) {
    if (!previous || !assertions.length) return { status: 'NOT_REQUIRED', checks: {}, firstFalseOperand: null, pass: true };
    const checks = {
      selectedCommunity: current.context.awarenessAreaKey !== previous.community,
      activeCounty: current.context.activeCountyId !== previous.county,
      roadwaySourceCounty: current.roadway.loadedRoadwayCounty !== previous.roadwayCounty,
      railSourceCounty: current.context.runtimeInventoryCounty !== previous.railCounty,
      driveTexasRecordIds: !current.driveTexasRecordIds.some(id => previous.driveTexasIds.includes(id)),
      railMarkerIds: !current.railLeafletIds.some(id => previous.railIds.includes(id)),
      alertsPublication: !current.alertCardIds.some(id => previous.alertIds.includes(id)),
      officialRoadwayMarkers: !current.officialMarkerIds.some(id => previous.officialIds.includes(id))
    };
    const firstFalseOperand = Object.entries(checks).find(([, passed]) => !passed)?.[0] || null;
    return {
      status: firstFalseOperand === null ? 'PASS' : 'FAIL', checks, firstFalseOperand, pass: firstFalseOperand === null, transitionAssertions: assertions,
      operands: {
        previousCommunity: previous.community, previousCanonicalPlace: previous.canonicalPlace, previousCounty: previous.county,
        currentCommunity: current.context.awarenessAreaKey ?? null, currentCanonicalPlace: identity(current.context.canonicalPlaceGeoid), currentCounty: current.context.activeCountyId ?? null,
        previousDriveTexasRecordIds: previous.driveTexasIds, currentDriveTexasRecordIds: current.driveTexasRecordIds,
        previousOfficialRoadwayMarkerIds: previous.officialIds, currentOfficialRoadwayMarkerIds: current.officialMarkerIds,
        previousAlertsIds: previous.alertIds, currentAlertsIds: current.alertCardIds, previousRailIds: previous.railIds, currentRailIds: current.railLeafletIds,
        previousRoadwaySourceCounty: previous.roadwayCounty, currentRoadwaySourceCounty: current.roadway.loadedRoadwayCounty ?? null,
        previousRailSourceCounty: previous.railCounty, currentRailSourceCounty: current.context.runtimeInventoryCounty ?? null
      }
    };
  }

  function counts(observation) {
    const currentArea = observation.driveTexasRecordIds.length;
    return {
      driveTexasCurrentAreaCount: currentArea,
      consumerEnvelopeCount: Number(observation.awareness.activeOfficialRoadwayCount ?? currentArea),
      envelopeHealth: observation.driveTexasState,
      officialRoadwaySourceCount: Number(observation.official.sourceRecordCount ?? currentArea),
      eligibleMarkerCount: Number(observation.official.eligibleRecordCount ?? observation.official.representedRecordCount ?? 0),
      renderedMarkerCount: observation.officialMarkerIds.length,
      publishedAlertsCount: Number(observation.alertsSurface?.publishedAlertCount ?? observation.awareness.activeIssueCount ?? 0),
      activeAlertsRows: observation.alertCardIds,
      activeAlertsCount: observation.alertCardIds.length
    };
  }

  function manualActionSnapshot(row, observation) {
    const markerIdentity = available(observation.official?.markerObjectIdentity ?? observation.official?.markerAuditIdentity ?? observation.mapAudit?.officialRoadwayMarkerIdentity);
    const coordinates = available(observation.official?.markerCoordinates ?? observation.mapAudit?.officialRoadwayMarkerCoordinates);
    return {
      consumerSituationId: available(observation.official?.consumerSituationId ?? observation.driveTexasRecordIds[0]), expectedExistingMarkerIdentity: available(observation.officialMarkerIds[0]), markerObjectIdentity: markerIdentity,
      markerCoordinates: coordinates, viewportContainsMarker: available(observation.official?.markerInViewport ?? observation.mapAudit?.officialRoadwayMarkerInViewport), mapCenter: available(observation.mapAudit?.center), mapZoom: available(observation.mapAudit?.zoom), popupOpen: Boolean(observation.official?.popupOpen ?? observation.mapAudit?.popupOpen),
      activeCounty: available(observation.context.activeCountyId), selectedAwarenessKey: available(observation.context.awarenessAreaKey), canonicalPlace: identity(observation.context.canonicalPlaceGeoid), roadwaySourceCounty: available(observation.roadway.loadedRoadwayCounty), railSourceCounty: available(observation.context.runtimeInventoryCounty),
      markerRegistryCount: available(observation.official?.markerRegistryCount ?? observation.markerRegistryCount), matchingMarkerCount: available(observation.official?.matchingMarkerCount ?? observation.matchingMarkerCount), requestGeneration: available(observation.driveEvidence?.requestGeneration)
    };
  }

  function evaluateManualAction(before, after) {
    const sameMarker = before.markerObjectIdentity != null && before.markerObjectIdentity === after.markerObjectIdentity && before.expectedExistingMarkerIdentity === after.expectedExistingMarkerIdentity;
    const point = value => Array.isArray(value) ? value : value && [value.lat, value.lng];
    const oldCenter = point(before.mapCenter); const newCenter = point(after.mapCenter);
    const centerMoved = oldCenter?.length === 2 && newCenter?.length === 2 && Math.hypot(Number(newCenter[0]) - Number(oldCenter[0]), Number(newCenter[1]) - Number(oldCenter[1])) > 0.00001;
    const focusEffect = before.viewportContainsMarker === false ? after.viewportContainsMarker === true || centerMoved : after.popupOpen === true;
    const checks = {
      sameExactMarkerReused: sameMarker, expectedFocusEffect: focusEffect, popupOpen: after.popupOpen === true,
      activeCountyUnchanged: after.activeCounty === before.activeCounty, awarenessAreaUnchanged: after.selectedAwarenessKey === before.selectedAwarenessKey,
      canonicalPlaceUnchanged: after.canonicalPlace === before.canonicalPlace, noDuplicateMarker: after.matchingMarkerCount === 1 && after.markerRegistryCount === before.markerRegistryCount,
      noSourceRefetchAttributableToFocusAction: before.requestGeneration != null && after.requestGeneration === before.requestGeneration
    };
    const firstFalseOperand = Object.entries(checks).find(([, passed]) => !passed)?.[0] || null;
    return { status: firstFalseOperand ? 'MANUAL_ACTION_NOT_PROVEN' : 'MANUAL_ACTION_PROVEN', evidenceClassification: firstFalseOperand ? 'OWNER_ACTION_NOT_PROVEN' : 'PROVEN', checks, firstFalseOperand, before, after };
  }

  function alertsConditions(row, observation) {
    const c = counts(observation);
    const surface = observation.alertsSurface || {};
    const expectedGeoid = String(row.placeGeoid || '').replace(/^place-/, '');
    const observedGeoid = String(observation.context?.canonicalPlaceGeoid || '').replace(/^place-/, '');
    const presentationOwner = observation.alertsPresentationOwner || {};
    const ownerCurrent = presentationOwner.countyId === row.countyId
      && String(presentationOwner.placeGeoid || '').replace(/^place-/, '') === expectedGeoid
      && observedGeoid === expectedGeoid;
    const publishedMatchesSurface = c.publishedAlertsCount === Number(surface.count ?? surface.activeIncidentCount ?? 0);
    const emptyReason = String(surface.emptyReason || (c.publishedAlertsCount === 0 ? surface.nearbySummary : '') || '').trim();
    const domExpectationMet = observation.alertsSheetOpen === true
      ? c.activeAlertsCount === c.publishedAlertsCount
      : c.activeAlertsCount === 0;
    return {
      publishedAlertsCount: c.publishedAlertsCount,
      activeRowsCount: c.activeAlertsCount,
      activeAlertsCount: Number(surface.activeIncidentCount ?? surface.count ?? 0),
      explicitEmptyReason: emptyReason,
      selectedCanonicalPlaceGeoid: observedGeoid,
      presentationOwnerPlaceGeoid: String(presentationOwner.placeGeoid || ''),
      presentationOwnerCountyId: presentationOwner.countyId || null,
      alertsSheetOpen: observation.alertsSheetOpen === true,
      publishedMatchesSurface,
      ownerCurrent,
      emptyContractMet: c.publishedAlertsCount > 0 || Boolean(emptyReason),
      domExpectationMet
    };
  }

  function classResults(row, observation, settled, staleState) {
    const result = Object.fromEntries(state.cohort.sixLiveBrowserClasses.map(item => [item.classId, 'NOT_REQUIRED']));
    const set = (id, pass, incomplete = false) => { if (required(row, id)) result[id] = incomplete ? 'INCOMPLETE' : pass ? 'PASS' : 'FAIL'; };
    const c = counts(observation);
    set('DRIVETEXAS_LIVE_BROWSER_REQUIRED', ['HEALTHY_WITH_DATA', 'HEALTHY_EMPTY'].includes(observation.driveTexasState), !settled && !DRIVE_TERMINAL.has(observation.driveTexasState));
    set('RAIL_LIVE_BROWSER_REQUIRED', settlement(row, observation).railReady, !settled);
    set('OFFICIAL_ROADWAY_LIVE_BROWSER_REQUIRED', c.officialRoadwaySourceCount === c.eligibleMarkerCount && c.eligibleMarkerCount === c.renderedMarkerCount, !settled);
    const alertChecks = alertsConditions(row, observation);
    set('ALERTS_LIVE_BROWSER_REQUIRED', alertChecks.publishedMatchesSurface && alertChecks.ownerCurrent && alertChecks.emptyContractMet && alertChecks.domExpectationMet, !settled);
    set('STALE_OWNERSHIP_LIVE_BROWSER_REQUIRED', staleState.pass, false);
    // Completed after the owner confirms a required action, or PASS for a governed no-target state.
    set('SHOW_ON_MAP_LIVE_BROWSER_REQUIRED', c.eligibleMarkerCount === 0, c.eligibleMarkerCount > 0);
    for (const status of Object.values(result)) if (!CLASS_STATUSES.has(status)) throw new Error('INVALID_LIVE_CLASS_STATUS');
    return result;
  }

  function makeResult(row, settled, started, selectionConvergence = null) {
    const observation = settled.value;
    const staleState = compareStale(state.previous, observation, row.transitionAssertions);
    const liveClassResults = classResults(row, observation, settled.settled, staleState);
    const result = {
      sequence: row.sequence, stateVectorId: row.stateVectorId, countyId: row.countyId, community: row.community, placeGeoid: row.placeGeoid,
      selection: { canonicalKey: row.canonicalKey, observedCanonicalKey: observation.context.awarenessAreaKey ?? null, convergence: selectionConvergence },
      context: observation.context, roadway: { ...observation.roadway, featureCount: observation.roadwayFeatureCount, expectedState: row.roadwayState },
      driveTexas: { ...observation.driveEvidence, ...counts(observation), state: observation.driveTexasState, recordIds: observation.driveTexasRecordIds },
      officialRoadway: { ...observation.official, markerIds: observation.officialMarkerIds },
      alerts: { ...(observation.alertsSurface || {}), activeRowIds: observation.alertCardIds, conditionOperands: alertsConditions(row, observation) },
      rail: { ...observation.rail, expectedState: row.railState, policyIds: observation.railPolicyIds, leafletIds: observation.railLeafletIds, domIds: observation.railDomIds },
      map: observation.mapAudit, showOnMap: null, staleState, liveClassResults, manualActionEvidence: [], passAssertions: row.passAssertions,
      failureReasons: [], incompleteReasons: [], durationMs: Math.round(performance.now() - started)
    };
    for (const [classId, status] of Object.entries(liveClassResults)) {
      if (status === 'FAIL') result.failureReasons.push(`${classId}_FAILED`);
      if (status === 'INCOMPLETE') result.incompleteReasons.push(`${classId}_INCOMPLETE`);
    }
    return result;
  }

  function priorFrom(result) { return { community: result.selection.observedCanonicalKey, canonicalPlace: identity(result.context.canonicalPlaceGeoid || result.placeGeoid), county: result.context.activeCountyId, roadwayCounty: result.roadway.loadedRoadwayCounty, railCounty: result.context.runtimeInventoryCounty, driveTexasIds: result.driveTexas.recordIds || [], railIds: result.rail.leafletIds || [], alertIds: result.alerts.activeRowIds || [], officialIds: result.officialRoadway.markerIds || [] }; }
  function resultStatus(result) { return result.incompleteReasons.length ? 'INCOMPLETE' : result.failureReasons.length ? 'FAIL' : 'PASS'; }
  function saveCheckpoint() { sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ auditVersion: AUDIT_VERSION, artifactSchemaVersion: state.cohort.schemaVersion, startedAt: state.startedAt, completedPrefix: state.results.map(result => ({ sequence: result.sequence, stateVectorId: result.stateVectorId, canonicalKey: result.selection.canonicalKey })), results: state.results })); }

  function requiresManual(result) { return result.liveClassResults.SHOW_ON_MAP_LIVE_BROWSER_REQUIRED === 'INCOMPLETE'; }
  function printManual(row) { console.log(`[MANUAL ACTION REQUIRED]\n\nCommunity:\n${row.community}\n\nAction:\nIn Alerts, choose Show on map for the captured Official Roadway alert. Do not change community or county. Then run gridlyStatewideCohortContinue().`); }

  function resolveAuditSelection(row, consumerResult) {
    const geoid = String(row.placeGeoid || '').replace(/^place-/, '');
    const countyId = String(row.countyId || '');
    // Production declares these registries with top-level `const`, so they are
    // global lexical bindings rather than window properties. V3 read only the
    // latter and consequently saw no governed Chester identity at all.
    const lexical = name => safe(() => global.eval(name), null);
    const definitions = Array.isArray(global.GRIDLY_AWARENESS_AREA_DEFINITIONS)
      ? global.GRIDLY_AWARENESS_AREA_DEFINITIONS
      : (Array.isArray(lexical('GRIDLY_AWARENESS_AREA_DEFINITIONS')) ? lexical('GRIDLY_AWARENESS_AREA_DEFINITIONS') : []);
    const registry = global.GRIDLY_COUNTY_REGISTRY || lexical('GRIDLY_COUNTY_REGISTRY') || {};
    const county = registry[countyId] || null;
    const governed = (county?.consumerAwarenessAreas || []).filter(item => String(item?.placeGeoid || '') === geoid);
    const normalize = value => String(value || '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
    const candidates = consumerResult?.candidates || [];
    const trace = {
      cohort: { community: row.community, canonicalKey: row.canonicalKey, placeGeoid: geoid, countyId, governedMemberships: (row.governedMemberships || []).map(String) },
      productionAwarenessRegistryCandidates: definitions.map(area => ({ key: area?.key, label: area?.label, storageValue: area?.storageValue, countyId: area?.countyId, communityId: area?.communityId, placeGeoid: area?.placeGeoid, canonicalCommunityIdentity: area?.canonicalCommunityIdentity })),
      productionQueryResolution: { status: consumerResult?.status, operational: consumerResult?.operational, key: consumerResult?.awarenessArea?.key, label: consumerResult?.awarenessArea?.label, storageValue: consumerResult?.awarenessArea?.storageValue, countyId: consumerResult?.countyId || consumerResult?.awarenessArea?.countyId, communityId: consumerResult?.awarenessArea?.communityId, placeGeoid: consumerResult?.placeGeoid || consumerResult?.awarenessArea?.placeGeoid, canonicalCommunityIdentity: consumerResult?.awarenessArea?.canonicalCommunityIdentity },
      governedPlaceCandidates: (county?.consumerAwarenessAreas || []).map(item => ({ placeGeoid: item?.placeGeoid, displayName: item?.displayName, canonicalIdentity: item?.canonicalIdentity, countyMemberships: item?.countyMemberships })),
      candidatePlaceGeoids: candidates.map(candidate => candidate?.placeGeoid || candidate?.awarenessArea?.placeGeoid || null),
      candidateCountyMemberships: candidates.map(candidate => candidate?.countyMemberships || []),
      matchingGovernedIdentities: governed.length,
      matchingProductionAwarenessDefinitions: 0,
      finalResolvedProductionAwarenessValue: null,
      finalRejectionCondition: null
    };
    const reject = condition => { trace.finalRejectionCondition = condition; console.warn('[GRIDLY V7 IDENTITY BRIDGE TRACE]', trace); return null; };
    if (governed.length !== 1) return reject('GOVERNED_IDENTITY_COUNT_EXACTLY_ONE');
    const identity = governed[0];
    if (identity.canonicalIdentity !== 'PLACE_GEOID') return reject('GOVERNED_IDENTITY_IS_PLACE_GEOID');
    const memberships = (identity.countyMemberships || []).map(String).sort();
    if (!memberships.includes(String(row.countyFips)) || !sameIds(memberships, row.governedMemberships || [])) return reject('EXPECTED_GOVERNED_MEMBERSHIP_MATCHES');

    // A full definition proves identity by PLACE fields. A partial legacy
    // definition is enriched only when the governed PLACE, expected county,
    // and the production query candidate all agree. A label is never enough.
    const queryAreas = [consumerResult?.awarenessArea, ...candidates.map(candidate => candidate?.awarenessArea)].filter(Boolean);
    const uniqueDefinitions = [...definitions, ...queryAreas].filter((area, index, all) => all.findIndex(other => other === area || (other?.key === area?.key && other?.countyId === area?.countyId && other?.storageValue === area?.storageValue)) === index);
    const queryTargets = new Set(queryAreas.filter(area => (area?.countyId || consumerResult?.countyId) === countyId).map(area => `${area?.key || ''}\u0000${area?.storageValue || ''}`));
    const areas = uniqueDefinitions.filter(area => {
      if (!area || area.countyWide || area.fallback || area.countyId !== countyId || !area.storageValue) return false;
      const areaGeoid = String(area.placeGeoid || area.communityId || '').replace(/^place-/, '');
      if (areaGeoid) return areaGeoid === geoid && (!area.canonicalCommunityIdentity || area.canonicalCommunityIdentity === 'PLACE_GEOID');
      const target = `${area.key || ''}\u0000${area.storageValue || ''}`;
      return queryTargets.has(target) && [area.label, area.storageValue].some(value => normalize(value) === normalize(identity.displayName));
    });
    trace.matchingProductionAwarenessDefinitions = areas.length;
    if (areas.length !== 1) return reject('PRODUCTION_SELECTION_TARGET_COUNT_EXACTLY_ONE');
    const area = areas[0];
    const areaGeoid = String(area.placeGeoid || area.communityId || '').replace(/^place-/, '');
    const bridge = Object.freeze({
      placeGeoid: geoid, countyId, productionKey: area.key, productionStorageValue: area.storageValue,
      identityShape: areaGeoid ? 'MODERN_FULL' : 'LEGACY_PARTIAL', governedIdentityCount: governed.length,
      productionTargetCount: areas.length, membershipMatched: true
    });
    trace.finalResolvedProductionAwarenessValue = area.storageValue;
    if (row.multiCounty) {
      if (memberships.length < 2 || !['RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', 'AMBIGUOUS'].includes(consumerResult?.status)) return reject('MULTI_COUNTY_QUERY_CONTRACT_MATCHES');
      console.log('[GRIDLY V7 IDENTITY BRIDGE TRACE]', trace);
      return { multiCounty: true, bridge, resolution: consumerResult.status === 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE' ? consumerResult : { ...consumerResult, status: 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', operational: true, placeGeoid: geoid, awarenessArea: { ...area, key: `place-${geoid}`, placeGeoid: geoid, communityId: geoid, countyMemberships: memberships } } };
    }
    if (memberships.length !== 1) return reject('SINGLE_COUNTY_MEMBERSHIP_COUNT_EXACTLY_ONE');
    if (consumerResult?.operational !== true) return reject('PRODUCTION_QUERY_IS_OPERATIONAL');
    console.log('[GRIDLY V7 IDENTITY BRIDGE TRACE]', trace);
    return { multiCounty: false, bridge, resolution: { ...consumerResult, status: 'RESOLVED_OPERATIONAL', operational: true, placeGeoid: geoid, countyId, awarenessAreaKey: area.key, awarenessArea: { ...area, placeGeoid: geoid, communityId: geoid, canonicalCommunityIdentity: 'PLACE_GEOID' }, candidates } };
  }

  async function select(row, timeoutMs = 15000) {
    if (typeof global.resolveGridlyAwarenessAreaQuery !== 'function') throw new Error('SELECTION_ACTION_NOT_AVAILABLE');
    let resolved;
    try { resolved = global.resolveGridlyAwarenessAreaQuery(row.community); }
    catch (error) { const failure = new Error('SELECTION_ACTION_THROW'); failure.cause = error; throw failure; }
    const bridged = resolveAuditSelection(row, resolved);
    if (!bridged) throw new Error('SELECTION_INPUT_UNRESOLVED');
    resolved = bridged.resolution;
    const multiCounty = bridged.multiCounty;
    const actionName = multiCounty ? 'gridlySaveCanonicalMultiCountyPlaceHome' : 'selectGridlySettingsAwarenessArea';
    if (typeof global[actionName] !== 'function') throw new Error('SELECTION_ACTION_NOT_AVAILABLE');
    try {
      // Both production owners are commands. Their immediate return is not proof
      // that the asynchronous county/community transition has converged.
      if (multiCounty) global[actionName](resolved, 'statewide_live_cohort_audit');
      else global[actionName](resolved.awarenessArea?.storageValue || resolved.awarenessAreaKey, 'statewide_live_cohort_audit', null);
    } catch (error) { const failure = new Error('SELECTION_ACTION_THROW'); failure.cause = error; throw failure; }
    return waitForSelectionContext(row, bridged.bridge, timeoutMs);
  }

  async function run() {
    if (state.running || state.waiting) return global.gridlyStatewideCohortStatus();
    state.running = true; state.stopped = false;
    while (state.index < state.rows.length && !state.stopped) {
      const row = state.rows[state.index];
      if (row.alreadyCertifiedByOwnerEvidence === true) {
        const preserved = { sequence: row.sequence, stateVectorId: row.stateVectorId, countyId: row.countyId, community: row.community, placeGeoid: row.placeGeoid, selection: { canonicalKey: row.canonicalKey, observedCanonicalKey: row.canonicalKey }, context: { activeCountyId: row.countyId, runtimeInventoryCounty: row.countyId }, roadway: { loadedRoadwayCounty: row.countyId, expectedState: row.roadwayState }, driveTexas: { state: 'HEALTHY_WITH_DATA', recordIds: [] }, officialRoadway: { markerIds: [] }, alerts: { activeRowIds: [] }, rail: { expectedState: row.railState, leafletIds: [] }, map: {}, showOnMap: { evidenceClassification: 'ALREADY_OBSERVED' }, staleState: { status: 'PRESERVED_OWNER_EVIDENCE' }, liveClassResults: Object.fromEntries(row.liveClassesCovered.map(id => [id, 'PASS'])), manualActionEvidence: [], passAssertions: row.passAssertions, failureReasons: [], incompleteReasons: [], durationMs: 0, alreadyCertifiedByOwnerEvidence: true };
        state.results.push(preserved); state.previous = priorFrom(preserved); state.index++; saveCheckpoint(); continue;
      }
      const started = performance.now();
      try {
        const selected = await select(row);
        const settled = await waitForSettlement(row);
        const result = makeResult(row, settled, started, selected.convergence);
        state.results.push(result); state.previous = priorFrom(result); state.index++; saveCheckpoint();
        if (requiresManual(result)) { const beforeObservation = snapshot(row); state.waiting = { row, result, before: manualActionSnapshot(row, beforeObservation) }; state.manualActionStatus = 'WAITING_FOR_MANUAL_ACTION'; saveCheckpoint(); printManual(row); break; }
      } catch (error) {
        state.results.push({ sequence: row.sequence, stateVectorId: row.stateVectorId, countyId: row.countyId, community: row.community, placeGeoid: row.placeGeoid, selection: { canonicalKey: row.canonicalKey, convergence: error.selectionConvergenceOperands ? { operands: error.selectionConvergenceOperands, firstFalseOperand: error.firstFalseOperand || null } : null }, context: error.observedContext || {}, roadway: {}, driveTexas: {}, officialRoadway: {}, alerts: {}, rail: {}, map: {}, showOnMap: null, staleState: {}, liveClassResults: Object.fromEntries(state.cohort.sixLiveBrowserClasses.map(item => [item.classId, required(row, item.classId) ? 'INCOMPLETE' : 'NOT_REQUIRED'])), manualActionEvidence: [], passAssertions: row.passAssertions, failureReasons: [], incompleteReasons: [error.message || String(error)], durationMs: Math.round(performance.now() - started) });
        state.index++; state.stopped = true; saveCheckpoint();
        break;
      }
    }
    state.running = false;
    if (state.index === state.rows.length && !state.waiting) { state.completedAt = new Date().toISOString(); saveCheckpoint(); }
    return global.gridlyStatewideCohortStatus();
  }

  function validateCheckpoint(checkpoint) {
    if (!checkpoint) return [];
    if (checkpoint.auditVersion !== AUDIT_VERSION || checkpoint.artifactSchemaVersion !== state.cohort.schemaVersion || !Array.isArray(checkpoint.results) || !Array.isArray(checkpoint.completedPrefix)) throw new Error('CHECKPOINT_CONTRACT_INVALID');
    checkpoint.completedPrefix.forEach((saved, index) => { const row = state.rows[index]; if (!row || saved.sequence !== row.sequence || saved.stateVectorId !== row.stateVectorId || saved.canonicalKey !== row.canonicalKey) throw new Error('CHECKPOINT_COMPLETED_PREFIX_MISMATCH'); });
    return checkpoint.results.slice(0, checkpoint.completedPrefix.length);
  }

  function payload() {
    const statuses = state.results.map(resultStatus);
    const classStatuses = state.results.flatMap(result => Object.values(result.liveClassResults || {}));
    return { auditVersion: AUDIT_VERSION, cohortArtifactIdentity: { url: COHORT_URL, schemaVersion: state.cohort?.schemaVersion || null }, repositoryHead: REPOSITORY_HEAD, startedAt: state.startedAt, completedAt: state.completedAt,
      browserRuntime: { userAgent: navigator.userAgent, language: navigator.language, href: location.href }, checkpoint: { namespace: CHECKPOINT_KEY, completedSequence: state.index },
      summary: { expectedCohortRows: 14, ownerEvidenceRows: state.results.filter(result => result.alreadyCertifiedByOwnerEvidence).length, newlyExecutedRows: state.results.filter(result => !result.alreadyCertifiedByOwnerEvidence).length, pass: statuses.filter(x => x === 'PASS').length, fail: statuses.filter(x => x === 'FAIL').length, incomplete: 14 - statuses.filter(x => x === 'PASS').length - statuses.filter(x => x === 'FAIL').length, manualActionsPerformed: state.results.reduce((n, result) => n + result.manualActionEvidence.length, 0), liveClassesPass: classStatuses.filter(x => x === 'PASS').length, liveClassesFail: classStatuses.filter(x => x === 'FAIL').length, liveClassesIncomplete: classStatuses.filter(x => x === 'INCOMPLETE').length }, results: state.results };
  }

  global.gridlyStatewideCohortStatus = () => ({ running: state.running, stopped: state.stopped, pausedForManualAction: Boolean(state.waiting), manualActionStatus: state.manualActionStatus, nextSequence: state.waiting?.row.sequence || state.rows[state.index]?.sequence || null, completedRows: state.results.length, expectedRows: 14 });
  global.gridlyStatewideCohortContinue = async () => { if (!state.waiting) throw new Error('NO_MANUAL_ACTION_PENDING'); const { row, result, before } = state.waiting; const after = manualActionSnapshot(row, snapshot(row)); const handshake = evaluateManualAction(before, after); const passed = handshake.status === 'MANUAL_ACTION_PROVEN'; result.showOnMap = handshake;
    result.manualActionEvidence.push({ confirmedAt: new Date().toISOString(), action: 'SHOW_ON_MAP', ...handshake }); result.liveClassResults.SHOW_ON_MAP_LIVE_BROWSER_REQUIRED = passed ? 'PASS' : 'INCOMPLETE'; result.incompleteReasons = result.incompleteReasons.filter(reason => reason !== 'SHOW_ON_MAP_LIVE_BROWSER_REQUIRED_INCOMPLETE'); if (!passed) result.incompleteReasons.push('OWNER_ACTION_NOT_PROVEN'); state.manualActionStatus = handshake.status; state.waiting = null; saveCheckpoint(); return run(); };
  global.gridlyStatewideCohortStop = () => { state.stopped = true; return global.gridlyStatewideCohortStatus(); };
  global.gridlyStatewideCohortResume = () => run();
  global.gridlyStatewideCohortExport = (download = true) => { const output = JSON.stringify(payload(), null, 2) + '\n'; if (download) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([output], { type: 'application/json' })); anchor.download = 'gridly-statewide-live-cohort-audit-v7.json'; anchor.click(); URL.revokeObjectURL(anchor.href); } return output; };
  global.gridlyStatewideCohortClearCheckpoint = () => { sessionStorage.removeItem(CHECKPOINT_KEY); return true; };
  global.gridlyStatewideCohortStart = async () => { const response = await fetch(COHORT_URL, { cache: 'no-store' }); if (!response.ok) throw new Error(`COHORT_FETCH_FAILED_${response.status}`); state.cohort = await response.json(); state.rows = validateCohort(state.cohort); const checkpoint = safe(() => JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY)), null); state.results = validateCheckpoint(checkpoint); state.index = state.results.length; state.startedAt = checkpoint?.startedAt || new Date().toISOString(); state.previous = state.results.length ? priorFrom(state.results.at(-1)) : null; return run(); };

  global.__gridlyStatewideCohortHarnessTest = { validateCohort, driveTexasState, driveTexasEvidence, settlement, counts, compareStale, manualActionSnapshot, evaluateManualAction, alertsConditions, resolveAuditSelection, validateCheckpoint, payload, select, selectionContext, waitForSelectionContext, run, state, CHECKPOINT_KEY, AUDIT_VERSION };
  console.log('Gridly statewide live cohort audit harness installed. Starting/resuming.');
  global.gridlyStatewideCohortStart();
})(window);
