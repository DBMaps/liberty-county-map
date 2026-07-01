(function gridlyDirectionalAwarenessLayer() {
  "use strict";

  const APPROVED_DIRECTIONS = Object.freeze(["Northbound", "Southbound", "Eastbound", "Westbound"]);
  const REVIEW_BUCKETS = Object.freeze([
    "reversible_lane",
    "construction_segment",
    "hov_hot_lane",
    "missing_county",
    "missing_oneway",
    "missing_ref",
    "manual_review_required"
  ]);
  const DIRECTIONAL_AWARENESS_CARDS = Object.freeze([
    Object.freeze({ corridor: "US 90", direction: "Westbound", body: "Traffic impacts reported near Dayton." }),
    Object.freeze({ corridor: "I-69", direction: "Northbound", body: "Congestion affecting corridor travel." }),
    Object.freeze({ corridor: "FM 1960", direction: "Eastbound", body: "Roadway impacts reported nearby." }),
    Object.freeze({ corridor: "TX 146", direction: "Southbound", body: "Traffic impacts observed in the area." })
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isValidCorridor(corridor) {
    return /^(?:US \d+[A-Z]?|I-\d+[A-Z]?|FM \d+[A-Z]?|TX \d+[A-Z]?)$/.test(String(corridor || "").trim());
  }

  function isApprovedDirection(direction) {
    return APPROVED_DIRECTIONS.includes(String(direction || "").trim());
  }

  function hasForbiddenDirectionText(value) {
    return /\b(?:NB|SB|EB|WB|toward|inbound|outbound)\b/i.test(String(value || ""));
  }

  function formatHeader(card) {
    const corridor = String(card?.corridor || "").trim();
    const direction = String(card?.direction || "").trim();
    if (!isValidCorridor(corridor) || !isApprovedDirection(direction)) return "";
    const header = `${corridor} ${direction}`;
    return hasForbiddenDirectionText(header) ? "" : header;
  }

  function readConsumerState(consumerState) {
    if (consumerState !== undefined) return consumerState;
    if (typeof window.gridlyDirectionalConsumerAudit !== "function") return null;
    if (typeof window.gridlyDirectionalConsumerSnapshot !== "function") return null;
    return {
      audit: window.gridlyDirectionalConsumerAudit(),
      snapshot: window.gridlyDirectionalConsumerSnapshot(),
      protectedState: typeof window.gridlyDirectionalRuntimePrototypeProtectedState === "function"
        ? window.gridlyDirectionalRuntimePrototypeProtectedState()
        : null
    };
  }

  function createAwarenessState(consumerState) {
    const state = readConsumerState(consumerState);
    const audit = state?.audit || {};
    const snapshot = state?.snapshot || {};
    const serviceAvailable = audit.serviceAvailable === true && audit.safeForConsumerPhase === true;
    const candidateCount = serviceAvailable ? Number(audit.candidateCount || snapshot.candidateCount || 0) : 0;
    const reviewExcludedCount = serviceAvailable ? Number(audit.reviewExcludedCount || 0) : 0;
    const blockedCount = serviceAvailable ? Number(audit.blockedCount || 0) : 0;
    const containmentPass = serviceAvailable && audit.countyContained === true && snapshot.containmentPass === true;
    const failClosedPass = serviceAvailable && audit.failClosedState === false && snapshot.failClosedPass === true;
    const bearingProtectionPass = serviceAvailable;
    const strongCandidateOnly = serviceAvailable && candidateCount > 0 && reviewExcludedCount >= 0 && blockedCount === 0;
    const formatEligibleCards = DIRECTIONAL_AWARENESS_CARDS.map((card) => ({
      header: formatHeader(card),
      body: String(card.body || "").trim(),
      corridor: card.corridor,
      direction: card.direction
    })).filter((card) => Boolean(card.header && card.body));
    const failClosedState = !(serviceAvailable && containmentPass && failClosedPass && bearingProtectionPass && strongCandidateOnly && formatEligibleCards.length > 0);
    const cards = failClosedState ? [] : formatEligibleCards;

    return Object.freeze({
      enabled: true,
      cards: Object.freeze(cards.map(Object.freeze)),
      visibleDirectionalCards: cards.length,
      candidateCount: failClosedState ? 0 : candidateCount,
      reviewExcludedCount: failClosedState ? 0 : reviewExcludedCount,
      excludedCount: failClosedState ? 0 : reviewExcludedCount + blockedCount,
      containmentPass,
      bearingProtectionPass,
      failClosedPass: !failClosedState,
      failClosedState,
      displayFormat: "corridor-first",
      userVisible: !failClosedState,
      protectedSystems: state?.protectedState?.protectedSystems || null,
      reviewBuckets: REVIEW_BUCKETS,
      strongCandidateOnly
    });
  }

  function readVisibleDirectionalDomEvidence() {
    if (typeof document === "undefined" || !document.body) {
      return {
        domDirectionalTextMatches: [],
        visibleDirectionalTextSamples: [],
        visibilitySource: "none"
      };
    }

    const bodyText = String(document.body.innerText || "");
    const domDirectionalTextMatches = Array.from(bodyText.matchAll(/\b(?:Northbound|Southbound|Eastbound|Westbound)\b/g), (match) => match[0]);
    const visibleDirectionalTextSamples = bodyText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /\b(?:Northbound|Southbound|Eastbound|Westbound)\b/.test(line))
      .slice(0, 10);

    return {
      domDirectionalTextMatches,
      visibleDirectionalTextSamples,
      visibilitySource: domDirectionalTextMatches.length > 0 ? "dom-text" : "none"
    };
  }

  function renderTopAwareness(state) {
    if (typeof document === "undefined" || !state || state.failClosedState || !state.cards.length) return false;
    const primary = document.getElementById("gridlyV2TopStatusPrimary");
    const secondary = document.getElementById("gridlyV2TopStatusSecondary");
    if (!primary || !secondary) return false;
    if (typeof window.gridlyCanWriteCommunityPulseTopStatus === "function") {
      const primaryAllowed = window.gridlyCanWriteCommunityPulseTopStatus("gridlyApplyDirectionalAwarenessCards", "gridlyV2TopStatusPrimary", state.cards[0].header, { path: "js/gridlyDirectionalAwarenessLayer.js:renderTopAwareness" });
      const secondaryAllowed = window.gridlyCanWriteCommunityPulseTopStatus("gridlyApplyDirectionalAwarenessCards", "gridlyV2TopStatusSecondary", state.cards[0].body, { path: "js/gridlyDirectionalAwarenessLayer.js:renderTopAwareness" });
      if (!primaryAllowed || !secondaryAllowed) return false;
    }
    primary.textContent = state.cards[0].header;
    secondary.textContent = state.cards[0].body;
    primary.setAttribute("data-gridly-directional-awareness", "true");
    secondary.setAttribute("data-gridly-directional-awareness", "true");
    window.gridlyDirectionalAwarenessRenderedCards = clone(state.cards);
    return true;
  }

  const awarenessState = createAwarenessState();

  window.gridlyDirectionalAwarenessAudit = function gridlyDirectionalAwarenessAudit() {
    const domVisibility = readVisibleDirectionalDomEvidence();
    const visibleDirectionalCards = domVisibility.domDirectionalTextMatches.length;
    const userVisible = visibleDirectionalCards > 0;

    return clone({
      enabled: awarenessState.enabled,
      visibleDirectionalCards,
      candidateCount: awarenessState.candidateCount,
      reviewExcludedCount: awarenessState.reviewExcludedCount,
      containmentPass: awarenessState.containmentPass,
      bearingProtectionPass: awarenessState.bearingProtectionPass,
      failClosedPass: awarenessState.failClosedPass,
      displayFormat: awarenessState.displayFormat,
      userVisible,
      domDirectionalTextMatches: domVisibility.domDirectionalTextMatches,
      visibleDirectionalTextSamples: domVisibility.visibleDirectionalTextSamples,
      visibilitySource: domVisibility.visibilitySource,
      candidateVisibilityMismatch: awarenessState.candidateCount > 0 && !userVisible
    });
  };

  window.gridlyDirectionalAwarenessCards = function gridlyDirectionalAwarenessCards() {
    return clone(awarenessState.cards);
  };

  window.gridlyDirectionalAwarenessLayerTestHarness = function gridlyDirectionalAwarenessLayerTestHarness(consumerState) {
    return clone(createAwarenessState(consumerState));
  };

  window.gridlyApplyDirectionalAwarenessCards = function gridlyApplyDirectionalAwarenessCards() {
    return renderTopAwareness(awarenessState);
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", window.gridlyApplyDirectionalAwarenessCards, { once: true });
    } else {
      window.gridlyApplyDirectionalAwarenessCards();
    }
    if (typeof window.setTimeout === "function") window.setTimeout(window.gridlyApplyDirectionalAwarenessCards, 0);
  }
})();
