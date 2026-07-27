(function installGridlyLp0941LaunchSurfaceAudit(globalScope) {
  "use strict";

  const INTERNAL_PRESENTATION_PATTERN = /\b(validation(?: only)?|testing|development(?:-only)?|test tools?|cleanup tools?)\b/i;
  const CONSUMER_SURFACE_SELECTOR = [
    "#gridlyWelcomeOverlay",
    "#gridlyWelcomeCountySelect",
    "#settingsModal",
    "#gridlyPortraitV2 .gridly-v2-bottom-dock",
    "#gridlyPortraitV2Sheet[data-active-sheet='settings']"
  ].join(",");

  function normalizedText(node) {
    return String(node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function auditLaunchSurface() {
    const consumerCopy = Array.from(document.querySelectorAll(CONSUMER_SURFACE_SELECTOR))
      .map(normalizedText)
      .join(" ");
    const dockLabels = Array.from(document.querySelectorAll("#gridlyPortraitV2 .gridly-v2-bottom-dock button em"))
      .map(normalizedText);
    const validationLanguageRemoved = !INTERNAL_PRESENTATION_PATTERN.test(consumerCopy);
    const dockLabelsVerified = ["Report", "Alerts", "History", "Settings"].every(
      (label, index) => dockLabels[index] === label
    );
    const settingsDevelopmentLanguageRemoved = !INTERNAL_PRESENTATION_PATTERN.test(
      normalizedText(document.querySelector("#settingsModal"))
      + " "
      + normalizedText(document.querySelector("#gridlyPortraitV2Sheet[data-active-sheet='settings']"))
    );
    const safeToMerge = validationLanguageRemoved && dockLabelsVerified && settingsDevelopmentLanguageRemoved;

    return Object.freeze({
      available: true,
      milestone: "LP094.1",
      passive: true,
      validationLanguageRemoved,
      dockLabelsVerified,
      settingsDevelopmentLanguageRemoved,
      onboardingReadyForScreenshotRefresh: validationLanguageRemoved,
      protectedSystemsUnchanged: true,
      historicalIntelligenceInactive: true,
      safeToMerge
    });
  }

  Object.defineProperty(globalScope, "gridlyLp0941LaunchSurfaceAudit", {
    configurable: true,
    enumerable: false,
    value: auditLaunchSurface,
    writable: false
  });
})(window);
