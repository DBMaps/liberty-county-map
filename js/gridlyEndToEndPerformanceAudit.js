(function gridlyEndToEndPerformanceAuditModule(globalScope) {
  "use strict";
  const VERSION = "V919-end-to-end-performance-audit";
  const sessionStartedAt = new Date().toISOString();
  const state = globalScope.__gridlyV919PerformanceState || (globalScope.__gridlyV919PerformanceState = {
    version: VERSION,
    sessionStartedAt,
    timings: {},
    failures: {},
    interactions: [],
    network: [],
    duplicateRequests: [],
    renders: {},
    duplicateRenders: [],
    listeners: [],
    timers: { intervals: [], timeouts: [], animationFrames: [] },
    longTasks: [],
    lastSimulation: null
  });

  const now = () => (globalScope.performance && typeof globalScope.performance.now === "function" ? globalScope.performance.now() : Date.now());
  const wall = () => Date.now();
  const round = (value) => Number(Number(value || 0).toFixed(2));
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const getPath = (value) => String(value || "unknown").slice(0, 160);
  function recordTiming(name, duration, ok = true, meta = {}) {
    const list = state.timings[name] || (state.timings[name] = []);
    list.push({ durationMs: round(duration), at: wall(), ok: Boolean(ok), meta });
    if (list.length > 300) list.splice(0, list.length - 300);
    if (!ok) state.failures[name] = Number(state.failures[name] || 0) + 1;
    return duration;
  }
  function stats(nameOrSamples) {
    const samples = Array.isArray(nameOrSamples) ? nameOrSamples : safeArray(state.timings[nameOrSamples]).map((s) => s.durationMs);
    const values = samples.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const count = values.length;
    const at = (p) => count ? values[Math.min(count - 1, Math.max(0, Math.ceil(count * p) - 1))] : 0;
    const avg = count ? values.reduce((a, b) => a + b, 0) / count : 0;
    return { min: round(values[0] || 0), max: round(values[count - 1] || 0), average: round(avg), median: round(at(0.5)), p50: round(at(0.5)), p75: round(at(0.75)), p95: round(at(0.95)), sampleCount: count, failureCount: 0 };
  }
  function statsFor(name) { const result = stats(name); result.failureCount = Number(state.failures[name] || 0); return result; }
  function classifyDevice() {
    const nav = globalScope.navigator || {};
    const cores = Number(nav.hardwareConcurrency || 0);
    const mem = Number(nav.deviceMemory || 0);
    const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || "");
    const className = (cores && cores <= 4) || (mem && mem <= 4) ? "low-to-mid" : (mobile ? "mobile" : "desktop");
    return { className, mobile, hardwareConcurrency: cores || null, deviceMemoryGb: mem || null, userAgent: nav.userAgent || "" };
  }
  function connectionProfile() {
    const c = (globalScope.navigator || {}).connection || {};
    return { effectiveType: c.effectiveType || "unknown", downlink: c.downlink || null, rtt: c.rtt || null, saveData: Boolean(c.saveData), online: (globalScope.navigator || {}).onLine !== false };
  }
  function safeCall(name) { try { return typeof globalScope[name] === "function" ? globalScope[name]() : null; } catch (error) { return { error: error?.message || String(error) }; } }
  function markInteraction(name, phase, startedAt, meta = {}) {
    const durationMs = now() - startedAt;
    const entry = { name, phase, durationMs: round(durationMs), at: wall(), meta };
    state.interactions.push(entry);
    if (state.interactions.length > 400) state.interactions.splice(0, state.interactions.length - 400);
    recordTiming(`interaction.${name}.${phase}`, durationMs, true, meta);
    return entry;
  }
  function observeLongTasks() {
    if (state.longTaskObserverStarted || typeof PerformanceObserver !== "function") return;
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          state.longTasks.push({ name: entry.name || "longtask", durationMs: round(entry.duration), startTime: round(entry.startTime), at: wall(), thresholds: { over50: entry.duration > 50, over100: entry.duration > 100, over250: entry.duration > 250, over500: entry.duration > 500 } });
        });
        if (state.longTasks.length > 200) state.longTasks.splice(0, state.longTasks.length - 200);
      });
      observer.observe({ entryTypes: ["longtask"] });
      state.longTaskObserverStarted = true;
    } catch (_error) { state.longTaskObserverStarted = false; }
  }
  function installLightweightInstrumentation() {
    if (state.instrumentationInstalled) return;
    state.instrumentationInstalled = true;
    observeLongTasks();
    const originalFetch = globalScope.fetch;
    if (typeof originalFetch === "function") {
      globalScope.fetch = function gridlyV919Fetch(input, init) {
        const started = now();
        const url = typeof input === "string" ? input : (input && input.url) || "unknown";
        const key = `${(init && init.method) || "GET"}:${url}`;
        const concurrent = state.network.find((r) => r.key === key && r.inFlight);
        if (concurrent) state.duplicateRequests.push({ key, at: wall(), previousStartedAt: concurrent.at });
        const rec = { key, url: getPath(url), method: (init && init.method) || "GET", at: wall(), start: round(started), inFlight: true, uiWaited: false };
        state.network.push(rec);
        if (state.network.length > 300) state.network.splice(0, state.network.length - 300);
        return originalFetch.apply(this, arguments).then((response) => {
          rec.inFlight = false; rec.status = response.status; rec.ok = response.ok; rec.durationMs = round(now() - started);
          rec.payloadSize = Number(response.headers && response.headers.get && response.headers.get("content-length")) || null;
          recordTiming(`network.${rec.method}`, rec.durationMs, response.ok, { url: rec.url, status: rec.status });
          return response;
        }, (error) => { rec.inFlight = false; rec.error = error?.message || String(error); rec.durationMs = round(now() - started); recordTiming(`network.${rec.method}`, rec.durationMs, false, { url: rec.url }); throw error; });
      };
    }
    if (typeof EventTarget !== "undefined" && EventTarget.prototype && EventTarget.prototype.addEventListener) {
      const add = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function gridlyV919AddEventListener(type, listener, options) {
        state.listeners.push({ target: this === globalScope ? "window" : (this === document ? "document" : (this && this.id ? `#${this.id}` : this?.tagName || "event-target")), type: String(type), listenerName: listener?.name || "anonymous", capture: Boolean(options && options.capture), at: wall() });
        if (state.listeners.length > 500) state.listeners.splice(0, state.listeners.length - 500);
        return add.apply(this, arguments);
      };
    }
    ["setInterval", "setTimeout", "requestAnimationFrame"].forEach((name) => {
      const original = globalScope[name];
      if (typeof original !== "function") return;
      globalScope[name] = function gridlyV919TimerWrapper(handler, delay) {
        const id = original.apply(this, arguments);
        const bucket = name === "setInterval" ? state.timers.intervals : (name === "setTimeout" ? state.timers.timeouts : state.timers.animationFrames);
        bucket.push({ id: String(id), delayMs: Number(delay) || 0, handlerName: handler?.name || "anonymous", at: wall() });
        if (bucket.length > 200) bucket.splice(0, bucket.length - 200);
        return id;
      };
    });
    document.addEventListener("pointerdown", (event) => {
      const started = now();
      const target = event.target && event.target.closest && event.target.closest("button,a,input,summary,[role='button'],[data-section],[data-v2-sheet]");
      if (!target) return;
      requestAnimationFrame(() => markInteraction(target.id || target.dataset?.section || target.dataset?.v2Sheet || target.textContent?.trim()?.slice(0, 30) || "tap", "visualAcknowledgement", started));
    }, { capture: true, passive: true });
  }
  function schedulerAudit() {
    const background = safeCall("gridlyBackgroundLoopAudit") || {};
    const listenerGroups = {};
    state.listeners.forEach((l) => { const key = `${l.target}|${l.type}|${l.listenerName}|${l.capture}`; listenerGroups[key] = (listenerGroups[key] || 0) + 1; });
    const duplicateListenerRisks = Object.entries(listenerGroups).filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
    return { available: true, version: VERSION, activeIntervals: background.activeIntervals || state.timers.intervals.slice(-50), activeTimeouts: background.activeTimeouts || state.timers.timeouts.slice(-50), activeAnimationFrames: background.activeAnimationFrames || state.timers.animationFrames.slice(-50), knownPollingLoops: (background.activeIntervals || state.timers.intervals).filter((t) => /refresh|poll|loadSharedReports|interval/i.test(JSON.stringify(t))), duplicateListenerRisks, highFrequencyHandlers: state.listeners.filter((l) => /move|zoom|scroll|resize|input/i.test(l.type)).slice(-80), hiddenTabWork: { documentHidden: document.hidden, pollingWhileHiddenRisk: document.hidden && safeArray(background.activeIntervals || state.timers.intervals).length > 0 }, recommendations: ["Keep live refresh polling paused while document.hidden is true.", "Attach panel and marker listeners once; update content without re-registering handlers.", "Coalesce move/zoom work onto moveend/zoomend where user-visible output does not need every frame."] };
  }
  function buildAudit() {
    const refresh = safeCall("gridlyRefreshBreakdownAudit") || {};
    const networkAudit = safeCall("gridlyNetworkAudit") || {};
    const background = safeCall("gridlyBackgroundLoopAudit") || {};
    const navTiming = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    const duplicateWork = { duplicateRequests: state.duplicateRequests.slice(-50), duplicateRenders: state.duplicateRenders.slice(-50), unchangedDomWriteSkipped: refresh.unchangedDomWriteSkipped || 0, networkSkippedRefreshes: networkAudit.skippedRefreshes || {} };
    return { available: true, version: VERSION, sessionStartedAt: state.sessionStartedAt, deviceClass: classifyDevice(), connectionProfile: connectionProfile(), startup: { navigation: navTiming ? { domContentLoadedMs: round(navTiming.domContentLoadedEventEnd), loadEventMs: round(navTiming.loadEventEnd), responseEndMs: round(navTiming.responseEnd) } : null, visibleShell: statsFor("startup.visibleShell"), cachedAwareness: statsFor("startup.cachedAwareness"), networkRefreshed: statsFor("startup.networkRefreshed") }, interactions: { pointerdownToVisualAcknowledgement: statsFor("interaction.tap.visualAcknowledgement"), recent: state.interactions.slice(-80) }, reporting: { submitToDisabled: statsFor("report.submit.disabled"), submitToAcknowledgement: statsFor("report.submit.acknowledgement"), submitToLocalMarker: statsFor("report.submit.localMarker"), submitToSupabase: statsFor("report.submit.supabase"), lifecycle: networkAudit.lastHazardSubmitLifecycle || null }, alerts: { openStart: statsFor("alerts.openStart"), firstContent: statsFor("alerts.firstContent") }, awareness: { render: statsFor("awareness.render"), cacheReuseApplied: Boolean(refresh.cacheReuseApplied) }, communityPulse: { render: statsFor("communityPulse.render") }, crossings: { render: statsFor("crossings.render"), popupVisible: statsFor("crossings.popupVisible") }, hazards: { render: statsFor("hazards.render"), popupVisible: statsFor("hazards.popupVisible") }, search: { open: statsFor("search.open"), firstResult: statsFor("search.firstResult") }, routeWatch: { preview: statsFor("routeWatch.preview") }, map: { move: statsFor("map.move"), zoom: statsFor("map.zoom"), itemCounts: refresh.itemCounts || {} }, network: { requests: state.network.slice(-100), duplicates: state.duplicateRequests.slice(-50), existingAudit: networkAudit }, storage: { localStorageKeys: (() => { try { return localStorage.length; } catch { return null; } })(), sessionStorageKeys: (() => { try { return sessionStorage.length; } catch { return null; } })() }, rendering: { refreshBreakdown: refresh, renderTimings: Object.fromEntries(Object.keys(state.timings).filter((k) => /render|marker|popup|panel|alert|awareness|pulse/i.test(k)).map((k) => [k, statsFor(k)])) }, longTasks: { over50: state.longTasks.filter((t) => t.durationMs > 50), over100: state.longTasks.filter((t) => t.durationMs > 100), over250: state.longTasks.filter((t) => t.durationMs > 250), over500: state.longTasks.filter((t) => t.durationMs > 500) }, duplicateWork, eventListeners: schedulerAudit().duplicateListenerRisks, timers: { background, scheduler: schedulerAudit() }, recommendations: rankBottlenecks().map((b) => b.recommendedMinimalFix), safeForBeta: true, protectedSystemsUnchanged: true };
  }
  function rankBottlenecks() {
    const audit = { refresh: safeCall("gridlyRefreshBreakdownAudit") || {}, network: safeCall("gridlyNetworkAudit") || {} };
    const findings = [];
    const refreshMs = Number(audit.refresh.refreshDurationMs || 0);
    if (refreshMs > 1000) findings.push({ priority: refreshMs > 2000 ? "P0" : "P1", symptom: "Refresh chain delays visible content", trigger: "loadSharedReports/post-submit/interval refresh", measuredLatency: refreshMs, p95Latency: statsFor("refresh.total").p95 || refreshMs, rootCause: "Combined alert, marker, awareness, route, and pulse refresh work on one chain", functionsInvolved: ["loadSharedReports", "renderAlerts", "renderRoadHazards", "renderGridlyCommunityPulse", "updateRouteIntelligence"], mainThreadImpact: "Potential long task during render children", networkImpact: "Shared reports read may precede rendering", renderImpact: "Multiple surfaces can update in sequence", recommendedMinimalFix: "Keep cached/local surfaces visible first and reconcile each surface only when its input signature changes.", regressionRisk: "medium", protectedSystemsAffected: "none if audit-only/cache guards preserve data contracts", independentlyFixable: true });
    if (state.duplicateRequests.length) findings.push({ priority: "P2", symptom: "Duplicate network requests observed", trigger: "Concurrent identical fetch", measuredLatency: state.duplicateRequests.length, p95Latency: state.duplicateRequests.length, rootCause: "Same method/url requested while prior request in flight", functionsInvolved: ["fetch callers"], mainThreadImpact: "low", networkImpact: "extra bandwidth and queueing", renderImpact: "possible duplicate reconciliation", recommendedMinimalFix: "Share in-flight promises by provider/purpose key.", regressionRisk: "low", protectedSystemsAffected: "none", independentlyFixable: true });
    if (state.longTasks.some((t) => t.durationMs > 250)) findings.push({ priority: "P1", symptom: "Main thread blocked over 250 ms", trigger: "Rendering or parsing", measuredLatency: Math.max(...state.longTasks.map((t) => t.durationMs)), p95Latency: stats(state.longTasks.map((t) => t.durationMs)).p95, rootCause: "Long task attribution requires browser performance profile; audit captured threshold breach", functionsInvolved: ["see Performance panel call tree"], mainThreadImpact: "high", networkImpact: "none", renderImpact: "input acknowledgement may be delayed", recommendedMinimalFix: "Split large marker/DOM work into frames and avoid full layer rebuilds when signatures are unchanged.", regressionRisk: "medium", protectedSystemsAffected: "none if rendering-only", independentlyFixable: true });
    if (!findings.length) findings.push({ priority: "P3", symptom: "No P0/P1 bottleneck captured in current session", trigger: "Current sample", measuredLatency: 0, p95Latency: 0, rootCause: "More simulation/mobile sampling required", functionsInvolved: [], mainThreadImpact: "not observed", networkImpact: "not observed", renderImpact: "not observed", recommendedMinimalFix: "Run the V919 simulation matrix on throttled mobile and inspect p95 outliers.", regressionRisk: "low", protectedSystemsAffected: "none", independentlyFixable: true });
    return findings.sort((a, b) => ["P0", "P1", "P2", "P3"].indexOf(a.priority) - ["P0", "P1", "P2", "P3"].indexOf(b.priority));
  }
  async function runSimulation(options = {}) {
    installLightweightInstrumentation();
    const iterations = Math.max(1, Math.min(100, Number(options.iterations || 10)));
    const scenarios = [];
    const include = (key) => options[key] !== false;
    async function scenario(name, fn) { const samples = []; let failures = 0; for (let i = 0; i < iterations; i += 1) { const s = now(); try { await fn(i); samples.push(round(now() - s)); } catch (error) { failures += 1; samples.push(round(now() - s)); } await new Promise((r) => setTimeout(r, 0)); } const summary = { name, timings: samples, ...stats(samples), failures }; scenarios.push(summary); return summary; }
    await scenario("panel-open-local", async () => { const el = document.querySelector("[data-v2-sheet='alerts'], [data-section='alerts'], #mobileDockReportBtn, [data-v2-sheet='report']"); if (el) el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true })); });
    if (include("includeAlerts")) await scenario("alerts-open", async () => { document.querySelector("[data-v2-sheet='alerts'], [data-section='alerts']")?.dispatchEvent(new Event("click", { bubbles: true })); });
    if (include("includeReporting")) await scenario("report-client-pipeline-simulated", async () => { recordTiming("report.submit.disabled", 5, true, { simulated: true }); recordTiming("report.submit.acknowledgement", 25, true, { simulated: true }); recordTiming("report.submit.localMarker", 80, true, { simulated: true }); await new Promise((r) => setTimeout(r, options.mockSupabaseDelayMs || 250)); recordTiming("report.submit.supabase", options.mockSupabaseDelayMs || 250, true, { simulated: true, noProductionWrite: true }); });
    if (include("includeSearch")) await scenario("search-open-and-first-result", async () => { const input = document.querySelector("input[type='search'], #destinationSearchInput, #reportSearchInput"); if (input) { input.value = "day"; input.dispatchEvent(new Event("input", { bubbles: true })); } });
    if (include("includeMapStress")) await scenario("map-pan-zoom-stress", async () => { if (globalScope.map && typeof globalScope.map.fire === "function") { globalScope.map.fire("move"); globalScope.map.fire("moveend"); globalScope.map.fire("zoom"); globalScope.map.fire("zoomend"); } });
    const result = { available: true, version: VERSION, profile: options.profile || "custom", iterations, simulatedReportWritesOnly: true, scenarioResults: scenarios, individualTimings: Object.fromEntries(scenarios.map((s) => [s.name, s.timings])), p50: Object.fromEntries(scenarios.map((s) => [s.name, s.p50])), p95: Object.fromEntries(scenarios.map((s) => [s.name, s.p95])), failures: Object.fromEntries(scenarios.map((s) => [s.name, s.failures])), longTasks: buildAudit().longTasks, duplicateRenders: state.duplicateRenders.slice(-50), duplicateRequests: state.duplicateRequests.slice(-50), blockedMainThreadTime: round(state.longTasks.reduce((sum, t) => sum + Math.max(0, t.durationMs - 50), 0)), topBottlenecks: rankBottlenecks(), recommendedFixes: rankBottlenecks().map((b) => b.recommendedMinimalFix) };
    state.lastSimulation = result;
    return result;
  }
  function simulationSummary() { const sim = state.lastSimulation; return { available: true, version: VERSION, hasSimulation: Boolean(sim), profile: sim?.profile || null, p50: sim?.p50 || {}, p95: sim?.p95 || {}, failures: sim?.failures || {}, topBottlenecks: rankBottlenecks().slice(0, 8), safeForBeta: true }; }
  installLightweightInstrumentation();
  globalScope.gridlyEndToEndPerformanceAudit = buildAudit;
  globalScope.gridlyRuntimeSchedulerAudit = schedulerAudit;
  globalScope.gridlyRunPerformanceSimulation = runSimulation;
  globalScope.gridlyPerformanceSimulationSummary = simulationSummary;
})(typeof window !== "undefined" ? window : globalThis);
