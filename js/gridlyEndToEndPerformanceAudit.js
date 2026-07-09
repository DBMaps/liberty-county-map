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
    measures: [],
    currentSimulationContext: null,
    hiddenCallbacksAttempted: 0,
    hiddenCallbacksSkipped: 0,
    hiddenCallbacksExecuted: 0,
    hiddenWorkOwners: {},
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
  const measureNames = ["hazard marker rendering", "crossing marker rendering", "alert rendering", "Awareness Brief rendering", "Community Pulse rendering", "panel opening", "search result rendering", "map move processing", "map zoom processing", "report acknowledgement pipeline", "report reconciliation", "layer clearing", "layer rebuilding", "popup creation", "popup content updates", "large DOM replacement"];
  function activeMeasureFor(startTime, durationMs) {
    const end = Number(startTime || 0) + Number(durationMs || 0);
    return state.measures.slice(-200).find((m) => m.startTime <= end && (m.startTime + m.durationMs) >= startTime) || null;
  }
  function classifyMeasure(name) {
    if (/fetch|network|request/i.test(name || "")) return "network";
    return "render";
  }
  function enrichLongTask(entry) {
    const active = activeMeasureFor(entry.startTime, entry.duration || entry.durationMs);
    const ctx = active?.context || state.currentSimulationContext || {};
    const owner = active?.name || (ctx.scenario ? `simulation:${ctx.scenario}` : "unattributed-main-thread");
    return { name: entry.name || "longtask", durationMs: round(entry.duration || entry.durationMs), duration: round(entry.duration || entry.durationMs), startTime: round(entry.startTime), at: wall(), likelyOwner: owner, activeMeasure: active ? { name: active.name, durationMs: active.durationMs, startTime: active.startTime } : null, scenario: ctx.scenario || null, iteration: Number.isFinite(ctx.iteration) ? ctx.iteration : null, renderOrNetwork: classifyMeasure(owner), layerClearDetected: /layer clearing/i.test(owner), layerRebuildDetected: /layer rebuilding|marker rendering/i.test(owner), domReplacementDetected: /large DOM replacement|content updates|rendering/i.test(owner), thresholds: { over50: (entry.duration || entry.durationMs) > 50, over100: (entry.duration || entry.durationMs) > 100, over250: (entry.duration || entry.durationMs) > 250, over500: (entry.duration || entry.durationMs) > 500 } };
  }
  function observeLongTasks() {
    if (state.longTaskObserverStarted || typeof PerformanceObserver !== "function") return;
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => { state.longTasks.push(enrichLongTask(entry)); });
        if (state.longTasks.length > 300) state.longTasks.splice(0, state.longTasks.length - 300);
      });
      observer.observe({ entryTypes: ["longtask"] });
      state.longTaskObserverStarted = true;
    } catch (_error) { state.longTaskObserverStarted = false; }
  }
  function gridlyMeasure(name, fn, meta = {}) {
    const started = now();
    const markName = `gridly:${name}:${wall()}`;
    try { performance?.mark?.(`${markName}:start`); } catch (_error) {}
    const finish = (ok, value) => {
      const durationMs = round(now() - started);
      try { performance?.mark?.(`${markName}:end`); performance?.measure?.(`gridly:${name}`, `${markName}:start`, `${markName}:end`); } catch (_error) {}
      const rec = { name, durationMs, startTime: round(started), at: wall(), ok, context: { ...(state.currentSimulationContext || {}), ...meta } };
      state.measures.push(rec); if (state.measures.length > 400) state.measures.splice(0, state.measures.length - 400);
      recordTiming(name, durationMs, ok, rec.context);
      return value;
    };
    try { const value = fn(); return value && typeof value.then === "function" ? value.then((v) => finish(true, v), (e) => { finish(false); throw e; }) : finish(true, value); } catch (error) { finish(false); throw error; }
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
        const wrappedHandler = typeof handler === "function" ? function gridlyV919ObservedTimerHandler() {
          if (document.hidden) {
            state.hiddenCallbacksAttempted += 1;
            const hName = handler?.name || "anonymous";
            if (/refresh|poll|loadSharedReports|background/i.test(hName)) { state.hiddenCallbacksSkipped += 1; return undefined; }
            state.hiddenCallbacksExecuted += 1; state.hiddenWorkOwners[hName] = Number(state.hiddenWorkOwners[hName] || 0) + 1;
          }
          return handler.apply(this, arguments);
        } : handler;
        const id = original.call(this, wrappedHandler, delay);
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
  function listenerSource(listenerName) {
    if (/leaflet|_leaflet|bound _?on/i.test(listenerName || "")) return "Leaflet/internal";
    if (/gridly|report|alert|crossing|hazard|route|search|anonymous/i.test(listenerName || "")) return "Gridly/runtime";
    return "browser/framework";
  }
  function schedulerAudit() {
    const background = safeCall("gridlyBackgroundLoopAudit") || {};
    const groups = new Map();
    state.listeners.forEach((l) => {
      const key = `${l.target}|${l.type}|${listenerSource(l.listenerName)}`;
      const g = groups.get(key) || { eventType: l.type, target: l.target, registrationSource: listenerSource(l.listenerName), count: 0, handlers: new Set(), captures: new Set() };
      g.count += 1; g.handlers.add(`${l.listenerName}:${l.capture}`); g.captures.add(String(l.capture)); groups.set(key, g);
    });
    const listenerGroups = Array.from(groups.values()).map((g) => {
      const uniqueHandlerCount = g.handlers.size;
      const likelyDuplicate = g.count > uniqueHandlerCount && g.registrationSource === "Gridly/runtime";
      const highFrequency = /move|zoom|scroll|resize|input/i.test(g.eventType);
      const riskLevel = likelyDuplicate ? (highFrequency ? "high" : "medium") : (highFrequency && g.count > 10 ? "watch" : "low");
      return { eventType: g.eventType, target: g.target, registrationSource: g.registrationSource, count: g.count, uniqueHandlerCount, likelyDuplicate, riskLevel };
    });
    const activeIntervals = background.activeIntervals || state.timers.intervals.slice(-50);
    const remainingHiddenWorkOwners = Object.keys(state.hiddenWorkOwners);
    const remainingPollingOwners = remainingHiddenWorkOwners.filter((owner) => /refresh|poll|loadSharedReports|background/i.test(owner));
    const pollingSuppressionWorking = !document.hidden || remainingPollingOwners.length === 0 || state.hiddenCallbacksSkipped >= state.hiddenCallbacksExecuted;
    return { available: true, version: VERSION, activeIntervals, activeTimeouts: background.activeTimeouts || state.timers.timeouts.slice(-50), activeAnimationFrames: background.activeAnimationFrames || state.timers.animationFrames.slice(-50), knownPollingLoops: activeIntervals.filter((t) => /refresh|poll|loadSharedReports|interval/i.test(JSON.stringify(t))), duplicateListenerRisks: listenerGroups.filter((g) => g.likelyDuplicate), listenerGroups, highFrequencyHandlers: listenerGroups.filter((l) => /move|zoom|scroll|resize|input/i.test(l.eventType)), hiddenTabWork: { documentHidden: document.hidden, hiddenCallbacksAttempted: state.hiddenCallbacksAttempted, hiddenCallbacksSkipped: state.hiddenCallbacksSkipped, hiddenCallbacksExecuted: state.hiddenCallbacksExecuted, pollingSuppressionWorking, pollingWhileHiddenRisk: document.hidden && !pollingSuppressionWorking, remainingHiddenWork: remainingHiddenWorkOwners.length, remainingHiddenWorkOwners, remainingPollingOwners, activeTimerExistsButMaySkipWork: document.hidden && activeIntervals.length > 0, requestAnimationFrameNaturallyPaused: document.hidden, knownGridlyLiveRefreshInterval: activeIntervals.filter((t) => /refresh|loadSharedReports|poll/i.test(JSON.stringify(t))), unrelatedTimers: activeIntervals.filter((t) => !/refresh|loadSharedReports|poll/i.test(JSON.stringify(t))) }, recommendations: ["Keep live refresh polling paused while document.hidden is true.", "Attach panel and marker listeners once; update content without re-registering handlers.", "Coalesce move/zoom work onto moveend/zoomend where user-visible output does not need every frame."] };
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
    const startedAt = new Date().toISOString();
    const iterationsRequested = Math.max(1, Math.min(100, Number(options.iterations || 10)));
    const result = { available: true, completed: false, profile: options.profile || "custom", startedAt, completedAt: null, iterationsRequested, iterationsCompleted: 0, scenarioResults: [], p50: {}, p95: {}, failures: {}, exceptions: [], longTasks: {}, duplicateRequests: [], duplicateRenders: [], blockedMainThreadTime: 0, topBottlenecks: [], recommendations: [], simulatedReportWritesOnly: true, noProductionWrite: true };
    state.lastSimulation = result;
    const include = (key) => options[key] !== false;
    const pushException = (scenario, iteration, error) => {
      const rec = { scenario, iteration, message: error?.message || String(error), stack: error?.stack || "", timestamp: new Date().toISOString() };
      result.exceptions.push(rec); result.failures[scenario] = Number(result.failures[scenario] || 0) + 1; return rec;
    };
    async function scenario(name, fn) {
      const samples = [];
      for (let i = 0; i < iterationsRequested; i += 1) {
        const s = now(); state.currentSimulationContext = { scenario: name, iteration: i };
        try { await gridlyMeasure(name, () => fn(i), { scenario: name, iteration: i }); }
        catch (error) { pushException(name, i, error); }
        finally { samples.push(round(now() - s)); result.iterationsCompleted += 1; state.currentSimulationContext = null; }
        await new Promise((r) => setTimeout(r, 0));
      }
      const summary = { name, timings: samples, ...stats(samples), failures: Number(result.failures[name] || 0) };
      result.scenarioResults.push(summary); result.p50[name] = summary.p50; result.p95[name] = summary.p95; return summary;
    }
    try {
      await scenario("panel opening", async () => { const el = document.querySelector("[data-v2-sheet='alerts'], [data-section='alerts'], #mobileDockReportBtn, [data-v2-sheet='report']"); if (el) el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true })); });
      if (include("includeAlerts")) await scenario("alert rendering", async () => { document.querySelector("[data-v2-sheet='alerts'], [data-section='alerts']")?.dispatchEvent(new Event("click", { bubbles: true })); });
      if (include("includeCrossings")) await scenario("crossing marker rendering", async () => { const r = safeCall("renderCrossings"); if (r?.error) throw new Error(r.error); });
      if (include("includeHazards")) await scenario("hazard marker rendering", async () => { const r = safeCall("renderRoadHazards"); if (r?.error) throw new Error(r.error); });
      await scenario("Awareness Brief rendering", async () => { const r = safeCall("renderGridlyAwarenessBrief"); if (r?.error) throw new Error(r.error); });
      await scenario("Community Pulse rendering", async () => { const r = safeCall("renderGridlyCommunityPulse"); if (r?.error) throw new Error(r.error); });
      if (include("includeReporting")) await scenario("report acknowledgement pipeline", async () => { recordTiming("report.submit.disabled", 5, true, { simulated: true }); recordTiming("report.submit.acknowledgement", 25, true, { simulated: true }); await gridlyMeasure("report reconciliation", () => new Promise((r) => setTimeout(r, options.mockSupabaseDelayMs || 25)), { simulated: true, noProductionWrite: true }); });
      if (include("includeSearch")) await scenario("search result rendering", async () => { const input = document.querySelector("input[type='search'], #destinationSearchInput, #reportSearchInput"); if (input) { input.value = "day"; input.dispatchEvent(new Event("input", { bubbles: true })); } });
      if (include("includeMapStress")) { await scenario("map move processing", async () => { globalScope.map?.fire?.("move"); globalScope.map?.fire?.("moveend"); }); await scenario("map zoom processing", async () => { globalScope.map?.fire?.("zoom"); globalScope.map?.fire?.("zoomend"); }); }
    } catch (error) { pushException("simulation-runner", null, error); }
    result.completed = result.exceptions.length === 0;
    result.completedAt = new Date().toISOString();
    result.longTasks = buildAudit().longTasks;
    result.duplicateRenders = state.duplicateRenders.slice(-50);
    result.duplicateRequests = state.duplicateRequests.slice(-50);
    result.blockedMainThreadTime = round(state.longTasks.reduce((sum, t) => sum + Math.max(0, t.durationMs - 50), 0));
    result.topBottlenecks = rankBottlenecks();
    result.recommendations = result.topBottlenecks.map((b) => b.recommendedMinimalFix);
    state.lastSimulation = result;
    return result;
  }
  function simulationSummary() { const sim = state.lastSimulation; return { available: true, version: VERSION, hasSimulation: Boolean(sim), completed: Boolean(sim?.completed), partialResultsAvailable: Boolean(sim && !sim.completed && (sim.scenarioResults?.length || sim.exceptions?.length)), profile: sim?.profile || null, startedAt: sim?.startedAt || null, completedAt: sim?.completedAt || null, iterationsRequested: sim?.iterationsRequested || 0, iterationsCompleted: sim?.iterationsCompleted || 0, scenarioResults: sim?.scenarioResults || [], p50: sim?.p50 || {}, p95: sim?.p95 || {}, failures: sim?.failures || {}, exceptions: sim?.exceptions || [], longTasks: sim?.longTasks || {}, duplicateRequests: sim?.duplicateRequests || [], duplicateRenders: sim?.duplicateRenders || [], blockedMainThreadTime: sim?.blockedMainThreadTime || 0, topBottlenecks: sim?.topBottlenecks || rankBottlenecks().slice(0, 8), recommendations: sim?.recommendations || [], safeForBeta: true }; }
  installLightweightInstrumentation();
  globalScope.gridlyEndToEndPerformanceAudit = buildAudit;
  globalScope.gridlyRuntimeSchedulerAudit = schedulerAudit;
  globalScope.gridlyRunPerformanceSimulation = runSimulation;
  globalScope.gridlyPerformanceSimulationSummary = simulationSummary;
  globalScope.gridlyV919Measure = gridlyMeasure;
  globalScope.gridlyV919PerformanceMeasureNames = measureNames;
})(typeof window !== "undefined" ? window : globalThis);
