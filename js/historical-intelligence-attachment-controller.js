(function attachHistoricalIntelligenceController(globalScope) {
  "use strict";

  const DTO_CONTRACT = "LP070.historical-intelligence-activation-boundary.v1";
  const RENDERER_CONTRACT = "LP071.historical-intelligence-presentation.v1";
  const activationBoundary = globalScope.gridlyHistoricalIntelligenceActivationBoundary ||
    (typeof module !== "undefined" && module.exports ? require("./historical-intelligence-activation-boundary.js") : null);
  const OWNERSHIP_CONTRACT = activationBoundary?.OWNERSHIP;
  const OWNER = OWNERSHIP_CONTRACT?.owner;
  const OWNER_TOKEN = OWNERSHIP_CONTRACT?.ownershipToken;
  const HOST_SELECTOR = OWNERSHIP_CONTRACT?.authorizedHost;
  const DTO_FIELDS = Object.freeze([
    "historicalTakeaway", "narrativeType", "subject", "historicalWindow",
    "liveConditionGuidance", "quiet", "displayEligible"
  ]);
  const ACTIVATION_DECISION = Object.freeze({
    milestone: "LP072",
    productionIntegrationPrepared: true,
    consumerVisible: false,
    activationAuthorized: false,
    explicitOptInRequired: true,
    reversibleAttachmentReady: true,
    rollbackReady: true,
    currentAlertAuthority: "Current alerts determine live conditions",
    approvedDtoContract: DTO_CONTRACT,
    approvedRendererContract: RENDERER_CONTRACT,
    owner: OWNER,
    ownershipToken: OWNER_TOKEN,
    authorizedHost: HOST_SELECTOR,
    lifecycleOwner: OWNERSHIP_CONTRACT?.lifecycleOwner,
    detachOwner: OWNERSHIP_CONTRACT?.detachOwner
  });
  const AUTHORIZED_HOST = Object.freeze({
    owner: OWNER,
    ownershipToken: OWNER_TOKEN,
    selector: HOST_SELECTOR,
    attachmentLocation: "after live current-condition content and before [data-lp072-supporting-detail], otherwise last",
    domOrdering: "current alerts, Historical Intelligence, lower-priority supporting detail",
    lifecycleOwner: OWNERSHIP_CONTRACT?.lifecycleOwner,
    refreshOwner: "Historical Intelligence attachment controller",
    detachOwner: OWNERSHIP_CONTRACT?.detachOwner,
    absentHostFallback: "fail closed with missing-host and no DOM changes"
  });

  const status = (code, details) => Object.freeze({ ok: code === "attached" || code === "already-attached" || code === "detached" || code === "rollback-complete", code, ...(details || {}) });
  const exactDto = (dto) => Boolean(dto && Object.getPrototypeOf(dto) !== null &&
    JSON.stringify(Object.keys(dto)) === JSON.stringify(DTO_FIELDS));
  const eligibleDto = (dto) => exactDto(dto) && dto.quiet === false && dto.displayEligible === true &&
    typeof dto.historicalTakeaway === "string" && Boolean(dto.historicalTakeaway.trim()) &&
    typeof dto.liveConditionGuidance === "string" && dto.liveConditionGuidance.trim() === "Check current alerts for live conditions.";
  const approvedRenderer = (renderer) => Boolean(renderer && renderer.CONTRACT_ID === DTO_CONTRACT &&
    JSON.stringify(renderer.DTO_FIELDS) === JSON.stringify(DTO_FIELDS) &&
    renderer.ACTIVATION?.approvedDtoVersion === DTO_CONTRACT && typeof renderer.exactContract === "function" &&
    typeof renderer.render === "function");

  function createController(options) {
    const settings = options || {};
    const documentRef = settings.document || globalScope.document || null;
    const renderer = settings.renderer || globalScope.gridlyHistoricalIntelligencePresentation;
    let attachment = null;
    const owned = { listeners: [], observers: [], timers: [] };

    function gate(dto, authorization) {
      const auth = authorization || {};
      if (!auth.activationAuthorized) return status("unauthorized");
      if (!auth.consumerVisible || !auth.productionIntegration) return status("activation-disabled");
      if (auth.owner !== OWNER || auth.ownershipToken !== OWNER_TOKEN ||
          auth.authorizedHost !== HOST_SELECTOR || auth.lifecycleOwner !== OWNERSHIP_CONTRACT.lifecycleOwner ||
          auth.detachOwner !== OWNERSHIP_CONTRACT.detachOwner) return status("owner-mismatch");
      if (!auth.prerequisites || !["LP067", "LP068", "LP069"].every((key) => auth.prerequisites[key] === true)) return status("unauthorized", { reason: "prerequisite-mismatch" });
      if (auth.dtoContract !== DTO_CONTRACT) return status("dto-contract-mismatch");
      if (auth.rendererContract !== RENDERER_CONTRACT || !approvedRenderer(renderer)) return status("renderer-unavailable");
      if (auth.currentAlertAuthority !== ACTIVATION_DECISION.currentAlertAuthority) return status("current-alert-authority-mismatch");
      if (!exactDto(dto)) return status("invalid-dto");
      if (dto.quiet === true && dto.displayEligible === false) return status("quiet-dto");
      if (!eligibleDto(dto) || !renderer.exactContract(dto)) return status("invalid-dto");
      const host = documentRef?.querySelector(HOST_SELECTOR);
      if (!host) return status("missing-host");
      return { ok: true, host };
    }

    function detach(reason) {
      if (!attachment) return status("detached", { changed: false });
      const { node } = attachment;
      owned.listeners.splice(0).forEach(({ target, type, handler, options: eventOptions }) => target.removeEventListener(type, handler, eventOptions));
      owned.observers.splice(0).forEach((observer) => observer.disconnect());
      owned.timers.splice(0).forEach((timer) => globalScope.clearTimeout(timer));
      if (node.parentNode) node.parentNode.removeChild(node);
      attachment = null;
      return status("rollback-complete", { changed: true, reason: reason || "detach" });
    }

    function attach(dto, authorization) {
      try {
        const result = gate(dto, authorization);
        if (!result.ok) {
          if (result.code === "quiet-dto" && attachment) detach("quiet-dto");
          return result;
        }
        const markup = renderer.render(dto);
        if (!markup || !/^<section class="lp071-history"/.test(markup)) return status("invalid-dto");
        if (attachment && attachment.host === result.host && attachment.markup === markup && attachment.node.parentNode === result.host) return status("already-attached");
        if (attachment) detach("refresh");
        const wrapper = documentRef.createElement("div");
        wrapper.setAttribute("data-lp072-attachment", OWNER_TOKEN);
        wrapper.setAttribute("data-lp072-controller-owner", OWNER_TOKEN);
        wrapper.setAttribute("data-lp072-lifecycle-owner", OWNER_TOKEN);
        wrapper.setAttribute("data-lp072-detach-owner", OWNER_TOKEN);
        wrapper.innerHTML = markup;
        const supportingDetail = result.host.querySelector("[data-lp072-supporting-detail]");
        result.host.insertBefore(wrapper, supportingDetail || null);
        attachment = { host: result.host, node: wrapper, markup, owner: OWNER, ownershipToken: OWNER_TOKEN,
          authorizedHost: HOST_SELECTOR, lifecycleOwner: OWNERSHIP_CONTRACT.lifecycleOwner, detachOwner: OWNERSHIP_CONTRACT.detachOwner };
        return status("attached", { owner: attachment.owner, ownershipToken: attachment.ownershipToken,
          authorizedHost: attachment.authorizedHost, lifecycleOwner: attachment.lifecycleOwner, detachOwner: attachment.detachOwner });
      } catch (_) {
        return status("invalid-dto", { reason: "safe-failure" });
      }
    }

    return Object.freeze({ attach, detach, state: () => Object.freeze({ attached: Boolean(attachment), ownedListeners: owned.listeners.length, ownedObservers: owned.observers.length, ownedTimers: owned.timers.length }) });
  }

  const api = Object.freeze({ DTO_CONTRACT, RENDERER_CONTRACT, OWNERSHIP_CONTRACT, OWNER, OWNER_TOKEN, HOST_SELECTOR, DTO_FIELDS, ACTIVATION_DECISION, AUTHORIZED_HOST, exactDto, approvedRenderer, createController });
  globalScope.gridlyHistoricalIntelligenceAttachmentController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
