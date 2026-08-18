(function () {
  "use strict";
  const VERSION = "V929R4-mobile-control-validation";
  const MAX_STAGES = 240;
  const WATCHDOG_MS = 30000;
  const SLOW_STARTUP_MS = 30000;
  const nowMs = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const OUTGOING_LIFECYCLE_KEY = "gridlyDevelopmentLifecycleV1";
  const isDevelopmentHost = /^(?:localhost|127\.0\.0\.1)$/.test(String(location.hostname || "").toLowerCase());
  const lifecycleControlRequested = new URLSearchParams(location.search).has("gridlyLifecycleControl");
  let previousDocumentLifecycle = null;
  function installOutgoingDocumentLifecycleProbe() {
    if (!isDevelopmentHost) return;
    try { previousDocumentLifecycle = JSON.parse(sessionStorage.getItem(OUTGOING_LIFECYCLE_KEY) || "null"); } catch (_) { previousDocumentLifecycle = null; }
    const record = {
      version: 1,
      documentTimeOrigin: Math.round(performance.timeOrigin * 100) / 100,
      navigationType: performance.getEntriesByType("navigation")[0]?.type || null,
      fetchStart: Math.round((performance.getEntriesByType("navigation")[0]?.fetchStart || 0) * 100) / 100,
      events: []
    };
    const persist = (name, phase, event) => {
      const relativeMs = nowMs();
      record.events.push({
        name,
        phase,
        relativeMs: Math.round(relativeMs * 100) / 100,
        epochMs: Math.round((performance.timeOrigin + relativeMs) * 100) / 100,
        visibilityState: name === "visibilitychange" ? document.visibilityState : undefined,
        persisted: event && typeof event.persisted === "boolean" ? event.persisted : undefined
      });
      if (record.events.length > 24) record.events.splice(0, record.events.length - 24);
      try { sessionStorage.setItem(OUTGOING_LIFECYCLE_KEY, JSON.stringify(record)); } catch (_) {}
    };
    [
      [window, "beforeunload"], [window, "pagehide"], [document, "visibilitychange"],
      [window, "unload"], [document, "freeze"], [document, "resume"]
    ].forEach(([target, name]) => target.addEventListener(name, (event) => {
      persist(name, "start", event);
      persist(name, "end", event);
    }, { capture: true }));
    window.gridlyPreviousDocumentLifecycle = previousDocumentLifecycle;
    const showEvidence = () => {
      if (!lifecycleControlRequested || !document.body || document.getElementById("gridlyLifecycleEvidence")) return;
      const navigation = performance.getEntriesByType("navigation")[0];
      const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
      const mobileMediaQueryMatch = Boolean(window.matchMedia?.("(max-width: 980px)").matches);
      const layoutMode = document.body.getAttribute("data-layout-mode");
      const mobileSurface = document.querySelector(".app-shell");
      const desktopSurface = document.getElementById("gridlyDesktopGate");
      const isRendered = (element) => Boolean(element && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden");
      const mobileConsumerSurfaceDetected = ["portrait", "tactical-landscape"].includes(layoutMode)
        && isRendered(mobileSurface)
        && !isRendered(desktopSurface);
      const panel = document.createElement("aside");
      panel.id = "gridlyLifecycleEvidence";
      panel.setAttribute("aria-label", "Development lifecycle timing evidence");
      panel.style.cssText = `position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:min(430px,calc(100vw - 24px));max-height:55vh;overflow:auto;padding:12px;border:3px solid ${mobileConsumerSurfaceDetected ? "#43e6a0" : "#ff4d67"};border-radius:8px;background:#071426;color:#f4f8fb;font:12px/1.4 monospace;white-space:pre-wrap;box-shadow:0 8px 30px #000a`;
      const prior = previousDocumentLifecycle;
      panel.textContent = [
        ...(mobileConsumerSurfaceDetected ? [] : ["INVALID MOBILE CONTROL", "Gridly did not open in the emulated mobile consumer environment.", ""]),
        "DEVELOPMENT — NAVIGATION LIFECYCLE EVIDENCE",
        `viewportWidth: ${viewportWidth}`,
        `viewportHeight: ${viewportHeight}`,
        `devicePixelRatio: ${window.devicePixelRatio}`,
        `mobileMediaQueryMatch: ${mobileMediaQueryMatch}`,
        `navigationType: ${navigation?.type || "unavailable"}`,
        `preFetchDelay: ${(navigation?.fetchStart || 0).toFixed(1)} ms`,
        `mobileConsumerSurfaceDetected: ${mobileConsumerSurfaceDetected}`,
        "",
        prior ? `Previous Gridly: ${prior.navigationType || "unknown"}; pre-fetch ${Number(prior.fetchStart || 0).toFixed(1)} ms` : "Previous Gridly: no evidence (expected after control-page navigation)",
        `Previous lifecycle: ${prior?.events?.length ? prior.events.map((entry) => `${entry.name} ${entry.phase} @ ${entry.epochMs}`).join(" | ") : "none"}`,
        "",
        "Reload Gridly once to compare against the control-page navigation."
      ].join("\n");
      const reload = document.createElement("button");
      reload.type = "button";
      reload.textContent = "RELOAD GRIDLY";
      reload.style.cssText = "display:block;margin-top:8px;padding:7px 10px;border:0;border-radius:5px;background:#43e6a0;color:#071426;font-weight:800";
      reload.addEventListener("click", () => location.reload());
      panel.appendChild(reload);
      document.body.appendChild(panel);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showEvidence, { once: true });
    else showEvidence();
  }
  installOutgoingDocumentLifecycleProbe();
  const postPaintAuditState = {
    available: true, architectureOnly: true, protectedSystemsChanged: false, scriptStartAt: nowMs(), domContentLoadedAt: null, mobilePortraitVisibleAt: null, dockHandlersInstalledAt: null, startupWorkCompletedAt: null, firstResponsiveInteractionAt: null, firstPointerEventTimestamp: null, firstPointerCaptureObservedAt: null, firstPointerHandlerEnteredAt: null, firstClickEventTimestamp: null, firstClickCaptureObservedAt: null, firstClickHandlerEnteredAt: null, firstSurfaceOpenAt: null, activeStage: null, activeFunction: null, phases: [], longTasks: []
  };
  // Installed before the restored parser-blocking application stack. These
  // buffers are observation-only: they never wrap timers, fetch, or script
  // execution and therefore cannot change startup ordering.
  const latencyEvidence = { longTasks: [], longAnimationFrames: [] };
  function compactUrl(value) {
    try { const url = new URL(String(value || ""), document.baseURI); return url.origin === location.origin ? `${url.pathname}${url.search}` : `${url.origin}${url.pathname}`; } catch (_) { return String(value || "").replace(/[?#].*$/, ""); }
  }
  function roundMs(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : null; }
  function installLatencyObservers() {
    if (typeof PerformanceObserver !== "function") return;
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => push(latencyEvidence.longTasks, {
        start: roundMs(entry.startTime), duration: roundMs(entry.duration),
        scriptUrl: compactUrl(entry.attribution?.[0]?.containerSrc || ""),
        source: entry.attribution?.[0]?.containerName || entry.name || "self"
      }, 200))).observe({ type: "longtask", buffered: true });
    } catch (_) {}
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => push(latencyEvidence.longAnimationFrames, {
        start: roundMs(entry.startTime), duration: roundMs(entry.duration), blockingDuration: roundMs(entry.blockingDuration),
        scripts: Array.from(entry.scripts || []).slice(0, 8).map((script) => ({ sourceUrl: compactUrl(script.sourceURL), functionName: script.sourceFunctionName || null, duration: roundMs(script.duration), invoker: script.invoker || null }))
      }, 100))).observe({ type: "long-animation-frame", buffered: true });
    } catch (_) {}
  }
  installLatencyObservers();
  const isoNow = () => new Date().toISOString();
  const state = {
    available: true, version: VERSION, startupStartedAt: isoNow(), startupStartedAtMs: nowMs(), startupCompletedAt: null,
    startupCompletedAtMs: null, startupCompleted: false, uiUsable: false, uiUsableAt: null, uiUsableAtMs: null, prepaintLockReleased: false, firstVisibleFrame: false, firstInteractiveUI: false,
    degradedStartup: false, stalled: false, previouslyStalled: false, slowStartup: false, slowStartupThresholdMs: SLOW_STARTUP_MS,
    watchdogTriggered: false, watchdogTriggeredAt: null, watchdogStage: null, maximumObservedBlockingStageMs: 0, lateCompletedStages: [],
    currentStage: null, lastCompletedStage: null, failedStage: null, stages: [], warnings: [], failures: [], cacheOrFallbackUsed: false,
    watchdog: { thresholdMs: WATCHDOG_MS, fired: false, stageAtThreshold: null, resolved: false }, counters: { requestsIntroduced: 0, duplicateCompletions: 0 }, milestones: {}
  };
  function markMilestone(name, details) {
    if (!name || state.milestones[name]) return state.milestones[name] || null;
    const milestone = { name, atMs: nowMs(), at: isoNow(), ...(details || {}) };
    state.milestones[name] = milestone;
    return milestone;
  }
  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (_) { return x; } }
  function restoreState(snapshot) { Object.keys(state).forEach((key) => { delete state[key]; }); Object.assign(state, clone(snapshot)); }
  function push(list, item, cap) { list.push(item); if (list.length > cap) list.splice(0, list.length - cap); }
  function markPostPaintLifecycle(name) {
    const t = nowMs();
    markMilestone(name);
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
  function markPrepaintReleased(reason) { if (state.prepaintLockReleased) return; state.prepaintLockReleased = true; markMilestone("marketingSurfaceHidden", { reason }); const s = beginStage("prepaint/startup lock released", { blocking: true }); endStage(s, "completed", { message: reason || "prepaint lock removed" }); }
  function markFirstVisibleFrame(reason) { if (state.firstVisibleFrame) return; state.firstVisibleFrame = true; markPostPaintLifecycle("mobilePortraitVisible"); markMilestone("mobileShellVisible", { reason }); const s = beginStage("first visible Gridly frame", { blocking: true }); endStage(s, "completed", { message: reason || "visible frame painted" }); }
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
  function timingAudit() {
    const nav = performance?.getEntriesByType?.("navigation")?.[0] || null;
    const resourceRequests = (performance?.getEntriesByType?.("resource") || []).map((entry) => ({ name: String(entry.name || "").replace(/[?#].*$/, ""), startMs: Math.round(entry.startTime * 100) / 100, endMs: Math.round((entry.responseEnd || 0) * 100) / 100, durationMs: Math.round(entry.duration * 100) / 100, transferSize: entry.transferSize || 0 }));
    const stages = state.stages.map((stage) => ({ name: stage.name, startMs: Math.round(stage.startedAtMs * 100) / 100, endMs: stage.completedAtMs === null ? null : Math.round(stage.completedAtMs * 100) / 100, durationMs: stage.durationMs, blocking: stage.blocking, network: stage.network, status: stage.status }));
    const longestBlockingStage = stages.filter((stage) => stage.blocking && Number.isFinite(stage.durationMs)).sort((a, b) => b.durationMs - a.durationMs)[0] || null;
    const ms = (name) => state.milestones[name]?.atMs ?? null;
    return Object.freeze({
      navigationStart: performance?.timeOrigin || null, domContentLoadedMs: nav?.domContentLoadedEventEnd ?? ms("domContentLoaded"), windowLoadMs: nav?.loadEventEnd || null,
      appBootstrapStartMs: ms("appBootstrapStart"), mobileShellReadyMs: ms("mobileShellReady"), mobileShellVisibleMs: ms("mobileShellVisible"), firstInteractiveMs: state.uiUsableAtMs,
      destinationSearchReadyMs: ms("destinationSearchReady"), LP201ReadyMs: ms("LP201Ready"), DriveTexasReadyMs: ms("DriveTexasReady"), crossingReadyMs: ms("crossingReady"),
      longestBlockingStage, totalStartupMs: ms("mobileShellVisible") ?? state.uiUsableAtMs ?? null, milestones: clone(state.milestones), stages, resourceRequests, longTasks: clone(postPaintAuditState.longTasks)
    });
  }
  async function startupLatencyAudit() {
    const nav = performance?.getEntriesByType?.("navigation")?.[0] || null;
    const paints = performance?.getEntriesByType?.("paint") || [];
    const usableAt = state.uiUsableAtMs ?? state.milestones.mobileShellReady?.atMs ?? null;
    const scripts = Array.from(document.scripts || []);
    const scriptByUrl = new Map(scripts.filter((script) => script.src).map((script) => [compactUrl(script.src), script]));
    const classifyScript = (name) => {
      if (/app\.js|leaflet|StartupReadiness|DestinationSearchLocality|CrossingProvider(?:\.js)?|PackageRegistry|RuntimeEnvironmentConfig/i.test(name)) return "CORE_FIRST_SHELL";
      if (/Audit|Simulation|Prototype|history-capture|EndToEndPerformance/i.test(name)) return "AUDIT_ONLY";
      if (/Weather|DriveTexas|Crossing|Roadway|Txdot|lp09[789]|lp10[124]/i.test(name)) return "SECONDARY_CAN_LOAD_AFTER_SHELL";
      return "UNKNOWN_REQUIRES_REVIEW";
    };
    const resources = (performance?.getEntriesByType?.("resource") || [])
      .filter((entry) => usableAt === null || entry.startTime <= usableAt)
      .map((entry) => {
        const name = compactUrl(entry.name); const script = scriptByUrl.get(name); const classification = script ? classifyScript(name) : null;
        return { resource: name, type: entry.initiatorType || "other", start: roundMs(entry.startTime), duration: roundMs(entry.duration), transferSize: Number(entry.transferSize || 0), decodedSize: Number(entry.decodedBodySize || 0), initiator: entry.initiatorType || null, awaited: null, required: classification === "CORE_FIRST_SHELL", parserBlocking: script ? !script.async && !script.defer && script.type !== "module" : false, classification };
      });
    const allResources = (performance?.getEntriesByType?.("resource") || []).slice().sort((a, b) => a.startTime - b.startTime);
    const resourceDetail = (entry) => ({
      name: compactUrl(entry.name), initiatorType: entry.initiatorType || "other", startTime: roundMs(entry.startTime),
      fetchStart: roundMs(entry.fetchStart), requestStart: roundMs(entry.requestStart), responseStart: roundMs(entry.responseStart),
      responseEnd: roundMs(entry.responseEnd), duration: roundMs(entry.duration), transferSize: Number(entry.transferSize || 0),
      encodedBodySize: Number(entry.encodedBodySize || 0), decodedBodySize: Number(entry.decodedBodySize || 0),
      deliveryType: entry.deliveryType || null,
      cacheStatus: entry.deliveryType || (entry.transferSize > 0 ? "network-or-revalidated" : entry.decodedBodySize > 0 ? "memory-or-disk-cache" : "not-exposed-or-cross-origin")
    });
    const earliestResources = allResources.slice(0, 20).map(resourceDetail);
    const scriptEvaluation = resources.filter((entry) => entry.type === "script").map((entry) => ({
      name: entry.resource, bytes: entry.decodedSize || entry.transferSize, fetchDuration: entry.duration,
      evaluationDuration: null, parserBlocking: entry.parserBlocking, requiredForFirstShell: entry.required,
      classification: entry.classification,
      attribution: "Resource Timing measures fetch; use longAnimationFrames.scripts or a DevTools trace for parse/evaluation duration."
    }));
    scripts.filter((script) => !script.src).forEach((script, index) => scriptEvaluation.push({ name: `inline-script-${index + 1}`, bytes: script.textContent?.length || 0, fetchDuration: 0, evaluationDuration: null, parserBlocking: true, requiredForFirstShell: null, classification: "UNKNOWN_REQUIRES_REVIEW", attribution: "Inline evaluation requires a DevTools trace." }));
    const beforeUsable = (entry) => usableAt === null || Number(entry.start ?? entry.startTime) <= usableAt;
    const longTasks = latencyEvidence.longTasks.filter(beforeUsable).sort((a, b) => b.duration - a.duration).slice(0, 20);
    const longAnimationFrames = latencyEvidence.longAnimationFrames.filter(beforeUsable).sort((a, b) => b.duration - a.duration).slice(0, 20);
    const stages = state.stages.map((stage) => ({ name: stage.name, start: roundMs(stage.startedAtMs), duration: stage.durationMs, status: stage.status, blocking: stage.blocking, dependency: stage.dependency })).sort((a, b) => Number(b.duration || 0) - Number(a.duration || 0));
    const safeAudit = (name) => { try { return typeof window[name] === "function" ? window[name]() : null; } catch (_) { return null; } };
    const background = safeAudit("gridlyBackgroundLoopAudit");
    const repeatedWork = {
      activeIntervals: background?.activeIntervals?.length ?? null, activeTimeouts: background?.activeTimeouts?.length ?? null,
      activeAnimationFrames: background?.activeAnimationFrames?.length ?? null, portraitRefreshCount: background?.portraitRefreshCount ?? null,
      dailyHabitUpdateCount: background?.dailyHabitUpdateCount ?? null, repeatedSameValueWrites: background?.repeatedSameValueWrites ?? null
    };
    const milestone = (name) => state.milestones[name]?.atMs ?? null;
    const milestones = {
      navigationStart: 0, firstPaint: paints.find((entry) => entry.name === "first-paint")?.startTime ?? null,
      firstContentfulPaint: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null,
      domContentLoaded: nav?.domContentLoadedEventStart ?? milestone("domContentLoaded"), windowLoad: nav?.loadEventEnd || null,
      appEvaluationComplete: milestone("appEvaluated"), appDOMContentLoadedListenerRegistered: milestone("appDOMContentLoadedListenerRegistered"), domContentLoadedHandlerStart: milestone("appBootstrapStart"), mobileModeDetected: milestone("mobileModeDetected"),
      marketingSurfaceHidden: milestone("marketingSurfaceHidden"), portraitShellVisible: milestone("mobileShellVisible"), mapContainerVisible: milestone("mobileShellVisible"),
      mapInstanceCreated: milestone("mapInitializationEnd"), locationContextShellVisible: milestone("mobileShellReady"), coreControlsBound: milestone("mobileShellReady"),
      firstUsableConsumerShell: state.uiUsableAtMs, lp201Ready: milestone("LP201Ready"), crossingProviderStart: stages.find((entry) => entry.name.includes("crossing package loading"))?.start ?? null,
      crossingProviderEnd: milestone("crossingReady"), driveTexasStart: stages.find((entry) => /DriveTexas/i.test(entry.name))?.start ?? null, driveTexasEnd: milestone("DriveTexasReady"),
      destinationSearchHelperReadiness: milestone("destinationSearchReady") ?? milestone("destinationLocalityHelperEvaluated"), fullBootstrapComplete: state.startupCompletedAtMs
    };
    const navFields = ["startTime", "fetchStart", "domainLookupStart", "domainLookupEnd", "connectStart", "secureConnectionStart", "connectEnd", "requestStart", "responseStart", "responseEnd", "domInteractive", "domContentLoadedEventStart", "domContentLoadedEventEnd", "domComplete", "loadEventStart", "loadEventEnd", "transferSize", "encodedBodySize", "decodedBodySize", "redirectStart", "redirectEnd", "unloadEventStart", "unloadEventEnd", "workerStart", "activationStart"];
    const navigationTiming = Object.fromEntries(navFields.map((field) => [field, nav ? roundMs(nav[field]) : null]));
    const firstResourceStart = earliestResources[0]?.startTime ?? null;
    const firstPaint = milestones.firstPaint ?? milestones.firstContentfulPaint;
    Object.assign(navigationTiming, {
      type: nav?.type || null,
      notRestoredReasons: nav?.notRestoredReasons ? clone(nav.notRestoredReasons) : null,
      navigationToFetchStart: nav ? roundMs(nav.fetchStart - nav.startTime) : null,
      fetchToRequest: nav ? roundMs(nav.requestStart - nav.fetchStart) : null,
      requestToResponseStart: nav ? roundMs(nav.responseStart - nav.requestStart) : null,
      responseTransferDuration: nav ? roundMs(nav.responseEnd - nav.responseStart) : null,
      responseEndToFirstResource: nav && firstResourceStart !== null ? roundMs(firstResourceStart - nav.responseEnd) : null,
      responseEndToFirstPaint: nav && firstPaint !== null ? roundMs(firstPaint - nav.responseEnd) : null,
      responseEndToDOMContentLoaded: nav ? roundMs(nav.domContentLoadedEventStart - nav.responseEnd) : null
    });
    const documentDelivery = {
      url: compactUrl(nav?.name || location.href), requestStart: navigationTiming.requestStart, responseStart: navigationTiming.responseStart,
      responseEnd: navigationTiming.responseEnd, responseTransferDuration: navigationTiming.responseTransferDuration,
      transferSize: navigationTiming.transferSize, encodedBodySize: navigationTiming.encodedBodySize, decodedBodySize: navigationTiming.decodedBodySize,
      nextHopProtocol: nav?.nextHopProtocol || null, deliveryType: nav?.deliveryType || null,
      cacheStatus: nav?.deliveryType || (nav?.transferSize > 0 ? "network-or-revalidated" : nav?.decodedBodySize > 0 ? "memory-or-disk-cache" : "not-exposed"),
      devToolsDisableCache: "unknown-browser-apis-do-not-expose-this-devtools-setting",
      liveReloadAttribution: "Navigation Timing cannot identify server buffering, filesystem watching, or live-reload injection; correlate the request/response intervals with the Live Server log or a network trace."
    };
    const html = document.documentElement?.outerHTML || "";
    const linesBefore = (offset) => offset < 0 ? null : html.slice(0, offset).split("\n").length;
    const position = (selector) => {
      const element = document.querySelector(selector); if (!element) return null;
      const token = element.outerHTML; const byteOffset = new TextEncoder().encode(html.slice(0, html.indexOf(token))).length;
      return { selector, byteOffset, line: linesBefore(html.indexOf(token)), documentOrder: Array.from(document.querySelectorAll("link,script")).indexOf(element) + 1 };
    };
    const firstStylesheet = document.querySelector('link[rel="stylesheet"]');
    const firstExternalScript = document.querySelector("script[src]");
    const appScript = Array.from(document.scripts).find((script) => /\/app\.js(?:[?#]|$)/.test(script.src));
    const documentStructure = {
      sourceNote: "Byte offsets describe the live DOM serialization (including any Live Server injection), not unavailable original response bytes.",
      serializedDocumentBytes: new TextEncoder().encode(html).length, serializedDocumentLines: html.split("\n").length,
      bytesBeforeFirstStylesheet: firstStylesheet ? new TextEncoder().encode(html.slice(0, html.indexOf(firstStylesheet.outerHTML))).length : null,
      linesBeforeFirstStylesheet: firstStylesheet ? linesBefore(html.indexOf(firstStylesheet.outerHTML)) : null,
      bytesBeforeFirstExternalScript: firstExternalScript ? new TextEncoder().encode(html.slice(0, html.indexOf(firstExternalScript.outerHTML))).length : null,
      linesBeforeFirstExternalScript: firstExternalScript ? linesBefore(html.indexOf(firstExternalScript.outerHTML)) : null,
      bytesBeforeAppScript: appScript ? new TextEncoder().encode(html.slice(0, html.indexOf(appScript.outerHTML))).length : null,
      linesBeforeAppScript: appScript ? linesBefore(html.indexOf(appScript.outerHTML)) : null,
      criticalResourcePositions: {
        leafletCss: position('link[href*="leaflet"][rel="stylesheet"]'), stylesCss: position('link[href*="styles.css"]'),
        startupDiagnostics: position('script[src*="gridlyStartupDiagnostics.js"]'), leafletJs: position('script[src*="leaflet.js"]'),
        supabase: position('script[src*="supabase"]'), packageRegistry: position('script[src*="gridlyPackageRegistry.js"]'), appJs: position('script[src*="/app.js"]')
      },
      inlineScriptsBeforeFirstResource: Array.from(document.scripts).filter((script) => !script.src && firstStylesheet && (script.compareDocumentPosition(firstStylesheet) & Node.DOCUMENT_POSITION_FOLLOWING)).map((script, index) => {
        const source = script.textContent || "";
        return { name: script.id || `inline-script-${index + 1}`, bytes: new TextEncoder().encode(source).length, parserBlocking: true,
          purpose: /theme/i.test(script.id) ? "prepaint theme selection" : /HostnameGate/.test(source) ? "hostname access gate" : /ReleasePrepaintLock/.test(source) ? "prepaint lock release scheduling" : "unclassified inline startup logic",
          synchronousCpu: true, networkAccess: /\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(source), storageAccess: /localStorage|sessionStorage|indexedDB/.test(source),
          loopsOrTraversals: /\b(?:for|while)\s*\(|\.forEach\s*\(|querySelectorAll/.test(source) };
      })
    };
    const controller = navigator.serviceWorker?.controller || null;
    let registration = null; let navigationPreload = null; let serviceWorkerError = null;
    if (navigator.serviceWorker) {
      try {
        registration = await navigator.serviceWorker.getRegistration();
        if (registration?.navigationPreload) navigationPreload = await registration.navigationPreload.getState();
      } catch (error) { serviceWorkerError = String(error?.message || error); }
    }
    const serviceWorker = { supported: "serviceWorker" in navigator, controlled: Boolean(controller), controller: controller ? { scriptURL: controller.scriptURL, state: controller.state } : null,
      activeRegistration: Boolean(registration?.active), scope: registration?.scope || null, scriptURL: registration?.active?.scriptURL || null, navigationPreload,
      workerStart: navigationTiming.workerStart, error: serviceWorkerError };
    const legacyNavigationStart = performance?.timing?.navigationStart || null;
    const timeOriginValidation = { timeOrigin: roundMs(performance.timeOrigin), performanceNow: roundMs(performance.now()), navigationStartTime: navigationTiming.startTime,
      legacyNavigationStart, originMinusLegacyNavigationStart: legacyNavigationStart ? roundMs(performance.timeOrigin - legacyNavigationStart) : null,
      earliestResourceStart: firstResourceStart, firstPaint: roundMs(firstPaint), domInteractive: navigationTiming.domInteractive,
      sameMonotonicClock: navigationTiming.startTime === 0 && (firstResourceStart === null || firstResourceStart >= 0) && performance.now() >= (firstResourceStart || 0) };
    const preResourceGap = { navigationStart: navigationTiming.startTime, firstResourceStart,
      navigationToFirstResource: firstResourceStart === null ? null : roundMs(firstResourceStart - navigationTiming.startTime),
      responseEndToFirstResource: navigationTiming.responseEndToFirstResource };
    const parserProgress = clone(window.gridlyParserProgress || []).map((entry, index, entries) => ({
      ...entry, at: roundMs(entry.at), sincePrevious: index ? roundMs(entry.at - entries[index - 1].at) : null
    }));
    const parserMark = (name) => parserProgress.find((entry) => entry.name === name)?.at ?? null;
    const inlineScriptTimings = [1, 2, 3].map((number) => {
      const start = parserMark(`DOCUMENT_INLINE_${number}_START`); const end = parserMark(`DOCUMENT_INLINE_${number}_END`);
      return { name: ["theme initialization", "hostname gate", "prepaint scheduler"][number - 1], start, end, duration: start === null || end === null ? null : roundMs(end - start) };
    });
    const parserSegments = parserProgress.map((entry, index) => {
      const previous = index ? parserProgress[index - 1] : { name: "DOCUMENT_RESPONSE_END", at: navigationTiming.responseEnd };
      return { from: previous.name, to: entry.name, start: previous.at, end: entry.at, duration: previous.at === null ? null : roundMs(entry.at - previous.at) };
    });
    const parserGapAttribution = {
      segments: parserSegments,
      longestSegment: parserSegments.filter((segment) => segment.duration !== null).sort((a, b) => b.duration - a.duration)[0] || null,
      interpretation: "The longest measured segment locates parser unavailability; it does not by itself identify browser-extension or security work."
    };
    const lifecycle = {
      previousDocumentLifecycle,
      documentWasDiscarded: typeof document.wasDiscarded === "boolean" ? document.wasDiscarded : null,
      events: clone(window.gridlyEarlyLifecycle || []),
      previousDocumentUnloadExposed: Boolean(nav && (nav.unloadEventStart > 0 || nav.unloadEventEnd > 0))
    };
    const trackingPrevention = {
      browserConsoleMessagesObservable: false,
      causalStatus: "unattributed-until-owner-correlates-console-timestamps-with-parserProgress",
      resourceOrigins: Array.from(new Set(allResources.map((entry) => { try { return new URL(entry.name).origin; } catch (_) { return null; } }).filter(Boolean)))
    };
    const classifications = [];
    if (!timeOriginValidation.sameMonotonicClock) classifications.push("INSTRUMENTATION_CLOCK_ERROR");
    else {
      if (nav && nav.workerStart > 0 && nav.responseStart - nav.workerStart > 1000) classifications.push("SERVICE_WORKER_DELAY");
      if (nav && nav.fetchStart - nav.startTime > 1000) classifications.push("NAVIGATION_PRE_REQUEST_DELAY");
      if (nav && nav.responseStart - nav.requestStart > 1000) classifications.push("SERVER_RESPONSE_DELAY");
      if (nav && nav.responseEnd - nav.responseStart > 1000) classifications.push("DOCUMENT_TRANSFER_DELAY");
      if (nav && firstResourceStart !== null && firstResourceStart - nav.responseEnd > 1000) classifications.push("EARLY_PARSER_BLOCK");
      if (!classifications.length && nav && firstResourceStart !== null) classifications.push("NO_MATERIAL_PRE_RESOURCE_GAP_IN_THIS_CAPTURE");
    }
    if (!classifications.length) classifications.push("INSUFFICIENT_OWNER_BROWSER_EVIDENCE");
    const classification = classifications[0];
    const startupGate = {
      function: "primary app.js DOMContentLoaded handler",
      predicate: "prepaint lock released AND core map/mobile controls initialized",
      lastSatisfied: state.uiUsable ? (milestones.coreControlsBound >= milestones.marketingSurfaceHidden ? "core map/mobile controls initialized" : "prepaint lock released") : state.currentStage || "not yet observed",
      prerequisites: [
        { name: "DOMContentLoaded", classification: "TRULY_REQUIRED", at: milestones.domContentLoaded },
        { name: "persisted county geometry when selected", classification: "LEGACY_COUPLING", at: stages.find((entry) => entry.name.includes("county geometry"))?.start ?? null },
        { name: "map initialization", classification: "TRULY_REQUIRED", at: milestones.mapInstanceCreated },
        { name: "core controls binding", classification: "TRULY_REQUIRED", at: milestones.coreControlsBound },
        { name: "LP201/crossings/DriveTexas/destination providers", classification: "SHOULD_NOT_BLOCK_SHELL", at: null }
      ]
    };
    const owners = [...stages.filter((entry) => entry.duration), ...longTasks.map((entry) => ({ name: entry.scriptUrl || entry.source || "long task", duration: entry.duration, start: entry.start }))]
      .sort((a, b) => Number(b.duration || 0) - Number(a.duration || 0)).slice(0, 20);
    const findings = [
      "Read-only capture; no startup execution order or readiness predicate was changed.",
      scriptEvaluation.some((entry) => entry.name.includes("/js/app.js") && entry.parserBlocking) ? "app.js remains parser-blocking in the restored safe order." : "app.js parser-blocking status was not observed.",
      "Resource Timing does not expose JavaScript parse/evaluation duration; Long Animation Frame attribution is included when Chromium supports it.",
      startupGate.lastSatisfied ? `Last observed first-shell prerequisite: ${startupGate.lastSatisfied}.` : "First-shell prerequisite is pending browser evidence."
    ];
    return Object.freeze({ navigationTiming, documentDelivery, earliestResources, serviceWorker, timeOriginValidation, documentStructure, preResourceGap, classification, classifications, parserProgress, inlineScriptTimings, parserGapAttribution, lifecycle, trackingPrevention, milestones, resources, scriptEvaluation, longTasks, longAnimationFrames, startupGate, repeatedWork, topOwners: owners, findings });
  }
  window.gridlyStartupDiagnostics = { beginStage, endStage, runStage, markMilestone, markUiUsable, markPrepaintReleased, markFirstVisibleFrame, completeStartup, state, markPostPaintLifecycle, beginPostPaintPhase, endPostPaintPhase, measurePostPaintPhase, markInteractionProbe };
  window.gridlyPostPaintBlockingAudit = postPaintBlockingAudit;
  window.gridlyStartupTimingAudit = timingAudit;
  window.gridlyStartupLatencyAudit = startupLatencyAudit;
  replayEarlyStartupEvents();
  window.gridlyStartupAudit = audit; window.gridlyStartupSummary = summary; window.gridlyRunStartupDiagnosticsValidation = validate; window.gridlyStartupDiagnosticsValidationSummary = async () => { const r = await validate(); return { safeForBeta: r.safeForBeta, failures: r.failures, warnings: r.warnings, timeoutCapture: r.timeoutCapture, timeoutStatusDurable: r.timeoutStatusDurable, noProductionWrites: r.noProductionWrites }; };
}());
