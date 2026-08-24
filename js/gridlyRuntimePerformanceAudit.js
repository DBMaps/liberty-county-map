(function gridlyRuntimePerformanceAuditModule(globalScope) {
  "use strict";

  const VERSION = "LP224.2";
  const MAX_ENTRIES = 200;
  const startedAt = new Date().toISOString();
  let generation = 1;
  let generationSequence = 0;
  let measurementCutoff = 0;
  let currentTransactionId = null;
  const transactions = [];
  const longTasks = [];

  const now = () => globalScope.performance && typeof globalScope.performance.now === "function"
    ? globalScope.performance.now()
    : Date.now();
  const round = (value) => Number(Number(value || 0).toFixed(2));
  const safeCall = (name) => {
    try {
      return typeof globalScope[name] === "function" ? globalScope[name]() : null;
    } catch (error) {
      return { available: false, error: error?.message || String(error) };
    }
  };
  const trim = (items) => {
    if (items.length > MAX_ENTRIES) items.splice(0, items.length - MAX_ENTRIES);
  };
  const countFor = (records, pattern) => records
    .filter((entry) => pattern.test(`${entry.functionName || ""} ${entry.category || ""}`))
    .reduce((sum, entry) => sum + Number(entry.callCount || 0), 0);

  function readState() {
    const attribution = safeCall("gridlyMainThreadAttributionAudit") || {};
    const measured = Array.isArray(attribution.measuredFunctions) ? attribution.measuredFunctions : [];
    const refresh = safeCall("gridlyRefreshBreakdownAudit") || {};
    const background = safeCall("gridlyBackgroundLoopAudit") || {};
    const reflow = safeCall("gridlyReflowTraceAudit") || safeCall("gridlyReflowAudit") || {};
    const crossings = safeCall("gridlyCrossingRenderAudit") || {};
    const repeatedWork = [
      ...(Array.isArray(refresh.repeatedWork) ? refresh.repeatedWork : []),
      ...measured.filter((entry) => Number(entry.callCount || 0) > 1)
        .map((entry) => ({ owner: entry.functionName, callCount: entry.callCount, classification: "UNKNOWN" }))
    ];
    const repeatedTotals = {};
    repeatedWork.forEach((entry) => {
      const owner = String(entry.owner || entry.functionName || "UNKNOWN");
      repeatedTotals[owner] = Number(repeatedTotals[owner] || 0) + Number(entry.callCount || 0);
    });
    const counters = {
      alertSnapshotCreation: countFor(measured, /alert.*snapshot|snapshot.*alert/i),
      alertMerge: countFor(measured, /alert.*merge|merge.*alert/i),
      driveTexasPromotion: countFor(measured, /drive.?texas.*promot|promot.*drive.?texas/i),
      deduplication: countFor(measured, /dedup/i),
      communityCollection: countFor(measured, /community.*collect|collect.*community/i),
      weatherPromotion: countFor(measured, /weather.*promot|promot.*weather/i),
      renderAlerts: countFor(measured, /renderAlerts/i),
      alertsDomGeneration: countFor(measured, /alert.*dom|dom.*alert/i),
      authoritativeAlertsWriter: countFor(measured, /renderAlerts|alert.*writer/i),
      kbygWriter: countFor(measured, /awareness brief|kbyg/i),
      locationContextWriter: countFor(measured, /location context/i),
      communityPulseWriter: countFor(measured, /community pulse/i),
      hazardRender: countFor(measured, /hazard.*render|render.*hazard/i),
      crossingRender: Number(crossings.renderCount || countFor(measured, /crossing.*render|render.*crossing/i))
    };
    return { attribution, measured, refresh, background, reflow, crossings, repeatedWork, repeatedTotals, counters };
  }

  const subtract = (after = {}, before = {}) => Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .map((key) => [key, Number(after[key] || 0) - Number(before[key] || 0)])
  );

  function snapshot(state = readState()) {
    const { counters, background, repeatedTotals } = state;
    return {
      counters: { ...counters },
      surfaces: {
        alerts: counters.alertSnapshotCreation + counters.alertMerge + counters.renderAlerts + counters.alertsDomGeneration,
        kbyg: counters.kbygWriter,
        locationContext: counters.locationContextWriter,
        communityPulse: counters.communityPulseWriter,
        map: counters.hazardRender + counters.crossingRender
      },
      renders: { alerts: counters.renderAlerts, hazards: counters.hazardRender, crossings: counters.crossingRender },
      writers: {
        alerts: counters.authoritativeAlertsWriter,
        kbyg: counters.kbygWriter,
        locationContext: counters.locationContextWriter,
        communityPulse: counters.communityPulseWriter
      },
      scheduling: {
        rafScheduled: Number(background.rafScheduled || 0),
        rafExecuted: Number(background.rafCallbackCount || 0),
        rafCoalesced: Number(background.rafCoalesced || 0),
        intervalCallbacks: Number(background.intervalCallbacks || background.intervalCallbackCount || 0),
        timeoutCallbacks: Number(background.timeoutCallbacks || background.timeoutCallbackCount || 0)
      },
      repeatedWork: { ...repeatedTotals }
    };
  }

  function transactionFor(startTime) {
    return [...transactions].reverse().find((entry) => entry.generation === generation
      && startTime >= entry.startTime
      && (entry.endTime === null || startTime <= entry.endTime)) || null;
  }

  function ingestLongTasks(entries) {
    Array.from(entries || []).forEach((entry) => {
      const startTime = round(entry.startTime);
      if (startTime < measurementCutoff) return;
      const transaction = transactionFor(startTime);
      longTasks.push({
        name: entry.name || "longtask",
        startTime,
        durationMs: round(entry.duration),
        transactionId: transaction?.transactionId || null,
        measurementGeneration: generation
      });
    });
    trim(longTasks);
  }

  let longTaskObserver = null;
  let longTaskObserverSupported = false;
  function drainLongTasks() {
    if (longTaskObserver && typeof longTaskObserver.takeRecords === "function") ingestLongTasks(longTaskObserver.takeRecords());
  }
  if (typeof globalScope.PerformanceObserver === "function") {
    try {
      longTaskObserver = new globalScope.PerformanceObserver((list) => ingestLongTasks(list.getEntries()));
      longTaskObserver.observe({ type: "longtask", buffered: true });
      longTaskObserverSupported = true;
    } catch (_error) {
      longTaskObserver = null;
    }
  }

  function beginTransaction(label = "UNKNOWN", reason = "manual") {
    drainLongTasks();
    generationSequence += 1;
    const transactionId = `lp224-g${generation}-${generationSequence}`;
    const startTime = now();
    transactions.push({
      transactionId,
      label: String(label || "UNKNOWN").toUpperCase(),
      reason: String(reason || "manual"),
      measurementGeneration: generation,
      generation,
      startTime,
      endTime: null,
      durationMs: null,
      baseline: snapshot()
    });
    trim(transactions);
    currentTransactionId = transactionId;
    return transactionId;
  }

  function publicTransaction(transaction) {
    const { baseline: _baseline, generation: _generation, ...result } = transaction;
    return { ...result, longTasks: (transaction.longTasks || []).map((entry) => ({ ...entry })) };
  }

  function endTransaction(id = currentTransactionId) {
    const transaction = transactions.find((entry) => entry.transactionId === id);
    if (!transaction || transaction.endTime !== null) return null;
    transaction.endTime = now();
    transaction.durationMs = round(transaction.endTime - transaction.startTime);
    drainLongTasks();
    const finalSnapshot = snapshot();
    transaction.longTasks = longTasks.filter((entry) => entry.transactionId === id);
    transaction.maxLongTaskDurationMs = Math.max(0, ...transaction.longTasks.map((entry) => entry.durationMs));
    transaction.counterDeltas = subtract(finalSnapshot.counters, transaction.baseline.counters);
    transaction.surfaceCounterDeltas = subtract(finalSnapshot.surfaces, transaction.baseline.surfaces);
    transaction.renderDeltas = subtract(finalSnapshot.renders, transaction.baseline.renders);
    transaction.writerDeltas = subtract(finalSnapshot.writers, transaction.baseline.writers);
    transaction.schedulingDeltas = subtract(finalSnapshot.scheduling, transaction.baseline.scheduling);
    transaction.repeatedWorkDeltas = subtract(finalSnapshot.repeatedWork, transaction.baseline.repeatedWork);
    if (currentTransactionId === id) currentTransactionId = null;
    return publicTransaction(transaction);
  }

  function reset() {
    drainLongTasks();
    generation += 1;
    generationSequence = 0;
    currentTransactionId = null;
    transactions.length = 0;
    longTasks.length = 0;
    measurementCutoff = now();
    return { reset: true, measurementGeneration: generation, baselineCutoff: measurementCutoff, nextTransactionId: `lp224-g${generation}-1` };
  }

  function canonicalCommunity() {
    const canonical = safeCall("gridlyGetCanonicalActiveCommunityState");
    const area = canonical && canonical.available !== false ? canonical.selectedAwarenessArea : null;
    return area?.label || area?.name || area?.storageValue || null;
  }

  function buildAudit(command, value, reason) {
    if (typeof command === "string") {
      const operation = command.trim().toUpperCase();
      if (operation === "RESET") return reset();
      if (operation === "BEGIN") return beginTransaction(value, reason);
      if (operation === "END") return endTransaction(value);
    }
    drainLongTasks();
    const state = readState();
    const { measured, background, reflow, crossings, repeatedWork, counters } = state;
    const alerts = measured.filter((entry) => /alert/i.test(`${entry.functionName} ${entry.category}`));
    const maxAlertDuration = Math.max(0, ...alerts.map((entry) => Number(entry.maxDuration || 0)));
    const suspectedForcedLayouts = Number(reflow.suspectedForcedLayouts || reflow.forcedReflowCount || 0);
    const idleTransaction = [...transactions].reverse().find((entry) => entry.label === "IDLE" && entry.endTime !== null);
    const idleRecurring = Number(background.intervalCallbacks || background.intervalCallbackCount || 0)
      + Number(background.timeoutCallbacks || background.timeoutCallbackCount || 0);
    return {
      version: VERSION,
      available: true,
      instrumentationPassive: true,
      measurementGeneration: generation,
      measurementBaselineCutoff: measurementCutoff,
      session: {
        startedAt,
        currentTransactionId,
        activeCountyId: globalScope.GRIDLY_ACTIVE_COUNTY_ID || null,
        canonicalCommunity: canonicalCommunity()
      },
      idle: {
        observationWindowMs: idleTransaction?.durationMs ?? null,
        applicationOwnedRafCallbacks: Number(background.rafCallbackCount || 0),
        intervalCallbacks: Number(background.intervalCallbacks || background.intervalCallbackCount || 0),
        timeoutCallbacks: Number(background.timeoutCallbacks || background.timeoutCallbackCount || 0),
        renderCalls: countFor(measured, /render/i),
        writerCalls: countFor(measured, /writer|dom/i),
        longTasks: idleTransaction?.longTasks?.length || 0,
        stable: idleRecurring === 0 ? "NO_RECURRING_CALLBACK_EVIDENCE" : "NEEDS_BOUNDED_LIVE_OBSERVATION"
      },
      transactions: transactions.map(publicTransaction),
      lifetimeCounters: { ...counters },
      surfaces: {
        alerts: { buildCount: countFor(measured, /alert.*build|build.*alert/i), authoritativeWriteCount: counters.authoritativeAlertsWriter, redundantWriteCount: 0, maxDurationMs: round(maxAlertDuration) },
        kbyg: { writes: counters.kbygWriter },
        locationContext: { writes: counters.locationContextWriter },
        communityPulse: { writes: counters.communityPulseWriter },
        mapHazards: { renderCount: counters.hazardRender },
        crossings: { renderCount: Number(crossings.renderCount || counters.crossingRender) }
      },
      scheduling: {
        rafScheduled: Number(background.rafScheduled || 0),
        rafExecuted: Number(background.rafCallbackCount || 0),
        rafCoalesced: Number(background.rafCoalesced || 0),
        intervalsActive: Array.isArray(background.activeIntervals) ? background.activeIntervals.length : null,
        recurringTimeoutChains: Array.isArray(background.recurringTimeoutChains) ? background.recurringTimeoutChains : []
      },
      layout: { reads: Number(reflow.layoutReads || 0), writes: Number(reflow.domWrites || 0), suspectedForcedLayouts, confirmedRiskSites: reflow.confirmedRiskSites || [] },
      longTasks: longTasks.map((entry) => ({ ...entry })),
      longTaskObservationSupported: longTaskObserverSupported,
      repeatedWork,
      findings: [{ classification: "UNKNOWN", evidence: "A bounded transaction has not deterministically identified a production owner" }],
      firstExpensiveStage: null,
      safeToOptimize: false
    };
  }

  globalScope.gridlyRuntimePerformanceAudit = buildAudit;
  globalScope.gridlyRuntimePerformanceAuditBegin = beginTransaction;
  globalScope.gridlyRuntimePerformanceAuditEnd = endTransaction;
  globalScope.gridlyRuntimePerformanceAuditReset = reset;
})(typeof window !== "undefined" ? window : globalThis);
