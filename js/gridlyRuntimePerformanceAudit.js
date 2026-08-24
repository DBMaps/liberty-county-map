(function gridlyRuntimePerformanceAuditModule(globalScope) {
  "use strict";

  const VERSION = "LP225";
  const MODES = Object.freeze({
    FULL_ATTRIBUTION: "FULL_ATTRIBUTION",
    MINIMAL_LONG_TASK_CONTROL: "MINIMAL_LONG_TASK_CONTROL"
  });
  const MAX_ENTRIES = 200;
  const startedAt = new Date().toISOString();
  let generation = 1;
  let generationSequence = 0;
  let measurementCutoff = 0;
  let currentTransactionId = null;
  let auditMode = MODES.FULL_ATTRIBUTION;
  const transactions = [];
  const longTasks = [];
  const stageTimings = [];
  const subsystemTimings = [];
  let stageSequence = 0;
  let subsystemSequence = 0;

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

  function activeTransactionForStage(startTime) {
    if (!currentTransactionId) return null;
    const transaction = transactions.find((entry) => entry.transactionId === currentTransactionId);
    return transaction && transaction.generation === generation && startTime >= transaction.startTime
      && (transaction.endTime === null || startTime <= transaction.endTime) ? transaction : null;
  }

  // Called only by explicit Alerts production boundaries. This records supplied
  // facts; it does not invoke the production function, inspect a stack, mutate
  // the DOM, or install a wrapper around a browser API.
  function recordAlertsStage(record = {}) {
    const startTime = Number(record.startTime);
    const endTime = Number(record.endTime);
    if (!record.stageName || !Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
    const transaction = activeTransactionForStage(startTime);
    if (!transaction || transaction.mode === MODES.MINIMAL_LONG_TASK_CONTROL || endTime < startTime) return null;
    const entry = {
      stageName: String(record.stageName),
      transactionId: transaction.transactionId,
      measurementGeneration: transaction.measurementGeneration,
      invocationSequence: ++stageSequence,
      startTime: round(startTime),
      endTime: round(endTime),
      durationMs: round(endTime - startTime),
      triggerReason: record.triggerReason == null ? null : String(record.triggerReason),
      productionOwner: record.productionOwner == null ? null : String(record.productionOwner),
      domMutationOccurred: record.domMutationOccurred === true,
      outputChanged: record.outputChanged == null ? null : Boolean(record.outputChanged),
      authoritativeWriteFollowed: record.authoritativeWriteFollowed === true
    };
    stageTimings.push(entry);
    trim(stageTimings);
    return { ...entry };
  }

  // LP225 production call sites opt in at a small number of already-existing
  // subsystem boundaries.  Supplying the trigger and caller is mandatory: the
  // audit never guesses lineage from a stack and never invokes production work.
  function recordSubsystemTiming(record = {}) {
    const startTime = Number(record.startTime);
    const endTime = Number(record.endTime);
    if (!record.subsystem || !record.boundaryName || !record.trigger || !record.caller
      || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
    const transaction = activeTransactionForStage(startTime);
    if (!transaction || transaction.mode === MODES.MINIMAL_LONG_TASK_CONTROL) return null;
    const entry = {
      subsystem: String(record.subsystem).toUpperCase(), boundaryName: String(record.boundaryName),
      transactionId: transaction.transactionId, measurementGeneration: transaction.measurementGeneration,
      sequence: ++subsystemSequence, startTime: round(startTime), endTime: round(endTime), durationMs: round(endTime - startTime),
      trigger: String(record.trigger), caller: String(record.caller),
      inputCount: Number.isFinite(Number(record.inputCount)) ? Number(record.inputCount) : null,
      outputCount: Number.isFinite(Number(record.outputCount)) ? Number(record.outputCount) : null,
      domMutationOccurred: record.domMutationOccurred === true, mapMutationOccurred: record.mapMutationOccurred === true,
      persistedStateMutationOccurred: record.persistedStateMutationOccurred === true,
      outputChanged: record.outputChanged == null ? null : Boolean(record.outputChanged),
      noOp: record.noOp == null ? null : Boolean(record.noOp), auditOnly: record.auditOnly === true
    };
    subsystemTimings.push(entry); trim(subsystemTimings);
    return { ...entry };
  }

  function ownerResultFor(transaction) {
    const timings = subsystemTimings.filter((entry) => entry.transactionId === transaction.transactionId);
    const totals = new Map();
    timings.forEach((entry) => {
      const key = `${entry.subsystem}:${entry.boundaryName}`;
      const row = totals.get(key) || { owner: key, subsystem: entry.subsystem, boundaryName: entry.boundaryName, callCount: 0, totalDurationMs: 0, maxInvocationDurationMs: 0 };
      row.callCount += 1; row.totalDurationMs += entry.durationMs; row.maxInvocationDurationMs = Math.max(row.maxInvocationDurationMs, entry.durationMs); totals.set(key, row);
    });
    const owners = [...totals.values()].map((row) => ({ ...row, totalDurationMs: round(row.totalDurationMs), maxInvocationDurationMs: round(row.maxInvocationDurationMs) }));
    const overlap = (transaction.longTasks || []).map((task) => {
      const end = task.startTime + task.durationMs;
      const matches = timings.filter((entry) => entry.startTime < end && entry.endTime > task.startTime).map((entry) => ({ subsystem: entry.subsystem, boundaryName: entry.boundaryName, sequence: entry.sequence, trigger: entry.trigger, caller: entry.caller, durationMs: entry.durationMs, auditOnly: entry.auditOnly }));
      const auditOnly = matches.length > 0 && matches.every((entry) => entry.auditOnly);
      return { longTaskStartTime: task.startTime, longTaskDurationMs: task.durationMs, classification: auditOnly ? "AUDIT_OVERHEAD_CANDIDATE" : matches.length === 0 ? "BROWSER_OR_UNINSTRUMENTED" : matches.length === 1 ? "EXACT_OWNER_OVERLAP" : "MULTIPLE_OWNER_OVERLAP", overlappingOwners: matches, causationClaimed: false };
    });
    const familyRanges = [[50, 300, "FAMILY_A_50_300_MS"], [300, 600, "FAMILY_B_300_600_MS"], [600, Infinity, "FAMILY_C_600_PLUS_MS"]];
    const longTaskFamilies = familyRanges.map(([min, max, family]) => {
      const rows = overlap.filter((row) => row.longTaskDurationMs >= min && row.longTaskDurationMs < max);
      return { family, count: rows.length, durationRangeMs: rows.length ? [Math.min(...rows.map((r) => r.longTaskDurationMs)), Math.max(...rows.map((r) => r.longTaskDurationMs))] : null, ownerOverlap: [...new Set(rows.flatMap((r) => r.overlappingOwners.map((o) => `${o.subsystem}:${o.boundaryName}`)))], confidence: rows.length ? "BOUNDED_OVERLAP_ONLY" : "NO_EVIDENCE" };
    }).filter((row) => row.count > 0);
    const unexplainedLongTaskCount = overlap.filter((row) => row.classification === "BROWSER_OR_UNINSTRUMENTED").length;
    const topTotal = [...owners].sort((a, b) => b.totalDurationMs - a.totalDurationMs)[0] || null;
    const topMax = [...owners].sort((a, b) => b.maxInvocationDurationMs - a.maxInvocationDurationMs)[0] || null;
    const auditMatches = overlap.filter((row) => row.classification === "AUDIT_OVERHEAD_CANDIDATE").length;
    return { subsystemTimings: timings.map((entry) => ({ ...entry })), longTaskOwnerOverlap: overlap, ownerLineage: timings.map((entry) => ({ sequence: entry.sequence, subsystem: entry.subsystem, boundaryName: entry.boundaryName, trigger: entry.trigger, caller: entry.caller })), longTaskFamilies, topOwnerByTotalDuration: topTotal, topOwnerByMaxInvocationDuration: topMax, topIdleOwner: transaction.label === "IDLE" ? topTotal : null, auditOverheadAssessment: { classification: auditMatches ? "MIXED_OR_AUDIT_CANDIDATE" : "UNKNOWN", auditOnlyOverlapCount: auditMatches, productionLogicDisabled: false }, unexplainedLongTaskCount, rootCauseCandidate: null, rootCauseConfidence: "UNKNOWN", safeToOptimize: false };
  }

  function stageResultFor(transaction) {
    const timings = stageTimings.filter((entry) => entry.transactionId === transaction.transactionId);
    const byTrigger = new Map();
    timings.forEach((entry) => {
      const trigger = entry.productionOwner || entry.triggerReason || "UNATTRIBUTED_EXPLICIT_BOUNDARY";
      const summary = byTrigger.get(trigger) || { trigger, callCount: 0, transactionId: transaction.transactionId, downstreamStages: [], totalMeasuredStageTimeMs: 0, maxInvocationDurationMs: 0 };
      summary.callCount += 1;
      if (!summary.downstreamStages.includes(entry.stageName)) summary.downstreamStages.push(entry.stageName);
      summary.totalMeasuredStageTimeMs += entry.durationMs;
      summary.maxInvocationDurationMs = Math.max(summary.maxInvocationDurationMs, entry.durationMs);
      byTrigger.set(trigger, summary);
    });
    const triggerLineage = [...byTrigger.values()].map((entry) => ({ ...entry, totalMeasuredStageTimeMs: round(entry.totalMeasuredStageTimeMs), maxInvocationDurationMs: round(entry.maxInvocationDurationMs) }));
    const longTaskStageOverlap = (transaction.longTasks || []).map((task) => {
      const taskEnd = task.startTime + task.durationMs;
      const overlappingStages = timings.filter((stage) => stage.startTime < taskEnd && stage.endTime > task.startTime)
        .map((stage) => ({ stageName: stage.stageName, invocationSequence: stage.invocationSequence, startTime: stage.startTime, endTime: stage.endTime, durationMs: stage.durationMs }));
      return { longTaskStartTime: task.startTime, longTaskDurationMs: task.durationMs, classification: overlappingStages.length === 0 ? "NO_MEASURED_STAGE_OVERLAP" : overlappingStages.length === 1 ? "EXACT_STAGE_OVERLAP" : "MULTIPLE_STAGE_OVERLAP", overlappingStages, causationClaimed: false };
    });
    const totals = new Map();
    timings.forEach((entry) => {
      const total = totals.get(entry.stageName) || { stageName: entry.stageName, totalDurationMs: 0, maxInvocationDurationMs: 0, callCount: 0 };
      total.totalDurationMs += entry.durationMs; total.maxInvocationDurationMs = Math.max(total.maxInvocationDurationMs, entry.durationMs); total.callCount += 1;
      totals.set(entry.stageName, total);
    });
    const stages = [...totals.values()].map((entry) => ({ ...entry, totalDurationMs: round(entry.totalDurationMs), maxInvocationDurationMs: round(entry.maxInvocationDurationMs) }));
    return {
      stageTimings: timings.map((entry) => ({ ...entry })), triggerLineage, longTaskStageOverlap,
      topStageByTotalDuration: stages.sort((a, b) => b.totalDurationMs - a.totalDurationMs)[0] || null,
      topStageByMaxInvocationDuration: [...stages].sort((a, b) => b.maxInvocationDurationMs - a.maxInvocationDurationMs)[0] || null,
      topIdleTrigger: transaction.label === "IDLE" ? [...triggerLineage].sort((a, b) => b.callCount - a.callCount || b.totalMeasuredStageTimeMs - a.totalMeasuredStageTimeMs)[0] || null : null,
      firstExpensiveStage: null
    };
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
      mode: auditMode,
      baseline: auditMode === MODES.FULL_ATTRIBUTION ? snapshot() : null
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
    transaction.longTasks = longTasks.filter((entry) => entry.transactionId === id);
    transaction.maxLongTaskDurationMs = Math.max(0, ...transaction.longTasks.map((entry) => entry.durationMs));
    transaction.longTaskCount = transaction.longTasks.length;
    if (transaction.mode === MODES.MINIMAL_LONG_TASK_CONTROL) {
      if (currentTransactionId === id) currentTransactionId = null;
      return publicTransaction(transaction);
    }
    const finalSnapshot = snapshot();
    transaction.counterDeltas = subtract(finalSnapshot.counters, transaction.baseline.counters);
    transaction.surfaceCounterDeltas = subtract(finalSnapshot.surfaces, transaction.baseline.surfaces);
    transaction.renderDeltas = subtract(finalSnapshot.renders, transaction.baseline.renders);
    transaction.writerDeltas = subtract(finalSnapshot.writers, transaction.baseline.writers);
    transaction.schedulingDeltas = subtract(finalSnapshot.scheduling, transaction.baseline.scheduling);
    transaction.repeatedWorkDeltas = subtract(finalSnapshot.repeatedWork, transaction.baseline.repeatedWork);
    Object.assign(transaction, stageResultFor(transaction));
    Object.assign(transaction, ownerResultFor(transaction));
    if (currentTransactionId === id) currentTransactionId = null;
    return publicTransaction(transaction);
  }

  function comparisonEnd(id = currentTransactionId) {
    const result = endTransaction(id);
    if (!result) return null;
    return {
      mode: result.mode,
      durationMs: result.durationMs,
      longTaskCount: result.longTaskCount,
      maxLongTaskDurationMs: result.maxLongTaskDurationMs,
      longTasks: result.longTasks
    };
  }

  function setMode(mode) {
    const normalized = String(mode || "").trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(MODES, normalized)) return null;
    auditMode = MODES[normalized];
    return { mode: auditMode };
  }

  function reset() {
    drainLongTasks();
    generation += 1;
    generationSequence = 0;
    currentTransactionId = null;
    transactions.length = 0;
    longTasks.length = 0;
    stageTimings.length = 0;
    subsystemTimings.length = 0;
    stageSequence = 0;
    subsystemSequence = 0;
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
      if (operation === "CONTROL_END") return comparisonEnd(value);
      if (operation === "MODE" || operation === "SET_MODE") return setMode(value);
    }
    drainLongTasks();
    if (auditMode === MODES.MINIMAL_LONG_TASK_CONTROL) {
      return {
        version: VERSION, available: true, instrumentationPassive: true, mode: auditMode,
        measurementGeneration: generation, measurementBaselineCutoff: measurementCutoff,
        currentTransactionId, longTaskObservationSupported: longTaskObserverSupported,
        longTasks: longTasks.filter((entry) => entry.measurementGeneration === generation).map((entry) => ({ ...entry })),
        safeToOptimize: false
      };
    }
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
      mode: auditMode,
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
      stageTimings: stageTimings.filter((entry) => entry.measurementGeneration === generation).map((entry) => ({ ...entry })),
      subsystemTimings: subsystemTimings.filter((entry) => entry.measurementGeneration === generation).map((entry) => ({ ...entry })),
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
  globalScope.gridlyRuntimePerformanceAuditSetMode = setMode;
  globalScope.gridlyRuntimePerformanceAuditControlEnd = comparisonEnd;
  globalScope.gridlyRuntimePerformanceAuditRecordAlertsStage = recordAlertsStage;
  globalScope.gridlyRuntimePerformanceAuditRecordSubsystemTiming = recordSubsystemTiming;
})(typeof window !== "undefined" ? window : globalThis);
