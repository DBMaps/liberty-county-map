(function gridlyRuntimePerformanceAuditModule(globalScope) {
  "use strict";

  const VERSION = "LP224.1";
  const MAX_ENTRIES = 200;
  const startedAt = new Date().toISOString();
  let sequence = 0;
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

  function beginTransaction(type = "UNKNOWN", reason = "manual") {
    sequence += 1;
    currentTransactionId = `lp224-${sequence}`;
    transactions.push({
      id: currentTransactionId,
      type: String(type || "UNKNOWN").toUpperCase(),
      reason: String(reason || "manual"),
      startedAt: now(),
      completedAt: null,
      durationMs: null
    });
    trim(transactions);
    return currentTransactionId;
  }

  function endTransaction(id = currentTransactionId) {
    const transaction = transactions.find((entry) => entry.id === id);
    if (!transaction || transaction.completedAt !== null) return null;
    transaction.completedAt = now();
    transaction.durationMs = round(transaction.completedAt - transaction.startedAt);
    if (currentTransactionId === id) currentTransactionId = null;
    return { ...transaction };
  }

  function reset() {
    sequence = 0;
    currentTransactionId = null;
    transactions.length = 0;
    longTasks.length = 0;
    return { reset: true, nextTransactionId: "lp224-1" };
  }

  let longTaskObserver = null;
  let longTaskObserverSupported = false;
  if (typeof globalScope.PerformanceObserver === "function") {
    try {
      longTaskObserver = new globalScope.PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          longTasks.push({
            name: entry.name || "longtask",
            startTime: round(entry.startTime),
            durationMs: round(entry.duration),
            transactionId: currentTransactionId
          });
        });
        trim(longTasks);
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
      longTaskObserverSupported = true;
    } catch (_error) {
      longTaskObserver = null;
    }
  }

  function countFor(records, pattern) {
    return records.filter((entry) => pattern.test(`${entry.functionName || ""} ${entry.category || ""}`))
      .reduce((sum, entry) => sum + Number(entry.callCount || 0), 0);
  }

  function buildAudit() {
    const attribution = safeCall("gridlyMainThreadAttributionAudit") || {};
    const measured = Array.isArray(attribution.measuredFunctions) ? attribution.measuredFunctions : [];
    const refresh = safeCall("gridlyRefreshBreakdownAudit") || {};
    const background = safeCall("gridlyBackgroundLoopAudit") || {};
    const reflow = safeCall("gridlyReflowTraceAudit") || safeCall("gridlyReflowAudit") || {};
    const crossings = safeCall("gridlyCrossingRenderAudit") || {};
    const alerts = measured.filter((entry) => /alert/i.test(`${entry.functionName} ${entry.category}`));
    const maxAlertDuration = Math.max(0, ...alerts.map((entry) => Number(entry.maxDuration || 0)));
    const suspectedForcedLayouts = Number(reflow.suspectedForcedLayouts || reflow.forcedReflowCount || 0);
    const repeatedWork = [
      ...(Array.isArray(refresh.repeatedWork) ? refresh.repeatedWork : []),
      ...(Array.isArray(attribution.measuredFunctions)
        ? attribution.measuredFunctions.filter((entry) => Number(entry.callCount || 0) > 1)
          .map((entry) => ({ owner: entry.functionName, callCount: entry.callCount, classification: "UNKNOWN" }))
        : [])
    ];
    const maxLongTask = Math.max(0, ...longTasks.map((entry) => entry.durationMs));
    const firstExpensive = measured.find((entry) => Number(entry.maxDuration || 0) > 50)?.functionName || null;
    const idleRecurring = Number(background.intervalCallbacks || background.intervalCallbackCount || 0)
      + Number(background.timeoutCallbacks || background.timeoutCallbackCount || 0);

    return {
      version: VERSION,
      available: true,
      instrumentationPassive: true,
      session: {
        startedAt,
        currentTransactionId,
        activeCountyId: globalScope.GRIDLY_ACTIVE_COUNTY_ID || null,
        canonicalCommunity: globalScope.gridlyCanonicalCommunity || globalScope.GRIDLY_SELECTED_COMMUNITY || null
      },
      idle: {
        observationWindowMs: null,
        applicationOwnedRafCallbacks: Number(background.rafCallbackCount || 0),
        intervalCallbacks: Number(background.intervalCallbacks || background.intervalCallbackCount || 0),
        timeoutCallbacks: Number(background.timeoutCallbacks || background.timeoutCallbackCount || 0),
        renderCalls: countFor(measured, /render/i),
        writerCalls: countFor(measured, /writer|dom/i),
        longTasks: longTasks.length,
        stable: idleRecurring === 0 ? "NO_RECURRING_CALLBACK_EVIDENCE" : "NEEDS_BOUNDED_LIVE_OBSERVATION"
      },
      transactions: transactions.map((entry) => ({ ...entry })),
      surfaces: {
        alerts: { buildCount: countFor(measured, /alert.*build|build.*alert/i), authoritativeWriteCount: countFor(measured, /renderAlerts|alert.*writer/i), redundantWriteCount: 0, maxDurationMs: round(maxAlertDuration) },
        kbyg: { writes: countFor(measured, /awareness brief|kbyg/i) },
        locationContext: { writes: countFor(measured, /location context/i) },
        communityPulse: { writes: countFor(measured, /community pulse/i) },
        mapHazards: { renderCount: countFor(measured, /hazard.*render|render.*hazard/i) },
        crossings: { renderCount: Number(crossings.renderCount || countFor(measured, /crossing.*render|render.*crossing/i)) }
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
      findings: firstExpensive ? [{ classification: "EXPENSIVE", owner: firstExpensive, evidence: "measured function duration exceeded 50 ms" }] : [{ classification: "UNKNOWN", evidence: "No attributable >50 ms function captured in this session" }],
      firstExpensiveStage: firstExpensive,
      safeToOptimize: Boolean(firstExpensive)
    };
  }

  globalScope.gridlyRuntimePerformanceAudit = buildAudit;
  globalScope.gridlyRuntimePerformanceAuditBegin = beginTransaction;
  globalScope.gridlyRuntimePerformanceAuditEnd = endTransaction;
  globalScope.gridlyRuntimePerformanceAuditReset = reset;
})(typeof window !== "undefined" ? window : globalThis);
