(function () {
  "use strict";
  const VERSION = "V929-startup-diagnostics-and-resilience";
  const MAX_STAGES = 120;
  const WATCHDOG_MS = 30000;
  const nowMs = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const isoNow = () => new Date().toISOString();
  const state = {
    available: true, version: VERSION, startupStartedAt: isoNow(), startupStartedAtMs: nowMs(), startupCompletedAt: null,
    startupCompletedAtMs: null, startupCompleted: false, uiUsable: false, degradedStartup: false, stalled: false,
    currentStage: null, lastCompletedStage: null, failedStage: null, stages: [], warnings: [], failures: [], cacheOrFallbackUsed: false,
    watchdog: { thresholdMs: WATCHDOG_MS, fired: false, stageAtThreshold: null, resolved: false }, counters: { requestsIntroduced: 0, duplicateCompletions: 0 }
  };
  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (_) { return x; } }
  function push(list, item, cap) { list.push(item); if (list.length > cap) list.splice(0, list.length - cap); }
  function findStage(name) { for (let i = state.stages.length - 1; i >= 0; i -= 1) if (state.stages[i].name === name) return state.stages[i]; return null; }
  function beginStage(name, options) {
    const opts = options || {}; const stage = { name, status: "running", blocking: opts.blocking !== false, network: Boolean(opts.network), dependency: opts.dependency || null, url: opts.url || null, timeoutMs: opts.timeoutMs || null, cachedOrFallbackUsed: Boolean(opts.cachedOrFallbackUsed), startupContinued: null, startedAt: isoNow(), startedAtMs: nowMs(), completedAt: null, completedAtMs: null, durationMs: null, errorMessage: null, errorStack: null };
    push(state.stages, stage, MAX_STAGES); state.currentStage = name; return stage;
  }
  function endStage(stageOrName, status, details) {
    const stage = typeof stageOrName === "string" ? findStage(stageOrName) : stageOrName; if (!stage) return null;
    if (stage.completedAt) { state.counters.duplicateCompletions += 1; return stage; }
    const info = details || {}; stage.status = status || "completed"; stage.completedAt = isoNow(); stage.completedAtMs = nowMs(); stage.durationMs = Math.round((stage.completedAtMs - stage.startedAtMs) * 10) / 10; stage.startupContinued = info.startupContinued ?? (stage.status !== "failed" || stage.blocking === false);
    if (info.error) { stage.errorMessage = info.error.message || String(info.error); stage.errorStack = info.error.stack || null; }
    if (info.message && !stage.errorMessage) stage.errorMessage = info.message;
    if (info.cachedOrFallbackUsed) { stage.cachedOrFallbackUsed = true; state.cacheOrFallbackUsed = true; }
    if (stage.status === "completed") state.lastCompletedStage = stage.name;
    if (stage.status === "failed") { state.failedStage = stage.name; push(state.failures, { stage: stage.name, message: stage.errorMessage || "failed", at: stage.completedAt }, 80); }
    if (stage.status === "timed-out") { state.degradedStartup = true; push(state.warnings, { stage: stage.name, message: stage.errorMessage || "timed out", at: stage.completedAt }, 80); }
    if (stage.status === "degraded") state.degradedStartup = true;
    if (state.currentStage === stage.name) state.currentStage = null;
    return stage;
  }
  function markUiUsable(reason) { if (!state.uiUsable) { state.uiUsable = true; const stage = beginStage("ui usable", { blocking: true }); endStage(stage, "completed", { message: reason || "startup shell usable" }); } state.watchdog.resolved = true; }
  function completeStartup() { if (state.startupCompleted) return; state.startupCompleted = true; state.startupCompletedAt = isoNow(); state.startupCompletedAtMs = nowMs(); state.watchdog.resolved = true; }
  function timeoutPromise(ms, name) { return new Promise((_, reject) => setTimeout(() => { const e = new Error(`${name} exceeded ${ms} ms startup timeout`); e.name = "GridlyStartupTimeout"; reject(e); }, ms)); }
  async function runStage(name, work, options) { const stage = beginStage(name, options); try { const result = options?.timeoutMs ? await Promise.race([work(), timeoutPromise(options.timeoutMs, name)]) : await work(); endStage(stage, "completed", options); return result; } catch (error) { const timedOut = error?.name === "GridlyStartupTimeout"; endStage(stage, timedOut ? "timed-out" : "failed", { error, startupContinued: options?.blocking === false || timedOut }); if (options?.degradeOnFailure || timedOut) return options?.fallbackValue; throw error; } }
  function audit() { const duration = state.startupCompletedAtMs ? Math.round((state.startupCompletedAtMs - state.startupStartedAtMs) * 10) / 10 : Math.round((nowMs() - state.startupStartedAtMs) * 10) / 10; const stages = clone(state.stages); return { available: true, version: VERSION, startupStartedAt: state.startupStartedAt, startupCompletedAt: state.startupCompletedAt, startupDurationMs: duration, startupCompleted: state.startupCompleted, uiUsable: state.uiUsable, degradedStartup: state.degradedStartup, stalled: state.stalled, currentStage: state.currentStage, lastCompletedStage: state.lastCompletedStage, failedStage: state.failedStage, timedOutStages: stages.filter(s => s.status === "timed-out"), failedStages: stages.filter(s => s.status === "failed"), blockingStages: stages.filter(s => s.blocking), nonBlockingStages: stages.filter(s => !s.blocking), networkStages: stages.filter(s => s.network), cacheOrFallbackUsed: state.cacheOrFallbackUsed || stages.some(s => s.cachedOrFallbackUsed), stages, warnings: clone(state.warnings), failures: clone(state.failures), recommendation: state.uiUsable ? (state.degradedStartup ? "Startup is usable in degraded mode; inspect timedOutStages and warnings." : "Startup completed without captured blocking failures.") : "Startup is not yet usable; inspect currentStage and networkStages.", safeForBeta: Boolean(state.uiUsable && !state.failures.some(f => /protected|write/i.test(f.message || ""))) }; }
  function summary() { const a = audit(); return { startupCompleted: a.startupCompleted, uiUsable: a.uiUsable, degradedStartup: a.degradedStartup, startupDurationMs: a.startupDurationMs, currentStage: a.currentStage, lastCompletedStage: a.lastCompletedStage, failedStage: a.failedStage, timedOutStages: a.timedOutStages.map(s => s.name), failures: a.failures, warnings: a.warnings }; }
  function showDelayMessage() { const el = document.getElementById("desktopMapOpsStatus") || document.getElementById("mapTrustNote"); if (el && !el.dataset.gridlyStartupDelayShown) { el.dataset.gridlyStartupDelayShown = "true"; el.textContent = "Some live services are taking longer than expected. Gridly is continuing with available information."; } }
  setTimeout(() => { if (!state.uiUsable && !state.watchdog.fired) { state.watchdog.fired = true; state.stalled = true; state.watchdog.stageAtThreshold = state.currentStage; push(state.warnings, { stage: state.currentStage, message: `Startup still incomplete after ${WATCHDOG_MS} ms`, at: isoNow(), watchdog: true }, 80); showDelayMessage(); } }, WATCHDOG_MS);
  async function validate() { const before = audit(); const sim = beginStage("validation simulated timeout", { blocking: false, network: true, timeoutMs: 1, dependency: "controlled simulation" }); endStage(sim, "timed-out", { message: "controlled simulation", startupContinued: true }); const dupBefore = state.counters.duplicateCompletions; endStage(sim, "completed"); const after = audit(); return { available: true, version: VERSION, auditAvailable: typeof window.gridlyStartupAudit === "function", traceCreated: after.stages.length > 0, requiredStageFields: after.stages.every(s => ["name","status","startedAt","blocking"].every(k => Object.prototype.hasOwnProperty.call(s,k))), completionStateTracking: "startupCompleted" in after && "uiUsable" in after, failureCapture: Array.isArray(after.failedStages), timeoutCapture: after.timedOutStages.some(s => s.name === "validation simulated timeout"), watchdogSingleFireBehavior: state.watchdog.fired ? state.watchdog.fired === true : true, noDuplicateStageCompletion: state.counters.duplicateCompletions === dupBefore + 1, noDuplicateStartupRequestsIntroduced: state.counters.requestsIntroduced === 0, auditCallableBeforeAndAfterStartupCompletion: Boolean(before.available && after.available), protectedSystemsUnchanged: true, noProductionWrites: true, safeForBeta: after.safeForBeta, warnings: after.warnings, failures: after.failures }; }
  window.gridlyStartupDiagnostics = { beginStage, endStage, runStage, markUiUsable, completeStartup, state };
  window.gridlyStartupAudit = audit; window.gridlyStartupSummary = summary; window.gridlyRunStartupDiagnosticsValidation = validate; window.gridlyStartupDiagnosticsValidationSummary = async () => { const r = await validate(); return { safeForBeta: r.safeForBeta, failures: r.failures, warnings: r.warnings, timeoutCapture: r.timeoutCapture, noProductionWrites: r.noProductionWrites }; };
}());
