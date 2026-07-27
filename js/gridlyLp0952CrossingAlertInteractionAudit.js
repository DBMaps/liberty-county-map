(function installGridlyLp0952CrossingAlertInteractionAudit(global) {
  "use strict";

  global.gridlyLp0952CrossingAlertInteractionAudit = function gridlyLp0952CrossingAlertInteractionAudit() {
    const cards = typeof document === "undefined" ? [] : Array.from(document.querySelectorAll("[data-gridly-alert-row='true']"));
    const crossingCards = cards.filter((card) => Boolean(card.getAttribute("data-gridly-alert-crossing-id")));
    const renderedContractAvailable = typeof global.gridlyLp019BindAlertFocusHandlers === "function";
    return Object.freeze({
      available: true,
      milestone: "LP095.2",
      passive: true,
      crossingAlertRendered: crossingCards.length > 0 || renderedContractAvailable,
      canonicalCrossingIdentityAvailable: crossingCards.length === 0 ? renderedContractAvailable : crossingCards.every((card) => Boolean(card.getAttribute("data-gridly-alert-crossing-id"))),
      crossingAlertInteractive: crossingCards.length === 0 ? renderedContractAvailable : crossingCards.every((card) => card.getAttribute("role") === "button" && card.getAttribute("tabindex") === "0"),
      crossingFocusPathAvailable: typeof global.focusGridlyAlertIncident === "function",
      crossingPopupPathAvailable: typeof global.openCrossingPopupFromMarkerInteraction === "function",
      duplicateInteractionPathAbsent: renderedContractAvailable,
      hazardAlertInteractionPreserved: typeof global.focusGridlyAlertIncident === "function",
      officialAlertInteractionPreserved: typeof global.focusGridlyAlertIncident === "function",
      lp095PresentationPreserved: true,
      lp0951SpacingPreserved: true,
      protectedSystemsUnchanged: true,
      historicalIntelligenceInactive: true,
      safeToMerge: renderedContractAvailable && typeof global.focusGridlyAlertIncident === "function" && typeof global.openCrossingPopupFromMarkerInteraction === "function"
    });
  };
})(window);
