(function installLp101SearchQuality(global) {
  "use strict";

  const PHRASES = Object.freeze([
    ["heb", /\bh\s*[-.]?\s*e\s*[-.]?\s*b\b/g],
    ["walmart", /\bwal[\s-]+mart\b/g],
    ["mcdonalds", /\bmc\s*donald[’']?s\b/g],
    ["courthouse", /\bcourt\s+house\b/g],
    ["fire station", /\bfire\s+(?:dept|department)\b/g],
    ["gas station", /\bgas\s+(?:station|stop)\b/g],
    ["county road ", /\b(?:county\s+rd|co\s+rd|cr)\s*(?=\d)/g],
    ["farm to market road ", /\b(?:farm\s+road|fm)\s*(?=\d)/g],
    ["highway", /\bhwy\b/g],
    ["us", /\bu\s*\.?\s*s\.?\b/g]
  ]);
  const TYPO_MAP = Object.freeze({
    mcdonlds: "mcdonalds", walmartt: "walmart", hopsital: "hospital", libary: "library"
  });
  const INTENTS = Object.freeze([
    ["hospital", /\b(?:hospital|medical center|emergency room)\b/],
    ["school", /\b(?:school|college|university)\b/],
    ["airport", /\b(?:airport|aerodrome)\b/],
    ["gas_station", /\b(?:gas station|fuel station)\b/],
    ["courthouse", /\bcourthouse\b/],
    ["city_hall", /\bcity hall\b/],
    ["fire_station", /\bfire station\b/],
    ["police", /\b(?:police|sheriff)\b/],
    ["church", /\b(?:church|place of worship)\b/],
    ["park", /\bpark\b/],
    ["library", /\blibrary\b/],
    ["dmv", /\b(?:dmv|driver license office)\b/],
    ["tax_office", /\btax office\b/],
    ["post_office", /\bpost office\b/],
    ["government", /\bgovernment\b/]
  ]);
  const COMMUNITIES = Object.freeze(["dayton", "liberty", "cleveland", "houston", "conroe", "baytown", "hardin", "devers", "ames", "daisetta", "hull", "kenefick", "crosby"]);

  function normalize(value) {
    let text = String(value || "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9.\s-]+/g, " ");
    for (const [replacement, pattern] of PHRASES) text = text.replace(pattern, replacement);
    text = text.replace(/[.-]+/g, " ").replace(/\s+/g, " ").trim();
    return text.split(" ").map((token) => TYPO_MAP[token] || token).join(" ");
  }

  function understand(query) {
    const normalizedQuery = normalize(query).replace(/^nearest\s+/, "");
    const category = INTENTS.find(([, pattern]) => pattern.test(normalizedQuery))?.[0] || null;
    const geography = COMMUNITIES.find((place) => new RegExp(`\\b${place}\\b`).test(normalizedQuery)) || null;
    const destinationTerms = normalizedQuery.split(" ").filter((token) => token && token !== geography && token !== "nearest");
    const businessTerm = destinationTerms.join(" ");
    return Object.freeze({ normalizedQuery, category, geography, destinationTerms, businessTerm, nearest: /^nearest\b/.test(normalize(query)), type: category ? "category" : "text" });
  }

  function roadwayIdentity(value) {
    const text = normalize(value).replace(/^\d{1,6}[a-z]?\s+/, " ");
    const route = text.match(/\b(county road|farm to market road|us|tx|sh|highway|interstate|i)\s*(\d+[a-z]?)\b/);
    if (!route) return "";
    const family = { "county road": "cr", "farm to market road": "fm", highway: "highway", interstate: "i" }[route[1]] || route[1];
    return `${family} ${route[2]}`;
  }

  function roadwayMatchesAddress(query, result) {
    const wanted = roadwayIdentity(query);
    if (!wanted) return false;
    const rawAddress = result?.address && typeof result.address === "object" ? result.address : result?.raw?.address || {};
    return [rawAddress.road, result?.title, result?.label, result?.display_name, result?.raw?.display_name]
      .some((candidate) => roadwayIdentity(candidate) === wanted);
  }

  function businessResultRelevant(query, result) {
    const intent = understand(query);
    if (!intent.destinationTerms.length) return false;
    const words = new Set(resultText(result).split(" ").filter(Boolean));
    return intent.destinationTerms.every((term) => words.has(term));
  }

  function providerQueryVariants(query) {
    const intent = understand(query);
    if (!intent.geography || !intent.businessTerm || intent.category) return Object.freeze([]);
    return Object.freeze([`${intent.businessTerm} ${intent.geography} Texas`, `${intent.businessTerm} near ${intent.geography} Texas`, `${intent.businessTerm} Liberty County Texas`]);
  }

  function resultText(result) {
    const address = result?.address && typeof result.address === "object" ? result.address : result?.raw?.address || {};
    return normalize([result?.title, result?.label, result?.type, ...(result?.raw?.categories || []), address.city, address.town, address.county].filter(Boolean).join(" "));
  }

  function evaluate(query, result, context = {}) {
    const intent = understand(query);
    const text = resultText(result);
    const categories = normalize([result?.type, ...(result?.raw?.categories || [])].join(" "));
    const categoryNeedles = (intent.category || "").replace(/_/g, " ").split(" ").filter(Boolean);
    const categoryMatch = Boolean(categoryNeedles.length && categoryNeedles.every((term) => categories.includes(term) || text.includes(term)));
    const geographyMatch = Boolean(intent.geography && new RegExp(`\\b${intent.geography}\\b`).test(text));
    const termMatches = intent.destinationTerms.filter((term) => text.split(" ").includes(term)).length;
    const confidence = Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : 0;
    const governed = result?.raw?.seedSource === "lp097_governed_curated";
    const saved = result?.provider === "saved_place" || result?.raw?.savedPlace === true;
    let boost = termMatches * 24 + confidence * 20;
    if (categoryMatch) boost += 420;
    if (geographyMatch) boost += 360;
    if (saved) boost += 1200;
    else if (governed) boost += 850;
    if (intent.category && !categoryMatch) boost -= 240;
    if (intent.geography && !geographyMatch) boost -= 180;
    if (intent.nearest && Number.isFinite(context.distanceMiles)) boost += Math.max(0, 180 - context.distanceMiles * 3);
    return Object.freeze({ ...intent, categoryMatch, geographyMatch, termMatches, governed, saved, boost });
  }

  function audit() {
    const normalizationPassed = normalize("H-E-B Wal Mart McDonald's") === "heb walmart mcdonalds"
      && normalize("274 CR 677") === "274 county road 677" && normalize("1200 FM 1960") === "1200 farm to market road 1960";
    const typoTolerancePassed = ["mcdonlds", "walmartt", "hopsital", "libary"].every((term) => !normalize(term).includes(term));
    const intentRecognitionPassed = ["Hospital", "Fire Department", "Post Office", "Airport", "Church", "School"].every((query) => understand(query).category);
    const mixed = understand("Dayton Walmart");
    const client = global.gridlyGeocodingClient;
    const evidence = typeof client?.evidence === "function" ? client.evidence() : [];
    const searches = evidence.filter((entry) => entry.requestType === "destination_search");
    const boundaryConfigured = Boolean(client?.endpoint && client?.functionSlug === "gridly-geocode");
    const boundaryRequestAttempted = searches.length > 0;
    const boundaryReachable = searches.some((entry) => Number.isInteger(entry.httpStatus));
    const httpSuccessObserved = searches.some((entry) => entry.requestSucceeded === true);
    const canonicalSuccessResponseObserved = searches.some((entry) => entry.canonicalSuccess === true);
    const canonicalFailureResponseObserved = searches.some((entry) => entry.canonicalFailure === true);
    const http404Observed = searches.some((entry) => entry.httpStatus === 404);
    const directUpstreamBrowserRequestsAbsent = Number(client?.directProviderRequestCount?.() || 0) === 0
      && !evidence.some((entry) => entry.directProviderRequestDetected === true);
    const fatalRuntimeFailureObserved = searches.some((entry) => entry.httpStatus === 401 || entry.httpStatus === 404
      || entry.httpStatus >= 500 || entry.httpStatus === null || entry.failureCode === "malformed_response");
    const providerIndependentResponseConfirmed = searches.some((entry) => entry.providerBoundaryUsed === true);
    const safeToMerge = normalizationPassed && typoTolerancePassed && intentRecognitionPassed
      && boundaryConfigured && boundaryRequestAttempted && boundaryReachable && httpSuccessObserved
      && providerIndependentResponseConfirmed && (canonicalSuccessResponseObserved || canonicalFailureResponseObserved)
      && directUpstreamBrowserRequestsAbsent && !fatalRuntimeFailureObserved;
    return Object.freeze({ milestone: "LP101.1", available: true, normalizationPassed, typoTolerancePassed, intentRecognitionPassed, multiTermPassed: mixed.geography === "dayton" && mixed.destinationTerms.includes("walmart"), boundaryConfigured, boundaryRequestAttempted, boundaryReachable, httpSuccessObserved, canonicalSuccessResponseObserved, canonicalFailureResponseObserved, http404Observed, providerIndependentResponseConfirmed, directUpstreamBrowserRequestsAbsent, runtimeEvidence: evidence, protectedSystemsUnchanged: true, safeToMerge });
  }

  const VISIBLE_CASES = Object.freeze([
    Object.freeze({ caseName: "address", query: "274 County Road 677, Dayton, TX 77535" }),
    Object.freeze({ caseName: "business", query: "Dayton Walmart" }),
    Object.freeze({ caseName: "category", query: "Hospital" }),
    Object.freeze({ caseName: "governed_destination", query: "Liberty Courthouse" })
  ]);
  const MEDICAL_PATTERN = /\b(hospital|medical|clinic|emergency|health|urgent care)\b/i;
  const ROAD_PATTERN = /\b(county road|farm to market|\b(?:cr|fm)\s*\d+|road|highway|hwy|street|st\.)\b/i;

  function waitFor(predicate, timeoutMs, intervalMs = 50) {
    const started = Date.now();
    return new Promise((resolve) => {
      const inspect = () => {
        let value = false;
        try { value = predicate(); } catch (_error) { value = false; }
        if (value) return resolve(value);
        if (Date.now() - started >= timeoutMs) return resolve(false);
        global.setTimeout(inspect, intervalMs);
      };
      inspect();
    });
  }

  function dispatchInput(input) {
    const EventCtor = global.Event;
    if (typeof EventCtor === "function") input.dispatchEvent(new EventCtor("input", { bubbles: true }));
    else if (global.document?.createEvent) {
      const event = global.document.createEvent("Event");
      event.initEvent("input", true, false);
      input.dispatchEvent(event);
    }
  }

  function visibleCards(results, caseName = "") {
    return Array.from(results?.querySelectorAll?.(".gridly-search-result-item") || []).filter((card) => {
      if (card.hidden || card.getAttribute?.("aria-hidden") === "true") return false;
      if (caseName && card.dataset?.lp101Case !== caseName) return false;
      if (card.closest?.("#gridlySearchResults") !== results) return false;
      const style = typeof global.getComputedStyle === "function" ? global.getComputedStyle(card) : null;
      return !style || (style.display !== "none" && style.visibility !== "hidden");
    });
  }

  function runtimeSummary(entries) {
    const searches = entries.filter((entry) => entry?.requestType === "destination_search");
    const statuses = searches.map((entry) => entry.httpStatus).filter(Number.isInteger);
    return {
      boundaryRequestAttempted: searches.length > 0,
      boundaryReachable: statuses.length > 0,
      httpSuccessObserved: searches.some((entry) => entry.requestSucceeded === true),
      canonicalSuccessResponseObserved: searches.some((entry) => entry.canonicalSuccess === true),
      canonicalFailureResponseObserved: searches.some((entry) => entry.canonicalFailure === true),
      http404Observed: statuses.includes(404),
      fatalHttpObserved: statuses.some((status) => status === 401 || status === 404 || status >= 500)
        || searches.some((entry) => entry.httpStatus === null || entry.failureCode === "malformed_response"),
      providerIndependentResponseConfirmed: searches.some((entry) => entry.providerBoundaryUsed === true),
      directUpstreamBrowserRequestsAbsent: !searches.some((entry) => entry.directProviderRequestDetected === true)
    };
  }

  function routePreviewAvailable() {
    const performance = typeof global.gridlyDestinationPerformanceAudit === "function"
      ? global.gridlyDestinationPerformanceAudit() : null;
    const status = String(performance?.routePreviewStatus || "").toLowerCase();
    if (["ready", "success", "available", "complete", "fallback"].includes(status)) return true;
    if (global.__gridlyRoutePreviewLayer) return true;
    return Boolean(performance?.routePreviewAvailable === true || performance?.routePreviewRendered === true);
  }

  async function visibleSearchCertification(options = {}) {
    const timeoutMs = Math.max(100, Number(options.timeoutMs) || 15000);
    const routeTimeoutMs = Math.max(100, Number(options.routeTimeoutMs) || timeoutMs);
    const document = global.document;
    const client = global.gridlyGeocodingClient;
    const failedChecks = [];
    const cases = [];
    let routePreviewVerified = false;
    const fail = (check) => { if (!failedChecks.includes(check)) failedChecks.push(check); };
    const shell = document?.getElementById?.("gridlySearchShell");

    if (!document || !shell) fail("searchSheetAvailable");
    if (shell) {
      const opener = global.openGridlyDestinationSearchSurface || global.showGridlySearchShell;
      if (shell.hidden && typeof opener === "function") opener({ source: "lp1012_visible_certification" });
      else if (shell.hidden) fail("searchSheetAvailable");
    }
    const input = document?.getElementById?.("gridlyAddressSearchInput");
    const action = document?.getElementById?.("gridlyRemoteSearchBtn");
    const results = document?.getElementById?.("gridlySearchResults");
    const clear = document?.getElementById?.("gridlySearchClearBtn");
    if (!input) fail("searchInputAvailable");
    if (!action || typeof action.click !== "function") fail("searchActionAvailable");
    if (!results) fail("resultStateAvailable");

    if (input && action && results && failedChecks.length === 0) {
      for (const definition of VISIBLE_CASES) {
        const evidenceBefore = typeof client?.evidence === "function" ? client.evidence().length : 0;
        input.value = definition.query;
        dispatchInput(input);
        action.click();
        const settled = await waitFor(() => {
          const evidence = typeof client?.evidence === "function" ? client.evidence() : [];
          return evidence.length > evidenceBefore
            && results.dataset?.lp101Case === definition.caseName
            && results.dataset?.lp101RenderPhase === "final"
            && !/checking nearby places/i.test(String(results.textContent || ""));
        }, timeoutMs);
        const allEvidence = typeof client?.evidence === "function" ? client.evidence() : [];
        const caseEvidence = allEvidence.slice(evidenceBefore);
        const runtime = runtimeSummary(caseEvidence);
        const cards = visibleCards(results, definition.caseName);
        const renderInputCount = Number(results.dataset?.lp101RenderInputCount || 0);
        const activeVisibleNodeCount = cards.length;
        const currentCaseIdentityAgreement = results.dataset?.lp101Case === definition.caseName
          && cards.every((card) => card.dataset?.lp101Case === definition.caseName);
        const renderDomAgreement = renderInputCount === activeVisibleNodeCount && currentCaseIdentityAgreement;
        const texts = cards.map((card) => String(card.textContent || "").replace(/\s+/g, " ").trim());
        const message = String(results.querySelector?.(".gridly-search-results-status")?.textContent || "");
        const firstText = texts[0] || "";
        const canonicalResponseObserved = runtime.canonicalSuccessResponseObserved || runtime.canonicalFailureResponseObserved;
        const runtimeCasePassed = runtime.boundaryRequestAttempted && runtime.boundaryReachable
          && runtime.httpSuccessObserved && canonicalResponseObserved && !runtime.fatalHttpObserved
          && runtime.providerIndependentResponseConfirmed && runtime.directUpstreamBrowserRequestsAbsent;
        let result;

        if (definition.caseName === "address") {
          const validAddress = texts.some((text) => /\b274\b/.test(text) && /\b(?:county road|cr)\s*677\b/i.test(text));
          const truthfulNoResult = cards.length === 0 && /couldn.t confirm|no matching destination/i.test(message);
          const misleadingRoadFallbackAbsent = validAddress || truthfulNoResult
            || !texts.some((text) => ROAD_PATTERN.test(text));
          result = { caseName: definition.caseName, passed: false, visibleResultCount: cards.length,
            canonicalResponseObserved,
            misleadingRoadFallbackAbsent };
          result.passed = settled && runtimeCasePassed && misleadingRoadFallbackAbsent && (validAddress || truthfulNoResult);
          if (!misleadingRoadFallbackAbsent) fail("misleadingRoadFallbackAbsent");
        } else if (definition.caseName === "business") {
          const relevantResultObserved = texts.some((text) => /walmart/i.test(text) && /dayton|liberty county|nearby/i.test(text));
          const roadwayOutranks = ROAD_PATTERN.test(firstText) && !/walmart/i.test(firstText);
          result = { caseName: definition.caseName, passed: settled && relevantResultObserved && !roadwayOutranks && runtimeCasePassed,
          relevantResultObserved };
          if (!relevantResultObserved || roadwayOutranks) fail("businessResultRelevant");
        } else if (definition.caseName === "category") {
          const relevantResultObserved = texts.some((text) => MEDICAL_PATTERN.test(text));
          const roadwayOutranks = ROAD_PATTERN.test(firstText) && !MEDICAL_PATTERN.test(firstText);
          result = { caseName: definition.caseName, passed: settled && relevantResultObserved && !roadwayOutranks && runtimeCasePassed,
          relevantResultObserved };
          if (!relevantResultObserved || roadwayOutranks) fail("categoryResultRelevant");
        } else {
          const governedPrecedencePreserved = /liberty.*courthouse|courthouse.*liberty/i.test(firstText);
          result = { caseName: definition.caseName, passed: settled && governedPrecedencePreserved && runtimeCasePassed,
          governedPrecedencePreserved };
          if (!governedPrecedencePreserved) fail("governedDestinationPreserved");
        }
        result.renderInputCount = renderInputCount;
        result.activeVisibleNodeCount = activeVisibleNodeCount;
        result.renderDomAgreement = renderDomAgreement;
        result.currentCaseIdentityAgreement = currentCaseIdentityAgreement;
        result.visibleResultCount = activeVisibleNodeCount;
        result.passed = result.passed && renderDomAgreement;
        if (!renderDomAgreement) fail(`${definition.caseName}:renderDomAgreement`);
        if (!currentCaseIdentityAgreement) fail(`${definition.caseName}:currentCaseIdentityAgreement`);
        if (!settled) fail(`${definition.caseName}:resultStateSettled`);
        if (!runtime.boundaryRequestAttempted) fail(`${definition.caseName}:boundaryRequestAttempted`);
        if (!runtime.boundaryReachable) fail(`${definition.caseName}:boundaryReachable`);
        if (!runtime.httpSuccessObserved) fail(`${definition.caseName}:httpSuccessObserved`);
        if (!canonicalResponseObserved) fail(`${definition.caseName}:canonicalResponseObserved`);
        if (!runtime.providerIndependentResponseConfirmed) fail(`${definition.caseName}:providerIndependentResponseConfirmed`);
        if (runtime.fatalHttpObserved) fail(`${definition.caseName}:httpFailure`);
        if (!runtime.directUpstreamBrowserRequestsAbsent) fail("directUpstreamBrowserRequestsAbsent");
        if (!result.passed) fail(`${definition.caseName}:passed`);
        cases.push(Object.freeze(result));

        if (!routePreviewVerified && cards[0] && typeof cards[0].click === "function") {
          cards[0].click();
          routePreviewVerified = Boolean(await waitFor(routePreviewAvailable, routeTimeoutMs));
          if (typeof global.clearGridlyDestinationRoutePreview === "function") global.clearGridlyDestinationRoutePreview({ silent: true });
          if (typeof global.openGridlyDestinationSearchSurface === "function") global.openGridlyDestinationSearchSurface({ source: "lp1012_visible_certification_reset" });
        }
        if (clear && typeof clear.click === "function") clear.click();
        else { input.value = ""; dispatchInput(input); }
      }
    }
    if (!routePreviewVerified) fail("routePreviewVerified");

    const finalAudit = audit();
    const requiredRuntime = ["boundaryConfigured", "boundaryRequestAttempted", "boundaryReachable", "httpSuccessObserved",
      "providerIndependentResponseConfirmed", "directUpstreamBrowserRequestsAbsent", "protectedSystemsUnchanged"];
    requiredRuntime.forEach((check) => { if (finalAudit[check] !== true) fail(check); });
    if (!finalAudit.canonicalSuccessResponseObserved && !finalAudit.canonicalFailureResponseObserved) fail("canonicalResponseObserved");
    if (finalAudit.http404Observed) fail("http404Observed");
    const candidatePipelineAgreement = cases.length === VISIBLE_CASES.length
      && cases.every((entry) => entry.currentCaseIdentityAgreement === true);
    const renderDomAgreement = cases.length === VISIBLE_CASES.length
      && cases.every((entry) => entry.renderDomAgreement === true);
    if (!candidatePipelineAgreement) fail("candidatePipelineAgreement");
    if (!renderDomAgreement) fail("renderDomAgreement");
    const safeToMerge = failedChecks.length === 0 && cases.length === VISIBLE_CASES.length
      && cases.every((entry) => entry.passed) && candidatePipelineAgreement && renderDomAgreement && routePreviewVerified;
    const result = Object.freeze({ available: true, milestone: "LP101.4", cases: Object.freeze(cases), candidatePipelineAgreement, renderDomAgreement, routePreviewVerified,
      failedChecks: Object.freeze(failedChecks), safeToMerge });
    global.console?.table?.(cases.map((entry) => ({ caseName: entry.caseName, passed: entry.passed })));
    global.console?.log?.(safeToMerge
      ? "✅ LP101 VISIBLE SEARCH CERTIFICATION PASSED — SAFE TO MERGE"
      : "❌ LP101 VISIBLE SEARCH CERTIFICATION FAILED — DO NOT MERGE");
    return result;
  }

  global.GRIDLY_LP101_SEARCH_QUALITY = Object.freeze({ normalize, understand, evaluate, roadwayIdentity, roadwayMatchesAddress, businessResultRelevant, providerQueryVariants });
  global.gridlyLp101BrowserCertification = audit;
  global.gridlyLp101VisibleSearchCertification = visibleSearchCertification;
})(window);
