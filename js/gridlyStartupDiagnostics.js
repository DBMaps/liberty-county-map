(function () {
  "use strict";
  const VERSION = "V929R1-startup-diagnostics-and-resilience";
  const MAX_STAGES = 240;
  const WATCHDOG_MS = 30000;
  const SLOW_STARTUP_MS = 30000;
  const nowMs = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const postPaintAuditState = {
    available: true, architectureOnly: true, protectedSystemsChanged: false, scriptStartAt: nowMs(), domContentLoadedAt: null, mobilePortraitVisibleAt: null, dockHandlersInstalledAt: null, startupWorkCompletedAt: null, firstResponsiveInteractionAt: null, firstPointerEventTimestamp: null, firstPointerCaptureObservedAt: null, firstPointerHandlerEnteredAt: null, firstClickEventTimestamp: null, firstClickCaptureObservedAt: null, firstClickHandlerEnteredAt: null, firstSurfaceOpenAt: null, activeStage: null, activeFunction: null, phases: [], longTasks: []
  };
  const isoNow = () => new Date().toISOString();
  const state = {
    available: true, version: VERSION, startupStartedAt: isoNow(), startupStartedAtMs: nowMs(), startupCompletedAt: null,
    startupCompletedAtMs: null, startupCompleted: false, uiUsable: false, uiUsableAt: null, uiUsableAtMs: null, prepaintLockReleased: false, firstVisibleFrame: false, firstInteractiveUI: false,
    degradedStartup: false, stalled: false, previouslyStalled: false, slowStartup: false, slowStartupThresholdMs: SLOW_STARTUP_MS,
    watchdogTriggered: false, watchdogTriggeredAt: null, watchdogStage: null, maximumObservedBlockingStageMs: 0, lateCompletedStages: [],
    currentStage: null, lastCompletedStage: null, failedStage: null, stages: [], warnings: [], failures: [], cacheOrFallbackUsed: false,
    watchdog: { thresholdMs: WATCHDOG_MS, fired: false, stageAtThreshold: null, resolved: false }, counters: { requestsIntroduced: 0, duplicateCompletions: 0 }
  };
  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (_) { return x; } }
  function restoreState(snapshot) { Object.keys(state).forEach((key) => { delete state[key]; }); Object.assign(state, clone(snapshot)); }
  function push(list, item, cap) { list.push(item); if (list.length > cap) list.splice(0, list.length - cap); }
  function markPostPaintLifecycle(name) {
    const t = nowMs();
    if (name === "domContentLoaded" && postPaintAuditState.domContentLoadedAt === null) postPaintAuditState.domContentLoadedAt = t;
    if (name === "mobilePortraitVisible" && postPaintAuditState.mobilePortraitVisibleAt === null) postPaintAuditState.mobilePortraitVisibleAt = t;
    if (name === "dockHandlersInstalled" && postPaintAuditState.dockHandlersInstalledAt === null) postPaintAuditState.dockHandlersInstalledAt = t;
    if (name === "startupWorkCompleted" && postPaintAuditState.startupWorkCompletedAt === null) postPaintAuditState.startupWorkCompletedAt = t;
    if (name === "firstResponsiveInteraction" && postPaintAuditState.firstResponsiveInteractionAt === null) postPaintAuditState.firstResponsiveInteractionAt = t;
  }
  function beginPostPaintPhase(name, activeFunction) {
    const phase = { name, startedAt: nowMs(), endedAt: null, durationMs: null, occurredAfterVisiblePaint: Boolean(postPaintAuditState.mobilePortraitVisibleAt || state.firstVisibleFrame) };
    postPaintAuditState.activeStage = name; postPaintAuditState.activeFunction = activeFunction || name;
    postPaintAuditState.phases.push(phase); if (postPaintAuditState.phases.length > 160) postPaintAuditState.phases.splice(0, postPaintAuditState.phases.length - 160);
    return phase;
  }
  function endPostPaintPhase(phase) {
    if (!phase || phase.endedAt !== null) return phase;
    phase.endedAt = nowMs(); phase.durationMs = Math.round((phase.endedAt - phase.startedAt) * 100) / 100;
    postPaintAuditState.activeStage = null; postPaintAuditState.activeFunction = null; return phase;
  }
  function measurePostPaintPhase(name, activeFunction, work) { const p = beginPostPaintPhase(name, activeFunction); try { const result = work(); if (result && typeof result.finally === "function") return result.finally(() => endPostPaintPhase(p)); endPostPaintPhase(p); return result; } catch (error) { endPostPaintPhase(p); throw error; } }
  function markInteractionProbe(kind, event) {
    const t = nowMs(); const ts = Number(event?.timeStamp);
    if (kind === "pointerCapture" && postPaintAuditState.firstPointerCaptureObservedAt === null) { postPaintAuditState.firstPointerCaptureObservedAt = t; postPaintAuditState.firstPointerEventTimestamp = Number.isFinite(ts) ? ts : null; }
    if (kind === "clickCapture" && postPaintAuditState.firstClickCaptureObservedAt === null) { postPaintAuditState.firstClickCaptureObservedAt = t; postPaintAuditState.firstClickEventTimestamp = Number.isFinite(ts) ? ts : null; }
    if (kind === "pointerHandler" && postPaintAuditState.firstPointerHandlerEnteredAt === null) postPaintAuditState.firstPointerHandlerEnteredAt = t;
    if (kind === "clickHandler" && postPaintAuditState.firstClickHandlerEnteredAt === null) postPaintAuditState.firstClickHandlerEnteredAt = t;
    if (kind === "surfaceOpen" && postPaintAuditState.firstSurfaceOpenAt === null) postPaintAuditState.firstSurfaceOpenAt = t;
  }
  function installPostPaintProbes() {
    try {
      document.addEventListener("pointerdown", (event) => markInteractionProbe("pointerCapture", event), { capture: true, passive: true });
      document.addEventListener("click", (event) => markInteractionProbe("clickCapture", event), { capture: true, passive: true });
      document.addEventListener("DOMContentLoaded", () => markPostPaintLifecycle("domContentLoaded"), { once: true });
      if (typeof PerformanceObserver === "function") {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => push(postPaintAuditState.longTasks, { startTime: Math.round(entry.startTime * 100) / 100, duration: Math.round(entry.duration * 100) / 100, activeStage: postPaintAuditState.activeStage || state.currentStage || null, activeFunction: postPaintAuditState.activeFunction || null }, 120));
        });
        observer.observe({ entryTypes: ["longtask"] });
      }
    } catch (_) {}
  }
  installPostPaintProbes();
  function findStage(name) { for (let i = state.stages.length - 1; i >= 0; i -= 1) if (state.stages[i].name === name) return state.stages[i]; return null; }
  function warn(stage, message, extra) { push(state.warnings, { stage, message, at: isoNow(), ...(extra || {}) }, 120); }
  function markDegraded(stage, message, extra) { state.degradedStartup = true; warn(stage, message, extra); }
  function beginStage(name, options) {
    const opts = options || {}; const stage = { name, status: "running", blocking: opts.blocking !== false, network: Boolean(opts.network), dependency: opts.dependency || null, url: opts.url || null, timeoutMs: opts.timeoutMs || null, cachedOrFallbackUsed: Boolean(opts.cachedOrFallbackUsed), startupContinued: null, startedAt: isoNow(), startedAtMs: nowMs(), completedAt: null, completedAtMs: null, durationMs: null, errorMessage: null, errorStack: null, parentStage: opts.parentStage || null, childStages: [], lateCompletion: false, timedOutAt: null, timedOutAtMs: null, longBlockingStage: false };
    if (stage.parentStage) { const parent = findStage(stage.parentStage); if (parent) parent.childStages.push(stage); }
    push(state.stages, stage, MAX_STAGES); state.currentStage = name; return stage;
  }
  function endStage(stageOrName, status, details) {
    const stage = typeof stageOrName === "string" ? findStage(stageOrName) : stageOrName; if (!stage) return null;
    const info = details || {}; const endMs = nowMs(); const duration = Math.round((endMs - stage.startedAtMs) * 10) / 10;
    if (stage.completedAt) {
      state.counters.duplicateCompletions += 1;
      if (stage.status === "timed-out" && status === "completed") {
        stage.lateCompletion = true; push(state.lateCompletedStages, { name: stage.name, completedAt: isoNow(), durationMs: duration }, 80);
      }
      return stage;
    }
    const crossedTimeout = stage.timeoutMs && duration > stage.timeoutMs;
    stage.status = crossedTimeout ? "timed-out" : (status || "completed");
    stage.completedAt = isoNow(); stage.completedAtMs = endMs; stage.durationMs = duration; stage.startupContinued = info.startupContinued ?? (stage.status !== "failed" || stage.blocking === false);
    if (crossedTimeout) { stage.timedOutAt = stage.completedAt; stage.timedOutAtMs = endMs; stage.longBlockingStage = status === "completed"; }
    if (info.error) { stage.errorMessage = info.error.message || String(info.error); stage.errorStack = info.error.stack || null; }
    if (info.message && !stage.errorMessage) stage.errorMessage = info.message;
    if (info.cachedOrFallbackUsed) { stage.cachedOrFallbackUsed = true; state.cacheOrFallbackUsed = true; }
    if (stage.blocking) state.maximumObservedBlockingStageMs = Math.max(state.maximumObservedBlockingStageMs, duration);
    if (stage.status === "completed") state.lastCompletedStage = stage.name;
    if (stage.status === "failed") { state.failedStage = stage.name; push(state.failures, { stage: stage.name, message: stage.errorMessage || "failed", at: stage.completedAt }, 80); }
    if (stage.status === "timed-out") markDegraded(stage.name, stage.errorMessage || `${stage.name} exceeded ${stage.timeoutMs} ms startup timeout`, { durationMs: duration, timeoutMs: stage.timeoutMs, longBlockingStage: stage.longBlockingStage });
    if (stage.status === "degraded") state.degradedStartup = true;
    if (state.currentStage === stage.name) state.currentStage = null;
    return stage;
  }
  function markPrepaintReleased(reason) { if (state.prepaintLockReleased) return; state.prepaintLockReleased = true; const s = beginStage("prepaint/startup lock released", { blocking: true }); endStage(s, "completed", { message: reason || "prepaint lock removed" }); }
  function markFirstVisibleFrame(reason) { if (state.firstVisibleFrame) return; state.firstVisibleFrame = true; markPostPaintLifecycle("mobilePortraitVisible"); const s = beginStage("first visible Gridly frame", { blocking: true }); endStage(s, "completed", { message: reason || "visible frame painted" }); }
  function markUiUsable(reason) { if (!state.prepaintLockReleased) return false; if (!state.uiUsable) { state.uiUsable = true; state.uiUsableAt = isoNow(); state.uiUsableAtMs = nowMs(); state.firstInteractiveUI = true; const stage = beginStage("first interactive UI", { blocking: true }); endStage(stage, "completed", { message: reason || "startup shell visible and usable" }); } state.watchdog.resolved = true; return true; }
  function completeStartup() { if (state.startupCompleted) return; markPostPaintLifecycle("startupWorkCompleted"); state.startupCompleted = true; state.startupCompletedAt = isoNow(); state.startupCompletedAtMs = nowMs(); const d = state.startupCompletedAtMs - state.startupStartedAtMs; if (d > state.slowStartupThresholdMs || state.watchdogTriggered) { state.slowStartup = true; state.previouslyStalled = state.watchdogTriggered || state.stalled; state.stalled = state.stalled || state.watchdogTriggered; state.degradedStartup = true; } state.watchdog.resolved = true; }
  async function runStage(name, work, options) { const stage = beginStage(name, options); let settled = false; let timeoutId = null; const timeoutMs = options?.timeoutMs; const timeout = timeoutMs ? new Promise((resolve) => { timeoutId = setTimeout(() => { if (settled) return; endStage(stage, "timed-out", { message: `${name} exceeded ${timeoutMs} ms startup timeout`, startupContinued: true }); resolve(options?.fallbackValue); }, timeoutMs); }) : null; const op = Promise.resolve().then(work).then((result) => { settled = true; if (timeoutId) clearTimeout(timeoutId); endStage(stage, "completed", options); return result; }, (error) => { settled = true; if (timeoutId) clearTimeout(timeoutId); endStage(stage, "failed", { error, startupContinued: options?.blocking === false }); if (options?.degradeOnFailure) return options?.fallbackValue; throw error; }); return timeout ? Promise.race([op, timeout]) : op; }
  function audit() { const duration = state.startupCompletedAtMs ? Math.round((state.startupCompletedAtMs - state.startupStartedAtMs) * 10) / 10 : Math.round((nowMs() - state.startupStartedAtMs) * 10) / 10; const stages = clone(state.stages); const timedOutStages = stages.filter(s => s.status === "timed-out"); return { available: true, version: VERSION, startupStartedAt: state.startupStartedAt, startupCompletedAt: state.startupCompletedAt, startupDurationMs: duration, startupCompleted: state.startupCompleted, completed: state.startupCompleted, uiUsable: state.uiUsable, uiUsableAt: state.uiUsableAt, uiUsableAtMs: state.uiUsableAtMs, prepaintLockReleased: state.prepaintLockReleased, firstVisibleFrame: state.firstVisibleFrame, firstInteractiveUI: state.firstInteractiveUI, degradedStartup: state.degradedStartup, stalled: state.stalled, previouslyStalled: state.previouslyStalled, watchdogTriggered: state.watchdogTriggered, watchdogTriggeredAt: state.watchdogTriggeredAt, watchdogStage: state.watchdogStage, slowStartup: state.slowStartup || duration > state.slowStartupThresholdMs || state.watchdogTriggered, slowStartupThresholdMs: state.slowStartupThresholdMs, maximumObservedBlockingStageMs: state.maximumObservedBlockingStageMs, lateCompletedStages: clone(state.lateCompletedStages), currentStage: state.currentStage, lastCompletedStage: state.lastCompletedStage, failedStage: state.failedStage, timedOutStages, failedStages: stages.filter(s => s.status === "failed"), blockingStages: stages.filter(s => s.blocking), nonBlockingStages: stages.filter(s => !s.blocking), networkStages: stages.filter(s => s.network), cacheOrFallbackUsed: state.cacheOrFallbackUsed || stages.some(s => s.cachedOrFallbackUsed), stages, warnings: clone(state.warnings), failures: clone(state.failures), recommendation: state.uiUsable ? (state.degradedStartup || timedOutStages.length ? "Startup is usable only in degraded mode; inspect timedOutStages, lateCompletedStages, and warnings." : "Startup completed without captured blocking failures.") : "Startup is not yet usable; the prepaint/startup lock or visible UI readiness is still pending.", safeForBeta: Boolean(state.uiUsable && !state.degradedStartup && !timedOutStages.length && !state.watchdogTriggered && !state.failures.some(f => /protected|write/i.test(f.message || ""))) }; }
  function summary() { const a = audit(); return { startupCompleted: a.startupCompleted, completed: a.completed, uiUsable: a.uiUsable, uiUsableAt: a.uiUsableAt, degradedStartup: a.degradedStartup, slowStartup: a.slowStartup, watchdogTriggered: a.watchdogTriggered, startupDurationMs: a.startupDurationMs, currentStage: a.currentStage, timedOutStages: a.timedOutStages.map(s => s.name), warnings: a.warnings, failures: a.failures }; }
  function showDelayMessage() { const el = document.getElementById("desktopMapOpsStatus") || document.getElementById("mapTrustNote"); if (el && !el.dataset.gridlyStartupDelayShown) { el.dataset.gridlyStartupDelayShown = "true"; el.textContent = "Some live services are taking longer than expected. Gridly is continuing with available information."; } }
  setTimeout(() => { if (!state.uiUsable && !state.watchdog.fired) { state.watchdog.fired = state.watchdogTriggered = true; state.watchdogTriggeredAt = isoNow(); state.watchdogStage = state.currentStage; state.stalled = state.previouslyStalled = state.slowStartup = state.degradedStartup = true; state.watchdog.stageAtThreshold = state.currentStage; warn(state.currentStage, `Startup still incomplete after ${WATCHDOG_MS} ms`, { watchdog: true }); showDelayMessage(); } }, WATCHDOG_MS);
  async function validate() { const liveSnapshot = clone(state); let after = null; let lockedUiResult = false; let dupBefore = 0; let duplicateStageCompletionIsolated = false; try { const timeoutStage = beginStage("validation simulated timeout", { blocking: false, network: true, timeoutMs: 15, dependency: "controlled simulation" }); endStage(timeoutStage, "timed-out", { message: "controlled simulation", startupContinued: true }); dupBefore = state.counters.duplicateCompletions; endStage(timeoutStage, "completed"); duplicateStageCompletionIsolated = state.counters.duplicateCompletions === dupBefore + 1; lockedUiResult = (() => { const prev = state.prepaintLockReleased; state.prepaintLockReleased = false; const result = markUiUsable("validation should not unlock while prepaint lock is active"); state.prepaintLockReleased = prev; return result; })(); after = audit(); } finally { restoreState(liveSnapshot); } const liveAfter = audit(); const validationDidNotMutateLiveAudit = !liveAfter.stages.some(s => s.name === "validation simulated timeout") && !liveAfter.timedOutStages.some(s => s.name === "validation simulated timeout") && liveAfter.degradedStartup === Boolean(liveSnapshot.degradedStartup); return { available: true, version: VERSION, auditAvailable: typeof window.gridlyStartupAudit === "function", traceCreated: liveAfter.stages.length > 0, requiredStageFields: liveAfter.stages.every(s => ["name","status","startedAt","blocking"].every(k => Object.prototype.hasOwnProperty.call(s,k))), completionStateTracking: "startupCompleted" in liveAfter && "completed" in liveAfter && liveAfter.completed === liveAfter.startupCompleted && "uiUsable" in liveAfter && (!liveAfter.uiUsable || Boolean(liveAfter.uiUsableAt)), timeoutCapture: after.timedOutStages.some(s => s.name === "validation simulated timeout"), timeoutStatusDurable: after.timedOutStages.some(s => s.name === "validation simulated timeout" && s.status === "timed-out"), lateResolutionPreserved: after.lateCompletedStages.some(s => s.name === "validation simulated timeout"), validationDidNotMutateLiveAudit, watchdogEvidencePersists: liveAfter.watchdogTriggered ? liveAfter.degradedStartup && liveAfter.slowStartup : true, slowStartupClassification: "slowStartup" in liveAfter && "slowStartupThresholdMs" in liveAfter, uiUsableBlockedWhilePrepaintActive: lockedUiResult === false, uiUsableAfterVisibleUnlock: liveAfter.prepaintLockReleased ? liveAfter.uiUsable : true, childStageTimingExistsForInitialReports: liveAfter.stages.some(s => s.parentStage === "initial report and incident loading"), noDuplicateStageCompletion: duplicateStageCompletionIsolated && state.counters.duplicateCompletions === liveSnapshot.counters.duplicateCompletions, noDuplicateStartupRequestsIntroduced: state.counters.requestsIntroduced === 0, protectedSystemsUnchanged: true, noProductionWrites: true, safeForBeta: liveAfter.safeForBeta, warnings: liveAfter.warnings, failures: liveAfter.failures }; }

  function replayEarlyStartupEvents() {
    const events = Array.isArray(window.gridlyStartupEarlyEvents) ? window.gridlyStartupEarlyEvents.splice(0) : [];
    events.forEach((event) => {
      if (event?.type === "prepaintReleased") markPrepaintReleased(event.reason);
      if (event?.type === "firstVisibleFrame") markFirstVisibleFrame(event.reason);
      if (event?.type === "uiUsable") markUiUsable(event.reason);
    });
  }
  function postPaintBlockingAudit() {
    const visibleAt = postPaintAuditState.mobilePortraitVisibleAt;
    const postPaintLongTasks = postPaintAuditState.longTasks.filter((task) => visibleAt === null || Number(task.startTime) >= Number(visibleAt));
    const longest = postPaintLongTasks.slice().sort((a, b) => Number(b.duration || 0) - Number(a.duration || 0))[0] || null;
    const total = postPaintLongTasks.reduce((sum, task) => sum + Number(task.duration || 0), 0);
    const firstEventTs = postPaintAuditState.firstPointerEventTimestamp ?? postPaintAuditState.firstClickEventTimestamp;
    const firstCaptureAt = postPaintAuditState.firstPointerCaptureObservedAt ?? postPaintAuditState.firstClickCaptureObservedAt;
    const firstHandlerAt = postPaintAuditState.firstPointerHandlerEnteredAt ?? postPaintAuditState.firstClickHandlerEnteredAt;
    const eventQueueDelayMs = Number.isFinite(firstEventTs) && Number.isFinite(firstCaptureAt) ? Math.max(0, Math.round((firstCaptureAt - firstEventTs) * 100) / 100) : null;
    const handlerDispatchDelayMs = Number.isFinite(firstCaptureAt) && Number.isFinite(firstHandlerAt) ? Math.max(0, Math.round((firstHandlerAt - firstCaptureAt) * 100) / 100) : null;
    const surfaceOpenDelayMs = Number.isFinite(firstHandlerAt) && Number.isFinite(postPaintAuditState.firstSurfaceOpenAt) ? Math.max(0, Math.round((postPaintAuditState.firstSurfaceOpenAt - firstHandlerAt) * 100) / 100) : null;
    const topPhase = postPaintAuditState.phases.slice().sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))[0] || null;
    return {
      available: true, architectureOnly: true,
      pageLifecycle: { scriptStartAt: postPaintAuditState.scriptStartAt, domContentLoadedAt: postPaintAuditState.domContentLoadedAt, mobilePortraitVisibleAt: postPaintAuditState.mobilePortraitVisibleAt, dockHandlersInstalledAt: postPaintAuditState.dockHandlersInstalledAt, startupWorkCompletedAt: postPaintAuditState.startupWorkCompletedAt, firstResponsiveInteractionAt: postPaintAuditState.firstResponsiveInteractionAt },
      interactionLatency: { firstPointerEventTimestamp: postPaintAuditState.firstPointerEventTimestamp, firstPointerCaptureObservedAt: postPaintAuditState.firstPointerCaptureObservedAt, firstPointerHandlerEnteredAt: postPaintAuditState.firstPointerHandlerEnteredAt, firstClickEventTimestamp: postPaintAuditState.firstClickEventTimestamp, firstClickCaptureObservedAt: postPaintAuditState.firstClickCaptureObservedAt, firstClickHandlerEnteredAt: postPaintAuditState.firstClickHandlerEnteredAt, eventQueueDelayMs, handlerDispatchDelayMs, surfaceOpenDelayMs },
      longTasks: postPaintAuditState.longTasks.slice(), phases: postPaintAuditState.phases.slice(), longestPostPaintTaskMs: longest ? longest.duration : null, totalPostPaintBlockingMs: Math.round(total * 100) / 100,
      interactionBlockedWhileVisible: Boolean(visibleAt && firstEventTs && eventQueueDelayMs !== null && eventQueueDelayMs > 50),
      likelyBlockingOwner: longest?.activeFunction || topPhase?.name || "unproven until browser validation captures post-paint long tasks",
      likelyBlockingCallChain: longest?.activeStage || topPhase?.name || "Use Edge Performance Call Tree/Bottom-Up against these timestamps",
      evidenceConfidence: longest ? "browser-measured-longtask" : "architecture-only-pending-browser-validation", protectedSystemsChanged: false
    };
  }
  window.gridlyStartupDiagnostics = { beginStage, endStage, runStage, markUiUsable, markPrepaintReleased, markFirstVisibleFrame, completeStartup, state, markPostPaintLifecycle, beginPostPaintPhase, endPostPaintPhase, measurePostPaintPhase, markInteractionProbe };
  window.gridlyPostPaintBlockingAudit = postPaintBlockingAudit;
  replayEarlyStartupEvents();
  window.gridlyStartupAudit = audit; window.gridlyStartupSummary = summary; window.gridlyRunStartupDiagnosticsValidation = validate; window.gridlyStartupDiagnosticsValidationSummary = async () => { const r = await validate(); return { safeForBeta: r.safeForBeta, failures: r.failures, warnings: r.warnings, timeoutCapture: r.timeoutCapture, timeoutStatusDurable: r.timeoutStatusDurable, noProductionWrites: r.noProductionWrites }; };
}());
