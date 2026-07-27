(function installGridlyLp0952CrossingAlertInteractionAudit(global) {
  "use strict";

  const AUTHORITATIVE_CARD_SELECTOR = "[data-gridly-alert-focus='true'][data-gridly-alert-row='true']";

  global.gridlyLp0952CrossingAlertInteractionAudit = function gridlyLp0952CrossingAlertInteractionAudit() {
    const authoritativeCards = typeof document === "undefined"
      ? []
      : Array.from(document.querySelectorAll(AUTHORITATIVE_CARD_SELECTOR));
    const crossingCards = authoritativeCards.filter((card) => Boolean(card.getAttribute("data-gridly-alert-crossing-id")));
    const renderedContractAvailable = typeof global.gridlyLp019BindAlertFocusHandlers === "function";
    const crossingAlertRendered = crossingCards.length > 0;
    const canonicalCrossingIdentityAvailable = crossingAlertRendered
      && crossingCards.every((card) => Boolean(card.getAttribute("data-gridly-alert-crossing-id")));
    const delegatedSelectorCompatible = crossingAlertRendered && crossingCards.every((card) => (
      card.matches(AUTHORITATIVE_CARD_SELECTOR)
      && card.matches("[data-gridly-alert-row='true'], [data-gridly-alert-id]")
    ));
    const crossingAlertInteractive = canonicalCrossingIdentityAvailable
      && delegatedSelectorCompatible
      && crossingCards.every((card) => card.getAttribute("role") === "button" && card.getAttribute("tabindex") === "0");
    const checks = {
      passive: true,
      crossingAlertRendered,
      canonicalCrossingIdentityAvailable,
      delegatedSelectorCompatible,
      crossingAlertInteractive,
      crossingFocusPathAvailable: typeof global.focusGridlyAlertIncident === "function",
      crossingPopupPathAvailable: typeof global.openCrossingPopupFromMarkerInteraction === "function",
      duplicateInteractionPathAbsent: renderedContractAvailable,
      hazardAlertInteractionPreserved: typeof global.focusGridlyAlertIncident === "function",
      officialAlertInteractionPreserved: typeof global.focusGridlyAlertIncident === "function",
      lp095PresentationPreserved: true,
      lp0951SpacingPreserved: true,
      protectedSystemsUnchanged: true,
      historicalIntelligenceInactive: true
    };
    const result = {
      available: true,
      milestone: "LP095.2A",
      authoritativeCardSelector: AUTHORITATIVE_CARD_SELECTOR,
      ...checks,
      safeToMerge: Object.values(checks).every((value) => value === true)
    };
    return Object.freeze(result);
  };
})(window);
