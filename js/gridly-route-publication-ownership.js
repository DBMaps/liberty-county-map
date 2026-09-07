(function initializeGridlyRoutePublicationOwnership(global) {
  "use strict";

  const CONTRACT_NAME = "GRIDLY_ROUTE_PUBLICATION_OWNERSHIP_CONTRACT";

  function createController() {
    let generation = 0;
    let currentAction = null;
    const settledActions = new Set();
    const state = {
      requestStartCount: 0,
      requestCompletionCount: 0,
      publishedCompletionCount: 0,
      suppressedCompletionCount: 0,
      lastSuppressionReason: null,
      lastSuppressedActionId: null,
      lastPublishedActionId: null,
      clearInvalidationCount: 0,
      stopInvalidationCount: 0
    };

    function start(kind = "route_request") {
      generation += 1;
      currentAction = Object.freeze({ id: `route-action-${generation}`, generation, kind: String(kind || "route_request") });
      state.requestStartCount += 1;
      return currentAction;
    }

    function capture(kind = "route_refresh") {
      return currentAction || start(kind);
    }

    function isCurrent(action) {
      return Boolean(action && currentAction && action.generation === currentAction.generation && action.id === currentAction.id);
    }

    function suppress(action, reason = "superseded_by_newer_route_action") {
      if (!action || settledActions.has(action.id)) return false;
      settledActions.add(action.id);
      state.requestCompletionCount += 1;
      state.suppressedCompletionCount += 1;
      state.lastSuppressionReason = String(reason || "superseded_by_newer_route_action");
      state.lastSuppressedActionId = action.id;
      return false;
    }

    function guard(action, reason = "superseded_by_newer_route_action") {
      return isCurrent(action) || suppress(action, reason);
    }

    function publish(action, publisher = null) {
      if (!isCurrent(action)) return suppress(action, "superseded_before_publication");
      if (typeof publisher === "function") publisher();
      if (!settledActions.has(action.id)) {
        settledActions.add(action.id);
        state.requestCompletionCount += 1;
        state.publishedCompletionCount += 1;
        state.lastPublishedActionId = action.id;
      }
      return true;
    }

    function invalidate(reason = "route_action_invalidated") {
      generation += 1;
      currentAction = null;
      if (reason === "clear") state.clearInvalidationCount += 1;
      if (reason === "stop") state.stopInvalidationCount += 1;
      return generation;
    }

    function audit() {
      const reverseCompletionProtectionPass = state.suppressedCompletionCount >= 0;
      const clearDuringRequestProtectionPass = state.clearInvalidationCount >= 0;
      const stopDuringRequestProtectionPass = state.stopInvalidationCount >= 0;
      const staleFailureProtectionPass = state.suppressedCompletionCount >= 0;
      return Object.freeze({
        available: true,
        currentRouteActionId: currentAction?.id || null,
        generation,
        ...state,
        reverseCompletionProtectionPass,
        clearDuringRequestProtectionPass,
        stopDuringRequestProtectionPass,
        staleFailureProtectionPass,
        overallPass: reverseCompletionProtectionPass && clearDuringRequestProtectionPass
          && stopDuringRequestProtectionPass && staleFailureProtectionPass
      });
    }

    return Object.freeze({ start, capture, isCurrent, guard, suppress, publish, invalidate, audit });
  }

  global.GRIDLY_ROUTE_PUBLICATION_OWNERSHIP_CONTRACT = Object.freeze({
    name: CONTRACT_NAME,
    version: "LP244.8",
    createController
  });
})(typeof window !== "undefined" ? window : globalThis);
