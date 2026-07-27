(function attachHistoricalIntelligenceActivationBoundary(globalScope) {
  "use strict";

  const VERSION = "LP070.historical-intelligence-activation-boundary.v1";
  const LIVE_CONDITION_GUIDANCE = "Check current alerts for live conditions.";
  const NARRATIVE_TYPES = Object.freeze([
    "crossing_delay", "flooding", "construction", "congestion", "community_activity", "roadway_hazard"
  ]);
  const DTO_FIELDS = Object.freeze([
    "historicalTakeaway", "narrativeType", "subject", "historicalWindow",
    "liveConditionGuidance", "quiet", "displayEligible"
  ]);
  const ACTIVATION = Object.freeze({
    productionIntegration: false,
    consumerVisible: false,
    optInRequired: true,
    prerequisiteMilestones: Object.freeze(["LP067", "LP068", "LP069", "LP070", "future-presentation-milestone"])
  });
  const OWNERSHIP = Object.freeze({
    owner: "Know Before You Go Historical Intelligence surface",
    ownershipToken: "know-before-you-go-historical-intelligence",
    authorizedHost: '[data-gridly-owner="know-before-you-go-historical-intelligence"]',
    lifecycleOwner: "Know Before You Go Historical Intelligence surface",
    detachOwner: "Know Before You Go Historical Intelligence surface",
    renderingResponsibility: "owner-renders-one-approved-dto-or-no-container",
    interactionExpectation: "context-only-current-alerts-remain-authoritative",
    activationPrerequisite: "explicit-future-presentation-milestone"
  });
  const LOCAL_TIME_AUTHORITY = Object.freeze({
    source: "awareness-context",
    requiredInputs: Object.freeze(["now", "utcOffsetMinutes"]),
    consumerRule: "forward-authority-unchanged-no-derived-clock"
  });

  const cleanText = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const freezeWindow = (value) => Object.freeze({
    firstObservedAt: cleanText(value?.firstObservedAt),
    lastObservedAt: cleanText(value?.lastObservedAt)
  });

  function quietDto() {
    return Object.freeze({
      historicalTakeaway: null,
      narrativeType: null,
      subject: null,
      historicalWindow: null,
      liveConditionGuidance: null,
      quiet: true,
      displayEligible: false
    });
  }

  function createPresentationDto(rankingResult) {
    if (rankingResult?.status !== "selected" || rankingResult.productionIntegration !== false || rankingResult.consumerVisible !== false) {
      return quietDto();
    }
    const historicalTakeaway = cleanText(rankingResult.selectedNarrative);
    const narrativeType = cleanText(rankingResult.narrativeType);
    const subject = cleanText(rankingResult.subject);
    if (!historicalTakeaway || !subject || !NARRATIVE_TYPES.includes(narrativeType)) return quietDto();
    return Object.freeze({
      historicalTakeaway,
      narrativeType,
      subject,
      historicalWindow: freezeWindow(rankingResult.historicalWindow),
      liveConditionGuidance: LIVE_CONDITION_GUIDANCE,
      quiet: false,
      displayEligible: true
    });
  }

  function acceptLocalTimeAuthority(authority) {
    const now = cleanText(authority?.now);
    const offset = Number(authority?.utcOffsetMinutes);
    if (!now || !Number.isFinite(Date.parse(now)) || !Number.isFinite(offset)) return null;
    return Object.freeze({ now, utcOffsetMinutes: offset });
  }

  const api = Object.freeze({
    VERSION, DTO_FIELDS, ACTIVATION, OWNERSHIP, LOCAL_TIME_AUTHORITY,
    LIVE_CONDITION_GUIDANCE, quietDto, createPresentationDto, acceptLocalTimeAuthority
  });
  globalScope.gridlyHistoricalIntelligenceActivationBoundary = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
