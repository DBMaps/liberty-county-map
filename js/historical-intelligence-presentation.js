(function attachHistoricalIntelligencePresentation(globalScope) {
  "use strict";

  const CONTRACT_ID = "LP070.historical-intelligence-activation-boundary.v1";
  const DTO_FIELDS = Object.freeze([
    "historicalTakeaway", "narrativeType", "subject", "historicalWindow",
    "liveConditionGuidance", "quiet", "displayEligible"
  ]);
  const ACTIVATION = Object.freeze({
    productionIntegration: false,
    consumerVisible: false,
    activationAuthorized: false,
    explicitOptInRequired: true,
    rollbackOwner: "Know Before You Go release owner",
    authorizedFutureOwner: "Know Before You Go Historical Intelligence surface",
    currentAlertAuthority: "Current alerts determine live conditions",
    approvedDtoVersion: CONTRACT_ID
  });

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const cleanText = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const exactContract = (dto) => dto && JSON.stringify(Object.keys(dto)) === JSON.stringify(DTO_FIELDS);
  const meaningfulWindow = (value) => {
    const text = cleanText(value);
    if (!text || /\d{4}-\d{2}-\d{2}T|firstObservedAt|lastObservedAt/i.test(text)) return null;
    return text;
  };

  function render(dto) {
    if (!exactContract(dto) || dto.quiet === true || dto.displayEligible !== true) return "";
    const takeaway = cleanText(dto.historicalTakeaway);
    const guidance = cleanText(dto.liveConditionGuidance);
    if (!takeaway || !guidance) return "";
    const subject = cleanText(dto.subject);
    const historicalWindow = meaningfulWindow(dto.historicalWindow);
    return `<section class="lp071-history" aria-labelledby="lp071-history-heading">`
      + `<p class="lp071-history__label">Historical context</p>`
      + `<h3 id="lp071-history-heading" class="lp071-history__takeaway">${escapeHtml(takeaway)}</h3>`
      + (subject ? `<p class="lp071-history__subject"><span>Place</span>${escapeHtml(subject)}</p>` : "")
      + (historicalWindow ? `<p class="lp071-history__window"><span>Historically relevant</span>${escapeHtml(historicalWindow)}</p>` : "")
      + `<p class="lp071-history__guidance">${escapeHtml(guidance)}</p>`
      + `</section>`;
  }

  const api = Object.freeze({ CONTRACT_ID, DTO_FIELDS, ACTIVATION, exactContract, meaningfulWindow, render });
  globalScope.gridlyHistoricalIntelligencePresentation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
